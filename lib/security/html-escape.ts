const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
}

const HTML_ESCAPE_REGEX = /[&<>"'`]/g
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/**
 * Escapes untrusted text before interpolating into HTML element bodies
 * (e.g., Gotenberg quotation PDFs, poster templates, and transactional emails).
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }
  const str = String(value).replace(CONTROL_CHARS_REGEX, "")
  return str.replace(HTML_ESCAPE_REGEX, (ch) => HTML_ESCAPE_MAP[ch] ?? ch)
}

/**
 * Escapes untrusted values interpolated inside quoted HTML attributes
 * (`alt="..."`, `title="..."`, `data-*="..."`, `href="..."`).
 */
export function escapeAttr(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }
  const str = String(value)
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(/\r?\n/g, "&#10;")
  return str.replace(HTML_ESCAPE_REGEX, (ch) => HTML_ESCAPE_MAP[ch] ?? ch)
}

/**
 * Validates and HTML-attribute-escapes a URL before embedding in `src` or `href`,
 * blocking `javascript:`, `vbscript:`, `file:`, and non-image `data:` URIs.
 */
export function sanitizeSafeUrl(
  rawUrl: string | null | undefined,
  options?: { allowDataImage?: boolean; allowRelative?: boolean }
): string | null {
  if (!rawUrl) return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  if (options?.allowDataImage && /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed
  }

  if (options?.allowRelative && trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return escapeAttr(trimmed)
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null
    }
    return escapeAttr(parsed.toString())
  } catch {
    return null
  }
}
