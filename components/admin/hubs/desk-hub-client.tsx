"use client"

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
  Inbox,
  Kanban,
  Layers,
  Table as TableIcon,
  Search,
  X,
  Phone,
  MessageCircle,
  Clock,
  Sparkles,
  Send,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  Download,
  ExternalLink,
  Plane,
  Users,
  Zap,
  Loader2,
  Command,
  Plus,
  Bot,
  Image as ImageIcon,
  Music,
  RefreshCw,
  List as ListIcon,
  MousePointerClick,
  Smile,
  ArrowDownToLine,
  Pin,
  Archive,
  ArchiveRestore,
  UserCheck,
  StickyNote,
  Smartphone,
  Cloud,
  Lock,
  Compass,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TabularPrice } from "@/components/layout/status-badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ApplicationsKanbanBoard,
  type KanbanApplicationItem,
} from "@/components/admin/hubs/applications-kanban-board"
import {
  ApplicationsTable,
  type ApplicationRowItem,
} from "@/components/admin/applications/applications-table"
import { ApplicationsKpiStrip } from "@/components/admin/applications/applications-kpi-strip"
import {
  MessagesClient,
  type ContactMessageData,
} from "@/components/admin/catalog/messages-client"
import {
  sendWhatsappConversationReplyAction,
  sendApplicationLuxuryPdfViaWhatsappAction,
  getConversationMessagesAction,
  markConversationMessagesAsReadAction,
  sendWhatsAppInteractiveButtonsAction,
  sendWhatsAppInteractiveListAction,
  sendWhatsAppReactionAction,
  toggleWhatsAppAutoResponderAction,
  triggerManualMediaMirrorAction,
  updateConversationIntentAction,
  handoffConversationToDedicatedAgentAction,
  listWhatsappConversationsAction,
  toggleWhatsappConversationPinAction,
  toggleWhatsappConversationArchiveAction,
  assignWhatsappConversationAgentAction,
  addWhatsappConversationInternalNoteAction,
} from "@/app/actions/whatsapp-crm"
import {
  extractTemplatePlaceholders,
  interpolateTemplateVariables,
} from "@/lib/whatsapp/template-variables"
import {
  isDocumentVisibilityActive,
  mergePolledConversations,
  resolveDeskRouteState,
  shouldAutoScrollThreadOnUpdate,
} from "@/lib/whatsapp/desk-tabs"
import type { WhatsappInternalNote } from "@/db/schema/whatsapp-crm"
import {
  generateWaConversationCopilotDraftAction,
  generateApplicationQuoteCopilotDraftAction,
  startWhatsappCopilotRunAction,
  startApplicationCopilotRunAction,
} from "@/app/actions/quoting-copilot"
import { listActiveRunsByTagsAction } from "@/app/actions/trigger-realtime"
import { CopilotRealtimeRunBanner } from "@/components/admin/desk/copilot-realtime-run-banner"
import type {
  WaCopilotDraftResult,
  ApplicationQuoteCopilotResult,
} from "@/lib/ai/quoting-copilot"
import { convertPostLookupToApplication } from "@/app/actions/marketing-ops"
import {
  WhatsappAutoReplyStudio,
  type AutoReplyRuleItem,
} from "@/components/admin/desk/whatsapp-auto-reply-studio"
import { MetaTemplateBuilderModal } from "@/components/admin/desk/meta-template-builder-modal"
import { formatWhatsAppPhone } from "@/lib/phone"
import { cn } from "@/lib/utils"

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface WhatsAppAccountRecord {
  id: string
  name: string
  phoneNumberId: string
  wabaId: string
  displayPhoneNumber: string
  verifiedName?: string | null
  qualityRating?: string | null
  messagingLimit?: string | null
  accountRole?:
    | "COEXISTENCE_FOUNDER"
    | "DEDICATED_AGENT"
    | "PRIMARY_CLOUD"
    | string
  isOnBizApp?: boolean
  platformType?: string | null
  intentFilterEnabled?: boolean
  isActive: boolean
  isDefault: boolean
  autoReplyEnabled?: boolean
  autoReplyCooldownMinutes?: number
  welcomeGreetingEnabled?: boolean
  welcomeGreetingText?: string | null
  awayGreetingEnabled?: boolean
  awayGreetingText?: string | null
  businessHoursStart?: string | null
  businessHoursEnd?: string | null
}

export interface WhatsAppMessageRecord {
  id: string
  conversationId: string
  wamid: string
  direction: "inbound" | "outbound"
  status: "pending" | "sent" | "delivered" | "read" | "failed"
  messageType:
    | "text"
    | "image"
    | "document"
    | "audio"
    | "video"
    | "template"
    | "interactive"
    | "sticker"
    | "reaction"
    | "TEXT"
    | "IMAGE"
    | "DOCUMENT"
    | "AUDIO"
    | "VIDEO"
    | "TEMPLATE"
    | "INTERACTIVE"
    | "STICKER"
    | "REACTION"
  body?: string | null
  rawMediaId?: string | null
  mediaUrl?: string | null
  mediaType?: string | null
  mediaMimeType?: string | null
  mediaFileSize?: number | null
  mediaFilename?: string | null
  templateName?: string | null
  contextMessageId?: string | null
  interactivePayload?: Record<string, unknown> | null
  reactionEmoji?: string | null
  reactedToWabaMessageId?: string | null
  isAutoReply?: boolean
  createdAt: Date | string
  sentAt?: Date | string | null
  deliveredAt?: Date | string | null
  readAt?: Date | string | null
}

export interface WhatsAppConversationRecord {
  id: string
  accountId: string
  contactPhone: string
  contactName?: string | null
  outreachContactId?: string | null
  applicationId?: string | null
  detectedPostCode?: string | null
  intentCategory?:
    | "TRAVEL_LEAD"
    | "PERSONAL_OR_OTHER"
    | "FOUNDER_HANDOFF"
    | "UNCLASSIFIED"
    | string
  intentConfidence?: number | null
  intentReason?: string | null
  forwardedToAgentConversationId?: string | null
  lastAutoRepliedPostCode?: string | null
  lastAutoRepliedAt?: Date | string | null
  lastCustomerMessageAt?: Date | string | null
  lastMessageAt: Date | string
  unreadCount: number
  isPinned: boolean
  isArchived: boolean
  doNotContact?: boolean | null
  coexistenceMode?: boolean | null
  botMuted?: boolean | null
  assignedUserId?: string | null
  internalNotes?: WhatsappInternalNote[] | null
  intakeFlowState?: {
    step: "IDLE" | "AWAITING_MONTH" | "AWAITING_PILGRIMS" | "AWAITING_HOTEL_TIER" | "COMPLETED"
    travelMonth?: string
    paxCount?: number
    hotelTier?: string
    applicationId?: string
    referenceNumber?: string
  } | null
  createdAt: Date | string
  messages?: WhatsAppMessageRecord[]
  account?: {
    id: string
    name: string
    displayPhoneNumber: string
    phoneNumberId?: string
    platformType?: "CLOUD_API" | "LINKED_DEVICE" | string
    accountRole?:
      | "COEXISTENCE_FOUNDER"
      | "DEDICATED_AGENT"
      | "PRIMARY_CLOUD"
      | string
    isOnBizApp?: boolean
    intentFilterEnabled?: boolean
    autoReplyEnabled?: boolean
    autoReplyCooldownMinutes?: number
  } | null
  application?: {
    id: string
    referenceNumber: string
    customerName: string
    status: string
    totalPassportCount?: number
    bedAndSeatCount?: number
  } | null
}

export interface WhatsAppTemplateRecord {
  id: string
  accountId: string
  metaTemplateId: string
  name: string
  language: string
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED"
  headerType?: string | null
  headerContent?: string | null
  bodyText: string
  footerText?: string | null
  buttons?: Array<Record<string, unknown>> | null
}

export interface WhatsAppQuickReplyRecord {
  id: string
  accountId: string
  shortcut: string
  title: string
  category: string
  bodyText: string
  sortOrder: number
  isActive: boolean
}

export interface FlyerPackageRecord {
  id: string
  flyerId: string
  supplierId: string
  cardNumber: string
  postCode: string
  outboundFlightNo: string
  outboundDateLabel: string
  outboundRoute: string
  outboundDepTime: string
  outboundArrTime: string
  returnFlightNo: string
  returnDateLabel: string
  returnRoute: string
  returnDepTime: string
  returnArrTime: string
  makkahNights: string
  makkahHotelName: string
  makkahDistanceLabel: string
  madinahNights: string
  madinahHotelName: string
  madinahDistanceLabel: string
  mealPlanLabel?: string | null
  rawSharingPkr: number
  rawQuadPkr: number
  rawTriplePkr: number
  rawDoublePkr: number
  netSharingPkr: number
  netQuadPkr: number
  netTriplePkr: number
  netDoublePkr: number
  commissionPkr: number
  retailSharingPkr: number
  retailQuadPkr: number
  retailTriplePkr: number
  retailDoublePkr: number
  spotlightPosterUrl?: string | null
  flyer?: {
    airlineName: string
    title: string
  } | null
  supplier?: {
    name: string
  } | null
}

export type DeskApplicationItem = ApplicationRowItem & {
  sourcePostCode?: string | null
}

export type DeskTabKey = "pipeline" | "inbox" | "web_messages"

export interface DeskStaffMember {
  id: string
  name: string
  email: string
  role: string
}

export interface DeskHubClientProps {
  initialTab?: string
  initialNowMs?: number
  applications: DeskApplicationItem[]
  slaHours?: number
  whatsappAccounts: WhatsAppAccountRecord[]
  whatsappConversations: WhatsAppConversationRecord[]
  whatsappTemplates: WhatsAppTemplateRecord[]
  whatsappQuickReplies: WhatsAppQuickReplyRecord[]
  whatsappAutoReplyRules?: AutoReplyRuleItem[]
  flyerPackages: FlyerPackageRecord[]
  contactMessages: ContactMessageData[]
  staffMembers?: DeskStaffMember[]
  currentUserId?: string
  currentUserRole?: string
}

let fallbackOptimisticIdSeq = 0

function createOptimisticMessageId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }
  fallbackOptimisticIdSeq += 1
  return `optimistic-${fallbackOptimisticIdSeq}`
}

const QUICK_REACTION_EMOJIS: ReadonlyArray<{
  emoji: string
  label: string
}> = [
  { emoji: String.fromCodePoint(0x1f44d), label: "Thumbs up" },
  { emoji: String.fromCodePoint(0x2764, 0xfe0f), label: "Heart" },
  { emoji: String.fromCodePoint(0x1f932), label: "Dua" },
  { emoji: String.fromCodePoint(0x2705), label: "Check mark" },
  { emoji: String.fromCodePoint(0x1f31f), label: "Star" },
]

