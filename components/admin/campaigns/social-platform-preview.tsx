"use client"

import * as React from "react"
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Disc,
  ExternalLink,
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
    badgeClass: "bg-pink-100 text-pink-800 border-pink-300",
    activeBorderClass: "border-pink-500 bg-pink-50/70 text-pink-950",
  },
  {
    id: "facebook",
    label: "Facebook",
    shortLabel: "FB",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    activeBorderClass: "border-blue-600 bg-blue-50/70 text-blue-950",
  },
  {
    id: "tiktok",
    label: "TikTok",
    shortLabel: "TT",
    badgeClass: "bg-slate-200 text-slate-900 border-slate-400",
    activeBorderClass: "border-slate-800 bg-slate-100 text-slate-950",
  },
  {
    id: "youtube",
    label: "YouTube Shorts",
    shortLabel: "YT",
    badgeClass: "bg-red-100 text-red-800 border-red-300",
    activeBorderClass: "border-red-600 bg-red-50/70 text-red-950",
  },
  {
    id: "gmb",
    label: "Google Business",
    shortLabel: "GMB",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    activeBorderClass: "border-emerald-700 bg-emerald-50/70 text-emerald-950",
  },
]

const FORMAT_PILLS: Array<{
  id: SocialPostFormat
  label: string
  ratio: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "FEED", label: "FEED", ratio: CORE5_ASPECT_RATIOS.FEED, icon: ImageIcon },
  { id: "REEL", label: "REEL", ratio: CORE5_ASPECT_RATIOS.REEL, icon: Film },
  { id: "STORY", label: "STORY", ratio: CORE5_ASPECT_RATIOS.STORY, icon: Smartphone },
]

