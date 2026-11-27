import {
  getAuthenticatedAdminOrNull,
  requireAdmin,
  requireSuperAdmin,
} from "@/lib/auth-guard"
import { extractStorageKeyFromUrlOrKey } from "@/lib/storage/r2"
import {
  hasBlockedActiveContentExtension,
  MAX_PILGRIM_DOCUMENT_BYTES,
  PILGRIM_DOC_ALLOWED_MIMES,
  validatePilgrimDocumentMimeAndSize,
  type PilgrimDocSlotType,
  type PilgrimDocumentValidationResult,
} from "@/lib/validations/pilgrim-documents"

export {
  hasBlockedActiveContentExtension,
  PILGRIM_DOC_ALLOWED_MIMES,
  validatePilgrimDocumentMimeAndSize,
  type PilgrimDocSlotType,
  type PilgrimDocumentValidationResult,
}

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
export const MAX_PILGRIM_DOCUMENT_UPLOAD_BYTES = MAX_PILGRIM_DOCUMENT_BYTES
export const MAX_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024 // 250 MB
export const MAX_LOCAL_DEV_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB
export const MAX_HERO_SLIDE_MEDIA_BYTES = 25 * 1024 * 1024 // 25 MB (`26,214,400` bytes)

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

export const HERO_SLIDE_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

export function isHeroSlidesUploadFolder(rawOrSanitizedFolder: string): boolean {
  const normalized = rawOrSanitizedFolder
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .trim()
    .toLowerCase()
  return (
    normalized === "cms/hero-slides" || normalized.startsWith("cms/hero-slides/")
  )
}

export function validateHeroSlideFolderAndMime(params: {
  folder: string
  canonicalMime: string
  sizeBytes: number
  filename?: string
}): { ok: true } | { ok: false; status: 400 | 413 | 415; error: string } {
  if (params.filename && hasBlockedActiveContentExtension(params.filename)) {
    return {
      ok: false,
      status: 400,
      error:
        "Executable or markup file extensions (HTML, SVG, JS, XML) are prohibited",
    }
  }

  if (
    !Number.isFinite(params.sizeBytes) ||
    params.sizeBytes <= 0 ||
    params.sizeBytes > MAX_HERO_SLIDE_MEDIA_BYTES
  ) {
    return {
      ok: false,
      status: 400,
      error: "Hero slide media cannot exceed 25MB",
    }
  }

  if (params.folder === "cms/hero-slides/videos") {
    if (params.canonicalMime !== "video/mp4") {
      return {
        ok: false,
        status: 400,
        error: "Hero slide videos must be MP4 (video/mp4) up to 25MB",
      }
    }
    return { ok: true }
  }

  if (
    params.folder === "cms/hero-slides/images" ||
    params.folder === "cms/hero-slides"
  ) {
    if (!HERO_SLIDE_IMAGE_MIMES.has(params.canonicalMime)) {
      return {
        ok: false,
        status: 400,
        error:
          "Hero slide poster images must be JPEG, PNG, or WebP up to 25MB",
      }
    }
    return { ok: true }
  }

  return {
    ok: false,
    status: 400,
    error:
      "Invalid hero slide upload subfolder. Allowed: cms/hero-slides/images or cms/hero-slides/videos",
  }
}

function isManagedR2Hostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host) return false
  if (
    host === "r2.alramlahtravels.com" ||
    host === "assets.alramlahtravels.com" ||
    host.endsWith(".r2.dev") ||
    host.endsWith(".r2.cloudflarestorage.com")
  ) {
    return true
  }

  const configuredR2Base = process.env.R2_PUBLIC_URL?.trim()
  if (configuredR2Base) {
    try {
      const parsed = new URL(configuredR2Base)
      if (parsed.hostname.toLowerCase() === host) {
        return true
      }
    } catch {
      // Ignore malformed env value
    }
  }

  return false
}

/**
 * Resolves a storage key strictly when `rawInput` belongs to our managed Cloudflare R2
 * or `/uploads/r2-local/` origins AND resides under `"cms/hero-slides/"`.
 * External third-party URLs (e.g. Unsplash or external CDNs) always return `null`.
 */
export function extractManagedHeroSlidesKey(
  rawInput: string | null | undefined
): string | null {
  const trimmed = rawInput?.trim()
  if (!trimmed) {
    return null
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    const configuredR2Base = (process.env.R2_PUBLIC_URL?.trim() ?? "").replace(
      /\/+$/,
      ""
    )
    const matchesConfiguredBase =
      Boolean(configuredR2Base) && trimmed.startsWith(`${configuredR2Base}/`)

    if (!matchesConfiguredBase) {
      try {
        const parsed = new URL(trimmed)
        if (parsed.protocol !== "https:") {
          return null
        }
        if (!isManagedR2Hostname(parsed.hostname)) {
          return null
        }
      } catch {
        return null
      }
    }
  } else if (trimmed.startsWith("/")) {
    const cleanPath = trimmed.split("?")[0]?.split("#")[0] ?? ""
    if (!cleanPath.startsWith("/uploads/r2-local/")) {
      return null
    }
  } else if (!trimmed.toLowerCase().startsWith("cms/hero-slides/")) {
    return null
  }

  const key = extractStorageKeyFromUrlOrKey(trimmed)
  if (!key || !key.startsWith("cms/hero-slides/")) {
    return null
  }
  return key
}

export type RouteAdminAuthDecision =
  | { ok: true; role?: "super_admin" | "staff" }
  | { ok: false; status: 401 | 403; error: string }

let routeAdminVerifierOverrideForTests:
  | ((req: Request) => Promise<RouteAdminAuthDecision> | RouteAdminAuthDecision)
  | null = null

export function setRouteAdminVerifierForTests(
  verifier:
    | ((
        req: Request
      ) => Promise<RouteAdminAuthDecision> | RouteAdminAuthDecision)
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
      const role =
        headerSession.user.role === "super_admin" ? "super_admin" : "staff"
      return { ok: true, role }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized"
    if (msg.toLowerCase().includes("forbidden")) {
      return { ok: false, status: 403, error: msg }
    }
  }

  try {
    const session = await requireAdmin()
    const role = session.user.role === "super_admin" ? "super_admin" : "staff"
    return { ok: true, role }
  } catch (authErr) {
    const message = authErr instanceof Error ? authErr.message : "Unauthorized"
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

/**
 * Verifies an active `super_admin` session (`401` unauthenticated, `403` `staff` or deactivated).
 */
export async function enforceRouteSuperAdminAuth(
  req: Request
): Promise<RouteAdminAuthDecision> {
  if (
    routeAdminVerifierOverrideForTests &&
    process.env.NODE_ENV !== "production"
  ) {
    const decision = await routeAdminVerifierOverrideForTests(req)
    if (!decision.ok) {
      return decision
    }
    if (decision.role === "staff") {
      return {
        ok: false,
        status: 403,
        error: "Forbidden: Super Administrator privilege required",
      }
    }
    return { ok: true, role: "super_admin" }
  }

  try {
    const headerSession = await getAuthenticatedAdminOrNull(req.headers)
    if (headerSession) {
      if (headerSession.user.role !== "super_admin") {
        return {
          ok: false,
          status: 403,
          error: "Forbidden: Super Administrator privilege required",
        }
      }
      return { ok: true, role: "super_admin" }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized"
    if (msg.toLowerCase().includes("forbidden")) {
      return { ok: false, status: 403, error: msg }
    }
  }

  try {
    await requireSuperAdmin()
    return { ok: true, role: "super_admin" }
  } catch (authErr) {
    const message = authErr instanceof Error ? authErr.message : "Unauthorized"
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