export function DeskHubClient({
  initialTab,
  initialNowMs,
  applications,
  slaHours = 24,
  whatsappAccounts: initialAccounts,
  whatsappConversations: initialConversations,
  whatsappTemplates,
  whatsappQuickReplies,
  whatsappAutoReplyRules: initialAutoReplyRules = [],
  flyerPackages,
  contactMessages,
  staffMembers = [],
  currentUserId,
  currentUserRole,
}: DeskHubClientProps) {
  const [nowMs, setNowMs] = React.useState<number>(() => initialNowMs ?? 0)

  React.useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setNowMs(Date.now())
    }, 0)
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 60_000)
    return () => {
      window.clearTimeout(syncTimer)
      window.clearInterval(intervalId)
    }
  }, [])
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Tab State: URL-synced (?tab=inbox|kanban|pipeline|auto-replies|templates|web_messages|messages)
  const tabFromUrl = searchParams.get("tab")
  const resolvedRoute = React.useMemo(
    () => resolveDeskRouteState(tabFromUrl || initialTab),
    [tabFromUrl, initialTab]
  )
  const activeTab: DeskTabKey = resolvedRoute.activeTab

  const switchTab = (tab: DeskTabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tab)
    router.push(`${pathname}?${params.toString()}`)
  }

  // Auto-dispatch Cmd+K Reverse Lookup if ?lookup=1 or ?openLookup=1 is in URL
  React.useEffect(() => {
    if (
      searchParams.get("lookup") === "1" ||
      searchParams.get("openLookup") === "1"
    ) {
      window.dispatchEvent(new CustomEvent("open-post-lookup"))
    }
  }, [searchParams])

  // Accounts, Conversations, Templates, Quick Replies & Auto-Reply Rules state
  const [accounts, setAccounts] =
    React.useState<WhatsAppAccountRecord[]>(initialAccounts)
  const [conversations, setConversations] =
    React.useState<WhatsAppConversationRecord[]>(initialConversations)
  const [templatesList, setTemplatesList] =
    React.useState<WhatsAppTemplateRecord[]>(whatsappTemplates)
  const [quickRepliesList, setQuickRepliesList] =
    React.useState<WhatsAppQuickReplyRecord[]>(whatsappQuickReplies)
  const [autoReplyRules, setAutoReplyRules] =
    React.useState<AutoReplyRuleItem[]>(initialAutoReplyRules)
  const [autoReplyStudioOpen, setAutoReplyStudioOpen] = React.useState(
    resolvedRoute.initialModal === "auto-replies"
  )
  const [templateStudioOpen, setTemplateStudioOpen] = React.useState(
    resolvedRoute.initialModal === "templates"
  )

  // Count Badges
  const pendingCount = React.useMemo(
    () => applications.filter((a) => a.status === "pending_quote").length,
    [applications]
  )
  const totalUnreadWhatsApp = React.useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [conversations]
  )
  const unreadContactMessages = React.useMemo(
    () => contactMessages.filter((m) => m.status === "unread").length,
    [contactMessages]
  )

  // ==========================================
  // TAB 1: PIPELINE FILTERS, VIEW & AI COPILOT
  // ==========================================
  const [pipelineViewMode, setPipelineViewMode] = React.useState<
    "kanban" | "table"
  >(resolvedRoute.pipelineView)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [sourceFilter, setSourceFilter] = React.useState<string>("all")

  // Filtered applications
  const filteredApplications = React.useMemo(() => {
    return applications.filter((app) => {
      if (sourceFilter !== "all") {
        if (sourceFilter === "custom_builder" && app.source !== "custom_builder")
          return false
        if (sourceFilter === "group_booking" && app.source !== "group_booking")
          return false
        if (sourceFilter === "hajj_inquiry" && app.source !== "hajj_inquiry")
          return false
        if (sourceFilter === "post_lookup" && !app.sourcePostCode) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchRef = app.referenceNumber.toLowerCase().includes(q)
        const matchName = app.customerName.toLowerCase().includes(q)
        const matchPhone = app.customerPhone.includes(q)
        const matchCity = app.customerCity.toLowerCase().includes(q)
        const matchPost = app.sourcePostCode?.toLowerCase().includes(q) ?? false
        if (!matchRef && !matchName && !matchPhone && !matchCity && !matchPost) {
          return false
        }
      }

      return true
    })
  }, [applications, sourceFilter, searchQuery])

  // KPI Data calculation
  const kpiData = React.useMemo(() => {
    const totalCount = applications.length
    const pending = applications.filter(
      (a) => a.status === "pending_quote"
    ).length
    const overdue = applications.filter(
      (a) =>
        a.status === "pending_quote" &&
        nowMs > 0 &&
        nowMs - new Date(a.createdAt).getTime() > slaHours * 3600 * 1000
    ).length
    const quotedPipelinePkr = applications
      .filter((a) => a.status === "quoted")
      .reduce((sum, a) => sum + (a.quotes?.[0]?.grandTotalPkr || 0), 0)
    const approvedRevenuePkr = applications
      .filter((a) => a.status === "approved")
      .reduce((sum, a) => sum + (a.quotes?.[0]?.grandTotalPkr || 0), 0)

    return {
      totalCount,
      pendingCount: pending,
      overdueCount: overdue,
      quotedPipelinePkr,
      approvedRevenuePkr,
    }
  }, [applications, nowMs, slaHours])

  // Pipeline AI Quote Copilot Preview Modal State (Spec 0015 AC-5)
  const [pipelineCopilotOpen, setPipelineCopilotOpen] = React.useState(false)
  const [selectedPipelineAppId, setSelectedPipelineAppId] =
    React.useState<string>(applications[0]?.id ?? "")
  const [isGeneratingPipelineCopilot, setIsGeneratingPipelineCopilot] =
    React.useState(false)
  const [pipelineCopilotDraft, setPipelineCopilotDraft] =
    React.useState<ApplicationQuoteCopilotResult | null>(null)
  const [pipelineCopilotMeta, setPipelineCopilotMeta] = React.useState<{
    modelUsed: string
    executionMode: string
  } | null>(null)
  const [pipelineCopilotError, setPipelineCopilotError] = React.useState<
    string | null
  >(null)
  const [pipelineCopilotRun, setPipelineCopilotRun] = React.useState<{
    runId: string
    publicAccessToken?: string
    mode: "cloud" | "inline"
  } | null>(null)

  const handleRunPipelineCopilot = async (targetAppId?: string) => {
    const appId = targetAppId || selectedPipelineAppId
    if (!appId) return
    setIsGeneratingPipelineCopilot(true)
    setPipelineCopilotError(null)
    try {
      const res = await startApplicationCopilotRunAction({
        applicationId: appId,
      })
      if (!res.success) {
        setPipelineCopilotError(
          res.error || "Failed to generate AI Quote Copilot preview."
        )
        setIsGeneratingPipelineCopilot(false)
      } else if (res.mode === "cloud" && res.runId) {
        setPipelineCopilotRun({
          runId: res.runId,
          publicAccessToken: res.publicAccessToken,
          mode: "cloud",
        })
      } else if (res.inlineOutput && res.inlineOutput.success) {
        setPipelineCopilotDraft(res.inlineOutput.draft)
        setPipelineCopilotMeta({
          modelUsed: res.inlineOutput.modelUsed,
          executionMode: res.inlineOutput.executionMode,
        })
        setIsGeneratingPipelineCopilot(false)
      } else {
        setIsGeneratingPipelineCopilot(false)
      }
    } catch (err) {
      setPipelineCopilotError(
        err instanceof Error ? err.message : "Error running AI Copilot"
      )
      setIsGeneratingPipelineCopilot(false)
    }
  }

  // ==========================================
  // TAB 2: WHATSAPP SHARED TEAM INBOX STATE
  // ==========================================
  const [activeConversationId, setActiveConversationId] = React.useState<
    string | null
  >(initialConversations[0]?.id ?? null)
  const [inboxFilter, setInboxFilter] = React.useState<
    "all" | "unread" | "active_24h" | "overdue_24h" | "with_code"
  >("all")
  const [conversationFilterTab, setConversationFilterTab] = React.useState<
    "active" | "pinned" | "archived"
  >("active")
  const [phoneLineFilter, setPhoneLineFilter] = React.useState<string>("all")
  const [isLiveSyncEnabled, setIsLiveSyncEnabled] = React.useState(true)
  const [inboxSearch, setInboxSearch] = React.useState("")

  // Distinct phone lines present across accounts and conversations
  const phoneLineFilters = React.useMemo(() => {
    const list: Array<{
      id: string
      label: string
      prefixLabel: string
      count: number
    }> = [
      {
        id: "all",
        label: "All Lines",
        prefixLabel: "",
        count: conversations.length,
      },
    ]

    const map = new Map<
      string,
      { label: string; prefixLabel: string; count: number }
    >()

    for (const c of conversations) {
      const key =
        c.account?.displayPhoneNumber ||
        c.account?.phoneNumberId ||
        c.accountId ||
        "unassigned"
      const label =
        c.account?.displayPhoneNumber ||
        c.account?.name ||
        (c.accountId ? "Line" : "Unassigned")
      const isCloud =
        c.account?.platformType === "CLOUD_API" ||
        (!c.account?.platformType &&
          !c.account?.phoneNumberId?.startsWith("linked-"))
      const prefixLabel = isCloud ? "Cloud" : "Linked"

      const existing = map.get(key)
      if (existing) {
        existing.count++
      } else {
        map.set(key, { label, prefixLabel, count: 1 })
      }
    }

    for (const [key, val] of map.entries()) {
      list.push({
        id: key,
        label: val.label,
        prefixLabel: val.prefixLabel,
        count: val.count,
      })
    }

    return list
  }, [conversations])

  // Active selected conversation
  const activeConversation = React.useMemo(() => {
    return (
      conversations.find((c) => c.id === activeConversationId) ??
      conversations[0] ??
      null
    )
  }, [conversations, activeConversationId])

  // Active WhatsApp Account for Auto-Responder Toggle (Spec 0013 AC-2, AC-6)
  const activeAccount = React.useMemo(() => {
    if (activeConversation?.accountId) {
      const found = accounts.find((a) => a.id === activeConversation.accountId)
      if (found) return found
    }
    return accounts.find((a) => a.isDefault) ?? accounts[0] ?? null
  }, [accounts, activeConversation])

  const [isTogglingAutoResponder, setIsTogglingAutoResponder] =
    React.useState(false)

  const handleToggleAutoResponder = async () => {
    const currentEnabled = activeAccount?.autoReplyEnabled ?? true
    const nextEnabled = !currentEnabled
    setIsTogglingAutoResponder(true)
    try {
      const res = await toggleWhatsAppAutoResponderAction({
        accountId: activeAccount?.id,
        enabled: nextEnabled,
      })
      if (res.success) {
        setAccounts((prev) =>
          prev.map((acc) =>
            acc.id === res.accountId
              ? { ...acc, autoReplyEnabled: res.autoReplyEnabled }
              : acc
          )
        )
      } else {
        setComposerError(res.error || "Failed to toggle Auto-Responder Bot")
      }
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : "Error toggling Auto-Responder Bot"
      )
    } finally {
      setIsTogglingAutoResponder(false)
    }
  }

  // Messages in active conversation (derived per conversation ID without sync setState in effect)
  const [messagesByConvId, setMessagesByConvId] = React.useState<
    Record<string, WhatsAppMessageRecord[]>
  >(() => {
    const seeded: Record<string, WhatsAppMessageRecord[]> = {}
    for (const conv of initialConversations) {
      if (conv.messages && conv.messages.length > 0) {
        seeded[conv.id] = conv.messages
      }
    }
    return seeded
  })
  const [loadingConvId, setLoadingConvId] = React.useState<string | null>(null)
  const [isMarkingRead, setIsMarkingRead] = React.useState(false)
  const [mirroringMessageId, setMirroringMessageId] = React.useState<
    string | null
  >(null)

  const activeMessages = React.useMemo(() => {
    if (!activeConversation) return []
    return (
      messagesByConvId[activeConversation.id] ??
      activeConversation.messages ??
      []
    )
  }, [activeConversation, messagesByConvId])

  const setActiveMessages = React.useCallback(
    (
      updater:
        | WhatsAppMessageRecord[]
        | ((prev: WhatsAppMessageRecord[]) => WhatsAppMessageRecord[])
    ) => {
      if (!activeConversation) return
      const targetId = activeConversation.id
      const fallback = activeConversation.messages ?? []
      setMessagesByConvId((prev) => {
        const current = prev[targetId] ?? fallback
        const next = typeof updater === "function" ? updater(current) : updater
        return {
          ...prev,
          [targetId]: next,
        }
      })
    },
    [activeConversation]
  )

  const activeConvId = activeConversation?.id ?? null
  const activeConvHasLoadedOrSeeded = Boolean(
    activeConversation &&
      (Object.prototype.hasOwnProperty.call(
        messagesByConvId,
        activeConversation.id
      ) ||
        (activeConversation.messages?.length ?? 0) > 0)
  )
  const activeConvUnreadCount = activeConversation?.unreadCount ?? 0
  const isLoadingMessages =
    Boolean(activeConvId) && loadingConvId === activeConvId

  // Load thread messages lazily & trigger Blue-Tick Read Receipts when unread thread opens (Spec 0013 AC-3, AC-6)
  React.useEffect(() => {
    if (!activeConvId) return
    let cancelled = false

    if (!activeConvHasLoadedOrSeeded) {
      void Promise.resolve().then(async () => {
        if (cancelled) return
        setLoadingConvId(activeConvId)
        try {
          const res = await getConversationMessagesAction(activeConvId)
          if (!cancelled && res.success && res.messages) {
            setMessagesByConvId((prev) => ({
              ...prev,
              [activeConvId]: res.messages as WhatsAppMessageRecord[],
            }))
          }
        } finally {
          if (!cancelled) {
            setLoadingConvId((curr) => (curr === activeConvId ? null : curr))
          }
        }
      })
    }

    // Auto blue-tick read receipt when opening a thread with unread inbound messages
    if (activeConvUnreadCount > 0) {
      markConversationMessagesAsReadAction({
        conversationId: activeConvId,
      }).then((res) => {
        if (!cancelled && res.success) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConvId ? { ...c, unreadCount: 0 } : c
            )
          )
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [activeConvId, activeConvHasLoadedOrSeeded, activeConvUnreadCount])

  // Manual 1-Click Blue-Tick Read Receipt button handler
  const handleMarkConversationRead = async () => {
    if (!activeConversation) return
    setIsMarkingRead(true)
    try {
      const res = await markConversationMessagesAsReadAction({
        conversationId: activeConversation.id,
      })
      if (res.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id ? { ...c, unreadCount: 0 } : c
          )
        )
        setActiveMessages((prev) =>
          prev.map((m) =>
            m.direction === "inbound" ? { ...m, status: "read" } : m
          )
        )
      }
    } finally {
      setIsMarkingRead(false)
    }
  }

  // T-068 & T-088 (OD-07): Single-flight, 100% read-only, visibility-paused 4-second live inbox polling
  const pollInFlightRef = React.useRef(false)

  React.useEffect(() => {
    if (!isLiveSyncEnabled || activeTab !== "inbox") return

    const runReadOnlyPollTick = async () => {
      if (
        typeof document !== "undefined" &&
        !isDocumentVisibilityActive(document.visibilityState)
      ) {
        return
      }
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true

      try {
        const convRes = await listWhatsappConversationsAction({ limit: 50 })
        if (convRes.success && convRes.conversations) {
          setConversations((prev) => {
            const nextList =
              convRes.conversations as unknown as WhatsAppConversationRecord[]
            return mergePolledConversations(prev, nextList)
          })
        }

        if (activeConversationId) {
          const msgRes = await getConversationMessagesAction(
            activeConversationId,
            50
          )
          if (msgRes.success && msgRes.messages) {
            setMessagesByConvId((prev) => {
              const current = prev[activeConversationId] ?? []
              const prevSummary = current
                .map((m) => `${m.id}-${m.status}-${m.mediaUrl}`)
                .join(",")
              const nextSummary = msgRes.messages
                .map((m) => `${m.id}-${m.status}-${m.mediaUrl}`)
                .join(",")
              if (prevSummary !== nextSummary) {
                return {
                  ...prev,
                  [activeConversationId]:
                    msgRes.messages as WhatsAppMessageRecord[],
                }
              }
              return prev
            })
          }
        }
      } catch (err) {
        console.debug("[whatsapp-poll] Background poll tick error:", err)
      } finally {
        pollInFlightRef.current = false
      }
    }

    const intervalId = setInterval(() => {
      void runReadOnlyPollTick()
    }, 4000)

    const handleVisibilityChange = () => {
      if (
        typeof document !== "undefined" &&
        isDocumentVisibilityActive(document.visibilityState)
      ) {
        void runReadOnlyPollTick()
      }
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange)
    }

    return () => {
      clearInterval(intervalId)
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        )
      }
    }
  }, [isLiveSyncEnabled, activeTab, activeConversationId])

  // Spec 0019: Pin, Archive, Agent Assignment, Internal Notes handlers
  const [isTogglingPin, setIsTogglingPin] = React.useState(false)
  const handleTogglePin = async () => {
    if (!activeConversation) return
    setIsTogglingPin(true)
    const nextPinned = !activeConversation.isPinned
    try {
      const res = await toggleWhatsappConversationPinAction({
        conversationId: activeConversation.id,
        isPinned: nextPinned,
      })
      if (res.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id ? { ...c, isPinned: nextPinned } : c
          )
        )
      }
    } finally {
      setIsTogglingPin(false)
    }
  }

  const [isTogglingArchive, setIsTogglingArchive] = React.useState(false)
  const handleToggleArchive = async () => {
    if (!activeConversation) return
    setIsTogglingArchive(true)
    const nextArchived = !activeConversation.isArchived
    try {
      const res = await toggleWhatsappConversationArchiveAction({
        conversationId: activeConversation.id,
        isArchived: nextArchived,
      })
      if (res.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id ? { ...c, isArchived: nextArchived } : c
          )
        )
      }
    } finally {
      setIsTogglingArchive(false)
    }
  }

  const [isAssigningAgent, setIsAssigningAgent] = React.useState(false)
  const handleAssignAgent = async (agentId: string | null) => {
    if (!activeConversation) return
    setIsAssigningAgent(true)
    try {
      const res = await assignWhatsappConversationAgentAction({
        conversationId: activeConversation.id,
        assignedUserId: agentId,
      })
      if (res.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? { ...c, assignedUserId: agentId }
              : c
          )
        )
      }
    } finally {
      setIsAssigningAgent(false)
    }
  }

  const [internalNoteInput, setInternalNoteInput] = React.useState("")
  const [isAddingNote, setIsAddingNote] = React.useState(false)
  const handleAddInternalNote = async () => {
    if (!activeConversation || !internalNoteInput.trim()) return
    setIsAddingNote(true)
    try {
      const res = await addWhatsappConversationInternalNoteAction({
        conversationId: activeConversation.id,
        note: internalNoteInput.trim(),
      })
      if (res.success && res.internalNotes) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? { ...c, internalNotes: res.internalNotes as WhatsappInternalNote[] }
              : c
          )
        )
        setInternalNoteInput("")
      }
    } finally {
      setIsAddingNote(false)
    }
  }

  // Manual Retry Mirror to R2 handler (Spec 0013 AC-1, AC-6)
  const handleManualMediaMirror = async (messageId: string) => {
    setMirroringMessageId(messageId)
    setComposerError(null)
    try {
      const res = await triggerManualMediaMirrorAction({ messageId })
      if (res.success && res.result?.mediaUrl) {
        setActiveMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  mediaUrl: res.result?.mediaUrl ?? m.mediaUrl,
                  mediaMimeType: res.result?.mediaMimeType ?? m.mediaMimeType,
                }
              : m
          )
        )
      } else if (!res.success) {
        setComposerError(res.error || "Failed to mirror media to Cloudflare R2")
      }
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : "Error mirroring media to R2"
      )
    } finally {
      setMirroringMessageId(null)
    }
  }

  // Quick Emoji Reaction handler (Spec 0013 AC-3, AC-6)
  const [reactionTargetWamid, setReactionTargetWamid] = React.useState<
    string | null
  >(null)

  const handleSendReaction = async (targetWamid: string, emoji: string) => {
    if (!activeConversation) return
    setReactionTargetWamid(null)
    try {
      const res = await sendWhatsAppReactionAction({
        conversationId: activeConversation.id,
        messageId: targetWamid,
        emoji,
      })
      if (res.success) {
        setActiveMessages((prev) =>
          prev.map((m) =>
            m.wamid === targetWamid ? { ...m, reactionEmoji: emoji } : m
          )
        )
      } else {
        setComposerError(res.error || "Failed to send emoji reaction")
      }
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : "Error sending reaction"
      )
    }
  }

  // Scroll-position preserving message thread scroll (T-088)
  const messagesScrollContainerRef = React.useRef<HTMLDivElement>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const prevScrollConversationIdRef = React.useRef<string | null>(null)
  const forceScrollToBottomRef = React.useRef(false)

  React.useEffect(() => {
    const container = messagesScrollContainerRef.current
    const currentConvId = activeConversation?.id ?? null
    const conversationChanged =
      prevScrollConversationIdRef.current !== currentConvId
    prevScrollConversationIdRef.current = currentConvId

    const shouldScroll = container
      ? shouldAutoScrollThreadOnUpdate({
          conversationChanged,
          forceScrollToBottom: forceScrollToBottomRef.current,
          scrollHeight: container.scrollHeight,
          scrollTop: container.scrollTop,
          clientHeight: container.clientHeight,
        })
      : conversationChanged || forceScrollToBottomRef.current

    forceScrollToBottomRef.current = false
    if (shouldScroll) {
      messagesEndRef.current?.scrollIntoView({
        behavior: conversationChanged ? "auto" : "smooth",
      })
    }
  }, [activeMessages, activeConversation?.id])

  // 24-hour service window calculation for active conversation
  const active24hState = React.useMemo(() => {
    if (
      !activeConversation ||
      !activeConversation.lastCustomerMessageAt ||
      nowMs <= 0
    ) {
      return { isInside: false, remainingHours: 0, remainingMinutes: 0 }
    }
    const lastTime = new Date(
      activeConversation.lastCustomerMessageAt
    ).getTime()
    const diffMs = 24 * 60 * 60 * 1000 - (nowMs - lastTime)
    if (diffMs <= 0) {
      return { isInside: false, remainingHours: 0, remainingMinutes: 0 }
    }
    const remainingHours = Math.floor(diffMs / 3600000)
    const remainingMinutes = Math.floor((diffMs % 3600000) / 60000)
    return { isInside: true, remainingHours, remainingMinutes }
  }, [activeConversation, nowMs])

  // Composer Modes: Standard Text vs Interactive Reply Buttons vs Interactive List Menu (Spec 0013 AC-4, AC-6)
  const [composerMode, setComposerMode] = React.useState<
    "text" | "buttons" | "list"
  >("text")
  const [composerText, setComposerText] = React.useState("")
  const [showQuickReplyPicker, setShowQuickReplyPicker] = React.useState(false)
  const [isSendingMessage, setIsSendingMessage] = React.useState(false)
  const [composerError, setComposerError] = React.useState<string | null>(null)

  // Interactive Reply Buttons Builder state (1..3 buttons)
  const [interactiveHeader, setInteractiveHeader] = React.useState("")
  const [interactiveFooter, setInteractiveFooter] = React.useState(
    "Al Ramlah Travels · Askari 10 Lahore"
  )
  const [replyButtons, setReplyButtons] = React.useState<
    Array<{ id: string; title: string }>
  >([
    { id: "btn_book_now", title: "Book Now" },
    { id: "btn_custom_dates", title: "Customize Dates" },
    { id: "btn_talk_agent", title: "Talk to Agent" },
  ])

  // Interactive List Menu Builder state
  const [listButtonText, setListButtonText] = React.useState("View Options")
  const [listSectionTitle, setListSectionTitle] = React.useState(
    "Available Packages"
  )
  const [listRows, setListRows] = React.useState<
    Array<{ id: string; title: string; description: string }>
  >([
    {
      id: "opt_quad",
      title: "Quad Sharing Tier",
      description: "4-Bed Haramain Hotel Sharing Rate",
    },
    {
      id: "opt_double",
      title: "Double Private Room",
      description: "2-Bed Private Couple Room Rate",
    },
  ])

  // AI Quoting Copilot Draft state for WhatsApp Inbox (Spec 0015 AC-4, scoped per conversation)
  const [generatingWaCopilotConvId, setGeneratingWaCopilotConvId] =
    React.useState<string | null>(null)
  const [waCopilotDraftState, setWaCopilotDraftState] = React.useState<{
    conversationId: string
    draft: WaCopilotDraftResult
    editableText: string
    meta: { modelUsed: string; executionMode: string } | null
  } | null>(null)
  const [waCopilotRunState, setWaCopilotRunState] = React.useState<{
    conversationId: string
    runId: string
    publicAccessToken?: string
    mode: "cloud" | "inline"
  } | null>(null)

  const currentActiveConvId = activeConversation?.id ?? null
  const isGeneratingWaCopilot =
    Boolean(currentActiveConvId) &&
    generatingWaCopilotConvId === currentActiveConvId
  const waCopilotDraft =
    waCopilotDraftState &&
    waCopilotDraftState.conversationId === currentActiveConvId
      ? waCopilotDraftState.draft
      : null
  const waCopilotEditableText =
    waCopilotDraftState &&
    waCopilotDraftState.conversationId === currentActiveConvId
      ? waCopilotDraftState.editableText
      : ""
  const waCopilotMeta =
    waCopilotDraftState &&
    waCopilotDraftState.conversationId === currentActiveConvId
      ? waCopilotDraftState.meta
      : null
  const waCopilotRun =
    waCopilotRunState &&
    waCopilotRunState.conversationId === currentActiveConvId
      ? waCopilotRunState
      : null

  const setWaCopilotDraft = React.useCallback(
    (
      draft: WaCopilotDraftResult | null,
      editableText?: string,
      meta?: { modelUsed: string; executionMode: string } | null
    ) => {
      if (!draft || !currentActiveConvId) {
        setWaCopilotDraftState(null)
        return
      }
      setWaCopilotDraftState({
        conversationId: currentActiveConvId,
        draft,
        editableText: editableText ?? draft.bilingualReplyDraft,
        meta: meta ?? null,
      })
    },
    [currentActiveConvId]
  )

  const setWaCopilotEditableText = React.useCallback(
    (text: string) => {
      setWaCopilotDraftState((prev) =>
        prev && prev.conversationId === currentActiveConvId
          ? { ...prev, editableText: text }
          : prev
      )
    },
    [currentActiveConvId]
  )

  // Rehydrate active Trigger.dev runs when switching conversation (async callback only)
  React.useEffect(() => {
    if (!activeConversationId) return
    let cancelled = false

    listActiveRunsByTagsAction([`copilot:wa:${activeConversationId}`])
      .then((runRes) => {
        if (!cancelled && runRes.success && runRes.activeRuns.length > 0) {
          const latestActive = runRes.activeRuns[0]
          setWaCopilotRunState({
            conversationId: activeConversationId,
            runId: latestActive.runId,
            publicAccessToken: runRes.publicAccessToken,
            mode: runRes.mode === "cloud" ? "cloud" : "inline",
          })
          setGeneratingWaCopilotConvId(activeConversationId)
        }
      })
      .catch(() => null)

    return () => {
      cancelled = true
    }
  }, [activeConversationId])

  const handleGenerateWaCopilotDraft = async () => {
    if (!activeConversation) return
    const convId = activeConversation.id
    setGeneratingWaCopilotConvId(convId)
    setComposerError(null)
    try {
      const res = await startWhatsappCopilotRunAction({
        conversationId: convId,
      })
      if (!res.success) {
        setComposerError(
          res.error || "Failed to generate AI Copilot WhatsApp draft"
        )
        setGeneratingWaCopilotConvId((curr) => (curr === convId ? null : curr))
      } else if (res.mode === "cloud" && res.runId) {
        setWaCopilotRunState({
          conversationId: convId,
          runId: res.runId,
          publicAccessToken: res.publicAccessToken,
          mode: "cloud",
        })
      } else if (res.inlineOutput && res.inlineOutput.success) {
        setWaCopilotDraftState({
          conversationId: convId,
          draft: res.inlineOutput.draft,
          editableText: res.inlineOutput.draft.bilingualReplyDraft,
          meta: {
            modelUsed: res.inlineOutput.modelUsed,
            executionMode: res.inlineOutput.executionMode,
          },
        })
        setGeneratingWaCopilotConvId((curr) => (curr === convId ? null : curr))
      } else {
        setGeneratingWaCopilotConvId((curr) => (curr === convId ? null : curr))
      }
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : "Error generating AI Copilot draft"
      )
      setGeneratingWaCopilotConvId((curr) => (curr === convId ? null : curr))
    }
  }

  const handleUseCopilotDraftInComposer = () => {
    if (!waCopilotEditableText.trim()) return
    setComposerMode("text")
    setComposerText(waCopilotEditableText.trim())
    setWaCopilotDraft(null)
  }

  // Template selector state (outside 24h window — strictly APPROVED Meta templates, T-067 & OD-01)
  const approvedTemplatesList = React.useMemo(
    () => templatesList.filter((t) => t.status === "APPROVED"),
    [templatesList]
  )
  const [selectedTemplateName, setSelectedTemplateName] = React.useState<string>(
    approvedTemplatesList[0]?.name ?? whatsappTemplates[0]?.name ?? ""
  )
  const [templateVariableValues, setTemplateVariableValues] = React.useState<
    Record<string, string>
  >({})
  const [templateHeaderMediaUrl, setTemplateHeaderMediaUrl] = React.useState("")

  const selectedTemplate = React.useMemo(() => {
    return (
      approvedTemplatesList.find((t) => t.name === selectedTemplateName) ??
      approvedTemplatesList[0] ??
      null
    )
  }, [approvedTemplatesList, selectedTemplateName])

  const templatePlaceholders = React.useMemo(() => {
    return extractTemplatePlaceholders(selectedTemplate?.bodyText || "")
  }, [selectedTemplate])

  // Send WhatsApp reply (Text, Interactive Buttons, Interactive List, or Template)
  const handleSendReply = async () => {
    if (!activeConversation) return
    setComposerError(null)
    forceScrollToBottomRef.current = true

    if (active24hState.isInside) {
      if (!composerText.trim()) return
      setIsSendingMessage(true)

      try {
        if (composerMode === "buttons") {
          const validButtons = replyButtons
            .map((b, i) => ({
              id: b.id.trim() || `btn_${i + 1}`,
              title: b.title.trim().slice(0, 20),
            }))
            .filter((b) => b.title.length > 0)

          if (validButtons.length === 0) {
            setComposerError("Add at least 1 reply button title (max 20 chars).")
            setIsSendingMessage(false)
            return
          }

          const res = await sendWhatsAppInteractiveButtonsAction({
            conversationId: activeConversation.id,
            headerText: interactiveHeader.trim() || undefined,
            bodyText: composerText.trim(),
            footerText: interactiveFooter.trim() || undefined,
            buttons: validButtons.slice(0, 3),
          })

          if (!res.success) {
            setComposerError(
              res.error || "Failed to send interactive reply buttons"
            )
          } else {
            const newMsg: WhatsAppMessageRecord = {
              id: res.messageId || createOptimisticMessageId(),
              conversationId: activeConversation.id,
              wamid: res.wamid || "wamid.local",
              direction: "outbound",
              status: "sent",
              messageType: "interactive",
              body: composerText.trim(),
              interactivePayload: {
                type: "button",
                headerText: interactiveHeader.trim() || undefined,
                bodyText: composerText.trim(),
                footerText: interactiveFooter.trim() || undefined,
                buttons: validButtons.slice(0, 3),
              },
              createdAt: new Date().toISOString(),
            }
            setActiveMessages((prev) => [...prev, newMsg])
            setComposerText("")
          }
        } else if (composerMode === "list") {
          const validRows = listRows
            .map((r, i) => ({
              id: r.id.trim() || `row_${i + 1}`,
              title: r.title.trim().slice(0, 24),
              description: r.description.trim().slice(0, 72) || undefined,
            }))
            .filter((r) => r.title.length > 0)

          if (validRows.length === 0) {
            setComposerError("Add at least 1 list row title (max 24 chars).")
            setIsSendingMessage(false)
            return
          }

          const res = await sendWhatsAppInteractiveListAction({
            conversationId: activeConversation.id,
            headerText: interactiveHeader.trim() || undefined,
            bodyText: composerText.trim(),
            footerText: interactiveFooter.trim() || undefined,
            buttonText: (listButtonText.trim() || "View Options").slice(0, 20),
            sections: [
              {
                title: (listSectionTitle.trim() || "Options").slice(0, 24),
                rows: validRows,
              },
            ],
          })

          if (!res.success) {
            setComposerError(res.error || "Failed to send interactive list menu")
          } else {
            const newMsg: WhatsAppMessageRecord = {
              id: res.messageId || createOptimisticMessageId(),
              conversationId: activeConversation.id,
              wamid: res.wamid || "wamid.local",
              direction: "outbound",
              status: "sent",
              messageType: "interactive",
              body: composerText.trim(),
              interactivePayload: {
                type: "list",
                headerText: interactiveHeader.trim() || undefined,
                bodyText: composerText.trim(),
                footerText: interactiveFooter.trim() || undefined,
                buttonText: listButtonText.trim() || "View Options",
                sections: [
                  {
                    title: listSectionTitle.trim() || "Options",
                    rows: validRows,
                  },
                ],
              },
              createdAt: new Date().toISOString(),
            }
            setActiveMessages((prev) => [...prev, newMsg])
            setComposerText("")
          }
        } else {
          // Standard Text Mode
          const res = await sendWhatsappConversationReplyAction({
            conversationId: activeConversation.id,
            messageType: "text",
            text: composerText.trim(),
          })

          if (!res.success) {
            setComposerError(res.error || "Failed to dispatch message")
          } else {
            const newMsg: WhatsAppMessageRecord = {
              id: res.messageId || createOptimisticMessageId(),
              conversationId: activeConversation.id,
              wamid: res.wamid || "wamid.local",
              direction: "outbound",
              status: "sent",
              messageType: "text",
              body: composerText.trim(),
              createdAt: new Date().toISOString(),
            }
            setActiveMessages((prev) => [...prev, newMsg])
            setComposerText("")
            setShowQuickReplyPicker(false)
          }
        }
      } catch (err) {
        setComposerError(
          err instanceof Error ? err.message : "Error sending message"
        )
      } finally {
        setIsSendingMessage(false)
      }
    } else {
      // Outside 24h: send pre-approved template
      if (!selectedTemplate) {
        setComposerError("Please select a Meta pre-approved message template.")
        return
      }
      setIsSendingMessage(true)
      try {
        const resolvedParams = templatePlaceholders.map(
          (ph) =>
            templateVariableValues[ph] ??
            (ph === 1 ? (activeConversation.contactName || "Pilgrim") : "")
        )

        const res = await sendWhatsappConversationReplyAction({
          conversationId: activeConversation.id,
          messageType: "template",
          templateName: selectedTemplate.name,
          templateLanguage: selectedTemplate.language || "en_US",
          templateParams: resolvedParams,
          headerMediaUrl: templateHeaderMediaUrl.trim() || undefined,
        })

        if (!res.success) {
          setComposerError(res.error || "Failed to dispatch template")
        } else {
          const newMsg: WhatsAppMessageRecord = {
            id: res.messageId || createOptimisticMessageId(),
            conversationId: activeConversation.id,
            wamid: res.wamid || "wamid.local",
            direction: "outbound",
            status: "sent",
            messageType: "template",
            templateName: selectedTemplate.name,
            body: interpolateTemplateVariables(
              selectedTemplate.bodyText,
              resolvedParams,
              {
                name: activeConversation.contactName,
                phone: activeConversation.contactPhone,
              }
            ),
            mediaUrl: templateHeaderMediaUrl.trim() || undefined,
            createdAt: new Date().toISOString(),
          }
          setActiveMessages((prev) => [...prev, newMsg])
        }
      } catch (err) {
        setComposerError(
          err instanceof Error ? err.message : "Error sending template"
        )
      } finally {
        setIsSendingMessage(false)
      }
    }
  }

  // 1-Click Send 3-Page Luxury Quotation PDF via WhatsApp
  const [isSendingPdf, setIsSendingPdf] = React.useState(false)
  const [pdfSuccessBanner, setPdfSuccessBanner] = React.useState<string | null>(
    null
  )

  const handleSendLuxuryPdf = async () => {
    if (!activeConversation || !activeConversation.applicationId) return
    setIsSendingPdf(true)
    setComposerError(null)
    setPdfSuccessBanner(null)

    try {
      const res = await sendApplicationLuxuryPdfViaWhatsappAction({
        applicationId: activeConversation.applicationId,
        phoneNumberOverride: activeConversation.contactPhone,
      })

      if (!res.success) {
        setComposerError(
          res.error ||
            "Failed to generate or dispatch 3-page luxury quotation PDF"
        )
      } else {
        setPdfSuccessBanner(
          `3-Page Luxury PDF quotation dispatched successfully to ${activeConversation.contactPhone}!`
        )
        const docMsg: WhatsAppMessageRecord = {
          id: res.messageId || createOptimisticMessageId(),
          conversationId: activeConversation.id,
          wamid: res.wamid || "wamid.pdf",
          direction: "outbound",
          status: "sent",
          messageType: "document",
          mediaUrl: res.pdfUrl,
          mediaFilename: "Al_Ramlah_Umrah_Quotation.pdf",
          body: "Official 3-Page Luxury Umrah Itinerary & Quotation PDF",
          createdAt: new Date().toISOString(),
        }
        setActiveMessages((prev) => [...prev, docMsg])
      }
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : "Error dispatching luxury PDF"
      )
    } finally {
      setIsSendingPdf(false)
    }
  }

  // Package Lookup Match for active conversation's detectedPostCode
  const detectedPackage = React.useMemo(() => {
    if (!activeConversation?.detectedPostCode) return null
    const code = activeConversation.detectedPostCode.trim().toUpperCase()
    return (
      flyerPackages.find((p) => p.postCode.trim().toUpperCase() === code) ??
      null
    )
  }, [activeConversation, flyerPackages])

  // 1-Click Convert Post Lookup to Application modal state
  const [convertModalOpen, setConvertModalOpen] = React.useState(false)
  const [convertRoomType, setConvertRoomType] = React.useState<
    "sharing" | "quad" | "triple" | "double"
  >("quad")
  const [convertAdults, setConvertAdults] = React.useState(2)
  const [isConvertingQuote, setIsConvertingQuote] = React.useState(false)

  const handleConvertPostLookup = async () => {
    if (!detectedPackage || !activeConversation) return
    setIsConvertingQuote(true)
    try {
      const res = await convertPostLookupToApplication({
        packageItemId: detectedPackage.id,
        customerName: activeConversation.contactName || "WhatsApp Pilgrim",
        customerPhone: activeConversation.contactPhone,
        selectedRoomType: convertRoomType,
        adults: convertAdults,
      })

      if (res.success && res.applicationId) {
        setConvertModalOpen(false)
        router.push(`/admin/applications/${res.applicationId}`)
      } else {
        setComposerError(
          res.error || "Failed to convert post lookup to quote application"
        )
      }
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : "Conversion error"
      )
    } finally {
      setIsConvertingQuote(false)
    }
  }

  // Coexistence Intent Gatekeeper Handlers
  const [isUpdatingIntent, setIsUpdatingIntent] = React.useState(false)
  const [isHandingOffToAgent, setIsHandingOffToAgent] = React.useState(false)

  const handleUpdateConversationIntent = async (
    nextIntent: "TRAVEL_LEAD" | "PERSONAL_OR_OTHER" | "FOUNDER_HANDOFF"
  ) => {
    if (!activeConversation) return
    setIsUpdatingIntent(true)
    setComposerError(null)
    try {
      const res = await updateConversationIntentAction({
        conversationId: activeConversation.id,
        intentCategory: nextIntent,
      })
      if (res.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? {
                  ...c,
                  intentCategory: nextIntent,
                  intentConfidence: 100,
                  intentReason: `Manually marked as ${nextIntent} from Admin Desk`,
                }
              : c
          )
        )
      } else {
        setComposerError("Failed to update conversation intent")
      }
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : "Error updating intent"
      )
    } finally {
      setIsUpdatingIntent(false)
    }
  }

  const handleHandoffToAgent = async () => {
    if (!activeConversation) return
    setIsHandingOffToAgent(true)
    setComposerError(null)
    try {
      const res = await handoffConversationToDedicatedAgentAction({
        conversationId: activeConversation.id,
      })
      if (res.success) {
        setPdfSuccessBanner(
          `Handed off ${activeConversation.contactPhone} to ${res.dedicatedAccountName || "Dedicated AI Agent"} (${res.dedicatedPhone || "Active Line"})!`
        )
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? {
                  ...c,
                  intentCategory: "FOUNDER_HANDOFF",
                  intentConfidence: 100,
                  forwardedToAgentConversationId:
                    res.targetConversationId ?? c.forwardedToAgentConversationId,
                }
              : c
          )
        )
      } else {
        setComposerError(res.error || "Failed to hand off conversation to AI Agent")
      }
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : "Error handing off conversation"
      )
    } finally {
      setIsHandingOffToAgent(false)
    }
  }

  const activeConversationsCount = React.useMemo(
    () => conversations.filter((c) => !c.isArchived).length,
    [conversations]
  )
  const pinnedConversationsCount = React.useMemo(
    () => conversations.filter((c) => c.isPinned).length,
    [conversations]
  )
  const archivedConversationsCount = React.useMemo(
    () => conversations.filter((c) => c.isArchived).length,
    [conversations]
  )
  const unreadConversationsCount = React.useMemo(
    () => conversations.filter((c) => !c.isArchived && c.unreadCount > 0).length,
    [conversations]
  )

  // Filtered inbox conversations
  const filteredConversations = React.useMemo(() => {
    return conversations.filter((c) => {
      // State filter tabs (Active, Pinned, Archived)
      if (conversationFilterTab === "pinned" && !c.isPinned) return false
      if (conversationFilterTab === "archived" && !c.isArchived) return false
      if (conversationFilterTab === "active" && c.isArchived) return false

      if (inboxSearch.trim()) {
        const q = inboxSearch.toLowerCase().trim()
        const matchName = c.contactName?.toLowerCase().includes(q) ?? false
        const matchPhone = c.contactPhone.includes(q)
        const matchCode = c.detectedPostCode?.toLowerCase().includes(q) ?? false
        if (!matchName && !matchPhone && !matchCode) return false
      }

      if (inboxFilter === "unread" && c.unreadCount <= 0) return false
      if (inboxFilter === "with_code" && !c.detectedPostCode) return false

      if (inboxFilter === "active_24h" || inboxFilter === "overdue_24h") {
        if (!c.lastCustomerMessageAt) return inboxFilter === "overdue_24h"
        if (nowMs <= 0) return inboxFilter === "overdue_24h"
        const last = new Date(c.lastCustomerMessageAt).getTime()
        const isInside = nowMs - last <= 24 * 3600 * 1000
        if (inboxFilter === "active_24h" && !isInside) return false
        if (inboxFilter === "overdue_24h" && isInside) return false
      }

      // Phone Line Filter
      if (phoneLineFilter !== "all") {
        const key =
          c.account?.displayPhoneNumber ||
          c.account?.phoneNumberId ||
          c.accountId
        if (key !== phoneLineFilter) return false
      }

      return true
    })
  }, [
    conversations,
    inboxSearch,
    inboxFilter,
    conversationFilterTab,
    phoneLineFilter,
    nowMs,
  ])

  const autoReplyEnabled = activeAccount?.autoReplyEnabled ?? true

  return (
    <div className="flex flex-col gap-6">
      {/* ==========================================
          GLOBAL DESK HEADER & WORKSPACE NAVIGATION
          ========================================== */}
      <div className="flex flex-col gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Inbox className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Pilgrim Inbox &amp; Quote Desk
              </h1>
              <p className="text-xs text-muted-foreground">
                Operational quoting pipeline, live Meta WhatsApp Cloud API shared inbox, and website inquiries.
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Actions: AI Quote Copilot & ⌘K Post Reverse Lookup */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPipelineCopilotOpen(true)
              if (selectedPipelineAppId && !pipelineCopilotDraft) {
                handleRunPipelineCopilot(selectedPipelineAppId)
              }
            }}
            className="gap-1.5 border-gold-border bg-primary font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
          >
            <Sparkles className="size-3.5 text-gold" aria-hidden="true" />
            <span>AI Quote Copilot</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-post-lookup"))
            }
            className="gap-1.5 border-primary/40 bg-card font-medium text-primary shadow-2xs hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
            title="Search packages and instant convert to quote (Ctrl+K or Cmd+K)"
          >
            <Command className="size-3.5" aria-hidden="true" />
            <span>Lookup Post Ref</span>
            <kbd className="ml-1 rounded border border-primary/30 bg-secondary px-1.5 py-0.2 font-mono text-[11px] text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
        </div>
      </div>

      {/* ==========================================
          HUB TABS SWITCHER
          ========================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Tab 1: Pipeline */}
          <button
            type="button"
            onClick={() => switchTab("pipeline")}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 active:opacity-80 motion-reduce:transition-none",
              activeTab === "pipeline"
                ? "bg-primary text-primary-foreground shadow-xs focus-visible:outline-gold"
                : "border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-primary"
            )}
          >
            <Kanban className="size-4" aria-hidden="true" />
            <span>Inquiries &amp; Quoting Pipeline</span>
            {pendingCount > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.2 text-xs font-bold tabular-nums",
                  activeTab === "pipeline"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "border border-status-warning-border bg-status-warning-bg text-status-warning"
                )}
              >
                {pendingCount}
              </span>
            )}
          </button>

          {/* Tab 2: WhatsApp Inbox */}
          <button
            type="button"
            onClick={() => switchTab("inbox")}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 active:opacity-80 motion-reduce:transition-none",
              activeTab === "inbox"
                ? "bg-primary text-primary-foreground shadow-xs focus-visible:outline-gold"
                : "border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-primary"
            )}
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            <span>WhatsApp Shared Team Inbox</span>
            {totalUnreadWhatsApp > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.2 text-xs font-bold tabular-nums",
                  activeTab === "inbox"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "border border-status-success-border bg-status-success-bg text-status-success"
                )}
              >
                {totalUnreadWhatsApp}
              </span>
            )}
          </button>

          {/* Tab 3: Web Contact Messages */}
          <button
            type="button"
            onClick={() => switchTab("web_messages")}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 active:opacity-80 motion-reduce:transition-none",
              activeTab === "web_messages"
                ? "bg-primary text-primary-foreground shadow-xs focus-visible:outline-gold"
                : "border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-primary"
            )}
          >
            <FileText className="size-4" aria-hidden="true" />
            <span>Website &amp; Hajj Messages</span>
            {unreadContactMessages > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.2 text-xs font-bold tabular-nums",
                  activeTab === "web_messages"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "border border-status-info-border bg-status-info-bg text-status-info"
                )}
              >
                {unreadContactMessages}
              </span>
            )}
          </button>
        </div>

        {/* ART-... Auto-Responder Bot Toggle & Keyword Auto-Reply Studio in Inbox Header (Spec 0013 & Spec 0017) */}
        {activeTab === "inbox" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 shadow-2xs">
              <Bot className="size-4 text-primary" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold leading-none text-foreground">
                  ART-… Auto-Responder Bot
                </span>
                <span className="text-[11px] text-muted-foreground">
                  3s instant flyer &amp; PKR rates reply
                </span>
              </div>
              <button
                type="button"
                disabled={isTogglingAutoResponder}
                onClick={handleToggleAutoResponder}
                className={cn(
                  "ml-2 flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                  autoReplyEnabled
                    ? "border-status-success-border bg-status-success text-primary-foreground"
                    : "border-border bg-secondary text-muted-foreground"
                )}
                title="Toggle automatic 3-second replies when pilgrims send ART-... post codes"
              >
                {isTogglingAutoResponder ? (
                  <Loader2
                    className="size-3 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <span>{autoReplyEnabled ? "ON" : "OFF"}</span>
                )}
              </button>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTemplateStudioOpen(true)}
              className="h-9 gap-1.5 border border-gold-border bg-card font-semibold text-primary shadow-2xs hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
              title="Open Official Meta WhatsApp HSM Template Studio (Create, Sync & Manage Templates)"
            >
              <Layers
                className="size-3.5 text-gold-text"
                aria-hidden="true"
              />
              <span>Meta Templates</span>
              <span className="ml-0.5 rounded-full border border-status-success-border bg-status-success-bg px-1.5 py-0.2 font-mono text-[11px] tabular-nums text-status-success">
                {approvedTemplatesList.length}
              </span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setAutoReplyStudioOpen(true)}
              className="h-9 gap-1.5 border border-gold-border bg-primary font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
              title="Open WaCRM Keyword Auto-Reply Rules Engine, Greeting & Business Hours Setup, and Quick-Reply Manager"
            >
              <Zap className="size-3.5 text-gold" aria-hidden="true" />
              <span>Auto-Replies &amp; Setup</span>
              <span className="ml-0.5 rounded-full border border-gold-border/50 bg-gold/20 px-1.5 py-0.2 font-mono text-[11px] tabular-nums text-gold">
                {autoReplyRules.filter((r) => r.isActive).length}
              </span>
            </Button>
          </div>
        )}
      </div>

      {/* =========================================================================
          TAB 1: INQUIRIES & QUOTING PIPELINE (KANBAN DESK & TABLE VIEW TOGGLE)
          ========================================================================= */}
      {activeTab === "pipeline" && (
        <div className="flex flex-col gap-6 animate-in fade-in-50 duration-200 motion-reduce:animate-none">
          {/* 1. KPI Summary Strip */}
          <ApplicationsKpiStrip data={kpiData} />

          {/* 2. Pipeline Controls Bar (Search + Source Filter + View Mode Switcher) */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-md">
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference (ART-…), pilgrim name, phone, city…"
                className="pl-9 pr-8 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search query"
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Source Filters & View Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                <span className="mr-1 text-xs font-semibold text-muted-foreground">
                  Source:
                </span>
                {[
                  { key: "all", label: "All Sources" },
                  { key: "custom_builder", label: "Custom Builder" },
                  { key: "group_booking", label: "Group Booking" },
                  { key: "post_lookup", label: "Post Lookup" },
                  { key: "hajj_inquiry", label: "Hajj Inquiry" },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSourceFilter(s.key)}
                    className={cn(
                      "whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 active:opacity-80 motion-reduce:transition-none",
                      sourceFilter === s.key
                        ? "bg-primary font-semibold text-primary-foreground focus-visible:outline-gold"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground focus-visible:outline-primary"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* View Switcher: Kanban vs Table */}
              <div className="flex items-center rounded-xl border border-border bg-secondary/50 p-1">
                <button
                  type="button"
                  onClick={() => setPipelineViewMode("kanban")}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                    pipelineViewMode === "kanban"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Kanban className="size-3.5" aria-hidden="true" />
                  <span>Kanban Board</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPipelineViewMode("table")}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                    pipelineViewMode === "table"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TableIcon className="size-3.5" aria-hidden="true" />
                  <span>Table View</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Pipeline Content: Kanban Board or Table View */}
          {pipelineViewMode === "kanban" ? (
            <ApplicationsKanbanBoard
              applications={
                filteredApplications as unknown as KanbanApplicationItem[]
              }
              slaHours={slaHours}
              initialNowMs={nowMs > 0 ? nowMs : initialNowMs}
            />
          ) : (
            <ApplicationsTable applications={filteredApplications} />
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: LIVE WHATSAPP CLOUD API SHARED TEAM INBOX (3-PANE WACRM LAYOUT)
          ========================================================================= */}
      {activeTab === "inbox" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 xl:gap-5 animate-in fade-in-50 duration-200 motion-reduce:animate-none">
          {/* PANE 1: Conversation List (4 Cols) */}
          <div className="flex min-h-[700px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs lg:col-span-4">
            {/* Header & Search */}
            <div className="flex flex-col gap-2.5 border-b border-border p-3.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-display text-sm font-bold tracking-tight text-foreground">
                  <MessageCircle
                    className="size-4 text-status-success"
                    aria-hidden="true"
                  />
                  <span>Pilgrim Conversations</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsLiveSyncEnabled(!isLiveSyncEnabled)}
                    className={cn(
                      "flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                      isLiveSyncEnabled
                        ? "border-status-success-border bg-status-success-bg text-status-success"
                        : "border-border bg-secondary text-muted-foreground"
                    )}
                    title={
                      isLiveSyncEnabled
                        ? "Live 4s auto-sync active (click to pause)"
                        : "Auto-sync paused (click to resume)"
                    }
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isLiveSyncEnabled
                          ? "animate-pulse bg-status-success motion-reduce:animate-none"
                          : "bg-muted-foreground/60"
                      )}
                    />
                    <span>{isLiveSyncEnabled ? "Live (4s)" : "Paused"}</span>
                  </button>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                    {filteredConversations.length}
                  </span>
                </div>
              </div>

              {/* Row 1: Search Bar + Dynamic Phone Line Filter */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    value={inboxSearch}
                    onChange={(e) => setInboxSearch(e.target.value)}
                    placeholder="Search name, phone, or package code…"
                    className="h-8 bg-background pl-8 text-xs"
                  />
                </div>
                {phoneLineFilters.length > 1 && (
                  <select
                    aria-label="Filter conversations by phone line"
                    value={phoneLineFilter}
                    onChange={(e) => setPhoneLineFilter(e.target.value)}
                    className="h-8 max-w-[130px] rounded-md border border-input bg-background px-2 text-[11px] font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {phoneLineFilters.map((tab) => (
                      <option key={tab.id} value={tab.id}>
                        {tab.prefixLabel ? `${tab.prefixLabel}: ` : ""}
                        {tab.label} ({tab.count})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Row 2: Status Filter Bar (All, Unread, Pinned, Archived) */}
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-secondary/30 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setConversationFilterTab("active")
                    setInboxFilter("all")
                  }}
                  className={cn(
                    "flex min-h-7 flex-1 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 active:opacity-80 motion-reduce:transition-none",
                    conversationFilterTab === "active" && inboxFilter === "all"
                      ? "bg-primary text-primary-foreground shadow-2xs focus-visible:outline-gold"
                      : "text-muted-foreground hover:text-foreground focus-visible:outline-primary"
                  )}
                >
                  <Inbox className="size-3" aria-hidden="true" />
                  <span>All</span>
                  <span className="rounded-full bg-foreground/10 px-1.5 py-0.1 text-[11px] tabular-nums">
                    {activeConversationsCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConversationFilterTab("active")
                    setInboxFilter("unread")
                  }}
                  className={cn(
                    "flex min-h-7 flex-1 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                    inboxFilter === "unread"
                      ? "bg-status-success text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>Unread</span>
                  <span className="rounded-full bg-foreground/10 px-1.5 py-0.1 text-[11px] tabular-nums">
                    {unreadConversationsCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConversationFilterTab("pinned")
                    setInboxFilter("all")
                  }}
                  className={cn(
                    "flex min-h-7 flex-1 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                    conversationFilterTab === "pinned"
                      ? "bg-gold-text text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Pin className="size-3" aria-hidden="true" />
                  <span>Pinned</span>
                  <span className="rounded-full bg-foreground/10 px-1.5 py-0.1 text-[11px] tabular-nums">
                    {pinnedConversationsCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConversationFilterTab("archived")
                    setInboxFilter("all")
                  }}
                  className={cn(
                    "flex min-h-7 flex-1 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                    conversationFilterTab === "archived"
                      ? "bg-foreground text-background shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Archive className="size-3" aria-hidden="true" />
                  <span>Archived</span>
                  <span className="rounded-full bg-foreground/10 px-1.5 py-0.1 text-[11px] tabular-nums">
                    {archivedConversationsCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Conversation Items */}
            <div className="flex max-h-[640px] flex-1 flex-col divide-y divide-border/60 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
                  <MessageCircle
                    className="mb-2 size-8 text-muted-foreground/40"
                    aria-hidden="true"
                  />
                  <p className="font-medium text-foreground">
                    No conversations found
                  </p>
                  <p className="mt-1">
                    Inbound messages via WhatsApp or Meta Webhook will appear here live.
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = conv.id === activeConversation?.id

                  // Calculate 24h window
                  let isInside24h = false
                  let windowLabel = "Template Required"
                  if (conv.lastCustomerMessageAt && nowMs > 0) {
                    const diff =
                      24 * 3600 * 1000 -
                      (nowMs -
                        new Date(conv.lastCustomerMessageAt).getTime())
                    if (diff > 0) {
                      isInside24h = true
                      const hrs = Math.floor(diff / 3600000)
                      windowLabel = `Active 24h (${hrs}h)`
                    }
                  }

                  const snippet =
                    conv.messages?.[conv.messages.length - 1]?.body ||
                    "No messages yet"

                  const isPersonalMuted =
                    conv.intentCategory === "PERSONAL_OR_OTHER"
                  const isHandoff = conv.intentCategory === "FOUNDER_HANDOFF"
                  const isTravelLead = conv.intentCategory === "TRAVEL_LEAD"

                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => setActiveConversationId(conv.id)}
                      className={cn(
                        "flex flex-col gap-1.5 p-3.5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                        isSelected && "border-l-3 border-primary bg-secondary/70"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex max-w-[170px] items-center gap-1.5 truncate">
                          {conv.isPinned && (
                            <Pin
                              className="size-3 shrink-0 fill-gold-text text-gold-text"
                              aria-hidden="true"
                            />
                          )}
                          <span className="truncate font-display text-xs font-bold text-foreground">
                            {conv.contactName || conv.contactPhone}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {new Date(conv.lastMessageAt).toLocaleDateString(
                            "en-PK",
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </span>
                      </div>

                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {snippet}
                      </p>

                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <div className="flex flex-wrap items-center gap-1">
                          {/* Multi-Number Phone Line Badge */}
                          {conv.account?.platformType === "LINKED_DEVICE" ? (
                            <span className="flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-1.5 py-0.2 text-[10px] font-semibold text-status-success">
                              <Smartphone
                                className="size-2.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="font-mono tabular-nums">
                                {conv.account.displayPhoneNumber || "Line"}
                              </span>
                              <span>(Linked)</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full border border-status-info-border bg-status-info-bg px-1.5 py-0.2 text-[10px] font-medium text-status-info">
                              <Cloud
                                className="size-2.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="font-mono tabular-nums">
                                {conv.account?.displayPhoneNumber || "Cloud API"}
                              </span>
                              <span>(Meta)</span>
                            </span>
                          )}

                          <span
                            className={cn(
                              "rounded-full border px-1.5 py-0.2 text-[10px] font-medium",
                              isInside24h
                                ? "border-status-success-border bg-status-success-bg text-status-success"
                                : "border-status-warning-border bg-status-warning-bg text-status-warning"
                            )}
                          >
                            {windowLabel}
                          </span>

                          {isPersonalMuted ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                              <Lock
                                className="size-2.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Personal (Bot Muted)</span>
                            </span>
                          ) : isHandoff ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-gold-border bg-accent px-1.5 py-0.2 text-[10px] font-semibold text-gold-text">
                              <UserCheck
                                className="size-2.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Agent Handoff</span>
                            </span>
                          ) : isTravelLead ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-1.5 py-0.2 text-[10px] font-semibold text-status-success">
                              <Compass
                                className="size-2.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Travel Lead</span>
                            </span>
                          ) : null}

                          {conv.detectedPostCode && (
                            <span className="rounded-full border border-gold-border bg-accent px-1.5 py-0.2 font-mono text-[10px] font-bold text-primary">
                              {conv.detectedPostCode}
                            </span>
                          )}
                        </div>

                        {conv.unreadCount > 0 && (
                          <span className="rounded-full bg-status-success px-1.5 py-0.2 text-[10px] font-bold tabular-nums text-primary-foreground">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* PANE 2: Center Message Stream & Composer (5 Cols) */}
          <div className="flex min-h-[700px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs lg:col-span-5">
            {activeConversation ? (
              <>
                {/* Active Chat Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/30 p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-full bg-status-success-bg text-xs font-bold text-status-success">
                      {activeConversation.contactName
                        ? activeConversation.contactName
                            .slice(0, 2)
                            .toUpperCase()
                        : "WA"}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-display text-sm font-bold text-foreground">
                          {activeConversation.contactName ||
                            activeConversation.contactPhone}
                        </span>
                        {activeConversation.detectedPostCode && (
                          <Badge
                            variant="outline"
                            className="border-gold-border bg-accent font-mono text-[11px] text-primary"
                          >
                            {activeConversation.detectedPostCode}
                          </Badge>
                        )}
                        {/* AI Intent Classification Badge */}
                        {activeConversation.intentCategory ===
                        "PERSONAL_OR_OTHER" ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-border bg-secondary text-[11px] font-semibold text-muted-foreground"
                            title={
                              activeConversation.intentReason ||
                              "Personal or non-travel conversation (Auto-replies muted)"
                            }
                          >
                            <Lock className="size-3" aria-hidden="true" />
                            <span>Personal / Bot Muted</span>
                          </Badge>
                        ) : activeConversation.intentCategory ===
                          "FOUNDER_HANDOFF" ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-gold-border bg-accent text-[11px] font-semibold text-gold-text"
                            title={
                              activeConversation.intentReason ||
                              "Handed off from Founder Line to Dedicated AI Agent"
                            }
                          >
                            <UserCheck className="size-3" aria-hidden="true" />
                            <span>Founder Handoff</span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-status-success-border bg-status-success-bg text-[11px] font-semibold text-status-success"
                            title={
                              activeConversation.intentReason ||
                              "Verified Al Ramlah Travels inquiry"
                            }
                          >
                            <Compass className="size-3" aria-hidden="true" />
                            <span>
                              Travel Lead
                              {activeConversation.intentConfidence
                                ? ` (${activeConversation.intentConfidence}%)`
                                : ""}
                            </span>
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {activeConversation.contactPhone}
                        </span>
                        {/* Multi-Number Phone Line Badge & Role Indicator in Active Chat Header */}
                        {activeConversation.account?.platformType ===
                        "LINKED_DEVICE" ? (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1 border-status-success-border bg-status-success-bg text-[11px] font-bold text-status-success"
                          >
                            <Smartphone
                              className="size-3 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              Line:{" "}
                              <span className="font-mono tabular-nums">
                                {activeConversation.account
                                  .displayPhoneNumber || "Linked"}
                              </span>{" "}
                              (Linked Device SIM)
                            </span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1 border-status-info-border bg-status-info-bg text-[11px] font-medium text-status-info"
                          >
                            <Cloud
                              className="size-3 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              Line:{" "}
                              <span className="font-mono tabular-nums">
                                {activeConversation.account
                                  ?.displayPhoneNumber || "Official WABA"}
                              </span>{" "}
                              (Meta Cloud API)
                            </span>
                          </Badge>
                        )}
                        {/* 1-Click Intent Override Toggle */}
                        <button
                          type="button"
                          disabled={isUpdatingIntent}
                          onClick={() =>
                            handleUpdateConversationIntent(
                              activeConversation.intentCategory ===
                                "PERSONAL_OR_OTHER"
                                ? "TRAVEL_LEAD"
                                : "PERSONAL_OR_OTHER"
                            )
                          }
                          className="rounded text-[11px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Override AI Intent Gatekeeper classification for this contact"
                        >
                          {activeConversation.intentCategory ===
                          "PERSONAL_OR_OTHER"
                            ? "Mark as Travel Lead"
                            : "Mark as Personal (Mute Bot)"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Header Actions: Hand Off to AI Agent + Blue-Tick Mark Read + AI Copilot Draft + Pin/Archive + Agent Assignment + 24-Hour Pill */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Spec 0019 (Slice 38): Staff Agent Assignment Dropdown */}
                    <div className="flex items-center gap-1 rounded-lg border border-input bg-background px-2 py-0.5 text-xs">
                      <UserCheck
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <select
                        aria-label="Assign consultant to conversation"
                        value={activeConversation.assignedUserId || ""}
                        disabled={isAssigningAgent}
                        onChange={(e) =>
                          handleAssignAgent(e.target.value || null)
                        }
                        className="cursor-pointer bg-transparent text-[11px] font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        title="Assign active consultant to this pilgrim conversation"
                      >
                        <option value="">Unassigned</option>
                        {currentUserId &&
                          !staffMembers.some((m) => m.id === currentUserId) && (
                            <option value={currentUserId}>Assign to Me</option>
                          )}
                        {staffMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.id === currentUserId
                              ? `Assign to Me (${member.name})`
                              : `${member.name} (${member.role === "super_admin" ? "Super Admin" : "Consultant"})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Spec 0019: Pin Toggle Button */}
                    <Button
                      variant={
                        activeConversation.isPinned ? "secondary" : "ghost"
                      }
                      size="xs"
                      type="button"
                      disabled={isTogglingPin}
                      onClick={handleTogglePin}
                      className={cn(
                        "cursor-pointer gap-1 px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                        activeConversation.isPinned
                          ? "border-gold-border bg-accent text-gold-text hover:bg-accent/80"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={
                        activeConversation.isPinned
                          ? "Unpin conversation"
                          : "Pin conversation to top of inbox"
                      }
                    >
                      {isTogglingPin ? (
                        <Loader2
                          className="size-3 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <Pin
                          className={cn(
                            "size-3.5",
                            activeConversation.isPinned
                              ? "fill-gold-text text-gold-text"
                              : ""
                          )}
                          aria-hidden="true"
                        />
                      )}
                      <span>
                        {activeConversation.isPinned ? "Pinned" : "Pin"}
                      </span>
                    </Button>

                    {/* Spec 0019: Archive Toggle Button */}
                    <Button
                      variant={
                        activeConversation.isArchived ? "secondary" : "ghost"
                      }
                      size="xs"
                      type="button"
                      disabled={isTogglingArchive}
                      onClick={handleToggleArchive}
                      className={cn(
                        "cursor-pointer gap-1 px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                        activeConversation.isArchived
                          ? "border-border bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={
                        activeConversation.isArchived
                          ? "Unarchive conversation"
                          : "Archive conversation"
                      }
                    >
                      {isTogglingArchive ? (
                        <Loader2
                          className="size-3 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : activeConversation.isArchived ? (
                        <ArchiveRestore
                          className="size-3.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <Archive className="size-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {activeConversation.isArchived
                          ? "Unarchive"
                          : "Archive"}
                      </span>
                    </Button>

                    {/* 1-Click Hand Off to Dedicated AI Agent */}
                    <Button
                      variant="outline"
                      size="xs"
                      type="button"
                      disabled={isHandingOffToAgent}
                      onClick={handleHandoffToAgent}
                      className="gap-1 border-gold-border bg-accent px-2 text-[11px] font-semibold text-primary hover:bg-accent/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                      title="Transfer this contact from Founder Coexistence Line (+92 319 0462638) to Dedicated AI Agent Line"
                    >
                      {isHandingOffToAgent ? (
                        <Loader2
                          className="size-3 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <Bot
                          className="size-3.5 text-gold-text"
                          aria-hidden="true"
                        />
                      )}
                      <span>Hand Off to AI Agent</span>
                    </Button>

                    {/* 1-Click Blue-Tick Read Receipt Button (Spec 0013 AC-3) */}
                    <Button
                      variant="ghost"
                      size="xs"
                      type="button"
                      disabled={isMarkingRead}
                      onClick={handleMarkConversationRead}
                      className="gap-1 px-2 text-[11px] font-medium text-status-info hover:bg-status-info-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                      title="Dispatch official Meta Blue-Tick Read Receipt to pilgrim's phone"
                    >
                      {isMarkingRead ? (
                        <Loader2
                          className="size-3 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <CheckCheck
                          className="size-3.5 text-status-info"
                          aria-hidden="true"
                        />
                      )}
                      <span>Mark Read</span>
                    </Button>

                    {/* AI Copilot Draft Button (Spec 0015 AC-4) */}
                    <Button
                      size="xs"
                      type="button"
                      disabled={isGeneratingWaCopilot}
                      onClick={handleGenerateWaCopilotDraft}
                      className="gap-1 border border-gold-border bg-primary text-[11px] font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
                    >
                      {isGeneratingWaCopilot ? (
                        <Loader2
                          className="size-3 animate-spin text-gold motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <Sparkles
                          className="size-3 text-gold"
                          aria-hidden="true"
                        />
                      )}
                      <span>AI Copilot Draft</span>
                    </Button>

                    {active24hState.isInside ? (
                      <span className="flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[11px] font-semibold tabular-nums text-status-success">
                        <span className="size-1.5 rounded-full bg-status-success" />
                        <span>
                          {active24hState.remainingHours}h{" "}
                          {active24hState.remainingMinutes}m
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full border border-status-warning-border bg-status-warning-bg px-2 py-0.5 text-[11px] font-semibold text-status-warning">
                        <AlertCircle
                          className="size-3 text-status-warning"
                          aria-hidden="true"
                        />
                        <span>Template Required</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Banner Notifications */}
                {pdfSuccessBanner && (
                  <div className="flex items-center justify-between border-b border-status-success-border bg-status-success-bg p-2.5 text-xs text-status-success">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Check
                        className="size-4 text-status-success"
                        aria-hidden="true"
                      />
                      <span>{pdfSuccessBanner}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss PDF status notice"
                      onClick={() => setPdfSuccessBanner(null)}
                      className="rounded text-status-success hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {composerError && (
                  <div className="flex items-center justify-between border-b border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertCircle
                        className="size-4 text-status-danger"
                        aria-hidden="true"
                      />
                      <span>{composerError}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss composer error"
                      onClick={() => setComposerError(null)}
                      className="rounded text-status-danger hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {waCopilotRun && (
                  <div className="border-b border-gold-border/50 bg-secondary/40 p-3">
                    <CopilotRealtimeRunBanner
                      runId={waCopilotRun.runId}
                      publicAccessToken={waCopilotRun.publicAccessToken}
                      mode={waCopilotRun.mode}
                      title="AI Quoting Concierge Telemetry"
                      onComplete={async (output) => {
                        setGeneratingWaCopilotConvId(null)
                        if (output?.draft && activeConversation?.id) {
                          setWaCopilotDraftState({
                            conversationId: activeConversation.id,
                            draft: output.draft,
                            editableText:
                              output.draft.bilingualReplyDraft || "",
                            meta: {
                              modelUsed:
                                output.modelUsed || "Trigger.dev Worker",
                              executionMode:
                                output.executionMode || "ai_provider",
                            },
                          })
                        } else if (activeConversation?.id) {
                          const targetId = activeConversation.id
                          const res =
                            await generateWaConversationCopilotDraftAction({
                              conversationId: targetId,
                            })
                          if (res.success) {
                            setWaCopilotDraftState({
                              conversationId: targetId,
                              draft: res.draft,
                              editableText: res.draft.bilingualReplyDraft,
                              meta: {
                                modelUsed: res.modelUsed,
                                executionMode: res.executionMode,
                              },
                            })
                          }
                        }
                      }}
                      onDismiss={() => {
                        setWaCopilotRunState(null)
                        setGeneratingWaCopilotConvId(null)
                      }}
                    />
                  </div>
                )}

                {/* AI Concierge Draft Review Card (Spec 0015 AC-4, requiresHumanApproval: true) */}
                {waCopilotDraft && (
                  <div className="space-y-2.5 border-b border-gold-border/50 bg-secondary/50 p-3.5 text-xs animate-in fade-in-50 duration-150 motion-reduce:animate-none">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Bot
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                        <span className="font-display font-bold text-foreground">
                          AI Quoting Concierge Draft (Bilingual EN + Roman Urdu)
                        </span>
                        <Badge
                          variant="outline"
                          className="border-status-warning-border bg-status-warning-bg text-[11px] text-status-warning"
                        >
                          Human Review Required
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {waCopilotMeta && (
                          <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {waCopilotMeta.modelUsed}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label="Dismiss AI draft"
                          onClick={() => setWaCopilotDraft(null)}
                          className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="font-medium text-muted-foreground">
                        Intent: {waCopilotDraft.detectedIntentSummary}
                      </span>
                      {waCopilotDraft.matchedPackageCode && (
                        <Badge
                          variant="outline"
                          className="border-gold-border bg-accent text-[11px] text-primary"
                        >
                          Package:{" "}
                          <span className="font-mono">
                            {waCopilotDraft.matchedPackageCode}
                          </span>
                        </Badge>
                      )}
                      {waCopilotDraft.matchedBatchCode && (
                        <Badge
                          variant="outline"
                          className="border-status-success-border bg-status-success-bg text-[11px] text-status-success"
                        >
                          Batch:{" "}
                          <span className="font-mono">
                            {waCopilotDraft.matchedBatchCode}
                          </span>
                        </Badge>
                      )}
                    </div>

                    {/* Recommended Pricing Bullets */}
                    {waCopilotDraft.recommendedPricingBullets.length > 0 && (
                      <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                        {waCopilotDraft.recommendedPricingBullets.map(
                          (b, idx) => (
                            <li key={idx}>{b}</li>
                          )
                        )}
                      </ul>
                    )}

                    {/* Editable Bilingual Reply Draft */}
                    <Textarea
                      value={waCopilotEditableText}
                      onChange={(e) => setWaCopilotEditableText(e.target.value)}
                      rows={4}
                      className="bg-background text-xs"
                    />

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setWaCopilotDraft(null)}
                      >
                        Dismiss
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        onClick={handleUseCopilotDraftInComposer}
                        className="gap-1 bg-primary font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
                      >
                        <ArrowDownToLine
                          className="size-3 text-gold"
                          aria-hidden="true"
                        />
                        <span>Use Draft in Composer</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Messages Stream */}
                <div
                  ref={messagesScrollContainerRef}
                  className="flex max-h-[500px] flex-1 flex-col gap-3 overflow-y-auto bg-secondary/20 p-4"
                >
                  {isLoadingMessages ? (
                    <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
                      <Loader2
                        className="size-6 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    </div>
                  ) : activeMessages.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
                      <Clock
                        className="mb-1 size-6 text-muted-foreground/40"
                        aria-hidden="true"
                      />
                      <p>No messages yet in this conversation.</p>
                    </div>
                  ) : (
                    activeMessages.map((msg) => {
                      const isOutbound = msg.direction === "outbound"
                      const normalizedType = (
                        msg.messageType || "text"
                      ).toLowerCase()
                      const isImageOrSticker =
                        normalizedType === "image" ||
                        normalizedType === "sticker" ||
                        (msg.mediaMimeType &&
                          msg.mediaMimeType.startsWith("image/"))
                      const isAudio =
                        normalizedType === "audio" ||
                        (msg.mediaMimeType &&
                          msg.mediaMimeType.startsWith("audio/"))
                      const isVideo =
                        normalizedType === "video" ||
                        (msg.mediaMimeType &&
                          msg.mediaMimeType.startsWith("video/"))
                      const isDocument =
                        normalizedType === "document" ||
                        (msg.mediaUrl && msg.mediaUrl.endsWith(".pdf")) ||
                        (msg.mediaMimeType &&
                          msg.mediaMimeType.includes("pdf"))

                      // Extract interactive buttons or list rows if present
                      const payload = msg.interactivePayload as
                        | {
                            type?: string
                            headerText?: string
                            footerText?: string
                            buttonText?: string
                            buttons?: Array<{ id: string; title: string }>
                            sections?: Array<{
                              title: string
                              rows: Array<{
                                id: string
                                title: string
                                description?: string
                              }>
                            }>
                          }
                        | undefined

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "group relative flex max-w-[85%] flex-col rounded-2xl p-3 text-xs shadow-2xs",
                            isOutbound
                              ? "self-end rounded-tr-xs border border-primary/80 bg-primary text-primary-foreground"
                              : "self-start rounded-tl-xs border border-border bg-background text-foreground"
                          )}
                        >
                          {/* Auto-Bot Badge (Spec 0013 AC-2, AC-6) */}
                          {msg.isAutoReply && (
                            <div className="mb-1.5 flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 rounded-full border border-gold-border/60 bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-gold">
                                <Bot className="size-3" aria-hidden="true" />
                                <span>ART-… Auto-Bot Reply</span>
                              </span>
                            </div>
                          )}

                          {/* 1. R2 Inbound/Outbound Image or Sticker Preview (Spec 0013 AC-1, AC-6) */}
                          {isImageOrSticker && msg.mediaUrl && (
                            <div className="mb-2 overflow-hidden rounded-xl border border-border/40 bg-foreground/5 transition-colors hover:border-gold-border motion-reduce:transition-none">
                              <a
                                href={msg.mediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                <Image
                                  src={msg.mediaUrl}
                                  alt={msg.mediaFilename || "WhatsApp image"}
                                  width={480}
                                  height={320}
                                  unoptimized
                                  className="max-h-56 w-full object-cover"
                                />
                              </a>
                            </div>
                          )}

                          {/* 2. R2 Audio / Urdu Voice Note Player (Spec 0013 AC-1, AC-6) */}
                          {isAudio && msg.mediaUrl && (
                            <div className="mb-2 flex flex-col gap-1 rounded-xl bg-foreground/10 p-2">
                              <div className="flex items-center gap-1.5 text-[11px] opacity-90">
                                <Music className="size-3.5" aria-hidden="true" />
                                <span>Voice Note / Audio Attachment</span>
                              </div>
                              <audio
                                controls
                                src={msg.mediaUrl}
                                className="h-8 w-full max-w-[260px]"
                              />
                            </div>
                          )}

                          {/* 3. R2 Video Player (Spec 0013 AC-1, AC-6) */}
                          {isVideo && msg.mediaUrl && (
                            <div className="mb-2 overflow-hidden rounded-xl bg-foreground/10">
                              <video
                                controls
                                preload="metadata"
                                poster="/logo.jpg"
                                src={msg.mediaUrl}
                                className="max-h-56 w-full rounded-xl"
                              />
                            </div>
                          )}

                          {/* 4. Document / PDF Card */}
                          {isDocument && (
                            <div
                              className={cn(
                                "mb-1.5 flex items-center gap-3 rounded-xl border p-2.5",
                                isOutbound
                                  ? "border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground"
                                  : "border-border bg-secondary text-foreground"
                              )}
                            >
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-status-danger-bg text-status-danger">
                                <FileText className="size-5" aria-hidden="true" />
                              </div>
                              <div className="flex flex-col truncate">
                                <span className="truncate text-xs font-bold">
                                  {msg.mediaFilename ||
                                    "Al_Ramlah_Document.pdf"}
                                </span>
                                <span className="text-[11px] opacity-85">
                                  {msg.mediaMimeType || "PDF Document"}
                                  {msg.mediaFileSize
                                    ? ` (${Math.round(msg.mediaFileSize / 1024)} KB)`
                                    : ""}
                                </span>
                              </div>
                              {msg.mediaUrl && (
                                <a
                                  href={msg.mediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-auto rounded-lg p-1.5 transition-colors hover:bg-primary-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                                  title="Download / Preview Document"
                                >
                                  <Download
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                </a>
                              )}
                            </div>
                          )}

                          {/* Manual "Mirror to R2" Retry Button when rawMediaId is present without mediaUrl (Spec 0013 AC-1, AC-6) */}
                          {msg.rawMediaId && !msg.mediaUrl && (
                            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-status-warning-border bg-status-warning-bg p-2 text-status-warning">
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <ImageIcon
                                  className="size-3.5 text-status-warning"
                                  aria-hidden="true"
                                />
                                <span>Media pending R2 archival</span>
                              </div>
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={mirroringMessageId === msg.id}
                                onClick={() => handleManualMediaMirror(msg.id)}
                                className="h-6 gap-1 border-status-warning-border bg-background text-[11px] font-bold text-status-warning hover:bg-status-warning-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                {mirroringMessageId === msg.id ? (
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
                                <span>Mirror to R2</span>
                              </Button>
                            </div>
                          )}

                          {/* Interactive Header */}
                          {payload?.headerText && (
                            <div className="mb-1 text-xs font-bold opacity-95">
                              {payload.headerText}
                            </div>
                          )}

                          {/* Message Body */}
                          {msg.body && (
                            <p className="whitespace-pre-wrap leading-relaxed">
                              {msg.body}
                            </p>
                          )}

                          {/* Interactive Footer */}
                          {payload?.footerText && (
                            <div className="mt-1 text-[11px] opacity-80">
                              {payload.footerText}
                            </div>
                          )}

                          {/* Interactive Reply Buttons Display */}
                          {payload?.buttons &&
                            Array.isArray(payload.buttons) &&
                            payload.buttons.length > 0 && (
                              <div className="mt-2 flex flex-col gap-1 border-t border-primary-foreground/20 pt-2">
                                {payload.buttons.map((b) => (
                                  <div
                                    key={b.id}
                                    className={cn(
                                      "flex items-center justify-center rounded-lg border px-2 py-1.5 text-center text-[11px] font-bold",
                                      isOutbound
                                        ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
                                        : "border-primary/30 bg-primary/5 text-primary"
                                    )}
                                  >
                                    {b.title}
                                  </div>
                                ))}
                              </div>
                            )}

                          {/* Interactive List Sections Display */}
                          {payload?.sections &&
                            Array.isArray(payload.sections) &&
                            payload.sections.length > 0 && (
                              <div className="mt-2 flex flex-col gap-1.5 border-t border-primary-foreground/20 pt-2">
                                <div className="flex items-center gap-1 text-[11px] font-bold opacity-90">
                                  <ListIcon
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {payload.buttonText || "Menu Options"}
                                  </span>
                                </div>
                                {payload.sections.map((sec, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="flex flex-col gap-1 rounded-lg bg-foreground/10 p-1.5"
                                  >
                                    <span className="text-[11px] font-bold opacity-90">
                                      {sec.title}
                                    </span>
                                    {sec.rows.map((r) => (
                                      <div
                                        key={r.id}
                                        className="rounded bg-primary-foreground/10 px-2 py-1 text-[11px]"
                                      >
                                        <div className="font-semibold">
                                          {r.title}
                                        </div>
                                        {r.description && (
                                          <div className="text-[10px] opacity-80">
                                            {r.description}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}

                          {/* Time, Reaction Badge & Delivery Status Ticks */}
                          <div
                            className={cn(
                              "mt-1.5 flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums opacity-85",
                              isOutbound
                                ? "text-primary-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-1">
                              {msg.reactionEmoji && (
                                <span className="rounded-full bg-foreground/15 px-1.5 py-0.2 text-xs">
                                  {msg.reactionEmoji}
                                </span>
                              )}

                              {/* Quick Emoji Reaction Picker Trigger */}
                              <div className="relative">
                                <button
                                  type="button"
                                  aria-label="React to message"
                                  onClick={() =>
                                    setReactionTargetWamid(
                                      reactionTargetWamid === msg.wamid
                                        ? null
                                        : msg.wamid
                                    )
                                  }
                                  className="rounded p-0.5 opacity-75 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                                  title="React with emoji"
                                >
                                  <Smile
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                </button>
                                {reactionTargetWamid === msg.wamid && (
                                  <div className="absolute bottom-5 left-0 z-20 flex items-center gap-1 rounded-full border border-border bg-popover px-2 py-1 shadow-md">
                                    {QUICK_REACTION_EMOJIS.map((item) => (
                                      <button
                                        key={item.label}
                                        type="button"
                                        aria-label={`React with ${item.label}`}
                                        onClick={() =>
                                          handleSendReaction(
                                            msg.wamid,
                                            item.emoji
                                          )
                                        }
                                        className="rounded text-sm transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transform-none motion-reduce:transition-none"
                                      >
                                        {item.emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <span>
                                {new Date(msg.createdAt).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                              {isOutbound && (
                                <span>
                                  {msg.status === "read" ? (
                                    <CheckCheck
                                      className="size-3 text-gold"
                                      aria-hidden="true"
                                    />
                                  ) : msg.status === "delivered" ? (
                                    <CheckCheck
                                      className="size-3"
                                      aria-hidden="true"
                                    />
                                  ) : msg.status === "sent" ? (
                                    <Check
                                      className="size-3"
                                      aria-hidden="true"
                                    />
                                  ) : msg.status === "failed" ? (
                                    <AlertCircle
                                      className="size-3 text-status-danger-bg"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Clock
                                      className="size-3"
                                      aria-hidden="true"
                                    />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick-Reply Macros Drawer */}
                {showQuickReplyPicker && (
                  <div className="border-t border-border bg-secondary/50 p-3 shadow-sm animate-in slide-in-from-bottom-2 duration-150 motion-reduce:animate-none">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Zap
                          className="size-3.5 text-primary"
                          aria-hidden="true"
                        />
                        <span>
                          Quick Replies (Type &apos;/&apos; or pick below)
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickReplyPicker(false)
                            setAutoReplyStudioOpen(true)
                          }}
                          className="whitespace-nowrap rounded text-[11px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          Manage /shortcuts &amp; Auto-Replies
                        </button>
                        <button
                          type="button"
                          aria-label="Close quick reply picker"
                          onClick={() => setShowQuickReplyPicker(false)}
                          className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="grid max-h-36 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                      {quickRepliesList.map((qr) => (
                        <button
                          key={qr.id}
                          type="button"
                          onClick={() => {
                            setComposerText(qr.bodyText)
                            setShowQuickReplyPicker(false)
                          }}
                          className="flex flex-col rounded-lg border border-border bg-background p-2 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-bold text-primary">
                              /{qr.shortcut.replace(/^\/+/, "")}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {qr.category}
                            </span>
                          </div>
                          <span className="truncate text-xs font-medium text-foreground">
                            {qr.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message Composer Area (Text, Interactive Reply Buttons, Interactive List Menus, or Template) */}
                <div className="border-t border-border bg-secondary/30 p-3.5">
                  {active24hState.isInside ? (
                    <div className="flex flex-col gap-2.5">
                      {/* Composer Mode Switcher (Spec 0013 AC-4, AC-6) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-lg bg-secondary p-0.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setComposerMode("text")}
                            className={cn(
                              "rounded-md px-2.5 py-1 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                              composerMode === "text"
                                ? "bg-background text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Text Reply
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposerMode("buttons")}
                            className={cn(
                              "flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                              composerMode === "buttons"
                                ? "bg-background text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <MousePointerClick
                              className="size-3"
                              aria-hidden="true"
                            />
                            <span>Reply Buttons (1 to 3)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposerMode("list")}
                            className={cn(
                              "flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                              composerMode === "list"
                                ? "bg-background text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <ListIcon className="size-3" aria-hidden="true" />
                            <span>List Menu</span>
                          </button>
                        </div>

                        <Button
                          variant="ghost"
                          size="xs"
                          type="button"
                          onClick={handleGenerateWaCopilotDraft}
                          disabled={isGeneratingWaCopilot}
                          className="gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <Sparkles
                            className="size-3 text-gold-text"
                            aria-hidden="true"
                          />
                          <span>AI Draft</span>
                        </Button>
                      </div>

                      {/* Optional Header / Footer for Interactive Modes */}
                      {(composerMode === "buttons" ||
                        composerMode === "list") && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Input
                            value={interactiveHeader}
                            onChange={(e) =>
                              setInteractiveHeader(e.target.value)
                            }
                            placeholder="Optional Header (max 60 chars)"
                            maxLength={60}
                            className="h-7 bg-background text-xs"
                          />
                          <Input
                            value={interactiveFooter}
                            onChange={(e) =>
                              setInteractiveFooter(e.target.value)
                            }
                            placeholder="Optional Footer (max 60 chars)"
                            maxLength={60}
                            className="h-7 bg-background text-xs"
                          />
                        </div>
                      )}

                      <div className="relative">
                        <Textarea
                          value={composerText}
                          onChange={(e) => {
                            setComposerText(e.target.value)
                            if (e.target.value.startsWith("/")) {
                              setShowQuickReplyPicker(true)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              !e.shiftKey &&
                              composerMode === "text"
                            ) {
                              e.preventDefault()
                              handleSendReply()
                            }
                          }}
                          placeholder={
                            composerMode === "text"
                              ? "Type response to pilgrim... (Press Enter to send, type '/' for quick replies)"
                              : "Enter message body for interactive menu..."
                          }
                          className="min-h-[68px] resize-none bg-background pr-10 text-xs"
                        />
                      </div>

                      {/* Interactive Reply Buttons Builder (1..3 buttons) */}
                      {composerMode === "buttons" && (
                        <div className="space-y-2 rounded-xl bg-secondary/60 p-2.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-foreground">
                              Quick-Reply Buttons (Max 3, 20 chars each)
                            </span>
                            {replyButtons.length < 3 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReplyButtons((prev) => [
                                    ...prev,
                                    {
                                      id: `btn_${prev.length + 1}`,
                                      title: "",
                                    },
                                  ])
                                }
                                className="rounded font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                              >
                                + Add Button
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                            {replyButtons.map((btn, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1"
                              >
                                <Input
                                  value={btn.title}
                                  maxLength={20}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setReplyButtons((prev) =>
                                      prev.map((item, i) =>
                                        i === idx
                                          ? { ...item, title: val }
                                          : item
                                      )
                                    )
                                  }}
                                  placeholder={`Button ${idx + 1}`}
                                  className="h-7 bg-background text-xs"
                                />
                                {replyButtons.length > 1 && (
                                  <button
                                    type="button"
                                    aria-label={`Remove button ${idx + 1}`}
                                    onClick={() =>
                                      setReplyButtons((prev) =>
                                        prev.filter((_, i) => i !== idx)
                                      )
                                    }
                                    className="rounded text-muted-foreground hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                                  >
                                    <X className="size-3.5" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Interactive List Menu Builder */}
                      {composerMode === "list" && (
                        <div className="space-y-2 rounded-xl bg-secondary/60 p-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[11px] font-semibold text-muted-foreground">
                                Menu Button Text (max 20 chars)
                              </label>
                              <Input
                                value={listButtonText}
                                maxLength={20}
                                onChange={(e) =>
                                  setListButtonText(e.target.value)
                                }
                                className="mt-0.5 h-7 bg-background text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-muted-foreground">
                                Section Title (max 24 chars)
                              </label>
                              <Input
                                value={listSectionTitle}
                                maxLength={24}
                                onChange={(e) =>
                                  setListSectionTitle(e.target.value)
                                }
                                className="mt-0.5 h-7 bg-background text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-foreground">
                              List Rows ({listRows.length}/10)
                            </span>
                            {listRows.length < 10 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setListRows((prev) => [
                                    ...prev,
                                    {
                                      id: `opt_${prev.length + 1}`,
                                      title: "",
                                      description: "",
                                    },
                                  ])
                                }
                                className="rounded font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                              >
                                + Add Row
                              </button>
                            )}
                          </div>

                          <div className="max-h-32 space-y-1.5 overflow-y-auto">
                            {listRows.map((row, idx) => (
                              <div
                                key={idx}
                                className="grid grid-cols-12 items-center gap-1.5"
                              >
                                <Input
                                  value={row.title}
                                  maxLength={24}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setListRows((prev) =>
                                      prev.map((item, i) =>
                                        i === idx
                                          ? { ...item, title: val }
                                          : item
                                      )
                                    )
                                  }}
                                  placeholder="Row title (max 24)"
                                  className="col-span-5 h-7 bg-background text-xs"
                                />
                                <Input
                                  value={row.description}
                                  maxLength={72}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setListRows((prev) =>
                                      prev.map((item, i) =>
                                        i === idx
                                          ? { ...item, description: val }
                                          : item
                                      )
                                    )
                                  }}
                                  placeholder="Description (max 72)"
                                  className="col-span-6 h-7 bg-background text-xs"
                                />
                                {listRows.length > 1 && (
                                  <button
                                    type="button"
                                    aria-label={`Remove row ${idx + 1}`}
                                    onClick={() =>
                                      setListRows((prev) =>
                                        prev.filter((_, i) => i !== idx)
                                      )
                                    }
                                    className="col-span-1 flex justify-center rounded text-muted-foreground hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                                  >
                                    <X className="size-3.5" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <Button
                          variant="ghost"
                          size="xs"
                          type="button"
                          onClick={() =>
                            setShowQuickReplyPicker(!showQuickReplyPicker)
                          }
                          className="gap-1 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <Zap className="size-3.5" aria-hidden="true" />
                          <span>Macros (/)</span>
                        </Button>

                        <Button
                          size="sm"
                          disabled={isSendingMessage || !composerText.trim()}
                          onClick={handleSendReply}
                          className="gap-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        >
                          {isSendingMessage ? (
                            <Loader2
                              className="size-3.5 animate-spin motion-reduce:animate-none"
                              aria-hidden="true"
                            />
                          ) : (
                            <Send className="size-3.5" aria-hidden="true" />
                          )}
                          <span>
                            {composerMode === "buttons"
                              ? "Send Interactive Buttons"
                              : composerMode === "list"
                                ? "Send Interactive List"
                                : "Send Reply"}
                          </span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Template Selector outside 24h */
                    <div className="flex flex-col gap-2.5 rounded-xl bg-status-warning-bg/80 p-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <AlertCircle
                          className="size-4 shrink-0 text-status-warning"
                          aria-hidden="true"
                        />
                        <span>
                          Outside 24h Window: Meta requires an approved template to contact pilgrim
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="wa-template-select"
                            className="text-[11px] font-medium text-muted-foreground"
                          >
                            Select Approved Message Template:
                          </label>
                          <button
                            type="button"
                            onClick={() => setTemplateStudioOpen(true)}
                            className="rounded text-[11px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                          >
                            + Create / Sync Meta Template
                          </button>
                        </div>
                        <select
                          id="wa-template-select"
                          value={selectedTemplate?.name || selectedTemplateName}
                          onChange={(e) =>
                            setSelectedTemplateName(e.target.value)
                          }
                          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {approvedTemplatesList.length === 0 ? (
                            <option value="">
                              No approved Meta templates; click Create or Sync
                            </option>
                          ) : (
                            approvedTemplatesList.map((t) => (
                              <option key={t.id} value={t.name}>
                                {t.name} ({t.language}) - {t.category}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      {/* Optional Header Media URL (if template supports IMAGE / DOCUMENT / VIDEO header) */}
                      {["IMAGE", "DOCUMENT", "VIDEO"].includes(
                        (selectedTemplate?.headerType || "").toUpperCase()
                      ) && (
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor="wa-template-header-url"
                            className="text-[11px] font-medium text-muted-foreground"
                          >
                            Header Media URL (
                            {(selectedTemplate?.headerType || "").toUpperCase()}
                            ):
                          </label>
                          <Input
                            id="wa-template-header-url"
                            placeholder="https://..."
                            value={templateHeaderMediaUrl}
                            onChange={(e) =>
                              setTemplateHeaderMediaUrl(e.target.value)
                            }
                            className="h-8 bg-background text-xs"
                          />
                        </div>
                      )}

                      {/* Dynamic Template Variable Inputs (Spec 0019 AC-2) */}
                      {templatePlaceholders.length > 0 && (
                        <div className="flex flex-col gap-2 rounded-lg bg-background/85 p-2.5">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-foreground">
                            <Sparkles
                              className="size-3 text-gold-text"
                              aria-hidden="true"
                            />
                            <span>
                              Template Parameters ({templatePlaceholders.length}{" "}
                              Variables)
                            </span>
                          </span>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {templatePlaceholders.map((ph) => {
                              const currentValue =
                                templateVariableValues[ph] ??
                                (ph === 1
                                  ? activeConversation.contactName || ""
                                  : "")
                              return (
                                <div key={ph} className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <code className="font-mono font-bold text-gold-text">{`{{${ph}}}`}</code>
                                    {ph === 1 &&
                                      activeConversation.contactName && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setTemplateVariableValues(
                                              (prev) => ({
                                                ...prev,
                                                [ph]:
                                                  activeConversation.contactName ||
                                                  "",
                                              })
                                            )
                                          }
                                          className="rounded font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                                        >
                                          Use Pilgrim Name
                                        </button>
                                      )}
                                  </div>
                                  <Input
                                    value={currentValue}
                                    onChange={(e) =>
                                      setTemplateVariableValues((prev) => ({
                                        ...prev,
                                        [ph]: e.target.value,
                                      }))
                                    }
                                    placeholder={`Value for {{${ph}}}`}
                                    className="h-7 bg-background text-xs"
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {selectedTemplate && (
                        <div className="rounded-lg bg-background/90 p-2 text-xs text-muted-foreground">
                          <span className="mb-0.5 block font-semibold text-foreground">
                            Template Preview (Live Interpolation):
                          </span>
                          <p className="whitespace-pre-wrap font-sans text-foreground">
                            {interpolateTemplateVariables(
                              selectedTemplate.bodyText,
                              templatePlaceholders.map(
                                (ph) =>
                                  templateVariableValues[ph] ??
                                  (ph === 1
                                    ? activeConversation.contactName ||
                                      "Pilgrim"
                                    : `{{${ph}}}`)
                              ),
                              {
                                name: activeConversation.contactName,
                                phone: activeConversation.contactPhone,
                              }
                            )}
                          </p>
                        </div>
                      )}

                      <Button
                        size="sm"
                        disabled={isSendingMessage || !selectedTemplate}
                        onClick={handleSendReply}
                        className="w-full self-end gap-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:w-auto"
                      >
                        {isSendingMessage ? (
                          <Loader2
                            className="size-3.5 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : (
                          <Send className="size-3.5" aria-hidden="true" />
                        )}
                        <span>Dispatch Meta Template</span>
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
                <MessageCircle
                  className="mb-2 size-10 text-muted-foreground/30"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-foreground">
                  No Conversation Selected
                </p>
                <p className="mt-1">
                  Select a conversation from the left pane to begin chatting.
                </p>
              </div>
            )}
          </div>

          {/* PANE 3: Context Sidebar (Dossier + Detected Package Card) (3 Cols) */}
          <div className="flex flex-col gap-4 lg:col-span-3">
            {activeConversation ? (
              <>
                {/* 1. Pilgrim Dossier Card */}
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <h3 className="font-display text-xs font-bold text-foreground">
                      Pilgrim Dossier
                    </h3>
                    <a
                      href={`https://wa.me/${formatWhatsAppPhone(activeConversation.contactPhone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded text-xs font-medium text-status-success hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Phone className="size-3" aria-hidden="true" />
                      <span>Direct WA</span>
                    </a>
                  </div>

                  <div className="flex flex-col gap-1 text-xs">
                    <span className="text-sm font-bold text-foreground">
                      {activeConversation.contactName ||
                        "Direct WhatsApp Contact"}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {activeConversation.contactPhone}
                    </span>
                  </div>

                  {/* Linked Application & 1-Click Send Luxury PDF Action */}
                  {activeConversation.application ? (
                    <div className="flex flex-col gap-2 rounded-xl bg-secondary/60 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">
                          Ref: {activeConversation.application.referenceNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[11px] capitalize"
                        >
                          {activeConversation.application.status.replace(
                            "_",
                            " "
                          )}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3" aria-hidden="true" />
                        <span>
                          Party:{" "}
                          {activeConversation.application.totalPassportCount ||
                            2}{" "}
                          Pax (
                          {activeConversation.application.bedAndSeatCount || 2}{" "}
                          Beds)
                        </span>
                      </div>

                      <div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-2">
                        <Button
                          size="xs"
                          disabled={isSendingPdf}
                          onClick={handleSendLuxuryPdf}
                          className="w-full gap-1.5 bg-primary font-bold text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        >
                          {isSendingPdf ? (
                            <Loader2
                              className="size-3 animate-spin motion-reduce:animate-none"
                              aria-hidden="true"
                            />
                          ) : (
                            <FileText className="size-3" aria-hidden="true" />
                          )}
                          <span>Send 3-Page Luxury PDF</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="xs"
                          render={
                            <Link
                              href={`/admin/applications/${activeConversation.application.id}`}
                              target="_blank"
                              title="Open quoting worksheet"
                            />
                          }
                          className="w-full gap-1 border-primary/30 text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <span>Open Quote Worksheet</span>
                          <ExternalLink
                            className="size-3"
                            aria-hidden="true"
                          />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-secondary/45 p-3 text-center text-xs text-muted-foreground">
                      No application linked yet.
                    </div>
                  )}
                </div>

                {/* 2. Detected Flyer Package Card (when customer messages code) */}
                {detectedPackage && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-gold-border bg-status-warning-bg/35 p-4 shadow-xs animate-in fade-in-50 duration-150 motion-reduce:animate-none">
                    <div className="flex items-center justify-between border-b border-gold-border/60 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles
                          className="size-3.5 text-gold-text"
                          aria-hidden="true"
                        />
                        <h3 className="font-display text-xs font-bold text-primary">
                          Detected Package Ref
                        </h3>
                      </div>
                      <code className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                        {detectedPackage.postCode}
                      </code>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Plane
                        className="size-3.5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <span className="font-bold text-foreground">
                        {detectedPackage.flyer?.airlineName ||
                          "Airline Flights"}
                      </span>
                      <span className="text-muted-foreground" aria-hidden="true">
                        /
                      </span>
                      <span className="text-muted-foreground">
                        {detectedPackage.outboundDateLabel}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 rounded-xl bg-background/90 p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-foreground">
                          {detectedPackage.makkahHotelName}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {detectedPackage.makkahNights}N,{" "}
                          {detectedPackage.makkahDistanceLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-foreground">
                          {detectedPackage.madinahHotelName}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {detectedPackage.madinahNights}N,{" "}
                          {detectedPackage.madinahDistanceLabel}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                      <div className="flex flex-col rounded-lg bg-background/90 p-2">
                        <span className="text-[11px]">Quad Retail</span>
                        <TabularPrice
                          amount={detectedPackage.retailQuadPkr}
                          className="font-bold text-foreground"
                        />
                      </div>
                      <div className="flex flex-col rounded-lg bg-background/90 p-2">
                        <span className="text-[11px]">Sharing Retail</span>
                        <TabularPrice
                          amount={detectedPackage.retailSharingPkr}
                          className="font-bold text-foreground"
                        />
                      </div>
                      <div className="flex flex-col rounded-lg bg-background/90 p-2">
                        <span className="text-[11px]">Triple Retail</span>
                        <TabularPrice
                          amount={detectedPackage.retailTriplePkr}
                          className="font-bold text-foreground"
                        />
                      </div>
                      <div className="flex flex-col rounded-lg bg-background/90 p-2">
                        <span className="text-[11px]">Double Retail</span>
                        <TabularPrice
                          amount={detectedPackage.retailDoublePkr}
                          className="font-bold text-foreground"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                      <span>
                        Net Wholesale:{" "}
                        <TabularPrice
                          amount={detectedPackage.netSharingPkr}
                          className="font-bold text-foreground"
                        />
                      </span>
                      <span>
                        Margin:{" "}
                        <span className="font-semibold text-status-success">
                          +
                          <TabularPrice
                            amount={detectedPackage.commissionPkr}
                            className="font-bold text-status-success"
                          />
                        </span>
                      </span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setConvertModalOpen(true)}
                      className="w-full cursor-pointer gap-1.5 bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    >
                      <Plus className="size-3.5 text-gold" aria-hidden="true" />
                      <span>Convert to Official Quote</span>
                    </Button>
                  </div>
                )}

                {/* 3. Internal Team Notes Card (Spec 0019 AC-3) */}
                <div className="flex flex-col gap-3 rounded-2xl border border-gold-border/70 bg-status-warning-bg/25 p-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-gold-border/50 pb-2">
                    <div className="flex items-center gap-1.5">
                      <StickyNote
                        className="size-3.5 text-gold-text"
                        aria-hidden="true"
                      />
                      <h3 className="font-display text-xs font-bold text-primary">
                        Internal Team Notes
                      </h3>
                    </div>
                    <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-status-warning">
                      {activeConversation.internalNotes?.length || 0} Notes
                    </span>
                  </div>

                  <p className="-mt-1 text-[11px] text-muted-foreground">
                    Private staff-only comments. Pilgrims never see these notes.
                  </p>

                  {/* Notes Feed */}
                  <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                    {!activeConversation.internalNotes ||
                    activeConversation.internalNotes.length === 0 ? (
                      <div className="rounded-xl bg-status-warning-bg/45 p-3 text-center text-xs text-muted-foreground">
                        No internal team notes recorded yet.
                      </div>
                    ) : (
                      activeConversation.internalNotes.map((n) => (
                        <div
                          key={n.id}
                          className="flex flex-col gap-1 rounded-xl bg-status-warning-bg/85 p-2.5 text-xs text-foreground shadow-2xs"
                        >
                          <div className="flex items-center justify-between border-b border-gold-border/40 pb-1 text-[11px] font-semibold text-gold-text">
                            <span>{n.userName}</span>
                            <span className="tabular-nums">
                              {new Date(n.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap pt-0.5 text-[11px] leading-relaxed">
                            {n.note}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Note Form */}
                  <div className="flex flex-col gap-2 border-t border-gold-border/50 pt-2">
                    <Textarea
                      rows={2}
                      placeholder="Add staff comment (e.g. Call back at 5pm; budget PKR 650k)..."
                      value={internalNoteInput}
                      onChange={(e) => setInternalNoteInput(e.target.value)}
                      className="border-input bg-background text-xs focus-visible:ring-primary"
                    />
                    <Button
                      size="xs"
                      type="button"
                      disabled={isAddingNote || !internalNoteInput.trim()}
                      onClick={handleAddInternalNote}
                      className="cursor-pointer self-end gap-1 bg-primary text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    >
                      {isAddingNote ? (
                        <Loader2
                          className="size-3 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <Plus className="size-3" aria-hidden="true" />
                      )}
                      <span>Add Team Note</span>
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: WEBSITE CONTACT MESSAGES & HAJJ 2027 INQUIRIES
          ========================================================================= */}
      {activeTab === "web_messages" && (
        <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200 motion-reduce:animate-none">
          <MessagesClient initialMessages={contactMessages} />
        </div>
      )}

      {/* ==========================================
          MODAL: Pipeline AI Quoting Copilot Preview (Spec 0015 AC-5)
          ========================================== */}
      <Dialog open={pipelineCopilotOpen} onOpenChange={setPipelineCopilotOpen}>
        <DialogContent className="shadow-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-gold-text" aria-hidden="true" />
              <span>AI Quoting Copilot: Pipeline Pre-Fill &amp; Summary</span>
            </DialogTitle>
            <DialogDescription>
              Select any active pilgrim inquiry to compute itemized SAR/PKR rate hints and executive notes (Human-in-the-Loop).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <select
                aria-label="Select application for AI quoting copilot"
                value={selectedPipelineAppId}
                onChange={(e) => {
                  setSelectedPipelineAppId(e.target.value)
                  setPipelineCopilotDraft(null)
                }}
                className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.referenceNumber}: {a.customerName} (
                    {a.totalPassportCount} Pax)
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                type="button"
                disabled={
                  isGeneratingPipelineCopilot || !selectedPipelineAppId
                }
                onClick={() => handleRunPipelineCopilot(selectedPipelineAppId)}
                className="gap-1.5 bg-primary font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {isGeneratingPipelineCopilot ? (
                  <Loader2
                    className="size-3.5 animate-spin text-gold motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Sparkles className="size-3.5 text-gold" aria-hidden="true" />
                )}
                <span>Generate Estimate</span>
              </Button>
            </div>

            {pipelineCopilotRun && (
              <CopilotRealtimeRunBanner
                runId={pipelineCopilotRun.runId}
                publicAccessToken={pipelineCopilotRun.publicAccessToken}
                mode={pipelineCopilotRun.mode}
                title="AI Quoting Copilot (Pipeline Pre-Fill)"
                onComplete={async (output) => {
                  setIsGeneratingPipelineCopilot(false)
                  if (output?.draft) {
                    setPipelineCopilotDraft(output.draft)
                    setPipelineCopilotMeta({
                      modelUsed: output.modelUsed || "Trigger.dev Worker",
                      executionMode: output.executionMode || "ai_provider",
                    })
                  } else if (selectedPipelineAppId) {
                    const res =
                      await generateApplicationQuoteCopilotDraftAction({
                        applicationId: selectedPipelineAppId,
                      })
                    if (res.success) {
                      setPipelineCopilotDraft(res.draft)
                      setPipelineCopilotMeta({
                        modelUsed: res.modelUsed,
                        executionMode: res.executionMode,
                      })
                    }
                  }
                }}
                onDismiss={() => {
                  setPipelineCopilotRun(null)
                  setIsGeneratingPipelineCopilot(false)
                }}
              />
            )}

            {pipelineCopilotError && (
              <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-status-danger">
                {pipelineCopilotError}
              </div>
            )}

            {pipelineCopilotDraft && (
              <div className="space-y-2.5 rounded-xl bg-secondary/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">
                    Executive Summary
                  </span>
                  {pipelineCopilotMeta && (
                    <Badge variant="outline" className="text-[11px]">
                      {pipelineCopilotMeta.modelUsed}
                    </Badge>
                  )}
                </div>
                <p className="leading-relaxed text-foreground/90">
                  {pipelineCopilotDraft.executiveSummary}
                </p>

                <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-background p-2.5 text-[11px]">
                  <div>
                    <span className="block text-[11px] text-muted-foreground">
                      Visa
                    </span>
                    <TabularPrice
                      amount={
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .visaTotalPkr
                      }
                      className="font-bold text-foreground"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">
                      Flights
                    </span>
                    <TabularPrice
                      amount={
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .flightsTotalPkr
                      }
                      className="font-bold text-foreground"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">
                      Makkah &amp; Madinah
                    </span>
                    <TabularPrice
                      amount={
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .makkahHotelTotalPkr +
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .madinahHotelTotalPkr
                      }
                      className="font-bold text-foreground"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">
                      Transport &amp; Ziyarat
                    </span>
                    <TabularPrice
                      amount={
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .transportTotalPkr +
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .ziyaratTotalPkr
                      }
                      className="font-bold text-foreground"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">
                      Agency Margin
                    </span>
                    <TabularPrice
                      amount={
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .commissionPkr
                      }
                      className="font-bold text-status-success"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">
                      Grand Total
                    </span>
                    <TabularPrice
                      amount={
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .grandTotalPkr
                      }
                      className="font-bold text-primary"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPipelineCopilotOpen(false)}
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Close
            </Button>
            {selectedPipelineAppId && (
              <Button
                size="sm"
                render={
                  <Link
                    href={`/admin/applications/${selectedPipelineAppId}`}
                  />
                }
                className="gap-1.5 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <span>Open Full Quote Worksheet</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          MODAL: 1-Click Convert Post Lookup to Quote
          ========================================== */}
      <Dialog open={convertModalOpen} onOpenChange={setConvertModalOpen}>
        <DialogContent className="shadow-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" aria-hidden="true" />
              <span>Convert Post Lookup to Official Quote</span>
            </DialogTitle>
            <DialogDescription>
              Create an official inquiry for{" "}
              {activeConversation?.contactName ||
                activeConversation?.contactPhone}{" "}
              based on package {detectedPackage?.postCode}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2 text-xs">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="convert-pilgrim-name"
                className="font-medium text-muted-foreground"
              >
                Pilgrim Name
              </label>
              <Input
                id="convert-pilgrim-name"
                defaultValue={
                  activeConversation?.contactName || "WhatsApp Pilgrim"
                }
                readOnly
                className="bg-secondary/40 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="convert-pilgrim-phone"
                className="font-medium text-muted-foreground"
              >
                Phone Number
              </label>
              <Input
                id="convert-pilgrim-phone"
                defaultValue={activeConversation?.contactPhone || ""}
                readOnly
                className="bg-secondary/40 text-xs tabular-nums"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="convert-room-type"
                  className="font-medium text-muted-foreground"
                >
                  Room Type
                </label>
                <select
                  id="convert-room-type"
                  value={convertRoomType}
                  onChange={(e) =>
                    setConvertRoomType(
                      e.target.value as "sharing" | "quad" | "triple" | "double"
                    )
                  }
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <option value="sharing">Sharing (Standard)</option>
                  <option value="quad">Quad Room</option>
                  <option value="triple">Triple Room</option>
                  <option value="double">Double Room</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="convert-num-adults"
                  className="font-medium text-muted-foreground"
                >
                  Number of Adults
                </label>
                <Input
                  id="convert-num-adults"
                  type="number"
                  min={1}
                  max={20}
                  value={convertAdults}
                  onChange={(e) =>
                    setConvertAdults(parseInt(e.target.value) || 1)
                  }
                  className="bg-background text-xs tabular-nums"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConvertModalOpen(false)}
              disabled={isConvertingQuote}
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConvertPostLookup}
              disabled={isConvertingQuote}
              className="gap-1.5 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {isConvertingQuote ? (
                <Loader2
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Check className="size-3.5" aria-hidden="true" />
              )}
              <span>Create Quote Worksheet</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          MODAL: WaCRM Auto-Reply Rules Engine & Greeting Studio (Slice 36)
          ========================================== */}
      <WhatsappAutoReplyStudio
        open={autoReplyStudioOpen}
        onClose={() => setAutoReplyStudioOpen(false)}
        accountId={activeAccount?.id}
        initialRules={autoReplyRules}
        onRulesChange={(updatedRules) => setAutoReplyRules(updatedRules)}
        initialQuickReplies={quickRepliesList}
        onQuickRepliesChange={(updatedQrs) =>
          setQuickRepliesList(updatedQrs as WhatsAppQuickReplyRecord[])
        }
        initialSettings={{
          id: activeAccount?.id,
          name: activeAccount?.name,
          displayPhoneNumber: activeAccount?.displayPhoneNumber,
          autoReplyEnabled: activeAccount?.autoReplyEnabled ?? true,
          autoReplyCooldownMinutes:
            activeAccount?.autoReplyCooldownMinutes ?? 60,
          welcomeGreetingEnabled:
            activeAccount?.welcomeGreetingEnabled ?? false,
          welcomeGreetingText: activeAccount?.welcomeGreetingText ?? "",
          awayGreetingEnabled: activeAccount?.awayGreetingEnabled ?? false,
          awayGreetingText: activeAccount?.awayGreetingText ?? "",
          businessHoursStart: activeAccount?.businessHoursStart ?? "09:00",
          businessHoursEnd: activeAccount?.businessHoursEnd ?? "21:00",
        }}
        onSettingsChange={(nextSettings) => {
          setAccounts((prev) =>
            prev.map((acc) =>
              acc.id === nextSettings.id || acc.id === activeAccount?.id
                ? {
                    ...acc,
                    autoReplyEnabled: nextSettings.autoReplyEnabled,
                    autoReplyCooldownMinutes:
                      nextSettings.autoReplyCooldownMinutes,
                    welcomeGreetingEnabled: nextSettings.welcomeGreetingEnabled,
                    welcomeGreetingText: nextSettings.welcomeGreetingText,
                    awayGreetingEnabled: nextSettings.awayGreetingEnabled,
                    awayGreetingText: nextSettings.awayGreetingText,
                    businessHoursStart: nextSettings.businessHoursStart,
                    businessHoursEnd: nextSettings.businessHoursEnd,
                  }
                : acc
            )
          )
        }}
      />

      {/* ==========================================
          MODAL: Official Meta WhatsApp Template Builder & Sync Studio (T-067)
          ========================================== */}
      <MetaTemplateBuilderModal
        open={templateStudioOpen}
        onClose={() => setTemplateStudioOpen(false)}
        accounts={accounts.map((acc) => ({
          id: acc.id,
          name: acc.name,
          displayPhoneNumber: acc.displayPhoneNumber,
          wabaId: acc.wabaId,
        }))}
        activeAccountId={activeAccount?.id}
        templates={templatesList}
        onTemplatesChange={(updatedTemplates) =>
          setTemplatesList(updatedTemplates as WhatsAppTemplateRecord[])
        }
        canManageTemplates={
          !currentUserRole || currentUserRole === "super_admin"
        }
      />
    </div>
  )
}
