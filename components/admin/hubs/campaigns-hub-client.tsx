"use client"

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Image from "next/image"
import {
  Share2,
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
  XCircle,
  Loader2,
  ExternalLink,
  Eye,
  RefreshCw,
  Layers,
  Filter,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Users,
  Radio,
  Globe,
  Tag,
  Building2,
  FileText,
  ChevronRight,
  X,
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
  CardFooter,
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
  type SafeSocialIntegration,
  type ScheduledPostWithTargets,
} from "@/app/actions/social-scheduler"
import { createAndQueueWhatsappBroadcastAction } from "@/app/actions/whatsapp-crm"
import {
  dispatchOrLogDistribution,
  upsertMarketingChannel,
} from "@/app/actions/marketing-ops"
import {
  OutreachClient,
  type OutreachContactRow,
  type OutreachAssetRow,
  type OutreachLogRow,
} from "@/components/admin/marketing/outreach-client"
import { computeOutreachCooldownState } from "@/lib/domain/marketing-ops"
import { cn } from "@/lib/utils"

// ==========================================
// 1. DATA CONTRACTS & INTERFACES
// ==========================================

export type { SafeSocialIntegration }

export interface ScheduledPostTargetItem {
  id: string
  scheduledPostId: string
  integrationId: string
  status: "pending" | "publishing" | "published" | "failed" | "skipped"
  publishedUrl: string | null
  externalPostId: string | null
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
  kind: "multi_package_sheet" | "single_package_spotlight" | "custom_quotation_pdf"
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

export type CampaignsTabKey = "social" | "whatsapp" | "outreach"

export interface CampaignsHubClientProps {
  initialTab?: string
  initialAssetId?: string
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
      "Manual assisted distribution queue for 30+ community groups and 2 WhatsApp Status lines with 1-tap formatted caption copying and 4K poster downloads.",
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
  { id: "instagram", name: "Instagram Business", badge: "IG", color: "bg-pink-100 text-pink-800 border-pink-300" },
  { id: "facebook", name: "Facebook Pages", badge: "FB", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { id: "tiktok", name: "TikTok Business", badge: "TikTok", color: "bg-slate-100 text-slate-900 border-slate-300" },
  { id: "youtube", name: "YouTube Channel", badge: "YT", color: "bg-red-100 text-red-800 border-red-300" },
  { id: "gmb", name: "Google Business Profile", badge: "GMB", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
]

function formatDateSafe(val: Date | string | null | undefined): string {
  if (!val) return "—"
  const d = typeof val === "string" ? new Date(val) : val
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-PK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ==========================================
// 2. MAIN HUB CLIENT
// ==========================================

export function CampaignsHubClient({
  initialTab = "social",
  initialAssetId = "",
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

  const validTabKeys: CampaignsTabKey[] = ["social", "whatsapp", "outreach"]

  const activeTab: CampaignsTabKey = React.useMemo(() => {
    const urlTab = searchParams.get("tab") as CampaignsTabKey | null
    if (urlTab && validTabKeys.includes(urlTab)) {
      return urlTab
    }
    if (validTabKeys.includes(initialTab as CampaignsTabKey)) {
      return initialTab as CampaignsTabKey
    }
    return "social"
  }, [searchParams, initialTab])

  const handleTabChange = (key: CampaignsTabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Active Meta Tab Details
  const activeMeta =
    CAMPAIGN_TABS.find((t) => t.key === activeTab) || CAMPAIGN_TABS[0]

  // Global KPIs
  const activeSocialAccountsCount = socialIntegrations.filter(
    (i) => i.isActive
  ).length
  const totalChannelsCount = marketingChannels.length
  const scheduledCount = scheduledPosts.filter(
    (p) => p.status === "scheduled" || p.status === "publishing"
  ).length
  const vipContactsCount = outreachContacts.length

  return (
    <div className="flex flex-col gap-6">
      {/* Hub Header */}
      <div className="flex flex-col gap-2 border-b border-border/80 pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#C5A059]">
            Hub 2 • Campaigns &amp; Multi-Channel Outreach
          </span>
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5"
          >
            {activeSocialAccountsCount} Social Channels • {totalChannelsCount} WhatsApp Groups • {vipContactsCount} VIP Contacts
          </Badge>
          {scheduledCount > 0 && (
            <Badge className="text-[10px] bg-emerald-600 text-white font-mono">
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
                  <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-mono">
                    {scheduledPosts.length}
                  </span>
                )}
                {tab.key === "whatsapp" && (
                  <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-mono">
                    {marketingChannels.length}
                  </span>
                )}
                {tab.key === "outreach" && (
                  <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-mono">
                    {outreachContacts.length}
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
  socialIntegrations,
  scheduledPosts,
  postAssets,
  supplierFlyers,
}: {
  initialAssetId: string
  socialIntegrations: SafeSocialIntegration[]
  scheduledPosts: ScheduledPostItem[]
  postAssets: PostAssetRecord[]
  supplierFlyers: SupplierFlyerRecord[]
}) {
  const router = useRouter()

  // Selected Primary Asset
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

  // Caption state
  const [caption, setCaption] = React.useState<string>(() => {
    return (
      selectedAsset?.captionInstagram ||
      selectedAsset?.captionWhatsapp ||
      ""
    )
  })

  // Synchronize caption when asset selection changes
  React.useEffect(() => {
    if (selectedAsset) {
      setCaption(
        selectedAsset.captionInstagram ||
        selectedAsset.captionWhatsapp ||
        ""
      )
    }
  }, [selectedAsset])

  // Linked Supplier Flyer & 1080x1520 Normalized Social Sheet
  const matchingFlyer = React.useMemo(
    () => supplierFlyers.find((f) => f.id === selectedAsset?.flyerId),
    [supplierFlyers, selectedAsset?.flyerId]
  )

  const preferredAssetMediaUrl = React.useMemo(() => {
    return (
      matchingFlyer?.socialReadySheetJpegUrl ||
      selectedAsset?.imageUrl ||
      ""
    )
  }, [matchingFlyer?.socialReadySheetJpegUrl, selectedAsset?.imageUrl])

  // Custom Media URLs
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

  // Target Integrations Selection
  const activeIntegrations = React.useMemo(
    () => socialIntegrations.filter((i) => i.isActive),
    [socialIntegrations]
  )

  const [selectedTargetIds, setSelectedTargetIds] = React.useState<string[]>(
    () =>
      activeIntegrations
        .filter((i) => (i.provider === "youtube" ? isVideoMedia : true))
        .map((i) => i.id)
  )

  // Deselect YouTube if media is changed to non-video
  React.useEffect(() => {
    if (!isVideoMedia && mediaUrls.length > 0) {
      setSelectedTargetIds((prev) => {
        const yt = activeIntegrations.find((i) => i.provider === "youtube")
        return yt && prev.includes(yt.id) ? prev.filter((id) => id !== yt.id) : prev
      })
    }
  }, [isVideoMedia, mediaUrls.length, activeIntegrations])

  const toggleTargetIntegration = (id: string) => {
    const integration = activeIntegrations.find((i) => i.id === id)
    if (integration?.provider === "youtube" && !isVideoMedia) {
      return
    }
    setSelectedTargetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // Publication Scheduling
  const [publishNow, setPublishNow] = React.useState(true)
  const [scheduledDateTime, setScheduledDateTime] = React.useState<string>(() => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 16)
  })

  // 2-Step Attention-Grabber Funnel Toggle
  const [isTwoStepEnabled, setIsTwoStepEnabled] = React.useState(false)
  const [twoStepDelayMinutes, setTwoStepDelayMinutes] = React.useState(180)

  // Paired Step-2 Follow-Up Sheet
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

  // Form Submitting & Alerts
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [composerNotice, setComposerNotice] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Queue actions state
  const [busyActionId, setBusyActionId] = React.useState<string | null>(null)
  const [queueFilter, setQueueFilter] = React.useState<string>("all")

  // Handle Create Scheduled Post
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

    setIsSubmitting(true)
    setComposerNotice(null)

    try {
      const scheduledDate = publishNow
        ? new Date()
        : new Date(scheduledDateTime)

      const finalMediaUrls = mediaUrls.filter((u) => u.trim().length > 0)

      const payload = {
        postAssetId: selectedAssetId || undefined,
        caption: caption.trim(),
        postType: "single_image" as const,
        mediaUrls: finalMediaUrls,
        campaignStage: isTwoStepEnabled
          ? ("step_1_spotlight_hook" as const)
          : ("standalone" as const),
        scheduledFor: scheduledDate,
        targetIntegrationIds: selectedTargetIds,
        twoStepDelayMinutes: isTwoStepEnabled ? twoStepDelayMinutes : 180,
        publishNow,
        title: selectedAsset?.title,
        followUpPost:
          isTwoStepEnabled && followUpAssetId
            ? {
                caption: followUpCaption.trim(),
                postAssetId: followUpAssetId,
                mediaUrls: followUpAsset?.imageUrl ? [followUpAsset.imageUrl] : [],
                postType: "carousel" as const,
                title: followUpAsset?.title,
              }
            : undefined,
      }

      const res = await createScheduledSocialPostAction(payload)

      if (res.success) {
        setComposerNotice({
          type: "success",
          message: publishNow
            ? `Post successfully published across ${selectedTargetIds.length} connected channel(s)!`
            : `Post successfully scheduled for ${formatDateSafe(scheduledDate)} across ${selectedTargetIds.length} channel(s)!`,
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

  // Handle Cancel Post
  const handleCancelPost = async (postId: string) => {
    setBusyActionId(postId)
    try {
      const res = await cancelScheduledPostAction({ postId })
      if (res.success) {
        router.refresh()
      } else {
        alert(res.error || "Failed to cancel post")
      }
    } finally {
      setBusyActionId(null)
    }
  }

  // Handle Retry Target
  const handleRetryTarget = async (targetId: string) => {
    setBusyActionId(targetId)
    try {
      const res = await retryFailedPostTargetAction({ targetId })
      if (res.success) {
        router.refresh()
      } else {
        alert(res.error || "Target retry failed")
      }
    } finally {
      setBusyActionId(null)
    }
  }

  // Filtered Queue Posts
  const filteredPosts = React.useMemo(() => {
    if (queueFilter === "all") return scheduledPosts
    return scheduledPosts.filter((p) => p.status === queueFilter)
  }, [scheduledPosts, queueFilter])

  return (
    <div className="flex flex-col gap-8">
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
                Broadcast official Al Ramlah 4K posters &amp; spotlights directly to Instagram, Facebook Pages, TikTok, YouTube &amp; Google Business Profile.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="text-[11px] font-mono border-primary/30 text-primary"
              >
                {activeIntegrations.length} / 5 Channels Connected
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {composerNotice && (
            <div
              className={cn(
                "rounded-xl border p-3.5 text-xs font-semibold flex items-center justify-between",
                composerNotice.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : "border-rose-300 bg-rose-50 text-rose-950"
              )}
            >
              <span>{composerNotice.message}</span>
              <button
                type="button"
                onClick={() => setComposerNotice(null)}
                className="underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <form onSubmit={handleCreatePost} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Asset & Media Selection (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-primary flex items-center justify-between">
                    <span>1. Select 4K Poster / Spotlight Asset</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {postAssets.length} Available
                    </span>
                  </Label>
                  <select
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
                            className="text-[9px] px-1.5 py-0 border-[#C5A059]/40 text-[#C5A059] uppercase font-semibold"
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

                {/* Additional Media URL input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Attached Media URLs ({mediaUrls.length})
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://... image or video URL"
                      value={customMediaInput}
                      onChange={(e) => setCustomMediaInput(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (customMediaInput.trim()) {
                          setMediaUrls((prev) => [...prev, customMediaInput.trim()])
                          setCustomMediaInput("")
                        }
                      }}
                      className="h-8 text-xs shrink-0"
                    >
                      <Plus className="size-3 mr-1" />
                      Add URL
                    </Button>
                  </div>
                  {mediaUrls.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {mediaUrls.map((url, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
                        >
                          <span className="truncate max-w-[140px]">{url}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setMediaUrls((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="hover:text-rose-600"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Caption & Target Channels (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      2. Social Media Caption &amp; Hashtags
                    </Label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {caption.length} Characters
                    </span>
                  </div>
                  <Textarea
                    rows={6}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write caption with #AlRamlahTravels, contact lines and package overview..."
                    className="text-xs font-mono leading-relaxed"
                  />
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        setCaption(
                          (prev) =>
                            prev +
                            "\n\n📞 *Book Now with Al Ramlah Travels:*\n• 03274029701\n• 03190462638\n🌐 Askari 10 & DHA Lahore"
                        )
                      }
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      + Add Booking Helpline
                    </button>
                    <span className="text-border">•</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCaption(
                          (prev) =>
                            prev +
                            "\n\n#Umrah2026 #AlRamlahTravels #Askari10 #DHALahore #Makkah #Madinah #UmrahPackages"
                        )
                      }
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      + Add Viral Hashtags
                    </button>
                  </div>
                </div>

                {/* Target Connected Social Channels */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      3. Target Social Channels (Core 5)
                    </Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const eligible = activeIntegrations.filter((i) =>
                            i.provider === "youtube" ? isVideoMedia : true
                          )
                          setSelectedTargetIds(eligible.map((i) => i.id))
                        }}
                        className="text-[11px] font-semibold text-primary hover:underline"
                      >
                        Select All Connected
                      </button>
                      <span className="text-border">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTargetIds([])}
                        className="text-[11px] font-medium text-muted-foreground hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {activeIntegrations.length === 0 ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                      <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">No Social Channels Connected Yet</p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Link your Instagram, Facebook Pages, TikTok, YouTube, or Google Business profile in{" "}
                          <a
                            href="/admin/settings?tab=connections"
                            className="underline font-bold text-amber-950"
                          >
                            Settings &rarr; Social Channels
                          </a>{" "}
                          to publish automatically.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {CORE_5_PLATFORMS.map((platform) => {
                        const integration = activeIntegrations.find(
                          (i) => i.provider === platform.id
                        )
                        const isConnected = Boolean(integration)
                        const isYouTubeBlocked =
                          platform.id === "youtube" && !isVideoMedia
                        const canSelect = isConnected && !isYouTubeBlocked
                        const isSelected = Boolean(
                          canSelect &&
                            integration &&
                            selectedTargetIds.includes(integration.id)
                        )

                        return (
                          <div
                            key={platform.id}
                            onClick={() => {
                              if (canSelect && integration) {
                                toggleTargetIntegration(integration.id)
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between rounded-lg border p-2.5 text-xs transition-all",
                              canSelect
                                ? "cursor-pointer hover:border-[#C5A059]"
                                : "opacity-60 bg-muted/40 cursor-not-allowed",
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border bg-white"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold border shrink-0",
                                  platform.color
                                )}
                              >
                                {platform.badge}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-semibold text-foreground truncate text-[11px]">
                                    {platform.name}
                                  </p>
                                  {isYouTubeBlocked && (
                                    <span className="rounded px-1 py-0.2 text-[9px] font-medium bg-amber-500/10 text-amber-800 border border-amber-500/30">
                                      Requires MP4 Video
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {isYouTubeBlocked
                                    ? "YouTube Shorts requires MP4 video"
                                    : isConnected
                                    ? integration?.handle || integration?.name
                                    : "Not Connected in Settings"}
                                </p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
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
              </div>
            </div>

            {/* 2-Step Attention-Grabber Funnel Box */}
            <div className="rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/5 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Layers className="size-4 text-[#C5A059]" />
                  <div>
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                      <span>2-Step Attention-Grabber Funnel</span>
                      <Badge className="text-[9px] bg-[#C5A059] text-white">
                        Algorithmic Boost
                      </Badge>
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Hook the feed with a Single Spotlight first → auto-publish the complete Multi-Package Sheet after a configurable delay.
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
                      <span className="font-mono text-primary font-bold">
                        {twoStepDelayMinutes} Minutes ({Math.round((twoStepDelayMinutes / 60) * 10) / 10}h)
                      </span>
                    </Label>
                    <div className="flex items-center gap-1.5">
                      {[30, 60, 120, 180, 240].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setTwoStepDelayMinutes(mins)}
                          className={cn(
                            "rounded border px-2 py-1 text-[10px] font-bold transition-all",
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

            {/* Publication Timing & Submit Bar */}
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
                    <span>Schedule for Later</span>
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
                  </div>
                )}
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
                    ? `Publish Immediately (${selectedTargetIds.length} Channels)`
                    : `Schedule Post (${selectedTargetIds.length} Channels)`}
                </span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Live Scheduled & Published Queue */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base font-bold flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                <span>Live Scheduled &amp; Published Queue ({scheduledPosts.length})</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Monitor live post state across channels, inspect per-platform errors, or retry failed targets.
              </CardDescription>
            </div>

            {/* Filter buttons */}
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
                    "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all",
                    queueFilter === f.id
                      ? "bg-[#0A3622] text-white font-bold"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          {filteredPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              No posts found matching the filter &quot;{queueFilter}&quot;.
            </div>
          ) : (
            filteredPosts.map((post) => {
              const isBusy = busyActionId === post.id
              const hasFailedTargets = post.targets.some((t) => t.status === "failed")

              return (
                <div
                  key={post.id}
                  className="rounded-xl border border-border bg-white p-3.5 space-y-3 hover:border-[#C5A059]/60 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Thumbnail */}
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
                            className="text-[10px] font-mono capitalize"
                          >
                            {post.campaignStage.replace(/_/g, " ")}
                          </Badge>
                          <Badge
                            className={cn(
                              "text-[10px] font-bold capitalize",
                              post.status === "completed" && "bg-emerald-600 text-white",
                              post.status === "scheduled" && "bg-amber-600 text-white",
                              post.status === "publishing" && "bg-blue-600 text-white",
                              (post.status === "failed" || post.status === "partially_failed") &&
                                "bg-rose-600 text-white",
                              post.status === "cancelled" && "bg-slate-500 text-white"
                            )}
                          >
                            {post.status.replace(/_/g, " ")}
                          </Badge>
                        </div>

                        <p className="text-xs text-foreground line-clamp-2 font-mono">
                          {post.caption}
                        </p>

                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5">
                          <span>Scheduled For: {formatDateSafe(post.scheduledFor)}</span>
                          {post.twoStepDelayMinutes && (
                            <span>• Delay: {post.twoStepDelayMinutes}m</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Post Level Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {(post.status === "scheduled" || post.status === "draft") && (
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

                  {/* Targets Status Strip */}
                  <div className="pt-2 border-t border-border/70 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      Channel Targets ({post.targets.length}):
                    </span>
                    {post.targets.map((target) => {
                      const isTargetBusy = busyActionId === target.id
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
        </CardContent>
      </Card>
    </div>
  )
}

// ==========================================
// 4. TAB 2: 100% BAN-SAFE WHATSAPP QUEUE
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

  const todayIso = React.useMemo(() => {
    return new Date().toISOString().split("T")[0]!
  }, [])

  const [selectedDate, setSelectedDate] = React.useState(todayIso)

  // Selected Asset for WhatsApp Distribution
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

  // Formatted Caption for WhatsApp
  const [whatsappCaption, setWhatsappCaption] = React.useState<string>(() => {
    return selectedAsset?.captionWhatsapp || ""
  })

  React.useEffect(() => {
    if (selectedAsset?.captionWhatsapp) {
      setWhatsappCaption(selectedAsset.captionWhatsapp)
    }
  }, [selectedAsset])

  // Filters
  const [areaFilter, setAreaFilter] = React.useState("all")
  const [searchQuery, setSearchQuery] = React.useState("")

  // Interactive Action States
  const [copiedCaption, setCopiedCaption] = React.useState(false)
  const [busyChannelId, setBusyChannelId] = React.useState<string | null>(null)
  const [actionNotice, setActionNotice] = React.useState<string | null>(null)

  // Add Channel Modal State
  const [isAddChannelOpen, setIsAddChannelOpen] = React.useState(false)
  const [newChannelName, setNewChannelName] = React.useState("")
  const [newChannelPlatform, setNewChannelPlatform] =
    React.useState<MarketingChannelRecord["platform"]>("whatsapp_group")
  const [newChannelArea, setNewChannelArea] = React.useState("Askari 10")
  const [newChannelSender, setNewChannelSender] = React.useState("03274029701")
  const [newChannelMembers, setNewChannelMembers] = React.useState(450)
  const [isSavingChannel, setIsSavingChannel] = React.useState(false)

  // High-Res Poster Preview Dialog
  const [previewPosterUrl, setPreviewPosterUrl] = React.useState<string | null>(null)

  // Distributions logged for the selected date
  const distributionsToday = React.useMemo(() => {
    return dailyDistributions.filter((d) => d.scheduledDate === selectedDate)
  }, [dailyDistributions, selectedDate])

  const postedChannelIds = React.useMemo(() => {
    return new Set(distributionsToday.map((d) => d.channelId))
  }, [distributionsToday])

  // Filtered Channels
  const filteredChannels = React.useMemo(() => {
    return marketingChannels.filter((c) => {
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
          (c.senderWhatsappNumber && c.senderWhatsappNumber.includes(q))
        )
      }
      return true
    })
  }, [marketingChannels, areaFilter, searchQuery])

  // Progress metrics
  const totalActiveChannels = marketingChannels.filter((c) => c.isActive).length
  const sharedCountToday = marketingChannels.filter(
    (c) => c.isActive && postedChannelIds.has(c.id)
  ).length
  const progressPercent =
    totalActiveChannels > 0
      ? Math.round((sharedCountToday / totalActiveChannels) * 100)
      : 0

  // 1-Tap Copy Caption
  const handleCopyCaption = async () => {
    if (!whatsappCaption) return
    try {
      await navigator.clipboard.writeText(whatsappCaption)
      setCopiedCaption(true)
      setTimeout(() => setCopiedCaption(false), 2500)
    } catch {
      setActionNotice("Failed to copy caption to clipboard.")
    }
  }

  // 1-Tap Download 4K Poster
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

  // 1-Tap Mark Shared Today
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
        setActionNotice("Marked shared successfully!")
        router.refresh()
      } else {
        setActionNotice(res.error || "Failed to mark distribution.")
      }
    } catch (err: unknown) {
      setActionNotice(
        err instanceof Error ? err.message : "Error logging distribution."
      )
    } finally {
      setBusyChannelId(null)
    }
  }

  // Add New Channel Submit
  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChannelName.trim()) return
    setIsSavingChannel(true)
    try {
      const res = await upsertMarketingChannel({
        name: newChannelName.trim(),
        platform: newChannelPlatform,
        areaTag: newChannelArea.trim(),
        senderWhatsappNumber: newChannelSender,
        memberCount: newChannelMembers,
        dailyTargetPosts: 1,
        isActive: true,
      })
      if (res.success) {
        setIsAddChannelOpen(false)
        setNewChannelName("")
        router.refresh()
      }
    } finally {
      setIsSavingChannel(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ban-Safe Warning Banner */}
      <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-4 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-sm text-emerald-900">
              100% Meta-Compliant &amp; Ban-Safe Assisted Distribution
            </h4>
            <p className="text-emerald-800 text-[11px] max-w-3xl">
              Al Ramlah Travels operates 30+ verified WhatsApp community groups and 2 broadcast Status lines.
              Automated third-party bulk bots trigger immediate SIM bans; our 1-tap manual logging system is 100% compliant, auditable, and preserves our official phone lines permanently.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => window.open("https://web.whatsapp.com", "_blank")}
            className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 text-xs font-bold gap-1.5 cursor-pointer"
          >
            <Smartphone className="size-3.5 text-[#C5A059]" />
            <span>Open WhatsApp Web</span>
          </Button>
        </div>
      </div>

      {actionNotice && (
        <div className="rounded-xl border border-emerald-400 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950 flex items-center justify-between">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Active 4K Poster Showcase & 1-Tap Action Card */}
      <Card className="border-[#C5A059]/40 bg-card shadow-sm">
        <CardHeader className="bg-secondary/20 border-b border-border pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base font-bold flex items-center gap-2">
                <Sparkles className="size-4 text-[#C5A059]" />
                <span>Today&apos;s Active Poster &amp; 1-Tap Share Bar</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Select the 4K spotlight poster to share, copy the formatted caption with 1 tap, and download the asset.
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
            {/* Left: Poster Selector & Image Preview (4 cols) */}
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
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-muted group cursor-pointer"
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

            {/* Right: Formatted WhatsApp Caption & 1-Tap Actions (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Formatted WhatsApp Caption</span>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      WhatsApp Markdown Ready
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {whatsappCaption.length} chars
                  </span>
                </div>
                <Textarea
                  rows={8}
                  value={whatsappCaption}
                  onChange={(e) => setWhatsappCaption(e.target.value)}
                  className="text-xs font-mono leading-relaxed bg-white"
                />
              </div>

              {/* 1-Tap Action Pill Bar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border">
                <Button
                  type="button"
                  onClick={handleCopyCaption}
                  className={cn(
                    "h-9 text-xs font-bold gap-2 cursor-pointer transition-all",
                    copiedCaption
                      ? "bg-emerald-600 text-white"
                      : "bg-[#0A3622] text-white hover:bg-[#0A3622]/90"
                  )}
                >
                  {copiedCaption ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4 text-[#C5A059]" />
                  )}
                  <span>{copiedCaption ? "Caption Copied!" : "1-Tap Copy Caption"}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDownloadPoster()}
                  className="h-9 text-xs font-semibold gap-1.5 border-[#C5A059]/50 hover:bg-white cursor-pointer"
                >
                  <Download className="size-4 text-[#C5A059]" />
                  <span>1-Tap Download 4K Poster</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open("https://web.whatsapp.com", "_blank")}
                  className="h-9 text-xs font-semibold gap-1.5 cursor-pointer ml-auto"
                >
                  <Smartphone className="size-4 text-emerald-600" />
                  <span>Open WhatsApp Web</span>
                </Button>
              </div>

              {/* Daily Progress Bar */}
              <div className="rounded-xl border border-border bg-secondary/15 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>Daily Community Distribution Progress ({selectedDate})</span>
                  </span>
                  <span className="font-mono font-bold text-primary">
                    {sharedCountToday} / {totalActiveChannels} Shared ({progressPercent}%)
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2 bg-secondary" />
                <p className="text-[10px] text-muted-foreground">
                  Tick each group below after pasting the caption and image to maintain 100% staff audit compliance.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. WhatsApp Channels Grid & 1-Tap Audit List */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base font-bold flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <span>30+ Community Groups &amp; 2 Status Lines</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Filter by neighborhood (Askari 10, DHA, Lahore, Status) and click &quot;Mark Shared Today&quot; with 1 tap.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search input */}
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs w-40 bg-white"
                />
              </div>

              {/* Area selector */}
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="flex h-8 rounded-md border border-input bg-background px-2.5 text-xs"
              >
                <option value="all">All Areas ({marketingChannels.length})</option>
                <option value="Askari 10">Askari 10 Sectors</option>
                <option value="DHA">DHA Phases 1–8</option>
                <option value="Lahore">Lahore Cantt / Johar</option>
                <option value="Other Cities">Other Cities</option>
                <option value="Status">2 WhatsApp Status Lines</option>
              </select>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsAddChannelOpen(true)}
                className="h-8 text-xs gap-1 cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Add Channel</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredChannels.map((ch) => {
              const isPosted = postedChannelIds.has(ch.id)
              const distributionLog = distributionsToday.find(
                (d) => d.channelId === ch.id
              )
              const isBusy = busyChannelId === ch.id

              return (
                <div
                  key={ch.id}
                  className={cn(
                    "rounded-xl border p-3.5 space-y-2.5 transition-all bg-white",
                    isPosted
                      ? "border-emerald-300 bg-emerald-50/20"
                      : "border-border hover:border-[#C5A059]"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 border-[#C5A059]/50 text-[#C5A059] uppercase font-bold"
                        >
                          {ch.areaTag}
                        </Badge>
                        {ch.senderWhatsappNumber && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            SIM: {ch.senderWhatsappNumber}
                          </span>
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
                        {ch.memberCount ? ` · ~${ch.memberCount} members` : ""}
                      </p>
                    </div>

                    {isPosted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        <span>Shared</span>
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

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/70">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleMarkSharedToday(ch.id)}
                      className={cn(
                        "h-7 text-[11px] font-bold gap-1 cursor-pointer flex-1",
                        isPosted
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                          : "bg-[#0A3622] text-white hover:bg-[#0A3622]/90"
                      )}
                    >
                      {isBusy ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : isPosted ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <CheckCircle2 className="size-3 text-[#C5A059]" />
                      )}
                      <span>{isPosted ? "Logged (Re-mark)" : "1-Tap Mark Shared"}</span>
                    </Button>

                    {ch.inviteLinkOrUrl && (
                      <a
                        href={ch.inviteLinkOrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:border-[#C5A059]"
                        title="Open Group Link"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add New Group Dialog */}
      <Dialog open={isAddChannelOpen} onOpenChange={setIsAddChannelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold">
              Add New Marketing Channel / Community Group
            </DialogTitle>
            <DialogDescription className="text-xs">
              Register a WhatsApp neighborhood group or status line into the Al Ramlah distribution matrix.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddChannel} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Group / Channel Name *</Label>
              <Input
                required
                placeholder="e.g. Askari 10 Sector D Residents"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Platform</Label>
                <select
                  value={newChannelPlatform}
                  onChange={(e) =>
                    setNewChannelPlatform(
                      e.target.value as MarketingChannelRecord["platform"]
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="whatsapp_group">WhatsApp Group</option>
                  <option value="whatsapp_community">WhatsApp Community</option>
                  <option value="whatsapp_status">WhatsApp Status</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Area Tag</Label>
                <Input
                  value={newChannelArea}
                  onChange={(e) => setNewChannelArea(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assigned Line</Label>
                <select
                  value={newChannelSender}
                  onChange={(e) => setNewChannelSender(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-mono"
                >
                  <option value="03274029701">03274029701 (Primary)</option>
                  <option value="03190462638">03190462638 (Secondary)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Member Count Estimate</Label>
                <Input
                  type="number"
                  value={newChannelMembers}
                  onChange={(e) => setNewChannelMembers(Number(e.target.value) || 0)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddChannelOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingChannel}
                size="sm"
                className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 text-xs font-bold"
              >
                {isSavingChannel ? (
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                ) : null}
                Save Channel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* High-Res Poster Preview Modal */}
      <Dialog
        open={Boolean(previewPosterUrl)}
        onOpenChange={(open) => !open && setPreviewPosterUrl(null)}
      >
        <DialogContent className="max-w-2xl p-2 bg-black/95 text-white border-gold/40">
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
// 5. TAB 3: OFFICIAL BROADCASTS & VIP OUTREACH
// ==========================================

function BroadcastsAndOutreachTab({
  whatsappAccounts,
  whatsappTemplates,
  whatsappBroadcasts,
  outreachContacts,
  postAssets,
  outreachLogs,
}: {
  whatsappAccounts: SafeWhatsappAccount[]
  whatsappTemplates: WhatsappTemplateRecord[]
  whatsappBroadcasts: WhatsappBroadcastRecord[]
  outreachContacts: OutreachContactRow[]
  postAssets: PostAssetRecord[]
  outreachLogs: OutreachLogRow[]
}) {
  const router = useRouter()

  // Selected WhatsApp Account
  const defaultAccount =
    whatsappAccounts.find((a) => a.isDefault && a.isActive) ||
    whatsappAccounts[0]

  const [selectedAccountId, setSelectedAccountId] = React.useState<string>(
    () => defaultAccount?.id || ""
  )

  // Approved templates only
  const approvedTemplates = React.useMemo(() => {
    return whatsappTemplates.filter((t) => t.status === "APPROVED")
  }, [whatsappTemplates])

  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>(
    () => approvedTemplates[0]?.id || ""
  )

  const selectedTemplate = React.useMemo(() => {
    return approvedTemplates.find((t) => t.id === selectedTemplateId)
  }, [approvedTemplates, selectedTemplateId])

  // Broadcast Name
  const [broadcastName, setBroadcastName] = React.useState(
    "Ramadan 2026 Umrah Spotlight Announcement"
  )

  // Target Segment
  const [recipientSegment, setRecipientSegment] = React.useState<
    "all_vip" | "eligible_only" | "askari_dha" | "custom_phones"
  >("eligible_only")

  const [customPhonesText, setCustomPhonesText] = React.useState("")

  // Timing
  const [scheduledBroadcastTime, setScheduledBroadcastTime] =
    React.useState<string>("")

  // Launch State
  const [isLaunchingBroadcast, setIsLaunchingBroadcast] = React.useState(false)
  const [broadcastNotice, setBroadcastNotice] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Compute recipient list based on segment
  const computedRecipientPhones = React.useMemo(() => {
    const now = new Date()

    if (recipientSegment === "custom_phones") {
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

    if (recipientSegment === "askari_dha") {
      return outreachContacts
        .filter(
          (c) =>
            c.interestStatus !== "do_not_contact" &&
            (c.areaCommunity?.toLowerCase().includes("askari") ||
              c.areaCommunity?.toLowerCase().includes("dha"))
        )
        .map((c) => c.whatsappNumber)
    }

    // eligible_only (outside 14-day cooldown)
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
  }, [recipientSegment, customPhonesText, outreachContacts])

  // Handle Launch Broadcast
  const handleLaunchBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccountId) {
      setBroadcastNotice({
        type: "error",
        message: "Please select an active WhatsApp Business Account.",
      })
      return
    }
    if (!selectedTemplateId) {
      setBroadcastNotice({
        type: "error",
        message: "Please select an APPROVED Meta template to broadcast.",
      })
      return
    }
    if (computedRecipientPhones.length === 0) {
      setBroadcastNotice({
        type: "error",
        message: "Recipient list is empty. Select another segment or add phone numbers.",
      })
      return
    }

    setIsLaunchingBroadcast(true)
    setBroadcastNotice(null)

    try {
      const payload = {
        accountId: selectedAccountId,
        name: broadcastName.trim(),
        templateId: selectedTemplateId,
        recipientPhones: computedRecipientPhones,
        scheduledAt: scheduledBroadcastTime
          ? new Date(scheduledBroadcastTime).toISOString()
          : null,
      }

      const res = await createAndQueueWhatsappBroadcastAction(payload)
      if (res.success) {
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

  // Map postAssets to OutreachAssetRow for OutreachClient
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

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Official Meta Template Broadcast Launch Card */}
      <Card className="border-[#C5A059]/40 bg-card shadow-sm">
        <CardHeader className="bg-secondary/20 border-b border-border pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base font-bold flex items-center gap-2">
                <Send className="size-4 text-[#C5A059]" />
                <span>Official Meta WhatsApp Cloud API Template Broadcasts</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Launch 100% compliant broadcast notifications to opt-in subscribers using pre-approved Meta message templates.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="text-[11px] font-mono border-primary/30 text-primary"
            >
              {approvedTemplates.length} Approved Templates Available
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {broadcastNotice && (
            <div
              className={cn(
                "rounded-xl border p-3.5 text-xs font-semibold flex items-center justify-between",
                broadcastNotice.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : "border-rose-300 bg-rose-50 text-rose-950"
              )}
            >
              <span>{broadcastNotice.message}</span>
              <button
                type="button"
                onClick={() => setBroadcastNotice(null)}
                className="underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <form onSubmit={handleLaunchBroadcast} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Account, Template & Name (7 cols) */}
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
                      value={broadcastName}
                      onChange={(e) => setBroadcastName(e.target.value)}
                      placeholder="e.g. Ramadan 2026 Announcement"
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Approved Meta Template</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Only &apos;APPROVED&apos; status can be broadcast
                    </span>
                  </Label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-mono"
                  >
                    {approvedTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} [{t.language}] — {t.category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Template Preview Card */}
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
              </div>

              {/* Right Column: Recipient Segment & Scheduling (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Target Recipient Segment
                    </Label>
                    <span className="font-mono text-xs font-bold text-primary">
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
                        id: "askari_dha",
                        label: "Askari 10 & DHA VIP Residents",
                        desc: "Targeted luxury neighborhood contacts",
                      },
                      {
                        id: "all_vip",
                        label: "All VIP Outreach Contacts",
                        desc: "All contacts excluding do_not_contact",
                      },
                      {
                        id: "custom_phones",
                        label: "Custom Phone Number List",
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
                      placeholder="e.g. 923274029701, 923190462638"
                      value={customPhonesText}
                      onChange={(e) => setCustomPhonesText(e.target.value)}
                      className="text-xs font-mono bg-white mt-2"
                    />
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border">
                  <Label className="text-xs font-semibold">
                    Schedule Timing (Optional)
                  </Label>
                  <Input
                    type="datetime-local"
                    value={scheduledBroadcastTime}
                    onChange={(e) => setScheduledBroadcastTime(e.target.value)}
                    className="h-9 text-xs font-mono bg-white"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Leave blank to dispatch immediately.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-border">
              <Button
                type="submit"
                disabled={isLaunchingBroadcast || computedRecipientPhones.length === 0}
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
          </form>

          {/* Recent Broadcasts Audit Strip */}
          {whatsappBroadcasts.length > 0 && (
            <div className="pt-4 border-t border-border space-y-3">
              <h4 className="text-xs font-bold text-foreground">
                Recent Broadcast Dispatches ({whatsappBroadcasts.length})
              </h4>
              <div className="space-y-2">
                {whatsappBroadcasts.slice(0, 5).map((bc) => {
                  const deliveryRate =
                    bc.totalRecipients > 0
                      ? Math.round((bc.deliveredCount / bc.totalRecipients) * 100)
                      : 0

                  return (
                    <div
                      key={bc.id}
                      className="rounded-lg border border-border bg-white p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
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
                              bc.status === "completed" && "bg-emerald-600 text-white",
                              bc.status === "processing" && "bg-blue-600 text-white",
                              bc.status === "scheduled" && "bg-amber-600 text-white",
                              bc.status === "failed" && "bg-rose-600 text-white"
                            )}
                          >
                            {bc.status}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Started: {formatDateSafe(bc.startedAt || bc.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] font-mono">
                        <span>Total: {bc.totalRecipients}</span>
                        <span className="text-emerald-700">Sent: {bc.sentCount}</span>
                        <span className="text-primary font-bold">Delivered: {deliveryRate}%</span>
                        {bc.failedCount > 0 && (
                          <span className="text-rose-600">Failed: {bc.failedCount}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. 14-Day VIP Outreach CRM Section (Cleanly reusing OutreachClient!) */}
      <div className="space-y-3">
        <div className="flex flex-col gap-1 border-b border-border pb-3">
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
            Personal high-touch relationship cultivation for prospective pilgrims across Askari and DHA.
            Every personal package share triggers an automatic 14-day cooldown timer, unlocking automatically upon inbound customer reply.
          </p>
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
