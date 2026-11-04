"use client"

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"
import {
  Inbox,
  Kanban,
  Table as TableIcon,
  Search,
  Filter,
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
  FileCheck,
  Paperclip,
  Download,
  ExternalLink,
  ChevronRight,
  Plane,
  Building2,
  Users,
  Coins,
  Ticket,
  Zap,
  Loader2,
  Command,
  Plus,
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
import { TabularPrice } from "@/components/layout/status-badge"
import {
  sendWhatsappConversationReplyAction,
  sendApplicationLuxuryPdfViaWhatsappAction,
  getConversationMessagesAction,
} from "@/app/actions/whatsapp-crm"
import { convertPostLookupToApplication } from "@/app/actions/marketing-ops"
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
  isActive: boolean
  isDefault: boolean
}

export interface WhatsAppMessageRecord {
  id: string
  conversationId: string
  wamid: string
  direction: "inbound" | "outbound"
  status: "pending" | "sent" | "delivered" | "read" | "failed"
  messageType: "text" | "image" | "document" | "audio" | "video" | "template" | "interactive"
  body?: string | null
  mediaUrl?: string | null
  mediaType?: string | null
  mediaFilename?: string | null
  templateName?: string | null
  contextMessageId?: string | null
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
  lastCustomerMessageAt?: Date | string | null
  lastMessageAt: Date | string
  unreadCount: number
  isPinned: boolean
  isArchived: boolean
  assignedUserId?: string | null
  createdAt: Date | string
  messages?: WhatsAppMessageRecord[]
  account?: {
    id: string
    name: string
    displayPhoneNumber: string
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
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED"
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

export interface DeskHubClientProps {
  initialTab?: string
  applications: DeskApplicationItem[]
  slaHours?: number
  whatsappAccounts: WhatsAppAccountRecord[]
  whatsappConversations: WhatsAppConversationRecord[]
  whatsappTemplates: WhatsAppTemplateRecord[]
  whatsappQuickReplies: WhatsAppQuickReplyRecord[]
  flyerPackages: FlyerPackageRecord[]
  contactMessages: ContactMessageData[]
}

export function DeskHubClient({
  initialTab = "pipeline",
  applications,
  slaHours = 24,
  whatsappAccounts,
  whatsappConversations: initialConversations,
  whatsappTemplates,
  whatsappQuickReplies,
  flyerPackages,
  contactMessages,
}: DeskHubClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Tab State: URL-synced (?tab=pipeline|inbox|web_messages)
  const tabFromUrl = searchParams.get("tab")
  const activeTab: DeskTabKey =
    tabFromUrl === "inbox"
      ? "inbox"
      : tabFromUrl === "web_messages" || tabFromUrl === "messages"
        ? "web_messages"
        : "pipeline"

  const switchTab = (tab: DeskTabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tab)
    router.push(`${pathname}?${params.toString()}`)
  }

  // Auto-dispatch Cmd+K Reverse Lookup if ?lookup=1 or ?openLookup=1 is in URL
  React.useEffect(() => {
    if (searchParams.get("lookup") === "1" || searchParams.get("openLookup") === "1") {
      window.dispatchEvent(new CustomEvent("open-post-lookup"))
    }
  }, [searchParams])

  // Count Badges
  const pendingCount = React.useMemo(
    () => applications.filter((a) => a.status === "pending_quote").length,
    [applications]
  )
  const totalUnreadWhatsApp = React.useMemo(
    () => initialConversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [initialConversations]
  )
  const unreadContactMessages = React.useMemo(
    () => contactMessages.filter((m) => m.status === "unread").length,
    [contactMessages]
  )

  // ==========================================
  // TAB 1: PIPELINE FILTERS & VIEW STATE
  // ==========================================
  const [pipelineViewMode, setPipelineViewMode] = React.useState<"kanban" | "table">("kanban")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [sourceFilter, setSourceFilter] = React.useState<string>("all")

  // Filtered applications
  const filteredApplications = React.useMemo(() => {
    return applications.filter((app) => {
      // Source filter
      if (sourceFilter !== "all") {
        if (sourceFilter === "custom_builder" && app.source !== "custom_builder") return false
        if (sourceFilter === "group_booking" && app.source !== "group_booking") return false
        if (sourceFilter === "hajj_inquiry" && app.source !== "hajj_inquiry") return false
        if (sourceFilter === "post_lookup" && !app.sourcePostCode) return false
      }

      // Search query
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
    const pending = applications.filter((a) => a.status === "pending_quote").length
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

  // ==========================================
  // TAB 2: WHATSAPP SHARED TEAM INBOX STATE
  // ==========================================
  const [conversations, setConversations] =
    React.useState<WhatsAppConversationRecord[]>(initialConversations)
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(
    initialConversations[0]?.id ?? null
  )
  const [inboxFilter, setInboxFilter] = React.useState<
    "all" | "unread" | "active_24h" | "overdue_24h" | "with_code"
  >("all")
  const [inboxSearch, setInboxSearch] = React.useState("")

  // Active selected conversation
  const activeConversation = React.useMemo(() => {
    return conversations.find((c) => c.id === activeConversationId) ?? conversations[0] ?? null
  }, [conversations, activeConversationId])

  // Messages in active conversation
  const [activeMessages, setActiveMessages] = React.useState<WhatsAppMessageRecord[]>(
    activeConversation?.messages ?? []
  )
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false)

  // Sync active messages when active conversation changes
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
  }, [activeConversation])

  // Scroll to bottom of message thread
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeMessages])

