import type { Metadata } from "next"
import { BRAND_NAME, BRAND_WEBSITE_URL } from "@/lib/constants/brand"

export const CANONICAL_ORIGIN = BRAND_WEBSITE_URL

const BRAND_SUFFIX_FULL = ` | ${BRAND_NAME}`
const BRAND_SUFFIX_SHORT = " | Al Ramlah"

/**
 * Resolves the canonical production site URL (`https://alramlahtravels.com`),
 * normalizing any `www.` host or local/preview env fallback to the single apex origin (`OD-10`, `SEO-008`).
 */
export function getCanonicalSiteUrl(
  configuredUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL
): URL {
  if (configuredUrl) {
    try {
      const parsed = new URL(configuredUrl.trim())
      const host = parsed.hostname.toLowerCase()
      const isLocal =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".local") ||
        host.endsWith(".ngrok-free.app") ||
        host.endsWith(".trycloudflare.com")
      if (parsed.protocol === "https:" && !isLocal) {
        if (host === "www.alramlahtravels.com") {
          return new URL(CANONICAL_ORIGIN)
        }
        return new URL(`${parsed.protocol}//${host}`)
      }
    } catch {
      // Fall through to canonical origin
    }
  }
  return new URL(CANONICAL_ORIGIN)
}

function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

function trimTrailingSeparators(input: string): string {
  return input.replace(/[\s|—–\-:,;·•]+$/g, "").trim()
}

/**
 * Clamps an SEO `<title>` cleanly at a word boundary within `maxLen` characters (`<= 60`).
 */
export function clampSeoTitle(raw: string, maxLen = 60): string {
  const normalized = trimTrailingSeparators(collapseWhitespace(raw))
  if (normalized.length <= maxLen) {
    return normalized
  }

  const budget = Math.max(10, maxLen - 1)
  const sliced = normalized.slice(0, budget)
  const lastSpace = sliced.lastIndexOf(" ")
  const base =
    lastSpace >= Math.floor(budget * 0.6) ? sliced.slice(0, lastSpace) : sliced
  return `${trimTrailingSeparators(base)}…`
}

const DESCRIPTION_PAD_CLAUSES = [
  "Verified Lahore Umrah & Hajj desk on WhatsApp.",
  "Transparent PKR pricing from Askari 10, Lahore Cantt, Pakistan.",
  "Trusted Haramain concierge serving Lahore, Karachi & Islamabad.",
]

function clampToMaxWordBoundary(input: string, maxLen: number): string {
  if (input.length <= maxLen) {
    return input
  }
  const budget = Math.max(40, maxLen - 1)
  const sliced = input.slice(0, budget)
  const lastSpace = sliced.lastIndexOf(" ")
  const trimmed =
    lastSpace >= Math.floor(budget * 0.65) ? sliced.slice(0, lastSpace) : sliced
  return `${trimTrailingSeparators(trimmed)}…`
}

/**
 * Clamps and normalizes a meta description into the optimal `150–160` character SERP window (`SEO-002`).
 */
export function clampSeoDescription(
  raw: string,
  minLen = 150,
  maxLen = 160
): string {
  let text = collapseWhitespace(raw)
  if (!text) {
    text =
      "Book verified Umrah packages from Lahore, Karachi & Islamabad, Saudi Umrah e-visas, Haramain hotels, Ziyarat tours, and Hajj 2027 pre-registration in PKR."
  }

  if (text.length < minLen) {
    for (const clause of DESCRIPTION_PAD_CLAUSES) {
      if (text.length >= minLen) break
      const separator = /[.!?]$/.test(text) ? " " : ". "
      const candidate = `${text}${separator}${clause}`
      if (candidate.length <= maxLen) {
        text = candidate
      }
    }
    if (text.length < minLen) {
      const separator = /[.!?]$/.test(text) ? " " : ". "
      const extended = `${text}${separator}Book with Al Ramlah Travels at Askari 10, Lahore Cantt on WhatsApp for transparent PKR Haramain guidance.`
      const clamped = clampToMaxWordBoundary(extended, maxLen)
      if (clamped.length >= minLen) {
        return clamped
      }
      const exactBudget = Math.max(minLen, maxLen - 1)
      return `${trimTrailingSeparators(extended.slice(0, exactBudget))}…`
    }
  }

  return clampToMaxWordBoundary(text, maxLen)
}

