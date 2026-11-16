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
  Video,
  RefreshCw,
  List as ListIcon,
  MousePointerClick,
  Smile,
  ArrowDownToLine,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  UserCheck,
  StickyNote,
  Smartphone,
  ShieldCheck,
  Pause,
  Play,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

const QUICK_REACTION_EMOJIS = ["👍", "❤️", "🤲", "✅", "🌟"]

export function DeskHubClient({
  initialTab,
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
        Date.now() - new Date(a.createdAt).getTime() > slaHours * 3600 * 1000
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
  }, [applications, slaHours])

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
    const list: Array<{ id: string; label: string; icon: string; count: number }> = [
      {
        id: "all",
        label: "All Lines",
        icon: "🌐",
        count: conversations.length,
      },
    ]

    const map = new Map<string, { label: string; icon: string; count: number }>()

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
        (!c.account?.platformType && !c.account?.phoneNumberId?.startsWith("linked-"))
      const icon = isCloud ? "☁️" : "📱"

      const existing = map.get(key)
      if (existing) {
        existing.count++
      } else {
        map.set(key, { label, icon, count: 1 })
      }
    }

    for (const [key, val] of map.entries()) {
      list.push({
        id: key,
        label: val.label,
        icon: val.icon,
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

  // Messages in active conversation
  const [activeMessages, setActiveMessages] = React.useState<
    WhatsAppMessageRecord[]
  >(activeConversation?.messages ?? [])
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false)
  const [isMarkingRead, setIsMarkingRead] = React.useState(false)
  const [mirroringMessageId, setMirroringMessageId] = React.useState<
    string | null
  >(null)

  // Sync active messages & automatically trigger Blue-Tick Read Receipts when unread thread opens (Spec 0013 AC-3, AC-6)
  React.useEffect(() => {
    if (!activeConversation) {
      setActiveMessages([])
      return
    }

    if (activeConversation.messages && activeConversation.messages.length > 0) {
      setActiveMessages(activeConversation.messages)
    } else {
      setIsLoadingMessages(true)
      getConversationMessagesAction(activeConversation.id)
        .then((res) => {
          if (res.success && res.messages) {
            setActiveMessages(res.messages as WhatsAppMessageRecord[])
          }
        })
        .finally(() => setIsLoadingMessages(false))
    }

    // Auto blue-tick read receipt when opening a thread with unread inbound messages
    if (activeConversation.unreadCount > 0) {
      markConversationMessagesAsReadAction({
        conversationId: activeConversation.id,
      }).then((res) => {
        if (res.success) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversation.id ? { ...c, unreadCount: 0 } : c
            )
          )
        }
      })
    }
  }, [activeConversation])

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
            setActiveMessages((prev) => {
              const prevSummary = prev
                .map((m) => `${m.id}-${m.status}-${m.mediaUrl}`)
                .join(",")
              const nextSummary = msgRes.messages
                .map((m) => `${m.id}-${m.status}-${m.mediaUrl}`)
                .join(",")
              if (prevSummary !== nextSummary) {
                return msgRes.messages as WhatsAppMessageRecord[]
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
    if (!activeConversation || !activeConversation.lastCustomerMessageAt) {
      return { isInside: false, remainingHours: 0, remainingMinutes: 0 }
    }
    const lastTime = new Date(
      activeConversation.lastCustomerMessageAt
    ).getTime()
    const diffMs = 24 * 60 * 60 * 1000 - (Date.now() - lastTime)
    if (diffMs <= 0) {
      return { isInside: false, remainingHours: 0, remainingMinutes: 0 }
    }
    const remainingHours = Math.floor(diffMs / 3600000)
    const remainingMinutes = Math.floor((diffMs % 3600000) / 60000)
    return { isInside: true, remainingHours, remainingMinutes }
  }, [activeConversation])

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

  // AI Quoting Copilot Draft state for WhatsApp Inbox (Spec 0015 AC-4)
  const [isGeneratingWaCopilot, setIsGeneratingWaCopilot] =
    React.useState(false)
  const [waCopilotDraft, setWaCopilotDraft] =
    React.useState<WaCopilotDraftResult | null>(null)
  const [waCopilotEditableText, setWaCopilotEditableText] = React.useState("")
  const [waCopilotMeta, setWaCopilotMeta] = React.useState<{
    modelUsed: string
    executionMode: string
  } | null>(null)
  const [waCopilotRun, setWaCopilotRun] = React.useState<{
    runId: string
    publicAccessToken?: string
    mode: "cloud" | "inline"
  } | null>(null)

  // Reset WaCopilot card & rehydrate active Trigger.dev runs when switching conversation
  React.useEffect(() => {
    setWaCopilotDraft(null)
    setWaCopilotEditableText("")
    setWaCopilotMeta(null)
    setWaCopilotRun(null)

    if (activeConversationId) {
      listActiveRunsByTagsAction([`copilot:wa:${activeConversationId}`])
        .then((runRes) => {
          if (runRes.success && runRes.activeRuns.length > 0) {
            const latestActive = runRes.activeRuns[0]
            setWaCopilotRun({
              runId: latestActive.runId,
              publicAccessToken: runRes.publicAccessToken,
              mode: runRes.mode === "cloud" ? "cloud" : "inline",
            })
            setIsGeneratingWaCopilot(true)
          }
        })
        .catch(() => null)
    }
  }, [activeConversationId])

  const handleGenerateWaCopilotDraft = async () => {
    if (!activeConversation) return
    setIsGeneratingWaCopilot(true)
    setComposerError(null)
    try {
      const res = await startWhatsappCopilotRunAction({
        conversationId: activeConversation.id,
      })
      if (!res.success) {
        setComposerError(
          res.error || "Failed to generate AI Copilot WhatsApp draft"
        )
        setIsGeneratingWaCopilot(false)
      } else if (res.mode === "cloud" && res.runId) {
        setWaCopilotRun({
          runId: res.runId,
          publicAccessToken: res.publicAccessToken,
          mode: "cloud",
        })
      } else if (res.inlineOutput && res.inlineOutput.success) {
        setWaCopilotDraft(res.inlineOutput.draft)
        setWaCopilotEditableText(res.inlineOutput.draft.bilingualReplyDraft)
        setWaCopilotMeta({
          modelUsed: res.inlineOutput.modelUsed,
          executionMode: res.inlineOutput.executionMode,
        })
        setIsGeneratingWaCopilot(false)
      } else {
        setIsGeneratingWaCopilot(false)
      }
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : "Error generating AI Copilot draft"
      )
      setIsGeneratingWaCopilot(false)
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
              id: res.messageId || Math.random().toString(),
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
              id: res.messageId || Math.random().toString(),
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
              id: res.messageId || Math.random().toString(),
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
            id: res.messageId || Math.random().toString(),
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
          id: res.messageId || Math.random().toString(),
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

  // Coexistence Intent Gatekeeper Filter
  const [intentFilter, setIntentFilter] = React.useState<
    "travel_only" | "personal_only" | "all_intents"
  >("all_intents")
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

  const travelLeadCount = React.useMemo(
    () =>
      conversations.filter((c) => c.intentCategory !== "PERSONAL_OR_OTHER")
        .length,
    [conversations]
  )
  const personalMutedCount = React.useMemo(
    () =>
      conversations.filter((c) => c.intentCategory === "PERSONAL_OR_OTHER")
        .length,
    [conversations]
  )

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

      // Coexistence AI Intent Gatekeeper Filter
      if (
        intentFilter === "travel_only" &&
        c.intentCategory === "PERSONAL_OR_OTHER"
      ) {
        return false
      }
      if (
        intentFilter === "personal_only" &&
        c.intentCategory !== "PERSONAL_OR_OTHER"
      ) {
        return false
      }

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
        const last = new Date(c.lastCustomerMessageAt).getTime()
        const isInside = Date.now() - last <= 24 * 3600 * 1000
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
    intentFilter,
    conversationFilterTab,
    phoneLineFilter,
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
              <Inbox className="size-5" />
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
            className="border-[#C5A059]/60 bg-[#0A3622] text-white hover:bg-[#0A3622]/90 font-semibold shadow-2xs gap-1.5"
          >
            <Sparkles className="size-3.5 text-[#C5A059]" />
            <span>AI Quote Copilot</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-post-lookup"))
            }
            className="border-primary/40 bg-card hover:bg-primary/5 hover:border-primary text-primary font-medium shadow-2xs gap-1.5"
            title="Search packages and instant convert to quote (Ctrl+K or Cmd+K)"
          >
            <Command className="size-3.5" />
            <span>Lookup Post Ref</span>
            <kbd className="ml-1 rounded border border-primary/30 bg-secondary px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
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
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all shadow-2xs",
              activeTab === "pipeline"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border border-border"
            )}
          >
            <Kanban className="size-4" />
            <span>Inquiries &amp; Quoting Pipeline</span>
            {pendingCount > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.2 text-xs font-bold tabular-nums",
                  activeTab === "pipeline"
                    ? "bg-white/20 text-white"
                    : "bg-amber-100 text-amber-900 border border-amber-300"
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
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all shadow-2xs",
              activeTab === "inbox"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border border-border"
            )}
          >
            <MessageCircle className="size-4" />
            <span>WhatsApp Shared Team Inbox</span>
            {totalUnreadWhatsApp > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.2 text-xs font-bold tabular-nums",
                  activeTab === "inbox"
                    ? "bg-white/20 text-white"
                    : "bg-emerald-100 text-emerald-900 border border-emerald-300"
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
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all shadow-2xs",
              activeTab === "web_messages"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border border-border"
            )}
          >
            <FileText className="size-4" />
            <span>Website &amp; Hajj Messages</span>
            {unreadContactMessages > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.2 text-xs font-bold tabular-nums",
                  activeTab === "web_messages"
                    ? "bg-white/20 text-white"
                    : "bg-sky-100 text-sky-900 border border-sky-300"
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
              <Bot className="size-4 text-primary" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-foreground leading-none">
                  ART-... Auto-Responder Bot
                </span>
                <span className="text-[10px] text-muted-foreground">
                  3s instant flyer &amp; PKR rates reply
                </span>
              </div>
              <button
                type="button"
                disabled={isTogglingAutoResponder}
                onClick={handleToggleAutoResponder}
                className={cn(
                  "ml-2 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors border",
                  autoReplyEnabled
                    ? "border-emerald-400 bg-emerald-600 text-white"
                    : "border-border bg-secondary text-muted-foreground"
                )}
                title="Toggle automatic 3-second replies when pilgrims send ART-... post codes"
              >
                {isTogglingAutoResponder ? (
                  <Loader2 className="size-3 animate-spin" />
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
              className="border border-[#C5A059]/60 bg-card text-[#0A3622] hover:bg-[#FAF8F5] font-semibold shadow-2xs gap-1.5 h-9"
              title="Open Official Meta WhatsApp HSM Template Studio (Create, Sync & Manage Templates)"
            >
              <Layers className="size-3.5 text-[#C5A059]" />
              <span>Meta Templates</span>
              <span className="ml-0.5 rounded-full bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 text-[10px] font-mono text-emerald-900">
                {approvedTemplatesList.length}
              </span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setAutoReplyStudioOpen(true)}
              className="border border-[#C5A059]/60 bg-[#0A3622] text-white hover:bg-[#0A3622]/90 font-semibold shadow-2xs gap-1.5 h-9"
              title="Open WaCRM Keyword Auto-Reply Rules Engine, Greeting & Business Hours Setup, and Quick-Reply Manager"
            >
              <Zap className="size-3.5 text-[#C5A059]" />
              <span>Auto-Replies &amp; Setup</span>
              <span className="ml-0.5 rounded-full bg-[#C5A059]/20 border border-[#C5A059]/40 px-1.5 py-0.2 text-[10px] font-mono text-[#C5A059]">
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
        <div className="flex flex-col gap-6 animate-in fade-in-50 duration-200">
          {/* 1. KPI Summary Strip */}
          <ApplicationsKpiStrip data={kpiData} />

          {/* 2. Pipeline Controls Bar (Search + Source Filter + View Mode Switcher) */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference (ART-...), pilgrim name, phone, city..."
                className="pl-9 pr-8 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Source Filters & View Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                <span className="text-xs font-semibold text-muted-foreground mr-1">
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
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                      sourceFilter === s.key
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
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
                    "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all",
                    pipelineViewMode === "kanban"
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Kanban className="size-3.5" />
                  <span>Kanban Board</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPipelineViewMode("table")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all",
                    pipelineViewMode === "table"
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TableIcon className="size-3.5" />
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 xl:gap-5 animate-in fade-in-50 duration-200">
          {/* PANE 1: Conversation List (4 Cols) */}
          <div className="flex flex-col rounded-2xl border border-border bg-card shadow-xs lg:col-span-4 min-h-[700px] overflow-hidden">
            {/* Header & Search */}
            <div className="flex flex-col gap-2.5 border-b border-border p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  <MessageCircle className="size-4 text-emerald-600" />
                  <span>Pilgrim Conversations</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsLiveSyncEnabled(!isLiveSyncEnabled)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all border cursor-pointer",
                      isLiveSyncEnabled
                        ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
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
                          ? "bg-emerald-500 animate-pulse"
                          : "bg-muted-foreground/60"
                      )}
                    />
                    <span>{isLiveSyncEnabled ? "Live (4s)" : "Paused"}</span>
                  </button>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-muted-foreground">
                    {filteredConversations.length}
                  </span>
                </div>
              </div>

              {/* Row 1: Search Bar + Dynamic Phone Line Filter */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={inboxSearch}
                    onChange={(e) => setInboxSearch(e.target.value)}
                    placeholder="Search name, phone, or package code..."
                    className="pl-8 text-xs h-8 bg-white"
                  />
                </div>
                {phoneLineFilters.length > 1 && (
                  <select
                    value={phoneLineFilter}
                    onChange={(e) => setPhoneLineFilter(e.target.value)}
                    className="h-8 rounded-md border border-border bg-white px-2 text-[11px] font-medium text-foreground focus:outline-none max-w-[130px]"
                  >
                    {phoneLineFilters.map((tab) => (
                      <option key={tab.id} value={tab.id}>
                        {tab.icon} {tab.label} ({tab.count})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Row 2: 1 Single Status Filter Row (All, Unread, Pinned, Archived) */}
              <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-secondary/30 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setConversationFilterTab("active")
                    setInboxFilter("all")
                  }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1 font-semibold transition-all whitespace-nowrap cursor-pointer",
                    conversationFilterTab === "active" && inboxFilter === "all"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Inbox className="size-3" />
                  <span>All</span>
                  <span className="rounded-full bg-black/10 px-1.5 py-0.1 text-[9px]">
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
                    "flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1 font-semibold transition-all whitespace-nowrap cursor-pointer",
                    inboxFilter === "unread"
                      ? "bg-emerald-700 text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>Unread</span>
                  <span className="rounded-full bg-black/10 px-1.5 py-0.1 text-[9px]">
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
                    "flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1 font-semibold transition-all whitespace-nowrap cursor-pointer",
                    conversationFilterTab === "pinned"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Pin className="size-3" />
                  <span>Pinned</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.1 text-[9px]">
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
                    "flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1 font-semibold transition-all whitespace-nowrap cursor-pointer",
                    conversationFilterTab === "archived"
                      ? "bg-slate-700 text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Archive className="size-3" />
                  <span>Archived</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.1 text-[9px]">
                    {archivedConversationsCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Conversation Items */}
            <div className="flex flex-1 flex-col divide-y divide-border/60 overflow-y-auto max-h-[640px]">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
                  <MessageCircle className="size-8 text-muted-foreground/40 mb-2" />
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
                  if (conv.lastCustomerMessageAt) {
                    const diff =
                      24 * 3600 * 1000 -
                      (Date.now() -
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
                        "flex flex-col gap-1.5 p-3.5 text-left transition-colors hover:bg-secondary/40",
                        isSelected && "bg-secondary/70 border-l-3 border-primary"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                          {conv.isPinned && (
                            <Pin className="size-3 fill-amber-500 text-amber-500 shrink-0" />
                          )}
                          <span className="font-display text-xs font-bold text-foreground truncate">
                            {conv.contactName || conv.contactPhone}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
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

                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        <div className="flex flex-wrap items-center gap-1">
                          {/* Multi-Number Phone Line Badge */}
                          {conv.account?.platformType === "LINKED_DEVICE" ? (
                            <span className="rounded-full border border-emerald-400 bg-emerald-50 px-1.5 py-0.2 font-mono font-bold text-emerald-950 text-[9px] flex items-center gap-0.5">
                              <span>📱</span>
                              <span>{conv.account.displayPhoneNumber || "Line"} · Linked</span>
                            </span>
                          ) : (
                            <span className="rounded-full border border-blue-300 bg-blue-50 px-1.5 py-0.2 font-mono font-medium text-blue-900 text-[9px] flex items-center gap-0.5">
                              <span>☁️</span>
                              <span>{conv.account?.displayPhoneNumber || "Cloud API"} · Meta</span>
                            </span>
                          )}

                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.2 font-medium border text-[10px]",
                              isInside24h
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-amber-300 bg-amber-50 text-amber-900"
                            )}
                          >
                            {windowLabel}
                          </span>

                          {isPersonalMuted ? (
                            <span className="rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.2 font-semibold text-slate-700 text-[9px]">
                              🔒 Personal (Bot Muted)
                            </span>
                          ) : isHandoff ? (
                            <span className="rounded-full border border-purple-300 bg-purple-50 px-1.5 py-0.2 font-semibold text-purple-900 text-[9px]">
                              🤝 Agent Handoff
                            </span>
                          ) : isTravelLead ? (
                            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.2 font-semibold text-emerald-900 text-[9px]">
                              🕋 Travel Lead
                            </span>
                          ) : null}

                          {conv.detectedPostCode && (
                            <span className="rounded-full border border-amber-400 bg-amber-100 px-1.5 py-0.2 font-mono font-bold text-amber-950 text-[9px]">
                              {conv.detectedPostCode}
                            </span>
                          )}
                        </div>

                        {conv.unreadCount > 0 && (
                          <span className="rounded-full bg-emerald-600 px-1.5 py-0.2 font-bold text-white text-[10px]">
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
          <div className="flex flex-col rounded-2xl border border-border bg-card shadow-xs lg:col-span-5 min-h-[700px] overflow-hidden">
            {activeConversation ? (
              <>
                {/* Active Chat Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3.5 bg-secondary/30">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
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
                            className="border-amber-300 bg-amber-50 text-amber-900 font-mono text-[10px]"
                          >
                            {activeConversation.detectedPostCode}
                          </Badge>
                        )}
                        {/* AI Intent Classification Badge */}
                        {activeConversation.intentCategory ===
                        "PERSONAL_OR_OTHER" ? (
                          <Badge
                            variant="outline"
                            className="border-slate-300 bg-slate-100 text-slate-800 text-[10px] font-semibold"
                            title={
                              activeConversation.intentReason ||
                              "Personal or non-travel conversation (Auto-replies muted)"
                            }
                          >
                            🔒 Personal / Bot Muted
                          </Badge>
                        ) : activeConversation.intentCategory ===
                          "FOUNDER_HANDOFF" ? (
                          <Badge
                            variant="outline"
                            className="border-purple-300 bg-purple-50 text-purple-900 text-[10px] font-semibold"
                            title={
                              activeConversation.intentReason ||
                              "Handed off from Founder Line to Dedicated AI Agent"
                            }
                          >
                            🤝 Founder Handoff
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-emerald-50 text-emerald-900 text-[10px] font-semibold"
                            title={
                              activeConversation.intentReason ||
                              "Verified Al Ramlah Travels inquiry"
                            }
                          >
                            🕋 Travel Lead
                            {activeConversation.intentConfidence
                              ? ` (${activeConversation.intentConfidence}%)`
                              : ""}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">
                          {activeConversation.contactPhone}
                        </span>
                        {/* Multi-Number Phone Line Badge & Role Indicator in Active Chat Header */}
                        {activeConversation.account?.platformType === "LINKED_DEVICE" ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/50 bg-emerald-50 text-emerald-950 font-mono text-[10px] font-bold flex items-center gap-1"
                          >
                            <span>📱</span>
                            <span>Line: {activeConversation.account.displayPhoneNumber || "Linked"} · Linked Device SIM</span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-blue-400/50 bg-blue-50 text-blue-950 font-mono text-[10px] font-medium flex items-center gap-1"
                          >
                            <span>☁️</span>
                            <span>Line: {activeConversation.account?.displayPhoneNumber || "Official WABA"} · Meta Cloud API</span>
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
                          className="text-[10px] font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
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
                    <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-card px-2 py-0.5 text-xs">
                      <UserCheck className="size-3 text-muted-foreground shrink-0" />
                      <select
                        aria-label="Assign consultant to conversation"
                        value={activeConversation.assignedUserId || ""}
                        disabled={isAssigningAgent}
                        onChange={(e) => handleAssignAgent(e.target.value || null)}
                        className="bg-transparent text-[11px] font-medium text-foreground focus:outline-none cursor-pointer"
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
                      variant={activeConversation.isPinned ? "secondary" : "ghost"}
                      size="xs"
                      type="button"
                      disabled={isTogglingPin}
                      onClick={handleTogglePin}
                      className={cn(
                        "text-[11px] gap-1 px-2 font-medium transition-all cursor-pointer",
                        activeConversation.isPinned
                          ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={
                        activeConversation.isPinned
                          ? "Unpin conversation"
                          : "Pin conversation to top of inbox"
                      }
                    >
                      {isTogglingPin ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Pin
                          className={cn(
                            "size-3.5",
                            activeConversation.isPinned
                              ? "fill-amber-600 text-amber-600"
                              : ""
                          )}
                        />
                      )}
                      <span>{activeConversation.isPinned ? "Pinned" : "Pin"}</span>
                    </Button>

                    {/* Spec 0019: Archive Toggle Button */}
                    <Button
                      variant={activeConversation.isArchived ? "secondary" : "ghost"}
                      size="xs"
                      type="button"
                      disabled={isTogglingArchive}
                      onClick={handleToggleArchive}
                      className={cn(
                        "text-[11px] gap-1 px-2 font-medium transition-all cursor-pointer",
                        activeConversation.isArchived
                          ? "border-slate-300 bg-slate-100 text-slate-800"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={
                        activeConversation.isArchived
                          ? "Unarchive conversation"
                          : "Archive conversation"
                      }
                    >
                      {isTogglingArchive ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : activeConversation.isArchived ? (
                        <ArchiveRestore className="size-3.5" />
                      ) : (
                        <Archive className="size-3.5" />
                      )}
                      <span>{activeConversation.isArchived ? "Unarchive" : "Archive"}</span>
                    </Button>

                    {/* 1-Click Hand Off to Dedicated AI Agent */}
                    <Button
                      variant="outline"
                      size="xs"
                      type="button"
                      disabled={isHandingOffToAgent}
                      onClick={handleHandoffToAgent}
                      className="text-[11px] font-semibold border-purple-300 bg-purple-50/80 text-purple-900 hover:bg-purple-100 gap-1 px-2"
                      title="Transfer this contact from Founder Coexistence Line (+92 319 0462638) to Dedicated AI Agent Line"
                    >
                      {isHandingOffToAgent ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Bot className="size-3.5 text-purple-700" />
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
                      className="text-[11px] font-medium text-sky-700 hover:bg-sky-50 gap-1 px-2"
                      title="Dispatch official Meta Blue-Tick Read Receipt to pilgrim's phone"
                    >
                      {isMarkingRead ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <CheckCheck className="size-3.5 text-sky-500" />
                      )}
                      <span>Mark Read</span>
                    </Button>

                    {/* AI Copilot Draft Button (Spec 0015 AC-4) */}
                    <Button
                      size="xs"
                      type="button"
                      disabled={isGeneratingWaCopilot}
                      onClick={handleGenerateWaCopilotDraft}
                      className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 border border-[#C5A059]/60 text-[11px] font-semibold gap-1 shadow-2xs"
                    >
                      {isGeneratingWaCopilot ? (
                        <Loader2 className="size-3 animate-spin text-[#C5A059]" />
                      ) : (
                        <Sparkles className="size-3 text-[#C5A059]" />
                      )}
                      <span>AI Copilot Draft</span>
                    </Button>

                    {active24hState.isInside ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        <span className="size-1.5 rounded-full bg-emerald-600" />
                        <span>
                          {active24hState.remainingHours}h{" "}
                          {active24hState.remainingMinutes}m
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        <AlertCircle className="size-3 text-amber-600" />
                        <span>Template Required</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Banner Notifications */}
                {pdfSuccessBanner && (
                  <div className="flex items-center justify-between bg-emerald-50 border-b border-emerald-200 p-2.5 text-xs text-emerald-900">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Check className="size-4 text-emerald-600" />
                      <span>{pdfSuccessBanner}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPdfSuccessBanner(null)}
                      className="text-emerald-700 hover:text-emerald-900"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}

                {composerError && (
                  <div className="flex items-center justify-between bg-red-50 border-b border-red-200 p-2.5 text-xs text-red-900">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertCircle className="size-4 text-red-600" />
                      <span>{composerError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setComposerError(null)}
                      className="text-red-700 hover:text-red-900"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}

                {waCopilotRun && (
                  <div className="p-3 border-b border-[#C5A059]/40 bg-[#0A3622]/5">
                    <CopilotRealtimeRunBanner
                      runId={waCopilotRun.runId}
                      publicAccessToken={waCopilotRun.publicAccessToken}
                      mode={waCopilotRun.mode}
                      title="AI Quoting Concierge Telemetry"
                      onComplete={async (output) => {
                        setIsGeneratingWaCopilot(false)
                        if (output?.draft) {
                          setWaCopilotDraft(output.draft)
                          setWaCopilotEditableText(
                            output.draft.bilingualReplyDraft || ""
                          )
                          setWaCopilotMeta({
                            modelUsed: output.modelUsed || "Trigger.dev Worker",
                            executionMode: output.executionMode || "ai_provider",
                          })
                        } else if (activeConversation?.id) {
                          const res =
                            await generateWaConversationCopilotDraftAction({
                              conversationId: activeConversation.id,
                            })
                          if (res.success) {
                            setWaCopilotDraft(res.draft)
                            setWaCopilotEditableText(
                              res.draft.bilingualReplyDraft
                            )
                            setWaCopilotMeta({
                              modelUsed: res.modelUsed,
                              executionMode: res.executionMode,
                            })
                          }
                        }
                      }}
                      onDismiss={() => {
                        setWaCopilotRun(null)
                        setIsGeneratingWaCopilot(false)
                      }}
                    />
                  </div>
                )}

                {/* AI Concierge Draft Review Card (Spec 0015 AC-4, requiresHumanApproval: true) */}
                {waCopilotDraft && (
                  <div className="border-b border-[#C5A059]/50 bg-[#0A3622]/5 p-3.5 text-xs space-y-2.5 animate-in fade-in-50 duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Bot className="size-4 text-primary" />
                        <span className="font-display font-bold text-foreground">
                          AI Quoting Concierge Draft (Bilingual EN + Roman Urdu)
                        </span>
                        <Badge
                          variant="outline"
                          className="border-amber-400 bg-amber-100 text-amber-950 text-[10px] font-mono"
                        >
                          Human Review Required
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {waCopilotMeta && (
                          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {waCopilotMeta.modelUsed}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setWaCopilotDraft(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3.5" />
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
                          className="border-amber-300 bg-amber-50 text-amber-900 font-mono text-[10px]"
                        >
                          Package: {waCopilotDraft.matchedPackageCode}
                        </Badge>
                      )}
                      {waCopilotDraft.matchedBatchCode && (
                        <Badge
                          variant="outline"
                          className="border-emerald-300 bg-emerald-50 text-emerald-900 font-mono text-[10px]"
                        >
                          Batch: {waCopilotDraft.matchedBatchCode}
                        </Badge>
                      )}
                    </div>

                    {/* Recommended Pricing Bullets */}
                    {waCopilotDraft.recommendedPricingBullets.length > 0 && (
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
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
                      className="text-xs bg-card"
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
                        className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 font-bold gap-1"
                      >
                        <ArrowDownToLine className="size-3 text-[#C5A059]" />
                        <span>Use Draft in Composer</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Messages Stream */}
                <div
                  ref={messagesScrollContainerRef}
                  className="flex flex-1 flex-col gap-3 p-4 overflow-y-auto max-h-[500px] bg-secondary/15"
                >
                  {isLoadingMessages ? (
                    <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="size-6 animate-spin" />
                    </div>
                  ) : activeMessages.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
                      <Clock className="size-6 text-muted-foreground/40 mb-1" />
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
                            "group relative flex flex-col max-w-[85%] rounded-2xl p-3 shadow-2xs text-xs",
                            isOutbound
                              ? "self-end bg-primary text-primary-foreground rounded-tr-xs border border-primary/80"
                              : "self-start bg-card text-foreground rounded-tl-xs border border-border"
                          )}
                        >
                          {/* Auto-Bot Badge (Spec 0013 AC-2, AC-6) */}
                          {msg.isAutoReply && (
                            <div className="mb-1.5 flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-300/60 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                                <Bot className="size-3" />
                                <span>ART-... Auto-Bot Reply</span>
                              </span>
                            </div>
                          )}

                          {/* 1. R2 Inbound/Outbound Image or Sticker Preview (Spec 0013 AC-1, AC-6) */}
                          {isImageOrSticker && msg.mediaUrl && (
                            <div className="mb-2 overflow-hidden rounded-xl border border-border/40 bg-black/5">
                              <a
                                href={msg.mediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <Image
                                  src={msg.mediaUrl}
                                  alt={msg.mediaFilename || "WhatsApp image"}
                                  width={480}
                                  height={320}
                                  unoptimized
                                  className="max-h-56 w-full object-cover transition-transform hover:scale-[1.02]"
                                />
                              </a>
                            </div>
                          )}

                          {/* 2. R2 Audio / Urdu Voice Note Player (Spec 0013 AC-1, AC-6) */}
                          {isAudio && msg.mediaUrl && (
                            <div className="mb-2 flex flex-col gap-1 rounded-xl bg-black/10 p-2">
                              <div className="flex items-center gap-1.5 text-[10px] opacity-90">
                                <Music className="size-3.5" />
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
                            <div className="mb-2 overflow-hidden rounded-xl bg-black/10">
                              <video
                                controls
                                src={msg.mediaUrl}
                                className="max-h-56 w-full rounded-xl"
                              />
                            </div>
                          )}

                          {/* 4. Document / PDF Card */}
                          {isDocument && (
                            <div
                              className={cn(
                                "flex items-center gap-3 rounded-xl p-2.5 mb-1.5 border",
                                isOutbound
                                  ? "bg-white/10 border-white/20 text-white"
                                  : "bg-secondary border-border text-foreground"
                              )}
                            >
                              <div className="flex size-9 items-center justify-center rounded-lg bg-red-100 text-red-700 shrink-0">
                                <FileText className="size-5" />
                              </div>
                              <div className="flex flex-col truncate">
                                <span className="font-bold text-xs truncate">
                                  {msg.mediaFilename ||
                                    "Al_Ramlah_Document.pdf"}
                                </span>
                                <span className="text-[10px] opacity-80">
                                  {msg.mediaMimeType || "PDF Document"}
                                  {msg.mediaFileSize
                                    ? ` · ${Math.round(msg.mediaFileSize / 1024)} KB`
                                    : ""}
                                </span>
                              </div>
                              {msg.mediaUrl && (
                                <a
                                  href={msg.mediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-auto p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                                  title="Download / Preview Document"
                                >
                                  <Download className="size-4" />
                                </a>
                              )}
                            </div>
                          )}

                          {/* Manual "Mirror to R2" Retry Button when rawMediaId is present without mediaUrl (Spec 0013 AC-1, AC-6) */}
                          {msg.rawMediaId && !msg.mediaUrl && (
                            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-amber-950">
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <ImageIcon className="size-3.5 text-amber-700" />
                                <span>Media pending R2 archival</span>
                              </div>
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={mirroringMessageId === msg.id}
                                onClick={() => handleManualMediaMirror(msg.id)}
                                className="h-6 border-amber-400 bg-white text-[10px] font-bold text-amber-900 hover:bg-amber-100 gap-1"
                              >
                                {mirroringMessageId === msg.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="size-3" />
                                )}
                                <span>Mirror to R2</span>
                              </Button>
                            </div>
                          )}

                          {/* Interactive Header */}
                          {payload?.headerText && (
                            <div className="mb-1 font-bold text-xs opacity-95">
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
                            <div className="mt-1 text-[10px] opacity-75">
                              {payload.footerText}
                            </div>
                          )}

                          {/* Interactive Reply Buttons Display */}
                          {payload?.buttons &&
                            Array.isArray(payload.buttons) &&
                            payload.buttons.length > 0 && (
                              <div className="mt-2 flex flex-col gap-1 border-t border-white/20 pt-2">
                                {payload.buttons.map((b) => (
                                  <div
                                    key={b.id}
                                    className={cn(
                                      "flex items-center justify-center rounded-lg py-1.5 px-2 text-center text-[11px] font-bold border",
                                      isOutbound
                                        ? "border-white/30 bg-white/10 text-white"
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
                              <div className="mt-2 flex flex-col gap-1.5 border-t border-white/20 pt-2">
                                <div className="flex items-center gap-1 text-[10px] font-bold uppercase opacity-85">
                                  <ListIcon className="size-3" />
                                  <span>
                                    {payload.buttonText || "Menu Options"}
                                  </span>
                                </div>
                                {payload.sections.map((sec, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="flex flex-col gap-1 rounded-lg bg-black/10 p-1.5"
                                  >
                                    <span className="text-[10px] font-bold opacity-90">
                                      {sec.title}
                                    </span>
                                    {sec.rows.map((r) => (
                                      <div
                                        key={r.id}
                                        className="rounded bg-white/10 px-2 py-1 text-[10px]"
                                      >
                                        <div className="font-semibold">
                                          {r.title}
                                        </div>
                                        {r.description && (
                                          <div className="opacity-75 text-[9px]">
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
                              "flex items-center justify-between gap-2 text-[10px] mt-1.5 opacity-80 font-mono",
                              isOutbound
                                ? "text-primary-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-1">
                              {msg.reactionEmoji && (
                                <span className="rounded-full bg-black/15 px-1.5 py-0.2 text-xs">
                                  {msg.reactionEmoji}
                                </span>
                              )}

                              {/* Quick Emoji Reaction Picker Trigger */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReactionTargetWamid(
                                      reactionTargetWamid === msg.wamid
                                        ? null
                                        : msg.wamid
                                    )
                                  }
                                  className="opacity-60 hover:opacity-100 transition-opacity p-0.5"
                                  title="React with emoji"
                                >
                                  <Smile className="size-3" />
                                </button>
                                {reactionTargetWamid === msg.wamid && (
                                  <div className="absolute bottom-5 left-0 z-20 flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 shadow-md">
                                    {QUICK_REACTION_EMOJIS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() =>
                                          handleSendReaction(msg.wamid, emoji)
                                        }
                                        className="text-sm hover:scale-125 transition-transform"
                                      >
                                        {emoji}
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
                                    <CheckCheck className="size-3 text-sky-300" />
                                  ) : msg.status === "delivered" ? (
                                    <CheckCheck className="size-3" />
                                  ) : msg.status === "sent" ? (
                                    <Check className="size-3" />
                                  ) : msg.status === "failed" ? (
                                    <AlertCircle className="size-3 text-red-300" />
                                  ) : (
                                    <Clock className="size-3" />
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
                  <div className="border-t border-border bg-card p-3 shadow-sm animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Zap className="size-3.5 text-primary" />
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
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >
                          Manage /shortcuts &amp; Auto-Replies
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuickReplyPicker(false)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-36 overflow-y-auto">
                      {quickRepliesList.map((qr) => (
                        <button
                          key={qr.id}
                          type="button"
                          onClick={() => {
                            setComposerText(qr.bodyText)
                            setShowQuickReplyPicker(false)
                          }}
                          className="flex flex-col rounded-lg border border-border p-2 text-left hover:bg-secondary/60 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-bold text-primary">
                              /{qr.shortcut.replace(/^\/+/, "")}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {qr.category}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-foreground truncate">
                            {qr.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message Composer Area (Text, Interactive Reply Buttons, Interactive List Menus, or Template) */}
                <div className="border-t border-border p-3.5 bg-card">
                  {active24hState.isInside ? (
                    <div className="flex flex-col gap-2.5">
                      {/* Composer Mode Switcher (Spec 0013 AC-4, AC-6) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-lg bg-secondary p-0.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setComposerMode("text")}
                            className={cn(
                              "rounded-md px-2.5 py-1 font-semibold transition-colors",
                              composerMode === "text"
                                ? "bg-card text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Text Reply
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposerMode("buttons")}
                            className={cn(
                              "flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors",
                              composerMode === "buttons"
                                ? "bg-card text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <MousePointerClick className="size-3" />
                            <span>Reply Buttons (1–3)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposerMode("list")}
                            className={cn(
                              "flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors",
                              composerMode === "list"
                                ? "bg-card text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <ListIcon className="size-3" />
                            <span>List Menu</span>
                          </button>
                        </div>

                        <Button
                          variant="ghost"
                          size="xs"
                          type="button"
                          onClick={handleGenerateWaCopilotDraft}
                          disabled={isGeneratingWaCopilot}
                          className="text-[11px] font-semibold text-primary hover:bg-primary/10 gap-1"
                        >
                          <Sparkles className="size-3 text-[#C5A059]" />
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
                            className="h-7 text-xs"
                          />
                          <Input
                            value={interactiveFooter}
                            onChange={(e) =>
                              setInteractiveFooter(e.target.value)
                            }
                            placeholder="Optional Footer (max 60 chars)"
                            maxLength={60}
                            className="h-7 text-xs"
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
                          className="min-h-[68px] resize-none pr-10 text-xs"
                        />
                      </div>

                      {/* Interactive Reply Buttons Builder (1..3 buttons) */}
                      {composerMode === "buttons" && (
                        <div className="rounded-xl border border-border bg-secondary/30 p-2.5 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-foreground">
                              Quick-Reply Buttons (Max 3 · 20 chars each)
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
                                className="text-primary font-bold hover:underline"
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
                                  className="h-7 text-xs bg-card"
                                />
                                {replyButtons.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReplyButtons((prev) =>
                                        prev.filter((_, i) => i !== idx)
                                      )
                                    }
                                    className="text-muted-foreground hover:text-red-600"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Interactive List Menu Builder */}
                      {composerMode === "list" && (
                        <div className="rounded-xl border border-border bg-secondary/30 p-2.5 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground">
                                Menu Button Text (max 20 chars)
                              </label>
                              <Input
                                value={listButtonText}
                                maxLength={20}
                                onChange={(e) =>
                                  setListButtonText(e.target.value)
                                }
                                className="h-7 text-xs bg-card mt-0.5"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground">
                                Section Title (max 24 chars)
                              </label>
                              <Input
                                value={listSectionTitle}
                                maxLength={24}
                                onChange={(e) =>
                                  setListSectionTitle(e.target.value)
                                }
                                className="h-7 text-xs bg-card mt-0.5"
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
                                className="text-primary font-bold hover:underline"
                              >
                                + Add Row
                              </button>
                            )}
                          </div>

                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {listRows.map((row, idx) => (
                              <div
                                key={idx}
                                className="grid grid-cols-12 gap-1.5 items-center"
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
                                  className="col-span-5 h-7 text-xs bg-card"
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
                                  className="col-span-6 h-7 text-xs bg-card"
                                />
                                {listRows.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setListRows((prev) =>
                                        prev.filter((_, i) => i !== idx)
                                      )
                                    }
                                    className="col-span-1 text-muted-foreground hover:text-red-600 flex justify-center"
                                  >
                                    <X className="size-3.5" />
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
                          className="text-xs font-medium text-primary hover:bg-primary/10 gap-1"
                        >
                          <Zap className="size-3.5" />
                          <span>Macros (/)</span>
                        </Button>

                        <Button
                          size="sm"
                          disabled={isSendingMessage || !composerText.trim()}
                          onClick={handleSendReply}
                          className="gap-1.5 font-semibold"
                        >
                          {isSendingMessage ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Send className="size-3.5" />
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
                    <div className="flex flex-col gap-2.5 rounded-xl border border-amber-300 bg-amber-50/50 p-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                        <AlertCircle className="size-4 text-amber-600 shrink-0" />
                        <span>
                          Outside 24h Window: Meta requires an approved template to contact pilgrim
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Select Approved Message Template:
                          </label>
                          <button
                            type="button"
                            onClick={() => setTemplateStudioOpen(true)}
                            className="text-[11px] font-semibold text-[#0A3622] hover:underline"
                          >
                            + Create / Sync Meta Template
                          </button>
                        </div>
                        <select
                          value={selectedTemplate?.name || selectedTemplateName}
                          onChange={(e) =>
                            setSelectedTemplateName(e.target.value)
                          }
                          className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {approvedTemplatesList.length === 0 ? (
                            <option value="">
                              No APPROVED Meta templates — click Create / Sync
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
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Header Media URL (
                            {(selectedTemplate?.headerType || "").toUpperCase()}
                            ):
                          </label>
                          <Input
                            placeholder="https://..."
                            value={templateHeaderMediaUrl}
                            onChange={(e) =>
                              setTemplateHeaderMediaUrl(e.target.value)
                            }
                            className="text-xs h-8 bg-card"
                          />
                        </div>
                      )}

                      {/* Dynamic Template Variable Inputs (Spec 0019 AC-2) */}
                      {templatePlaceholders.length > 0 && (
                        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-100/40 p-2.5">
                          <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1">
                            <Sparkles className="size-3 text-amber-700" />
                            <span>
                              Template Parameters ({templatePlaceholders.length}{" "}
                              Variables)
                            </span>
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {templatePlaceholders.map((ph) => {
                              const currentValue =
                                templateVariableValues[ph] ??
                                (ph === 1
                                  ? activeConversation.contactName || ""
                                  : "")
                              return (
                                <div key={ph} className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-mono font-bold text-amber-900">{`{{${ph}}}`}</span>
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
                                          className="text-amber-800 hover:underline"
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
                                    className="h-7 text-xs bg-card"
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {selectedTemplate && (
                        <div className="rounded-lg border border-amber-200 bg-card p-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground block mb-0.5">
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
                        className="gap-1.5 font-semibold w-full sm:w-auto self-end"
                      >
                        {isSendingMessage ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Send className="size-3.5" />
                        )}
                        <span>Dispatch Meta Template</span>
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
                <MessageCircle className="size-10 text-muted-foreground/30 mb-2" />
                <p className="font-semibold text-foreground text-sm">
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
                <div className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-xs gap-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Pilgrim Dossier
                    </span>
                    <a
                      href={`https://wa.me/${formatWhatsAppPhone(activeConversation.contactPhone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-800 text-xs font-medium flex items-center gap-1"
                    >
                      <Phone className="size-3" />
                      <span>Direct WA</span>
                    </a>
                  </div>

                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-bold text-foreground text-sm">
                      {activeConversation.contactName ||
                        "Direct WhatsApp Contact"}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {activeConversation.contactPhone}
                    </span>
                  </div>

                  {/* Linked Application & 1-Click Send Luxury PDF Action */}
                  {activeConversation.application ? (
                    <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">
                          Ref: {activeConversation.application.referenceNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                        >
                          {activeConversation.application.status.replace(
                            "_",
                            " "
                          )}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3" />
                        <span>
                          Party:{" "}
                          {activeConversation.application.totalPassportCount ||
                            2}{" "}
                          Pax (
                          {activeConversation.application.bedAndSeatCount || 2}{" "}
                          Beds)
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-1 pt-2 border-t border-primary/20">
                        <Button
                          size="xs"
                          disabled={isSendingPdf}
                          onClick={handleSendLuxuryPdf}
                          className="w-full gap-1.5 font-bold shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {isSendingPdf ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <FileText className="size-3" />
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
                          className="w-full gap-1 border-primary/30 text-primary hover:bg-primary/10"
                        >
                          <span>Open Quote Worksheet</span>
                          <ExternalLink className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                      No application linked yet.
                    </div>
                  )}
                </div>

                {/* 2. Detected Flyer Package Card (when customer messages code) */}
                {detectedPackage && (
                  <div className="flex flex-col rounded-2xl border border-amber-300 bg-amber-50/40 p-4 shadow-xs gap-3 animate-in fade-in-50 duration-150">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-amber-600" />
                        <span className="font-display text-xs font-bold uppercase tracking-wider text-amber-950">
                          Detected Package Ref
                        </span>
                      </div>
                      <span className="font-mono font-bold text-xs text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                        {detectedPackage.postCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Plane className="size-3.5 text-primary shrink-0" />
                      <span className="font-bold text-foreground">
                        {detectedPackage.flyer?.airlineName ||
                          "Airline Flights"}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {detectedPackage.outboundDateLabel}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 text-xs bg-card rounded-xl p-2.5 border border-amber-200/80">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground truncate">
                          {detectedPackage.makkahHotelName}
                        </span>
                        <span className="text-muted-foreground text-[11px] shrink-0">
                          {detectedPackage.makkahNights}N ·{" "}
                          {detectedPackage.makkahDistanceLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground truncate">
                          {detectedPackage.madinahHotelName}
                        </span>
                        <span className="text-muted-foreground text-[11px] shrink-0">
                          {detectedPackage.madinahNights}N ·{" "}
                          {detectedPackage.madinahDistanceLabel}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                      <div className="flex flex-col rounded-lg bg-card p-1.5 border border-border">
                        <span className="text-[10px]">Quad Retail</span>
                        <span className="font-mono font-bold text-foreground">
                          PKR {detectedPackage.retailQuadPkr.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col rounded-lg bg-card p-1.5 border border-border">
                        <span className="text-[10px]">Sharing Retail</span>
                        <span className="font-mono font-bold text-foreground">
                          PKR{" "}
                          {detectedPackage.retailSharingPkr.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col rounded-lg bg-card p-1.5 border border-border">
                        <span className="text-[10px]">Triple Retail</span>
                        <span className="font-mono font-bold text-foreground">
                          PKR {detectedPackage.retailTriplePkr.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col rounded-lg bg-card p-1.5 border border-border">
                        <span className="text-[10px]">Double Retail</span>
                        <span className="font-mono font-bold text-foreground">
                          PKR {detectedPackage.retailDoublePkr.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                      <span>
                        Net Wholesale:{" "}
                        <strong className="text-foreground">
                          PKR {detectedPackage.netSharingPkr.toLocaleString()}
                        </strong>
                      </span>
                      <span>
                        Margin:{" "}
                        <strong className="text-emerald-700">
                          +PKR {detectedPackage.commissionPkr.toLocaleString()}
                        </strong>
                      </span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setConvertModalOpen(true)}
                      className="w-full gap-1.5 font-bold shadow-sm bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Convert to Official Quote</span>
                    </Button>
                  </div>
                )}

                {/* 3. Internal Team Notes Card (Spec 0019 AC-3, Sticky Yellow Notes) */}
                <div className="flex flex-col rounded-2xl border border-amber-300/80 bg-amber-50/30 p-4 shadow-xs gap-3">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <div className="flex items-center gap-1.5">
                      <StickyNote className="size-3.5 text-amber-700" />
                      <span className="font-display text-xs font-bold uppercase tracking-wider text-amber-950">
                        Internal Team Notes
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                      {activeConversation.internalNotes?.length || 0} Notes
                    </span>
                  </div>

                  <p className="text-[11px] text-amber-900/80 -mt-1">
                    Private staff-only comments. Pilgrims never see these notes.
                  </p>

                  {/* Notes Feed */}
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                    {!activeConversation.internalNotes ||
                    activeConversation.internalNotes.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-100/30 p-3 text-center text-xs text-amber-800/70">
                        No internal team notes recorded yet.
                      </div>
                    ) : (
                      activeConversation.internalNotes.map((n) => (
                        <div
                          key={n.id}
                          className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-100/70 p-2.5 shadow-2xs text-xs text-amber-950"
                        >
                          <div className="flex items-center justify-between text-[10px] font-semibold text-amber-800 border-b border-amber-200/50 pb-1">
                            <span>{n.userName}</span>
                            <span>
                              {new Date(n.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-[11px] leading-relaxed pt-0.5">
                            {n.note}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Note Form */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-amber-200/60">
                    <Textarea
                      rows={2}
                      placeholder="Add staff comment (e.g. Call back at 5pm; budget PKR 650k)..."
                      value={internalNoteInput}
                      onChange={(e) => setInternalNoteInput(e.target.value)}
                      className="text-xs bg-white border-amber-200 focus-visible:ring-amber-500"
                    />
                    <Button
                      size="xs"
                      type="button"
                      disabled={isAddingNote || !internalNoteInput.trim()}
                      onClick={handleAddInternalNote}
                      className="self-end gap-1 font-semibold bg-amber-700 hover:bg-amber-800 text-white text-[11px] cursor-pointer"
                    >
                      {isAddingNote ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Plus className="size-3" />
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
        <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
          <MessagesClient initialMessages={contactMessages} />
        </div>
      )}

      {/* ==========================================
          MODAL: Pipeline AI Quoting Copilot Preview (Spec 0015 AC-5)
          ========================================== */}
      <Dialog open={pipelineCopilotOpen} onOpenChange={setPipelineCopilotOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-[#C5A059]" />
              <span>AI Quoting Copilot — Pipeline Pre-Fill &amp; Summary</span>
            </DialogTitle>
            <DialogDescription>
              Select any active pilgrim inquiry to compute itemized SAR/PKR rate hints and executive notes (Human-in-the-Loop).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <select
                value={selectedPipelineAppId}
                onChange={(e) => {
                  setSelectedPipelineAppId(e.target.value)
                  setPipelineCopilotDraft(null)
                }}
                className="flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
              >
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.referenceNumber} — {a.customerName} (
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
                className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 gap-1.5 font-semibold"
              >
                {isGeneratingPipelineCopilot ? (
                  <Loader2 className="size-3.5 animate-spin text-[#C5A059]" />
                ) : (
                  <Sparkles className="size-3.5 text-[#C5A059]" />
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
              <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-red-900">
                {pipelineCopilotError}
              </div>
            )}

            {pipelineCopilotDraft && (
              <div className="rounded-xl border border-[#C5A059]/50 bg-[#0A3622]/5 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">
                    Executive Summary
                  </span>
                  {pipelineCopilotMeta && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {pipelineCopilotMeta.modelUsed}
                    </Badge>
                  )}
                </div>
                <p className="text-foreground/90 leading-relaxed">
                  {pipelineCopilotDraft.executiveSummary}
                </p>

                <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-border bg-card p-2 font-mono text-[11px]">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      Visa
                    </span>
                    <span className="font-bold">
                      PKR{" "}
                      {pipelineCopilotDraft.suggestedQuoteWorksheet.visaTotalPkr.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      Flights
                    </span>
                    <span className="font-bold">
                      PKR{" "}
                      {pipelineCopilotDraft.suggestedQuoteWorksheet.flightsTotalPkr.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      Makkah &amp; Madinah
                    </span>
                    <span className="font-bold">
                      PKR{" "}
                      {(
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .makkahHotelTotalPkr +
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .madinahHotelTotalPkr
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      Transport &amp; Ziyarat
                    </span>
                    <span className="font-bold">
                      PKR{" "}
                      {(
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .transportTotalPkr +
                        pipelineCopilotDraft.suggestedQuoteWorksheet
                          .ziyaratTotalPkr
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      Agency Margin
                    </span>
                    <span className="font-bold text-emerald-700">
                      PKR{" "}
                      {pipelineCopilotDraft.suggestedQuoteWorksheet.commissionPkr.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      Grand Total
                    </span>
                    <span className="font-bold text-primary">
                      PKR{" "}
                      {pipelineCopilotDraft.suggestedQuoteWorksheet.grandTotalPkr.toLocaleString()}
                    </span>
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
                className="gap-1.5 font-bold"
              >
                <span>Open Full Quote Worksheet</span>
                <ExternalLink className="size-3.5" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          MODAL: 1-Click Convert Post Lookup to Quote
          ========================================== */}
      <Dialog open={convertModalOpen} onOpenChange={setConvertModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
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
              <label className="font-medium text-muted-foreground">
                Pilgrim Name
              </label>
              <Input
                defaultValue={
                  activeConversation?.contactName || "WhatsApp Pilgrim"
                }
                readOnly
                className="bg-secondary/40 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium text-muted-foreground">
                Phone Number
              </label>
              <Input
                defaultValue={activeConversation?.contactPhone || ""}
                readOnly
                className="bg-secondary/40 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-medium text-muted-foreground">
                  Room Type
                </label>
                <select
                  value={convertRoomType}
                  onChange={(e) =>
                    setConvertRoomType(
                      e.target.value as "sharing" | "quad" | "triple" | "double"
                    )
                  }
                  className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
                >
                  <option value="sharing">Sharing (Standard)</option>
                  <option value="quad">Quad Room</option>
                  <option value="triple">Triple Room</option>
                  <option value="double">Double Room</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-medium text-muted-foreground">
                  Number of Adults
                </label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={convertAdults}
                  onChange={(e) =>
                    setConvertAdults(parseInt(e.target.value) || 1)
                  }
                  className="text-xs"
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
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConvertPostLookup}
              disabled={isConvertingQuote}
              className="gap-1.5 font-bold"
            >
              {isConvertingQuote ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
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