  // 24-hour service window calculation for active conversation
  const active24hState = React.useMemo(() => {
    if (!activeConversation || !activeConversation.lastCustomerMessageAt) {
      return { isInside: false, remainingHours: 0, remainingMinutes: 0 }
    }
    const lastTime = new Date(activeConversation.lastCustomerMessageAt).getTime()
    const diffMs = 24 * 60 * 60 * 1000 - (Date.now() - lastTime)
    if (diffMs <= 0) {
      return { isInside: false, remainingHours: 0, remainingMinutes: 0 }
    }
    const remainingHours = Math.floor(diffMs / 3600000)
    const remainingMinutes = Math.floor((diffMs % 3600000) / 60000)
    return { isInside: true, remainingHours, remainingMinutes }
  }, [activeConversation])

  // Free-form composer text & quick reply picker
  const [composerText, setComposerText] = React.useState("")
  const [showQuickReplyPicker, setShowQuickReplyPicker] = React.useState(false)
  const [isSendingMessage, setIsSendingMessage] = React.useState(false)
  const [composerError, setComposerError] = React.useState<string | null>(null)

  // Template selector state (outside 24h window)
  const [selectedTemplateName, setSelectedTemplateName] = React.useState<string>(
    whatsappTemplates[0]?.name ?? ""
  )

  const selectedTemplate = React.useMemo(() => {
    return whatsappTemplates.find((t) => t.name === selectedTemplateName) ?? whatsappTemplates[0]
  }, [whatsappTemplates, selectedTemplateName])