function renderFormattedCaptionText(text: string, isDark = false) {
  if (!text) {
    return (
      <span className={cn("italic", isDark ? "text-white/50" : "text-muted-foreground")}>
        Start typing your Umrah campaign caption...
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
            isDark ? "text-sky-300" : "text-[#0A3622] underline decoration-[#C5A059]/60"
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
            "rounded px-1 py-0.2 font-mono font-bold text-[10px]",
            isDark
              ? "bg-[#C5A059] text-slate-950"
              : "bg-[#C5A059]/20 text-[#0A3622] border border-[#C5A059]/50"
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
            "underline break-all font-mono text-[10px]",
            isDark ? "text-emerald-300" : "text-emerald-700"
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

  React.useEffect(() => {
    if (postFormat || postType) {
      setInternalFormat(postFormat || postType || "FEED")
    }
  }, [postFormat, postType])

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

  // Clamp frame index if mediaFrames change
  React.useEffect(() => {
    if (activeFrameIdx >= snapshot.mediaFrames.length) {
      setActiveFrameIdx(0)
    }
  }, [snapshot.mediaFrames.length, activeFrameIdx])

  const currentFrame = snapshot.mediaFrames[activeFrameIdx] || {
    index: 0,
    label: "Frame 1: Spotlight Hook",
    url: "",
    stage: "spotlight" as const,
    isVideo: false,
  }

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
        "rounded-2xl border border-[#C5A059]/40 bg-card shadow-xs overflow-hidden flex flex-col",
        className
      )}
    >
      {/* Top Header Bar */}
      <div className="bg-[#0A3622] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#C5A059]/30">
        <div className="flex items-center gap-2">
          <Smartphone className="size-4 text-[#C5A059]" />
          <div>
            <h3 className="text-xs font-bold tracking-wide uppercase flex items-center gap-1.5">
              <span>Live Core 5 Device Post Previewer</span>
              <Badge className="bg-[#C5A059] text-slate-950 text-[9px] font-mono px-1.5 py-0">
                {snapshot.aspectRatio}
              </Badge>
            </h3>
            <p className="text-[10px] text-emerald-100/80">
              Real-time mobile frame, fold truncation &amp; pinned ART-... First-Comment simulation
            </p>
          </div>
        </div>

        {/* Character Counter Badge */}
        <div
          className={cn(
            "rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold border flex items-center gap-1.5",
            snapshot.isOverLimit
              ? "bg-rose-950/90 text-rose-200 border-rose-400"
              : snapshot.isNearCaptionLimit
              ? "bg-amber-950/90 text-amber-200 border-amber-400"
              : "bg-emerald-950/70 text-emerald-100 border-[#C5A059]/40"
          )}
        >
          <span>
            {snapshot.charCount.toLocaleString()} /{" "}
            {CORE5_CHARACTER_LIMITS[activeProvider].toLocaleString()} chars
          </span>
          {snapshot.isOverLimit && <AlertTriangle className="size-3 text-rose-400" />}
        </div>
      </div>

      {/* Interactive 5-Platform Tab Bar */}
      <div className="border-b border-border bg-muted/40 p-2 flex flex-col gap-2">
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
                  "relative flex flex-col items-center justify-center rounded-lg border px-1.5 py-1.5 text-center transition-all cursor-pointer select-none",
                  isActive
                    ? tab.activeBorderClass + " ring-1 ring-[#0A3622]/30 font-bold shadow-2xs"
                    : "border-border bg-white/80 text-muted-foreground hover:bg-white hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "rounded px-1 py-0.2 font-mono text-[9px] font-bold border",
                      tab.badgeClass
                    )}
                  >
                    {tab.shortLabel}
                  </span>
                  {isTargeted && (
                    <span
                      className="size-1.5 rounded-full bg-emerald-600"
                      title="Selected in composer target channels"
                    />
                  )}
                  {hasWarning && (
                    <span
                      className="size-1.5 rounded-full bg-amber-500"
                      title={tabSnap.warnings[0]}
                    />
                  )}
                </div>
                <span className="text-[10px] truncate max-w-full mt-0.5 hidden sm:inline">
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Format Pill Selector (FEED 4:5, REEL 9:16, STORY 9:16) & 2-Step Frame Toggle */}
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
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold transition-all cursor-pointer",
                    active
                      ? "border-[#0A3622] bg-[#0A3622] text-white"
                      : "border-border bg-white text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3" />
                  <span>{pill.label}</span>
                  <span className="font-mono text-[9px] opacity-80">
                    ({pill.ratio})
                  </span>
                </button>
              )
            })}
          </div>

          {/* 2-Step Frame Switcher (Frame 1: Spotlight vs Frame 2: Rate Sheet) */}
          {(isTwoStepMode || snapshot.mediaFrames.length > 1) && (
            <div className="flex items-center gap-1 bg-white rounded-md border border-[#C5A059]/50 p-0.5">
              {isTwoStepMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveFrameIdx(0)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                      activeFrameIdx === 0
                        ? "bg-[#C5A059] text-slate-950"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Frame 1: Spotlight
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFrameIdx(1)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                      activeFrameIdx === 1
                        ? "bg-[#C5A059] text-slate-950"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Frame 2: Rate Sheet
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveFrameIdx((prev) =>
                        prev > 0 ? prev - 1 : snapshot.mediaFrames.length - 1
                      )
                    }
                    className="hover:text-primary cursor-pointer"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span>
                    Slide {activeFrameIdx + 1}/{snapshot.mediaFrames.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveFrameIdx((prev) =>
                        prev + 1 < snapshot.mediaFrames.length ? prev + 1 : 0
                      )
                    }
                    className="hover:text-primary cursor-pointer"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Warnings Banner */}
      {snapshot.warnings.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-300 px-3.5 py-2 space-y-1">
          {snapshot.warnings.map((warn, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-[11px] font-medium text-amber-900"
            >
              <AlertTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Device Frame Container */}
      <div className="p-4 bg-gradient-to-b from-secondary/30 to-secondary/10 flex flex-col items-center justify-center">
        <div className="w-full max-w-[340px] rounded-[28px] border-[6px] border-slate-900 bg-white shadow-xl overflow-hidden">
          {/* Mobile Status Bar */}
          <div
            className={cn(
              "px-4 py-1.5 flex items-center justify-between text-[10px] font-semibold",
              snapshot.layoutMode === "vertical_reel" ||
                snapshot.layoutMode === "ephemeral_story"
                ? "bg-slate-950 text-white"
                : "bg-white text-slate-900 border-b border-slate-100"
            )}
          >
            <span>9:41</span>
            <div className="h-2.5 w-14 rounded-full bg-slate-800/80" />
            <span className="font-mono text-[9px] uppercase">5G • 100%</span>
          </div>

          {/* 1. INSTAGRAM MOCKUP */}
          {activeProvider === "instagram" &&
            snapshot.layoutMode === "feed_card" && (
              <div className="bg-white text-slate-900 text-xs">
                {/* IG Header */}
                <div className="px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 p-0.5">
                      <div className="h-full w-full rounded-full bg-[#0A3622] text-[#C5A059] flex items-center justify-center font-bold text-[10px]">
                        AR
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 font-bold text-[11px]">
                        <span>{accountHandle}</span>
                        <CheckCircle2 className="size-3 text-sky-500 fill-sky-500/20" />
                      </div>
                      <p className="text-[9px] text-slate-500">
                        {officeLocationLabel}
                      </p>
                    </div>
                  </div>
                  <MoreHorizontal className="size-4 text-slate-500" />
                </div>

                {/* 4:5 Media Frame */}
                <MediaViewport
                  frameUrl={currentFrame.url}
                  frameLabel={currentFrame.label}
                  isVideo={currentFrame.isVideo}
                  aspectRatio="4:5"
                  totalFrames={snapshot.mediaFrames.length}
                  activeFrameIdx={activeFrameIdx}
                  onSelectFrame={setActiveFrameIdx}
                />

                {/* IG Action Bar */}
                <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Heart className="size-4 text-rose-500 fill-rose-500" />
                    <MessageCircle className="size-4 text-slate-800" />
                    <Send className="size-4 text-slate-800" />
                  </div>
                  {snapshot.mediaFrames.length > 1 && (
                    <div className="flex items-center gap-1">
                      {snapshot.mediaFrames.map((f, idx) => (
                        <span
                          key={f.index}
                          className={cn(
                            "size-1.5 rounded-full transition-all",
                            idx === activeFrameIdx ? "bg-sky-500 scale-110" : "bg-slate-300"
                          )}
                        />
                      ))}
                    </div>
                  )}
                  <Bookmark className="size-4 text-slate-800" />
                </div>

                {/* IG Likes & Caption with Fold Toggle */}
                <div className="px-3 pb-3 space-y-1.5 text-[11px]">
                  <p className="font-bold text-[11px]">Liked by lahore_pilgrims and others</p>
                  <div className="leading-snug whitespace-pre-line break-words">
                    <span className="font-bold mr-1.5">{accountHandle}</span>
                    {renderFormattedCaptionText(displayedCaption)}
                    {snapshot.isTruncatedAtFold && (
                      <button
                        type="button"
                        onClick={() => setIsCaptionExpanded((v) => !v)}
                        className="ml-1 text-slate-500 font-semibold hover:underline cursor-pointer"
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
              <div className="bg-white text-slate-900 text-xs">
                {/* FB Page Header */}
                <div className="px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full bg-[#0A3622] text-[#C5A059] flex items-center justify-center font-bold text-xs border border-[#C5A059]">
                      AR
                    </div>
                    <div>
                      <div className="flex items-center gap-1 font-bold text-[11px]">
                        <span>{accountName}</span>
                        <CheckCircle2 className="size-3 text-blue-600 fill-blue-600/20" />
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-slate-500">
                        <span>Just now</span>
                        <span>•</span>
                        <span>{officeLocationLabel}</span>
                        <span>•</span>
                        <Globe className="size-2.5" />
                      </div>
                    </div>
                  </div>
                  <MoreHorizontal className="size-4 text-slate-500" />
                </div>

                {/* FB Caption Above Media with `...See more` fold */}
                <div className="px-3 pb-2 text-[11px] leading-snug whitespace-pre-line break-words">
                  {renderFormattedCaptionText(displayedCaption)}
                  {snapshot.isTruncatedAtFold && (
                    <button
                      type="button"
                      onClick={() => setIsCaptionExpanded((v) => !v)}
                      className="ml-1 text-blue-600 font-semibold hover:underline cursor-pointer"
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
                  activeFrameIdx={activeFrameIdx}
                  onSelectFrame={setActiveFrameIdx}
                />

                {/* FB Like / Comment / Share Footer */}
                <div className="px-3 py-2 border-t border-b border-slate-100 flex items-center justify-around text-[11px] font-semibold text-slate-600">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="size-3.5 text-blue-600" /> Like
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3.5" /> Comment
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 className="size-3.5" /> Share
                  </span>
                </div>

                {/* FB Pinned First Comment (`ART-...`) */}
                {snapshot.pinnedFirstComment && (
                  <div className="p-2.5 bg-slate-50">
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
            <div className="relative bg-slate-950 text-white aspect-[9/16] w-full overflow-hidden flex flex-col justify-between">
              {/* Background Poster / Video */}
              {currentFrame.url ? (
                <img
                  src={currentFrame.url}
                  alt={currentFrame.label}
                  className="absolute inset-0 h-full w-full object-cover opacity-85"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-[#0A3622] via-slate-900 to-slate-950 flex items-center justify-center p-6 text-center">
                  <div className="space-y-1">
                    <Film className="size-8 text-[#C5A059] mx-auto" />
                    <p className="text-xs font-bold text-[#C5A059]">
                      9:16 Vertical Video / Reel Frame
                    </p>
                  </div>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/40 pointer-events-none" />

              {/* Top Overlay Header */}
              <div className="relative z-10 p-3 flex items-center justify-between text-[11px] font-bold">
                <span className="drop-shadow">
                  {activeProvider === "tiktok"
                    ? "Following  |  For You"
                    : activeProvider === "youtube"
                    ? "Shorts"
                    : `${snapshot.label} Reels`}
                </span>
                <Badge className="bg-black/60 text-[#C5A059] border border-[#C5A059]/40 text-[9px] font-mono">
                  {currentFrame.label}
                </Badge>
              </div>

              {/* Right-Rail Action Icons + Bottom Caption & Audio Overlay */}
              <div className="relative z-10 p-3 flex items-end justify-between gap-2">
                {/* Bottom-Left Handle, Title, Caption & Sound Marquee */}
                <div className="min-w-0 flex-1 space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="size-6 rounded-full bg-[#0A3622] border border-[#C5A059] text-[#C5A059] flex items-center justify-center text-[9px] font-bold">
                      AR
                    </div>
                    <span className="font-bold">
                      {activeProvider === "youtube"
                        ? "@AlRamlahTravels"
                        : `@${accountHandle}`}
                    </span>
                    <span className="rounded-full bg-red-600 text-white px-2 py-0.5 text-[9px] font-bold">
                      {activeProvider === "youtube" ? "Subscribe" : "Follow"}
                    </span>
                  </div>

                  {activeProvider === "youtube" && (
                    <p className="font-bold text-xs text-white line-clamp-2">
                      {snapshot.titleText}
                    </p>
                  )}

                  <div className="text-[10px] text-white/90 leading-snug line-clamp-3 whitespace-pre-line">
                    {renderFormattedCaptionText(displayedCaption, true)}
                  </div>

                  {/* Pinned Comment Badge for YouTube Shorts / IG / FB Reels */}
                  {snapshot.pinnedFirstComment && (
                    <div className="rounded-lg bg-black/75 border border-[#C5A059]/50 p-2 text-[10px] space-y-0.5">
                      <div className="flex items-center gap-1 text-[#C5A059] font-bold">
                        <Pin className="size-2.5" />
                        <span>Pinned Comment • {postCode || "ART-UMRAH"}</span>
                      </div>
                      <p className="text-white/90 line-clamp-2 font-mono text-[9px]">
                        {snapshot.pinnedFirstComment}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-200 pt-0.5">
                    <Music className="size-3 shrink-0" />
                    <span className="truncate">
                      Original Audio — Al Ramlah Travels Lahore • Makkah &amp; Madinah
                    </span>
                  </div>
                </div>

                {/* Right-Rail Vertical Icons */}
                <div className="flex flex-col items-center gap-3 text-[10px] shrink-0 pb-1">
                  <div className="flex flex-col items-center">
                    <Heart className="size-5 text-rose-500 fill-rose-500" />
                    <span>1.4K</span>
                  </div>
                  {activeProvider === "youtube" && (
                    <div className="flex flex-col items-center">
                      <ThumbsDown className="size-4 text-white" />
                      <span>Dislike</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <MessageCircle className="size-5 text-white" />
                    <span>84</span>
                  </div>
                  {activeProvider === "tiktok" && (
                    <div className="flex flex-col items-center">
                      <Bookmark className="size-5 text-amber-400 fill-amber-400" />
                      <span>312</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <Share2 className="size-5 text-white" />
                    <span>Share</span>
                  </div>
                  <div className="size-7 rounded-full bg-slate-900 border-2 border-[#C5A059] flex items-center justify-center">
                    <Disc className="size-4 text-[#C5A059] animate-spin" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. 24-HOUR STORY MOCKUP (9:16) */}
          {snapshot.layoutMode === "ephemeral_story" && (
            <div className="relative bg-slate-950 text-white aspect-[9/16] w-full overflow-hidden flex flex-col justify-between">
              {currentFrame.url ? (
                <img
                  src={currentFrame.url}
                  alt={currentFrame.label}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

              {/* Story Segmented Progress Bars & Header */}
              <div className="relative z-10 p-3 space-y-2">
                <div className="flex items-center gap-1">
                  {(snapshot.mediaFrames.length > 0
                    ? snapshot.mediaFrames
                    : [{ index: 0 }]
                  ).map((f, idx) => (
                    <div
                      key={f.index}
                      className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden"
                    >
                      <div
                        className={cn(
                          "h-full bg-white",
                          idx <= activeFrameIdx ? "w-full" : "w-0"
                        )}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-[#0A3622] border border-[#C5A059] text-[#C5A059] flex items-center justify-center font-bold text-[9px]">
                      AR
                    </div>
                    <span className="font-bold">{accountHandle}</span>
                    <span className="text-white/70 text-[10px]">2h</span>
                  </div>
                  <Badge className="bg-[#C5A059] text-slate-950 text-[9px] font-bold">
                    24h Story
                  </Badge>
                </div>
              </div>

              {/* Story Bottom Send Message Pill */}
              <div className="relative z-10 p-3 space-y-2">
                {caption && (
                  <div className="rounded-xl bg-black/65 backdrop-blur-xs p-2.5 text-[10px] text-center text-white line-clamp-3">
                    {caption}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-full border border-white/50 bg-black/40 px-3 py-1.5 text-[10px] text-white/80">
                    Send message to {accountHandle}...
                  </div>
                  <Heart className="size-5 text-white" />
                  <Send className="size-5 text-white" />
                </div>
              </div>
            </div>
          )}

          {/* 5. GOOGLE BUSINESS PROFILE (GMB) LOCAL UPDATE CARD */}
          {activeProvider === "gmb" &&
            snapshot.layoutMode === "gmb_local_card" && (
              <div className="bg-white text-slate-900 p-3 space-y-2.5 text-xs">
                {/* Google Search Local Header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-[#0A3622] text-[#C5A059] flex items-center justify-center font-bold text-xs">
                      G
                    </div>
                    <div>
                      <div className="flex items-center gap-1 font-bold text-[11px]">
                        <span>From Al Ramlah Travels · Lahore</span>
                        <ShieldCheck className="size-3.5 text-emerald-600" />
                      </div>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <MapPin className="size-2.5 text-emerald-700" />
                        <span>
                          {snapshot.gmbCallToAction?.verifiedBadgeLabel ||
                            `Verified • ${officeLocationLabel}`}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[9px] border-emerald-300 bg-emerald-50 text-emerald-800"
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
                  activeFrameIdx={activeFrameIdx}
                  onSelectFrame={setActiveFrameIdx}
                />

                {/* GMB Summary Text */}
                <div className="text-[11px] text-slate-800 leading-snug whitespace-pre-line break-words">
                  {renderFormattedCaptionText(displayedCaption)}
                  {snapshot.isTruncatedAtFold && (
                    <button
                      type="button"
                      onClick={() => setIsCaptionExpanded((v) => !v)}
                      className="ml-1 text-emerald-700 font-semibold hover:underline cursor-pointer"
                    >
                      {isCaptionExpanded ? "Less" : "More"}
                    </button>
                  )}
                </div>

                {/* GMB CTA Selector & WhatsApp Action Button */}
                {snapshot.gmbCallToAction && (
                  <div className="pt-1 space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Google Business CTA Button:</span>
                      <div className="flex items-center gap-1">
                        {(["BOOK", "LEARN_MORE"] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setGmbCtaType(type)}
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[9px] font-bold border cursor-pointer",
                              gmbCtaType === type
                                ? "bg-[#0A3622] text-white border-[#0A3622]"
                                : "bg-slate-100 text-slate-700 border-slate-200"
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
                      className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-[#0A3622] hover:bg-[#0A3622]/90 text-white font-bold text-xs py-2 px-3 shadow-xs border border-[#C5A059]/50 transition-all"
                    >
                      <span>{snapshot.gmbCallToAction.label}</span>
                      <ExternalLink className="size-3 text-[#C5A059]" />
                    </a>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Bottom Diagnostics Footer */}
      <div className="border-t border-border bg-secondary/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3 flex-wrap">
          <span>
            Hashtags: <strong className="text-foreground">{snapshot.hashtagCount}</strong>
            {activeProvider === "instagram" ? " / 30" : ""}
          </span>
          <span>•</span>
          <span>
            Fold Limit: <strong className="text-foreground">{snapshot.foldLimit} chars</strong>
          </span>
          <span>•</span>
          <span>
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
            className="text-[9px] font-mono border-[#C5A059]/60 text-[#0A3622]"
          >
            Ref: {postCode}
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
  return (
    <div
      className={cn(
        "relative w-full bg-slate-100 overflow-hidden",
        aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-[4/5]"
      )}
    >
      {frameUrl ? (
        <img
          src={frameUrl}
          alt={frameLabel}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#0A3622]/10 to-[#C5A059]/15">
          <Sparkles className="size-7 text-[#C5A059] mb-1.5" />
          <p className="text-xs font-bold text-[#0A3622]">
            Al Ramlah 4K Poster Preview
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {frameLabel}
          </p>
        </div>
      )}

      {/* Top-Right Frame / Carousel Badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {isVideo && (
          <span className="rounded-full bg-black/75 text-white px-2 py-0.5 text-[9px] font-bold flex items-center gap-1">
            <Play className="size-2.5 fill-white" /> Video
          </span>
        )}
        <span className="rounded-full bg-black/75 text-[#C5A059] border border-[#C5A059]/40 px-2 py-0.5 text-[9px] font-mono font-bold">
          {frameLabel}
        </span>
      </div>

      {/* Carousel Left/Right Controls when multiple frames exist */}
      {totalFrames > 1 && (
        <>
          <button
            type="button"
            onClick={() =>
              onSelectFrame(activeFrameIdx > 0 ? activeFrameIdx - 1 : totalFrames - 1)
            }
            className="absolute left-2 top-1/2 -translate-y-1/2 size-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 cursor-pointer"
            title="Previous Frame"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              onSelectFrame(activeFrameIdx + 1 < totalFrames ? activeFrameIdx + 1 : 0)
            }
            className="absolute right-2 top-1/2 -translate-y-1/2 size-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 cursor-pointer"
            title="Next Frame"
          >
            <ChevronRight className="size-3.5" />
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
    <div className="mt-2 rounded-lg border border-[#C5A059]/50 bg-[#C5A059]/10 p-2 space-y-1">
      <div className="flex items-center justify-between text-[9px] font-bold text-[#0A3622]">
        <span className="flex items-center gap-1">
          <Pin className="size-2.5 text-[#C5A059]" />
          <span>PINNED FIRST COMMENT • AUTO-PLUG</span>
        </span>
        <span className="font-mono text-[8px] uppercase bg-white/80 px-1.5 py-0.2 rounded border border-[#C5A059]/30">
          Zero Link Penalty
        </span>
      </div>
      <div className="text-[10px] leading-snug whitespace-pre-line break-words text-slate-800 font-mono">
        <span className="font-bold text-[#0A3622] mr-1">{handle}</span>
        {renderFormattedCaptionText(commentText)}
      </div>
    </div>
  )
}
