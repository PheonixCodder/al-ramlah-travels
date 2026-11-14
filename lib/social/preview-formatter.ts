import { buildArtFirstCommentPlug } from "./first-comment"
import type { SocialPostFormat, SocialProviderId } from "./types"

// ==========================================
// 1. CONSTANTS & PLATFORM RULES
// ==========================================

export const CORE5_CHARACTER_LIMITS: Record<SocialProviderId, number> = {
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
  youtube: 5000,
  gmb: 1500,
}

export const CORE5_FOLD_LIMITS: Record<SocialProviderId, number> = {
  instagram: 125,
  facebook: 250,
  tiktok: 90,
  youtube: 100,
  gmb: 180,
}

export const CORE5_ASPECT_RATIOS: Record<SocialPostFormat, "4:5" | "9:16"> = {
  FEED: "4:5",
  REEL: "9:16",
  STORY: "9:16",
}

export interface PlatformPreviewRules {
  provider: SocialProviderId
  label: string
  maxCaptionChars: number
  maxTitleChars?: number
  foldPreviewChars: number
  maxHashtags?: number
  supportsFirstComment: boolean
  supportedFormats: SocialPostFormat[]
  requiresVideo: boolean
}

export const CORE5_PREVIEW_RULES: Record<SocialProviderId, PlatformPreviewRules> = {
  instagram: {
    provider: "instagram",
    label: "Instagram",
    maxCaptionChars: CORE5_CHARACTER_LIMITS.instagram,
    foldPreviewChars: CORE5_FOLD_LIMITS.instagram,
    maxHashtags: 30,
    supportsFirstComment: true,
    supportedFormats: ["FEED", "REEL", "STORY"],
    requiresVideo: false,
  },
  facebook: {
    provider: "facebook",
    label: "Facebook Page",
    maxCaptionChars: CORE5_CHARACTER_LIMITS.facebook,
    foldPreviewChars: CORE5_FOLD_LIMITS.facebook,
    supportsFirstComment: true,
    supportedFormats: ["FEED", "REEL", "STORY"],
    requiresVideo: false,
  },
  tiktok: {
    provider: "tiktok",
    label: "TikTok",
    maxCaptionChars: CORE5_CHARACTER_LIMITS.tiktok,
    foldPreviewChars: CORE5_FOLD_LIMITS.tiktok,
    supportsFirstComment: false,
    supportedFormats: ["REEL", "FEED"],
    requiresVideo: true,
  },
  youtube: {
    provider: "youtube",
    label: "YouTube Shorts",
    maxCaptionChars: CORE5_CHARACTER_LIMITS.youtube,
    maxTitleChars: 100,
    foldPreviewChars: CORE5_FOLD_LIMITS.youtube,
    supportsFirstComment: true,
    supportedFormats: ["REEL", "FEED"],
    requiresVideo: true,
  },
  gmb: {
    provider: "gmb",
    label: "Google Business",
    maxCaptionChars: CORE5_CHARACTER_LIMITS.gmb,
    foldPreviewChars: CORE5_FOLD_LIMITS.gmb,
    supportsFirstComment: false,
    supportedFormats: ["FEED"],
    requiresVideo: false,
  },
}

// ==========================================
// 2. INTERFACES & SNAPSHOT CONTRACTS
// ==========================================

export type PublishPreviewMode =
  | "SINGLE"
  | "SPOTLIGHT_THEN_SHEET"
  | "standalone"
  | "step_1_spotlight_hook"

export interface Core5MediaFrame {
  index: number
  label: string
  url: string
  stage: "spotlight" | "rate_sheet" | "media"
  isVideo: boolean
}

export interface GmbCallToActionPreview {
  actionType: "BOOK" | "LEARN_MORE"
  label: string
  url: string
  verifiedBadgeLabel: string
  branchLabel: string
}

export interface FirstCommentPreviewBlock {
  visible: boolean
  text: string
  containsArtCode: boolean
  containsWhatsappLink: boolean
  unsupportedReason: string | null
}