function normalizeCanonicalPath(rawPath: string): string {
  const withoutQueryOrHash = (rawPath || "/").split(/[?#]/)[0]?.trim() || "/"
  const prefixed = withoutQueryOrHash.startsWith("/")
    ? withoutQueryOrHash
    : `/${withoutQueryOrHash}`
  if (prefixed === "/") {
    return "/"
  }
  return prefixed.replace(/\/+$/, "")
}

function resolveBrandedTitle(rawTitle: string, maxLen = 60): string {
  const cleaned = collapseWhitespace(rawTitle)
  const strippedBrand = trimTrailingSeparators(
    cleaned.replace(/\s*[|—–-]\s*Al Ramlah(?:\s+Travels)?$/i, "")
  )

  if (/al ramlah/i.test(strippedBrand)) {
    return clampSeoTitle(strippedBrand, maxLen)
  }

  const withFullBrand = `${strippedBrand}${BRAND_SUFFIX_FULL}`
  if (withFullBrand.length <= maxLen) {
    return withFullBrand
  }

  const withShortBrand = `${strippedBrand}${BRAND_SUFFIX_SHORT}`
  if (withShortBrand.length <= maxLen) {
    return withShortBrand
  }

  const coreBudget = Math.max(20, maxLen - BRAND_SUFFIX_SHORT.length)
  const clampedCore = clampSeoTitle(strippedBrand, coreBudget)
  return `${clampedCore}${BRAND_SUFFIX_SHORT}`
}

export interface PublicMetadataOptions {
  /** Relative route path, e.g. `"/umrah-packages/from-lahore"` or `"/"` */
  path: string
  /** Route-specific title (with or without trailing brand suffix; guaranteed `<= 60` chars) */
  title: string
  /** Route-specific meta description (clamped cleanly to `150–160` chars) */
  description: string
  /** Optional explicit Open Graph / Twitter image URL (`1200×630`); defaults to Next.js `opengraph-image.tsx` */
  ogImage?: string | null
  /** Open Graph resource type (`"website"` or `"article"`) */
  ogType?: "website" | "article"
  /** Set `true` on private, token-gated, or non-indexable surfaces */
  noIndex?: boolean
}

/**
 * Shared public metadata factory enforcing unique self-referencing canonicals,
 * `<=60`c branded titles (zero double-templating), `150–160`c descriptions,
 * `en_PK` Open Graph, `summary_large_image` Twitter cards, and zero `meta keywords`.
 */
export function buildPublicMetadata(options: PublicMetadataOptions): Metadata {
  const normalizedPath = normalizeCanonicalPath(options.path)
  const canonicalUrl =
    normalizedPath === "/"
      ? CANONICAL_ORIGIN
      : `${CANONICAL_ORIGIN}${normalizedPath}`

  const resolvedTitle = resolveBrandedTitle(options.title, 60)
  const resolvedDescription = clampSeoDescription(options.description, 150, 160)
  const ogType = options.ogType ?? "website"
  const ogImage = options.ogImage?.trim() || undefined

  return {
    title: {
      absolute: resolvedTitle,
    },
    description: resolvedDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: ogType,
      locale: "en_PK",
      siteName: BRAND_NAME,
      url: canonicalUrl,
      title: resolvedTitle,
      description: resolvedDescription,
      ...(ogImage
        ? {
            images: [
              {
                url: ogImage,
                width: 1200,
                height: 630,
                alt: resolvedTitle,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    robots: options.noIndex
      ? {
          index: false,
          follow: false,
          noarchive: true,
          nosnippet: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-snippet": -1,
            "max-image-preview": "large",
            "max-video-preview": -1,
          },
        },
  }
}
