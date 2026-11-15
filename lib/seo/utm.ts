import { z } from "zod"

export const UTM_STORAGE_KEY = "alramlah_attribution_v1"

export interface AttributionPayload {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
  landingPage: string | null
  httpReferrer: string | null
}

export const EMPTY_ATTRIBUTION: AttributionPayload = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  landingPage: null,
  httpReferrer: null,
}

function stripControlChars(raw: string): string {
  return raw.replace(/[\x00-\x1F\x7F]+/g, "").trim()
}

function sanitizeShortToken(
  raw: unknown,
  maxLen: number
): string | null {
  if (typeof raw !== "string") return null
  const cleaned = stripControlChars(raw)
  if (!cleaned) return null
  return cleaned.slice(0, maxLen)
}

function sanitizeLandingPage(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const cleaned = stripControlChars(raw)
  if (!cleaned) return null
  if (!cleaned.startsWith("/") || cleaned.startsWith("//")) {
    return null
  }
  const withoutHash = cleaned.split("#")[0] ?? "/"
  return (withoutHash || "/").slice(0, 512)
}

function sanitizeHttpReferrer(
  raw: unknown,
  sameOriginHost?: string | null
): string | null {
  if (typeof raw !== "string") return null
  const cleaned = stripControlChars(raw)
  if (!cleaned) return null

  try {
    const parsed = new URL(cleaned)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }
    if (
      sameOriginHost &&
      parsed.hostname.toLowerCase() === sameOriginHost.trim().toLowerCase()
    ) {
      return null
    }
    // Also reject canonical self-referrals when normalized server-side
    const refHost = parsed.hostname.toLowerCase()
    if (
      refHost === "alramlahtravels.com" ||
      refHost === "www.alramlahtravels.com"
    ) {
      return null
    }
    parsed.username = ""
    parsed.password = ""
    parsed.hash = ""
    return parsed.toString().slice(0, 512)
  } catch {
    return null
  }
}

/**
 * Pure attribution sanitizer enforcing length bounds, control-character stripping,
 * relative-path-only `landingPage`, and external credential-free `httpReferrer` (`SEO-003`, `S14`).
 */
export function sanitizeAttributionInput(
  raw: unknown,
  options?: { sameOriginHost?: string | null }
): AttributionPayload {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_ATTRIBUTION }
  }
  const record = raw as Record<string, unknown>

  return {
    utmSource: sanitizeShortToken(record.utmSource, 120),
    utmMedium: sanitizeShortToken(record.utmMedium, 120),
    utmCampaign: sanitizeShortToken(record.utmCampaign, 160),
    utmContent: sanitizeShortToken(record.utmContent, 160),
    utmTerm: sanitizeShortToken(record.utmTerm, 160),
    landingPage: sanitizeLandingPage(record.landingPage),
    httpReferrer: sanitizeHttpReferrer(
      record.httpReferrer,
      options?.sameOriginHost
    ),
  }
}

const optionalRawField = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()

export const strictAttributionSchema = z
  .object({
    utmSource: optionalRawField,
    utmMedium: optionalRawField,
    utmCampaign: optionalRawField,
    utmContent: optionalRawField,
    utmTerm: optionalRawField,
    landingPage: optionalRawField,
    httpReferrer: optionalRawField,
  })
  .strip()
  .transform((val): AttributionPayload => sanitizeAttributionInput(val))