  // Send WhatsApp reply
  const handleSendReply = async () => {
    if (!activeConversation) return
    setComposerError(null)

    if (active24hState.isInside) {
      if (!composerText.trim()) return
      setIsSendingMessage(true)
      try {
        const res = await sendWhatsappConversationReplyAction({
          conversationId: activeConversation.id,
          messageType: "text",
          text: composerText.trim(),
        })

        if (!res.success) {
          setComposerError(res.error || "Failed to dispatch message")
        } else {
          // Optimistically append outbound message
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
      } catch (err) {
        setComposerError(err instanceof Error ? err.message : "Error sending message")
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
        const res = await sendWhatsappConversationReplyAction({
          conversationId: activeConversation.id,
          messageType: "template",
          templateName: selectedTemplate.name,
          templateLanguage: selectedTemplate.language || "en_US",
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
            body: selectedTemplate.bodyText,
            createdAt: new Date().toISOString(),
          }
          setActiveMessages((prev) => [...prev, newMsg])
        }
      } catch (err) {
        setComposerError(err instanceof Error ? err.message : "Error sending template")
      } finally {
        setIsSendingMessage(false)
      }
    }
  }

  // 1-Click Send 3-Page Luxury Quotation PDF via WhatsApp
  const [isSendingPdf, setIsSendingPdf] = React.useState(false)
  const [pdfSuccessBanner, setPdfSuccessBanner] = React.useState<string | null>(null)

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
        setComposerError(res.error || "Failed to generate or dispatch 3-page luxury quotation PDF")
      } else {
        setPdfSuccessBanner(
          `3-Page Luxury PDF quotation dispatched successfully to ${activeConversation.contactPhone}!`
        )
        // Optimistically add document message
        const docMsg: WhatsAppMessageRecord = {
          id: res.messageId || Math.random().toString(),
          conversationId: activeConversation.id,
          wamid: res.wamid || "wamid.pdf",
          direction: "outbound",
          status: "sent",
          messageType: "document",
          mediaFilename: "Al_Ramlah_Umrah_Quotation.pdf",
          body: "Official 3-Page Luxury Umrah Itinerary & Quotation PDF",
          createdAt: new Date().toISOString(),
        }
        setActiveMessages((prev) => [...prev, docMsg])
      }
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : "Error dispatching luxury PDF")
    } finally {
      setIsSendingPdf(false)
    }
  }

  // Package Lookup Match for active conversation's detectedPostCode
  const detectedPackage = React.useMemo(() => {
    if (!activeConversation?.detectedPostCode) return null
    const code = activeConversation.detectedPostCode.trim().toUpperCase()
    return flyerPackages.find((p) => p.postCode.trim().toUpperCase() === code) ?? null
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
        setComposerError(res.error || "Failed to convert post lookup to quote application")
      }
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : "Conversion error")
    } finally {
      setIsConvertingQuote(false)
    }
  }

  // Filtered inbox conversations
  const filteredConversations = React.useMemo(() => {
    return conversations.filter((c) => {
      // Search
      if (inboxSearch.trim()) {
        const q = inboxSearch.toLowerCase().trim()
        const matchName = c.contactName?.toLowerCase().includes(q) ?? false
        const matchPhone = c.contactPhone.includes(q)
        const matchCode = c.detectedPostCode?.toLowerCase().includes(q) ?? false
        if (!matchName && !matchPhone && !matchCode) return false
      }

      // Filter chips
      if (inboxFilter === "unread" && c.unreadCount <= 0) return false
      if (inboxFilter === "with_code" && !c.detectedPostCode) return false

      if (inboxFilter === "active_24h" || inboxFilter === "overdue_24h") {
        if (!c.lastCustomerMessageAt) return inboxFilter === "overdue_24h"
        const last = new Date(c.lastCustomerMessageAt).getTime()
        const isInside = Date.now() - last <= 24 * 3600 * 1000
        if (inboxFilter === "active_24h" && !isInside) return false
        if (inboxFilter === "overdue_24h" && isInside) return false
      }

      return true
    })
  }, [conversations, inboxSearch, inboxFilter])

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
                Pilgrim Inbox & Quote Desk
              </h1>
              <p className="text-xs text-muted-foreground">
                Operational quoting pipeline, live Meta WhatsApp Cloud API shared inbox, and website inquiries.
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action: ⌘K Post Reverse Lookup */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent("open-post-lookup"))}
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
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
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
            <span>Inquiries & Quoting Pipeline</span>
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
            <span>Website & Hajj Messages</span>
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
                <span className="text-xs font-semibold text-muted-foreground mr-1">Source:</span>
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
              applications={filteredApplications as unknown as KanbanApplicationItem[]}
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
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-muted-foreground">
                  {filteredConversations.length}
                </span>
              </div>

              {/* Inbox Search */}
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                  placeholder="Filter name, phone, post code..."
                  className="pl-8 text-xs h-8"
                />
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto text-[11px] pb-0.5">
                {[
                  { key: "all", label: "All" },
                  { key: "unread", label: "Unread" },
                  { key: "active_24h", label: "Active 24h" },
                  { key: "overdue_24h", label: "Expired" },
                  { key: "with_code", label: "Ref Codes" },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setInboxFilter(f.key as typeof inboxFilter)}
                    className={cn(
                      "rounded-md px-2 py-0.5 font-medium transition-colors whitespace-nowrap",
                      inboxFilter === f.key
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation Items */}
            <div className="flex flex-1 flex-col divide-y divide-border/60 overflow-y-auto max-h-[640px]">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
                  <MessageCircle className="size-8 text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-foreground">No conversations found</p>
                  <p className="mt-1">Inbound messages via Meta Webhook will appear here live.</p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = conv.id === activeConversation?.id

                  // Calculate 24h window
                  let isInside24h = false
                  let windowLabel = "Template Required"
                  if (conv.lastCustomerMessageAt) {
                    const diff = 24 * 3600 * 1000 - (Date.now() - new Date(conv.lastCustomerMessageAt).getTime())
                    if (diff > 0) {
                      isInside24h = true
                      const hrs = Math.floor(diff / 3600000)
                      windowLabel = `Active 24h (${hrs}h)`
                    }
                  }

                  const snippet = conv.messages?.[conv.messages.length - 1]?.body || "No messages yet"

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
                        <span className="font-display text-xs font-bold text-foreground truncate max-w-[170px]">
                          {conv.contactName || conv.contactPhone}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                          {new Date(conv.lastMessageAt).toLocaleDateString("en-PK", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>

                      <p className="line-clamp-1 text-xs text-muted-foreground">{snippet}</p>

                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          {/* 24h Window Badge */}
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

                          {/* Post Code Pill */}
                          {conv.detectedPostCode && (
                            <span className="rounded-full border border-amber-400 bg-amber-100 px-1.5 py-0.2 font-mono font-bold text-amber-950 text-[9px]">
                              {conv.detectedPostCode}
                            </span>
                          )}
                        </div>

                        {/* Unread Pill */}
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
                <div className="flex items-center justify-between border-b border-border p-3.5 bg-secondary/30">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                      {activeConversation.contactName
                        ? activeConversation.contactName.slice(0, 2).toUpperCase()
                        : "WA"}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-foreground">
                          {activeConversation.contactName || activeConversation.contactPhone}
                        </span>
                        {activeConversation.detectedPostCode && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-900 font-mono text-[10px]"
                          >
                            {activeConversation.detectedPostCode}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {activeConversation.contactPhone}
                      </span>
                    </div>
                  </div>

                  {/* 24-Hour Indicator Pill */}
                  <div className="flex items-center gap-2">
                    {active24hState.isInside ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        <span className="size-1.5 rounded-full bg-emerald-600" />
                        <span>
                          {active24hState.remainingHours}h {active24hState.remainingMinutes}m remaining
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
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

                {/* Messages Stream */}
                <div className="flex flex-1 flex-col gap-3 p-4 overflow-y-auto max-h-[500px] bg-secondary/15">
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

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex flex-col max-w-[85%] rounded-2xl p-3 shadow-2xs text-xs",
                            isOutbound
                              ? "self-end bg-primary text-primary-foreground rounded-tr-xs border border-primary/80"
                              : "self-start bg-card text-foreground rounded-tl-xs border border-border"
                          )}
                        >
                          {/* Document / PDF Card */}
                          {msg.messageType === "document" ||
                          (msg.mediaUrl && msg.mediaUrl.endsWith(".pdf")) ? (
                            <div
                              className={cn(
                                "flex items-center gap-3 rounded-xl p-2.5 mb-1.5 border",
                                isOutbound
                                  ? "bg-white/10 border-white/20 text-white"
                                  : "bg-secondary border-border text-foreground"
                              )}
                            >
                              <div className="flex size-9 items-center justify-center rounded-lg bg-red-100 text-red-700">
                                <FileText className="size-5" />
                              </div>
                              <div className="flex flex-col truncate">
                                <span className="font-bold text-xs truncate">
                                  {msg.mediaFilename || "Al_Ramlah_Umrah_Quotation.pdf"}
                                </span>
                                <span className="text-[10px] opacity-80">3-Page Luxury PDF Itinerary</span>
                              </div>
                              {msg.mediaUrl && (
                                <a
                                  href={msg.mediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-auto p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                                  title="Download / Preview PDF"
                                >
                                  <Download className="size-4" />
                                </a>
                              )}
                            </div>
                          ) : null}

                          {/* Message Body */}
                          {msg.body && <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>}

                          {/* Time & Delivery Status Ticks */}
                          <div
                            className={cn(
                              "flex items-center justify-end gap-1 text-[10px] mt-1 opacity-80 font-mono",
                              isOutbound ? "text-primary-foreground" : "text-muted-foreground"
                            )}
                          >
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
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
                        <span>Quick Replies (Type &apos;/&apos; or pick below)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowQuickReplyPicker(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-36 overflow-y-auto">
                      {whatsappQuickReplies.map((qr) => (
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
                              {qr.shortcut}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{qr.category}</span>
                          </div>
                          <span className="text-xs font-medium text-foreground truncate">{qr.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message Composer Area */}
                <div className="border-t border-border p-3.5 bg-card">
                  {active24hState.isInside ? (
                    /* Free-Form Composer inside 24h */
                    <div className="flex flex-col gap-2">
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
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleSendReply()
                            }
                          }}
                          placeholder="Type response to pilgrim... (Press Enter to send, type '/' for quick replies)"
                          className="min-h-[72px] resize-none pr-10 text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Button
                          variant="ghost"
                          size="xs"
                          type="button"
                          onClick={() => setShowQuickReplyPicker(!showQuickReplyPicker)}
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
                          <span>Send Reply</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Template Selector outside 24h */
                    <div className="flex flex-col gap-2.5 rounded-xl border border-amber-300 bg-amber-50/50 p-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                        <AlertCircle className="size-4 text-amber-600 shrink-0" />
                        <span>Outside 24h Window: Meta requires an approved template to contact pilgrim</span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Select Approved Message Template:
                        </label>
                        <select
                          value={selectedTemplateName}
                          onChange={(e) => setSelectedTemplateName(e.target.value)}
                          className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {whatsappTemplates.map((t) => (
                            <option key={t.id} value={t.name}>
                              {t.name} ({t.language}) - {t.category}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Template Preview Card */}
                      {selectedTemplate && (
                        <div className="rounded-lg border border-amber-200 bg-card p-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground block mb-0.5">Template Preview:</span>
                          <p className="whitespace-pre-wrap">{selectedTemplate.bodyText}</p>
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
                <p className="font-semibold text-foreground text-sm">No Conversation Selected</p>
                <p className="mt-1">Select a conversation from the left pane to begin chatting.</p>
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
                      {activeConversation.contactName || "Direct WhatsApp Contact"}
                    </span>
                    <span className="font-mono text-muted-foreground">{activeConversation.contactPhone}</span>
                  </div>

                  {/* Linked Application & 1-Click Send Luxury PDF Action */}
                  {activeConversation.application ? (
                    <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">
                          Ref: {activeConversation.application.referenceNumber}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {activeConversation.application.status.replace("_", " ")}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3" />
                        <span>
                          Party: {activeConversation.application.totalPassportCount || 2} Pax (
                          {activeConversation.application.bedAndSeatCount || 2} Beds)
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-1 pt-2 border-t border-primary/20">
                        {/* 1-Click Send Luxury 3-Page Quotation PDF on WhatsApp */}
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

                    {/* Flight & Airline */}
                    <div className="flex items-center gap-2 text-xs">
                      <Plane className="size-3.5 text-primary shrink-0" />
                      <span className="font-bold text-foreground">
                        {detectedPackage.flyer?.airlineName || "Airline Flights"}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{detectedPackage.outboundDateLabel}</span>
                    </div>

                    {/* Makkah & Madinah Hotels */}
                    <div className="flex flex-col gap-1 text-xs bg-card rounded-xl p-2.5 border border-amber-200/80">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground truncate">
                          {detectedPackage.makkahHotelName}
                        </span>
                        <span className="text-muted-foreground text-[11px] shrink-0">
                          {detectedPackage.makkahNights}N · {detectedPackage.makkahDistanceLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground truncate">
                          {detectedPackage.madinahHotelName}
                        </span>
                        <span className="text-muted-foreground text-[11px] shrink-0">
                          {detectedPackage.madinahNights}N · {detectedPackage.madinahDistanceLabel}
                        </span>
                      </div>
                    </div>

                    {/* Retail Pricing Table */}
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
                          PKR {detectedPackage.retailSharingPkr.toLocaleString()}
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

                    {/* Net vs Margin Breakdown */}
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

                    {/* 1-Click Convert to Official Quote Action */}
                    <Button
                      size="sm"
                      onClick={() => setConvertModalOpen(true)}
                      className="w-full gap-1.5 font-bold shadow-sm bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Plus className="size-3.5" />
                      <span>Convert to Official Quote</span>
                    </Button>
                  </div>
                )}
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
              Create an official inquiry for {activeConversation?.contactName || activeConversation?.contactPhone} based on package {detectedPackage?.postCode}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2 text-xs">
            <div className="flex flex-col gap-1">
              <label className="font-medium text-muted-foreground">Pilgrim Name</label>
              <Input
                defaultValue={activeConversation?.contactName || "WhatsApp Pilgrim"}
                readOnly
                className="bg-secondary/40 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium text-muted-foreground">Phone Number</label>
              <Input
                defaultValue={activeConversation?.contactPhone || ""}
                readOnly
                className="bg-secondary/40 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-medium text-muted-foreground">Room Type</label>
                <select
                  value={convertRoomType}
                  onChange={(e) =>
                    setConvertRoomType(e.target.value as "sharing" | "quad" | "triple" | "double")
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
                <label className="font-medium text-muted-foreground">Number of Adults</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={convertAdults}
                  onChange={(e) => setConvertAdults(parseInt(e.target.value) || 1)}
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
    </div>
  )
}