export interface Core5PreviewInput {
  provider: SocialProviderId
  caption: string
  postType?: SocialPostFormat
  postFormat?: SocialPostFormat
  publishMode?: PublishPreviewMode
  mediaUrls?: string[]
  spotlightMediaUrl?: string | null
  sheetMediaUrl?: string | null
  title?: string | null
  postCode?: string | null
  packageTitle?: string | null
  sharingPricePkr?: number | null
  quadPricePkr?: number | null
  triplePricePkr?: number | null
  doublePricePkr?: number | null
  makkahHotelName?: string | null
  madinahHotelName?: string | null
  autoFirstComment?: boolean
  firstComment?: string | null
  whatsappNumber?: string | null
  ctaType?: "BOOK" | "LEARN_MORE"
}

export interface Core5PreviewSnapshot {
  provider: SocialProviderId
  label: string
  postType: SocialPostFormat
  postFormat: SocialPostFormat
  charCount: number
  charLimit: number
  captionLength: number
  maxCaptionChars: number
  remainingChars: number
  remainingCaptionChars: number
  isOverLimit: boolean
  isOverCaptionLimit: boolean
  isNearCaptionLimit: boolean
  titleText: string
  titleLength: number
  maxTitleChars?: number
  isOverTitleLimit: boolean
  foldLimit: number
  foldPreviewText: string
  truncatedPreviewText: string
  isTruncatedAtFold: boolean
  isTruncatedFold: boolean
  hashtags: string[]
  hashtagCount: number
  isOverHashtagLimit: boolean
  aspectRatio: "4:5" | "9:16" | "1:1" | "16:9"
  aspectClass: string
  layoutMode: "feed_card" | "vertical_reel" | "ephemeral_story" | "gmb_local_card"
  isCarousel: boolean
  formatSupported: boolean
  mediaFrames: Core5MediaFrame[]
  pinnedFirstComment: string | null
  firstCommentPreview: FirstCommentPreviewBlock
  gmbCallToAction: GmbCallToActionPreview | null
  gmbLocalCard: {
    verifiedBadgeLabel: string
    branchLabel: string
    ctaLabel: string
    ctaButtonType: "BOOK" | "LEARN_MORE"
    ctaUrl: string
  } | null
  warnings: string[]
}

// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

function isVideoUrl(url: string): boolean {
  const lower = url.trim().toLowerCase()
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm") ||
    lower.includes("video")
  )
}

function normalizeWhatsappNumber(raw?: string | null): string {
  const digits = (raw || "923274029701").replace(/\D/g, "")
  if (digits.startsWith("03") && digits.length === 11) {
    return `92${digits.slice(1)}`
  }
  return digits || "923274029701"
}

function normalizeArtPostCode(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null
  const trimmed = raw.trim()
  return trimmed.toUpperCase().startsWith("ART-") ? trimmed : `ART-${trimmed}`
}

