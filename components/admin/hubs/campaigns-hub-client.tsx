"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  ArrowRight,
  Calendar,
  Camera,
  Globe,
  MessageSquare,
  Send,
  Sparkles,
  Plus,
  Search,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Eye,
  RefreshCw,
  Layers,
  ShieldCheck,
  Smartphone,
  Users,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  X,
  BarChart3,
  Heart,
  MousePointerClick,
  Film,
  Image as ImageIcon,
  MapPin,
  Play,
  Share2,
  UploadCloud,
  Lock,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

import {
  createScheduledSocialPostAction,
  cancelScheduledPostAction,
  retryFailedPostTargetAction,
  generateArtFirstCommentAction,
  syncSocialPostAnalyticsAction,
  syncAllPublishedPostsAnalyticsAction,
  generateSocialCaptionsCopilotAction,
  getNextFreeSocialSlotAction,
  getTikTokCreatorInfoAction,
  type SafeSocialIntegration,
} from "@/app/actions/social-scheduler"
import type { SocialPostAnalyticsData } from "@/db/schema/social-scheduler"
import {
  aggregateCampaignAnalytics,
  computeEngagementRate,
  type PostTargetAnalyticsSnapshot,
} from "@/lib/social/analytics-aggregate"
import type {
  EngagementPlugConfig,
  PlatformCaptionsMap,
  SocialPostFormat,
  SocialProviderId,
  TikTokCreatorInfo,
  TikTokPrivacyLevel,
} from "@/lib/social/types"
import { buildArtFirstCommentPlug } from "@/lib/social/first-comment"
import { SocialPlatformPreview } from "@/components/admin/campaigns/social-platform-preview"
import { StudioMediaPickerModal } from "@/components/admin/campaigns/studio-media-picker-modal"
import { SocialCalendarView } from "@/components/admin/campaigns/social-calendar-view"
import {
  formatPktDateKey,
  formatPktDateTimeLocal,
  parsePktDateTimeLocal,
  parsePktSlotToUtc,
} from "@/lib/social/time-slots"
import {
  createAndQueueWhatsappBroadcastAction,
  getWhatsappBroadcastDetailsAction,
  retryFailedWhatsappBroadcastRecipientsAction,
} from "@/app/actions/whatsapp-crm"
import {
  WhatsappBroadcastDetailsDialog,
  WhatsappBroadcastPersonalizerFields,
  type BroadcastRecipientDetail,
  type BroadcastSummaryDetail,
} from "@/components/admin/campaigns/whatsapp-broadcast-drawer"
import { parseWhatsappBroadcastCsv } from "@/lib/whatsapp/template-variables"
import { dispatchOrLogDistribution } from "@/app/actions/marketing-ops"
import {
  OutreachClient,
  type OutreachContactRow,
  type OutreachAssetRow,
  type OutreachLogRow,
} from "@/components/admin/marketing/outreach-client"
import { CampaignRealtimeStatus } from "@/components/admin/campaigns/campaign-realtime-status"
import { computeOutreachCooldownState } from "@/lib/domain/marketing-ops"
import { DEFAULT_OFFICE_ADDRESS } from "@/lib/company-info"
import { cn } from "@/lib/utils"

// ==========================================
// 1. DATA CONTRACTS & PURE HELPERS
// ==========================================

export type { SafeSocialIntegration }

export interface CampaignsSummaryCounts {
  totalScheduledPosts: number
  totalPostAssets: number
  totalOutreachContacts: number
  totalBroadcasts: number
  postsPage: number
  postsPageSize: number
  contactsPage: number
  contactsPageSize: number
}

export interface CampaignsCompanyInfo {
  officeAddress: string
  primaryWhatsapp: string
  normalizedWhatsapp: string
  hotlineDisplay: string
}

export type CampaignsTabKey = "social" | "whatsapp" | "outreach"

/**
 * Normalizes legacy and alias `?tab=` query values onto the 3 canonical
 * `/admin/campaigns` tab keys (`T-089`).
 */
export function normalizeCampaignsTab(
  raw: string | null | undefined
): CampaignsTabKey {
  const cleaned = (raw || "").trim().toLowerCase()
  if (
    cleaned === "whatsapp" ||
    cleaned === "distribution" ||
    cleaned === "groups" ||
    cleaned === "queue" ||
    cleaned === "wa"
  ) {
    return "whatsapp"
  }
  if (
    cleaned === "outreach" ||
    cleaned === "broadcasts" ||
    cleaned === "broadcast" ||
    cleaned === "vip"
  ) {
    return "outreach"
  }
  return "social"
}

/**
 * Strictly filters Meta message templates and broadcast logs to the active
 * `selectedAccountId` so multi-WABA accounts never cross-contaminate (`T-071`).
 */
export function filterWhatsappResourcesByAccount<
  TTemplate extends { id: string; accountId: string; status: string },
  TBroadcast extends { id: string; accountId: string },
>(
  templates: TTemplate[],
  broadcasts: TBroadcast[],
  selectedAccountId: string
): {
  approvedTemplates: TTemplate[]
  accountBroadcasts: TBroadcast[]
} {
  if (!selectedAccountId) {
    return { approvedTemplates: [], accountBroadcasts: [] }
  }
  return {
    approvedTemplates: templates.filter(
      (t) => t.accountId === selectedAccountId && t.status === "APPROVED"
    ),
    accountBroadcasts: broadcasts.filter(
      (b) => b.accountId === selectedAccountId
    ),
  }
}

export interface WhatsappQueueSummary {
  whatsappChannels: MarketingChannelRecord[]
  sharedChannelIds: Set<string>
  failedChannelIds: Set<string>
  queuedChannelIds: Set<string>
  totalActiveChannels: number
  sharedCountToday: number
  failedCountToday: number
}

/**
 * Computes daily WhatsApp Group & Status distribution status strictly across
 * WhatsApp channel types, excluding `status === "failed"` from `sharedCountToday`
 * and flagging failed dispatches explicitly (`T-071`, `OD-01`).
 */
export function summarizeWhatsappQueueStatus(
  channels: MarketingChannelRecord[],
  distributionsForDate: Pick<DistributionRecord, "channelId" | "status">[]
): WhatsappQueueSummary {
  const whatsappChannels = channels.filter(
    (c) =>
      c.platform === "whatsapp_group" ||
      c.platform === "whatsapp_community" ||
      c.platform === "whatsapp_status"
  )

  const sharedChannelIds = new Set<string>()
  const failedRawIds = new Set<string>()
  const queuedRawIds = new Set<string>()

  for (const dist of distributionsForDate) {
    if (
      dist.status === "sent" ||
      dist.status === "posted" ||
      dist.status === "manual_logged"
    ) {
      sharedChannelIds.add(dist.channelId)
    } else if (dist.status === "failed") {
      failedRawIds.add(dist.channelId)
    } else if (
      dist.status === "planned" ||
      dist.status === "queued" ||
      dist.status === "queued_auto"
    ) {
      queuedRawIds.add(dist.channelId)
    }
  }

  const failedChannelIds = new Set<string>()
  for (const id of failedRawIds) {
    if (!sharedChannelIds.has(id)) {
      failedChannelIds.add(id)
    }
  }

  const queuedChannelIds = new Set<string>()
  for (const id of queuedRawIds) {
    if (!sharedChannelIds.has(id) && !failedChannelIds.has(id)) {
      queuedChannelIds.add(id)
    }
  }

  const activeChannels = whatsappChannels.filter((c) => c.isActive)
  const sharedCountToday = activeChannels.filter((c) =>
    sharedChannelIds.has(c.id)
  ).length
  const failedCountToday = activeChannels.filter((c) =>
    failedChannelIds.has(c.id)
  ).length

  return {
    whatsappChannels,
    sharedChannelIds,
    failedChannelIds,
    queuedChannelIds,
    totalActiveChannels: activeChannels.length,
    sharedCountToday,
    failedCountToday,
  }
}

/**
 * Validates composer media URLs on the client before submitting, rejecting
 * ephemeral browser `blob:` URLs, `data:`/`file:` URIs, and non-HTTPS links (`T-070`).
 */
export function isValidSocialComposerMediaUrl(rawUrl: string): {
  valid: boolean
  error?: string
} {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return { valid: false, error: "Media URL cannot be empty." }
  }
  if (/^blob:/i.test(trimmed)) {
    return {
      valid: false,
      error:
        "Temporary browser blob: URLs cannot be saved. Please upload media to Cloudflare R2 first.",
    }
  }
  if (/^(file|data|javascript|vbscript):/i.test(trimmed)) {
    return {
      valid: false,
      error:
        "Local file: and data: URIs are not permitted for social publishing.",
    }
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "https:") {
      return {
        valid: false,
        error: "Social media URLs must use HTTPS (Cloudflare R2).",
      }
    }
    return { valid: true }
  } catch {
    return {
      valid: false,
      error: "Media URL must be a valid absolute HTTPS URL.",
    }
  }
}

export interface ScheduledPostTargetItem {
  id: string
  scheduledPostId: string
  integrationId: string
  status: "pending" | "publishing" | "published" | "failed" | "skipped"
  publishedUrl: string | null
  externalPostId: string | null
  firstCommentExternalId?: string | null
  firstCommentPostedAt?: Date | string | null
  analyticsData?: SocialPostAnalyticsData | null
  idempotencyKey: string
  errorMessage: string | null
  publishedAt: Date | null
  attemptCount: number
  integration: {
    id: string
    name: string
    provider: "instagram" | "facebook" | "tiktok" | "youtube" | "gmb"
    handle: string | null
    avatarUrl: string | null
  }
}

export interface ScheduledPostItem {
  id: string
  postAssetId: string | null
  caption: string
  postType: "single_image" | "carousel" | "video" | "story" | "offer"
  postFormat?: SocialPostFormat
  firstComment?: string | null
  platformCaptions?: PlatformCaptionsMap
  engagementPlugConfig?: EngagementPlugConfig | null
  mediaUrls: string[]
  socialJpegUrls: string[]
  campaignStage: "step_1_spotlight_hook" | "step_2_all_packages" | "standalone"
  pairedFollowUpPostId: string | null
  twoStepDelayMinutes: number
  status:
    | "draft"
    | "scheduled"
    | "publishing"
    | "completed"
    | "partially_failed"
    | "failed"
    | "cancelled"
  scheduledFor: Date
  triggerRunId: string | null
  createdAt: Date
  targets: ScheduledPostTargetItem[]
  postAsset?: {
    id: string
    postCode: string
    title: string
    imageUrl: string
    kind: string
  } | null
}

export interface PostAssetRecord {
  id: string
  postCode: string
  kind:
    "multi_package_sheet" | "single_package_spotlight" | "custom_quotation_pdf"
  title: string
  supplierId: string
  flyerId: string
  flyerPackageId: string | null
  imageUrl: string
  pdfUrl: string | null
  captionWhatsapp: string | null
  captionInstagram: string | null
  searchableText: string | null
  createdAt: Date
}

export interface SupplierFlyerRecord {
  id: string
  flyerCode: string | null
  title: string
  rawFlyerImageUrl: string
  socialReadySheetJpegUrl?: string | null
  airlineName: string
  durationDays: number
  daysTitle: string
  routePill: string
  supplier: {
    id: string
    name: string
    slug: string
  }
  packages: Array<{
    id: string
    cardNumber: string
    postCode: string
    makkahHotelName: string
    madinahHotelName: string
    retailSharingPkr: number
    retailQuadPkr: number
    retailTriplePkr: number
    retailDoublePkr: number
    spotlightPosterUrl: string | null
  }>
}

export interface MarketingChannelRecord {
  id: string
  name: string
  platform:
    | "whatsapp_group"
    | "whatsapp_community"
    | "whatsapp_status"
    | "instagram"
    | "facebook"
    | "tiktok"
    | "youtube"
    | "google_business"
  areaTag: string
  senderWhatsappNumber: string | null
  externalGroupIdOrHandle: string | null
  inviteLinkOrUrl: string | null
  memberCount: number | null
  dailyTargetPosts: number
  isActive: boolean
  sortOrder: number
  lastPostedAt: Date | null
}

export interface DistributionRecord {
  id: string
  scheduledDate: string
  channelId: string
  postAssetId: string
  pairedFollowUpAssetId: string | null
  stage: "step_1_spotlight_hook" | "step_2_all_packages" | "standalone"
  status:
    | "planned"
    | "queued"
    | "queued_auto"
    | "sent"
    | "posted"
    | "manual_logged"
    | "failed"
  senderWhatsappLine: string | null
  captionUsed: string | null
  postedAt: Date | null
  channel: MarketingChannelRecord
  postAsset: PostAssetRecord
  pairedFollowUpAsset?: PostAssetRecord | null
}

export interface SafeWhatsappAccount {
  id: string
  name: string
  phoneNumberId: string
  wabaId: string
  displayPhoneNumber: string
  verifiedName: string | null
  qualityRating: string | null
  messagingLimit: string | null
  isActive: boolean
  isDefault: boolean
}

export interface WhatsappTemplateRecord {
  id: string
  accountId: string
  metaTemplateId: string
  name: string
  language: string
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED"
  headerType: string | null
  headerContent: string | null
  bodyText: string
  footerText: string | null
}

export interface WhatsappBroadcastRecord {
  id: string
  accountId: string
  name: string
  templateId: string
  templateName: string
  templateLanguage: string
  status:
    "draft" | "scheduled" | "processing" | "completed" | "failed" | "cancelled"
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  scheduledAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  template?: WhatsappTemplateRecord | null
}

export interface CampaignsHubClientProps {
  initialTab?: string
  initialAssetId?: string
  initialNowMs?: number
  userRole?: "super_admin" | "staff"
  companyInfo?: CampaignsCompanyInfo
  tiktokDirectPostApproved?: boolean
  gbpApiApproved?: boolean
  summaryCounts?: CampaignsSummaryCounts
  degradedWarnings?: string[]
  socialIntegrations: SafeSocialIntegration[]
  scheduledPosts: ScheduledPostItem[]
  postAssets: PostAssetRecord[]
  supplierFlyers: SupplierFlyerRecord[]
  marketingChannels: MarketingChannelRecord[]
  dailyDistributions: DistributionRecord[]
  whatsappAccounts: SafeWhatsappAccount[]
  whatsappTemplates: WhatsappTemplateRecord[]
  whatsappBroadcasts: WhatsappBroadcastRecord[]
  outreachContacts: OutreachContactRow[]
  outreachLogs: OutreachLogRow[]
}

const CAMPAIGN_TABS: Array<{
  key: CampaignsTabKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}> = [
  {
    key: "social",
    label: "Core 5 Social Calendar & Composer",
    icon: Calendar,
    description:
      "Schedule & publish multi-channel campaigns across Instagram, Facebook, TikTok, YouTube & Google Business with 2-step attention-grabber hooks.",
  },
  {
    key: "whatsapp",
    label: "100% Ban-Safe WhatsApp Groups & Status Queue",
    icon: MessageSquare,
    description:
      "Manual assisted distribution queue for community WhatsApp groups and Status lines with 1-tap formatted caption copying and 4K poster downloads.",
  },
  {
    key: "outreach",
    label: "Official Meta Broadcasts & VIP Outreach",
    icon: Send,
    description:
      "Official Meta Cloud API template broadcasts for subscriber lists and 1-on-1 VIP personal outreach CRM with 14-day cooldown protection.",
  },
]

const CORE_5_PLATFORMS: Array<{
  id: "instagram" | "facebook" | "tiktok" | "youtube" | "gmb"
  name: string
  badge: string
  color: string
}> = [
  {
    id: "instagram",
    name: "Instagram Business",
    badge: "IG",
    color: "bg-accent text-accent-foreground border-gold-border",
  },
  {
    id: "facebook",
    name: "Facebook Pages",
    badge: "FB",
    color: "bg-status-info-bg text-status-info border-status-info-border",
  },
  {
    id: "tiktok",
    name: "TikTok Business",
    badge: "TikTok",
    color: "bg-secondary text-foreground border-border",
  },
  {
    id: "youtube",
    name: "YouTube Channel",
    badge: "YT",
    color: "bg-status-danger-bg text-status-danger border-status-danger-border",
  },
  {
    id: "gmb",
    name: "Google Business Profile",
    badge: "GMB",
    color:
      "bg-status-success-bg text-status-success border-status-success-border",
  },
]

const PLATFORM_DISPLAY_NAMES: Record<SocialProviderId, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  gmb: "Google Business",
}

const FORMAT_DISPLAY_NAMES: Record<SocialPostFormat, string> = {
  FEED: "Feed",
  REEL: "Reel",
  STORY: "Story",
}

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

