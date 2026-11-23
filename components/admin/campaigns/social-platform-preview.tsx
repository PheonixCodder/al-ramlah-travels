"use client"

import * as React from "react"
import Image from "next/image"
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Disc,
  ExternalLink,
  FileText,
  Film,
  Globe,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Music,
  Pin,
  Play,
  Send,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  CORE5_ASPECT_RATIOS,
  CORE5_CHARACTER_LIMITS,
  formatCore5Preview,
  type Core5PreviewSnapshot,
  type PublishPreviewMode,
} from "@/lib/social/preview-formatter"
import type { SocialPostFormat, SocialProviderId } from "@/lib/social/types"
import { cn } from "@/lib/utils"

// ==========================================
// 1. PROPS & PLATFORM METADATA
// ==========================================

export interface SocialPlatformPreviewProps {
  caption: string
  title?: string | null
  postType?: SocialPostFormat
  postFormat?: SocialPostFormat
  onPostTypeChange?: (format: SocialPostFormat) => void
  publishMode?: PublishPreviewMode
  mediaUrls?: string[]
  spotlightMediaUrl?: string | null
  sheetMediaUrl?: string | null
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
  selectedProviders?: SocialProviderId[]
  connectedAccounts?: Array<{
    provider: SocialProviderId
    name: string
    handle?: string | null
    avatarUrl?: string | null
  }>
  officeLocationLabel?: string
  defaultProvider?: SocialProviderId
  className?: string
}

const PLATFORM_TABS: Array<{
  id: SocialProviderId
  label: string
  shortLabel: string
  badgeClass: string
  activeBorderClass: string
}> = [
  {
    id: "instagram",
    label: "Instagram",
    shortLabel: "IG",
    badgeClass: "bg-accent text-accent-foreground border-gold-border",
    activeBorderClass: "border-gold bg-accent/70 text-primary",
  },
  {
    id: "facebook",
    label: "Facebook",
    shortLabel: "FB",
    badgeClass:
      "bg-status-info-bg text-status-info border-status-info-border",
    activeBorderClass:
      "border-status-info bg-status-info-bg text-status-info",
  },
  {
    id: "tiktok",
    label: "TikTok",
    shortLabel: "TT",
    badgeClass: "bg-secondary text-foreground border-border",
    activeBorderClass: "border-foreground bg-secondary text-foreground",
  },
  {
    id: "youtube",
    label: "YouTube Shorts",
    shortLabel: "YT",
    badgeClass:
      "bg-status-danger-bg text-status-danger border-status-danger-border",
    activeBorderClass:
      "border-status-danger bg-status-danger-bg text-status-danger",
  },
  {
    id: "gmb",
    label: "Google Business",
    shortLabel: "GMB",
    badgeClass:
      "bg-status-success-bg text-status-success border-status-success-border",
    activeBorderClass:
      "border-status-success bg-status-success-bg text-status-success",
  },
]

const FORMAT_PILLS: Array<{
  id: SocialPostFormat
  label: string
  ratio: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "FEED", label: "Feed", ratio: CORE5_ASPECT_RATIOS.FEED, icon: ImageIcon },
  { id: "REEL", label: "Reel", ratio: CORE5_ASPECT_RATIOS.REEL, icon: Film },
  { id: "STORY", label: "Story", ratio: CORE5_ASPECT_RATIOS.STORY, icon: Smartphone },
]

function getRenderableImagePreviewUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  const pathname = trimmed.split(/[?#]/)[0]?.toLowerCase() || ""
  if (
    pathname.endsWith(".mp4") ||
    pathname.endsWith(".mov") ||
    pathname.endsWith(".webm") ||
    pathname.endsWith(".m4v") ||
    pathname.endsWith(".pdf")
  ) {
    return null
  }
  return trimmed
}

function isPdfAssetUrl(url: string): boolean {
  const pathname = url.trim().split(/[?#]/)[0]?.toLowerCase() || ""
  return pathname.endsWith(".pdf")
}

function renderFormattedCaptionText(text: string, isDark = false) {
  if (!text) {
    return (
      <span
        className={cn(
          "italic",
          isDark ? "text-sidebar-foreground/70" : "text-muted-foreground"
        )}
      >
        Start typing your Umrah campaign caption…
      </span>
    )
  }

  const tokens = text.split(/(#[\p{L}\p{N}_]+|ART-[A-Z0-9-]+|https?:\/\/[^\s]+)/gu)
  return tokens.map((token, idx) => {
    if (/^#[\p{L}\p{N}_]+$/u.test(token)) {
      return (
        <span
          key={idx}
          className={cn(
            "font-semibold",
            isDark ? "text-gold" : "text-primary underline decoration-gold/60"
          )}
        >
          {token}
        </span>
      )
    }
    if (/^ART-[A-Z0-9-]+$/i.test(token)) {
      return (
        <span
          key={idx}
          className={cn(
            "rounded px-1 py-0.5 font-mono text-[10px] font-bold",
            isDark
              ? "bg-gold text-gold-foreground"
              : "border border-gold-border bg-accent text-primary"
          )}
        >
          {token}
        </span>
      )
    }
    if (/^https?:\/\//i.test(token)) {
      return (
        <span
          key={idx}
          className={cn(
            "break-all font-mono text-[10px] underline",
            isDark ? "text-gold" : "text-status-success"
          )}
        >
          {token}
        </span>
      )
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>
  })
}

// ==========================================
// 2. MAIN INTERACTIVE DEVICE PREVIEWER
// ==========================================

export function SocialPlatformPreview({
  caption,
  title,
  postType,
  postFormat,
  onPostTypeChange,
  publishMode = "SINGLE",
  mediaUrls = [],
  spotlightMediaUrl,
  sheetMediaUrl,
  postCode,
  packageTitle,
  sharingPricePkr,
  quadPricePkr,
  triplePricePkr,
  doublePricePkr,
  makkahHotelName,
  madinahHotelName,
  autoFirstComment = false,
  firstComment,
  whatsappNumber = "923274029701",
  selectedProviders = ["instagram", "facebook", "tiktok", "youtube", "gmb"],
  connectedAccounts = [],
  officeLocationLabel = "Askari 10, Lahore Cantt",
  defaultProvider = "instagram",
  className,
}: SocialPlatformPreviewProps) {
  const [activeProvider, setActiveProvider] =
    React.useState<SocialProviderId>(defaultProvider)
  const [internalFormat, setInternalFormat] = React.useState<SocialPostFormat>(
    postFormat || postType || "FEED"
  )
  const [activeFrameIdx, setActiveFrameIdx] = React.useState(0)
  const [isCaptionExpanded, setIsCaptionExpanded] = React.useState(false)
  const [gmbCtaType, setGmbCtaType] = React.useState<"BOOK" | "LEARN_MORE">("BOOK")

  const effectiveFormat: SocialPostFormat =
    postFormat || postType || internalFormat

  const handleFormatSelect = (fmt: SocialPostFormat) => {
    setInternalFormat(fmt)
    onPostTypeChange?.(fmt)
  }

  // Compute snapshots across all 5 platforms for live warning indicators
  const allSnapshots = React.useMemo(() => {
    const map = {} as Record<SocialProviderId, Core5PreviewSnapshot>
    for (const tab of PLATFORM_TABS) {
      map[tab.id] = formatCore5Preview({
        provider: tab.id,
        caption,
        title,
        postType: effectiveFormat,
        postFormat: effectiveFormat,
        publishMode,
        mediaUrls,
        spotlightMediaUrl,
        sheetMediaUrl,
        postCode,
        packageTitle,
        sharingPricePkr,
        quadPricePkr,
        triplePricePkr,
        doublePricePkr,
        makkahHotelName,
        madinahHotelName,
        autoFirstComment,
        firstComment,
        whatsappNumber,
        ctaType: gmbCtaType,
      })
    }
    return map
  }, [
    caption,
    title,
    effectiveFormat,
    publishMode,
    mediaUrls,
    spotlightMediaUrl,
    sheetMediaUrl,
    postCode,
    packageTitle,
    sharingPricePkr,
    quadPricePkr,
    triplePricePkr,
    doublePricePkr,
    makkahHotelName,
    madinahHotelName,
    autoFirstComment,
    firstComment,
    whatsappNumber,
    gmbCtaType,
  ])

  const snapshot = allSnapshots[activeProvider]

  const safeActiveFrameIdx =
    snapshot.mediaFrames.length > 0
      ? Math.min(activeFrameIdx, snapshot.mediaFrames.length - 1)
      : 0

  const currentFrame = snapshot.mediaFrames[safeActiveFrameIdx] || {
    index: 0,
    label: "Frame 1: Spotlight Hook",
    url: "",
    stage: "spotlight" as const,
    isVideo: false,
  }

  const currentFrameImageUrl = getRenderableImagePreviewUrl(currentFrame.url)

  const isTwoStepMode =
    publishMode === "SPOTLIGHT_THEN_SHEET" ||
    publishMode === "step_1_spotlight_hook"

  const connectedAccount = React.useMemo(
    () => connectedAccounts.find((a) => a.provider === activeProvider),
    [connectedAccounts, activeProvider]
  )

  const accountName = connectedAccount?.name || "Al Ramlah Travels"
  const accountHandle =
    connectedAccount?.handle?.replace(/^@/, "") || "alramlahtravels"

  const displayedCaption =
    isCaptionExpanded || !snapshot.isTruncatedAtFold
      ? caption
      : snapshot.foldPreviewText

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-secondary/40",
        className
      )}
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/30 bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <Smartphone className="size-4 text-gold" aria-hidden="true" />
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-bold">
              <span>Live Core 5 Device Post Previewer</span>
              <Badge className="bg-gold px-1.5 py-0 font-mono text-[10px] text-gold-foreground tabular-nums">
                {snapshot.aspectRatio}
              </Badge>
            </h3>
            <p className="text-[11px] text-primary-foreground/80">
              Real-time mobile frame, fold truncation &amp; pinned ART code
              First-Comment simulation
            </p>
          </div>
        </div>

        {/* Character Counter Badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold",
            snapshot.isOverLimit
              ? "border-status-danger-border bg-status-danger-bg text-status-danger"
              : snapshot.isNearCaptionLimit
                ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                : "border-gold/40 bg-sidebar-accent text-sidebar-foreground"
          )}
        >
          <span>
            <span className="font-mono tabular-nums">
              {snapshot.charCount.toLocaleString()} /{" "}
              {CORE5_CHARACTER_LIMITS[activeProvider].toLocaleString()}
            </span>{" "}
            chars
          </span>
          {snapshot.isOverLimit && (
            <AlertTriangle
              className="size-3 text-status-danger"
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {/* Interactive 5-Platform Tab Bar */}
      <div className="flex flex-col gap-2 border-b border-border bg-secondary/60 p-2">
        <div className="grid grid-cols-5 gap-1">
          {PLATFORM_TABS.map((tab) => {
            const isActive = activeProvider === tab.id
            const isTargeted = selectedProviders.includes(tab.id)
            const tabSnap = allSnapshots[tab.id]
            const hasWarning = tabSnap.warnings.length > 0

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveProvider(tab.id)
                  setIsCaptionExpanded(false)
                }}
                className={cn(
                  "relative flex cursor-pointer select-none flex-col items-center justify-center rounded-lg border px-1.5 py-1.5 text-center transition-colors active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                  isActive
                    ? cn(
                        tab.activeBorderClass,
                        "font-bold ring-1 ring-primary/30 shadow-2xs"
                      )
                    : "border-border bg-background/90 text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "rounded border px-1 py-0.5 font-mono text-[10px] font-bold",
                      tab.badgeClass
                    )}
                  >
                    {tab.shortLabel}
                  </span>
                  {isTargeted && (
                    <span
                      className="size-1.5 rounded-full bg-status-success"
                      title="Selected in composer target channels"
                    />
                  )}
                  {hasWarning && (
                    <span
                      className="size-1.5 rounded-full bg-status-warning"
                      title={tabSnap.warnings[0]}
                    />
                  )}
                </div>
                <span className="mt-0.5 hidden max-w-full truncate text-[10px] sm:inline">
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Format Pill Selector (Feed 4:5, Reel 9:16, Story 9:16) & 2-Step Frame Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1">
            {FORMAT_PILLS.map((pill) => {
              const Icon = pill.icon
              const active = effectiveFormat === pill.id
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => handleFormatSelect(pill.id)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-colors active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                    active
                      ? "border-primary bg-primary text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                      : "border-border bg-background text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  )}
                >
                  <Icon className="size-3" aria-hidden="true" />
                  <span>{pill.label}</span>
                  <span className="font-mono text-[10px] opacity-80 tabular-nums">
                    ({pill.ratio})
                  </span>
                </button>
              )
            })}
          </div>

          {/* 2-Step Frame Switcher (Frame 1: Spotlight vs Frame 2: Rate Sheet) */}
          {(isTwoStepMode || snapshot.mediaFrames.length > 1) && (
            <div className="flex items-center gap-1 rounded-md border border-gold-border bg-background p-0.5">
              {isTwoStepMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveFrameIdx(0)}
                    className={cn(
                      "cursor-pointer rounded px-2 py-0.5 text-[10px] font-bold transition-colors active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                      safeActiveFrameIdx === 0
                        ? "bg-gold text-gold-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Frame 1: Spotlight
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFrameIdx(1)}
                    className={cn(
                      "cursor-pointer rounded px-2 py-0.5 text-[10px] font-bold transition-colors active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                      safeActiveFrameIdx === 1
                        ? "bg-gold text-gold-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Frame 2: Rate Sheet
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1 px-1.5 py-0.5 text-[10px]">
                  <button
                    type="button"
                    aria-label="Previous frame"
                    onClick={() =>
                      setActiveFrameIdx((prev) =>
                        prev > 0 ? prev - 1 : snapshot.mediaFrames.length - 1
                      )
                    }
                    className="cursor-pointer rounded hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                  </button>
                  <span>
                    Slide{" "}
                    <span className="font-mono tabular-nums">
                      {safeActiveFrameIdx + 1}/{snapshot.mediaFrames.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="Next frame"
                    onClick={() =>
                      setActiveFrameIdx((prev) =>
                        prev + 1 < snapshot.mediaFrames.length ? prev + 1 : 0
                      )
                    }
                    className="cursor-pointer rounded hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Warnings Banner */}
      {snapshot.warnings.length > 0 && (
        <div className="flex flex-col gap-1 border-b border-status-warning-border bg-status-warning-bg px-3.5 py-2">
          {snapshot.warnings.map((warn, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-[11px] font-medium text-status-warning"
            >
              <AlertTriangle
                className="mt-0.5 size-3.5 shrink-0 text-status-warning"
                aria-hidden="true"
              />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Device Frame Container */}
      <div className="flex flex-col items-center justify-center bg-secondary/30 p-4">
        <div className="w-full max-w-[340px] overflow-hidden rounded-[28px] border-[6px] border-sidebar bg-card shadow-md">
          {/* Mobile Status Bar */}
          <div
            className={cn(
              "flex items-center justify-between px-4 py-1.5 text-[10px] font-semibold",
              snapshot.layoutMode === "vertical_reel" ||
                snapshot.layoutMode === "ephemeral_story"
                ? "bg-sidebar text-sidebar-foreground"
                : "border-b border-border text-foreground"
            )}
          >
            <span className="font-mono tabular-nums">9:41</span>
            <div className="h-2.5 w-14 rounded-full bg-muted-foreground/30" />
            <span className="flex items-center gap-1 font-mono text-[10px] tabular-nums">
              <span>5G</span>
              <span>100%</span>
            </span>
          </div>

          {/* 1. INSTAGRAM MOCKUP */}
          {activeProvider === "instagram" &&
            snapshot.layoutMode === "feed_card" && (
              <div className="text-xs text-foreground">
                {/* IG Header */}
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full border border-gold bg-gold-gradient p-0.5">
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-primary text-[10px] font-bold text-gold">
                        AR
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[11px] font-bold">
                        <span>{accountHandle}</span>
                        <CheckCircle2
                          className="size-3 fill-status-info/20 text-status-info"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {officeLocationLabel}
                      </p>
                    </div>
                  </div>
                  <MoreHorizontal
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>

                {/* 4:5 Media Frame */}
                <MediaViewport
                  frameUrl={currentFrame.url}
                  frameLabel={currentFrame.label}
                  isVideo={currentFrame.isVideo}
                  aspectRatio="4:5"
                  totalFrames={snapshot.mediaFrames.length}
                  activeFrameIdx={safeActiveFrameIdx}
                  onSelectFrame={setActiveFrameIdx}
                />

                {/* IG Action Bar */}
                <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                  <div className="flex items-center gap-3">
                    <Heart
                      className="size-4 fill-status-danger text-status-danger"
                      aria-hidden="true"
                    />
                    <MessageCircle
                      className="size-4 text-foreground"
                      aria-hidden="true"
                    />
                    <Send
                      className="size-4 text-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  {snapshot.mediaFrames.length > 1 && (
                    <div className="flex items-center gap-1">
                      {snapshot.mediaFrames.map((f, idx) => (
                        <span
                          key={f.index}
                          className={cn(
                            "size-1.5 rounded-full transition-transform motion-reduce:transition-none motion-reduce:transform-none",
                            idx === safeActiveFrameIdx
                              ? "scale-110 bg-status-info"
                              : "bg-border"
                          )}
                        />
                      ))}
                    </div>
                  )}
                  <Bookmark
                    className="size-4 text-foreground"
                    aria-hidden="true"
                  />
                </div>

                {/* IG Likes & Caption with Fold Toggle */}
                <div className="flex flex-col gap-1.5 px-3 pb-3 text-[11px]">
                  <p className="text-[11px] font-bold">
                    Liked by lahore_pilgrims and others
                  </p>
                  <div className="leading-snug break-words whitespace-pre-line">
                    <span className="mr-1.5 font-bold">{accountHandle}</span>
                    {renderFormattedCaptionText(displayedCaption)}
                    {snapshot.isTruncatedAtFold && (
                      <button
                        type="button"
                        onClick={() => setIsCaptionExpanded((v) => !v)}
                        className="ml-1 cursor-pointer rounded font-semibold text-muted-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {isCaptionExpanded ? "less" : "more"}
                      </button>
                    )}
                  </div>

                  {/* Pinned First Comment (`ART-...`) */}
                  {snapshot.pinnedFirstComment && (
                    <PinnedFirstCommentCard
                      handle={accountHandle}
                      commentText={snapshot.pinnedFirstComment}
                    />
                  )}
                </div>
              </div>
            )}

          {/* 2. FACEBOOK PAGE MOCKUP */}
          {activeProvider === "facebook" &&
            snapshot.layoutMode === "feed_card" && (
              <div className="text-xs text-foreground">
                {/* FB Page Header */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full border border-gold bg-primary text-xs font-bold text-gold">
                      AR
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[11px] font-bold">
                        <span>{accountName}</span>
                        <CheckCircle2
                          className="size-3 fill-status-info/20 text-status-info"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>Just now,</span>
                        <span>{officeLocationLabel}</span>
                        <Globe className="size-2.5" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                  <MoreHorizontal
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>

                {/* FB Caption Above Media with `...See more` fold */}
                <div className="px-3 pb-2 text-[11px] leading-snug break-words whitespace-pre-line">
                  {renderFormattedCaptionText(displayedCaption)}
                  {snapshot.isTruncatedAtFold && (
                    <button
                      type="button"
                      onClick={() => setIsCaptionExpanded((v) => !v)}
                      className="ml-1 cursor-pointer rounded font-semibold text-status-info hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {isCaptionExpanded ? "See less" : "See more"}
                    </button>
                  )}
                </div>

                {/* 4:5 Media Frame */}
                <MediaViewport
                  frameUrl={currentFrame.url}
                  frameLabel={currentFrame.label}
                  isVideo={currentFrame.isVideo}
                  aspectRatio="4:5"
                  totalFrames={snapshot.mediaFrames.length}
                  activeFrameIdx={safeActiveFrameIdx}
                  onSelectFrame={setActiveFrameIdx}
                />

                {/* FB Like / Comment / Share Footer */}
                <div className="flex items-center justify-around border-y border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ThumbsUp
                      className="size-3.5 text-status-info"
                      aria-hidden="true"
                    />{" "}
                    Like
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3.5" aria-hidden="true" />{" "}
                    Comment
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 className="size-3.5" aria-hidden="true" /> Share
                  </span>
                </div>

                {/* FB Pinned First Comment (`ART-...`) */}
                {snapshot.pinnedFirstComment && (
                  <div className="bg-secondary/50 p-2.5">
                    <PinnedFirstCommentCard
                      handle={accountName}
                      commentText={snapshot.pinnedFirstComment}
                    />
                  </div>
                )}
              </div>
            )}

          {/* 3. VERTICAL REEL / TIKTOK / YOUTUBE SHORTS MOCKUP (9:16) */}
          {snapshot.layoutMode === "vertical_reel" && (
            <div className="relative flex aspect-[9/16] w-full flex-col justify-between overflow-hidden bg-sidebar text-sidebar-foreground">
              {/* Background Poster / Video */}
              {currentFrameImageUrl ? (
                <Image
                  src={currentFrameImageUrl}
                  alt={currentFrame.label}
                  fill
                  unoptimized
                  sizes="340px"
                  className="object-cover opacity-85"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-primary via-sidebar-accent to-sidebar p-6 text-center">
                  <div className="flex flex-col gap-1">
                    {currentFrame.url && isPdfAssetUrl(currentFrame.url) ? (
                      <FileText
                        className="mx-auto size-8 text-gold"
                        aria-hidden="true"
                      />
                    ) : (
                      <Film
                        className="mx-auto size-8 text-gold"
                        aria-hidden="true"
                      />
                    )}
                    <p className="text-xs font-bold text-gold">
                      {currentFrame.url?.trim()
                        ? "9:16 Video / Media Frame Ready"
                        : "9:16 Vertical Video / Reel Frame"}
                    </p>
                  </div>
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-sidebar/95 via-sidebar/25 to-sidebar/45" />

              {/* Top Overlay Header */}
              <div className="relative z-10 flex items-center justify-between p-3 text-[11px] font-bold">
                <span className="drop-shadow">
                  {activeProvider === "tiktok"
                    ? "Following | For You"
                    : activeProvider === "youtube"
                      ? "Shorts"
                      : `${snapshot.label} Reels`}
                </span>
                <Badge className="border border-gold/40 bg-sidebar/80 font-mono text-[10px] text-gold">
                  {currentFrame.label}
                </Badge>
              </div>

              {/* Right-Rail Action Icons + Bottom Caption & Audio Overlay */}
              <div className="relative z-10 flex items-end justify-between gap-2 p-3">
                {/* Bottom-Left Handle, Title, Caption & Sound Marquee */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex size-6 items-center justify-center rounded-full border border-gold bg-primary text-[9px] font-bold text-gold">
                      AR
                    </div>
                    <span className="font-bold">
                      {activeProvider === "youtube"
                        ? "@AlRamlahTravels"
                        : `@${accountHandle}`}
                    </span>
                    <span className="rounded-full bg-status-danger px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {activeProvider === "youtube" ? "Subscribe" : "Follow"}
                    </span>
                  </div>

                  {activeProvider === "youtube" && (
                    <p className="line-clamp-2 text-xs font-bold text-sidebar-foreground">
                      {snapshot.titleText}
                    </p>
                  )}

                  <div className="line-clamp-3 text-[10px] leading-snug whitespace-pre-line text-sidebar-foreground/90">
                    {renderFormattedCaptionText(displayedCaption, true)}
                  </div>

                  {/* Pinned Comment Badge for YouTube Shorts / IG / FB Reels */}
                  {snapshot.pinnedFirstComment && (
                    <div className="flex flex-col gap-0.5 rounded-lg border border-gold/50 bg-sidebar/85 p-2 text-[10px]">
                      <div className="flex items-center gap-1 font-bold text-gold">
                        <Pin className="size-2.5" aria-hidden="true" />
                        <span>
                          Pinned Comment:{" "}
                          <span className="font-mono">
                            {postCode || "ART-UMRAH"}
                          </span>
                        </span>
                      </div>
                      <p className="line-clamp-2 font-mono text-[10px] text-sidebar-foreground/90">
                        {snapshot.pinnedFirstComment}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-sidebar-foreground/85">
                    <Music className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      Original Audio: Al Ramlah Travels Lahore, Makkah &amp;
                      Madinah
                    </span>
                  </div>
                </div>

                {/* Right-Rail Vertical Icons */}
                <div className="flex shrink-0 flex-col items-center gap-3 pb-1 text-[10px]">
                  <div className="flex flex-col items-center">
                    <Heart
                      className="size-5 fill-status-danger text-status-danger"
                      aria-hidden="true"
                    />
                    <span className="font-mono tabular-nums">1.4K</span>
                  </div>
                  {activeProvider === "youtube" && (
                    <div className="flex flex-col items-center">
                      <ThumbsDown
                        className="size-4 text-sidebar-foreground"
                        aria-hidden="true"
                      />
                      <span>Dislike</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <MessageCircle
                      className="size-5 text-sidebar-foreground"
                      aria-hidden="true"
                    />
                    <span className="font-mono tabular-nums">84</span>
                  </div>
                  {activeProvider === "tiktok" && (
                    <div className="flex flex-col items-center">
                      <Bookmark
                        className="size-5 fill-gold text-gold"
                        aria-hidden="true"
                      />
                      <span className="font-mono tabular-nums">312</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <Share2
                      className="size-5 text-sidebar-foreground"
                      aria-hidden="true"
                    />
                    <span>Share</span>
                  </div>
                  <div className="flex size-7 items-center justify-center rounded-full border-2 border-gold bg-sidebar-accent">
                    <Disc
                      className="size-4 animate-spin text-gold motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. 24-HOUR STORY MOCKUP (9:16) */}
          {snapshot.layoutMode === "ephemeral_story" && (
            <div className="relative flex aspect-[9/16] w-full flex-col justify-between overflow-hidden bg-sidebar text-sidebar-foreground">
              {currentFrameImageUrl ? (
                <Image
                  src={currentFrameImageUrl}
                  alt={currentFrame.label}
                  fill
                  unoptimized
                  sizes="340px"
                  className="object-cover"
                />
              ) : currentFrame.url.trim() ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-primary via-sidebar-accent to-sidebar p-6 text-center">
                  <div className="flex flex-col gap-1">
                    {isPdfAssetUrl(currentFrame.url) ? (
                      <FileText
                        className="mx-auto size-8 text-gold"
                        aria-hidden="true"
                      />
                    ) : (
                      <Film
                        className="mx-auto size-8 text-gold"
                        aria-hidden="true"
                      />
                    )}
                    <p className="text-xs font-bold text-gold">
                      Story Media Preview
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sidebar/70 via-transparent to-sidebar/85" />

              {/* Story Segmented Progress Bars & Header */}
              <div className="relative z-10 flex flex-col gap-2 p-3">
                <div className="flex items-center gap-1">
                  {(snapshot.mediaFrames.length > 0
                    ? snapshot.mediaFrames
                    : [{ index: 0 }]
                  ).map((f, idx) => (
                    <div
                      key={f.index}
                      className="h-1 flex-1 overflow-hidden rounded-full bg-sidebar-foreground/30"
                    >
                      <div
                        className={cn(
                          "h-full bg-sidebar-foreground",
                          idx <= safeActiveFrameIdx ? "w-full" : "w-0"
                        )}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-full border border-gold bg-primary text-[9px] font-bold text-gold">
                      AR
                    </div>
                    <span className="font-bold">{accountHandle}</span>
                    <span className="text-[10px] text-sidebar-foreground/75 tabular-nums">
                      2h
                    </span>
                  </div>
                  <Badge className="bg-gold text-[10px] font-bold text-gold-foreground">
                    24h Story
                  </Badge>
                </div>
              </div>

              {/* Story Bottom Send Message Pill */}
              <div className="relative z-10 flex flex-col gap-2 p-3">
                {caption && (
                  <div className="line-clamp-3 rounded-xl bg-sidebar/85 p-2.5 text-center text-[10px] text-sidebar-foreground">
                    {caption}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-full border border-sidebar-foreground/40 bg-sidebar/60 px-3 py-1.5 text-[10px] text-sidebar-foreground/85">
                    Send message to {accountHandle}…
                  </div>
                  <Heart
                    className="size-5 text-sidebar-foreground"
                    aria-hidden="true"
                  />
                  <Send
                    className="size-5 text-sidebar-foreground"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. GOOGLE BUSINESS PROFILE (GMB) LOCAL UPDATE CARD */}
          {activeProvider === "gmb" &&
            snapshot.layoutMode === "gmb_local_card" && (
              <div className="flex flex-col gap-2.5 p-3 text-xs text-foreground">
                {/* Google Search Local Header */}
                <div className="flex items-start justify-between gap-2 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-gold">
                      G
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[11px] font-bold">
                        <span>From Al Ramlah Travels, Lahore</span>
                        <ShieldCheck
                          className="size-3.5 text-status-success"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin
                          className="size-2.5 text-status-success"
                          aria-hidden="true"
                        />
                        <span>
                          {snapshot.gmbCallToAction?.verifiedBadgeLabel ||
                            `Verified (${officeLocationLabel})`}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-status-success-border bg-status-success-bg text-[10px] text-status-success"
                  >
                    Local Update
                  </Badge>
                </div>

                {/* 4:5 Local Update Image */}
                <MediaViewport
                  frameUrl={currentFrame.url}
                  frameLabel={currentFrame.label}
                  isVideo={currentFrame.isVideo}
                  aspectRatio="4:5"
                  totalFrames={snapshot.mediaFrames.length}
                  activeFrameIdx={safeActiveFrameIdx}
                  onSelectFrame={setActiveFrameIdx}
                />

                {/* GMB Summary Text */}
                <div className="text-[11px] leading-snug break-words whitespace-pre-line text-foreground">
                  {renderFormattedCaptionText(displayedCaption)}
                  {snapshot.isTruncatedAtFold && (
                    <button
                      type="button"
                      onClick={() => setIsCaptionExpanded((v) => !v)}
                      className="ml-1 cursor-pointer rounded font-semibold text-status-success hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {isCaptionExpanded ? "Less" : "More"}
                    </button>
                  )}
                </div>

                {/* GMB CTA Selector & WhatsApp Action Button */}
                {snapshot.gmbCallToAction && (
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Google Business CTA Button:</span>
                      <div className="flex items-center gap-1">
                        {(["BOOK", "LEARN_MORE"] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setGmbCtaType(type)}
                            className={cn(
                              "cursor-pointer rounded border px-1.5 py-0.5 text-[10px] font-bold transition-colors active:opacity-90 motion-reduce:transition-none",
                              gmbCtaType === type
                                ? "border-primary bg-primary text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                                : "border-border bg-secondary text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            )}
                          >
                            {type === "BOOK" ? "Book" : "Learn More"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <a
                      href={snapshot.gmbCallToAction.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gold/50 bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                    >
                      <span>{snapshot.gmbCallToAction.label}</span>
                      <ExternalLink
                        className="size-3 text-gold"
                        aria-hidden="true"
                      />
                    </a>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Bottom Diagnostics Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-secondary/60 px-4 py-2.5 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Hashtags:{" "}
            <strong className="font-mono text-foreground tabular-nums">
              {snapshot.hashtagCount}
            </strong>
            {activeProvider === "instagram" ? " / 30" : ""}
          </span>
          <span className="border-l border-border pl-3">
            Fold Limit:{" "}
            <strong className="text-foreground">
              <span className="font-mono tabular-nums">
                {snapshot.foldLimit}
              </span>{" "}
              chars
            </strong>
          </span>
          <span className="border-l border-border pl-3">
            First Comment:{" "}
            <strong className="text-foreground">
              {snapshot.pinnedFirstComment
                ? "Active (Pinned)"
                : snapshot.firstCommentPreview.unsupportedReason
                  ? "N/A on Platform"
                  : "None"}
            </strong>
          </span>
        </div>
        {postCode && (
          <Badge
            variant="outline"
            className="border-gold-border text-[10px] text-primary"
          >
            Ref: <span className="font-mono tabular-nums">{postCode}</span>
          </Badge>
        )}
      </div>
    </div>
  )
}

// ==========================================
// 3. SUB-COMPONENTS (VIEWPORT & FIRST COMMENT)
// ==========================================

function MediaViewport({
  frameUrl,
  frameLabel,
  isVideo,
  aspectRatio,
  totalFrames,
  activeFrameIdx,
  onSelectFrame,
}: {
  frameUrl: string
  frameLabel: string
  isVideo: boolean
  aspectRatio: "4:5" | "9:16"
  totalFrames: number
  activeFrameIdx: number
  onSelectFrame: (idx: number) => void
}) {
  const previewImageUrl = getRenderableImagePreviewUrl(frameUrl)
  const isPdf = Boolean(frameUrl && isPdfAssetUrl(frameUrl))

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-secondary",
        aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-[4/5]"
      )}
    >
      {previewImageUrl ? (
        <Image
          src={previewImageUrl}
          alt={frameLabel}
          fill
          unoptimized
          sizes="340px"
          className="object-cover"
        />
      ) : frameUrl.trim().length > 0 ? (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-accent/60 p-6 text-center">
          {isPdf ? (
            <FileText
              className="mb-1.5 size-7 text-gold-text"
              aria-hidden="true"
            />
          ) : (
            <Film
              className="mb-1.5 size-7 text-gold-text"
              aria-hidden="true"
            />
          )}
          <p className="text-xs font-bold text-primary">
            {isPdf ? "Vector PDF Asset Ready" : "Video Reel Asset Ready"}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {frameLabel}
          </p>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-accent/60 p-6 text-center">
          <Sparkles
            className="mb-1.5 size-7 text-gold-text"
            aria-hidden="true"
          />
          <p className="text-xs font-bold text-primary">
            Al Ramlah 4K Poster Preview
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {frameLabel}
          </p>
        </div>
      )}

      {/* Top-Right Frame / Carousel Badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {isVideo && (
          <span className="flex items-center gap-1 rounded-full bg-sidebar/85 px-2 py-0.5 text-[10px] font-bold text-sidebar-foreground">
            <Play
              className="size-2.5 fill-sidebar-foreground"
              aria-hidden="true"
            />{" "}
            Video
          </span>
        )}
        <span className="rounded-full border border-gold/40 bg-sidebar/85 px-2 py-0.5 font-mono text-[10px] font-bold text-gold">
          {frameLabel}
        </span>
      </div>

      {/* Carousel Left/Right Controls when multiple frames exist */}
      {totalFrames > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous frame"
            onClick={() =>
              onSelectFrame(
                activeFrameIdx > 0 ? activeFrameIdx - 1 : totalFrames - 1
              )
            }
            className="absolute top-1/2 left-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-sidebar/80 text-sidebar-foreground hover:bg-sidebar focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            title="Previous Frame"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next frame"
            onClick={() =>
              onSelectFrame(
                activeFrameIdx + 1 < totalFrames ? activeFrameIdx + 1 : 0
              )
            }
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-sidebar/80 text-sidebar-foreground hover:bg-sidebar focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            title="Next Frame"
          >
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
}

function PinnedFirstCommentCard({
  handle,
  commentText,
}: {
  handle: string
  commentText: string
}) {
  return (
    <div className="mt-2 flex flex-col gap-1 rounded-lg bg-accent/60 p-2">
      <div className="flex items-center justify-between text-[10px] font-bold text-primary">
        <span className="flex items-center gap-1">
          <Pin className="size-2.5 text-gold-text" aria-hidden="true" />
          <span>Pinned First Comment (Auto-Plug)</span>
        </span>
        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          Zero Link Penalty
        </span>
      </div>
      <div className="font-mono text-[10px] leading-snug break-words whitespace-pre-line text-foreground">
        <span className="mr-1 font-bold text-primary">{handle}</span>
        {renderFormattedCaptionText(commentText)}
      </div>
    </div>
  )
}
