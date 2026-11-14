import { z } from "zod"

const CONTROL_AND_WHITESPACE_RE = /[\u0000-\u0020\u007F-\u009F\u200B-\u200D\uFEFF]+/g
const DANGEROUS_SCHEME_RE = /^(javascript|data|vbscript|file|blob):/i

/**
 * Detects dangerous XSS / local-resource URI schemes (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`),
 * including obfuscated variants with embedded whitespace, tabs, newlines, or zero-width characters (`T-050`).
 */
export function hasDangerousUriScheme(raw: string): boolean {
  const normalized = raw.replace(CONTROL_AND_WHITESPACE_RE, "")
  if (!normalized) return false
  if (normalized.startsWith("//") || normalized.startsWith("\\\\")) {
    return true
  }
  return DANGEROUS_SCHEME_RE.test(normalized)
}

/**
 * Validates an image, banner, avatar, logo, or map embed URL:
 * - Blocks `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, and protocol-relative `//` URLs.
 * - Accepts clean site-relative paths (`/images/...`) or valid `https://` URLs (`<= 2048` chars).
 */
export function isSafeMediaOrAssetUrl(raw: string): boolean {
  if (typeof raw !== "string") return false
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 2048) return false
  if (hasDangerousUriScheme(trimmed)) return false

  if (trimmed.startsWith("/")) {
    // Reject protocol-relative `//evil.com` or backslash tricks `/\evil.com`
    return !trimmed.startsWith("//") && !trimmed.startsWith("/\\")
  }

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "https:" && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Validates a CTA link (`primaryCtaUrl`, `secondaryCtaUrl`, `ctaHref`, `ctaUrl`):
 * - Blocks `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, and protocol-relative `//` URLs.
 * - Accepts in-page `#anchor` links, site-relative `/path` routes, `https://` URLs, `mailto:`, and `tel:`.
 */
export function isSafeCtaHref(raw: string): boolean {
  if (typeof raw !== "string") return false
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 2048) return false
  if (hasDangerousUriScheme(trimmed)) return false

  if (trimmed.startsWith("#")) {
    return /^#[A-Za-z0-9_/-]*$/.test(trimmed)
  }

  if (trimmed.startsWith("/")) {
    return !trimmed.startsWith("//") && !trimmed.startsWith("/\\")
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === "https:") {
      return Boolean(parsed.hostname)
    }
    if (parsed.protocol === "mailto:" || parsed.protocol === "tel:") {
      return parsed.pathname.trim().length > 0
    }
    return false
  } catch {
    return false
  }
}

const UNSAFE_ASSET_MSG =
  "Must be a valid https:// URL or relative /path (javascript:, data:, and vbscript: URIs are blocked)"
const UNSAFE_CTA_MSG =
  "Must be a safe #anchor, /path, https://, mailto:, or tel: link (javascript:, data:, and vbscript: URIs are blocked)"

export function safeRequiredAssetUrlSchema(label = "Image URL") {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(2048, `${label} cannot exceed 2048 characters`)
    .refine(isSafeMediaOrAssetUrl, UNSAFE_ASSET_MSG)
}

export function safeOptionalAssetUrlSchema(label = "Image URL") {
  return z
    .string()
    .trim()
    .max(2048, `${label} cannot exceed 2048 characters`)
    .refine((v) => v === "" || isSafeMediaOrAssetUrl(v), UNSAFE_ASSET_MSG)
    .optional()
}

export function safeNullableAssetUrlSchema(label = "Image URL") {
  return z
    .string()
    .trim()
    .max(2048, `${label} cannot exceed 2048 characters`)
    .refine((v) => v === "" || isSafeMediaOrAssetUrl(v), UNSAFE_ASSET_MSG)
    .optional()
    .nullable()
}

export function safeRequiredCtaUrlSchema(defaultHref = "#custom-builder") {
  return z
    .string()
    .trim()
    .min(1, "CTA URL is required")
    .max(2048, "CTA URL cannot exceed 2048 characters")
    .refine(isSafeCtaHref, UNSAFE_CTA_MSG)
    .default(defaultHref)
}

export function safeOptionalCtaUrlSchema() {
  return z
    .string()
    .trim()
    .max(2048, "CTA URL cannot exceed 2048 characters")
    .refine((v) => v === "" || isSafeCtaHref(v), UNSAFE_CTA_MSG)
    .optional()
}