function hasVideoMediaUrl(urls: string[]): boolean {
  return urls.some((url) => {
    const pathname = url.trim().split(/[?#]/)[0]?.toLowerCase() || ""
    return (
      pathname.endsWith(".mp4") ||
      pathname.endsWith(".mov") ||
      pathname.endsWith(".webm") ||
      pathname.endsWith(".m4v")
    )
  })
}

function formatDateSafe(val: Date | string | null | undefined): string {
  if (!val) return "-"
  const d = typeof val === "string" ? new Date(val) : val
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isRealTriggerRunId(runId: string | null | undefined): runId is string {
  return Boolean(
    runId && runId.trim().length > 0 && !runId.startsWith("inline_")
  )
}

// ==========================================
// 2. MAIN HUB CLIENT
// ==========================================

export function CampaignsHubClient({
  initialTab = "social",
  initialAssetId = "",
  initialNowMs,
  userRole = "staff",
  companyInfo,
  tiktokDirectPostApproved = false,
  gbpApiApproved = false,
  summaryCounts,
  degradedWarnings = [],
  socialIntegrations,
  scheduledPosts,
  postAssets,
  supplierFlyers,
  marketingChannels,
  dailyDistributions,
  whatsappAccounts,
  whatsappTemplates,
  whatsappBroadcasts,
  outreachContacts,
  outreachLogs,
}: CampaignsHubClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeTab: CampaignsTabKey = React.useMemo(() => {
    const urlTab = searchParams.get("tab")
    if (urlTab) {
      return normalizeCampaignsTab(urlTab)
    }
    return normalizeCampaignsTab(initialTab)
  }, [searchParams, initialTab])

  const handleTabChange = (key: CampaignsTabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handlePageParamChange = (
    paramKey: "postsPage" | "contactsPage",
    nextPage: number
  ) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(paramKey, String(Math.max(1, nextPage)))
    router.push(`${pathname}?${params.toString()}`)
  }

  const activeMeta =
    CAMPAIGN_TABS.find((t) => t.key === activeTab) || CAMPAIGN_TABS[0]

  const whatsappChannelsCount = React.useMemo(
    () =>
      marketingChannels.filter(
        (c) =>
          c.platform === "whatsapp_group" ||
          c.platform === "whatsapp_community" ||
          c.platform === "whatsapp_status"
      ).length,
    [marketingChannels]
  )

  const activeSocialAccountsCount = socialIntegrations.filter(
    (i) => i.isActive
  ).length
  const scheduledCount = scheduledPosts.filter(
    (p) => p.status === "scheduled" || p.status === "publishing"
  ).length
  const totalScheduledPostsCount =
    summaryCounts?.totalScheduledPosts ?? scheduledPosts.length
  const totalVipContactsCount =
    summaryCounts?.totalOutreachContacts ?? outreachContacts.length

  const officeLocationLabel =
    companyInfo?.officeAddress || DEFAULT_OFFICE_ADDRESS
  const primaryWhatsappDigits =
    companyInfo?.normalizedWhatsapp || "923274029701"

  return (
    <div className="flex flex-col gap-6">
      {/* Non-silent SSR Query Warning Banner */}
      {degradedWarnings.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-xs text-status-warning"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-status-warning"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-0.5">
            <p className="font-bold">
              Some campaign datasets loaded in degraded mode:
            </p>
            <ul className="list-disc pl-4 text-[11px]">
              {degradedWarnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Hub Header */}
      <div className="flex flex-col gap-3 border-b border-border/80 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Campaigns &amp; Multi-Channel Outreach
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground sm:text-sm">
              {activeMeta.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/5 text-[11px] font-medium text-primary tabular-nums"
            >
              <span className="font-mono font-semibold">
                {activeSocialAccountsCount}
              </span>{" "}
              Social Channels
            </Badge>
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/5 text-[11px] font-medium text-primary tabular-nums"
            >
              <span className="font-mono font-semibold">
                {whatsappChannelsCount}
              </span>{" "}
              WhatsApp Channels
            </Badge>
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/5 text-[11px] font-medium text-primary tabular-nums"
            >
              <span className="font-mono font-semibold">
                {totalVipContactsCount}
              </span>{" "}
              VIP Contacts
            </Badge>
            {scheduledCount > 0 && (
              <Badge className="bg-status-success text-[11px] font-semibold text-primary-foreground tabular-nums">
                <span className="font-mono font-bold">{scheduledCount}</span>{" "}
                Posts Active in Queue
              </Badge>
            )}
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="mt-2 no-scrollbar flex gap-1.5 overflow-x-auto rounded-xl border border-border/80 bg-secondary/60 p-1.5">
          {CAMPAIGN_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none",
                  isActive
                    ? "border border-gold-border bg-card text-primary shadow-xs"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors motion-reduce:transition-none",
                    isActive ? "text-gold-text" : "text-muted-foreground"
                  )}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                {tab.key === "social" && (
                  <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                    {totalScheduledPostsCount}
                  </span>
                )}
                {tab.key === "whatsapp" && (
                  <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                    {whatsappChannelsCount}
                  </span>
                )}
                {tab.key === "outreach" && (
                  <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                    {totalVipContactsCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab 1: Social Calendar & Post Composer */}
      {activeTab === "social" && (
        <SocialCalendarTab
          initialAssetId={initialAssetId}
          initialNowMs={initialNowMs}
          userRole={userRole}
          officeLocationLabel={officeLocationLabel}
          primaryWhatsappDigits={primaryWhatsappDigits}
          tiktokDirectPostApproved={tiktokDirectPostApproved}
          gbpApiApproved={gbpApiApproved}
          summaryCounts={summaryCounts}
          onPostsPageChange={(page) => handlePageParamChange("postsPage", page)}
          socialIntegrations={socialIntegrations}
          scheduledPosts={scheduledPosts}
          postAssets={postAssets}
          supplierFlyers={supplierFlyers}
        />
      )}

      {/* Tab 2: WhatsApp Groups & Status Queue */}
      {activeTab === "whatsapp" && (
        <WhatsAppQueueTab
          initialAssetId={initialAssetId}
          initialNowMs={initialNowMs}
          postAssets={postAssets}
          marketingChannels={marketingChannels}
          dailyDistributions={dailyDistributions}
        />
      )}

      {/* Tab 3: Official Meta Broadcasts & VIP Outreach */}
      {activeTab === "outreach" && (
        <BroadcastsAndOutreachTab
          initialNowMs={initialNowMs}
          userRole={userRole}
          officeLocationLabel={officeLocationLabel}
          summaryCounts={summaryCounts}
          onContactsPageChange={(page) =>
            handlePageParamChange("contactsPage", page)
          }
          whatsappAccounts={whatsappAccounts}
          whatsappTemplates={whatsappTemplates}
          whatsappBroadcasts={whatsappBroadcasts}
          outreachContacts={outreachContacts}
          postAssets={postAssets}
          outreachLogs={outreachLogs}
        />
      )}
    </div>
  )
}

// ==========================================
// 3. TAB 1: SOCIAL CALENDAR & COMPOSER
// ==========================================

function SocialCalendarTab({
  initialAssetId,
  initialNowMs,
  userRole,
  officeLocationLabel,
  primaryWhatsappDigits,
  tiktokDirectPostApproved,
  gbpApiApproved,
  summaryCounts,
  onPostsPageChange,
  socialIntegrations,
  scheduledPosts,
  postAssets,
  supplierFlyers,
}: {
  initialAssetId: string
  initialNowMs?: number
  userRole: "super_admin" | "staff"
  officeLocationLabel: string
  primaryWhatsappDigits: string
  tiktokDirectPostApproved: boolean
  gbpApiApproved: boolean
  summaryCounts?: CampaignsSummaryCounts
  onPostsPageChange: (page: number) => void
  socialIntegrations: SafeSocialIntegration[]
  scheduledPosts: ScheduledPostItem[]
  postAssets: PostAssetRecord[]
  supplierFlyers: SupplierFlyerRecord[]
}) {
  const router = useRouter()

  const [selectedAssetId, setSelectedAssetId] = React.useState<string>(() => {
    if (initialAssetId && postAssets.some((a) => a.id === initialAssetId)) {
      return initialAssetId
    }
    return postAssets[0]?.id || ""
  })

  const selectedAsset = React.useMemo(
    () => postAssets.find((a) => a.id === selectedAssetId),
    [postAssets, selectedAssetId]
  )

  const [caption, setCaption] = React.useState<string>(() => {
    return (
      selectedAsset?.captionInstagram || selectedAsset?.captionWhatsapp || ""
    )
  })

  const matchingFlyer = React.useMemo(
    () => supplierFlyers.find((f) => f.id === selectedAsset?.flyerId),
    [supplierFlyers, selectedAsset?.flyerId]
  )

  // Preserve Spotlight child image URL (`T-070`): only prefer flyer sheet JPEG for multi_package_sheet!
  const preferredAssetMediaUrl = React.useMemo(() => {
    if (!selectedAsset) return ""
    if (selectedAsset.kind === "multi_package_sheet") {
      return matchingFlyer?.socialReadySheetJpegUrl || selectedAsset.imageUrl
    }
    return selectedAsset.imageUrl
  }, [selectedAsset, matchingFlyer?.socialReadySheetJpegUrl])

  const [customMediaInput, setCustomMediaInput] = React.useState("")
  const [mediaUrls, setMediaUrls] = React.useState<string[]>(() => {
    return preferredAssetMediaUrl ? [preferredAssetMediaUrl] : []
  })

  const isVideoMedia = React.useMemo(() => {
    return hasVideoMediaUrl(mediaUrls)
  }, [mediaUrls])

  const activeIntegrations = React.useMemo(
    () => socialIntegrations.filter((i) => i.isActive),
    [socialIntegrations]
  )

  const [selectedTargetIds, setSelectedTargetIds] = React.useState<string[]>(
    () =>
      activeIntegrations
        .filter((i) => {
          if (i.provider === "youtube" && !isVideoMedia) return false
          if (i.provider === "gmb" && !gbpApiApproved) return false
          return true
        })
        .map((i) => i.id)
  )

  const effectiveSelectedTargetIds = React.useMemo(
    () =>
      selectedTargetIds.filter((id) => {
        const integration = activeIntegrations.find((i) => i.id === id)
        if (!integration) return false
        if (
          integration.provider === "youtube" &&
          !isVideoMedia &&
          mediaUrls.length > 0
        ) {
          return false
        }
        if (integration.provider === "gmb" && !gbpApiApproved) {
          return false
        }
        return true
      }),
    [
      selectedTargetIds,
      activeIntegrations,
      isVideoMedia,
      mediaUrls.length,
      gbpApiApproved,
    ]
  )

  const handleSelectComposerAsset = (
    nextAssetId: string,
    overrideMediaUrl?: string
  ) => {
    setSelectedAssetId(nextAssetId)
    const nextAsset = postAssets.find((a) => a.id === nextAssetId)
    if (nextAsset) {
      setCaption(nextAsset.captionInstagram || nextAsset.captionWhatsapp || "")
    }
    const nextFlyer = nextAsset
      ? supplierFlyers.find((f) => f.id === nextAsset.flyerId)
      : undefined
    const nextMediaUrl =
      overrideMediaUrl ||
      (nextAsset
        ? nextAsset.kind === "multi_package_sheet"
          ? nextFlyer?.socialReadySheetJpegUrl || nextAsset.imageUrl
          : nextAsset.imageUrl
        : "")

    if (nextMediaUrl) {
      const nextUrls = [nextMediaUrl]
      setMediaUrls(nextUrls)
      if (!hasVideoMediaUrl(nextUrls)) {
        setSelectedTargetIds((prev) =>
          prev.filter((id) => {
            const found = activeIntegrations.find((i) => i.id === id)
            return found?.provider !== "youtube"
          })
        )
      }
    }
  }

  const toggleTargetIntegration = (id: string) => {
    const integration = activeIntegrations.find((i) => i.id === id)
    if (!integration) return
    if (integration.provider === "youtube" && !isVideoMedia) return
    if (integration.provider === "gmb" && !gbpApiApproved) return

    setSelectedTargetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // TikTok Audit UX Controls State (`T-070`, `OD-11`)
  const selectedTikTokIntegration = React.useMemo(
    () =>
      activeIntegrations.find(
        (i) =>
          i.provider === "tiktok" && effectiveSelectedTargetIds.includes(i.id)
      ) || null,
    [activeIntegrations, effectiveSelectedTargetIds]
  )

  const [tiktokCreatorInfo, setTiktokCreatorInfo] =
    React.useState<TikTokCreatorInfo | null>(null)
  const [tiktokPrivacyLevel, setTiktokPrivacyLevel] = React.useState<
    TikTokPrivacyLevel | ""
  >(() => (tiktokDirectPostApproved ? "" : "SELF_ONLY"))
  const [tiktokAllowComment, setTiktokAllowComment] = React.useState(false)
  const [tiktokAllowDuet, setTiktokAllowDuet] = React.useState(false)
  const [tiktokAllowStitch, setTiktokAllowStitch] = React.useState(false)
  const [tiktokCommercialToggle, setTiktokCommercialToggle] =
    React.useState(false)
  const [tiktokBrandOrganic, setTiktokBrandOrganic] = React.useState(false)
  const [tiktokBrandContent, setTiktokBrandContent] = React.useState(false)

  React.useEffect(() => {
    if (!selectedTikTokIntegration) return
    let cancelled = false
    void getTikTokCreatorInfoAction({
      integrationId: selectedTikTokIntegration.id,
    }).then((res) => {
      if (cancelled || !res.success || !res.creatorInfo) return
      setTiktokCreatorInfo(res.creatorInfo)
      if (!tiktokDirectPostApproved) {
        setTiktokPrivacyLevel("SELF_ONLY")
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedTikTokIntegration, tiktokDirectPostApproved])

  // GMB Call-To-Action Controls (`T-070`)
  const hasSelectedGmb = React.useMemo(
    () =>
      activeIntegrations.some(
        (i) => i.provider === "gmb" && effectiveSelectedTargetIds.includes(i.id)
      ),
    [activeIntegrations, effectiveSelectedTargetIds]
  )
  const [gmbCallToActionType, setGmbCallToActionType] = React.useState<
    "BOOK" | "LEARN_MORE"
  >("BOOK")
  const [gmbCallToActionUrl, setGmbCallToActionUrl] = React.useState<string>("")

  const [postFormat, setPostFormat] = React.useState<SocialPostFormat>("FEED")
  const [firstComment, setFirstComment] = React.useState<string>("")
  const [isGeneratingFirstComment, setIsGeneratingFirstComment] =
    React.useState(false)

  // PKT-anchored `datetime-local` state (`T-089`)
  const [publishNow, setPublishNow] = React.useState(true)
  const [scheduledDateTime, setScheduledDateTime] = React.useState<string>(() =>
    formatPktDateTimeLocal(
      new Date((initialNowMs ?? Date.now()) + 2 * 60 * 60 * 1000)
    )
  )

  const [isTwoStepEnabled, setIsTwoStepEnabled] = React.useState(false)
  const [twoStepDelayMinutes, setTwoStepDelayMinutes] = React.useState(180)

  const sheetAssets = React.useMemo(
    () => postAssets.filter((a) => a.kind === "multi_package_sheet"),
    [postAssets]
  )
  const [followUpAssetId, setFollowUpAssetId] = React.useState<string>(
    () => sheetAssets[0]?.id || postAssets[1]?.id || ""
  )
  const followUpAsset = React.useMemo(
    () => postAssets.find((a) => a.id === followUpAssetId),
    [postAssets, followUpAssetId]
  )
  const [followUpCaption, setFollowUpCaption] = React.useState<string>(() => {
    return (
      followUpAsset?.captionInstagram || followUpAsset?.captionWhatsapp || ""
    )
  })

  const handleSelectFollowUpAsset = (nextId: string) => {
    setFollowUpAssetId(nextId)
    const nextAsset = postAssets.find((a) => a.id === nextId)
    if (nextAsset) {
      setFollowUpCaption(
        nextAsset.captionInstagram || nextAsset.captionWhatsapp || ""
      )
    }
  }

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [composerNotice, setComposerNotice] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [activeSocialRunId, setActiveSocialRunId] = React.useState<
    string | null
  >(null)

  const [busyActionId, setBusyActionId] = React.useState<string | null>(null)
  const [syncingAnalyticsPostId, setSyncingAnalyticsPostId] = React.useState<
    string | null
  >(null)
  const [isSyncingAllAnalytics, setIsSyncingAllAnalytics] =
    React.useState(false)
  const [queueFilter, setQueueFilter] = React.useState<string>("all")
  const [previewModalPost, setPreviewModalPost] =
    React.useState<ScheduledPostItem | null>(null)
  const [isComposerModalOpen, setIsComposerModalOpen] = React.useState(false)
  const [expandedBreakdownPostIds, setExpandedBreakdownPostIds] =
    React.useState<string[]>([])

  const toggleBreakdownExpand = (postId: string) => {
    setExpandedBreakdownPostIds((prev) =>
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId]
    )
  }

  const [activeSocialSubView, setActiveSocialSubView] = React.useState<
    "calendar" | "queue"
  >("calendar")
  const [isStudioPickerOpen, setIsStudioPickerOpen] = React.useState(false)
  const [isUploadingR2, setIsUploadingR2] = React.useState(false)

  const [platformCaptions, setPlatformCaptions] = React.useState<
    Partial<
      Record<SocialProviderId, { caption?: string; firstComment?: string }>
    >
  >({})
  const [activeCaptionTab, setActiveCaptionTab] = React.useState<
    "global" | SocialProviderId
  >("global")

  const [isGeneratingAiCaptions, setIsGeneratingAiCaptions] =
    React.useState(false)
  const [isQueueingNextSlot, setIsQueueingNextSlot] = React.useState(false)

  const [isEngagementPlugEnabled, setIsEngagementPlugEnabled] =
    React.useState(false)
  const [engagementMinLikes, setEngagementMinLikes] = React.useState(25)
  const [engagementMinViews, setEngagementMinViews] = React.useState(500)
  const [engagementPlugText, setEngagementPlugText] = React.useState<string>(
    () =>
      `Urgent Update: Limited seats remaining for this package! WhatsApp our Lahore pilgrims desk directly for immediate confirmation: https://wa.me/${primaryWhatsappDigits}?text=Salam%20Al%20Ramlah%20Travels!%20Inquiring%20about%20booking.`
  )

  const matchedComposerPackage = React.useMemo(
    () =>
      matchingFlyer?.packages.find(
        (p) => p.id === selectedAsset?.flyerPackageId
      ) || matchingFlyer?.packages[0],
    [matchingFlyer, selectedAsset?.flyerPackageId]
  )

  const selectedProvidersForPreview = React.useMemo<SocialProviderId[]>(() => {
    const chosen = Array.from(
      new Set(
        activeIntegrations
          .filter((i) => effectiveSelectedTargetIds.includes(i.id))
          .map((i) => i.provider)
      )
    )
    return chosen.length > 0
      ? chosen
      : ["instagram", "facebook", "tiktok", "youtube", "gmb"]
  }, [activeIntegrations, effectiveSelectedTargetIds])

  // Honest Cross-Channel Analytics Rollup (`T-036`)
  const campaignAnalyticsOverview = React.useMemo(() => {
    const snapshots: PostTargetAnalyticsSnapshot[] = []
    for (const post of scheduledPosts) {
      for (const target of post.targets) {
        if (target.status === "published" || target.analyticsData) {
          const data = target.analyticsData as
            | (NonNullable<typeof target.analyticsData> & {
                syncStatus?: "live" | "unavailable" | "error"
                isLiveVerified?: boolean
              })
            | null
          const hasLive =
            data?.isLiveVerified ??
            (data?.syncStatus ? data.syncStatus === "live" : Boolean(data))
          snapshots.push({
            targetId: target.id,
            postId: post.id,
            postCode: post.postAsset?.postCode || null,
            caption: post.caption,
            provider: target.integration.provider,
            accountName: target.integration.name,
            views: data?.impressions ?? 0,
            impressions: data?.impressions ?? 0,
            likes: data?.likes ?? 0,
            comments: data?.comments ?? 0,
            shares: data?.shares ?? 0,
            clicks: data?.clicks ?? 0,
            publishedUrl: target.publishedUrl,
            lastSyncedAt: data?.lastSyncedAt ?? null,
            syncStatus: data?.syncStatus ?? (hasLive ? "live" : "unavailable"),
            isLiveVerified: hasLive,
          })
        }
      }
    }
    return aggregateCampaignAnalytics(snapshots)
  }, [scheduledPosts])

  const handleSyncAllAnalytics = async () => {
    setIsSyncingAllAnalytics(true)
    try {
      const res = await syncAllPublishedPostsAnalyticsAction({ limit: 25 })
      if (res.success) {
        const unavailNote =
          res.unavailableTargetsCount && res.unavailableTargetsCount > 0
            ? ` (${res.unavailableTargetsCount} target(s) unavailable without live API metrics)`
            : ""
        setComposerNotice({
          type: "success",
          message: `Synced live analytics across ${res.syncedTargetsCount ?? 0} channel target(s)${unavailNote}.`,
        })
        router.refresh()
      } else {
        setComposerNotice({
          type: "error",
          message: res.error || "Failed to sync published post analytics.",
        })
      }
    } finally {
      setIsSyncingAllAnalytics(false)
    }
  }

  const handleGenerateFirstComment = async () => {
    setIsGeneratingFirstComment(true)
    try {
      const matchedPackage = matchedComposerPackage
      if (selectedAsset?.id) {
        const res = await generateArtFirstCommentAction({
          postAssetId: selectedAsset.id,
          postCode: matchedPackage?.postCode || selectedAsset.postCode,
          title: selectedAsset.title,
          sharingPricePkr: matchedPackage?.retailSharingPkr,
          quadPricePkr: matchedPackage?.retailQuadPkr,
          triplePricePkr: matchedPackage?.retailTriplePkr,
          doublePricePkr: matchedPackage?.retailDoublePkr,
          makkahHotelName: matchedPackage?.makkahHotelName,
          madinahHotelName: matchedPackage?.madinahHotelName,
        })
        if (res.success && res.firstComment) {
          setFirstComment(res.firstComment)
          return
        }
      }

      const fallbackComment = buildArtFirstCommentPlug({
        postCode:
          matchedPackage?.postCode || selectedAsset?.postCode || "ART-UMRAH-01",
        title: selectedAsset?.title,
        sharingPricePkr: matchedPackage?.retailSharingPkr,
        quadPricePkr: matchedPackage?.retailQuadPkr,
        triplePricePkr: matchedPackage?.retailTriplePkr,
        doublePricePkr: matchedPackage?.retailDoublePkr,
        makkahHotelName: matchedPackage?.makkahHotelName,
        madinahHotelName: matchedPackage?.madinahHotelName,
        whatsappNumber: primaryWhatsappDigits,
      })
      setFirstComment(fallbackComment)
    } finally {
      setIsGeneratingFirstComment(false)
    }
  }

  const handleSyncPostAnalytics = async (postId: string) => {
    setSyncingAnalyticsPostId(postId)
    try {
      const res = await syncSocialPostAnalyticsAction({
        scheduledPostId: postId,
      })
      if (res.success) {
        router.refresh()
      } else {
        setComposerNotice({
          type: "error",
          message: res.error || "Failed to sync social post metrics.",
        })
      }
    } finally {
      setSyncingAnalyticsPostId(null)
    }
  }

  const currentTabCaption = React.useMemo(() => {
    if (activeCaptionTab === "global") return caption
    return platformCaptions[activeCaptionTab]?.caption || caption
  }, [activeCaptionTab, caption, platformCaptions])

  const currentTabFirstComment = React.useMemo(() => {
    if (activeCaptionTab === "global") return firstComment
    return platformCaptions[activeCaptionTab]?.firstComment !== undefined
      ? platformCaptions[activeCaptionTab]?.firstComment || ""
      : firstComment
  }, [activeCaptionTab, firstComment, platformCaptions])

  const handleGenerateAiCaptions = async () => {
    setIsGeneratingAiCaptions(true)
    setComposerNotice(null)
    try {
      const res = await generateSocialCaptionsCopilotAction({
        postCode: matchedComposerPackage?.postCode || selectedAsset?.postCode,
        title: selectedAsset?.title,
        campaignStage: isTwoStepEnabled
          ? "step_1_spotlight_hook"
          : "standalone",
        postFormat,
        sharingPricePkr: matchedComposerPackage?.retailSharingPkr,
        quadPricePkr: matchedComposerPackage?.retailQuadPkr,
        triplePricePkr: matchedComposerPackage?.retailTriplePkr,
        doublePricePkr: matchedComposerPackage?.retailDoublePkr,
        makkahHotelName: matchedComposerPackage?.makkahHotelName,
        madinahHotelName: matchedComposerPackage?.madinahHotelName,
        airlineName: matchingFlyer?.airlineName,
      })

      if (res.success && res.result) {
        setCaption(res.result.globalDefault)
        setFirstComment(res.result.suggestedFirstComment)
        setPlatformCaptions({
          instagram: {
            caption: res.result.captions.instagram.caption,
            firstComment: res.result.captions.instagram.firstComment,
          },
          facebook: {
            caption: res.result.captions.facebook.caption,
            firstComment: res.result.captions.facebook.firstComment,
          },
          tiktok: {
            caption: res.result.captions.tiktok.caption,
            firstComment: res.result.captions.tiktok.firstComment,
          },
          youtube: {
            caption: res.result.captions.youtube.caption,
            firstComment: res.result.captions.youtube.firstComment,
          },
          gmb: {
            caption: res.result.captions.gmb.caption,
          },
        })
        setComposerNotice({
          type: "success",
          message: `AI generated 5 platform-optimized captions & hooks (${res.result.modelUsed}).`,
        })
      } else {
        setComposerNotice({
          type: "error",
          message: res.error || "Failed to generate AI captions.",
        })
      }
    } catch (err: unknown) {
      setComposerNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "AI caption generation failed.",
      })
    } finally {
      setIsGeneratingAiCaptions(false)
    }
  }

  // Queue in next open PKT slot using PKT-anchored formatter (`T-089`)
  const handleQueueNextFreeSlot = async () => {
    setIsQueueingNextSlot(true)
    try {
      const res = await getNextFreeSocialSlotAction()
      if (res.success && res.nextSlotUtc) {
        setPublishNow(false)
        setScheduledDateTime(formatPktDateTimeLocal(new Date(res.nextSlotUtc)))
        setComposerNotice({
          type: "success",
          message: `Queued in next open PKT peak window: ${res.pktLabel}`,
        })
      } else {
        setComposerNotice({
          type: "error",
          message: res.error || "Failed to calculate next free slot.",
        })
      }
    } catch (err: unknown) {
      setComposerNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to calculate slot.",
      })
    } finally {
      setIsQueueingNextSlot(false)
    }
  }

  // Direct R2 media upload — NEVER falls back to ephemeral `blob:` URLs (`T-070`)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingR2(true)
    setComposerNotice(null)
    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "image/jpeg",
          folder: "social-media",
          sizeBytes: file.size,
        }),
      })

      if (presignRes.ok) {
        const presignData = (await presignRes.json()) as {
          uploadUrl?: string
          publicUrl?: string
        }
        if (presignData.uploadUrl && presignData.publicUrl) {
          const uploadRes = await fetch(presignData.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "image/jpeg" },
            body: file,
          })
          if (uploadRes.ok) {
            const check = isValidSocialComposerMediaUrl(presignData.publicUrl)
            if (check.valid) {
              setMediaUrls((prev) => [...prev, presignData.publicUrl!])
              return
            }
          }
        }
      }

      setComposerNotice({
        type: "error",
        message:
          "Cloudflare R2 media upload failed. Verify R2 storage configuration and retry; local browser blob: URLs are blocked.",
      })
    } catch (uploadErr: unknown) {
      setComposerNotice({
        type: "error",
        message:
          uploadErr instanceof Error
            ? `Cloudflare R2 upload failed: ${uploadErr.message}`
            : "Cloudflare R2 upload failed. Local blob: URLs cannot be saved.",
      })
    } finally {
      setIsUploadingR2(false)
      if (e.target) e.target.value = ""
    }
  }

  const handleAddCustomMediaUrl = () => {
    const candidate = customMediaInput.trim()
    if (!candidate) return
    const check = isValidSocialComposerMediaUrl(candidate)
    if (!check.valid) {
      setComposerNotice({
        type: "error",
        message: check.error || "Invalid media URL.",
      })
      return
    }
    setMediaUrls((prev) => [...prev, candidate])
    setCustomMediaInput("")
    setComposerNotice(null)
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (effectiveSelectedTargetIds.length === 0) {
      setComposerNotice({
        type: "error",
        message: "Please select at least one connected social channel target.",
      })
      return
    }
    if (!caption.trim()) {
      setComposerNotice({
        type: "error",
        message: "Post caption cannot be empty.",
      })
      return
    }
    if (postFormat === "REEL" && !isVideoMedia) {
      setComposerNotice({
        type: "error",
        message:
          "REEL format requires an MP4/MOV video URL in Attached Media URLs.",
      })
      return
    }

    const finalMediaUrls = mediaUrls.map((u) => u.trim()).filter(Boolean)
    for (const url of finalMediaUrls) {
      const check = isValidSocialComposerMediaUrl(url)
      if (!check.valid) {
        setComposerNotice({
          type: "error",
          message: check.error || `Invalid media URL: ${url}`,
        })
        return
      }
    }

    if (selectedTikTokIntegration) {
      if (!tiktokPrivacyLevel) {
        setComposerNotice({
          type: "error",
          message:
            "TikTok Audit Compliance requires selecting a Privacy Level explicitly before publishing.",
        })
        return
      }
      if (
        tiktokCommercialToggle &&
        !tiktokBrandOrganic &&
        !tiktokBrandContent
      ) {
        setComposerNotice({
          type: "error",
          message:
            "When TikTok Commercial Content Disclosure is enabled, select 'Your Brand' and/or 'Branded Content'.",
        })
        return
      }
      if (
        tiktokCommercialToggle &&
        tiktokBrandContent &&
        tiktokPrivacyLevel === "SELF_ONLY"
      ) {
        setComposerNotice({
          type: "error",
          message:
            "TikTok Branded Content cannot be published with Private (SELF_ONLY) visibility.",
        })
        return
      }
    }

    setIsSubmitting(true)
    setComposerNotice(null)

    try {
      const scheduledDate = publishNow
        ? new Date()
        : parsePktDateTimeLocal(scheduledDateTime)

      const derivedPostType =
        postFormat === "REEL"
          ? ("video" as const)
          : postFormat === "STORY"
            ? ("story" as const)
            : isVideoMedia
              ? ("video" as const)
              : finalMediaUrls.length > 1
                ? ("carousel" as const)
                : ("single_image" as const)

      const res = await createScheduledSocialPostAction({
        postAssetId: selectedAssetId || undefined,
        caption: caption.trim(),
        postType: derivedPostType,
        postFormat,
        firstComment: firstComment.trim() ? firstComment.trim() : null,
        platformCaptions:
          Object.keys(platformCaptions).length > 0
            ? platformCaptions
            : undefined,
        engagementPlugConfig: isEngagementPlugEnabled
          ? {
              enabled: true,
              minLikes: engagementMinLikes,
              minViews: engagementMinViews,
              plugText: engagementPlugText.trim(),
            }
          : null,
        mediaUrls: finalMediaUrls,
        campaignStage: isTwoStepEnabled
          ? ("step_1_spotlight_hook" as const)
          : ("standalone" as const),
        scheduledFor: scheduledDate,
        scheduledForPktLocal: publishNow ? undefined : scheduledDateTime,
        targetIntegrationIds: effectiveSelectedTargetIds,
        twoStepDelayMinutes: isTwoStepEnabled ? twoStepDelayMinutes : 180,
        publishNow,
        title: selectedAsset?.title,
        gmbCallToActionType: hasSelectedGmb ? gmbCallToActionType : undefined,
        gmbCallToActionUrl:
          hasSelectedGmb && gmbCallToActionUrl.trim()
            ? gmbCallToActionUrl.trim()
            : undefined,
        tiktokSettings: selectedTikTokIntegration
          ? {
              privacyLevel: tiktokPrivacyLevel || "SELF_ONLY",
              allowComment: tiktokAllowComment,
              allowDuet: tiktokAllowDuet,
              allowStitch: tiktokAllowStitch,
              commercialContentToggle: tiktokCommercialToggle,
              brandOrganicToggle: tiktokBrandOrganic,
              brandContentToggle: tiktokBrandContent,
            }
          : undefined,
        followUpPost:
          isTwoStepEnabled && followUpAssetId
            ? {
                caption: followUpCaption.trim(),
                postAssetId: followUpAssetId,
                mediaUrls: followUpAsset?.imageUrl
                  ? [followUpAsset.imageUrl]
                  : [],
                postType: "carousel" as const,
                postFormat: "FEED" as const,
                firstComment: firstComment.trim() ? firstComment.trim() : null,
                title: followUpAsset?.title,
              }
            : undefined,
      })

      if (res.success) {
        if (isRealTriggerRunId(res.triggerRunId)) {
          setActiveSocialRunId(res.triggerRunId)
        } else {
          setActiveSocialRunId(null)
        }
        setComposerNotice({
          type: "success",
          message: publishNow
            ? `Post (${postFormat}) processed across ${effectiveSelectedTargetIds.length} channel target(s).`
            : `Post (${postFormat}) scheduled for ${formatDateSafe(scheduledDate)} (PKT) across ${effectiveSelectedTargetIds.length} channel(s).`,
        })
        router.refresh()
      } else {
        setComposerNotice({
          type: "error",
          message: res.error || "Failed to schedule social media post.",
        })
      }
    } catch (err: unknown) {
      setComposerNotice({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while scheduling post.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelPost = async (postId: string) => {
    setBusyActionId(postId)
    try {
      const res = await cancelScheduledPostAction({ postId })
      if (res.success) {
        router.refresh()
      } else {
        setComposerNotice({
          type: "error",
          message: res.error || "Failed to cancel post.",
        })
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const handleRetryTarget = async (targetId: string) => {
    setBusyActionId(targetId)
    try {
      const res = await retryFailedPostTargetAction({ targetId })
      if (res.success) {
        router.refresh()
      } else {
        setComposerNotice({
          type: "error",
          message: res.error || "Target retry failed.",
        })
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const filteredPosts = React.useMemo(() => {
    if (queueFilter === "all") return scheduledPosts
    return scheduledPosts.filter((p) => p.status === queueFilter)
  }, [scheduledPosts, queueFilter])

  const livePublishingPost = React.useMemo(() => {
    return scheduledPosts.find(
      (p) => p.status === "publishing" && isRealTriggerRunId(p.triggerRunId)
    )
  }, [scheduledPosts])

  const effectiveSocialRunId = isRealTriggerRunId(
    livePublishingPost?.triggerRunId
  )
    ? livePublishingPost!.triggerRunId
    : activeSocialRunId

  const totalScheduledPosts =
    summaryCounts?.totalScheduledPosts ?? scheduledPosts.length
  const postsPage = summaryCounts?.postsPage ?? 1
  const postsPageSize = summaryCounts?.postsPageSize ?? 60
  const totalPostsPages = Math.max(
    1,
    Math.ceil(totalScheduledPosts / postsPageSize)
  )

  return (
    <div className="flex flex-col gap-8">
      {effectiveSocialRunId && (
        <CampaignRealtimeStatus
          runId={effectiveSocialRunId}
          mode="social_post"
          title="Live Multi-Channel Social Publishing Stream"
          onComplete={() => router.refresh()}
        />
      )}

      {/* 0. Honest Core 5 Analytics Overview Bar (`T-036`) */}
      <Card className="border-gold-border bg-card shadow-xs">
        <CardHeader className="border-b border-border/80 bg-secondary/25 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2 font-display text-base font-bold">
                <BarChart3
                  className="size-4 text-gold-text"
                  aria-hidden="true"
                />
                <span>Core 5 Cross-Channel Analytics Overview</span>
                <Badge
                  variant="outline"
                  className="border-gold-border text-[10px] font-semibold text-primary tabular-nums"
                >
                  <span className="font-mono font-bold">
                    {campaignAnalyticsOverview.liveSyncedTargetsCount}
                  </span>{" "}
                  Live Synced
                </Badge>
                {campaignAnalyticsOverview.unavailableTargetsCount > 0 && (
                  <Badge
                    variant="outline"
                    className="border-status-warning-border bg-status-warning-bg text-[10px] font-semibold text-status-warning tabular-nums"
                  >
                    <span className="font-mono font-bold">
                      {campaignAnalyticsOverview.unavailableTargetsCount}
                    </span>{" "}
                    Awaiting Live Sync
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Verified live API telemetry across Instagram, Facebook Pages,
                TikTok, YouTube Shorts &amp; Google Business Profile (zero
                estimated or synthetic metrics).
              </CardDescription>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsComposerModalOpen(true)}
                className="h-8 cursor-pointer gap-1.5 border-gold-border text-xs font-bold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              >
                <Smartphone
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
                <span>Open Studio Split Preview</span>
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={isSyncingAllAnalytics}
                onClick={handleSyncAllAnalytics}
                className="h-8 cursor-pointer gap-1.5 bg-primary text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {isSyncingAllAnalytics ? (
                  <Loader2
                    className="size-3.5 animate-spin text-gold motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <RefreshCw
                    className="size-3.5 text-gold"
                    aria-hidden="true"
                  />
                )}
                <span>Sync Live Analytics</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="space-y-1 rounded-xl bg-secondary/50 p-3">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Verified Views</span>
                <Eye className="size-3.5 text-primary" aria-hidden="true" />
              </div>
              <p className="font-mono text-lg font-bold text-foreground tabular-nums">
                {campaignAnalyticsOverview.liveSyncedTargetsCount > 0
                  ? campaignAnalyticsOverview.totalViews.toLocaleString()
                  : "-"}
              </p>
            </div>

            <div className="space-y-1 rounded-xl bg-secondary/50 p-3">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Verified Likes</span>
                <Heart
                  className="size-3.5 text-status-danger"
                  aria-hidden="true"
                />
              </div>
              <p className="font-mono text-lg font-bold text-foreground tabular-nums">
                {campaignAnalyticsOverview.liveSyncedTargetsCount > 0
                  ? campaignAnalyticsOverview.totalLikes.toLocaleString()
                  : "-"}
              </p>
            </div>

            <div className="space-y-1 rounded-xl bg-secondary/50 p-3">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Verified Comments</span>
                <MessageSquare
                  className="size-3.5 text-status-info"
                  aria-hidden="true"
                />
              </div>
              <p className="font-mono text-lg font-bold text-foreground tabular-nums">
                {campaignAnalyticsOverview.liveSyncedTargetsCount > 0
                  ? campaignAnalyticsOverview.totalComments.toLocaleString()
                  : "-"}
              </p>
            </div>

            <div className="space-y-1 rounded-xl bg-secondary/50 p-3">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Shares &amp; Clicks</span>
                <MousePointerClick
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
              </div>
              <p className="font-mono text-lg font-bold text-foreground tabular-nums">
                {campaignAnalyticsOverview.liveSyncedTargetsCount > 0
                  ? (
                      campaignAnalyticsOverview.totalShares +
                      campaignAnalyticsOverview.totalClicks
                    ).toLocaleString()
                  : "-"}
              </p>
            </div>

            <div className="col-span-2 space-y-1 rounded-xl bg-accent/60 p-3 sm:col-span-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-primary">
                <span>Avg Engagement</span>
                <TrendingUp
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
              </div>
              <p className="font-mono text-lg font-bold text-primary tabular-nums">
                {campaignAnalyticsOverview.liveSyncedTargetsCount > 0
                  ? `${campaignAnalyticsOverview.engagementRatePct.toFixed(2)}%`
                  : "-"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {CORE_5_PLATFORMS.map((plat) => {
              const summary = campaignAnalyticsOverview.byPlatform[plat.id]
              return (
                <div
                  key={plat.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-secondary/45 px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold",
                        plat.color
                      )}
                    >
                      {plat.badge}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold tabular-nums">
                        {summary.liveSyncedTargetsCount > 0
                          ? `${summary.views.toLocaleString()} views`
                          : "No live sync"}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground tabular-nums">
                        {summary.liveSyncedTargetsCount > 0 ? (
                          <>
                            <span className="inline-flex items-center gap-0.5 font-mono">
                              {summary.likes}
                              <Heart
                                className="size-2.5 text-status-danger"
                                aria-hidden="true"
                              />
                            </span>
                            <span className="inline-flex items-center gap-0.5 font-mono">
                              {summary.comments}
                              <MessageSquare
                                className="size-2.5 text-status-info"
                                aria-hidden="true"
                              />
                            </span>
                            <span className="inline-flex items-center gap-0.5 font-mono">
                              {summary.clicks}
                              <MousePointerClick
                                className="size-2.5 text-gold-text"
                                aria-hidden="true"
                              />
                            </span>
                          </>
                        ) : summary.unavailableTargetsCount > 0 ? (
                          <span>
                            {summary.unavailableTargetsCount} unsynced
                          </span>
                        ) : (
                          <span>-</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-gold-border font-mono text-[10px] text-primary tabular-nums"
                  >
                    {summary.liveSyncedTargetsCount > 0
                      ? `${summary.engagementRatePct.toFixed(1)}%`
                      : "-"}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 1. Post Composer Card */}
      <Card className="border-gold-border bg-card shadow-sm">
        <CardHeader className="border-b border-border bg-secondary/35 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-display text-lg font-bold">
                <Sparkles
                  className="size-4 text-gold-text"
                  aria-hidden="true"
                />
                <span>Core 5 Social Post Composer</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Broadcast official Al Ramlah 4K posters, vertical Reels &amp;
                Stories across connected Instagram, Facebook Pages, TikTok,
                YouTube &amp; Google Business accounts.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="border-primary/30 text-[11px] font-medium text-primary tabular-nums"
              >
                <span className="font-mono font-semibold">
                  {activeIntegrations.length}
                </span>{" "}
                Active Account(s) Connected
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-4 sm:p-6">
          {composerNotice && (
            <div
              role="alert"
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border p-3.5 text-xs font-semibold",
                composerNotice.type === "success"
                  ? "border-status-success-border bg-status-success-bg text-status-success"
                  : "border-status-danger-border bg-status-danger-bg text-status-danger"
              )}
            >
              <span>{composerNotice.message}</span>
              <button
                type="button"
                onClick={() => setComposerNotice(null)}
                className="shrink-0 cursor-pointer underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Dismiss
              </button>
            </div>
          )}

          <form onSubmit={handleCreatePost} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Asset, Format & Media Selection */}
              <div className="space-y-4 lg:col-span-5">
                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between text-xs font-bold text-primary">
                    <span>1. Select 4K Poster / Spotlight Asset</span>
                    <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                      {postAssets.length} Available
                    </span>
                  </Label>
                  <select
                    aria-label="Select 4K Poster or Spotlight Asset"
                    value={selectedAssetId}
                    onChange={(e) => handleSelectComposerAsset(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {postAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.postCode}] {a.title} ({a.kind.replace(/_/g, " ")})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsStudioPickerOpen(true)}
                    className="mt-1 w-full cursor-pointer gap-1.5 border-gold-border text-xs font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                  >
                    <Sparkles
                      className="size-3.5 text-gold-text"
                      aria-hidden="true"
                    />
                    <span>
                      Pick from Studio Library (4K Posters &amp; Flyers)
                    </span>
                  </Button>
                </div>

                {/* Post Format Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      Post Format (Feed / Reel / Story)
                    </Label>
                    <Badge
                      variant="outline"
                      className="border-gold-border text-[10px] font-semibold text-primary"
                    >
                      {FORMAT_DISPLAY_NAMES[postFormat]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: "FEED" as const,
                        label: "Feed Post",
                        desc: "4K Image / Carousel",
                        icon: ImageIcon,
                      },
                      {
                        id: "REEL" as const,
                        label: "Reel / Short",
                        desc: "9:16 Vertical Video",
                        icon: Film,
                      },
                      {
                        id: "STORY" as const,
                        label: "24h Story",
                        desc: "IG & FB Stories",
                        icon: Smartphone,
                      },
                    ].map((fmt) => {
                      const FmtIcon = fmt.icon
                      const active = postFormat === fmt.id
                      return (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setPostFormat(fmt.id)}
                          className={cn(
                            "flex cursor-pointer flex-col items-start rounded-lg p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                            active
                              ? "bg-primary/10 ring-1 ring-primary"
                              : "bg-secondary/50 hover:bg-accent/60"
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                            <FmtIcon
                              className={cn(
                                "size-3.5",
                                active
                                  ? "text-gold-text"
                                  : "text-muted-foreground"
                              )}
                              aria-hidden="true"
                            />
                            <span>{fmt.label}</span>
                          </div>
                          <span className="mt-0.5 text-[10px] text-muted-foreground">
                            {fmt.desc}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {postFormat === "REEL" && !isVideoMedia && (
                    <p className="rounded-md border border-status-warning-border bg-status-warning-bg px-2.5 py-1.5 text-[11px] font-medium text-status-warning">
                      Reel / Short format requires an `.mp4` or `.mov` video URL
                      in Attached Media URLs below.
                    </p>
                  )}
                </div>

                {/* Poster Preview Well */}
                {selectedAsset ? (
                  <div className="space-y-2.5 rounded-xl bg-secondary/45 p-3">
                    <div className="flex items-start gap-3">
                      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {(() => {
                          const assetImageUrl = getRenderableImagePreviewUrl(
                            selectedAsset.imageUrl
                          )
                          if (assetImageUrl) {
                            return (
                              <Image
                                src={assetImageUrl}
                                alt={selectedAsset.title}
                                fill
                                unoptimized
                                sizes="80px"
                                className="object-cover"
                              />
                            )
                          }
                          if (
                            selectedAsset.imageUrl &&
                            isPdfAssetUrl(selectedAsset.imageUrl)
                          ) {
                            return (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-accent/60 text-primary">
                                <FileText
                                  className="size-5 text-gold-text"
                                  aria-hidden="true"
                                />
                                <span className="text-[10px] font-semibold">
                                  PDF
                                </span>
                              </div>
                            )
                          }
                          if (selectedAsset.imageUrl) {
                            return (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-secondary text-primary">
                                <Film
                                  className="size-5 text-gold-text"
                                  aria-hidden="true"
                                />
                                <span className="text-[10px] font-semibold">
                                  Video
                                </span>
                              </div>
                            )
                          }
                          return (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                              No Image
                            </div>
                          )
                        })()}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-primary">
                            {selectedAsset.postCode}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-gold-border px-1.5 py-0 text-[10px] font-semibold text-primary capitalize"
                          >
                            {selectedAsset.kind.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <h4 className="line-clamp-2 text-xs font-semibold text-foreground">
                          {selectedAsset.title}
                        </h4>
                        <div className="flex items-center gap-2 pt-1 text-[11px]">
                          {selectedAsset.imageUrl && (
                            <a
                              href={selectedAsset.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <Eye className="size-3" aria-hidden="true" />
                              <span>View 4K Asset</span>
                            </a>
                          )}
                          {selectedAsset.pdfUrl && (
                            <a
                              href={selectedAsset.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-muted-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <FileText className="size-3" aria-hidden="true" />
                              <span>PDF</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    No poster asset selected.
                  </div>
                )}

                {/* Media URLs & R2 Dropzone */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Attached Media URLs ({mediaUrls.length})
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://... Cloudflare R2 image or MP4 URL"
                      value={customMediaInput}
                      onChange={(e) => setCustomMediaInput(e.target.value)}
                      className="h-8 bg-background text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddCustomMediaUrl}
                      className="h-8 shrink-0 cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Plus className="mr-1 size-3" aria-hidden="true" />
                      Add URL
                    </Button>
                  </div>
                  {mediaUrls.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {mediaUrls.map((url, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                        >
                          <span className="max-w-[160px] truncate">{url}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setMediaUrls((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="cursor-pointer hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            aria-label="Remove media URL"
                          >
                            <X className="size-3" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="relative mt-2 rounded-xl border border-dashed border-gold-border bg-accent/35 p-3 text-center transition-colors hover:bg-accent/60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none">
                    <input
                      type="file"
                      aria-label="Upload campaign media file"
                      accept="image/*,video/mp4,video/quicktime"
                      onChange={handleFileUpload}
                      disabled={isUploadingR2}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <div className="pointer-events-none flex flex-col items-center justify-center gap-1">
                      {isUploadingR2 ? (
                        <Loader2
                          className="size-5 animate-spin text-gold-text motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <UploadCloud
                          className="size-5 text-gold-text"
                          aria-hidden="true"
                        />
                      )}
                      <span className="text-xs font-semibold text-foreground">
                        {isUploadingR2
                          ? "Uploading to Cloudflare R2…"
                          : "Drag & Drop or Click to Upload Media"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Direct Cloudflare R2 HTTPS upload (Images or MP4 Videos)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Captions, Multi-Account Channels & Compliance Controls */}
              <div className="space-y-4 lg:col-span-7">
                <div className="space-y-2.5">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <Label className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <span>2. Social Captions &amp; Platform Overrides</span>
                      {activeCaptionTab !== "global" && (
                        <Badge
                          variant="outline"
                          className="border-gold-border text-[10px] font-semibold text-primary"
                        >
                          Customizing {PLATFORM_DISPLAY_NAMES[activeCaptionTab]}
                        </Badge>
                      )}
                    </Label>

                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={isGeneratingAiCaptions}
                      onClick={handleGenerateAiCaptions}
                      className="h-7 shrink-0 cursor-pointer gap-1.5 border-gold-border bg-accent/55 text-[11px] font-bold text-primary shadow-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                    >
                      {isGeneratingAiCaptions ? (
                        <Loader2
                          className="size-3 animate-spin text-gold-text motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <Sparkles
                          className="size-3 text-gold-text"
                          aria-hidden="true"
                        />
                      )}
                      <span>AI Generate All 5 Platform Captions</span>
                    </Button>
                  </div>

                  {/* Platform Tabs Bar */}
                  <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-1">
                    {[
                      {
                        id: "global" as const,
                        label: "Global Default",
                        icon: Globe,
                      },
                      {
                        id: "instagram" as const,
                        label: "Instagram",
                        icon: Camera,
                      },
                      {
                        id: "facebook" as const,
                        label: "Facebook",
                        icon: Share2,
                      },
                      { id: "tiktok" as const, label: "TikTok", icon: Film },
                      {
                        id: "youtube" as const,
                        label: "YouTube",
                        icon: Play,
                      },
                      {
                        id: "gmb" as const,
                        label: "Google Biz",
                        icon: MapPin,
                      },
                    ].map((tab) => {
                      const TabIcon = tab.icon
                      const isActive = activeCaptionTab === tab.id
                      const hasOverride =
                        tab.id !== "global" &&
                        Boolean(platformCaptions[tab.id]?.caption?.trim())

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveCaptionTab(tab.id)}
                          className={cn(
                            "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-secondary text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <TabIcon
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{tab.label}</span>
                          {hasOverride && (
                            <span
                              className="size-1.5 rounded-full bg-gold"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {activeCaptionTab === "global" ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            Primary default copy applied to channels without
                            custom overrides
                          </span>
                          <span className="font-mono tabular-nums">
                            {caption.length} / 63,206
                          </span>
                        </div>
                        <Textarea
                          rows={5}
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          placeholder="Write global caption with #AlRamlahTravels, contact lines and package overview…"
                          className="bg-background font-mono text-xs leading-relaxed"
                        />
                      </div>

                      {postFormat !== "STORY" && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1 font-semibold text-foreground">
                              <MessageSquare
                                className="size-3 text-gold-text"
                                aria-hidden="true"
                              />
                              <span>
                                Global First Comment (IG, FB &amp; YT)
                              </span>
                            </span>
                            <button
                              type="button"
                              disabled={isGeneratingFirstComment}
                              onClick={handleGenerateFirstComment}
                              className="inline-flex min-h-6 cursor-pointer items-center px-1 text-[11px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              {isGeneratingFirstComment
                                ? "Generating…"
                                : "Auto-Generate ART CTA"}
                            </button>
                          </div>
                          <Textarea
                            rows={2}
                            value={firstComment}
                            onChange={(e) => setFirstComment(e.target.value)}
                            placeholder="Optional pinned first comment with ART WhatsApp booking link…"
                            className="bg-background font-mono text-xs leading-relaxed"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            Custom {PLATFORM_DISPLAY_NAMES[activeCaptionTab]}{" "}
                            override{" "}
                            {!platformCaptions[activeCaptionTab]?.caption &&
                              "(inheriting Global Default)"}
                          </span>
                          <div className="flex items-center gap-2">
                            {platformCaptions[activeCaptionTab]?.caption && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPlatformCaptions((prev) => {
                                    const next = { ...prev }
                                    delete next[activeCaptionTab]
                                    return next
                                  })
                                }
                                className="cursor-pointer text-[11px] text-status-danger hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                Reset to Global
                              </button>
                            )}
                            <span className="tabular-nums">
                              <span className="font-mono font-medium">
                                {
                                  (
                                    platformCaptions[activeCaptionTab]
                                      ?.caption || caption
                                  ).length
                                }
                              </span>{" "}
                              chars
                            </span>
                          </div>
                        </div>
                        <Textarea
                          rows={5}
                          value={
                            platformCaptions[activeCaptionTab]?.caption !==
                            undefined
                              ? platformCaptions[activeCaptionTab]?.caption
                              : caption
                          }
                          onChange={(e) => {
                            const val = e.target.value
                            setPlatformCaptions((prev) => ({
                              ...prev,
                              [activeCaptionTab]: {
                                ...prev[activeCaptionTab],
                                caption: val,
                              },
                            }))
                          }}
                          placeholder={`Custom ${PLATFORM_DISPLAY_NAMES[activeCaptionTab]} caption…`}
                          className="bg-background font-mono text-xs leading-relaxed"
                        />
                      </div>

                      {["instagram", "facebook", "youtube"].includes(
                        activeCaptionTab
                      ) && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1 font-semibold text-foreground">
                              <MessageSquare
                                className="size-3 text-gold-text"
                                aria-hidden="true"
                              />
                              <span>
                                {PLATFORM_DISPLAY_NAMES[activeCaptionTab]}{" "}
                                Pinned First Comment
                              </span>
                            </span>
                            <span className="tabular-nums">
                              <span className="font-mono font-medium">
                                {
                                  (
                                    platformCaptions[activeCaptionTab]
                                      ?.firstComment ?? firstComment
                                  ).length
                                }
                              </span>{" "}
                              chars
                            </span>
                          </div>
                          <Textarea
                            rows={2}
                            value={
                              platformCaptions[activeCaptionTab]
                                ?.firstComment !== undefined
                                ? platformCaptions[activeCaptionTab]
                                    ?.firstComment
                                : firstComment
                            }
                            onChange={(e) => {
                              const val = e.target.value
                              setPlatformCaptions((prev) => ({
                                ...prev,
                                [activeCaptionTab]: {
                                  ...prev[activeCaptionTab],
                                  firstComment: val,
                                },
                              }))
                            }}
                            placeholder={`Custom ${PLATFORM_DISPLAY_NAMES[activeCaptionTab]} first comment…`}
                            className="bg-background font-mono text-xs leading-relaxed"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Multi-Account Target Social Channels (`T-069`, `T-071`, `OD-07`, `OD-11`) */}
                <div className="space-y-2 border-t border-border pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      3. Target Social Accounts
                    </Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const eligible = activeIntegrations.filter((i) => {
                            if (i.provider === "youtube" && !isVideoMedia)
                              return false
                            if (i.provider === "gmb" && !gbpApiApproved)
                              return false
                            return true
                          })
                          setSelectedTargetIds(eligible.map((i) => i.id))
                        }}
                        className="inline-flex min-h-6 cursor-pointer items-center px-1 text-[11px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Select Eligible
                      </button>
                      <span className="h-3 w-px bg-border" aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => setSelectedTargetIds([])}
                        className="inline-flex min-h-6 cursor-pointer items-center px-1 text-[11px] font-medium text-muted-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {activeIntegrations.length === 0 ? (
                    <div className="flex items-start gap-2.5 rounded-xl border border-status-warning-border bg-status-warning-bg p-3 text-xs text-status-warning">
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0 text-status-warning"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-bold">
                          No Social Channels Connected Yet
                        </p>
                        {userRole === "super_admin" ? (
                          <p className="mt-0.5 text-[11px] text-status-warning">
                            Link Instagram, Facebook Pages, TikTok, YouTube, or
                            Google Business in{" "}
                            <a
                              href="/admin/settings?tab=social"
                              className="inline-flex items-center gap-1 font-bold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <span>Settings</span>
                              <ArrowRight
                                className="size-3"
                                aria-hidden="true"
                              />
                              <span>Social OAuth</span>
                            </a>{" "}
                            to publish automatically.
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-status-warning">
                            Ask a Super Administrator to connect official OAuth
                            social channels in Settings.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {activeIntegrations.map((integration) => {
                        const platformMeta = CORE_5_PLATFORMS.find(
                          (p) => p.id === integration.provider
                        )!
                        const isYouTubeBlocked =
                          integration.provider === "youtube" && !isVideoMedia
                        const isGmbBlocked =
                          integration.provider === "gmb" && !gbpApiApproved
                        const canSelect = !isYouTubeBlocked && !isGmbBlocked
                        const isSelected =
                          canSelect &&
                          effectiveSelectedTargetIds.includes(integration.id)

                        return (
                          <label
                            key={integration.id}
                            className={cn(
                              "flex items-center justify-between rounded-lg p-2.5 text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none",
                              canSelect
                                ? "cursor-pointer"
                                : "cursor-not-allowed bg-muted/60 opacity-75",
                              isSelected
                                ? "bg-primary/10 ring-1 ring-primary"
                                : canSelect
                                  ? "bg-secondary/50 hover:bg-accent/60"
                                  : ""
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold",
                                  platformMeta.color
                                )}
                              >
                                {platformMeta.badge}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="truncate text-[11px] font-semibold text-foreground">
                                    {integration.name}
                                  </p>
                                  {isYouTubeBlocked && (
                                    <span className="rounded border border-status-warning-border bg-status-warning-bg px-1 py-0.5 text-[10px] font-medium text-status-warning">
                                      Requires Video
                                    </span>
                                  )}
                                  {isGmbBlocked && (
                                    <span className="rounded border border-status-warning-border bg-status-warning-bg px-1 py-0.5 text-[10px] font-medium text-status-warning">
                                      Google Pending
                                    </span>
                                  )}
                                  {integration.provider === "tiktok" &&
                                    !tiktokDirectPostApproved && (
                                      <span className="rounded border border-border bg-secondary px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                                        Sandbox: Self Only
                                      </span>
                                    )}
                                </div>
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {integration.handle || platformMeta.name}
                                </p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              aria-label={`Select ${integration.name}`}
                              disabled={!canSelect}
                              checked={Boolean(isSelected)}
                              onChange={() => {
                                if (canSelect) {
                                  toggleTargetIntegration(integration.id)
                                }
                              }}
                              className="size-3.5 rounded border-input accent-primary"
                            />
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* TikTok Direct Post Compliance & Privacy UX (`T-070`, `OD-11`) */}
                {selectedTikTokIntegration && (
                  <div className="space-y-3 rounded-xl bg-secondary/55 p-3.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                        <span className="font-bold text-foreground">
                          TikTok Direct Post Privacy &amp; Disclosure Controls
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-border text-[10px] font-medium text-foreground"
                      >
                        {tiktokCreatorInfo?.creatorNickname ||
                          selectedTikTokIntegration.handle ||
                          selectedTikTokIntegration.name}
                      </Badge>
                    </div>

                    {!tiktokDirectPostApproved && (
                      <p className="rounded-md border border-status-warning-border bg-status-warning-bg px-2.5 py-1.5 text-[11px] text-status-warning">
                        TikTok Direct Post audit is pending: uploads are
                        restricted to Private (Only Me) visibility until
                        approved.
                      </p>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold">
                          Who Can View This Post (Required)
                        </Label>
                        <select
                          aria-label="Who Can View This Post"
                          value={tiktokPrivacyLevel}
                          onChange={(e) =>
                            setTiktokPrivacyLevel(
                              e.target.value as TikTokPrivacyLevel | ""
                            )
                          }
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <option value="">Select TikTok privacy…</option>
                          {(
                            tiktokCreatorInfo?.privacyLevelOptions || [
                              "SELF_ONLY",
                              "MUTUAL_FOLLOW_FRIENDS",
                              "FOLLOWER_OF_CREATOR",
                              "PUBLIC_TO_EVERYONE",
                            ]
                          ).map((opt) => {
                            const locked =
                              !tiktokDirectPostApproved && opt !== "SELF_ONLY"
                            return (
                              <option key={opt} value={opt} disabled={locked}>
                                {opt === "SELF_ONLY"
                                  ? "Only Me (Private)"
                                  : opt === "PUBLIC_TO_EVERYONE"
                                    ? "Public to Everyone"
                                    : opt.replace(/_/g, " ")}
                                {locked ? " (Requires TikTok Audit)" : ""}
                              </option>
                            )
                          })}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold">
                          Allow Viewers To
                        </Label>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <label className="inline-flex items-center gap-1.5 text-[11px]">
                            <input
                              type="checkbox"
                              disabled={Boolean(
                                tiktokCreatorInfo?.commentDisabled
                              )}
                              checked={tiktokAllowComment}
                              onChange={(e) =>
                                setTiktokAllowComment(e.target.checked)
                              }
                              className="accent-primary"
                            />
                            <span>Comment</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 text-[11px]">
                            <input
                              type="checkbox"
                              disabled={Boolean(
                                tiktokCreatorInfo?.duetDisabled || !isVideoMedia
                              )}
                              checked={tiktokAllowDuet}
                              onChange={(e) =>
                                setTiktokAllowDuet(e.target.checked)
                              }
                              className="accent-primary"
                            />
                            <span>Duet</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 text-[11px]">
                            <input
                              type="checkbox"
                              disabled={Boolean(
                                tiktokCreatorInfo?.stitchDisabled ||
                                !isVideoMedia
                              )}
                              checked={tiktokAllowStitch}
                              onChange={(e) =>
                                setTiktokAllowStitch(e.target.checked)
                              }
                              className="accent-primary"
                            />
                            <span>Stitch</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-border pt-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={tiktokCommercialToggle}
                          onChange={(e) =>
                            setTiktokCommercialToggle(e.target.checked)
                          }
                          className="accent-primary"
                        />
                        <span>
                          Disclose Commercial Content (Promotional / Branded)
                        </span>
                      </label>

                      {tiktokCommercialToggle && (
                        <div className="flex flex-wrap items-center gap-4 pl-5 text-[11px]">
                          <label className="inline-flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={tiktokBrandOrganic}
                              onChange={(e) =>
                                setTiktokBrandOrganic(e.target.checked)
                              }
                              className="accent-primary"
                            />
                            <span>Your Brand (Al Ramlah Travels)</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              disabled={tiktokPrivacyLevel === "SELF_ONLY"}
                              checked={tiktokBrandContent}
                              onChange={(e) =>
                                setTiktokBrandContent(e.target.checked)
                              }
                              className="accent-primary"
                            />
                            <span>Branded Content (Paid Partnership)</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Google Business Profile CTA Controls (`T-070`) */}
                {hasSelectedGmb && (
                  <div className="grid grid-cols-1 gap-3 rounded-xl bg-status-success-bg/65 p-3 text-xs sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">
                        Google Business CTA Button
                      </Label>
                      <select
                        aria-label="Google Business CTA Button"
                        value={gmbCallToActionType}
                        onChange={(e) =>
                          setGmbCallToActionType(
                            e.target.value as "BOOK" | "LEARN_MORE"
                          )
                        }
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <option value="BOOK">Book</option>
                        <option value="LEARN_MORE">Learn More</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">
                        CTA Destination URL (Optional)
                      </Label>
                      <Input
                        value={gmbCallToActionUrl}
                        onChange={(e) => setGmbCallToActionUrl(e.target.value)}
                        placeholder={`https://wa.me/${primaryWhatsappDigits}`}
                        className="h-8 bg-background font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2-Step Attention-Grabber Funnel */}
            <div className="space-y-3 rounded-xl bg-accent/45 p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2.5">
                  <Layers
                    className="size-4 text-gold-text"
                    aria-hidden="true"
                  />
                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <span>2-Step Attention-Grabber Funnel</span>
                      <Badge className="bg-gold text-[10px] font-bold text-gold-foreground">
                        Algorithmic Boost
                      </Badge>
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Hook the feed with a Single Spotlight first, then
                      auto-publish the complete Multi-Package Sheet after a
                      configurable delay.
                    </p>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-primary select-none">
                  <input
                    type="checkbox"
                    checked={isTwoStepEnabled}
                    onChange={(e) => setIsTwoStepEnabled(e.target.checked)}
                    className="size-4 rounded accent-primary"
                  />
                  <span>Enable 2-Step Funnel</span>
                </label>
              </div>

              {isTwoStepEnabled && (
                <div className="mt-3 grid grid-cols-1 gap-4 border-t border-gold-border/35 pt-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Step 2: Paired Follow-Up Sheet
                    </Label>
                    <select
                      aria-label="Step 2 Paired Follow-Up Sheet"
                      value={followUpAssetId}
                      onChange={(e) =>
                        handleSelectFollowUpAsset(e.target.value)
                      }
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {sheetAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.postCode}] {a.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center justify-between text-xs font-semibold">
                      <span>Step 2 Automated Delay</span>
                      <span className="font-mono font-bold text-primary tabular-nums">
                        {twoStepDelayMinutes} Minutes (
                        {Math.round((twoStepDelayMinutes / 60) * 10) / 10}h)
                      </span>
                    </Label>
                    <div className="flex items-center gap-1.5">
                      {[30, 60, 120, 180, 240].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setTwoStepDelayMinutes(mins)}
                          className={cn(
                            "cursor-pointer rounded border px-2 py-1 text-[10px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                            twoStepDelayMinutes === mins
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground hover:border-gold"
                          )}
                        >
                          {mins}m
                        </button>
                      ))}
                      <Input
                        type="number"
                        min={20}
                        max={1440}
                        value={twoStepDelayMinutes}
                        onChange={(e) =>
                          setTwoStepDelayMinutes(Number(e.target.value) || 180)
                        }
                        className="ml-auto h-7 w-20 bg-background font-mono text-xs tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reactive Engagement Auto-Plug Card (`T-036`) */}
            <div className="space-y-3 rounded-xl bg-secondary/50 p-3.5">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <Sparkles
                    className="size-4 text-gold-text"
                    aria-hidden="true"
                  />
                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <span>Reactive Engagement Auto-Plug</span>
                      <Badge className="bg-primary text-[10px] font-semibold text-primary-foreground">
                        Verified Live Metrics Only
                      </Badge>
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Posts a single idempotent WhatsApp booking CTA comment on
                      Instagram, Facebook, or YouTube only after verified live
                      API metrics cross your threshold.
                    </p>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-primary select-none">
                  <input
                    type="checkbox"
                    checked={isEngagementPlugEnabled}
                    onChange={(e) =>
                      setIsEngagementPlugEnabled(e.target.checked)
                    }
                    className="size-4 rounded accent-primary"
                  />
                  <span>Enable Auto-Plug</span>
                </label>
              </div>

              {isEngagementPlugEnabled && (
                <div className="space-y-3 border-t border-border pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Min Verified Likes Threshold
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={engagementMinLikes}
                        onChange={(e) =>
                          setEngagementMinLikes(Number(e.target.value) || 25)
                        }
                        className="h-7 bg-background font-mono text-xs tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Min Verified Views Threshold
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={engagementMinViews}
                        onChange={(e) =>
                          setEngagementMinViews(Number(e.target.value) || 500)
                        }
                        className="h-7 bg-background font-mono text-xs tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Urgency Auto-Comment Copy
                    </Label>
                    <Textarea
                      rows={2}
                      value={engagementPlugText}
                      onChange={(e) => setEngagementPlugText(e.target.value)}
                      className="bg-background font-mono text-xs leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Embedded Live Core 5 Interactive Device Previewer */}
            <div className="border-t border-border pt-2">
              <SocialPlatformPreview
                caption={currentTabCaption}
                title={selectedAsset?.title}
                postType={postFormat}
                postFormat={postFormat}
                onPostTypeChange={(fmt) => setPostFormat(fmt)}
                publishMode={
                  isTwoStepEnabled ? "SPOTLIGHT_THEN_SHEET" : "SINGLE"
                }
                mediaUrls={mediaUrls}
                spotlightMediaUrl={
                  preferredAssetMediaUrl || selectedAsset?.imageUrl || null
                }
                sheetMediaUrl={followUpAsset?.imageUrl || null}
                postCode={
                  matchedComposerPackage?.postCode ||
                  selectedAsset?.postCode ||
                  "ART-UMRAH-01"
                }
                packageTitle={selectedAsset?.title}
                sharingPricePkr={matchedComposerPackage?.retailSharingPkr}
                quadPricePkr={matchedComposerPackage?.retailQuadPkr}
                triplePricePkr={matchedComposerPackage?.retailTriplePkr}
                doublePricePkr={matchedComposerPackage?.retailDoublePkr}
                makkahHotelName={matchedComposerPackage?.makkahHotelName}
                madinahHotelName={matchedComposerPackage?.madinahHotelName}
                autoFirstComment={Boolean(
                  currentTabFirstComment.trim() || selectedAsset
                )}
                firstComment={currentTabFirstComment}
                whatsappNumber={primaryWhatsappDigits}
                officeLocationLabel={officeLocationLabel}
                selectedProviders={selectedProvidersForPreview}
                connectedAccounts={activeIntegrations.map((i) => ({
                  provider: i.provider,
                  name: i.name,
                  handle: i.handle,
                  avatarUrl: i.avatarUrl,
                }))}
              />
            </div>

            {/* Publication Timing & Submit Bar (`T-089` PKT-locked) */}
            <div className="flex flex-col justify-between gap-4 border-t border-border pt-4 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium">
                    <input
                      type="radio"
                      name="pubTiming"
                      checked={publishNow}
                      onChange={() => setPublishNow(true)}
                      className="accent-primary"
                    />
                    <span>Publish Immediately</span>
                  </label>
                  <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-xs font-medium">
                    <input
                      type="radio"
                      name="pubTiming"
                      checked={!publishNow}
                      onChange={() => setPublishNow(false)}
                      className="accent-primary"
                    />
                    <span>Schedule for Later (PKT)</span>
                  </label>
                </div>

                {!publishNow && (
                  <div className="flex items-center gap-2">
                    <Calendar
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="h-8 w-48 bg-background font-mono text-xs"
                    />
                    <Badge
                      variant="outline"
                      className="border-gold-border font-mono text-[10px] text-primary"
                    >
                      PKT +05:00
                    </Badge>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isQueueingNextSlot}
                  onClick={handleQueueNextFreeSlot}
                  className="h-8 cursor-pointer gap-1.5 border-gold-border text-xs font-bold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  {isQueueingNextSlot ? (
                    <Loader2
                      className="size-3 animate-spin text-gold-text motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Clock
                      className="size-3 text-gold-text"
                      aria-hidden="true"
                    />
                  )}
                  <span>Queue in Next Free PKT Slot</span>
                </Button>
              </div>

              <Button
                type="submit"
                disabled={
                  isSubmitting || effectiveSelectedTargetIds.length === 0
                }
                className="shrink-0 cursor-pointer gap-2 bg-primary text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {isSubmitting ? (
                  <Loader2
                    className="size-4 animate-spin text-gold motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Send className="size-4 text-gold" aria-hidden="true" />
                )}
                <span>
                  {publishNow
                    ? `Publish ${FORMAT_DISPLAY_NAMES[postFormat]} Immediately (${effectiveSelectedTargetIds.length} Account${effectiveSelectedTargetIds.length === 1 ? "" : "s"})`
                    : `Schedule ${FORMAT_DISPLAY_NAMES[postFormat]} (${effectiveSelectedTargetIds.length} Account${effectiveSelectedTargetIds.length === 1 ? "" : "s"})`}
                </span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Live Scheduled & Published Queue / Visual PKT Calendar */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="border-b border-border pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-display text-base font-bold">
                <Calendar className="size-4 text-primary" aria-hidden="true" />
                <span>
                  {activeSocialSubView === "calendar"
                    ? "PKT Social Publishing Calendar"
                    : `Scheduled & Published Queue (${totalScheduledPosts})`}
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                {activeSocialSubView === "calendar"
                  ? "Interactive visual calendar in Asia/Karachi (UTC+5) with peak Umrah slots (11 AM, 4 PM, 9 PM) and 1-click rescheduling."
                  : "Monitor live post state across accounts, preview across Core 5 devices, or inspect verified per-platform engagement analytics."}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-border bg-secondary p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveSocialSubView("calendar")}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                    activeSocialSubView === "calendar"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Visual Calendar (PKT)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSocialSubView("queue")}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                    activeSocialSubView === "queue"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  List Queue
                </button>
              </div>

              {activeSocialSubView === "queue" && (
                <div className="flex items-center gap-1 overflow-x-auto">
                  {[
                    { id: "all", label: "All" },
                    { id: "scheduled", label: "Scheduled" },
                    { id: "publishing", label: "Publishing" },
                    { id: "completed", label: "Published" },
                    { id: "failed", label: "Failed" },
                    { id: "cancelled", label: "Cancelled" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setQueueFilter(f.id)}
                      className={cn(
                        "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                        queueFilter === f.id
                          ? "bg-primary font-bold text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-4">
          {activeSocialSubView === "calendar" ? (
            <SocialCalendarView
              scheduledPosts={scheduledPosts}
              initialNowMs={initialNowMs}
              onSelectSlot={(dateKey, slot) => {
                const newUtc = parsePktSlotToUtc(dateKey, slot)
                setScheduledDateTime(formatPktDateTimeLocal(newUtc))
                setPublishNow(false)
                setComposerNotice({
                  type: "success",
                  message: `Pre-filled composer for ${dateKey} at ${slot} PKT. Customize your post and click Schedule!`,
                })
                window.scrollTo({ top: 300, behavior: "smooth" })
              }}
              onSelectPost={(post) => setPreviewModalPost(post)}
              onRefresh={() => router.refresh()}
            />
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              No posts found matching the filter &quot;{queueFilter}&quot;.
            </div>
          ) : (
            filteredPosts.map((post) => {
              const isBusy = busyActionId === post.id
              const isSyncingAnalytics = syncingAnalyticsPostId === post.id
              const hasPublishedTargets = post.targets.some(
                (t) => t.status === "published"
              )
              const isBreakdownExpanded = expandedBreakdownPostIds.includes(
                post.id
              )

              const aggregatedMetrics = post.targets.reduce(
                (acc, t) => {
                  const data = t.analyticsData
                  if (data) {
                    acc.hasMetrics = true
                    acc.impressions += data.impressions || 0
                    acc.likes += data.likes || 0
                    acc.comments += data.comments || 0
                    acc.shares += data.shares || 0
                    acc.clicks += data.clicks || 0
                    if (
                      data.lastSyncedAt &&
                      (!acc.lastSyncedAt ||
                        data.lastSyncedAt > acc.lastSyncedAt)
                    ) {
                      acc.lastSyncedAt = data.lastSyncedAt
                    }
                  } else if (t.status === "published") {
                    acc.unavailableCount += 1
                  }
                  if (t.firstCommentExternalId || data?.firstCommentId) {
                    acc.firstCommentCount += 1
                  }
                  return acc
                },
                {
                  hasMetrics: false,
                  unavailableCount: 0,
                  impressions: 0,
                  likes: 0,
                  comments: 0,
                  shares: 0,
                  clicks: 0,
                  firstCommentCount: 0,
                  lastSyncedAt: null as string | null,
                }
              )

              const postEngagementRatePct = computeEngagementRate({
                views: aggregatedMetrics.impressions,
                likes: aggregatedMetrics.likes,
                comments: aggregatedMetrics.comments,
                shares: aggregatedMetrics.shares,
                clicks: aggregatedMetrics.clicks,
              })

              const postThumbUrl =
                post.postAsset?.imageUrl || post.mediaUrls[0] || ""
              const postThumbImageUrl =
                getRenderableImagePreviewUrl(postThumbUrl)

              return (
                <div
                  key={post.id}
                  className="space-y-3 rounded-xl bg-secondary/45 p-3.5 transition-colors hover:bg-secondary/65 motion-reduce:transition-none"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {postThumbImageUrl ? (
                          <Image
                            src={postThumbImageUrl}
                            alt={post.postAsset?.title || "Campaign preview"}
                            fill
                            unoptimized
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : postThumbUrl && isPdfAssetUrl(postThumbUrl) ? (
                          <div className="flex h-full w-full items-center justify-center bg-accent/60 text-primary">
                            <FileText
                              className="size-4 text-gold-text"
                              aria-hidden="true"
                            />
                          </div>
                        ) : postThumbUrl ? (
                          <div className="flex h-full w-full items-center justify-center bg-secondary text-primary">
                            <Film
                              className="size-4 text-gold-text"
                              aria-hidden="true"
                            />
                          </div>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            Post
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {post.postAsset && (
                            <span className="font-mono text-xs font-bold text-primary">
                              [{post.postAsset.postCode}]
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className="border-gold-border text-[10px] font-semibold text-primary"
                          >
                            {FORMAT_DISPLAY_NAMES[post.postFormat || "FEED"]}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium capitalize"
                          >
                            {post.campaignStage.replace(/_/g, " ")}
                          </Badge>
                          <Badge
                            className={cn(
                              "border text-[10px] font-bold capitalize",
                              post.status === "completed" &&
                                "border-status-success-border bg-status-success-bg text-status-success",
                              post.status === "scheduled" &&
                                "border-status-warning-border bg-status-warning-bg text-status-warning",
                              post.status === "publishing" &&
                                "border-status-info-border bg-status-info-bg text-status-info",
                              (post.status === "failed" ||
                                post.status === "partially_failed") &&
                                "border-status-danger-border bg-status-danger-bg text-status-danger",
                              post.status === "cancelled" &&
                                "border-border bg-secondary text-muted-foreground"
                            )}
                          >
                            {post.status.replace(/_/g, " ")}
                          </Badge>
                          {post.firstComment && (
                            <Badge
                              variant="outline"
                              className="border-status-success-border bg-status-success-bg text-[10px] font-medium text-status-success"
                            >
                              + First-Comment Link
                              {aggregatedMetrics.firstCommentCount > 0
                                ? ` (${aggregatedMetrics.firstCommentCount} Posted)`
                                : ""}
                            </Badge>
                          )}
                        </div>

                        <p className="line-clamp-2 font-mono text-xs text-foreground">
                          {post.caption}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[10px] text-muted-foreground tabular-nums">
                          <span>
                            Scheduled (PKT): {formatDateSafe(post.scheduledFor)}
                          </span>
                          {post.twoStepDelayMinutes && (
                            <span>Delay: {post.twoStepDelayMinutes}m</span>
                          )}
                          {aggregatedMetrics.lastSyncedAt && (
                            <span>
                              Synced:{" "}
                              {formatDateSafe(aggregatedMetrics.lastSyncedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewModalPost(post)}
                        className="h-7 cursor-pointer gap-1 border-border text-[11px] font-semibold text-foreground transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                      >
                        <Smartphone
                          className="size-3 text-gold-text"
                          aria-hidden="true"
                        />
                        <span>Preview</span>
                      </Button>

                      {(hasPublishedTargets || post.status === "completed") && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isSyncingAnalytics}
                          onClick={() => handleSyncPostAnalytics(post.id)}
                          className="h-7 cursor-pointer gap-1 border-gold-border text-[11px] font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                        >
                          {isSyncingAnalytics ? (
                            <Loader2
                              className="size-3 animate-spin text-gold-text motion-reduce:animate-none"
                              aria-hidden="true"
                            />
                          ) : (
                            <BarChart3
                              className="size-3 text-gold-text"
                              aria-hidden="true"
                            />
                          )}
                          <span>Sync Metrics</span>
                        </Button>
                      )}

                      {(post.status === "scheduled" ||
                        post.status === "draft") && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleCancelPost(post.id)}
                          className="h-7 cursor-pointer border-status-danger-border text-[11px] text-status-danger transition-colors hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                        >
                          {isBusy ? (
                            <Loader2
                              className="mr-1 size-3 animate-spin motion-reduce:animate-none"
                              aria-hidden="true"
                            />
                          ) : (
                            <X className="mr-1 size-3" aria-hidden="true" />
                          )}
                          Cancel Post
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Honest Analytics Strip (`T-036`) */}
                  {(aggregatedMetrics.hasMetrics || hasPublishedTargets) && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/85 px-3 py-2 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                          <BarChart3
                            className="size-3.5 text-gold-text"
                            aria-hidden="true"
                          />
                          <span>Live Engagement Metrics:</span>
                          {aggregatedMetrics.hasMetrics ? (
                            <Badge
                              variant="outline"
                              className="border-gold-border text-[10px] font-medium text-primary tabular-nums"
                            >
                              <span className="font-mono font-semibold">
                                {postEngagementRatePct.toFixed(2)}%
                              </span>{" "}
                              Eng. Rate
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-status-warning-border bg-status-warning-bg text-[10px] font-medium text-status-warning"
                            >
                              Analytics unavailable. Click Sync Metrics
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
                          {aggregatedMetrics.hasMetrics && (
                            <>
                              <span className="inline-flex items-center gap-1 rounded bg-secondary/60 px-2 py-0.5">
                                <Eye
                                  className="size-3 text-primary"
                                  aria-hidden="true"
                                />
                                <span>Views:</span>
                                <strong className="font-mono">
                                  {aggregatedMetrics.impressions.toLocaleString()}
                                </strong>
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-secondary/60 px-2 py-0.5">
                                <Heart
                                  className="size-3 text-status-danger"
                                  aria-hidden="true"
                                />
                                <span>Likes:</span>
                                <strong className="font-mono">
                                  {aggregatedMetrics.likes.toLocaleString()}
                                </strong>
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-secondary/60 px-2 py-0.5">
                                <MessageSquare
                                  className="size-3 text-status-info"
                                  aria-hidden="true"
                                />
                                <span>Comments:</span>
                                <strong className="font-mono">
                                  {aggregatedMetrics.comments.toLocaleString()}
                                </strong>
                              </span>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleBreakdownExpand(post.id)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                          >
                            <span>
                              {isBreakdownExpanded
                                ? "Hide Breakdown"
                                : "Per-Platform Breakdown"}
                            </span>
                            {isBreakdownExpanded ? (
                              <ChevronUp
                                className="size-3 text-gold"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronDown
                                className="size-3 text-gold"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </div>
                      </div>

                      {isBreakdownExpanded && (
                        <div className="space-y-2 rounded-xl bg-accent/45 p-3">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {post.targets.map((target) => {
                              const data = target.analyticsData
                              if (!data) {
                                return (
                                  <div
                                    key={target.id}
                                    className="space-y-1.5 rounded-lg bg-background p-2.5 text-[11px]"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <Badge
                                        variant="outline"
                                        className="border-primary/30 text-[10px] font-semibold text-primary"
                                      >
                                        {
                                          PLATFORM_DISPLAY_NAMES[
                                            target.integration.provider
                                          ]
                                        }
                                      </Badge>
                                      <span className="text-[10px] font-medium text-status-warning">
                                        Unavailable
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                      Live provider metrics not yet synced for{" "}
                                      {target.integration.name}.
                                    </p>
                                  </div>
                                )
                              }

                              const views = data.impressions ?? 0
                              const likes = data.likes ?? 0
                              const comments = data.comments ?? 0
                              const shares = data.shares ?? 0
                              const clicks = data.clicks ?? 0
                              const ratePct = computeEngagementRate({
                                views,
                                likes,
                                comments,
                                shares,
                                clicks,
                              })

                              return (
                                <div
                                  key={target.id}
                                  className="space-y-2 rounded-lg bg-background p-2.5 text-[11px]"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <Badge
                                        variant="outline"
                                        className="border-primary/30 text-[10px] font-semibold text-primary"
                                      >
                                        {
                                          PLATFORM_DISPLAY_NAMES[
                                            target.integration.provider
                                          ]
                                        }
                                      </Badge>
                                      <span className="truncate font-semibold text-foreground">
                                        {target.integration.name}
                                      </span>
                                    </div>
                                    <span className="font-mono text-[10px] font-bold text-primary tabular-nums">
                                      {ratePct.toFixed(2)}%
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-5 gap-1 rounded bg-secondary/45 p-1.5 text-center text-[10px] tabular-nums">
                                    <div>
                                      <p className="text-[9px] text-muted-foreground">
                                        Views
                                      </p>
                                      <p className="font-mono font-bold">
                                        {views.toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-muted-foreground">
                                        Likes
                                      </p>
                                      <p className="font-mono font-bold">
                                        {likes.toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-muted-foreground">
                                        Cmts
                                      </p>
                                      <p className="font-mono font-bold">
                                        {comments.toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-muted-foreground">
                                        Shares
                                      </p>
                                      <p className="font-mono font-bold">
                                        {shares.toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-muted-foreground">
                                        Clicks
                                      </p>
                                      <p className="font-mono font-bold">
                                        {clicks.toLocaleString()}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <Progress
                                      value={Math.min(
                                        100,
                                        Math.round(ratePct * 5)
                                      )}
                                      className="h-1.5 bg-secondary"
                                    />
                                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                                      <span>
                                        {data.lastSyncedAt
                                          ? `Synced ${formatDateSafe(data.lastSyncedAt)}`
                                          : "Not synced yet"}
                                      </span>
                                      {target.publishedUrl && (
                                        <a
                                          href={target.publishedUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                        >
                                          <span>Open Post</span>
                                          <ExternalLink
                                            className="size-2.5"
                                            aria-hidden="true"
                                          />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Targets Status Strip */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      Channel Targets ({post.targets.length}):
                    </span>
                    {post.targets.map((target) => {
                      const isTargetBusy = busyActionId === target.id
                      const targetAnalytics = target.analyticsData
                      return (
                        <div
                          key={target.id}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px]",
                            target.status === "published" &&
                              "border-status-success-border bg-status-success-bg text-status-success",
                            target.status === "pending" &&
                              "border-status-warning-border bg-status-warning-bg text-status-warning",
                            target.status === "publishing" &&
                              "border-status-info-border bg-status-info-bg text-status-info",
                            target.status === "failed" &&
                              "border-status-danger-border bg-status-danger-bg text-status-danger",
                            target.status === "skipped" &&
                              "border-border bg-secondary text-muted-foreground"
                          )}
                        >
                          <span className="text-[10px] font-bold">
                            {
                              PLATFORM_DISPLAY_NAMES[
                                target.integration.provider
                              ]
                            }
                          </span>
                          <span className="text-[10px] capitalize">
                            {target.status}
                          </span>

                          {targetAnalytics && (
                            <span className="inline-flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-status-success tabular-nums">
                              <span>
                                <span className="font-mono">
                                  {targetAnalytics.impressions}
                                </span>{" "}
                                views
                              </span>
                              <span className="inline-flex items-center gap-0.5 font-mono">
                                {targetAnalytics.likes}
                                <Heart
                                  className="size-2.5 text-status-danger"
                                  aria-hidden="true"
                                />
                              </span>
                            </span>
                          )}

                          {(target.firstCommentExternalId ||
                            targetAnalytics?.firstCommentId) && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-primary"
                              title="First-Comment Auto-Plug Posted"
                            >
                              <Check className="size-2.5" aria-hidden="true" />
                              <span>1st Comment</span>
                            </span>
                          )}

                          {target.publishedUrl && (
                            <a
                              href={target.publishedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open published ${PLATFORM_DISPLAY_NAMES[target.integration.provider]} post`}
                              className="text-status-success hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <ExternalLink
                                className="size-3"
                                aria-hidden="true"
                              />
                            </a>
                          )}

                          {target.status === "failed" && (
                            <button
                              type="button"
                              disabled={isTargetBusy}
                              onClick={() => handleRetryTarget(target.id)}
                              className="ml-1 inline-flex cursor-pointer items-center gap-1 font-bold text-status-danger hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              {isTargetBusy ? (
                                <Loader2
                                  className="size-3 animate-spin motion-reduce:animate-none"
                                  aria-hidden="true"
                                />
                              ) : (
                                <RefreshCw
                                  className="size-3"
                                  aria-hidden="true"
                                />
                              )}
                              Retry
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}

          {/* Pagination Bar for Scheduled Posts (`T-071`) */}
          {totalPostsPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="tabular-nums">
                Page {postsPage} of {totalPostsPages} ({totalScheduledPosts}{" "}
                total posts)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={postsPage <= 1}
                  onClick={() => onPostsPageChange(postsPage - 1)}
                  className="h-7 cursor-pointer gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={postsPage >= totalPostsPages}
                  onClick={() => onPostsPageChange(postsPage + 1)}
                  className="h-7 cursor-pointer gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Next
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue Post Device Preview Modal */}
      <Dialog
        open={Boolean(previewModalPost)}
        onOpenChange={(open) => {
          if (!open) setPreviewModalPost(null)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-base font-bold">
              <Smartphone
                className="size-4 text-gold-text"
                aria-hidden="true"
              />
              <span>
                Core 5 Platform Preview{" "}
                {previewModalPost?.postAsset
                  ? `(${previewModalPost.postAsset.postCode})`
                  : ""}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Inspect how this scheduled/published post renders across
              Instagram, Facebook, TikTok, YouTube Shorts, and Google Business
              Profile.
            </DialogDescription>
          </DialogHeader>

          {previewModalPost && (
            <SocialPlatformPreview
              caption={previewModalPost.caption}
              title={previewModalPost.postAsset?.title}
              postType={previewModalPost.postFormat || "FEED"}
              postFormat={previewModalPost.postFormat || "FEED"}
              publishMode={
                previewModalPost.campaignStage === "step_1_spotlight_hook"
                  ? "SPOTLIGHT_THEN_SHEET"
                  : "SINGLE"
              }
              mediaUrls={
                previewModalPost.socialJpegUrls?.length > 0
                  ? previewModalPost.socialJpegUrls
                  : previewModalPost.mediaUrls
              }
              spotlightMediaUrl={
                previewModalPost.postAsset?.imageUrl ||
                previewModalPost.mediaUrls[0] ||
                null
              }
              postCode={previewModalPost.postAsset?.postCode || "ART-UMRAH-01"}
              autoFirstComment={Boolean(previewModalPost.firstComment)}
              firstComment={previewModalPost.firstComment}
              whatsappNumber={primaryWhatsappDigits}
              officeLocationLabel={officeLocationLabel}
              selectedProviders={previewModalPost.targets.map(
                (t) => t.integration.provider
              )}
              connectedAccounts={activeIntegrations.map((i) => ({
                provider: i.provider,
                name: i.name,
                handle: i.handle,
                avatarUrl: i.avatarUrl,
              }))}
            />
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewModalPost(null)}
              className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Studio Composer Modal */}
      <Dialog open={isComposerModalOpen} onOpenChange={setIsComposerModalOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-base font-bold">
              <Sparkles className="size-4 text-gold-text" aria-hidden="true" />
              <span>
                Core 5 Split Studio Composer &amp; Live Device Previewer
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Edit your caption, toggle Feed / Reel / Story format, or switch
              2-step Spotlight mode on the left and watch all 5 platform mockups
              update live on the right.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  Linked 4K Poster Asset
                </Label>
                <select
                  aria-label="Linked 4K Poster Asset"
                  value={selectedAssetId}
                  onChange={(e) => handleSelectComposerAsset(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {postAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.postCode}] {a.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  Post Caption &amp; Hashtags
                </Label>
                <Textarea
                  rows={6}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="bg-background font-mono text-xs"
                />
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-lg bg-accent/50 p-3">
                <span className="text-xs font-bold text-foreground">
                  2-Step Funnel Mode (Spotlight then Sheet)
                </span>
                <input
                  type="checkbox"
                  checked={isTwoStepEnabled}
                  onChange={(e) => setIsTwoStepEnabled(e.target.checked)}
                  className="size-4 accent-primary"
                />
              </label>

              {postFormat !== "STORY" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">
                      Pinned First Comment
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleGenerateFirstComment}
                      className="h-6 cursor-pointer text-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Auto-Generate CTA
                    </Button>
                  </div>
                  <Textarea
                    rows={3}
                    value={firstComment}
                    onChange={(e) => setFirstComment(e.target.value)}
                    className="bg-background font-mono text-xs"
                  />
                </div>
              )}
            </div>

            <SocialPlatformPreview
              caption={caption}
              title={selectedAsset?.title}
              postType={postFormat}
              postFormat={postFormat}
              onPostTypeChange={(fmt) => setPostFormat(fmt)}
              publishMode={isTwoStepEnabled ? "SPOTLIGHT_THEN_SHEET" : "SINGLE"}
              mediaUrls={mediaUrls}
              spotlightMediaUrl={
                preferredAssetMediaUrl || selectedAsset?.imageUrl || null
              }
              sheetMediaUrl={followUpAsset?.imageUrl || null}
              postCode={
                matchedComposerPackage?.postCode ||
                selectedAsset?.postCode ||
                "ART-UMRAH-01"
              }
              packageTitle={selectedAsset?.title}
              sharingPricePkr={matchedComposerPackage?.retailSharingPkr}
              quadPricePkr={matchedComposerPackage?.retailQuadPkr}
              triplePricePkr={matchedComposerPackage?.retailTriplePkr}
              doublePricePkr={matchedComposerPackage?.retailDoublePkr}
              makkahHotelName={matchedComposerPackage?.makkahHotelName}
              madinahHotelName={matchedComposerPackage?.madinahHotelName}
              autoFirstComment={Boolean(firstComment.trim() || selectedAsset)}
              firstComment={firstComment}
              whatsappNumber={primaryWhatsappDigits}
              officeLocationLabel={officeLocationLabel}
              selectedProviders={selectedProvidersForPreview}
              connectedAccounts={activeIntegrations.map((i) => ({
                provider: i.provider,
                name: i.name,
                handle: i.handle,
                avatarUrl: i.avatarUrl,
              }))}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsComposerModalOpen(false)}
              className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Studio Media Picker Modal */}
      <StudioMediaPickerModal
        isOpen={isStudioPickerOpen}
        onClose={() => setIsStudioPickerOpen(false)}
        onSelectAsset={(asset) => {
          handleSelectComposerAsset(asset.id, asset.imageUrl)
        }}
        currentAssetId={selectedAssetId}
      />
    </div>
  )
}

// ==========================================
// 4. TAB 2: 100% BAN-SAFE MANUAL ASSISTED WHATSAPP QUEUE (`OD-01`, `T-071`)
// ==========================================

function WhatsAppQueueTab({
  initialAssetId,
  initialNowMs,
  postAssets,
  marketingChannels,
  dailyDistributions,
}: {
  initialAssetId: string
  initialNowMs?: number
  postAssets: PostAssetRecord[]
  marketingChannels: MarketingChannelRecord[]
  dailyDistributions: DistributionRecord[]
}) {
  const router = useRouter()

  const [todayPktKey] = React.useState<string>(() =>
    formatPktDateKey(new Date(initialNowMs ?? Date.now()))
  )
  const [selectedDate, setSelectedDate] = React.useState(todayPktKey)

  const [selectedAssetId, setSelectedAssetId] = React.useState<string>(() => {
    if (initialAssetId && postAssets.some((a) => a.id === initialAssetId)) {
      return initialAssetId
    }
    return postAssets[0]?.id || ""
  })

  const selectedAsset = React.useMemo(
    () => postAssets.find((a) => a.id === selectedAssetId),
    [postAssets, selectedAssetId]
  )

  const [whatsappCaption, setWhatsappCaption] = React.useState<string>(() => {
    return selectedAsset?.captionWhatsapp || ""
  })

  const handleSelectWhatsappAsset = (nextAssetId: string) => {
    setSelectedAssetId(nextAssetId)
    const nextAsset = postAssets.find((a) => a.id === nextAssetId)
    if (nextAsset?.captionWhatsapp) {
      setWhatsappCaption(nextAsset.captionWhatsapp)
    }
  }

  const [areaFilter, setAreaFilter] = React.useState("all")
  const [selectedLineFilter, setSelectedLineFilter] = React.useState("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedChannelIds, setSelectedChannelIds] = React.useState<string[]>(
    []
  )
  const [isBulkLogging, setIsBulkLogging] = React.useState(false)

  const [copiedCaption, setCopiedCaption] = React.useState(false)
  const [busyChannelId, setBusyChannelId] = React.useState<string | null>(null)
  const [actionNotice, setActionNotice] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [previewPosterUrl, setPreviewPosterUrl] = React.useState<string | null>(
    null
  )

  const distributionsToday = React.useMemo(() => {
    return dailyDistributions.filter((d) => d.scheduledDate === selectedDate)
  }, [dailyDistributions, selectedDate])

  // Strict WhatsApp channel filter + honest shared vs failed status summary (`T-071`, `OD-01`)
  const queueSummary = React.useMemo(
    () => summarizeWhatsappQueueStatus(marketingChannels, distributionsToday),
    [marketingChannels, distributionsToday]
  )

  const {
    whatsappChannels,
    sharedChannelIds,
    failedChannelIds,
    queuedChannelIds,
    totalActiveChannels,
    sharedCountToday,
    failedCountToday,
  } = queueSummary

  const progressPercent =
    totalActiveChannels > 0
      ? Math.round((sharedCountToday / totalActiveChannels) * 100)
      : 0

  const distinctPhoneLines = React.useMemo(() => {
    const lines = new Set<string>()
    for (const c of whatsappChannels) {
      if (c.senderWhatsappNumber) {
        lines.add(c.senderWhatsappNumber)
      }
    }
    return Array.from(lines)
  }, [whatsappChannels])

  const filteredChannels = React.useMemo(() => {
    return whatsappChannels.filter((c) => {
      if (selectedLineFilter !== "all") {
        if (c.senderWhatsappNumber !== selectedLineFilter) return false
      }
      if (areaFilter !== "all") {
        if (areaFilter === "Status") {
          if (c.platform !== "whatsapp_status") return false
        } else if (c.areaTag.toLowerCase() !== areaFilter.toLowerCase()) {
          return false
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          c.areaTag.toLowerCase().includes(q) ||
          (c.senderWhatsappNumber && c.senderWhatsappNumber.includes(q)) ||
          (c.externalGroupIdOrHandle &&
            c.externalGroupIdOrHandle.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [whatsappChannels, selectedLineFilter, areaFilter, searchQuery])

  const handleCopyCaption = async () => {
    if (!whatsappCaption) return
    try {
      await navigator.clipboard.writeText(whatsappCaption)
      setCopiedCaption(true)
      setTimeout(() => setCopiedCaption(false), 2500)
    } catch {
      setActionNotice({
        type: "error",
        message: "Failed to copy caption to clipboard.",
      })
    }
  }

  const handleDownloadPoster = (url?: string) => {
    const targetUrl = url || selectedAsset?.imageUrl
    if (!targetUrl) return
    const filename = `${selectedAsset?.postCode || "al-ramlah"}-poster.png`
    const link = document.createElement("a")
    link.href = targetUrl
    link.download = filename
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleToggleChannel = (channelId: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    )
  }

  const handleMarkSharedToday = async (channelId: string) => {
    if (!selectedAsset) return
    setBusyChannelId(channelId)
    setActionNotice(null)

    try {
      const res = await dispatchOrLogDistribution({
        scheduledDate: selectedDate,
        channelIds: [channelId],
        postAssetId: selectedAsset.id,
        stage: "standalone",
        captionUsed: whatsappCaption,
        dispatchMode: "manual_log",
      })

      if (res.success) {
        setActionNotice({
          type: "success",
          message: "Marked shared in today's distribution ledger.",
        })
        router.refresh()
      } else {
        setActionNotice({
          type: "error",
          message: res.error || "Failed to log distribution.",
        })
      }
    } catch (err: unknown) {
      setActionNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Error logging distribution.",
      })
    } finally {
      setBusyChannelId(null)
    }
  }

  const handleBulkMarkShared = async () => {
    if (!selectedAsset || selectedChannelIds.length === 0) return
    setIsBulkLogging(true)
    setActionNotice(null)
    try {
      const res = await dispatchOrLogDistribution({
        scheduledDate: selectedDate,
        channelIds: selectedChannelIds,
        postAssetId: selectedAsset.id,
        stage: "standalone",
        captionUsed: whatsappCaption,
        dispatchMode: "manual_log",
      })
      if (res.success) {
        setSelectedChannelIds([])
        setActionNotice({
          type: "success",
          message: `Logged ${selectedChannelIds.length} WhatsApp group/status share(s) for ${selectedDate}.`,
        })
        router.refresh()
      } else {
        setActionNotice({
          type: "error",
          message: res.error || "Failed to log selected shares.",
        })
      }
    } finally {
      setIsBulkLogging(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 100% Ban-Safe Compliance Banner (`OD-01`) */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-status-success-border bg-status-success-bg p-4 text-xs text-status-success shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0 text-status-success"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-status-success">
                100% Ban-Safe Manual Assisted WhatsApp Group &amp; Status Queue
              </h4>
              <Badge
                variant="outline"
                className="border-status-success-border bg-background text-[10px] font-semibold text-status-success"
              >
                Zero Unofficial Bot Risk
              </Badge>
              {failedCountToday > 0 && (
                <Badge className="bg-status-danger text-[10px] font-semibold text-primary-foreground">
                  {failedCountToday} Failed Dispatch
                  {failedCountToday > 1 ? "es" : ""} Need Manual Share
                </Badge>
              )}
            </div>
            <p className="max-w-3xl text-[11px] text-status-success">
              Protect official Al Ramlah WhatsApp numbers from automated group
              bans: copy the formatted caption in 1 tap, download the 4K poster,
              share via WhatsApp Web / Desktop, and log completion below.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                "https://web.whatsapp.com",
                "_blank",
                "noopener,noreferrer"
              )
            }
            className="h-8 cursor-pointer gap-1.5 border-status-success-border bg-background text-xs font-semibold text-status-success transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            <Smartphone
              className="size-3.5 text-gold-text"
              aria-hidden="true"
            />
            <span>Open WhatsApp Web</span>
          </Button>
        </div>
      </div>

      {actionNotice && (
        <div
          role="alert"
          className={cn(
            "flex items-center justify-between gap-2 rounded-xl border p-3.5 text-xs font-semibold shadow-xs",
            actionNotice.type === "success"
              ? "border-status-success-border bg-status-success-bg text-status-success"
              : "border-status-danger-border bg-status-danger-bg text-status-danger"
          )}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === "success" ? (
              <CheckCircle2
                className="size-4 shrink-0 text-status-success"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="size-4 shrink-0 text-status-danger"
                aria-hidden="true"
              />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="shrink-0 cursor-pointer text-[11px] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Active 4K Poster & 1-Tap Manual Assisted Bar */}
      <Card className="border-gold-border bg-card shadow-sm">
        <CardHeader className="border-b border-border bg-secondary/35 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-display text-base font-bold">
                <Sparkles
                  className="size-4 text-gold-text"
                  aria-hidden="true"
                />
                <span>
                  Today&apos;s Active Poster &amp; 1-Tap Assisted Share Controls
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Select today&apos;s 4K spotlight poster, copy the WhatsApp
                markdown caption, and track community group &amp; Status shares
                for {selectedDate} (PKT).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-gold-text" aria-hidden="true" />
              <Input
                type="date"
                aria-label="Distribution Date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 w-36 bg-background font-mono text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-primary">
                  Select Poster Asset to Share
                </Label>
                <select
                  aria-label="Select Poster Asset to Share"
                  value={selectedAssetId}
                  onChange={(e) => handleSelectWhatsappAsset(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {postAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.postCode}] {a.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAsset && (
                <div className="space-y-3 rounded-xl bg-secondary/45 p-3">
                  <button
                    type="button"
                    aria-label={`Preview 4K poster: ${selectedAsset.title}`}
                    onClick={() => setPreviewPosterUrl(selectedAsset.imageUrl)}
                    className="group relative block aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-lg bg-muted whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {(() => {
                      const waPosterImageUrl = getRenderableImagePreviewUrl(
                        selectedAsset.imageUrl
                      )
                      if (waPosterImageUrl) {
                        return (
                          <Image
                            src={waPosterImageUrl}
                            alt={selectedAsset.title}
                            fill
                            unoptimized
                            sizes="(max-width: 1024px) 100vw, 320px"
                            className="object-cover"
                          />
                        )
                      }
                      if (
                        selectedAsset.imageUrl &&
                        isPdfAssetUrl(selectedAsset.imageUrl)
                      ) {
                        return (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-accent/60 text-primary">
                            <FileText
                              className="size-8 text-gold-text"
                              aria-hidden="true"
                            />
                            <span className="text-xs font-semibold whitespace-nowrap">
                              PDF
                            </span>
                          </div>
                        )
                      }
                      if (selectedAsset.imageUrl) {
                        return (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-secondary text-primary">
                            <Film
                              className="size-8 text-gold-text"
                              aria-hidden="true"
                            />
                            <span className="text-xs font-semibold whitespace-nowrap">
                              Video
                            </span>
                          </div>
                        )
                      }
                      return (
                        <div className="flex h-full w-full items-center justify-center text-xs whitespace-nowrap text-muted-foreground">
                          Empty
                        </div>
                      )
                    })()}
                    <div className="absolute inset-0 flex items-center justify-center bg-sidebar/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                      <span className="rounded-md bg-background/95 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-foreground">
                        Zoom
                      </span>
                    </div>
                  </button>

                  <div className="space-y-1 text-center">
                    <p className="font-mono text-xs font-bold text-primary">
                      {selectedAsset.postCode}
                    </p>
                    <p className="truncate text-[11px] font-medium text-muted-foreground">
                      {selectedAsset.title}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 lg:col-span-8">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <span>Formatted WhatsApp Caption</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium"
                    >
                      WhatsApp Markdown Ready
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    <span className="font-mono font-medium">
                      {whatsappCaption.length}
                    </span>{" "}
                    chars
                  </span>
                </div>
                <Textarea
                  rows={7}
                  value={whatsappCaption}
                  onChange={(e) => setWhatsappCaption(e.target.value)}
                  className="bg-background font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Button
                  type="button"
                  onClick={handleCopyCaption}
                  className={cn(
                    "h-9 cursor-pointer gap-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none",
                    copiedCaption
                      ? "bg-status-success text-primary-foreground"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {copiedCaption ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5 text-gold" aria-hidden="true" />
                  )}
                  <span>
                    {copiedCaption ? "Caption Copied!" : "1-Tap Copy Caption"}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDownloadPoster()}
                  className="h-9 cursor-pointer gap-1.5 border-border text-xs font-semibold transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  <Download
                    className="size-3.5 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>1-Tap Download 4K Poster</span>
                </Button>

                {selectedChannelIds.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBulkLogging || !selectedAsset}
                    onClick={handleBulkMarkShared}
                    className="h-9 cursor-pointer gap-1.5 border-status-success-border bg-status-success-bg text-xs font-bold text-status-success transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                  >
                    {isBulkLogging ? (
                      <Loader2
                        className="size-3.5 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2
                        className="size-3.5 text-status-success"
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      Mark Selected Shared ({selectedChannelIds.length})
                    </span>
                  </Button>
                )}
              </div>

              {/* Daily Progress Bar */}
              <div className="space-y-2 rounded-xl bg-secondary/45 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-foreground">
                    <CheckCircle2
                      className="size-4 text-status-success"
                      aria-hidden="true"
                    />
                    <span>
                      Daily Community Distribution Progress ({selectedDate})
                    </span>
                  </span>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="font-bold text-primary">
                      {sharedCountToday} / {totalActiveChannels} Shared (
                      {progressPercent}%)
                    </span>
                    {failedCountToday > 0 && (
                      <span className="font-bold text-status-danger">
                        {failedCountToday} Failed
                      </span>
                    )}
                  </div>
                </div>
                <Progress
                  value={progressPercent}
                  className="h-2 bg-secondary"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. WhatsApp Groups & Status Channel Matrix */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="border-b border-border pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-display text-base font-bold">
                <Users className="size-4 text-primary" aria-hidden="true" />
                <span>
                  WhatsApp Community Groups &amp; Status Queue (
                  {whatsappChannels.length})
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Track daily assisted shares across community groups and official
                WhatsApp Status lines. Failed dispatches are highlighted and
                excluded from completed share counts.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Search WhatsApp groups…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-44 bg-background pl-8 text-xs"
                />
              </div>

              <select
                aria-label="Filter WhatsApp Channels"
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="flex h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <option value="all">
                  All WhatsApp Channels ({whatsappChannels.length})
                </option>
                <option value="Status">WhatsApp Status Lines</option>
              </select>
            </div>
          </div>
        </CardHeader>

        {distinctPhoneLines.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/35 px-4 py-2.5">
            <span className="mr-1 text-[11px] font-semibold text-muted-foreground">
              Filter by Phone Line:
            </span>
            <button
              type="button"
              onClick={() => setSelectedLineFilter("all")}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                selectedLineFilter === "all"
                  ? "border-gold-border bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              All Lines ({whatsappChannels.length})
            </button>
            {distinctPhoneLines.map((line) => {
              const count = whatsappChannels.filter(
                (c) => c.senderWhatsappNumber === line
              ).length
              return (
                <button
                  key={line}
                  type="button"
                  onClick={() => setSelectedLineFilter(line)}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                    selectedLineFilter === line
                      ? "border-gold-border bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Smartphone
                    className={cn(
                      "size-3 shrink-0",
                      selectedLineFilter === line
                        ? "text-gold"
                        : "text-gold-text"
                    )}
                    aria-hidden="true"
                  />
                  <span>{line}</span>
                  <span className="font-mono text-[10px] tabular-nums opacity-85">
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <CardContent className="p-4">
          {whatsappChannels.length === 0 ? (
            <div className="space-y-3 rounded-2xl border-2 border-dashed border-status-success-border bg-status-success-bg/50 p-8 text-center sm:p-12">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-status-success-border bg-background text-status-success">
                <Users className="size-6" aria-hidden="true" />
              </div>
              <h4 className="text-base font-bold text-status-success">
                No WhatsApp Groups or Status Channels Registered Yet
              </h4>
              <p className="mx-auto max-w-md text-xs text-status-success">
                Add your community WhatsApp groups and Status lines to track
                daily ban-safe manual assisted poster shares.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredChannels.map((ch) => {
                const isShared = sharedChannelIds.has(ch.id)
                const isFailed = failedChannelIds.has(ch.id)
                const isQueued = queuedChannelIds.has(ch.id)
                const distributionLog = distributionsToday.find(
                  (d) => d.channelId === ch.id
                )
                const isBusy = busyChannelId === ch.id
                const isSelected = selectedChannelIds.includes(ch.id)

                return (
                  <div
                    key={ch.id}
                    className={cn(
                      "space-y-2.5 rounded-xl p-3.5 transition-colors motion-reduce:transition-none",
                      isSelected
                        ? "bg-status-success-bg ring-2 ring-primary/35"
                        : isFailed
                          ? "bg-status-danger-bg"
                          : isShared
                            ? "bg-status-success-bg/55"
                            : "bg-secondary/45 hover:bg-accent/45"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleChannel(ch.id)}
                          className="mt-0.5 size-4 cursor-pointer rounded border-border accent-primary"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="border-gold-border px-1.5 py-0 text-[10px] font-bold text-primary capitalize"
                            >
                              {ch.areaTag.toLowerCase()}
                            </Badge>
                            {ch.senderWhatsappNumber && (
                              <Badge
                                variant="outline"
                                className="inline-flex items-center gap-1 border-status-success-border bg-status-success-bg px-2 py-0 font-mono text-[10px] font-bold text-status-success tabular-nums"
                              >
                                <Smartphone
                                  className="size-2.5 shrink-0"
                                  aria-hidden="true"
                                />
                                <span>{ch.senderWhatsappNumber}</span>
                              </Badge>
                            )}
                          </div>

                          <h4 className="mt-1 truncate text-xs font-bold text-foreground">
                            {ch.name}
                          </h4>

                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MessageSquare
                              className="size-3 text-status-success"
                              aria-hidden="true"
                            />
                            <span className="capitalize">
                              {ch.platform.replace(/_/g, " ")}
                            </span>
                            {ch.memberCount
                              ? ` (${ch.memberCount} members)`
                              : ""}
                          </p>
                        </div>
                      </label>

                      {isShared ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success">
                          <CheckCircle2
                            className="size-3 text-status-success"
                            aria-hidden="true"
                          />
                          <span>Shared</span>
                        </span>
                      ) : isFailed ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-status-danger-border bg-status-danger-bg px-2 py-0.5 text-[10px] font-bold text-status-danger">
                          <XCircle
                            className="size-3 text-status-danger"
                            aria-hidden="true"
                          />
                          <span>Failed</span>
                        </span>
                      ) : isQueued ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-status-warning-border bg-status-warning-bg px-2 py-0.5 text-[10px] font-bold text-status-warning">
                          <Clock
                            className="size-3 text-status-warning"
                            aria-hidden="true"
                          />
                          <span>Queued</span>
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Pending
                        </span>
                      )}
                    </div>

                    {distributionLog?.postAsset && (
                      <div className="rounded bg-background/80 p-1.5 text-[10px] text-muted-foreground">
                        Ref:{" "}
                        <span className="font-mono">
                          {distributionLog.postAsset.postCode}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-2">
                      {ch.inviteLinkOrUrl && (
                        <a
                          href={ch.inviteLinkOrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                        >
                          <ExternalLink
                            className="size-3 text-gold-text"
                            aria-hidden="true"
                          />
                          <span>Open</span>
                        </a>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy || !selectedAsset}
                        onClick={() => handleMarkSharedToday(ch.id)}
                        className={cn(
                          "h-7 flex-1 cursor-pointer gap-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none",
                          isShared
                            ? "border border-status-success-border bg-status-success-bg text-status-success hover:bg-accent focus-visible:outline-primary"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-gold"
                        )}
                      >
                        {isBusy ? (
                          <Loader2
                            className="size-3 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : isShared ? (
                          <Check
                            className="size-3 text-status-success"
                            aria-hidden="true"
                          />
                        ) : (
                          <CheckCircle2
                            className="size-3 text-gold"
                            aria-hidden="true"
                          />
                        )}
                        <span>
                          {isShared
                            ? "Logged (Re-mark)"
                            : isFailed
                              ? "Mark Manually Shared"
                              : "1-Tap Mark Shared"}
                        </span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* High-Res Poster Preview Modal */}
      <Dialog
        open={Boolean(previewPosterUrl)}
        onOpenChange={(open) => !open && setPreviewPosterUrl(null)}
      >
        <DialogContent className="max-w-2xl border-gold/40 bg-sidebar p-2 text-sidebar-foreground">
          <DialogHeader className="sr-only">
            <DialogTitle>4K Poster Preview</DialogTitle>
          </DialogHeader>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg">
            {(() => {
              const modalPosterImageUrl =
                getRenderableImagePreviewUrl(previewPosterUrl)
              if (modalPosterImageUrl) {
                return (
                  <Image
                    src={modalPosterImageUrl}
                    alt="4K Poster Preview"
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 95vw, 672px"
                    className="object-contain"
                  />
                )
              }
              if (previewPosterUrl) {
                return (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-sidebar-foreground/80">
                    <Film className="size-8 text-gold" aria-hidden="true" />
                    <span>Media Asset Ready for Download</span>
                  </div>
                )
              }
              return null
            })()}
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="text-xs font-semibold text-gold">
              Al Ramlah Travels 4K Ultra-High-Resolution Poster
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                handleDownloadPoster(previewPosterUrl || undefined)
              }
              className="cursor-pointer bg-gold text-xs font-bold text-gold-foreground hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <Download className="mr-1 size-3.5" aria-hidden="true" />
              Download Full Res
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==========================================
// 5. TAB 3: OFFICIAL BROADCASTS & VIP OUTREACH (`T-071`, `OD-07`, `T-089`)
// ==========================================

function BroadcastsAndOutreachTab({
  initialNowMs,
  userRole,
  officeLocationLabel,
  summaryCounts,
  onContactsPageChange,
  whatsappAccounts,
  whatsappTemplates,
  whatsappBroadcasts,
  outreachContacts,
  postAssets,
  outreachLogs,
}: {
  initialNowMs?: number
  userRole: "super_admin" | "staff"
  officeLocationLabel: string
  summaryCounts?: CampaignsSummaryCounts
  onContactsPageChange: (page: number) => void
  whatsappAccounts: SafeWhatsappAccount[]
  whatsappTemplates: WhatsappTemplateRecord[]
  whatsappBroadcasts: WhatsappBroadcastRecord[]
  outreachContacts: OutreachContactRow[]
  postAssets: PostAssetRecord[]
  outreachLogs: OutreachLogRow[]
}) {
  const router = useRouter()
  const isSuperAdmin = userRole === "super_admin"

  const defaultAccount =
    whatsappAccounts.find((a) => a.isDefault && a.isActive) ||
    whatsappAccounts[0]

  const [selectedAccountId, setSelectedAccountId] = React.useState<string>(
    () => defaultAccount?.id || ""
  )

  // Strictly scope both approved templates AND broadcast history to `selectedAccountId` (`T-071`)
  const { approvedTemplates, accountBroadcasts } = React.useMemo(
    () =>
      filterWhatsappResourcesByAccount(
        whatsappTemplates,
        whatsappBroadcasts,
        selectedAccountId
      ),
    [whatsappTemplates, whatsappBroadcasts, selectedAccountId]
  )

  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>(
    () => approvedTemplates[0]?.id || ""
  )

  const effectiveSelectedTemplateId = React.useMemo(() => {
    if (approvedTemplates.some((t) => t.id === selectedTemplateId)) {
      return selectedTemplateId
    }
    return approvedTemplates[0]?.id || ""
  }, [approvedTemplates, selectedTemplateId])

  const selectedTemplate = React.useMemo(() => {
    return approvedTemplates.find((t) => t.id === effectiveSelectedTemplateId)
  }, [approvedTemplates, effectiveSelectedTemplateId])

  const [broadcastName, setBroadcastName] = React.useState(
    "Ramadan 2027 Umrah Spotlight Announcement"
  )

  const [recipientSegment, setRecipientSegment] = React.useState<
    "all_vip" | "eligible_only" | "askari_cantt" | "custom_phones"
  >("eligible_only")

  const [customPhonesText, setCustomPhonesText] = React.useState("")
  const [scheduledBroadcastTime, setScheduledBroadcastTime] =
    React.useState<string>("")

  const [defaultTemplateParams, setDefaultTemplateParams] = React.useState<
    Record<string, string>
  >({})
  const [headerMediaUrl, setHeaderMediaUrl] = React.useState<string>("")
  const [csvRawText, setCsvRawText] = React.useState<string>("")

  const parsedCsv = React.useMemo(() => {
    return parseWhatsappBroadcastCsv(csvRawText)
  }, [csvRawText])

  const [selectedBroadcastDetails, setSelectedBroadcastDetails] =
    React.useState<BroadcastSummaryDetail | null>(null)
  const [broadcastRecipientsList, setBroadcastRecipientsList] = React.useState<
    BroadcastRecipientDetail[]
  >([])
  const [isLoadingBroadcastDetails, setIsLoadingBroadcastDetails] =
    React.useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false)
  const [isRetryingBroadcast, setIsRetryingBroadcast] = React.useState(false)

  const handleOpenBroadcastDetails = async (
    broadcast: WhatsappBroadcastRecord
  ) => {
    setSelectedBroadcastDetails({
      id: broadcast.id,
      name: broadcast.name,
      templateName: broadcast.templateName,
      templateLanguage: broadcast.templateLanguage,
      status: broadcast.status,
      totalRecipients: broadcast.totalRecipients,
      sentCount: broadcast.sentCount,
      deliveredCount: broadcast.deliveredCount,
      readCount: broadcast.readCount,
      failedCount: broadcast.failedCount,
      scheduledAt: broadcast.scheduledAt,
      startedAt: broadcast.startedAt,
      completedAt: broadcast.completedAt,
      createdAt: broadcast.createdAt,
    })
    setIsLoadingBroadcastDetails(true)
    setIsDetailsDialogOpen(true)
    try {
      const res = await getWhatsappBroadcastDetailsAction({
        broadcastId: broadcast.id,
      })
      if (res.success && res.recipients) {
        setBroadcastRecipientsList(res.recipients as BroadcastRecipientDetail[])
        if (res.broadcast) {
          setSelectedBroadcastDetails(res.broadcast as BroadcastSummaryDetail)
        }
      }
    } finally {
      setIsLoadingBroadcastDetails(false)
    }
  }

  const handleRetryFailedRecipients = async (broadcastId: string) => {
    if (!isSuperAdmin) return
    setIsRetryingBroadcast(true)
    try {
      const res = await retryFailedWhatsappBroadcastRecipientsAction({
        broadcastId,
      })
      if (res.success) {
        const detailsRes = await getWhatsappBroadcastDetailsAction({
          broadcastId,
        })
        if (detailsRes.success && detailsRes.recipients) {
          setBroadcastRecipientsList(
            detailsRes.recipients as BroadcastRecipientDetail[]
          )
          if (detailsRes.broadcast) {
            setSelectedBroadcastDetails(
              detailsRes.broadcast as BroadcastSummaryDetail
            )
          }
        }
        router.refresh()
      }
    } finally {
      setIsRetryingBroadcast(false)
    }
  }

  const [isLaunchingBroadcast, setIsLaunchingBroadcast] = React.useState(false)
  const [broadcastNotice, setBroadcastNotice] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [activeBroadcastRunId, setActiveBroadcastRunId] = React.useState<
    string | null
  >(null)

  const [mountNowMs] = React.useState<number>(() => initialNowMs ?? Date.now())

  const computedRecipientPhones = React.useMemo(() => {
    const now = new Date(mountNowMs)

    if (recipientSegment === "custom_phones") {
      if (parsedCsv.recipients.length > 0) {
        return parsedCsv.recipients.map((r) => r.phone)
      }
      return customPhonesText
        .split(/[\n,]+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 7)
    }

    if (recipientSegment === "all_vip") {
      return outreachContacts
        .filter((c) => c.interestStatus !== "do_not_contact")
        .map((c) => c.whatsappNumber)
    }

    if (recipientSegment === "askari_cantt") {
      return outreachContacts
        .filter(
          (c) =>
            c.interestStatus !== "do_not_contact" &&
            (c.areaCommunity?.toLowerCase().includes("askari") ||
              c.areaCommunity?.toLowerCase().includes("cantt"))
        )
        .map((c) => c.whatsappNumber)
    }

    return outreachContacts
      .filter((c) => {
        if (c.interestStatus === "do_not_contact") return false
        const state = computeOutreachCooldownState(
          c.lastOutreachAt,
          c.lastInboundReplyAt,
          now
        )
        return state.isEligibleToday
      })
      .map((c) => c.whatsappNumber)
  }, [
    recipientSegment,
    customPhonesText,
    outreachContacts,
    parsedCsv,
    mountNowMs,
  ])

  const handleLaunchBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSuperAdmin) {
      setBroadcastNotice({
        type: "error",
        message:
          "Forbidden: Super Administrator privilege required to launch bulk Meta broadcasts.",
      })
      return
    }
    if (!selectedAccountId) {
      setBroadcastNotice({
        type: "error",
        message: "Please select an active WhatsApp Business Account.",
      })
      return
    }
    if (
      !effectiveSelectedTemplateId ||
      !approvedTemplates.some((t) => t.id === effectiveSelectedTemplateId)
    ) {
      setBroadcastNotice({
        type: "error",
        message:
          "Please select an APPROVED Meta template belonging to the selected WhatsApp Business Account.",
      })
      return
    }
    if (computedRecipientPhones.length === 0) {
      setBroadcastNotice({
        type: "error",
        message:
          "Recipient list is empty. Select another segment, upload a CSV, or add phone numbers.",
      })
      return
    }

    setIsLaunchingBroadcast(true)
    setBroadcastNotice(null)

    try {
      const payload: {
        accountId: string
        name: string
        templateId: string
        recipientPhones: string[]
        defaultTemplateParams: Record<string, string>
        headerMediaUrl: string | null
        scheduledAt: string | null
        csvText?: string
        recipients?: Array<{
          phone: string
          name?: string
          templateParams?: string[] | Record<string, string>
        }>
      } = {
        accountId: selectedAccountId,
        name: broadcastName.trim(),
        templateId: effectiveSelectedTemplateId,
        recipientPhones: computedRecipientPhones,
        defaultTemplateParams,
        headerMediaUrl: headerMediaUrl.trim() || null,
        scheduledAt: scheduledBroadcastTime
          ? parsePktDateTimeLocal(scheduledBroadcastTime).toISOString()
          : null,
      }

      if (recipientSegment === "custom_phones" && csvRawText.trim()) {
        payload.csvText = csvRawText
        if (parsedCsv.recipients.length > 0) {
          payload.recipients = parsedCsv.recipients.map((r) => ({
            phone: r.phone,
            name: r.name,
            templateParams: r.customParams,
          }))
        }
      }

      const res = await createAndQueueWhatsappBroadcastAction(payload)
      if (res.success) {
        if (isRealTriggerRunId(res.triggerRunId)) {
          setActiveBroadcastRunId(res.triggerRunId)
        } else {
          setActiveBroadcastRunId(null)
        }
        setBroadcastNotice({
          type: "success",
          message: `Official Meta Broadcast queued for ${computedRecipientPhones.length} recipient(s)!`,
        })
        router.refresh()
      } else {
        setBroadcastNotice({
          type: "error",
          message: res.error || "Failed to launch broadcast.",
        })
      }
    } catch (err: unknown) {
      setBroadcastNotice({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while launching broadcast.",
      })
    } finally {
      setIsLaunchingBroadcast(false)
    }
  }

  const outreachAssets: OutreachAssetRow[] = React.useMemo(() => {
    return postAssets.map((a) => ({
      id: a.id,
      postCode: a.postCode,
      title: a.title,
      imageUrl: a.imageUrl,
      flyerId: a.flyerId,
      captionWhatsapp: a.captionWhatsapp,
    }))
  }, [postAssets])

  const totalOutreachContacts =
    summaryCounts?.totalOutreachContacts ?? outreachContacts.length
  const contactsPage = summaryCounts?.contactsPage ?? 1
  const contactsPageSize = summaryCounts?.contactsPageSize ?? 150
  const totalContactsPages = Math.max(
    1,
    Math.ceil(totalOutreachContacts / contactsPageSize)
  )

  return (
    <div className="flex flex-col gap-8">
      {activeBroadcastRunId && (
        <CampaignRealtimeStatus
          runId={activeBroadcastRunId}
          mode="whatsapp_broadcast"
          title="Live Meta WhatsApp Broadcast Delivery Stream"
          onComplete={() => router.refresh()}
        />
      )}

      {/* 1. Official Meta Template Broadcast Launch Card */}
      <Card className="border-gold-border bg-card shadow-sm">
        <CardHeader className="border-b border-border bg-secondary/35 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-display text-base font-bold">
                <Send className="size-4 text-gold-text" aria-hidden="true" />
                <span>
                  Official Meta WhatsApp Cloud API Template Broadcasts
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Launch compliant broadcast notifications to opt-in subscribers
                using pre-approved Meta message templates scoped to the selected
                WABA line.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="border-primary/30 text-[11px] font-medium text-primary tabular-nums"
            >
              <span className="font-mono font-semibold">
                {approvedTemplates.length}
              </span>{" "}
              Approved Templates on Selected Line
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-4 sm:p-6">
          {!isSuperAdmin && (
            <div className="flex items-center gap-2.5 rounded-xl border border-status-warning-border bg-status-warning-bg p-3.5 text-xs text-status-warning">
              <Lock
                className="size-4 shrink-0 text-status-warning"
                aria-hidden="true"
              />
              <span>
                <strong>Super Administrator Required:</strong> Paid bulk Meta
                Cloud API broadcast launches and mass retries are restricted to{" "}
                <code>super_admin</code> accounts. Staff consultants can review
                funnel history and run 1-on-1 VIP outreach below.
              </span>
            </div>
          )}

          {broadcastNotice && (
            <div
              role="alert"
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border p-3.5 text-xs font-semibold",
                broadcastNotice.type === "success"
                  ? "border-status-success-border bg-status-success-bg text-status-success"
                  : "border-status-danger-border bg-status-danger-bg text-status-danger"
              )}
            >
              <span>{broadcastNotice.message}</span>
              <button
                type="button"
                onClick={() => setBroadcastNotice(null)}
                className="shrink-0 cursor-pointer underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Dismiss
              </button>
            </div>
          )}

          <form onSubmit={handleLaunchBroadcast} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      WhatsApp Business Account
                    </Label>
                    <select
                      aria-label="WhatsApp Business Account"
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {whatsappAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.displayPhoneNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Campaign Broadcast Name
                    </Label>
                    <Input
                      required
                      disabled={!isSuperAdmin}
                      value={broadcastName}
                      onChange={(e) => setBroadcastName(e.target.value)}
                      placeholder="e.g. Ramadan 2027 Announcement"
                      className="h-9 bg-background text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between text-xs font-semibold">
                    <span>
                      Approved Meta Template (Scoped to Selected WABA)
                    </span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      Only approved templates on this line
                    </span>
                  </Label>
                  <select
                    aria-label="Approved Meta Template"
                    value={effectiveSelectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={!isSuperAdmin || approvedTemplates.length === 0}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {approvedTemplates.length === 0 ? (
                      <option value="">
                        No approved templates on selected WABA account
                      </option>
                    ) : (
                      approvedTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} [{t.language}] ({t.category.toLowerCase()})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {selectedTemplate && (
                  <div className="space-y-2 rounded-xl bg-secondary/45 p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary">
                        Template Preview:{" "}
                        <span className="font-mono">
                          {selectedTemplate.name}
                        </span>
                      </span>
                      <Badge className="border border-status-success-border bg-status-success-bg text-[10px] font-semibold text-status-success capitalize">
                        {selectedTemplate.category.toLowerCase()}
                      </Badge>
                    </div>

                    {selectedTemplate.headerContent && (
                      <p className="text-xs font-bold text-foreground">
                        {selectedTemplate.headerContent}
                      </p>
                    )}

                    <p className="rounded-lg bg-background p-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {selectedTemplate.bodyText}
                    </p>

                    {selectedTemplate.footerText && (
                      <p className="text-[11px] text-muted-foreground italic">
                        {selectedTemplate.footerText}
                      </p>
                    )}
                  </div>
                )}

                {selectedTemplate && isSuperAdmin && (
                  <div className="pt-2">
                    <WhatsappBroadcastPersonalizerFields
                      templateBodyText={selectedTemplate.bodyText || ""}
                      templateHeaderType={selectedTemplate.headerType || "NONE"}
                      headerMediaUrl={headerMediaUrl}
                      onHeaderMediaUrlChange={setHeaderMediaUrl}
                      templateParams={defaultTemplateParams}
                      onTemplateParamsChange={setDefaultTemplateParams}
                      csvText={csvRawText}
                      onCsvTextChange={(txt) => {
                        setCsvRawText(txt)
                        if (txt.trim()) {
                          setRecipientSegment("custom_phones")
                        }
                      }}
                      parsedRecipients={parsedCsv.recipients}
                      csvErrors={parsedCsv.errors}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4 lg:col-span-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Target Recipient Segment
                    </Label>
                    <span className="text-xs font-bold text-primary tabular-nums">
                      <span className="font-mono">
                        {computedRecipientPhones.length}
                      </span>{" "}
                      Recipients
                    </span>
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        id: "eligible_only",
                        label: "Eligible Contacts Only",
                        desc: "Outside 14-day personal cooldown window",
                      },
                      {
                        id: "askari_cantt",
                        label: "Askari 10 & Lahore Cantt VIP Residents",
                        desc: `Neighborhood contacts near ${officeLocationLabel}`,
                      },
                      {
                        id: "all_vip",
                        label: "All VIP Outreach Contacts",
                        desc: "All contacts excluding opted-out leads",
                      },
                      {
                        id: "custom_phones",
                        label: "Custom Phone Number List / CSV",
                        desc: "Paste comma or newline separated phones",
                      },
                    ].map((seg) => (
                      <label
                        key={seg.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-lg p-2.5 text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none",
                          recipientSegment === seg.id
                            ? "bg-primary/10 ring-1 ring-primary"
                            : "bg-secondary/50 hover:bg-accent/55"
                        )}
                      >
                        <input
                          type="radio"
                          name="recipientSegment"
                          disabled={!isSuperAdmin}
                          checked={recipientSegment === seg.id}
                          onChange={() =>
                            setRecipientSegment(
                              seg.id as typeof recipientSegment
                            )
                          }
                          className="mt-0.5 accent-primary"
                        />
                        <div>
                          <p className="text-[11px] font-semibold text-foreground">
                            {seg.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {seg.desc}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {recipientSegment === "custom_phones" && (
                    <Textarea
                      rows={3}
                      disabled={!isSuperAdmin}
                      placeholder="e.g. 923001234567, 923219876543"
                      value={customPhonesText}
                      onChange={(e) => setCustomPhonesText(e.target.value)}
                      className="mt-2 bg-background font-mono text-xs"
                    />
                  )}
                </div>

                <div className="space-y-1.5 border-t border-border pt-2">
                  <Label className="text-xs font-semibold">
                    Schedule Timing in PKT (Optional)
                  </Label>
                  <Input
                    type="datetime-local"
                    disabled={!isSuperAdmin}
                    value={scheduledBroadcastTime}
                    onChange={(e) => setScheduledBroadcastTime(e.target.value)}
                    className="h-9 bg-background font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Interpreted in Asia/Karachi (+05:00). Leave blank to
                    dispatch immediately.
                  </p>
                </div>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="flex items-center justify-end border-t border-border pt-3">
                <Button
                  type="submit"
                  disabled={
                    isLaunchingBroadcast ||
                    computedRecipientPhones.length === 0 ||
                    !effectiveSelectedTemplateId
                  }
                  className="cursor-pointer gap-2 bg-primary text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                >
                  {isLaunchingBroadcast ? (
                    <Loader2
                      className="size-4 animate-spin text-gold motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send className="size-4 text-gold" aria-hidden="true" />
                  )}
                  <span>
                    {scheduledBroadcastTime
                      ? `Schedule Broadcast for ${computedRecipientPhones.length} Contacts`
                      : `Queue & Launch Broadcast (${computedRecipientPhones.length} Contacts)`}
                  </span>
                </Button>
              </div>
            )}
          </form>

          {/* Recent Broadcasts Audit Strip (Scoped to Selected WABA `T-071`) */}
          {accountBroadcasts.length > 0 && (
            <div className="space-y-3 border-t border-border pt-4">
              <h4 className="text-xs font-bold text-foreground">
                Recent Broadcast Dispatches on Selected Line (
                {accountBroadcasts.length})
              </h4>
              <div className="space-y-2">
                {accountBroadcasts.slice(0, 10).map((bc) => {
                  const deliveryRate =
                    bc.totalRecipients > 0
                      ? Math.round(
                          (bc.deliveredCount / bc.totalRecipients) * 100
                        )
                      : 0

                  return (
                    <div
                      key={bc.id}
                      className="flex flex-col justify-between gap-2 rounded-lg bg-secondary/45 p-3 text-xs sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-foreground">{bc.name}</strong>
                          <Badge
                            variant="outline"
                            className="border-primary/30 font-mono text-[10px]"
                          >
                            {bc.templateName}
                          </Badge>
                          <Badge
                            className={cn(
                              "border text-[10px] capitalize",
                              bc.status === "completed" &&
                                "border-status-success-border bg-status-success-bg text-status-success",
                              bc.status === "processing" &&
                                "border-status-info-border bg-status-info-bg text-status-info",
                              bc.status === "scheduled" &&
                                "border-status-warning-border bg-status-warning-bg text-status-warning",
                              bc.status === "failed" &&
                                "border-status-danger-border bg-status-danger-bg text-status-danger"
                            )}
                          >
                            {bc.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Started:{" "}
                          {formatDateSafe(bc.startedAt || bc.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] tabular-nums">
                        <span>
                          Total:{" "}
                          <span className="font-mono">
                            {bc.totalRecipients}
                          </span>
                        </span>
                        <span className="text-status-success">
                          Sent:{" "}
                          <span className="font-mono">{bc.sentCount}</span>
                        </span>
                        <span className="font-bold text-primary">
                          Delivered:{" "}
                          <span className="font-mono">{deliveryRate}%</span>
                        </span>
                        {bc.failedCount > 0 && (
                          <span className="text-status-danger">
                            Failed:{" "}
                            <span className="font-mono">{bc.failedCount}</span>
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenBroadcastDetails(bc)}
                          className="ml-1 h-7 cursor-pointer gap-1 border-primary/30 text-[10px] text-primary transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                        >
                          <Eye className="size-3" aria-hidden="true" />
                          <span>Funnel &amp; Recipients</span>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Broadcast Delivery Funnel & Recipients Dialog */}
      <WhatsappBroadcastDetailsDialog
        open={isDetailsDialogOpen}
        broadcast={selectedBroadcastDetails}
        recipients={broadcastRecipientsList}
        isLoading={isLoadingBroadcastDetails}
        onClose={() => setIsDetailsDialogOpen(false)}
        onRetryFailed={isSuperAdmin ? handleRetryFailedRecipients : undefined}
        isRetrying={isRetryingBroadcast}
        userRole={userRole}
      />

      {/* 2. 14-Day VIP Outreach CRM Section */}
      <div className="space-y-3">
        <div className="flex flex-col justify-between gap-2 border-b border-border pb-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold text-foreground">
                1-on-1 VIP Personal Outreach CRM
              </h2>
              <Badge
                variant="outline"
                className="border-status-success-border bg-status-success-bg text-[10px] font-semibold text-status-success"
              >
                14-Day Safeguard Active
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Personal high-touch relationship cultivation for prospective
              pilgrims served from our {officeLocationLabel} headquarters. Every
              personal package share triggers an automatic 14-day cooldown
              timer, re-opening outreach automatically upon inbound customer
              reply.
            </p>
          </div>

          {totalContactsPages > 1 && (
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                Contacts Page {contactsPage}/{totalContactsPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Previous contacts page"
                disabled={contactsPage <= 1}
                onClick={() => onContactsPageChange(contactsPage - 1)}
                className="h-7 cursor-pointer px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Next contacts page"
                disabled={contactsPage >= totalContactsPages}
                onClick={() => onContactsPageChange(contactsPage + 1)}
                className="h-7 cursor-pointer px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>

        <OutreachClient
          initialContacts={outreachContacts}
          postAssets={outreachAssets}
          recentLogs={outreachLogs}
        />
      </div>
    </div>
  )
}
