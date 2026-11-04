"use client"

import * as React from "react"
import { useState, useTransition, useMemo, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Share2,
  MessageCircle,
  Cpu,
  Building2,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Plus,
  Key,
  Server,
  FileText,
  Cloud,
  Lock,
  Phone,
  Globe,
  Radio,
  Sparkles,
  Activity,
  HelpCircle,
  UserCheck,
  Users,
  ShieldAlert,
  Loader2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

import {
  SettingsClient,
  type AgencySettingsData,
} from "@/components/admin/catalog/settings-client"
import {
  UsersClient,
  type UserAccountData,
} from "@/components/admin/catalog/users-client"
import {
  upsertWhatsappAccountAction,
  syncWhatsappTemplatesAction,
} from "@/app/actions/whatsapp-crm"
import {
  disconnectSocialIntegrationAction,
  saveManualSocialIntegrationAction,
  type SafeSocialIntegration,
} from "@/app/actions/social-scheduler"
import type { SocialProviderId } from "@/lib/social/types"
import { cn } from "@/lib/utils"

// ==========================================
// Types
// ==========================================

export type SettingsTabKey =
  | "connections"
  | "whatsapp"
  | "infrastructure"
  | "agency"
  | "staff"

export interface SafeWhatsappAccount {
  id: string
  name: string
  phoneNumberId: string
  wabaId: string
  displayPhoneNumber: string
  verifiedName: string | null
  qualityRating: string | null
  messagingLimit: string | null
  webhookVerifyToken: string
  isActive: boolean
  isDefault: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export interface SafeWhatsappTemplate {
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
  syncedAt: Date | string | null
}

export interface SafeInfrastructureStatus {
  openRouterConfigured: boolean
  geminiConfigured: boolean
  r2Configured: boolean
  triggerConfigured: boolean
  gotenbergConfigured: boolean
  appUrl: string
}

export interface ConnectionsSettingsClientProps {
  initialTab?: string
  connectedProvider?: string
  urlError?: string
  agencySettings: AgencySettingsData | null
  socialIntegrations: SafeSocialIntegration[]
  whatsappAccounts: SafeWhatsappAccount[]
  whatsappTemplates: SafeWhatsappTemplate[]
  infrastructureStatus: SafeInfrastructureStatus
  staffUsers: UserAccountData[]
  currentUserId: string
  currentUserRole: string
}

// ==========================================
// Custom SVG Icons for Core 5 Social Providers
// ==========================================

function InstagramIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function FacebookIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

function TikTokIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  )
}

function YouTubeIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <polygon points="10 15 15 12 10 9 10 15" fill="currentColor" />
    </svg>
  )
}

function GoogleMapsIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

interface SocialProviderMeta {
  id: SocialProviderId
  name: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  badgeColor: string
  oauthUrl: string
  brandColor: string
}

const CORE_SOCIAL_PROVIDERS: SocialProviderMeta[] = [
  {
    id: "instagram",
    name: "Instagram Business",
    subtitle: "Single spotlights, multi-package carousel sheets & Umrah story cards",
    icon: InstagramIcon,
    badgeColor: "bg-pink-500/10 text-pink-700 border-pink-500/30",
    oauthUrl: "/api/oauth/social/instagram",
    brandColor: "text-pink-600",
  },
  {
    id: "facebook",
    name: "Facebook Pages",
    subtitle: "Promotional packages, departure announcements & flyer brochures",
    icon: FacebookIcon,
    badgeColor: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    oauthUrl: "/api/oauth/social/facebook",
    brandColor: "text-blue-600",
  },
  {
    id: "tiktok",
    name: "TikTok Business",
    subtitle: "Vertical video reels, hotel room tours & pilgrim essential tips",
    icon: TikTokIcon,
    badgeColor: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",
    oauthUrl: "/api/oauth/social/tiktok",
    brandColor: "text-cyan-600",
  },
  {
    id: "youtube",
    name: "YouTube Channel",
    subtitle: "Full video walkthroughs, departure guides & YouTube Shorts",
    icon: YouTubeIcon,
    badgeColor: "bg-red-500/10 text-red-700 border-red-500/30",
    oauthUrl: "/api/oauth/social/youtube",
    brandColor: "text-red-600",
  },
  {
    id: "gmb",
    name: "Google Business Profile",
    subtitle: "Google Maps local updates, call-to-actions & package offerings",
    icon: GoogleMapsIcon,
    badgeColor: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    oauthUrl: "/api/oauth/social/gmb",
    brandColor: "text-emerald-600",
  },
]

// ==========================================
// Tab Definitions
// ==========================================

interface TabMeta {
  key: SettingsTabKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  superAdminOnly?: boolean
}

const TAB_CONFIG: TabMeta[] = [
  {
    key: "connections",
    label: "Social Channels",
    icon: Share2,
    description: "Core 5 social publishing accounts with native Postiz OAuth & manual token bridge",
  },
  {
    key: "whatsapp",
    label: "WhatsApp Cloud API",
    icon: MessageCircle,
    description: "Official Meta WhatsApp Business Account (WABA), Webhook receiver & template sync",
  },
  {
    key: "infrastructure",
    label: "Cloud Infrastructure",
    icon: Cpu,
    description: "Trigger.dev Cloud, Cloudflare R2 storage, Multimodal AI & Oracle Gotenberg PDF engine",
  },
  {
    key: "agency",
    label: "Agency Parameters",
    icon: Building2,
    description: "Official agency branding, helpline numbers, SLA overdue thresholds & SAR exchange rate",
  },
  {
    key: "staff",
    label: "Staff & RBAC",
    icon: Shield,
    description: "Administrative staff accounts, role-based access control, active status & password resets",
    superAdminOnly: true,
  },
]