function resolveSessionStorage(
  explicitStorage?: Storage | null
): Storage | null {
  if (explicitStorage !== undefined) {
    return explicitStorage
  }
  if (typeof window === "undefined") {
    return null
  }
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Safely reads first-touch attribution from `sessionStorage["alramlah_attribution_v1"]`.
 * Returns `EMPTY_ATTRIBUTION` on SSR or storage access restrictions.
 */
export function readStoredAttribution(
  explicitStorage?: Storage | null
): AttributionPayload {
  const storage = resolveSessionStorage(explicitStorage)
  if (!storage) {
    return { ...EMPTY_ATTRIBUTION }
  }
  try {
    const raw = storage.getItem(UTM_STORAGE_KEY)
    if (!raw) {
      return { ...EMPTY_ATTRIBUTION }
    }
    return sanitizeAttributionInput(JSON.parse(raw))
  } catch {
    return { ...EMPTY_ATTRIBUTION }
  }
}

export interface CaptureAttributionOptions {
  pathname?: string
  search?: string
  referrer?: string
  currentHostname?: string
  storage?: Storage | null
}

/**
 * Captures and persists first-touch `landingPage` and external `httpReferrer` in `sessionStorage`,
 * while updating `utm_*` fields whenever explicit new `utm_*` query parameters arrive in the tab.
 */
export function captureFirstTouchAttribution(
  options?: CaptureAttributionOptions
): AttributionPayload {
  const storage = resolveSessionStorage(options?.storage)
  const pathname =
    options?.pathname ??
    (typeof window !== "undefined" ? window.location.pathname : "/")
  const search =
    options?.search ??
    (typeof window !== "undefined" ? window.location.search : "")
  const referrer =
    options?.referrer ??
    (typeof document !== "undefined" ? document.referrer : "")
  const currentHostname =
    options?.currentHostname ??
    (typeof window !== "undefined" ? window.location.hostname : "")

  const normalizedSearch = search
    ? search.startsWith("?")
      ? search
      : `?${search}`
    : ""
  const params = new URLSearchParams(normalizedSearch)

  const incomingUtm = {
    utmSource: sanitizeShortToken(params.get("utm_source"), 120),
    utmMedium: sanitizeShortToken(params.get("utm_medium"), 120),
    utmCampaign: sanitizeShortToken(params.get("utm_campaign"), 160),
    utmContent: sanitizeShortToken(params.get("utm_content"), 160),
    utmTerm: sanitizeShortToken(params.get("utm_term"), 160),
  }
  const hasIncomingUtm = Boolean(
    incomingUtm.utmSource ||
      incomingUtm.utmMedium ||
      incomingUtm.utmCampaign ||
      incomingUtm.utmContent ||
      incomingUtm.utmTerm
  )

  const candidateLanding = sanitizeLandingPage(`${pathname}${normalizedSearch}`)
  const candidateReferrer = sanitizeHttpReferrer(referrer, currentHostname)

  const existing = readStoredAttribution(storage)
  const hasExistingTouch = Boolean(
    existing.landingPage ||
      existing.httpReferrer ||
      existing.utmSource ||
      existing.utmMedium ||
      existing.utmCampaign
  )

  const merged: AttributionPayload = hasExistingTouch
    ? {
        utmSource: hasIncomingUtm
          ? incomingUtm.utmSource
          : existing.utmSource,
        utmMedium: hasIncomingUtm
          ? incomingUtm.utmMedium
          : existing.utmMedium,
        utmCampaign: hasIncomingUtm
          ? incomingUtm.utmCampaign
          : existing.utmCampaign,
        utmContent: hasIncomingUtm
          ? incomingUtm.utmContent
          : existing.utmContent,
        utmTerm: hasIncomingUtm ? incomingUtm.utmTerm : existing.utmTerm,
        landingPage: existing.landingPage ?? candidateLanding,
        httpReferrer: existing.httpReferrer ?? candidateReferrer,
      }
    : {
        ...incomingUtm,
        landingPage: candidateLanding,
        httpReferrer: candidateReferrer,
      }

  const sanitized = sanitizeAttributionInput(merged, {
    sameOriginHost: currentHostname,
  })

  if (storage) {
    try {
      storage.setItem(UTM_STORAGE_KEY, JSON.stringify(sanitized))
    } catch {
      // Ignore quota / private-browsing storage write errors
    }
  }

  return sanitized
}

/**
 * Display-only channel classification helper for Admin Dossier & Messages Inbox (`S14` §2.3).
 * Never mutates raw `utmSource` stored in PostgreSQL.
 */
export function inferAcquisitionChannel(
  attribution?: Partial<AttributionPayload> | null
): string | null {
  if (!attribution) return null
  const source = (attribution.utmSource ?? "").trim().toLowerCase()
  const medium = (attribution.utmMedium ?? "").trim().toLowerCase()

  if (source) {
    const isPaid = /^(cpc|ppc|paid|paid_social|ads|display)$/.test(medium)
    if (source.includes("chatgpt") || source.includes("openai")) {
      return "AI Search: ChatGPT"
    }
    if (source.includes("perplexity")) {
      return "AI Search: Perplexity"
    }
    if (source.includes("claude")) {
      return "AI Search: Claude"
    }
    if (source.includes("google")) {
      return isPaid ? "Paid Search: Google Ads" : "Google Campaign"
    }
    if (
      source.includes("facebook") ||
      source.includes("instagram") ||
      source === "ig" ||
      source === "fb" ||
      source === "meta"
    ) {
      return isPaid ? "Paid Social: Meta Ads" : `Social: ${attribution.utmSource}`
    }
    return medium
      ? `Campaign: ${attribution.utmSource} / ${attribution.utmMedium}`
      : `Campaign: ${attribution.utmSource}`
  }

  const ref = (attribution.httpReferrer ?? "").trim()
  if (ref) {
    try {
      const host = new URL(ref).hostname.toLowerCase()
      if (host.includes("chatgpt.com") || host.includes("openai.com")) {
        return "AI Search: ChatGPT"
      }
      if (host.includes("perplexity.ai")) {
        return "AI Search: Perplexity"
      }
      if (host.includes("claude.ai")) {
        return "AI Search: Claude"
      }
      if (host.includes("gemini.google.com")) {
        return "AI Search: Gemini"
      }
      if (host === "google.com" || host.startsWith("www.google.") || host.includes(".google.")) {
        return "Organic Search: Google"
      }
      if (host.includes("bing.com")) {
        return "Organic Search: Bing"
      }
      if (host.includes("facebook.com") || host.includes("fb.com")) {
        return "Social Referral: Facebook"
      }
      if (host.includes("instagram.com")) {
        return "Social Referral: Instagram"
      }
      if (host.includes("tiktok.com")) {
        return "Social Referral: TikTok"
      }
      if (host.includes("youtube.com") || host.includes("youtu.be")) {
        return "Video Referral: YouTube"
      }
      return `Referral: ${host}`
    } catch {
      return null
    }
  }

  if (attribution.landingPage && attribution.landingPage !== "/") {
    return "Direct Spoke Entry"
  }

  return null
}

/**
 * Formats a concise, human-readable attribution tag (`<= 80` chars) for `wa.me` Click-to-Chat prefill messages (`S14-006`).
 * Returns `""` on plain homepage visits without campaign or external referrer context.
 */
export function formatWhatsAppAttributionSuffix(
  attribution?: Partial<AttributionPayload> | null,
  currentPathname?: string | null
): string {
  const cleanCurrentPath = sanitizeLandingPage(currentPathname ?? "")
  const landingPathOnly = sanitizeLandingPage(
    (attribution?.landingPage ?? "").split("?")[0] ?? ""
  )
  const effectivePath =
    cleanCurrentPath && cleanCurrentPath !== "/"
      ? cleanCurrentPath.split("?")[0] ?? "/"
      : landingPathOnly && landingPathOnly !== "/"
        ? landingPathOnly
        : null

  const source = sanitizeShortToken(attribution?.utmSource, 24)
  const medium = sanitizeShortToken(attribution?.utmMedium, 16)
  const inferred = !source ? inferAcquisitionChannel(attribution) : null

  const sourceTag = source
    ? medium
      ? `${source}/${medium}`
      : source
    : inferred && !inferred.startsWith("Direct")
      ? inferred.replace(/^(AI Search|Organic Search|Social Referral|Video Referral):\s*/i, "")
      : null

  if (!effectivePath && !sourceTag) {
    return ""
  }

  const parts: string[] = []
  if (effectivePath) {
    parts.push(effectivePath.slice(0, 42))
  }
  if (sourceTag) {
    parts.push(sourceTag.slice(0, 24))
  }

  const rawLine = `[Via: ${parts.join(" · ")}]`
  const capped = rawLine.length <= 79 ? rawLine : `${rawLine.slice(0, 75)}…]`
  return `\n${capped}`
}