export function extractHashtags(text: string): string[] {
  if (!text) return []
  const matches = text.match(/#[\p{L}\p{N}_]+/gu)
  return matches ? Array.from(matches) : []
}

export function resolveAspectRatioConfig(params: {
  provider: SocialProviderId
  postFormat: SocialPostFormat
  mediaCount: number
}): {
  aspectRatio: "4:5" | "1:1" | "9:16" | "16:9"
  aspectClass: string
  layoutMode: "feed_card" | "vertical_reel" | "ephemeral_story" | "gmb_local_card"
  isCarousel: boolean
  formatSupported: boolean
  formatWarning: string | null
} {
  const { provider, postFormat, mediaCount } = params
  const rules = CORE5_PREVIEW_RULES[provider]
  const formatSupported = rules.supportedFormats.includes(postFormat)

  let formatWarning: string | null = null
  if (!formatSupported) {
    if (provider === "gmb") {
      formatWarning = `Google Business Profile only supports local FEED update cards (${postFormat} will publish as a 4:5 Local Update).`
    } else if (postFormat === "STORY" && (provider === "tiktok" || provider === "youtube")) {
      formatWarning = `${rules.label} does not support 24h ephemeral Stories via API (will render as a 9:16 vertical Short/Reel).`
    } else {
      formatWarning = `${rules.label} does not natively support ${postFormat} format.`
    }
  }

  // TikTok & YouTube Shorts always use 9:16 vertical video frame
  if (provider === "tiktok" || provider === "youtube") {
    return {
      aspectRatio: "9:16",
      aspectClass: "aspect-[9/16]",
      layoutMode: postFormat === "STORY" ? "ephemeral_story" : "vertical_reel",
      isCarousel: false,
      formatSupported,
      formatWarning,
    }
  }

  // Google Business Profile always renders 4:5 local update card
  if (provider === "gmb") {
    return {
      aspectRatio: "4:5",
      aspectClass: "aspect-[4/5]",
      layoutMode: "gmb_local_card",
      isCarousel: false,
      formatSupported,
      formatWarning,
    }
  }

  // Instagram & Facebook adapt to postFormat (FEED -> 4:5, REEL -> 9:16, STORY -> 9:16)
  if (postFormat === "REEL") {
    return {
      aspectRatio: "9:16",
      aspectClass: "aspect-[9/16]",
      layoutMode: "vertical_reel",
      isCarousel: false,
      formatSupported,
      formatWarning,
    }
  }

  if (postFormat === "STORY") {
    return {
      aspectRatio: "9:16",
      aspectClass: "aspect-[9/16]",
      layoutMode: "ephemeral_story",
      isCarousel: false,
      formatSupported,
      formatWarning,
    }
  }

  return {
    aspectRatio: CORE5_ASPECT_RATIOS.FEED,
    aspectClass: "aspect-[4/5]",
    layoutMode: "feed_card",
    isCarousel: mediaCount > 1,
    formatSupported,
    formatWarning,
  }
}

/**
 * Pure Core 5 social preview formatter & validator.
 * Computes exact character counts, fold truncations, hashtags, aspect ratio,
 * 2-step Spotlight -> Rate Sheet media frames, Pinned First Comment (`ART-...`),
 * and Google Business Profile WhatsApp CTA links.
 */
export function formatCore5Preview(input: Core5PreviewInput): Core5PreviewSnapshot {
  const provider = input.provider
  const rules = CORE5_PREVIEW_RULES[provider]
  const effectiveFormat: SocialPostFormat =
    input.postFormat || input.postType || "FEED"

  const caption = input.caption ?? ""
  const charCount = caption.length
  const charLimit = CORE5_CHARACTER_LIMITS[provider]
  const remainingChars = charLimit - charCount
  const isOverLimit = charCount > charLimit
  const isNearCaptionLimit = !isOverLimit && charCount >= Math.floor(charLimit * 0.9)

  // Title calculation (especially relevant for YouTube Shorts <= 100 chars)
  const firstNonEmptyLine =
    caption
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) || "Al Ramlah Travels Umrah Package"
  const titleText = input.title?.trim() || firstNonEmptyLine
  const titleLength = titleText.length
  const maxTitleChars = rules.maxTitleChars
  const isOverTitleLimit =
    typeof maxTitleChars === "number" ? titleLength > maxTitleChars : false

  // Fold truncation
  const foldLimit = CORE5_FOLD_LIMITS[provider]
  const isTruncatedAtFold = charCount > foldLimit
  const foldPreviewText = isTruncatedAtFold
    ? `${caption.slice(0, foldLimit).trimEnd()}...`
    : caption

  // Hashtags extraction
  const hashtags = extractHashtags(caption)
  const hashtagCount = hashtags.length
  const isOverHashtagLimit =
    typeof rules.maxHashtags === "number"
      ? hashtagCount > rules.maxHashtags
      : false

  // Build media frames (supports SPOTLIGHT_THEN_SHEET 2-step funnel)
  const isTwoStep =
    input.publishMode === "SPOTLIGHT_THEN_SHEET" ||
    input.publishMode === "step_1_spotlight_hook"

  const rawUrls = (input.mediaUrls || []).filter((u) => Boolean(u && u.trim()))
  const mediaFrames: Core5MediaFrame[] = []

  if (isTwoStep) {
    const spotlightUrl =
      input.spotlightMediaUrl?.trim() ||
      rawUrls[0] ||
      "/posters/spotlight-placeholder.jpg"
    const sheetUrl =
      input.sheetMediaUrl?.trim() ||
      rawUrls[1] ||
      rawUrls[0] ||
      "/posters/sheet-placeholder.jpg"

    mediaFrames.push({
      index: 0,
      label: "Frame 1: Spotlight Hook",
      url: spotlightUrl,
      stage: "spotlight",
      isVideo: isVideoUrl(spotlightUrl),
    })
    mediaFrames.push({
      index: 1,
      label: "Frame 2: Complete Rate Sheet",
      url: sheetUrl,
      stage: "rate_sheet",
      isVideo: isVideoUrl(sheetUrl),
    })
  } else if (rawUrls.length > 0) {
    rawUrls.forEach((url, idx) => {
      mediaFrames.push({
        index: idx,
        label: rawUrls.length > 1 ? `Slide ${idx + 1} of ${rawUrls.length}` : "Primary Media",
        url,
        stage: idx === 0 ? "spotlight" : "media",
        isVideo: isVideoUrl(url),
      })
    })
  } else if (input.spotlightMediaUrl?.trim()) {
    const u = input.spotlightMediaUrl.trim()
    mediaFrames.push({
      index: 0,
      label: "Frame 1: Spotlight Hook",
      url: u,
      stage: "spotlight",
      isVideo: isVideoUrl(u),
    })
  }

  // Aspect ratio & layout mode
  const aspectConfig = resolveAspectRatioConfig({
    provider,
    postFormat: effectiveFormat,
    mediaCount: mediaFrames.length,
  })

  // Pinned First Comment resolution (IG, FB, YouTube when postFormat !== STORY)
  const normalizedCode = normalizeArtPostCode(input.postCode)
  let resolvedCommentText = input.firstComment?.trim() || ""

  const shouldAutoGenerateComment =
    Boolean(input.autoFirstComment) ||
    (!resolvedCommentText && Boolean(normalizedCode) && input.autoFirstComment !== false)

  if (!resolvedCommentText && shouldAutoGenerateComment && normalizedCode) {
    resolvedCommentText = buildArtFirstCommentPlug({
      postCode: normalizedCode,
      title: input.packageTitle || input.title,
      sharingPricePkr: input.sharingPricePkr,
      quadPricePkr: input.quadPricePkr,
      triplePricePkr: input.triplePricePkr,
      doublePricePkr: input.doublePricePkr,
      makkahHotelName: input.makkahHotelName,
      madinahHotelName: input.madinahHotelName,
      whatsappNumber: input.whatsappNumber,
    })
  }

  let pinnedFirstComment: string | null = null
  let unsupportedReason: string | null = null

  if (effectiveFormat === "STORY") {
    unsupportedReason = "24h Stories do not support comment threads."
  } else if (!rules.supportsFirstComment) {
    unsupportedReason =
      provider === "gmb"
        ? "Google Business Profile uses a native WhatsApp Call-to-Action button instead of comments."
        : "TikTok uses caption & bio links rather than automated first-comment plugs."
  } else if (resolvedCommentText) {
    pinnedFirstComment = resolvedCommentText
  }

  const firstCommentPreview: FirstCommentPreviewBlock = {
    visible: Boolean(pinnedFirstComment),
    text: pinnedFirstComment || "",
    containsArtCode: /ART-[A-Z0-9-]+/i.test(pinnedFirstComment || ""),
    containsWhatsappLink: /wa\.me\/\d+/i.test(pinnedFirstComment || ""),
    unsupportedReason,
  }

  // Google Business Profile Call-To-Action button resolution
  const waPhone = normalizeWhatsappNumber(input.whatsappNumber)
  const ctaCode = normalizedCode || "ART-UMRAH-01"
  const waPrefill = `Assalamu Alaikum Al Ramlah Travels, I want details for package ${ctaCode}`
  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waPrefill)}`
  const ctaActionType = input.ctaType || "BOOK"
  const ctaButtonLabel =
    ctaActionType === "LEARN_MORE"
      ? `Learn More (${ctaCode})`
      : `Book on WhatsApp (${ctaCode})`

  const gmbCallToAction: GmbCallToActionPreview | null =
    provider === "gmb"
      ? {
          actionType: ctaActionType,
          label: ctaButtonLabel,
          url: waUrl,
          verifiedBadgeLabel: "Verified • Askari 10 & DHA Lahore",
          branchLabel: "Al Ramlah Travels — Askari 10 & DHA Lahore",
        }
      : null

  const gmbLocalCard = gmbCallToAction
    ? {
        verifiedBadgeLabel: gmbCallToAction.verifiedBadgeLabel,
        branchLabel: gmbCallToAction.branchLabel,
        ctaLabel: gmbCallToAction.label,
        ctaButtonType: gmbCallToAction.actionType,
        ctaUrl: gmbCallToAction.url,
      }
    : null

  // Validation & operator warnings
  const warnings: string[] = []

  if (isOverLimit) {
    warnings.push(
      `${rules.label} caption exceeds ${charLimit.toLocaleString()} characters (${charCount.toLocaleString()} / ${charLimit.toLocaleString()}).`
    )
  }

  if (isOverTitleLimit && maxTitleChars) {
    warnings.push(
      `${rules.label} title exceeds ${maxTitleChars} characters (${titleLength} / ${maxTitleChars}).`
    )
  }

  if (isOverHashtagLimit && rules.maxHashtags) {
    warnings.push(
      `${rules.label} recommends at most ${rules.maxHashtags} hashtags (${hashtagCount} detected).`
    )
  }

  if (aspectConfig.formatWarning) {
    warnings.push(aspectConfig.formatWarning)
  }

  const hasVideo = mediaFrames.some((f) => f.isVideo)
  if (
    (rules.requiresVideo || effectiveFormat === "REEL") &&
    mediaFrames.length > 0 &&
    !hasVideo
  ) {
    warnings.push(
      `${rules.label} ${effectiveFormat === "REEL" ? "Reel/Short" : "video post"} works best with an .mp4 or .mov vertical video asset.`
    )
  }

  return {
    provider,
    label: rules.label,
    postType: effectiveFormat,
    postFormat: effectiveFormat,
    charCount,
    charLimit,
    captionLength: charCount,
    maxCaptionChars: charLimit,
    remainingChars,
    remainingCaptionChars: remainingChars,
    isOverLimit,
    isOverCaptionLimit: isOverLimit,
    isNearCaptionLimit,
    titleText,
    titleLength,
    maxTitleChars,
    isOverTitleLimit,
    foldLimit,
    foldPreviewText,
    truncatedPreviewText: foldPreviewText,
    isTruncatedAtFold,
    isTruncatedFold: isTruncatedAtFold,
    hashtags,
    hashtagCount,
    isOverHashtagLimit,
    aspectRatio: aspectConfig.aspectRatio,
    aspectClass: aspectConfig.aspectClass,
    layoutMode: aspectConfig.layoutMode,
    isCarousel: mediaFrames.length > 1,
    formatSupported: aspectConfig.formatSupported,
    mediaFrames,
    pinnedFirstComment,
    firstCommentPreview,
    gmbCallToAction,
    gmbLocalCard,
    warnings,
  }
}

export const formatPlatformPreviewState = formatCore5Preview