// ==========================================
// Main Component
// ==========================================

export function ConnectionsSettingsClient({
  initialTab = "connections",
  connectedProvider,
  urlError,
  agencySettings,
  socialIntegrations: initialSocialIntegrations,
  whatsappAccounts: initialWhatsappAccounts,
  whatsappTemplates: initialWhatsappTemplates,
  infrastructureStatus,
  staffUsers,
  currentUserId,
  currentUserRole,
}: ConnectionsSettingsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isSuperAdmin = currentUserRole === "super_admin"

  // URL state synchronization
  const validTabKeys = useMemo<SettingsTabKey[]>(() => {
    return isSuperAdmin
      ? ["connections", "whatsapp", "infrastructure", "agency", "staff"]
      : ["connections", "whatsapp", "infrastructure", "agency"]
  }, [isSuperAdmin])

  const activeTab: SettingsTabKey = useMemo(() => {
    const urlTab = searchParams.get("tab") as SettingsTabKey | null
    if (urlTab && validTabKeys.includes(urlTab)) {
      return urlTab
    }
    if (validTabKeys.includes(initialTab as SettingsTabKey)) {
      return initialTab as SettingsTabKey
    }
    return "connections"
  }, [searchParams, initialTab, validTabKeys])

  const handleTabChange = (key: SettingsTabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Banners for OAuth callback feedback
  const [successBanner, setSuccessBanner] = useState<string | null>(
    connectedProvider || searchParams.get("connected") || null
  )
  const [errorBanner, setErrorBanner] = useState<string | null>(
    urlError || searchParams.get("error") || null
  )

  useEffect(() => {
    const conn = searchParams.get("connected")
    const err = searchParams.get("error")
    if (conn) {
      setSuccessBanner(conn)
    }
    if (err) {
      setErrorBanner(err)
    }
  }, [searchParams])

  const handleDismissSuccessBanner = () => {
    setSuccessBanner(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("connected")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleDismissErrorBanner = () => {
    setErrorBanner(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("error")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Origin for Webhook Callback URL
  const [origin, setOrigin] = useState<string>(infrastructureStatus.appUrl || "")
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.origin) {
      setOrigin(window.location.origin)
    }
  }, [])
  const webhookCallbackUrl = `${origin.replace(/\/$/, "")}/api/webhooks/whatsapp`

  // 1-Click Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr))
      }, 2500)
    } catch (err) {
      console.warn("Failed to copy to clipboard:", err)
    }
  }

  // ------------------------------------------
  // Tab 1: Social Connections & Manual Modal
  // ------------------------------------------
  const [socialIntegrations, setSocialIntegrations] = useState<SafeSocialIntegration[]>(
    initialSocialIntegrations
  )
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [manualProvider, setManualProvider] = useState<SocialProviderId>("instagram")
  const [manualName, setManualName] = useState("")
  const [manualHandle, setManualHandle] = useState("")
  const [manualInternalAccountId, setManualInternalAccountId] = useState("")
  const [manualAccessToken, setManualAccessToken] = useState("")
  const [manualRefreshToken, setManualRefreshToken] = useState("")
  const [manualExpiresInDays, setManualExpiresInDays] = useState("60")
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleOpenManualModal = (providerId: SocialProviderId) => {
    const provMeta = CORE_SOCIAL_PROVIDERS.find((p) => p.id === providerId)
    setManualProvider(providerId)
    setManualName(`Al Ramlah ${provMeta?.name || "Official"}`)
    setManualHandle("@alramlahtravels")
    setManualInternalAccountId("")
    setManualAccessToken("")
    setManualRefreshToken("")
    setManualExpiresInDays("60")
    setManualError(null)
    setIsManualModalOpen(true)
  }

  const handleSaveManualToken = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualAccessToken.trim()) {
      setManualError("Access token is required")
      return
    }
    if (!manualInternalAccountId.trim()) {
      setManualError("Internal Account / Page ID is required")
      return
    }

    setManualSubmitting(true)
    setManualError(null)

    try {
      const result = await saveManualSocialIntegrationAction({
        provider: manualProvider,
        name: manualName.trim() || `Al Ramlah ${manualProvider}`,
        handle: manualHandle.trim() || undefined,
        internalAccountId: manualInternalAccountId.trim(),
        accessToken: manualAccessToken.trim(),
        refreshToken: manualRefreshToken.trim() || undefined,
        tokenExpiresInDays: manualExpiresInDays ? parseInt(manualExpiresInDays, 10) : undefined,
      })

      if (!result.success) {
        setManualError(result.error || "Failed to save integration token")
        setManualSubmitting(false)
        return
      }

      setIsManualModalOpen(false)
      setSuccessBanner(manualProvider)
      startTransition(() => {
        router.refresh()
      })
    } catch (err: unknown) {
      setManualError(err instanceof Error ? err.message : "Unexpected error saving token")
    } finally {
      setManualSubmitting(false)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm("Are you sure you want to disconnect this social integration? Scheduled posts may fail.")) {
      return
    }

    setDisconnectingId(integrationId)
    try {
      const res = await disconnectSocialIntegrationAction({ integrationId })
      if (res.success) {
        setSocialIntegrations((prev) =>
          prev.map((item) => (item.id === integrationId ? { ...item, isActive: false } : item))
        )
        startTransition(() => {
          router.refresh()
        })
      } else {
        alert(res.error || "Failed to disconnect integration")
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error disconnecting integration")
    } finally {
      setDisconnectingId(null)
    }
  }

  // ------------------------------------------
  // Tab 2: WhatsApp Meta WABA Configuration
  // ------------------------------------------
  const [whatsappAccounts, setWhatsappAccounts] = useState<SafeWhatsappAccount[]>(
    initialWhatsappAccounts
  )
  const [whatsappTemplates, setWhatsappTemplates] = useState<SafeWhatsappTemplate[]>(
    initialWhatsappTemplates
  )

  const activeWabaAccount = whatsappAccounts.find((a) => a.isActive) || whatsappAccounts[0] || null

  // WABA form state
  const [wabaName, setWabaName] = useState(activeWabaAccount?.name || "Al Ramlah Primary")
  const [wabaPhoneNumberId, setWabaPhoneNumberId] = useState(activeWabaAccount?.phoneNumberId || "")
  const [wabaId, setWabaId] = useState(activeWabaAccount?.wabaId || "")
  const [wabaDisplayPhone, setWabaDisplayPhone] = useState(
    activeWabaAccount?.displayPhoneNumber || "+92 327 4029701"
  )
  const [wabaAccessToken, setWabaAccessToken] = useState("")
  const [wabaVerifyToken, setWabaVerifyToken] = useState(
    activeWabaAccount?.webhookVerifyToken || "art_wa_token_verified"
  )
  const [wabaPin, setWabaPin] = useState("")
  const [wabaIsDefault, setWabaIsDefault] = useState(true)

  const [isSavingWaba, setIsSavingWaba] = useState(false)
  const [wabaFeedback, setWabaFeedback] = useState<{
    success?: boolean
    message?: string
  } | null>(null)

  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)

  const handleSaveWabaAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setWabaFeedback(null)

    if (!wabaPhoneNumberId.trim()) {
      setWabaFeedback({ success: false, message: "Phone Number ID is required" })
      return
    }
    if (!wabaId.trim()) {
      setWabaFeedback({ success: false, message: "WABA Account ID is required" })
      return
    }
    if (!wabaDisplayPhone.trim()) {
      setWabaFeedback({ success: false, message: "Display Phone Number is required" })
      return
    }
    if (!wabaAccessToken.trim()) {
      setWabaFeedback({ success: false, message: "Meta System User Access Token is required" })
      return
    }

    setIsSavingWaba(true)
    try {
      const res = await upsertWhatsappAccountAction({
        id: activeWabaAccount?.id,
        name: wabaName.trim(),
        phoneNumberId: wabaPhoneNumberId.trim(),
        wabaId: wabaId.trim(),
        displayPhoneNumber: wabaDisplayPhone.trim(),
        accessToken: wabaAccessToken.trim(),
        webhookVerifyToken: wabaVerifyToken.trim() || "art_wa_token_default",
        pin: wabaPin.trim() || undefined,
        isActive: true,
        isDefault: wabaIsDefault,
      })

      if (res && res.success) {
        setWabaFeedback({
          success: true,
          message: "WhatsApp Business Account credentials verified and saved successfully!",
        })
        setWabaAccessToken("") // Clear token from memory
        startTransition(() => {
          router.refresh()
        })
      } else {
        setWabaFeedback({
          success: false,
          message: "Failed to save WhatsApp account credentials",
        })
      }
    } catch (err) {
      setWabaFeedback({
        success: false,
        message: err instanceof Error ? err.message : "Error saving WhatsApp account",
      })
    } finally {
      setIsSavingWaba(false)
    }
  }

  const handleSyncTemplates = async () => {
    if (!activeWabaAccount) {
      setSyncFeedback("Please connect a WhatsApp account before syncing templates.")
      return
    }

    setIsSyncingTemplates(true)
    setSyncFeedback(null)

    try {
      const res = await syncWhatsappTemplatesAction(activeWabaAccount.id)
      if (res.success) {
        setSyncFeedback(`Successfully synchronized Meta message templates!`)
        startTransition(() => {
          router.refresh()
        })
      } else {
        setSyncFeedback(`Template sync notice: ${res.error || "Could not retrieve templates from Meta"}`)
      }
    } catch (err) {
      setSyncFeedback(
        err instanceof Error ? err.message : "Error executing template sync"
      )
    } finally {
      setIsSyncingTemplates(false)
    }
  }

  // ------------------------------------------
  // Tab Counts for Navigation Pill Bar
  // ------------------------------------------
  const activeSocialCount = socialIntegrations.filter((s) => s.isActive).length
  const activeInfraCount = [
    infrastructureStatus.openRouterConfigured || infrastructureStatus.geminiConfigured,
    infrastructureStatus.r2Configured,
    infrastructureStatus.triggerConfigured,
    infrastructureStatus.gotenbergConfigured,
  ].filter(Boolean).length

  const tabCounts: Record<SettingsTabKey, string> = {
    connections: `${activeSocialCount}/5`,
    whatsapp: activeWabaAccount ? "Connected" : "Setup",
    infrastructure: `${activeInfraCount}/4`,
    agency: "Active",
    staff: `${staffUsers.length}`,
  }

  const activeMeta = TAB_CONFIG.find((t) => t.key === activeTab) || TAB_CONFIG[0]

  return (
    <div className="flex flex-col gap-6">
      {/* Hub Header */}
      <div className="flex flex-col gap-2 border-b border-border/80 pb-5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold">
            System Settings &amp; Technical Connections
          </span>
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5"
          >
            {activeSocialCount} Social Channels • {activeInfraCount}/4 Cloud Engines • {staffUsers.length} Staff
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Settings &amp; Connections Center
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl">
              Manage Core 5 social publishing OAuth accounts, Meta WhatsApp Business Cloud API credentials,
              Oracle Gotenberg PDF rendering, agency branding parameters, and administrative staff accounts.
            </p>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="mt-3 flex overflow-x-auto rounded-xl border border-border/80 bg-muted/40 p-1.5 gap-1.5 no-scrollbar">
          {TAB_CONFIG.filter((t) => !t.superAdminOnly || isSuperAdmin).map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            const badgeValue = tabCounts[tab.key]

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all cursor-pointer select-none",
                  isActive
                    ? "bg-card text-foreground shadow-xs border border-gold/40 text-primary"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-gold" : "text-muted-foreground"
                  )}
                />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {badgeValue}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Context Banner */}
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-foreground">{activeMeta.label}:</span>
          <span className="text-muted-foreground hidden sm:inline">
            {activeMeta.description}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
          ?tab={activeTab}
        </Badge>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: Core 5 Social Publishing Accounts (Postiz Native OAuth)            */}
      {/* ========================================================================= */}
      {activeTab === "connections" && (
        <div className="flex flex-col gap-6">
          {/* Success Banner when ?connected=<provider> is present */}
          {successBanner && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-950 dark:text-emerald-100 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    Social Channel Connected Successfully
                  </h4>
                  <p className="text-xs text-emerald-900/85 dark:text-emerald-200/85">
                    Your <strong className="capitalize">{successBanner}</strong> account has been authenticated and linked. Multi-channel campaign publishing and scheduled calendar hooks are active.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleDismissSuccessBanner}
                className="text-emerald-900 hover:bg-emerald-500/20"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Setup Warning / Error Banner when ?error=<msg> is present */}
          {errorBanner && (
            <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-100 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-600/15 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                    OAuth Authorization Notice
                  </h4>
                  <p className="text-xs text-amber-900/85 dark:text-amber-200/85">
                    {decodeURIComponent(errorBanner)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleDismissErrorBanner}
                className="text-amber-900 hover:bg-amber-500/20"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Social Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CORE_SOCIAL_PROVIDERS.map((provider) => {
              const Icon = provider.icon
              const integration = socialIntegrations.find(
                (item) => item.provider === provider.id && item.isActive
              )
              const isConnected = Boolean(integration)

              const isComposio = Boolean(
                integration?.metadata &&
                  (integration.metadata as Record<string, unknown>).authSource === "composio"
              )

              // Token expiration check
              const isExpired =
                integration?.tokenExpiresAt &&
                new Date(integration.tokenExpiresAt).getTime() < Date.now()

              const isExpiringSoon =
                integration?.tokenExpiresAt &&
                !isExpired &&
                new Date(integration.tokenExpiresAt).getTime() - Date.now() <
                  7 * 24 * 60 * 60 * 1000

              return (
                <Card
                  key={provider.id}
                  className={cn(
                    "flex flex-col justify-between border-border/80 transition-all hover:shadow-md",
                    isConnected ? "border-emerald-500/30 bg-card" : "bg-muted/15"
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                            provider.badgeColor
                          )}
                        >
                          <Icon className="size-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold">
                            {provider.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {provider.subtitle}
                          </p>
                        </div>
                      </div>

                      {isConnected ? (
                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-semibold border-emerald-500/40 text-emerald-700 bg-emerald-500/10 flex items-center gap-1",
                              isExpired && "border-rose-500/40 text-rose-700 bg-rose-500/10"
                            )}
                          >
                            <CheckCircle2 className="size-3" />
                            {isExpired ? "Token Expired" : "Connected"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-medium tracking-tight px-1.5 py-0",
                              isComposio
                                ? "border-purple-500/30 text-purple-700 bg-purple-500/10"
                                : "border-sky-500/30 text-sky-700 bg-sky-500/10"
                            )}
                          >
                            {isComposio ? "Managed OAuth (Composio)" : "Direct OAuth"}
                          </Badge>
                        </div>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono text-muted-foreground border-border"
                        >
                          Disconnected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="text-xs text-muted-foreground flex-1 flex flex-col justify-center">
                    {isConnected && integration ? (
                      <div className="space-y-2 rounded-lg bg-muted/40 p-3 border border-border/60">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground text-xs">
                            {integration.name}
                          </span>
                          {integration.handle && (
                            <span className="text-[11px] font-mono text-primary font-medium">
                              @{integration.handle.replace(/^@/, "")}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] space-y-1 text-muted-foreground border-t border-border/40 pt-2">
                          <div className="flex justify-between">
                            <span>Account ID:</span>
                            <span className="font-mono text-foreground">
                              {integration.internalAccountId}
                            </span>
                          </div>
                          {integration.tokenExpiresAt && (
                            <div className="flex justify-between">
                              <span>Token Status:</span>
                              <span
                                className={cn(
                                  "font-medium",
                                  isExpired
                                    ? "text-rose-600"
                                    : isExpiringSoon
                                    ? "text-amber-600"
                                    : "text-emerald-700"
                                )}
                              >
                                {isExpired
                                  ? "Expired"
                                  : `Expires ${new Date(
                                      integration.tokenExpiresAt
                                    ).toLocaleDateString()}`}
                              </span>
                            </div>
                          )}
                          {integration.lastSyncedAt && (
                            <div className="flex justify-between">
                              <span>Last Verified:</span>
                              <span>
                                {new Date(integration.lastSyncedAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/90 italic">
                        No active connection. Link via official OAuth authorization or paste a long-lived system token to enable automated campaign publishing.
                      </p>
                    )}
                  </CardContent>

                  <CardFooter className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                    {isConnected && integration ? (
                      <>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenManualModal(provider.id)}
                          className="text-xs"
                        >
                          Update Token
                        </Button>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            className="text-xs"
                            render={<a href={provider.oauthUrl} />}
                          >
                            Reconnect
                          </Button>
                          <Button
                            variant="destructive"
                            size="xs"
                            disabled={disconnectingId === integration.id}
                            onClick={() => handleDisconnect(integration.id)}
                            className="text-xs"
                          >
                            {disconnectingId === integration.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              "Disconnect"
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenManualModal(provider.id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Manual Token
                        </Button>
                        <Button
                          size="xs"
                          className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
                          render={<a href={provider.oauthUrl} />}
                        >
                          Connect via OAuth
                        </Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              )
            })}
          </div>

          {/* Paste Manual/System Token Modal Dialog */}
          <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <Key className="size-4 text-gold" />
                  Paste Manual Access Token
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Connect without OAuth by providing a long-lived Page Token, System User Token, or API Key.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSaveManualToken} className="space-y-4 py-2">
                {manualError && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-800 dark:text-rose-200">
                    {manualError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="manual-provider" className="text-xs font-semibold">
                    Target Social Channel
                  </Label>
                  <select
                    id="manual-provider"
                    value={manualProvider}
                    onChange={(e) => setManualProvider(e.target.value as SocialProviderId)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
                  >
                    {CORE_SOCIAL_PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-name" className="text-xs font-semibold">
                      Account Label *
                    </Label>
                    <Input
                      id="manual-name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="e.g. Al Ramlah Official"
                      className="text-xs h-8"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manual-handle" className="text-xs font-semibold">
                      Username / Handle
                    </Label>
                    <Input
                      id="manual-handle"
                      value={manualHandle}
                      onChange={(e) => setManualHandle(e.target.value)}
                      placeholder="@alramlahtravels"
                      className="text-xs h-8"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="manual-internal-id" className="text-xs font-semibold">
                    Internal Account / Page ID *
                  </Label>
                  <Input
                    id="manual-internal-id"
                    value={manualInternalAccountId}
                    onChange={(e) => setManualInternalAccountId(e.target.value)}
                    placeholder="e.g. 10293847561829"
                    className="text-xs h-8 font-mono"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Facebook Page ID, Instagram Business ID, or YouTube Channel ID.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="manual-access-token" className="text-xs font-semibold">
                    Long-Lived Access Token *
                  </Label>
                  <Textarea
                    id="manual-access-token"
                    value={manualAccessToken}
                    onChange={(e) => setManualAccessToken(e.target.value)}
                    placeholder="Paste permanent Meta System User token or API secret token..."
                    rows={3}
                    className="text-xs font-mono resize-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-refresh-token" className="text-xs font-semibold">
                      Refresh Token (Optional)
                    </Label>
                    <Input
                      id="manual-refresh-token"
                      value={manualRefreshToken}
                      onChange={(e) => setManualRefreshToken(e.target.value)}
                      placeholder="Optional refresh token"
                      className="text-xs h-8 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manual-expiry" className="text-xs font-semibold">
                      Token Validity (Days)
                    </Label>
                    <Input
                      id="manual-expiry"
                      type="number"
                      value={manualExpiresInDays}
                      onChange={(e) => setManualExpiresInDays(e.target.value)}
                      placeholder="60"
                      className="text-xs h-8"
                    />
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsManualModalOpen(false)}
                    disabled={manualSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={manualSubmitting}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {manualSubmitting ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        Saving Token...
                      </>
                    ) : (
                      "Save & Activate Channel"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Official Meta WhatsApp Cloud API (wacrm Native)                    */}
      {/* ========================================================================= */}
      {activeTab === "whatsapp" && (
        <div className="flex flex-col gap-6">
          {/* Webhook Callback Endpoint Banner */}
          <Card className="border-gold/40 bg-gold/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="size-5 text-gold" />
                  <CardTitle className="text-sm font-bold text-foreground">
                    Meta Webhook Receiver &amp; Challenge Endpoint
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-gold/40 text-gold">
                  wacrm Native Receiver
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                In your Meta Developer App under <strong>WhatsApp &gt; Configuration</strong>, register this Callback URL and Verify Token to receive live inbound pilgrim messages and delivery receipts.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Callback URL */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Webhook Callback URL
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                    <span className="font-mono text-xs text-foreground truncate flex-1 select-all">
                      {webhookCallbackUrl}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleCopy(webhookCallbackUrl, "webhook")}
                      title="Copy Webhook Callback URL"
                    >
                      {copiedKey === "webhook" ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Verify Token */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Webhook Verify Token
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                    <span className="font-mono text-xs text-foreground truncate flex-1 select-all">
                      {activeWabaAccount?.webhookVerifyToken || "art_wa_token_default"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        handleCopy(
                          activeWabaAccount?.webhookVerifyToken || "art_wa_token_default",
                          "verifyToken"
                        )
                      }
                      title="Copy Verify Token"
                    >
                      {copiedKey === "verifyToken" ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Quality & Live Metrics Strip (if account exists) */}
          {activeWabaAccount && (
            <Card className="border-border/80 bg-card">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700">
                      <Phone className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold text-foreground">
                          {activeWabaAccount.verifiedName || activeWabaAccount.name}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono border-emerald-500/40 text-emerald-700 bg-emerald-500/10"
                        >
                          {activeWabaAccount.displayPhoneNumber}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Phone ID: {activeWabaAccount.phoneNumberId} • WABA ID: {activeWabaAccount.wabaId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncTemplates}
                      disabled={isSyncingTemplates}
                      className="text-xs gap-1.5 border-gold/40 text-foreground hover:bg-gold/10"
                    >
                      {isSyncingTemplates ? (
                        <Loader2 className="size-3.5 animate-spin text-gold" />
                      ) : (
                        <RefreshCw className="size-3.5 text-gold" />
                      )}
                      Sync Meta Templates
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/60 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Quality Rating
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          activeWabaAccount.qualityRating === "GREEN"
                            ? "bg-emerald-500 animate-pulse"
                            : activeWabaAccount.qualityRating === "YELLOW"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        )}
                      />
                      <span className="font-semibold text-foreground">
                        {activeWabaAccount.qualityRating || "GREEN"} (Optimal)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Messaging Limit
                    </span>
                    <div className="font-semibold text-foreground">
                      {activeWabaAccount.messagingLimit || "Tier 1K (1,000/day)"}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Active Templates
                    </span>
                    <div className="font-semibold text-foreground">
                      {whatsappTemplates.length} Synced
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Status
                    </span>
                    <div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" />
                      Live &amp; Connected
                    </div>
                  </div>
                </div>

                {syncFeedback && (
                  <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-primary">
                    {syncFeedback}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Form to Connect or Update WABA Credentials */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Lock className="size-4 text-gold" />
                {activeWabaAccount ? "Update WABA Credentials" : "Connect Meta WhatsApp Cloud API"}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter your WhatsApp Business Platform credentials from Meta Business Manager. Tokens are stored encrypted at rest using AES-256-GCM.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSaveWabaAccount} className="space-y-4">
                {wabaFeedback && (
                  <div
                    className={cn(
                      "rounded-lg border p-3 text-xs",
                      wabaFeedback.success
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-100"
                    )}
                  >
                    {wabaFeedback.message}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="waba-name" className="text-xs font-semibold">
                      Account Name *
                    </Label>
                    <Input
                      id="waba-name"
                      value={wabaName}
                      onChange={(e) => setWabaName(e.target.value)}
                      placeholder="Al Ramlah Primary"
                      className="text-xs h-8"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="waba-display-phone" className="text-xs font-semibold">
                      Display Phone Number *
                    </Label>
                    <Input
                      id="waba-display-phone"
                      value={wabaDisplayPhone}
                      onChange={(e) => setWabaDisplayPhone(e.target.value)}
                      placeholder="+92 327 4029701"
                      className="text-xs h-8"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="waba-phone-id" className="text-xs font-semibold">
                      Phone Number ID *
                    </Label>
                    <Input
                      id="waba-phone-id"
                      value={wabaPhoneNumberId}
                      onChange={(e) => setWabaPhoneNumberId(e.target.value)}
                      placeholder="e.g. 108394829103847"
                      className="text-xs h-8 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="waba-account-id" className="text-xs font-semibold">
                      WABA Account ID *
                    </Label>
                    <Input
                      id="waba-account-id"
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      placeholder="e.g. 938472910482710"
                      className="text-xs h-8 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="waba-verify-token" className="text-xs font-semibold">
                      Custom Webhook Verify Token
                    </Label>
                    <Input
                      id="waba-verify-token"
                      value={wabaVerifyToken}
                      onChange={(e) => setWabaVerifyToken(e.target.value)}
                      placeholder="art_wa_token_verified"
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="waba-access-token" className="text-xs font-semibold">
                      Meta Permanent System User Access Token *
                    </Label>
                    <Input
                      id="waba-access-token"
                      type="password"
                      value={wabaAccessToken}
                      onChange={(e) => setWabaAccessToken(e.target.value)}
                      placeholder="EAAB..."
                      className="text-xs h-8 font-mono"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Generated under Meta Business Settings &gt; System Users &gt; WhatsApp Business Messaging.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="waba-pin" className="text-xs font-semibold">
                      Two-Step Verification PIN (Optional)
                    </Label>
                    <Input
                      id="waba-pin"
                      type="password"
                      maxLength={6}
                      value={wabaPin}
                      onChange={(e) => setWabaPin(e.target.value)}
                      placeholder="6-digit PIN"
                      className="text-xs h-8 font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Required only if 2-step verification is active on the line.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={wabaIsDefault}
                      onChange={(e) => setWabaIsDefault(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary size-4"
                    />
                    <span>Set as Primary Dispatch WhatsApp Account</span>
                  </label>

                  <Button
                    type="submit"
                    disabled={isSavingWaba}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
                  >
                    {isSavingWaba ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        Verifying &amp; Saving...
                      </>
                    ) : (
                      "Save &amp; Verify WABA Credentials"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Synced Templates Strip */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Synchronized Meta Message Templates ({whatsappTemplates.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Approved templates available for 24-hour window re-engagement and broadcast campaigns.
                </p>
              </div>
            </div>

            {whatsappTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                <FileText className="mx-auto size-8 text-muted-foreground/60 mb-2" />
                <p className="font-semibold text-foreground">No Message Templates Synced Yet</p>
                <p className="mt-1">
                  Click the <strong>Sync Meta Templates</strong> button above to pull down pre-approved utility and marketing templates from Meta.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {whatsappTemplates.map((template) => (
                  <Card key={template.id} className="border-border/70 text-xs">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-xs font-bold font-mono">
                            {template.name}
                          </CardTitle>
                          <span className="text-[10px] text-muted-foreground">
                            {template.language} • {template.category}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold",
                            template.status === "APPROVED"
                              ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/10"
                              : template.status === "PENDING"
                              ? "border-amber-500/40 text-amber-700 bg-amber-500/10"
                              : "border-rose-500/40 text-rose-700 bg-rose-500/10"
                          )}
                        >
                          {template.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-[11px] text-muted-foreground line-clamp-3">
                      {template.bodyText}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Cloud Infrastructure Status                                        */}
      {/* ========================================================================= */}
      {activeTab === "infrastructure" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Multimodal AI Extraction Gateway */}
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-700">
                      <Sparkles className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        Multimodal AI Extraction Gateway
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Google Gemini (3.8 / 3.5 Flash Primary) &amp; OpenRouter Secondary
                      </CardDescription>
                    </div>
                  </div>
                  {infrastructureStatus.openRouterConfigured || infrastructureStatus.geminiConfigured ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-700 bg-emerald-500/10 text-[10px] font-semibold"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-amber-700 bg-amber-500/10 text-[10px] font-mono"
                    >
                      Missing Keys
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-3 pt-2">
                <p className="text-muted-foreground">
                  Drives multimodal flyer analysis inside Studio Hub: automatically parses Urdu/English WhatsApp texts, dates, airlines, Makkah/Madinah hotels, and quad/triple/double sharing tariffs.
                </p>
                <div className="rounded-lg bg-muted/40 p-3 border border-border/60 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span>GOOGLE_GENERATIVE_AI_API_KEY:</span>
                    <span
                      className={
                        infrastructureStatus.geminiConfigured
                          ? "text-emerald-700 font-semibold"
                          : "text-amber-700"
                      }
                    >
                      {infrastructureStatus.geminiConfigured ? "Configured ✓" : "Not Set"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>OPENROUTER_API_KEY:</span>
                    <span
                      className={
                        infrastructureStatus.openRouterConfigured
                          ? "text-emerald-700 font-semibold"
                          : "text-amber-700"
                      }
                    >
                      {infrastructureStatus.openRouterConfigured ? "Configured ✓" : "Not Set"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Cloudflare R2 Object Storage */}
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-700">
                      <Cloud className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        Cloudflare R2 Object Storage
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        S3-Compatible High Performance Storage (Zero Egress Fees)
                      </CardDescription>
                    </div>
                  </div>
                  {infrastructureStatus.r2Configured ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-700 bg-emerald-500/10 text-[10px] font-semibold"
                    >
                      Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-amber-700 bg-amber-500/10 text-[10px] font-mono"
                    >
                      Local Fallback
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-3 pt-2">
                <p className="text-muted-foreground">
                  Stores raw supplier PDFs, presigned flyer uploads, 4K multi-package sheets, spotlight posters, and generated 3-page luxury vector PDF itineraries.
                </p>
                <div className="rounded-lg bg-muted/40 p-3 border border-border/60 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span>R2_BUCKET_NAME &amp; Credentials:</span>
                    <span
                      className={
                        infrastructureStatus.r2Configured
                          ? "text-emerald-700 font-semibold"
                          : "text-amber-700"
                      }
                    >
                      {infrastructureStatus.r2Configured ? "Connected ✓" : "Local Mode"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage Engine:</span>
                    <span className="text-foreground">
                      {infrastructureStatus.r2Configured
                        ? "Production Cloudflare R2"
                        : "Local Disk / Dev Mode"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Trigger.dev Cloud Durable Background Jobs */}
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700">
                      <Activity className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        Trigger.dev Cloud Scheduler
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Durable Background Jobs, 4-Hour Post Hooks &amp; Outreach Cooldowns
                      </CardDescription>
                    </div>
                  </div>
                  {infrastructureStatus.triggerConfigured ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-700 bg-emerald-500/10 text-[10px] font-semibold"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-amber-700 bg-amber-500/10 text-[10px] font-mono"
                    >
                      Sync Fallback
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-3 pt-2">
                <p className="text-muted-foreground">
                  Executes the two-step marketing campaign hook (publishes single package spotlight immediately, delays multi-package sheet by 4 hours) and maintains 14-day pilgrim contact cooldowns.
                </p>
                <div className="rounded-lg bg-muted/40 p-3 border border-border/60 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span>TRIGGER_SECRET_KEY:</span>
                    <span
                      className={
                        infrastructureStatus.triggerConfigured
                          ? "text-emerald-700 font-semibold"
                          : "text-amber-700"
                      }
                    >
                      {infrastructureStatus.triggerConfigured ? "Authenticated ✓" : "Local Runner"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4. Oracle Cloud Gotenberg PDF Engine */}
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-gold/15 border border-gold/40 text-gold">
                      <Server className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        Oracle Gotenberg PDF Engine
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        ARM64 Ampere A1 (Gotenberg 8 + Caddy 2 HTTPS TLS)
                      </CardDescription>
                    </div>
                  </div>
                  {infrastructureStatus.gotenbergConfigured ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-700 bg-emerald-500/10 text-[10px] font-semibold"
                    >
                      Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-amber-700 bg-amber-500/10 text-[10px] font-mono"
                    >
                      Local Chromium
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-3 pt-2">
                <p className="text-muted-foreground">
                  Converts Al Ramlah Travels quotation worksheets into official 3-page luxury vector PDF itineraries with custom Arabic typography and metallic gold borders.
                </p>
                <div className="rounded-lg bg-muted/40 p-3 border border-border/60 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span>GOTENBERG_API_URL:</span>
                    <span
                      className={
                        infrastructureStatus.gotenbergConfigured
                          ? "text-emerald-700 font-semibold"
                          : "text-amber-700"
                      }
                    >
                      {infrastructureStatus.gotenbergConfigured ? "Connected ✓" : "Local Chromium"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Oracle Cloud Always Free Setup Pointer Card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="size-5 text-primary" />
                  <CardTitle className="text-base font-bold text-foreground">
                    Oracle Cloud Always Free Deployment Setup
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold border-gold/50 text-gold bg-gold/10"
                >
                  $0.00 / month forever
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Run an enterprise Gotenberg 8 PDF conversion microservice fully covered by Oracle Cloud Always Free tier (4 OCPU, 24 GB RAM, 200 GB SSD) with automated Let&apos;s Encrypt TLS.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="font-semibold text-foreground">1. Setup Script</div>
                  <div className="text-[11px] font-mono text-primary mt-1">
                    scripts/oracle-gotenberg/setup-oracle-arm.sh
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Turnkey bootstrap script: configures Docker, fixes Ubuntu iptables &amp; starts Caddy.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="font-semibold text-foreground">2. Docker Compose</div>
                  <div className="text-[11px] font-mono text-primary mt-1">
                    scripts/oracle-gotenberg/docker-compose.yml
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Multi-container bundle (Gotenberg 8 + Caddy 2) tuned for ARM64 Ampere A1.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="font-semibold text-foreground">3. Caddy Reverse Proxy</div>
                  <div className="text-[11px] font-mono text-primary mt-1">
                    scripts/oracle-gotenberg/Caddyfile
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Automated TLS, X-Gotenberg-Api-Key authentication &amp; public /health route.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="font-semibold text-foreground">4. Documentation</div>
                  <div className="text-[11px] font-mono text-primary mt-1">
                    scripts/oracle-gotenberg/README.md
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Complete architecture walkthrough, VCN security rules &amp; healthchecks.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-card p-3 border border-border/80 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-semibold text-foreground text-xs">
                    Deployment Documentation Guide:
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Follow the step-by-step instructions in <code>scripts/oracle-gotenberg/README.md</code> to deploy to Oracle Cloud in under 10 minutes.
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  ARM64 Ampere A1
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: Agency Parameters & Defaults                                       */}
      {/* ========================================================================= */}
      {activeTab === "agency" && (
        <div className="min-h-[500px]">
          <SettingsClient initialSettings={agencySettings} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: Staff Accounts & RBAC (Super Admin Only)                           */}
      {/* ========================================================================= */}
      {activeTab === "staff" && (
        <div className="min-h-[500px]">
          {isSuperAdmin ? (
            <UsersClient
              initialUsers={staffUsers}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ) : (
            <Card className="border-rose-500/30 bg-rose-500/5 p-8 text-center">
              <ShieldAlert className="mx-auto size-10 text-rose-600 mb-3" />
              <CardTitle className="text-lg font-bold text-foreground">
                Access Restricted to Super Administrators
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground max-w-md mx-auto mt-2">
                Managing staff accounts, role-based access control, and password resets requires elevated <code>super_admin</code> privileges.
              </CardDescription>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
