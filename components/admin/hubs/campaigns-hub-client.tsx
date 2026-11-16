"use client"

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Calendar,
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
      error: "Local file: and data: URIs are not permitted for social publishing.",
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
    | "multi_package_sheet"
    | "single_package_spotlight"
    | "custom_quotation_pdf"
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
    | "draft"
    | "scheduled"
    | "processing"
    | "completed"
    | "failed"
    | "cancelled"
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
    color: "bg-pink-100 text-pink-800 border-pink-300",
  },
  {
    id: "facebook",
    name: "Facebook Pages",
    badge: "FB",
    color: "bg-blue-100 text-blue-800 border-blue-300",
  },
  {
    id: "tiktok",
    name: "TikTok Business",
    badge: "TikTok",
    color: "bg-slate-100 text-slate-900 border-slate-300",
  },
  {
    id: "youtube",
    name: "YouTube Channel",
    badge: "YT",
    color: "bg-red-100 text-red-800 border-red-300",
  },
  {
    id: "gmb",
    name: "Google Business Profile",
    badge: "GMB",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
]

function formatDateSafe(val: Date | string | null | undefined): string {
  if (!val) return "—"
  const d = typeof val === "string" ? new Date(val) : val
  if (isNaN(d.getTime())) return "—"
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
          className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-xs text-amber-950 flex items-start gap-2.5"
        >
          <AlertTriangle className="size-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">
              Some campaign datasets loaded in degraded mode:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              {degradedWarnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Hub Header */}
      <div className="flex flex-col gap-2 border-b border-border/80 pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold-text">
            Campaigns &amp; Multi-Channel Marketing
          </span>
          <Badge
            variant="outline"
            className="text-[10px] font-mono tabular-nums border-primary/30 text-primary bg-primary/5"
          >
            {activeSocialAccountsCount} Social Channels • {whatsappChannelsCount}{" "}
            WhatsApp Channels • {totalVipContactsCount} VIP Contacts
          </Badge>
          {scheduledCount > 0 && (
            <Badge className="text-[10px] bg-emerald-600 text-white font-mono tabular-nums">
              {scheduledCount} Posts Active in Queue
            </Badge>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Campaigns &amp; Multi-Channel Outreach
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl">
              {activeMeta.description}
            </p>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="mt-4 flex overflow-x-auto rounded-xl border border-border/80 bg-muted/40 p-1.5 gap-1.5 no-scrollbar">
          {CAMPAIGN_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-all cursor-pointer select-none",
                  isActive
                    ? "bg-card text-foreground shadow-xs border border-[#C5A059]/50 text-primary"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-[#C5A059]" : "text-muted-foreground"
                  )}
                />
                <span>{tab.label}</span>
                {tab.key === "social" && (
                  <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-mono tabular-nums">
                    {totalScheduledPostsCount}
                  </span>
                )}
                {tab.key === "whatsapp" && (
                  <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-mono tabular-nums">
                    {whatsappChannelsCount}
                  </span>
                )}
                {tab.key === "outreach" && (
                  <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-mono tabular-nums">
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
          postAssets={postAssets}
          marketingChannels={marketingChannels}
          dailyDistributions={dailyDistributions}
        />
      )}

      {/* Tab 3: Official Meta Broadcasts & VIP Outreach */}
      {activeTab === "outreach" && (
        <BroadcastsAndOutreachTab
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
      selectedAsset?.captionInstagram ||
      selectedAsset?.captionWhatsapp ||
      ""
    )
  })

  React.useEffect(() => {
    if (selectedAsset) {
      setCaption(
        selectedAsset.captionInstagram ||
          selectedAsset.captionWhatsapp ||
          ""
      )
    }
  }, [selectedAsset])

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

  React.useEffect(() => {
    if (preferredAssetMediaUrl) {
      setMediaUrls([preferredAssetMediaUrl])
    }
  }, [preferredAssetMediaUrl])

  const isVideoMedia = React.useMemo(() => {
    return mediaUrls.some((url) => {
      const lower = url.toLowerCase()
      return (
        lower.endsWith(".mp4") ||
        lower.endsWith(".mov") ||
        lower.endsWith(".webm")
      )
    })
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

  React.useEffect(() => {
    if (!isVideoMedia && mediaUrls.length > 0) {
      setSelectedTargetIds((prev) =>
        prev.filter((id) => {
          const found = activeIntegrations.find((i) => i.id === id)
          return found?.provider !== "youtube"
        })
      )
    }
  }, [isVideoMedia, mediaUrls.length, activeIntegrations])

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
        (i) => i.provider === "tiktok" && selectedTargetIds.includes(i.id)
      ) || null,
    [activeIntegrations, selectedTargetIds]
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
        (i) => i.provider === "gmb" && selectedTargetIds.includes(i.id)
      ),
    [activeIntegrations, selectedTargetIds]
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
    formatPktDateTimeLocal(new Date(Date.now() + 2 * 60 * 60 * 1000))
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
      followUpAsset?.captionInstagram ||
      followUpAsset?.captionWhatsapp ||
      ""
    )
  })

  React.useEffect(() => {
    if (followUpAsset) {
      setFollowUpCaption(
        followUpAsset.captionInstagram ||
          followUpAsset.captionWhatsapp ||
          ""
      )
    }
  }, [followUpAsset])

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
      `🕋 Urgent Update: Limited seats remaining for this package! WhatsApp our Lahore pilgrims desk directly for immediate confirmation: https://wa.me/${primaryWhatsappDigits}?text=Salam%20Al%20Ramlah%20Travels!%20Inquiring%20about%20booking.`
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
          .filter((i) => selectedTargetIds.includes(i.id))
          .map((i) => i.provider)
      )
    )
    return chosen.length > 0
      ? chosen
      : ["instagram", "facebook", "tiktok", "youtube", "gmb"]
  }, [activeIntegrations, selectedTargetIds])

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
          matchedPackage?.postCode ||
          selectedAsset?.postCode ||
          "ART-UMRAH-01",
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
          message: `✨ AI generated 5 platform-optimized captions & hooks (${res.result.modelUsed}).`,
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
          message: `⚡ Queued in next open PKT peak window: ${res.pktLabel}`,
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
          "Cloudflare R2 media upload failed. Verify R2 storage configuration and retry — local browser blob: URLs are blocked.",
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
    if (selectedTargetIds.length === 0) {
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
        targetIntegrationIds: selectedTargetIds,
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
            ? `Post (${postFormat}) processed across ${selectedTargetIds.length} channel target(s).`
            : `Post (${postFormat}) scheduled for ${formatDateSafe(scheduledDate)} (PKT) across ${selectedTargetIds.length} channel(s).`,
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
      <Card className="border-[#C5A059]/50 bg-gradient-to-r from-[#0A3622]/[0.04] via-card to-[#C5A059]/[0.06] shadow-xs">
        <CardHeader className="pb-3 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="font-display text-base font-bold flex items-center gap-2 flex-wrap">
                <BarChart3 className="size-4 text-[#C5A059]" />
                <span>Core 5 Cross-Channel Analytics Overview</span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono tabular-nums border-[#C5A059]/60 text-[#0A3622]"
                >
                  {campaignAnalyticsOverview.liveSyncedTargetsCount} Live Synced
                </Badge>
                {campaignAnalyticsOverview.unavailableTargetsCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono tabular-nums border-amber-400 bg-amber-50 text-amber-900"
                  >
                    {campaignAnalyticsOverview.unavailableTargetsCount} Awaiting
                    Live Sync
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Verified live API telemetry across Instagram, Facebook Pages,
                TikTok, YouTube Shorts &amp; Google Business Profile (zero
                estimated or synthetic metrics).
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsComposerModalOpen(true)}
                className="h-8 text-xs font-bold border-[#C5A059]/60 text-[#0A3622] hover:bg-[#C5A059]/10 gap-1.5 cursor-pointer"
              >
                <Smartphone className="size-3.5 text-[#C5A059]" />
                <span>Open Studio Split Preview</span>
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={isSyncingAllAnalytics}
                onClick={handleSyncAllAnalytics}
                className="h-8 text-xs font-bold bg-[#0A3622] text-white hover:bg-[#0A3622]/90 gap-1.5 cursor-pointer"
              >
                {isSyncingAllAnalytics ? (
                  <Loader2 className="size-3.5 animate-spin text-[#C5A059]" />
                ) : (
                  <RefreshCw className="size-3.5 text-[#C5A059]" />
                )}
                <span>Sync Live Analytics</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-border bg-white p-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                <span>Verified Views</span>
                <Eye className="size-3.5 text-primary" />
              </div>
              <p className="font-mono tabular-nums text-lg font-bold text-foreground">
                {campaignAnalyticsOverview.liveSyncedTargetsCount > 0
                  ? campaignAnalyticsOverview.totalViews.toLocaleString()
                  : "—"}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-white p-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                <span>Verified Likes</span>
                <Heart className="size-3.5 text-rose-600" />
              </div>
              <p className="font-mono tabular-nums text-lg font-bold text-foreground">
                {campaignAnalyticsOverview.liveSyncedTargetsCount > 0
                  ? campaignAnalyticsOverview.totalLikes.toLocaleString()
                  : "—"}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-white p-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                <span>Verified Comments</span>
                <MessageSquare className="size-3.5 text-blue-600" />
              </div>
              <p className="font-mono tabular-nums text-lg font-bold text-foreground">
                {campaignAnalyticsOverview.liveSyncedTargetsCount > 0
                  ? campaignAnalyticsOverview.totalComments.toLocaleString()
                  : "—"}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-white p-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                <span>Shares &amp; Clicks</span>
                <MousePointerClick className="size-3.5 text-[#C5A059]" />
              </div>
              <p className="font-mono tabular-nums text-lg font-bold text-foreground">
                {campaignAnalyticsOverview.liveSyncedTargetsCount > 0
                  ? (
                      campaignAnalyticsOverview.totalShares +
                      campaignAnalyticsOverview.totalClicks
                    ).toLocaleString()
                  : "—"}
              </p>
            </div>

            <div className="rounded-xl border border-[#C5A059]/50 bg-[#0A3622]/5 p-3 space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-[11px] text-[#0A3622] font-bold">
                <span>Avg Engagement</span>
                <TrendingUp className="size-3.5 text-[#C5A059]" />
              </div>
              <p className="font-mono tabular-nums text-lg font-bold text-[#0A3622]">
                {campaignAnalyticsOverview.liveSyncedTargetsCount > 0
                  ? `${campaignAnalyticsOverview.engagementRatePct.toFixed(2)}%`
                  : "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {CORE_5_PLATFORMS.map((plat) => {
              const summary = campaignAnalyticsOverview.byPlatform[plat.id]
              return (
                <div
                  key={plat.id}
                  className="rounded-lg border border-border bg-white/90 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold border shrink-0",
                        plat.color
                      )}
                    >
                      {plat.badge}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[11px] truncate tabular-nums">
                        {summary.liveSyncedTargetsCount > 0
                          ? `${summary.views.toLocaleString()} views`
                          : "No live sync"}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        {summary.liveSyncedTargetsCount > 0
                          ? `${summary.likes}♥ · ${summary.comments}💬 · ${summary.clicks}⚡`
                          : summary.unavailableTargetsCount > 0
                          ? `${summary.unavailableTargetsCount} unsynced`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono tabular-nums text-[10px] border-[#C5A059]/40 text-[#0A3622] shrink-0"
                  >
                    {summary.liveSyncedTargetsCount > 0
                      ? `${summary.engagementRatePct.toFixed(1)}%`
                      : "—"}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 1. Post Composer Card */}
      <Card className="border-[#C5A059]/40 bg-card shadow-sm">
        <CardHeader className="bg-secondary/20 border-b border-border pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold flex items-center gap-2">
                <Sparkles className="size-4 text-[#C5A059]" />
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
                className="text-[11px] font-mono tabular-nums border-primary/30 text-primary"
              >
                {activeIntegrations.length} Active Account(s) Connected
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {composerNotice && (
            <div
              role="alert"
              className={cn(
                "rounded-xl border p-3.5 text-xs font-semibold flex items-center justify-between gap-2",
                composerNotice.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : "border-rose-300 bg-rose-50 text-rose-950"
              )}
            >
              <span>{composerNotice.message}</span>
              <button
                type="button"
                onClick={() => setComposerNotice(null)}
                className="underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          <form onSubmit={handleCreatePost} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Asset, Format & Media Selection */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-primary flex items-center justify-between">
                    <span>1. Select 4K Poster / Spotlight Asset</span>
                    <span className="text-[10px] text-muted-foreground font-normal tabular-nums">
                      {postAssets.length} Available
                    </span>
                  </Label>
                  <select
                    aria-label="Select 4K Poster or Spotlight Asset"
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-mono"
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
                    className="w-full text-xs font-semibold border-[#C5A059]/60 text-[#0A3622] hover:bg-[#C5A059]/10 gap-1.5 cursor-pointer mt-1"
                  >
                    <Sparkles className="size-3.5 text-[#C5A059]" />
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
                      className="text-[9px] font-mono border-[#C5A059]/50 text-[#0A3622]"
                    >
                      {postFormat}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
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
                      ]
                    ).map((fmt) => {
                      const FmtIcon = fmt.icon
                      const active = postFormat === fmt.id
                      return (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setPostFormat(fmt.id)}
                          className={cn(
                            "flex flex-col items-start rounded-lg border p-2.5 text-left transition-all cursor-pointer",
                            active
                              ? "border-[#0A3622] bg-[#0A3622]/5 ring-1 ring-[#0A3622]"
                              : "border-border bg-white hover:border-[#C5A059]"
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                            <FmtIcon
                              className={cn(
                                "size-3.5",
                                active
                                  ? "text-[#C5A059]"
                                  : "text-muted-foreground"
                              )}
                            />
                            <span>{fmt.label}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {fmt.desc}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {postFormat === "REEL" && !isVideoMedia && (
                    <p className="text-[10px] font-medium text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-2.5 py-1.5">
                      Reel / Short format requires an `.mp4` or `.mov` video URL
                      in Attached Media URLs below.
                    </p>
                  )}
                </div>

                {/* Poster Preview Card */}
                {selectedAsset ? (
                  <div className="rounded-xl border border-border bg-secondary/15 p-3 space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                        {selectedAsset.imageUrl ? (
                          <img
                            src={selectedAsset.imageUrl}
                            alt={selectedAsset.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-primary">
                            {selectedAsset.postCode}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 border-[#C5A059]/40 text-[#0A3622] uppercase font-semibold"
                          >
                            {selectedAsset.kind.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <h4 className="text-xs font-semibold text-foreground line-clamp-2">
                          {selectedAsset.title}
                        </h4>
                        <div className="flex items-center gap-2 pt-1 text-[11px]">
                          {selectedAsset.imageUrl && (
                            <a
                              href={selectedAsset.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 font-semibold"
                            >
                              <Eye className="size-3" />
                              <span>View 4K Asset</span>
                            </a>
                          )}
                          {selectedAsset.pdfUrl && (
                            <a
                              href={selectedAsset.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:underline flex items-center gap-1"
                            >
                              <FileText className="size-3" />
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
                      className="h-8 text-xs bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddCustomMediaUrl}
                      className="h-8 text-xs shrink-0"
                    >
                      <Plus className="size-3 mr-1" />
                      Add URL
                    </Button>
                  </div>
                  {mediaUrls.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {mediaUrls.map((url, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
                        >
                          <span className="truncate max-w-[160px]">{url}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setMediaUrls((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="hover:text-rose-600"
                            aria-label="Remove media URL"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="relative rounded-xl border border-dashed border-[#C5A059]/50 bg-[#C5A059]/5 p-3 text-center transition-all hover:bg-[#C5A059]/10 mt-2">
                    <input
                      type="file"
                      aria-label="Upload campaign media file"
                      accept="image/*,video/mp4,video/quicktime"
                      onChange={handleFileUpload}
                      disabled={isUploadingR2}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                      {isUploadingR2 ? (
                        <Loader2 className="size-5 animate-spin text-[#C5A059]" />
                      ) : (
                        <UploadCloud className="size-5 text-[#C5A059]" />
                      )}
                      <span className="text-xs font-semibold text-foreground">
                        {isUploadingR2
                          ? "Uploading to Cloudflare R2..."
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
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-2">
                      <span>2. Social Captions &amp; Platform Overrides</span>
                      {activeCaptionTab !== "global" && (
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono border-[#C5A059]/60 text-[#0A3622] uppercase"
                        >
                          Customizing {activeCaptionTab}
                        </Badge>
                      )}
                    </Label>

                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={isGeneratingAiCaptions}
                      onClick={handleGenerateAiCaptions}
                      className="h-7 text-[11px] font-bold border-[#C5A059]/60 bg-gradient-to-r from-[#0A3622]/5 to-[#C5A059]/10 hover:bg-[#C5A059]/20 text-[#0A3622] shrink-0 cursor-pointer gap-1.5 shadow-xs"
                    >
                      {isGeneratingAiCaptions ? (
                        <Loader2 className="size-3 animate-spin text-[#C5A059]" />
                      ) : (
                        <Sparkles className="size-3 text-[#C5A059]" />
                      )}
                      <span>✨ AI Generate All 5 Platform Captions</span>
                    </Button>
                  </div>

                  {/* Platform Tabs Bar */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border">
                    {[
                      { id: "global" as const, label: "Global Default", icon: "🌐" },
                      { id: "instagram" as const, label: "Instagram", icon: "📸" },
                      { id: "facebook" as const, label: "Facebook", icon: "📘" },
                      { id: "tiktok" as const, label: "TikTok", icon: "🎵" },
                      { id: "youtube" as const, label: "YouTube", icon: "▶️" },
                      { id: "gmb" as const, label: "Google Biz", icon: "📍" },
                    ].map((tab) => {
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
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                            isActive
                              ? "bg-[#0A3622] text-white shadow-xs"
                              : "bg-secondary text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span className="text-[11px]">{tab.icon}</span>
                          <span>{tab.label}</span>
                          {hasOverride && (
                            <span className="size-1.5 rounded-full bg-[#C5A059]" />
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
                          placeholder="Write global caption with #AlRamlahTravels, contact lines and package overview..."
                          className="text-xs font-mono leading-relaxed bg-white"
                        />
                      </div>

                      {postFormat !== "STORY" && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              <MessageSquare className="size-3 text-[#C5A059]" />
                              <span>Global First Comment (IG, FB &amp; YT)</span>
                            </span>
                            <button
                              type="button"
                              disabled={isGeneratingFirstComment}
                              onClick={handleGenerateFirstComment}
                              className="inline-flex min-h-6 items-center px-1 text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                            >
                              {isGeneratingFirstComment
                                ? "Generating..."
                                : "Auto-Generate ART-... CTA"}
                            </button>
                          </div>
                          <Textarea
                            rows={2}
                            value={firstComment}
                            onChange={(e) => setFirstComment(e.target.value)}
                            placeholder="Optional pinned first comment with ART-... WhatsApp booking link..."
                            className="text-xs font-mono leading-relaxed bg-white"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            Custom {activeCaptionTab.toUpperCase()} override{" "}
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
                                className="text-[10px] text-rose-600 hover:underline"
                              >
                                Reset to Global
                              </button>
                            )}
                            <span className="font-mono tabular-nums">
                              {(
                                platformCaptions[activeCaptionTab]?.caption ||
                                caption
                              ).length}{" "}
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
                          placeholder={`Custom ${activeCaptionTab} caption...`}
                          className="text-xs font-mono leading-relaxed bg-white"
                        />
                      </div>

                      {["instagram", "facebook", "youtube"].includes(
                        activeCaptionTab
                      ) && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              <MessageSquare className="size-3 text-[#C5A059]" />
                              <span>
                                {activeCaptionTab.toUpperCase()} Pinned First
                                Comment
                              </span>
                            </span>
                            <span className="font-mono tabular-nums">
                              {(
                                platformCaptions[activeCaptionTab]
                                  ?.firstComment ?? firstComment
                              ).length}{" "}
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
                            placeholder={`Custom ${activeCaptionTab} first comment...`}
                            className="text-xs font-mono leading-relaxed bg-white"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Multi-Account Target Social Channels (`T-069`, `T-071`, `OD-07`, `OD-11`) */}
                <div className="space-y-2 pt-2 border-t border-border">
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
                        className="inline-flex min-h-6 items-center px-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Select Eligible
                      </button>
                      <span className="text-border">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTargetIds([])}
                        className="inline-flex min-h-6 items-center px-1 text-[11px] font-medium text-muted-foreground hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {activeIntegrations.length === 0 ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-950 flex items-start gap-2.5">
                      <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          No Social Channels Connected Yet
                        </p>
                        {userRole === "super_admin" ? (
                          <p className="text-[11px] text-amber-900 mt-0.5">
                            Link Instagram, Facebook Pages, TikTok, YouTube, or
                            Google Business in{" "}
                            <a
                              href="/admin/settings?tab=social"
                              className="underline font-bold"
                            >
                              Settings &rarr; Social OAuth
                            </a>{" "}
                            to publish automatically.
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-900 mt-0.5">
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
                          selectedTargetIds.includes(integration.id)

                        return (
                          <div
                            key={integration.id}
                            onClick={() => {
                              if (canSelect) {
                                toggleTargetIntegration(integration.id)
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between rounded-lg border p-2.5 text-xs transition-all",
                              canSelect
                                ? "cursor-pointer hover:border-[#C5A059]"
                                : "bg-muted/40 cursor-not-allowed",
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border bg-white"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold border shrink-0",
                                  platformMeta.color
                                )}
                              >
                                {platformMeta.badge}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-semibold text-foreground truncate text-[11px]">
                                    {integration.name}
                                  </p>
                                  {isYouTubeBlocked && (
                                    <span className="rounded px-1 py-0.2 text-[9px] font-medium bg-amber-500/10 text-amber-900 border border-amber-500/30">
                                      Requires MP4
                                    </span>
                                  )}
                                  {isGmbBlocked && (
                                    <span className="rounded px-1 py-0.2 text-[9px] font-medium bg-amber-500/10 text-amber-900 border border-amber-500/30">
                                      GBP API Pending
                                    </span>
                                  )}
                                  {integration.provider === "tiktok" &&
                                    !tiktokDirectPostApproved && (
                                      <span className="rounded px-1 py-0.2 text-[9px] font-medium bg-slate-100 text-slate-800 border border-slate-300">
                                        Sandbox: SELF_ONLY
                                      </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {integration.handle || platformMeta.name}
                                </p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              aria-label={`Select ${integration.name}`}
                              disabled={!canSelect}
                              checked={Boolean(isSelected)}
                              onChange={() => {}}
                              className="size-3.5 rounded border-input text-primary accent-[#0A3622]"
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* TikTok Direct Post Compliance & Privacy UX (`T-070`, `OD-11`) */}
                {selectedTikTokIntegration && (
                  <div className="rounded-xl border border-slate-300 bg-slate-50/70 p-3.5 space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-[#0A3622]" />
                        <span className="font-bold text-foreground">
                          TikTok Direct Post Privacy &amp; Disclosure Controls
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-slate-300 text-slate-800"
                      >
                        {tiktokCreatorInfo?.creatorNickname ||
                          selectedTikTokIntegration.handle ||
                          selectedTikTokIntegration.name}
                      </Badge>
                    </div>

                    {!tiktokDirectPostApproved && (
                      <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-2.5 py-1.5">
                        TikTok Direct Post audit is pending (`TIKTOK_DIRECT_POST_APPROVED=false`): uploads are restricted to Private (`SELF_ONLY`) visibility until approved.
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          className="flex h-8 w-full rounded-md border border-input bg-white px-2 text-xs"
                        >
                          <option value="">Select TikTok privacy...</option>
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
                              <option
                                key={opt}
                                value={opt}
                                disabled={locked}
                              >
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
                              className="accent-[#0A3622]"
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
                              className="accent-[#0A3622]"
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
                              className="accent-[#0A3622]"
                            />
                            <span>Stitch</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <label className="inline-flex items-center gap-2 font-semibold text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tiktokCommercialToggle}
                          onChange={(e) =>
                            setTiktokCommercialToggle(e.target.checked)
                          }
                          className="accent-[#0A3622]"
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
                              className="accent-[#0A3622]"
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
                              className="accent-[#0A3622]"
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
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                        className="flex h-8 w-full rounded-md border border-input bg-white px-2 text-xs"
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
                        className="h-8 text-xs bg-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2-Step Attention-Grabber Funnel */}
            <div className="rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/5 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Layers className="size-4 text-[#C5A059]" />
                  <div>
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                      <span>2-Step Attention-Grabber Funnel</span>
                      <Badge className="text-[9px] bg-[#C5A059] text-slate-950 font-bold">
                        Algorithmic Boost
                      </Badge>
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Hook the feed with a Single Spotlight first &rarr;
                      auto-publish the complete Multi-Package Sheet after a
                      configurable delay.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-primary">
                  <input
                    type="checkbox"
                    checked={isTwoStepEnabled}
                    onChange={(e) => setIsTwoStepEnabled(e.target.checked)}
                    className="size-4 rounded text-primary accent-[#0A3622]"
                  />
                  <span>Enable 2-Step Funnel</span>
                </label>
              </div>

              {isTwoStepEnabled && (
                <div className="mt-3 pt-3 border-t border-[#C5A059]/20 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Step 2: Paired Follow-Up Sheet
                    </Label>
                    <select
                      aria-label="Step 2 Paired Follow-Up Sheet"
                      value={followUpAssetId}
                      onChange={(e) => setFollowUpAssetId(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-white px-2 text-xs font-mono"
                    >
                      {sheetAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.postCode}] {a.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>Step 2 Automated Delay</span>
                      <span className="font-mono tabular-nums text-primary font-bold">
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
                            "rounded border px-2 py-1 text-[10px] font-bold transition-all cursor-pointer",
                            twoStepDelayMinutes === mins
                              ? "border-primary bg-primary text-white"
                              : "border-border bg-white text-foreground hover:border-[#C5A059]"
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
                        className="h-7 w-20 text-xs font-mono bg-white ml-auto"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reactive Engagement Auto-Plug Card (`T-036`) */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[#C5A059]" />
                  <div>
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                      <span>Reactive Engagement Auto-Plug</span>
                      <Badge className="text-[9px] bg-[#0A3622] text-white">
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

                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-primary">
                  <input
                    type="checkbox"
                    checked={isEngagementPlugEnabled}
                    onChange={(e) =>
                      setIsEngagementPlugEnabled(e.target.checked)
                    }
                    className="size-4 rounded text-primary accent-[#0A3622]"
                  />
                  <span>Enable Auto-Plug</span>
                </label>
              </div>

              {isEngagementPlugEnabled && (
                <div className="pt-2 border-t border-border space-y-3">
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
                        className="h-7 text-xs font-mono bg-white"
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
                        className="h-7 text-xs font-mono bg-white"
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
                      className="text-xs font-mono leading-relaxed bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Embedded Live Core 5 Interactive Device Previewer */}
            <div className="pt-2 border-t border-border">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-border">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                    <input
                      type="radio"
                      name="pubTiming"
                      checked={publishNow}
                      onChange={() => setPublishNow(true)}
                      className="accent-[#0A3622]"
                    />
                    <span>Publish Immediately</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium ml-2">
                    <input
                      type="radio"
                      name="pubTiming"
                      checked={!publishNow}
                      onChange={() => setPublishNow(false)}
                      className="accent-[#0A3622]"
                    />
                    <span>Schedule for Later (PKT)</span>
                  </label>
                </div>

                {!publishNow && (
                  <div className="flex items-center gap-2">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <Input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="h-8 text-xs font-mono bg-white w-48"
                    />
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono border-[#C5A059]/60 text-[#0A3622]"
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
                  className="h-8 text-xs font-bold border-[#C5A059]/60 text-[#0A3622] hover:bg-[#C5A059]/10 gap-1.5 cursor-pointer"
                >
                  {isQueueingNextSlot ? (
                    <Loader2 className="size-3 animate-spin text-[#C5A059]" />
                  ) : (
                    <Clock className="size-3 text-[#C5A059]" />
                  )}
                  <span>Queue in Next Free PKT Slot</span>
                </Button>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || selectedTargetIds.length === 0}
                className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 font-bold text-xs gap-2 cursor-pointer shrink-0"
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin text-[#C5A059]" />
                ) : (
                  <Send className="size-4 text-[#C5A059]" />
                )}
                <span>
                  {publishNow
                    ? `Publish ${postFormat} Immediately (${selectedTargetIds.length} Account${selectedTargetIds.length === 1 ? "" : "s"})`
                    : `Schedule ${postFormat} (${selectedTargetIds.length} Account${selectedTargetIds.length === 1 ? "" : "s"})`}
                </span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Live Scheduled & Published Queue / Visual PKT Calendar */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base font-bold flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
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

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-secondary p-0.5 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setActiveSocialSubView("calendar")}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    activeSocialSubView === "calendar"
                      ? "bg-[#0A3622] text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Visual Calendar (PKT)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSocialSubView("queue")}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    activeSocialSubView === "queue"
                      ? "bg-[#0A3622] text-white shadow-xs"
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
                        "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer",
                        queueFilter === f.id
                          ? "bg-[#0A3622] text-white font-bold"
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

        <CardContent className="p-4 space-y-3">
          {activeSocialSubView === "calendar" ? (
            <SocialCalendarView
              scheduledPosts={scheduledPosts}
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

              return (
                <div
                  key={post.id}
                  className="rounded-xl border border-border bg-white p-3.5 space-y-3 hover:border-[#C5A059]/60 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                        {post.postAsset?.imageUrl || post.mediaUrls[0] ? (
                          <img
                            src={post.postAsset?.imageUrl || post.mediaUrls[0]}
                            alt="Media Preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">
                            Post
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {post.postAsset && (
                            <span className="font-mono text-xs font-bold text-primary">
                              [{post.postAsset.postCode}]
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono border-[#C5A059]/50 text-[#0A3622] uppercase"
                          >
                            {post.postFormat || "FEED"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono capitalize"
                          >
                            {post.campaignStage.replace(/_/g, " ")}
                          </Badge>
                          <Badge
                            className={cn(
                              "text-[10px] font-bold capitalize",
                              post.status === "completed" &&
                                "bg-emerald-600 text-white",
                              post.status === "scheduled" &&
                                "bg-amber-600 text-white",
                              post.status === "publishing" &&
                                "bg-blue-600 text-white",
                              (post.status === "failed" ||
                                post.status === "partially_failed") &&
                                "bg-rose-600 text-white",
                              post.status === "cancelled" &&
                                "bg-slate-500 text-white"
                            )}
                          >
                            {post.status.replace(/_/g, " ")}
                          </Badge>
                          {post.firstComment && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono border-emerald-500/40 text-emerald-800 bg-emerald-50"
                            >
                              + First-Comment CTA
                              {aggregatedMetrics.firstCommentCount > 0
                                ? ` (${aggregatedMetrics.firstCommentCount} Posted)`
                                : ""}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-foreground line-clamp-2 font-mono">
                          {post.caption}
                        </p>

                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5 flex-wrap">
                          <span>
                            Scheduled (PKT): {formatDateSafe(post.scheduledFor)}
                          </span>
                          {post.twoStepDelayMinutes && (
                            <span>• Delay: {post.twoStepDelayMinutes}m</span>
                          )}
                          {aggregatedMetrics.lastSyncedAt && (
                            <span>
                              • Synced:{" "}
                              {formatDateSafe(aggregatedMetrics.lastSyncedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewModalPost(post)}
                        className="h-7 text-[11px] font-semibold border-border text-foreground hover:border-[#C5A059] cursor-pointer gap-1"
                      >
                        <Smartphone className="size-3 text-[#C5A059]" />
                        <span>Preview</span>
                      </Button>

                      {(hasPublishedTargets || post.status === "completed") && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isSyncingAnalytics}
                          onClick={() => handleSyncPostAnalytics(post.id)}
                          className="h-7 text-[11px] font-semibold border-[#C5A059]/60 text-[#0A3622] hover:bg-[#C5A059]/10 cursor-pointer gap-1"
                        >
                          {isSyncingAnalytics ? (
                            <Loader2 className="size-3 animate-spin text-[#C5A059]" />
                          ) : (
                            <BarChart3 className="size-3 text-[#C5A059]" />
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
                          className="h-7 text-[11px] text-rose-700 border-rose-300 hover:bg-rose-50 cursor-pointer"
                        >
                          {isBusy ? (
                            <Loader2 className="size-3 animate-spin mr-1" />
                          ) : (
                            <X className="size-3 mr-1" />
                          )}
                          Cancel Post
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Honest Analytics Strip (`T-036`) */}
                  {(aggregatedMetrics.hasMetrics || hasPublishedTargets) && (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-border/70 bg-secondary/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground flex-wrap">
                          <BarChart3 className="size-3.5 text-[#C5A059]" />
                          <span>Live Engagement Metrics:</span>
                          {aggregatedMetrics.hasMetrics ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono tabular-nums border-[#C5A059]/50 text-[#0A3622]"
                            >
                              {postEngagementRatePct.toFixed(2)}% Eng. Rate
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono border-amber-400 bg-amber-50 text-amber-900"
                            >
                              Analytics unavailable — click Sync Metrics
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-[11px]">
                          {aggregatedMetrics.hasMetrics && (
                            <>
                              <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-border">
                                <Eye className="size-3 text-primary" />
                                <span>Views:</span>
                                <strong>
                                  {aggregatedMetrics.impressions.toLocaleString()}
                                </strong>
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-border">
                                <Heart className="size-3 text-rose-600" />
                                <span>Likes:</span>
                                <strong>
                                  {aggregatedMetrics.likes.toLocaleString()}
                                </strong>
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-border">
                                <MessageSquare className="size-3 text-blue-600" />
                                <span>Comments:</span>
                                <strong>
                                  {aggregatedMetrics.comments.toLocaleString()}
                                </strong>
                              </span>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleBreakdownExpand(post.id)}
                            className="inline-flex items-center gap-1 rounded bg-[#0A3622] text-white px-2 py-0.5 text-[10px] font-sans font-bold cursor-pointer hover:bg-[#0A3622]/90"
                          >
                            <span>
                              {isBreakdownExpanded
                                ? "Hide Breakdown"
                                : "Per-Platform Breakdown"}
                            </span>
                            {isBreakdownExpanded ? (
                              <ChevronUp className="size-3 text-[#C5A059]" />
                            ) : (
                              <ChevronDown className="size-3 text-[#C5A059]" />
                            )}
                          </button>
                        </div>
                      </div>

                      {isBreakdownExpanded && (
                        <div className="rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/5 p-3 space-y-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {post.targets.map((target) => {
                              const data = target.analyticsData
                              if (!data) {
                                return (
                                  <div
                                    key={target.id}
                                    className="rounded-lg border border-border bg-white p-2.5 space-y-1.5 text-[11px]"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] font-mono uppercase border-primary/30 text-primary"
                                      >
                                        {target.integration.provider}
                                      </Badge>
                                      <span className="text-[10px] text-amber-800 font-medium">
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
                                  className="rounded-lg border border-border bg-white p-2.5 space-y-2 text-[11px]"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] font-mono uppercase border-primary/30 text-primary"
                                      >
                                        {target.integration.provider}
                                      </Badge>
                                      <span className="font-semibold truncate text-foreground">
                                        {target.integration.name}
                                      </span>
                                    </div>
                                    <span className="font-mono tabular-nums text-[10px] font-bold text-[#0A3622]">
                                      {ratePct.toFixed(2)}%
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-5 gap-1 text-center font-mono tabular-nums text-[10px] bg-secondary/30 rounded p-1.5">
                                    <div>
                                      <p className="text-[9px] text-muted-foreground">
                                        Views
                                      </p>
                                      <p className="font-bold">
                                        {views.toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-muted-foreground">
                                        Likes
                                      </p>
                                      <p className="font-bold">
                                        {likes.toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-muted-foreground">
                                        Cmts
                                      </p>
                                      <p className="font-bold">
                                        {comments.toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-muted-foreground">
                                        Shares
                                      </p>
                                      <p className="font-bold">
                                        {shares.toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-muted-foreground">
                                        Clicks
                                      </p>
                                      <p className="font-bold">
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
                                          className="text-primary hover:underline inline-flex items-center gap-0.5 font-semibold"
                                        >
                                          <span>Open Post</span>
                                          <ExternalLink className="size-2.5" />
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
                  <div className="pt-2 border-t border-border/70 flex flex-wrap items-center gap-2">
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
                              "bg-emerald-50 border-emerald-300 text-emerald-900",
                            target.status === "pending" &&
                              "bg-amber-50 border-amber-300 text-amber-900",
                            target.status === "publishing" &&
                              "bg-blue-50 border-blue-300 text-blue-900",
                            target.status === "failed" &&
                              "bg-rose-50 border-rose-300 text-rose-900",
                            target.status === "skipped" &&
                              "bg-slate-50 border-slate-300 text-slate-700"
                          )}
                        >
                          <span className="font-bold uppercase text-[9px]">
                            {target.integration.provider}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="capitalize text-[10px]">
                            {target.status}
                          </span>

                          {targetAnalytics && (
                            <span className="font-mono tabular-nums text-[10px] text-emerald-800 bg-white/80 rounded px-1">
                              {targetAnalytics.impressions}v ·{" "}
                              {targetAnalytics.likes}♥
                            </span>
                          )}

                          {(target.firstCommentExternalId ||
                            targetAnalytics?.firstCommentId) && (
                            <span
                              className="text-[9px] font-mono text-[#0A3622] bg-[#C5A059]/20 rounded px-1"
                              title="First-Comment Auto-Plug Posted"
                            >
                              1st-Cmt ✓
                            </span>
                          )}

                          {target.publishedUrl && (
                            <a
                              href={target.publishedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:underline"
                            >
                              <ExternalLink className="size-3" />
                            </a>
                          )}

                          {target.status === "failed" && (
                            <button
                              type="button"
                              disabled={isTargetBusy}
                              onClick={() => handleRetryTarget(target.id)}
                              className="ml-1 inline-flex items-center gap-1 font-bold text-rose-700 hover:underline cursor-pointer"
                            >
                              {isTargetBusy ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <RefreshCw className="size-3" />
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
            <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
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
                  className="h-7 text-xs gap-1"
                >
                  <ChevronLeft className="size-3.5" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={postsPage >= totalPostsPages}
                  onClick={() => onPostsPageChange(postsPage + 1)}
                  className="h-7 text-xs gap-1"
                >
                  Next
                  <ChevronRight className="size-3.5" />
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold flex items-center gap-2">
              <Smartphone className="size-4 text-[#C5A059]" />
              <span>
                Core 5 Platform Preview{" "}
                {previewModalPost?.postAsset
                  ? `• [${previewModalPost.postAsset.postCode}]`
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
            >
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Studio Composer Modal */}
      <Dialog open={isComposerModalOpen} onOpenChange={setIsComposerModalOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold flex items-center gap-2">
              <Sparkles className="size-4 text-[#C5A059]" />
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  Linked 4K Poster Asset (`ART-...`)
                </Label>
                <select
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-mono"
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
                  className="text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/5 p-3">
                <span className="text-xs font-bold text-foreground">
                  2-Step Mode (`SPOTLIGHT_THEN_SHEET`)
                </span>
                <input
                  type="checkbox"
                  checked={isTwoStepEnabled}
                  onChange={(e) => setIsTwoStepEnabled(e.target.checked)}
                  className="size-4 accent-[#0A3622]"
                />
              </div>

              {postFormat !== "STORY" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">
                      Pinned First Comment (`ART-...`)
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleGenerateFirstComment}
                      className="h-6 text-[10px]"
                    >
                      Auto-Generate CTA
                    </Button>
                  </div>
                  <Textarea
                    rows={3}
                    value={firstComment}
                    onChange={(e) => setFirstComment(e.target.value)}
                    className="text-xs font-mono"
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
          setSelectedAssetId(asset.id)
          setMediaUrls([asset.imageUrl])
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
  postAssets,
  marketingChannels,
  dailyDistributions,
}: {
  initialAssetId: string
  postAssets: PostAssetRecord[]
  marketingChannels: MarketingChannelRecord[]
  dailyDistributions: DistributionRecord[]
}) {
  const router = useRouter()

  const todayPktKey = React.useMemo(() => formatPktDateKey(new Date()), [])
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

  React.useEffect(() => {
    if (selectedAsset?.captionWhatsapp) {
      setWhatsappCaption(selectedAsset.captionWhatsapp)
    }
  }, [selectedAsset])

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
      <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm text-emerald-950">
                100% Ban-Safe Manual Assisted WhatsApp Group &amp; Status Queue
              </h4>
              <Badge
                variant="outline"
                className="text-[10px] bg-white border-emerald-400 text-emerald-900 font-semibold"
              >
                Zero Unofficial Bot Risk
              </Badge>
              {failedCountToday > 0 && (
                <Badge className="text-[10px] bg-rose-600 text-white font-semibold">
                  {failedCountToday} Failed Dispatch
                  {failedCountToday > 1 ? "es" : ""} Need Manual Share
                </Badge>
              )}
            </div>
            <p className="text-emerald-900 text-[11px] max-w-3xl">
              Protect official Al Ramlah WhatsApp numbers from automated group
              bans: copy the formatted caption in 1 tap, download the 4K poster,
              share via WhatsApp Web / Desktop, and log completion below.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
            className="border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-950 text-xs font-semibold gap-1.5 h-8 cursor-pointer"
          >
            <Smartphone className="size-3.5 text-[#C5A059]" />
            <span>Open WhatsApp Web</span>
          </Button>
        </div>
      </div>

      {actionNotice && (
        <div
          role="alert"
          className={cn(
            "rounded-xl border p-3.5 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs",
            actionNotice.type === "success"
              ? "border-emerald-400 bg-emerald-50 text-emerald-950"
              : "border-rose-400 bg-rose-50 text-rose-950"
          )}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === "success" ? (
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="size-4 text-rose-600 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="underline cursor-pointer text-[11px] shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Active 4K Poster & 1-Tap Manual Assisted Bar */}
      <Card className="border-[#C5A059]/40 bg-card shadow-sm">
        <CardHeader className="bg-secondary/20 border-b border-border pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base font-bold flex items-center gap-2">
                <Sparkles className="size-4 text-[#C5A059]" />
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
              <Calendar className="size-4 text-[#C5A059]" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 w-36 font-mono text-xs bg-white"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-primary">
                  Select Poster Asset to Share
                </Label>
                <select
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-mono"
                >
                  {postAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.postCode}] {a.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAsset && (
                <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
                  <div
                    className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-muted group cursor-pointer"
                    onClick={() => setPreviewPosterUrl(selectedAsset.imageUrl)}
                  >
                    {selectedAsset.imageUrl ? (
                      <img
                        src={selectedAsset.imageUrl}
                        alt={selectedAsset.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No Preview
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-bold text-foreground">
                        Click to Preview 4K
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-center">
                    <p className="font-mono text-xs font-bold text-primary">
                      {selectedAsset.postCode}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate font-medium">
                      {selectedAsset.title}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-8 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Formatted WhatsApp Caption</span>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      WhatsApp Markdown Ready
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                    {whatsappCaption.length} chars
                  </span>
                </div>
                <Textarea
                  rows={7}
                  value={whatsappCaption}
                  onChange={(e) => setWhatsappCaption(e.target.value)}
                  className="text-xs font-mono leading-relaxed bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Button
                  type="button"
                  onClick={handleCopyCaption}
                  className={cn(
                    "h-9 text-xs font-bold gap-1.5 cursor-pointer transition-all",
                    copiedCaption
                      ? "bg-emerald-600 text-white"
                      : "bg-[#0A3622] text-white hover:bg-[#0A3622]/90"
                  )}
                >
                  {copiedCaption ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5 text-[#C5A059]" />
                  )}
                  <span>
                    {copiedCaption ? "Caption Copied!" : "1-Tap Copy Caption"}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDownloadPoster()}
                  className="h-9 text-xs font-semibold gap-1.5 border-border hover:bg-white cursor-pointer"
                >
                  <Download className="size-3.5 text-[#C5A059]" />
                  <span>1-Tap Download 4K Poster</span>
                </Button>

                {selectedChannelIds.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBulkLogging || !selectedAsset}
                    onClick={handleBulkMarkShared}
                    className="h-9 text-xs font-bold border-emerald-400 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 gap-1.5 cursor-pointer"
                  >
                    {isBulkLogging ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5 text-emerald-700" />
                    )}
                    <span>
                      Mark Selected Shared ({selectedChannelIds.length})
                    </span>
                  </Button>
                )}
              </div>

              {/* Daily Progress Bar */}
              <div className="rounded-xl border border-border bg-secondary/15 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" />
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
                      <span className="text-rose-700 font-bold">
                        • {failedCountToday} Failed
                      </span>
                    )}
                  </div>
                </div>
                <Progress value={progressPercent} className="h-2 bg-secondary" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. WhatsApp Groups & Status Channel Matrix */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base font-bold flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <span>
                  WhatsApp Community Groups &amp; Status Queue (
                  {whatsappChannels.length})
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Track daily assisted shares across community groups and official
                WhatsApp Status lines. Failed dispatches are highlighted in red
                and excluded from completed share counts.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search WhatsApp groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs w-44 bg-white"
                />
              </div>

              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="flex h-8 rounded-md border border-input bg-background px-2.5 text-xs"
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
          <div className="bg-secondary/25 border-b border-border px-4 py-2.5 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
              Filter by Phone Line:
            </span>
            <button
              type="button"
              onClick={() => setSelectedLineFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                selectedLineFilter === "all"
                  ? "bg-[#0A3622] text-white border-[#C5A059]"
                  : "bg-white text-muted-foreground hover:text-foreground border-border"
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
                    "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5",
                    selectedLineFilter === line
                      ? "bg-[#0A3622] text-white border-[#C5A059]"
                      : "bg-white text-muted-foreground hover:text-foreground border-border"
                  )}
                >
                  <span>📱</span>
                  <span>{line}</span>
                  <span className="text-[10px] opacity-80 font-mono tabular-nums">
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <CardContent className="p-4">
          {whatsappChannels.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-8 sm:p-12 text-center space-y-3">
              <div className="size-12 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center mx-auto text-emerald-800">
                <Users className="size-6" />
              </div>
              <h4 className="font-bold text-base text-emerald-950">
                No WhatsApp Groups or Status Channels Registered Yet
              </h4>
              <p className="text-xs text-emerald-900 max-w-md mx-auto">
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
                    onClick={() => handleToggleChannel(ch.id)}
                    className={cn(
                      "rounded-xl border p-3.5 space-y-2.5 transition-all bg-white cursor-pointer select-none",
                      isSelected
                        ? "border-[#0A3622] ring-2 ring-[#0A3622]/20 bg-emerald-50/20"
                        : isFailed
                        ? "border-rose-300 bg-rose-50/30"
                        : isShared
                        ? "border-emerald-300 bg-emerald-50/10"
                        : "border-border hover:border-[#C5A059]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleToggleChannel(ch.id)
                          }}
                          className="size-4 mt-0.5 rounded border-border text-[#0A3622] accent-[#0A3622] cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 border-[#C5A059]/50 text-[#0A3622] uppercase font-bold"
                            >
                              {ch.areaTag}
                            </Badge>
                            {ch.senderWhatsappNumber && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono px-2 py-0 border-emerald-500/50 bg-emerald-50 text-emerald-900 font-bold"
                              >
                                📱 {ch.senderWhatsappNumber}
                              </Badge>
                            )}
                          </div>

                          <h4 className="text-xs font-bold text-foreground mt-1 truncate">
                            {ch.name}
                          </h4>

                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MessageSquare className="size-3 text-emerald-600" />
                            <span className="capitalize">
                              {ch.platform.replace(/_/g, " ")}
                            </span>
                            {ch.memberCount
                              ? ` · ~${ch.memberCount} members`
                              : ""}
                          </p>
                        </div>
                      </div>

                      {isShared ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          <span>Shared</span>
                        </span>
                      ) : isFailed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-[10px] font-bold text-rose-800 shrink-0">
                          <XCircle className="size-3 text-rose-600" />
                          <span>Failed</span>
                        </span>
                      ) : isQueued ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900 shrink-0">
                          <Clock className="size-3 text-amber-700" />
                          <span>Queued</span>
                        </span>
                      ) : (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                          Pending
                        </span>
                      )}
                    </div>

                    {distributionLog?.postAsset && (
                      <div className="text-[10px] text-muted-foreground font-mono bg-secondary/40 p-1.5 rounded">
                        Ref: {distributionLog.postAsset.postCode}
                      </div>
                    )}

                    <div
                      className="flex items-center justify-between gap-2 pt-2 border-t border-border/70"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {ch.inviteLinkOrUrl && (
                        <a
                          href={ch.inviteLinkOrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:border-[#C5A059]"
                        >
                          <ExternalLink className="size-3 text-[#C5A059]" />
                          <span>Open</span>
                        </a>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy || !selectedAsset}
                        onClick={() => handleMarkSharedToday(ch.id)}
                        className={cn(
                          "h-7 text-[11px] font-bold gap-1 cursor-pointer flex-1",
                          isShared
                            ? "border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                            : "bg-[#0A3622] text-white hover:bg-[#0A3622]/90"
                        )}
                      >
                        {isBusy ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : isShared ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <CheckCircle2 className="size-3 text-[#C5A059]" />
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
        <DialogContent className="max-w-2xl p-2 bg-black/95 text-white border-[#C5A059]/40">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg">
            {previewPosterUrl && (
              <img
                src={previewPosterUrl}
                alt="4K Poster Preview"
                className="h-full w-full object-contain"
              />
            )}
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="text-xs font-mono text-[#C5A059]">
              Al Ramlah Travels 4K Ultra-High-Resolution Poster
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => handleDownloadPoster(previewPosterUrl || undefined)}
              className="bg-[#C5A059] text-black font-bold text-xs"
            >
              <Download className="size-3.5 mr-1" />
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

  // Reset `selectedTemplateId` whenever WABA account changes (`T-071`)
  React.useEffect(() => {
    if (!approvedTemplates.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(approvedTemplates[0]?.id || "")
    }
  }, [approvedTemplates, selectedTemplateId])

  const selectedTemplate = React.useMemo(() => {
    return approvedTemplates.find((t) => t.id === selectedTemplateId)
  }, [approvedTemplates, selectedTemplateId])

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

  const computedRecipientPhones = React.useMemo(() => {
    const now = new Date()

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
  }, [recipientSegment, customPhonesText, outreachContacts, parsedCsv])

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
      !selectedTemplateId ||
      !approvedTemplates.some((t) => t.id === selectedTemplateId)
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
        templateId: selectedTemplateId,
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
      <Card className="border-[#C5A059]/40 bg-card shadow-sm">
        <CardHeader className="bg-secondary/20 border-b border-border pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base font-bold flex items-center gap-2">
                <Send className="size-4 text-[#C5A059]" />
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
              className="text-[11px] font-mono tabular-nums border-primary/30 text-primary"
            >
              {approvedTemplates.length} Approved Templates on Selected Line
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {!isSuperAdmin && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 flex items-center gap-2.5">
              <Lock className="size-4 text-amber-700 shrink-0" />
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
                "rounded-xl border p-3.5 text-xs font-semibold flex items-center justify-between gap-2",
                broadcastNotice.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : "border-rose-300 bg-rose-50 text-rose-950"
              )}
            >
              <span>{broadcastNotice.message}</span>
              <button
                type="button"
                onClick={() => setBroadcastNotice(null)}
                className="underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          <form onSubmit={handleLaunchBroadcast} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      WhatsApp Business Account
                    </Label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
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
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Approved Meta Template (Scoped to Selected WABA)</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Only &apos;APPROVED&apos; templates on this line
                    </span>
                  </Label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={!isSuperAdmin || approvedTemplates.length === 0}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-mono"
                  >
                    {approvedTemplates.length === 0 ? (
                      <option value="">
                        No APPROVED templates on selected WABA account
                      </option>
                    ) : (
                      approvedTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} [{t.language}] — {t.category}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {selectedTemplate && (
                  <div className="rounded-xl border border-border bg-secondary/15 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-primary">
                        Template Preview: {selectedTemplate.name}
                      </span>
                      <Badge className="text-[9px] bg-emerald-600 text-white font-mono">
                        {selectedTemplate.category}
                      </Badge>
                    </div>

                    {selectedTemplate.headerContent && (
                      <p className="font-bold text-xs text-foreground">
                        {selectedTemplate.headerContent}
                      </p>
                    )}

                    <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap bg-white p-2.5 rounded-lg border border-border leading-relaxed">
                      {selectedTemplate.bodyText}
                    </p>

                    {selectedTemplate.footerText && (
                      <p className="text-[10px] text-muted-foreground italic">
                        {selectedTemplate.footerText}
                      </p>
                    )}
                  </div>
                )}

                {selectedTemplate && isSuperAdmin && (
                  <div className="pt-2">
                    <WhatsappBroadcastPersonalizerFields
                      templateBodyText={selectedTemplate.bodyText || ""}
                      templateHeaderType={
                        selectedTemplate.headerType || "NONE"
                      }
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

              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Target Recipient Segment
                    </Label>
                    <span className="font-mono tabular-nums text-xs font-bold text-primary">
                      {computedRecipientPhones.length} Recipients
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
                        desc: "All contacts excluding do_not_contact",
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
                          "flex items-start gap-2.5 rounded-lg border p-2.5 text-xs cursor-pointer transition-all",
                          recipientSegment === seg.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border bg-white hover:border-[#C5A059]"
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
                          className="mt-0.5 accent-[#0A3622]"
                        />
                        <div>
                          <p className="font-semibold text-foreground text-[11px]">
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
                      className="text-xs font-mono bg-white mt-2"
                    />
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border">
                  <Label className="text-xs font-semibold">
                    Schedule Timing in PKT (Optional)
                  </Label>
                  <Input
                    type="datetime-local"
                    disabled={!isSuperAdmin}
                    value={scheduledBroadcastTime}
                    onChange={(e) => setScheduledBroadcastTime(e.target.value)}
                    className="h-9 text-xs font-mono bg-white"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Interpreted in Asia/Karachi (+05:00). Leave blank to
                    dispatch immediately.
                  </p>
                </div>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="flex items-center justify-end pt-3 border-t border-border">
                <Button
                  type="submit"
                  disabled={
                    isLaunchingBroadcast ||
                    computedRecipientPhones.length === 0 ||
                    !selectedTemplateId
                  }
                  className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 font-bold text-xs gap-2 cursor-pointer"
                >
                  {isLaunchingBroadcast ? (
                    <Loader2 className="size-4 animate-spin text-[#C5A059]" />
                  ) : (
                    <Send className="size-4 text-[#C5A059]" />
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
            <div className="pt-4 border-t border-border space-y-3">
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
                      className="rounded-lg border border-border bg-white p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-foreground">{bc.name}</strong>
                          <Badge
                            variant="outline"
                            className="text-[9px] font-mono border-primary/30"
                          >
                            {bc.templateName}
                          </Badge>
                          <Badge
                            className={cn(
                              "text-[9px] capitalize",
                              bc.status === "completed" &&
                                "bg-emerald-600 text-white",
                              bc.status === "processing" &&
                                "bg-blue-600 text-white",
                              bc.status === "scheduled" &&
                                "bg-amber-600 text-white",
                              bc.status === "failed" &&
                                "bg-rose-600 text-white"
                            )}
                          >
                            {bc.status}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Started: {formatDateSafe(bc.startedAt || bc.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums flex-wrap">
                        <span>Total: {bc.totalRecipients}</span>
                        <span className="text-emerald-700">
                          Sent: {bc.sentCount}
                        </span>
                        <span className="text-primary font-bold">
                          Delivered: {deliveryRate}%
                        </span>
                        {bc.failedCount > 0 && (
                          <span className="text-rose-600">
                            Failed: {bc.failedCount}
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenBroadcastDetails(bc)}
                          className="h-7 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer ml-1"
                        >
                          <Eye className="size-3" />
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-foreground">
                1-on-1 VIP Personal Outreach CRM
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-emerald-400 text-emerald-900 bg-emerald-50"
              >
                14-Day Safeguard Active
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Personal high-touch relationship cultivation for prospective
              pilgrims served from our {officeLocationLabel} headquarters. Every
              personal package share triggers an automatic 14-day cooldown
              timer, unlocking automatically upon inbound customer reply.
            </p>
          </div>

          {totalContactsPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
              <span className="tabular-nums">
                Contacts Page {contactsPage}/{totalContactsPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={contactsPage <= 1}
                onClick={() => onContactsPageChange(contactsPage - 1)}
                className="h-7 text-xs px-2"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={contactsPage >= totalContactsPages}
                onClick={() => onContactsPageChange(contactsPage + 1)}
                className="h-7 text-xs px-2"
              >
                <ChevronRight className="size-3.5" />
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
