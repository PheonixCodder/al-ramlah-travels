"use client"

import * as React from "react"
import {
  useState,
  useTransition,
  useMemo,
  useEffect,
  useSyncExternalStore,
} from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Share2,
  MessageCircle,
  Cpu,
  Building2,
  Shield,
  CheckCircle2,
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
  Radio,
  Sparkles,
  Activity,
  ShieldAlert,
  Loader2,
  Trash2,
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
} from "@/components/ui/dialog"

import {
  SettingsClient,
  type AgencySettingsData,
} from "@/components/admin/catalog/settings-client"
import { WhatsappLinkedDeviceCard } from "@/components/admin/whatsapp/whatsapp-linked-device-card"
import {
  UsersClient,
  type UserAccountData,
} from "@/components/admin/catalog/users-client"
import {
  saveSettingsWhatsappAccountAction,
  syncSettingsWhatsappTemplatesAction,
  createSettingsWhatsappTemplateAction,
  deleteSettingsWhatsappTemplateAction,
  disconnectSettingsSocialIntegrationAction,
  saveSettingsManualSocialIntegrationAction,
  selectSettingsSocialAccountCandidateAction,
  refreshSettingsSocialTokenAction,
} from "@/app/actions/catalog"
import {
  getPendingSocialAccountCandidatesAction,
  type SafeSocialIntegration,
} from "@/app/actions/social-scheduler"
import type {
  SafeSocialAccountCandidate,
  SocialProviderId,
} from "@/lib/social/types"
import {
  resolveSettingsTab,
  type SettingsTabKey,
} from "@/components/admin/settings/safe-settings-dto"
import type { ConfigHealthSnapshot } from "@/components/admin/settings/config-health"
import { ConfigHealthPanel } from "@/components/admin/settings/config-health-panel"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"
import { cn } from "@/lib/utils"

// ==========================================
// Types
// ==========================================

export type { SettingsTabKey }

export interface SafeWhatsappAccount {
  id: string
  name: string
  phoneNumberId: string
  wabaId: string
  displayPhoneNumber: string
  verifiedName: string | null
  qualityRating: string | null
  messagingLimit: string | null
  hasAccessToken?: boolean
  hasVerifyToken: boolean
  verifyTokenPreview: string | null
  isActive: boolean
  isDefault: boolean
  accountRole?: string | null
  isOnBizApp?: boolean | null
  platformType?: string | null
  intentFilterEnabled?: boolean | null
  embeddedSignupConfigId?: string | null
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
  oauthSelectProvider?: string
  pendingIntegrationId?: string
  agencySettings: AgencySettingsData | null
  socialIntegrations: SafeSocialIntegration[]
  whatsappAccounts: SafeWhatsappAccount[]
  whatsappTemplates: SafeWhatsappTemplate[]
  infrastructureStatus: SafeInfrastructureStatus
  configHealth?: ConfigHealthSnapshot
  staffUsers: UserAccountData[]
  currentUserId: string
  currentUserRole: string
  initialNowMs?: number
}

// ==========================================
// Custom SVG Icons for Core 5 Social Providers
// ==========================================

function InstagramIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
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
      aria-hidden="true"
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
      aria-hidden="true"
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
      aria-hidden="true"
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
      aria-hidden="true"
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
}

const CORE_SOCIAL_PROVIDERS: SocialProviderMeta[] = [
  {
    id: "instagram",
    name: "Instagram Business",
    subtitle:
      "Single spotlights, multi-package carousel sheets & Umrah story cards",
    icon: InstagramIcon,
    badgeColor: "bg-accent/60 text-gold-text border-gold-border",
    oauthUrl: "/api/oauth/social/instagram",
  },
  {
    id: "facebook",
    name: "Facebook Pages",
    subtitle: "Promotional packages, departure announcements & flyer brochures",
    icon: FacebookIcon,
    badgeColor: "bg-status-info-bg text-status-info border-status-info-border",
    oauthUrl: "/api/oauth/social/facebook",
  },
  {
    id: "tiktok",
    name: "TikTok Business",
    subtitle: "Vertical video reels, hotel room tours & pilgrim essential tips",
    icon: TikTokIcon,
    badgeColor: "bg-secondary text-foreground border-border",
    oauthUrl: "/api/oauth/social/tiktok",
  },
  {
    id: "youtube",
    name: "YouTube Channel",
    subtitle: "Full video walkthroughs, departure guides & YouTube Shorts",
    icon: YouTubeIcon,
    badgeColor:
      "bg-status-danger-bg text-status-danger border-status-danger-border",
    oauthUrl: "/api/oauth/social/youtube",
  },
  {
    id: "gmb",
    name: "Google Business Profile",
    subtitle: "Google Maps local updates, call-to-actions & package offerings",
    icon: GoogleMapsIcon,
    badgeColor:
      "bg-status-success-bg text-status-success border-status-success-border",
    oauthUrl: "/api/oauth/social/gmb",
  },
]

const subscribeToOrigin = () => () => {}
const getClientOriginSnapshot = () =>
  typeof window !== "undefined" ? window.location.origin : ""

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
    description:
      "Core 5 social publishing accounts with native OAuth & publishing bridge",
  },
  {
    key: "whatsapp",
    label: "WhatsApp Cloud API",
    icon: MessageCircle,
    description:
      "Connected WhatsApp phones, official Meta Cloud API & template sync",
  },
  {
    key: "infrastructure",
    label: "Cloud Infrastructure",
    icon: Cpu,
    description:
      "Cloud background tasks, Cloudflare R2 media storage, Multimodal AI & 4K PDF render engine",
  },
  {
    key: "agency",
    label: "Agency Parameters",
    icon: Building2,
    description:
      "Official agency branding, regulatory licenses, banking IBAN governance, SLA thresholds & SAR rate",
  },
  {
    key: "health",
    label: "Config Health",
    icon: Activity,
    description:
      "Zero-secret readiness checks for PostgreSQL, R2, Gotenberg, Resend, WABA, Social OAuth & Trigger.dev",
  },
  {
    key: "staff",
    label: "Staff & RBAC",
    icon: Shield,
    description:
      "Administrative staff accounts, role-based access control, active status & password resets",
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
  oauthSelectProvider,
  pendingIntegrationId,
  agencySettings,
  socialIntegrations: initialSocialIntegrations,
  whatsappAccounts: initialWhatsappAccounts,
  whatsappTemplates: initialWhatsappTemplates,
  infrastructureStatus,
  configHealth,
  staffUsers,
  currentUserId,
  currentUserRole,
  initialNowMs = 0,
}: ConnectionsSettingsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isSuperAdmin = currentUserRole === "super_admin"

  const [nowMs, setNowMs] = useState<number>(initialNowMs)
  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // URL state synchronization (`?tab=waba|devices|social|gotenberg|users|health|agency`)
  const activeTab: SettingsTabKey = useMemo(() => {
    return resolveSettingsTab(searchParams.get("tab"), initialTab)
  }, [searchParams, initialTab])

  const handleTabChange = (key: SettingsTabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Banners for OAuth callback feedback
  const urlConnected =
    searchParams.get("connected") || connectedProvider || null
  const urlErr = searchParams.get("error") || urlError || null
  const [dismissedConnected, setDismissedConnected] = useState<string | null>(
    null
  )
  const [dismissedUrlError, setDismissedUrlError] = useState<string | null>(
    null
  )
  const [localSuccessBanner, setLocalSuccessBanner] = useState<string | null>(
    null
  )
  const [localErrorBanner, setLocalErrorBanner] = useState<string | null>(null)

  const successBanner =
    localSuccessBanner ??
    (urlConnected && dismissedConnected !== urlConnected ? urlConnected : null)
  const errorBanner =
    localErrorBanner ?? (urlErr && dismissedUrlError !== urlErr ? urlErr : null)

  const setSuccessBanner = setLocalSuccessBanner
  const setErrorBanner = setLocalErrorBanner

  const handleDismissSuccessBanner = () => {
    setLocalSuccessBanner(null)
    if (urlConnected) setDismissedConnected(urlConnected)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("connected")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleDismissErrorBanner = () => {
    setLocalErrorBanner(null)
    if (urlErr) setDismissedUrlError(urlErr)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("error")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Origin for Webhook Callback URL
  const origin =
    useSyncExternalStore(
      subscribeToOrigin,
      getClientOriginSnapshot,
      () => infrastructureStatus.appUrl || ""
    ) ||
    infrastructureStatus.appUrl ||
    ""
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
  // Tab 1: Social Connections, Multi-Account OAuth Selector & Manual Modal
  // ------------------------------------------
  const [socialIntegrations, setSocialIntegrations] = useState<
    SafeSocialIntegration[]
  >(initialSocialIntegrations)
  const [prevInitialSocial, setPrevInitialSocial] = useState(
    initialSocialIntegrations
  )
  if (prevInitialSocial !== initialSocialIntegrations) {
    setPrevInitialSocial(initialSocialIntegrations)
    setSocialIntegrations(initialSocialIntegrations)
  }

  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [manualProvider, setManualProvider] =
    useState<SocialProviderId>("instagram")
  const [manualName, setManualName] = useState("")
  const [manualHandle, setManualHandle] = useState("")
  const [manualInternalAccountId, setManualInternalAccountId] = useState("")
  const [manualAccessToken, setManualAccessToken] = useState("")
  const [manualRefreshToken, setManualRefreshToken] = useState("")
  const [manualExpiresInDays, setManualExpiresInDays] = useState("60")
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [refreshingTokenId, setRefreshingTokenId] = useState<string | null>(
    null
  )
  const [isSweepingTokens, setIsSweepingTokens] = useState(false)
  const [, startTransition] = useTransition()

  // Multi-Account OAuth Selector Modal State
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false)
  const [candidateProvider, setCandidateProvider] =
    useState<SocialProviderId | null>(null)
  const [candidateIntegrationId, setCandidateIntegrationId] = useState<
    string | undefined
  >(pendingIntegrationId)
  const [pendingCandidates, setPendingCandidates] = useState<
    SafeSocialAccountCandidate[]
  >([])
  const [selectedCandidateInternalId, setSelectedCandidateInternalId] =
    useState<string>("")
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [isSelectingCandidate, setIsSelectingCandidate] = useState(false)
  const [candidateError, setCandidateError] = useState<string | null>(null)

  const handleOpenCandidateSelector = React.useCallback(
    async (providerId?: SocialProviderId, integrationId?: string) => {
      setIsCandidateModalOpen(true)
      setIsLoadingCandidates(true)
      setCandidateError(null)
      if (providerId) setCandidateProvider(providerId)
      if (integrationId) setCandidateIntegrationId(integrationId)

      try {
        const res = await getPendingSocialAccountCandidatesAction({
          provider: providerId,
          integrationId,
        })
        if (res.success && res.candidates && res.candidates.length > 0) {
          setPendingCandidates(res.candidates)
          setSelectedCandidateInternalId(res.candidates[0]!.internalAccountId)
          if (res.provider) setCandidateProvider(res.provider)
          if (res.integrationId) setCandidateIntegrationId(res.integrationId)
        } else {
          setPendingCandidates([])
          setCandidateError(
            res.error ||
              "No pending multi-account OAuth candidates found. Try reconnecting via OAuth."
          )
        }
      } catch (err: unknown) {
        setCandidateError(
          err instanceof Error
            ? err.message
            : "Failed to load OAuth account candidates"
        )
      } finally {
        setIsLoadingCandidates(false)
      }
    },
    []
  )

  // Auto-open candidate selector if redirected from OAuth callback (?oauth_select= or ?selectAccount=)
  useEffect(() => {
    if (!isSuperAdmin) return

    const urlSelect =
      searchParams.get("oauth_select") ||
      searchParams.get("selectAccount") ||
      oauthSelectProvider
    const urlIntId = searchParams.get("integrationId") || pendingIntegrationId

    const pendingRow = !urlSelect
      ? socialIntegrations.find((row) => row.status === "PENDING_SELECTION")
      : undefined

    const targetProvider = (urlSelect || pendingRow?.provider) as
      SocialProviderId | undefined
    const targetIntId = urlSelect ? urlIntId || undefined : pendingRow?.id

    if (!targetProvider) return

    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setCandidateProvider(targetProvider)
      if (targetIntId) setCandidateIntegrationId(targetIntId)
      setCandidateError(null)
      setIsLoadingCandidates(true)
      setIsCandidateModalOpen(true)

      try {
        const res = await getPendingSocialAccountCandidatesAction({
          provider: targetProvider,
          integrationId: targetIntId,
        })
        if (cancelled) return
        if (res.success && res.candidates && res.candidates.length > 0) {
          setPendingCandidates(res.candidates)
          setSelectedCandidateInternalId(res.candidates[0]!.internalAccountId)
          if (res.provider) setCandidateProvider(res.provider)
          if (res.integrationId) setCandidateIntegrationId(res.integrationId)
        } else {
          setPendingCandidates([])
          setCandidateError(
            res.error ||
              "No pending multi-account OAuth candidates found. Try reconnecting via OAuth."
          )
        }
      } catch (err: unknown) {
        if (cancelled) return
        setCandidateError(
          err instanceof Error
            ? err.message
            : "Failed to load OAuth account candidates"
        )
      } finally {
        if (!cancelled) {
          setIsLoadingCandidates(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    isSuperAdmin,
    searchParams,
    oauthSelectProvider,
    pendingIntegrationId,
    socialIntegrations,
  ])

  const handleConfirmCandidateSelection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCandidateInternalId) {
      setCandidateError(
        "Please select an account, page, or location to activate."
      )
      return
    }

    setIsSelectingCandidate(true)
    setCandidateError(null)

    try {
      const res = await selectSettingsSocialAccountCandidateAction({
        provider: candidateProvider ?? undefined,
        integrationId: candidateIntegrationId,
        internalAccountId: selectedCandidateInternalId,
      })

      if (!res.success) {
        setCandidateError(res.error || "Failed to activate selected account")
        return
      }

      setIsCandidateModalOpen(false)
      setSuccessBanner(candidateProvider || "social")

      // Clean OAuth selector query params from URL
      const params = new URLSearchParams(searchParams.toString())
      params.delete("oauth_select")
      params.delete("selectAccount")
      params.delete("integrationId")
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })

      startTransition(() => {
        router.refresh()
      })
    } catch (err: unknown) {
      setCandidateError(
        err instanceof Error
          ? err.message
          : "Unexpected error activating selected account"
      )
    } finally {
      setIsSelectingCandidate(false)
    }
  }

  const handleRefreshSingleToken = async (integrationId: string) => {
    setRefreshingTokenId(integrationId)
    try {
      const res = await refreshSettingsSocialTokenAction({ integrationId })
      if (res.success) {
        startTransition(() => {
          router.refresh()
        })
      } else {
        setErrorBanner(
          res.error || "Token refresh failed. Please reconnect via OAuth."
        )
      }
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Error refreshing token"
      )
    } finally {
      setRefreshingTokenId(null)
    }
  }

  const handleSweepExpiringTokens = async () => {
    setIsSweepingTokens(true)
    try {
      const res = await refreshSettingsSocialTokenAction({ withinHours: 168 })
      if (res.success) {
        startTransition(() => {
          router.refresh()
        })
      } else {
        setErrorBanner(
          res.error || "Proactive token sweep encountered an issue"
        )
      }
    } finally {
      setIsSweepingTokens(false)
    }
  }

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
      const result = await saveSettingsManualSocialIntegrationAction({
        provider: manualProvider,
        name: manualName.trim() || `Al Ramlah ${manualProvider}`,
        handle: manualHandle.trim() || undefined,
        internalAccountId: manualInternalAccountId.trim(),
        accessToken: manualAccessToken.trim(),
        refreshToken: manualRefreshToken.trim() || undefined,
        tokenExpiresInDays: manualExpiresInDays
          ? parseInt(manualExpiresInDays, 10)
          : undefined,
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
      setManualError(
        err instanceof Error ? err.message : "Unexpected error saving token"
      )
    } finally {
      setManualSubmitting(false)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    if (
      !confirm(
        "Are you sure you want to disconnect this social integration? Scheduled posts may fail."
      )
    ) {
      return
    }

    setDisconnectingId(integrationId)
    try {
      const res = await disconnectSettingsSocialIntegrationAction({
        integrationId,
      })
      if (res.success) {
        setSocialIntegrations((prev) =>
          prev.map((item) =>
            item.id === integrationId ? { ...item, isActive: false } : item
          )
        )
        startTransition(() => {
          router.refresh()
        })
      } else {
        alert(res.error || "Failed to disconnect integration")
      }
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Error disconnecting integration"
      )
    } finally {
      setDisconnectingId(null)
    }
  }

  // ------------------------------------------
  // Tab 2: WhatsApp Meta WABA Configuration (Dual-Line: Coexistence + Dedicated Agent)
  // ------------------------------------------
  const [whatsappAccounts, setWhatsappAccounts] = useState<
    SafeWhatsappAccount[]
  >(initialWhatsappAccounts)
  const [whatsappTemplates, setWhatsappTemplates] = useState<
    SafeWhatsappTemplate[]
  >(initialWhatsappTemplates)
  const [prevInitialWaAccounts, setPrevInitialWaAccounts] = useState(
    initialWhatsappAccounts
  )
  if (prevInitialWaAccounts !== initialWhatsappAccounts) {
    setPrevInitialWaAccounts(initialWhatsappAccounts)
    setWhatsappAccounts(initialWhatsappAccounts)
  }
  const [prevInitialWaTemplates, setPrevInitialWaTemplates] = useState(
    initialWhatsappTemplates
  )
  if (prevInitialWaTemplates !== initialWhatsappTemplates) {
    setPrevInitialWaTemplates(initialWhatsappTemplates)
    setWhatsappTemplates(initialWhatsappTemplates)
  }

  // Meta Template Builder & Deletion States (Spec 0019 AC-6)
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false)
  const [templateNameInput, setTemplateNameInput] = useState("")
  const [templateCategoryInput, setTemplateCategoryInput] = useState<
    "MARKETING" | "UTILITY"
  >("MARKETING")
  const [templateLanguageInput, setTemplateLanguageInput] = useState("en_US")
  const [templateHeaderTypeInput, setTemplateHeaderTypeInput] = useState<
    "NONE" | "TEXT" | "IMAGE" | "DOCUMENT"
  >("NONE")
  const [templateHeaderTextInput, setTemplateHeaderTextInput] = useState("")
  const [templateBodyTextInput, setTemplateBodyTextInput] = useState("")
  const [templateFooterTextInput, setTemplateFooterTextInput] = useState("")
  const [templateButtonsInput, setTemplateButtonsInput] = useState<
    Array<{
      type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"
      text: string
      url?: string
      phone_number?: string
    }>
  >([])
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)
  const [createTemplateError, setCreateTemplateError] = useState<string | null>(
    null
  )

  const [templateToDelete, setTemplateToDelete] =
    useState<SafeWhatsappTemplate | null>(null)
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false)

  const [selectedWabaId, setSelectedWabaId] = useState<
    string | "NEW_DEDICATED"
  >(
    initialWhatsappAccounts.find((a) => a.isActive)?.id ||
      initialWhatsappAccounts[0]?.id ||
      "NEW_DEDICATED"
  )

  const activeWabaAccount =
    selectedWabaId === "NEW_DEDICATED"
      ? null
      : whatsappAccounts.find((a) => a.id === selectedWabaId) ||
        whatsappAccounts.find((a) => a.isActive) ||
        whatsappAccounts[0] ||
        null

  // WABA form state
  const [wabaName, setWabaName] = useState(activeWabaAccount?.name || "")
  const [wabaPhoneNumberId, setWabaPhoneNumberId] = useState(
    activeWabaAccount?.phoneNumberId || ""
  )
  const [wabaId, setWabaId] = useState(activeWabaAccount?.wabaId || "")
  const [wabaDisplayPhone, setWabaDisplayPhone] = useState(
    activeWabaAccount?.displayPhoneNumber || ""
  )
  const [wabaAccessToken, setWabaAccessToken] = useState("")
  const [wabaVerifyToken, setWabaVerifyToken] = useState(
    activeWabaAccount ? "" : "art_wa_token_verified"
  )
  const [wabaPin, setWabaPin] = useState("")
  const [wabaIsDefault, setWabaIsDefault] = useState(
    activeWabaAccount ? activeWabaAccount.isDefault : true
  )
  const [wabaAccountRole, setWabaAccountRole] = useState<
    "COEXISTENCE_FOUNDER" | "DEDICATED_AGENT" | "PRIMARY_CLOUD"
  >(
    (activeWabaAccount?.accountRole as
      "COEXISTENCE_FOUNDER" | "DEDICATED_AGENT" | "PRIMARY_CLOUD") ||
      "PRIMARY_CLOUD"
  )
  const [wabaIntentFilterEnabled, setWabaIntentFilterEnabled] =
    useState<boolean>(activeWabaAccount?.intentFilterEnabled ?? false)
  const [embeddedConfigId, setEmbeddedConfigId] = useState<string>(
    activeWabaAccount?.embeddedSignupConfigId || ""
  )

  const handleSelectAccountSlot = (
    slot: SafeWhatsappAccount | "NEW_DEDICATED"
  ) => {
    setWabaFeedback(null)
    if (slot === "NEW_DEDICATED") {
      setSelectedWabaId("NEW_DEDICATED")
      setWabaName("")
      setWabaPhoneNumberId("")
      setWabaId(whatsappAccounts[0]?.wabaId || "")
      setWabaDisplayPhone("")
      setWabaAccessToken("")
      setWabaVerifyToken("art_wa_token_verified")
      setWabaPin("")
      setWabaIsDefault(false)
      setWabaAccountRole("PRIMARY_CLOUD")
      setWabaIntentFilterEnabled(false)
    } else {
      setSelectedWabaId(slot.id)
      setWabaName(slot.name)
      setWabaPhoneNumberId(slot.phoneNumberId)
      setWabaId(slot.wabaId)
      setWabaDisplayPhone(slot.displayPhoneNumber)
      setWabaAccessToken("")
      setWabaVerifyToken("")
      setWabaPin("")
      setWabaIsDefault(slot.isDefault)
      setWabaAccountRole(
        (slot.accountRole as
          "COEXISTENCE_FOUNDER" | "DEDICATED_AGENT" | "PRIMARY_CLOUD") ||
          "COEXISTENCE_FOUNDER"
      )
      setWabaIntentFilterEnabled(slot.intentFilterEnabled ?? true)
      setEmbeddedConfigId(slot.embeddedSignupConfigId || "")
    }
  }

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
      setWabaFeedback({
        success: false,
        message: "Phone Number ID is required",
      })
      return
    }
    if (!wabaId.trim()) {
      setWabaFeedback({
        success: false,
        message: "WABA Account ID is required",
      })
      return
    }
    if (!wabaDisplayPhone.trim()) {
      setWabaFeedback({
        success: false,
        message: "Display Phone Number is required",
      })
      return
    }
    if (!activeWabaAccount && !wabaAccessToken.trim()) {
      setWabaFeedback({
        success: false,
        message: "Meta System User Access Token is required for a new account",
      })
      return
    }

    setIsSavingWaba(true)
    try {
      const res = await saveSettingsWhatsappAccountAction({
        id: activeWabaAccount?.id,
        name: wabaName.trim(),
        phoneNumberId: wabaPhoneNumberId.trim(),
        wabaId: wabaId.trim(),
        displayPhoneNumber: wabaDisplayPhone.trim(),
        accessToken: wabaAccessToken.trim() || undefined,
        webhookVerifyToken: wabaVerifyToken.trim() || undefined,
        pin: wabaPin.trim() || undefined,
        isActive: true,
        isDefault: wabaIsDefault,
        accountRole: wabaAccountRole,
        isOnBizApp: wabaAccountRole === "COEXISTENCE_FOUNDER",
        intentFilterEnabled: wabaIntentFilterEnabled,
        embeddedSignupConfigId: embeddedConfigId.trim() || null,
      })

      if (res && res.success && "accountId" in res) {
        setWabaFeedback({
          success: true,
          message:
            wabaAccountRole === "COEXISTENCE_FOUNDER"
              ? "Founder Coexistence line & AI Intent Gatekeeper settings saved!"
              : "Dedicated AI Agent WhatsApp credentials verified and saved!",
        })
        setWabaAccessToken("") // Clear token from memory
        setWabaVerifyToken("")
        setSelectedWabaId(res.accountId)
        startTransition(() => {
          router.refresh()
        })
      } else {
        setWabaFeedback({
          success: false,
          message:
            (res && "error" in res && res.error) ||
            "Failed to save WhatsApp account credentials",
        })
      }
    } catch (err) {
      setWabaFeedback({
        success: false,
        message:
          err instanceof Error ? err.message : "Error saving WhatsApp account",
      })
    } finally {
      setIsSavingWaba(false)
    }
  }

  const handleSyncTemplates = async () => {
    if (!activeWabaAccount) {
      setSyncFeedback(
        "Please connect a WhatsApp account before syncing templates."
      )
      return
    }

    setIsSyncingTemplates(true)
    setSyncFeedback(null)

    try {
      const res = await syncSettingsWhatsappTemplatesAction(
        activeWabaAccount.id
      )
      if (res.success) {
        setSyncFeedback(`Successfully synchronized Meta message templates!`)
        startTransition(() => {
          router.refresh()
        })
      } else {
        setSyncFeedback(
          `Template sync notice: ${res.error || "Could not retrieve templates from Meta"}`
        )
      }
    } catch (err) {
      setSyncFeedback(
        err instanceof Error ? err.message : "Error executing template sync"
      )
    } finally {
      setIsSyncingTemplates(false)
    }
  }

  const handleCreateTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeWabaAccount) {
      setCreateTemplateError("Please select an active WhatsApp account first.")
      return
    }

    const cleanName = templateNameInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
    if (!cleanName) {
      setCreateTemplateError(
        "Template name is required and must contain lowercase alphanumeric characters and underscores."
      )
      return
    }
    if (!templateBodyTextInput.trim()) {
      setCreateTemplateError("Template body text is required.")
      return
    }

    setIsCreatingTemplate(true)
    setCreateTemplateError(null)

    try {
      const res = await createSettingsWhatsappTemplateAction({
        accountId: activeWabaAccount.id,
        name: cleanName,
        category: templateCategoryInput,
        language: templateLanguageInput,
        headerText:
          templateHeaderTypeInput === "TEXT" && templateHeaderTextInput.trim()
            ? templateHeaderTextInput.trim()
            : undefined,
        bodyText: templateBodyTextInput.trim(),
        footerText: templateFooterTextInput.trim()
          ? templateFooterTextInput.trim()
          : undefined,
        buttons: templateButtonsInput
          .filter((b) => b.text.trim())
          .map((b) => {
            if (b.type === "URL") {
              return {
                type: "URL" as const,
                text: b.text.trim().slice(0, 25),
                url: b.url?.trim() || "https://alramlahtravels.com",
              }
            }
            if (b.type === "PHONE_NUMBER") {
              return {
                type: "PHONE_NUMBER" as const,
                text: b.text.trim().slice(0, 25),
                phone_number:
                  b.phone_number?.trim() ||
                  `+${DEFAULT_COMPANY_INFO.normalizedWhatsapp}`,
              }
            }
            return {
              type: "QUICK_REPLY" as const,
              text: b.text.trim().slice(0, 25),
            }
          }),
      })

      if (res.success) {
        setIsCreateTemplateOpen(false)
        setTemplateNameInput("")
        setTemplateBodyTextInput("")
        setTemplateHeaderTextInput("")
        setTemplateFooterTextInput("")
        setTemplateButtonsInput([])
        setSyncFeedback(
          `Successfully registered template "${cleanName}" with Meta (${res.status})!`
        )

        startTransition(async () => {
          if (activeWabaAccount.id) {
            await syncSettingsWhatsappTemplatesAction(activeWabaAccount.id)
            router.refresh()
          }
        })
      } else {
        setCreateTemplateError(
          res.error || "Failed to create template on Meta Graph API."
        )
      }
    } catch (err) {
      setCreateTemplateError(
        err instanceof Error ? err.message : "Error creating template"
      )
    } finally {
      setIsCreatingTemplate(false)
    }
  }

  const handleDeleteTemplateConfirm = async () => {
    if (!templateToDelete) return
    setIsDeletingTemplate(true)
    try {
      const res = await deleteSettingsWhatsappTemplateAction({
        accountId: templateToDelete.accountId,
        templateId: templateToDelete.id,
        name: templateToDelete.name,
      })
      if (res.success) {
        setWhatsappTemplates((prev) =>
          prev.filter((t) => t.id !== templateToDelete.id)
        )
        setSyncFeedback(
          `Template "${templateToDelete.name}" deleted successfully from Meta.`
        )
        setTemplateToDelete(null)
        startTransition(() => {
          router.refresh()
        })
      } else {
        alert(res.error || "Failed to delete template from Meta")
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting template")
    } finally {
      setIsDeletingTemplate(false)
    }
  }

  // ------------------------------------------
  // Tab Counts for Navigation Pill Bar
  // ------------------------------------------
  const activeSocialCount = socialIntegrations.filter((s) => s.isActive).length
  const activeInfraCount = [
    infrastructureStatus.openRouterConfigured ||
      infrastructureStatus.geminiConfigured,
    infrastructureStatus.r2Configured,
    infrastructureStatus.triggerConfigured,
    infrastructureStatus.gotenbergConfigured,
  ].filter(Boolean).length

  const tabCounts: Record<SettingsTabKey, string> = {
    connections: `${activeSocialCount}/5`,
    whatsapp: activeWabaAccount ? "Connected" : "Setup",
    infrastructure: `${activeInfraCount}/4`,
    agency: "Active",
    health: configHealth
      ? `${configHealth.readyCount}/${configHealth.totalSubsystems}`
      : `${activeInfraCount}/4`,
    staff: `${staffUsers.length}`,
  }

  const activeMeta =
    TAB_CONFIG.find((t) => t.key === activeTab) || TAB_CONFIG[0]

  return (
    <div className="flex flex-col gap-6">
      {/* Hub Header */}
      <div className="flex flex-col gap-2 border-b border-border/80 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Settings &amp; Connections Center
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground sm:text-sm">
              Manage Core 5 social publishing OAuth accounts, Meta WhatsApp
              Business Cloud API credentials, Oracle Gotenberg PDF rendering,
              agency branding parameters, and administrative staff accounts.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-gold-border bg-accent/40 text-[11px] font-medium text-gold-text"
              >
                System Settings &amp; Technical Connections
              </Badge>
              <Badge
                variant="outline"
                className="border-primary/25 bg-primary/5 font-mono text-[11px] text-primary tabular-nums"
              >
                {activeSocialCount} Social Channels
              </Badge>
              <Badge
                variant="outline"
                className="border-primary/25 bg-primary/5 font-mono text-[11px] text-primary tabular-nums"
              >
                {activeInfraCount}/4 Cloud Engines
              </Badge>
              <Badge
                variant="outline"
                className="border-primary/25 bg-primary/5 font-mono text-[11px] text-primary tabular-nums"
              >
                {staffUsers.length} Staff
              </Badge>
            </div>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div
          tabIndex={0}
          className="mt-3 no-scrollbar flex gap-1.5 overflow-x-auto rounded-xl border border-border/80 bg-muted/40 p-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {TAB_CONFIG.filter((t) => !t.superAdminOnly || isSuperAdmin).map(
            (tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              const badgeValue = tabCounts[tab.key]

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
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
                  <span
                    className={cn(
                      "ml-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {badgeValue}
                  </span>
                </button>
              )
            }
          )}
        </div>
      </div>

      {/* Tab Context Banner */}
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-foreground">
            {activeMeta.label}:
          </span>
          <span className="hidden text-muted-foreground sm:inline">
            {activeMeta.description}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "connections" && activeSocialCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={isSweepingTokens}
              onClick={handleSweepExpiringTokens}
              className="h-6 cursor-pointer gap-1 border-gold-border text-[11px] font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {isSweepingTokens ? (
                <Loader2
                  className="size-3 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <RefreshCw
                  className="size-3 text-gold-text"
                  aria-hidden="true"
                />
              )}
              <span>Refresh Expiring Tokens</span>
            </Button>
          )}
          <Badge
            variant="outline"
            className="font-mono text-[11px] text-muted-foreground"
          >
            ?tab={activeTab}
          </Badge>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: Core 5 Social Publishing Accounts (Native OAuth)                   */}
      {/* ========================================================================= */}
      {activeTab === "connections" && (
        <div className="flex flex-col gap-6">
          {/* Success Banner when ?connected=<provider> is present */}
          {successBanner && (
            <div className="flex items-center justify-between rounded-xl border border-status-success-border bg-status-success-bg p-4 text-foreground shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-status-success/15 text-status-success">
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-status-success">
                    Social Channel Connected Successfully
                  </h4>
                  <p className="text-xs text-foreground/85">
                    Your <strong className="capitalize">{successBanner}</strong>{" "}
                    account has been authenticated and linked. Multi-channel
                    campaign publishing and scheduled calendar hooks are active.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleDismissSuccessBanner}
                className="cursor-pointer text-status-success hover:bg-status-success/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Setup Warning / Error Banner when ?error=<msg> is present */}
          {errorBanner && (
            <div className="flex items-center justify-between rounded-xl border border-status-warning-border bg-status-warning-bg p-4 text-foreground shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-status-warning/15 text-status-warning">
                  <AlertTriangle className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-status-warning">
                    OAuth Authorization Notice
                  </h4>
                  <p className="text-xs text-foreground/85">
                    {decodeURIComponent(errorBanner)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleDismissErrorBanner}
                className="cursor-pointer text-status-warning hover:bg-status-warning/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Social Accounts Grid */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {CORE_SOCIAL_PROVIDERS.map((provider) => {
              const Icon = provider.icon
              const integration =
                socialIntegrations.find(
                  (item) => item.provider === provider.id && item.isActive
                ) ||
                socialIntegrations.find(
                  (item) =>
                    item.provider === provider.id &&
                    item.status === "PENDING_SELECTION"
                )

              const isPendingSelection =
                integration?.status === "PENDING_SELECTION"
              const isConnected = Boolean(integration?.isActive)

              const isComposio = Boolean(
                integration?.metadata &&
                (integration.metadata as Record<string, unknown>).authSource ===
                  "composio"
              )

              // Token expiration check using passed/timer nowMs
              const isExpired =
                integration?.status === "EXPIRED" ||
                Boolean(
                  nowMs > 0 &&
                  integration?.tokenExpiresAt &&
                  new Date(integration.tokenExpiresAt).getTime() < nowMs
                )

              const isExpiringSoon = Boolean(
                nowMs > 0 &&
                integration?.tokenExpiresAt &&
                !isExpired &&
                new Date(integration.tokenExpiresAt).getTime() - nowMs <
                  7 * 24 * 60 * 60 * 1000
              )

              const isRefreshingThis = refreshingTokenId === integration?.id

              return (
                <Card
                  key={provider.id}
                  className={cn(
                    "flex flex-col justify-between border-border/80 transition-shadow hover:shadow-md motion-reduce:transition-none",
                    isPendingSelection
                      ? "border-status-warning-border bg-status-warning-bg/35"
                      : isConnected
                        ? "border-status-success-border bg-card"
                        : "bg-secondary/35"
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
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {provider.subtitle}
                          </p>
                        </div>
                      </div>

                      {isPendingSelection ? (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 border-status-warning-border bg-status-warning-bg text-[11px] font-semibold text-status-warning"
                        >
                          <AlertTriangle
                            className="size-3"
                            aria-hidden="true"
                          />
                          <span>Pending Selection</span>
                        </Badge>
                      ) : isConnected ? (
                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "flex items-center gap-1 text-[11px] font-semibold",
                              isExpired
                                ? "border-status-danger-border bg-status-danger-bg text-status-danger"
                                : "border-status-success-border bg-status-success-bg text-status-success"
                            )}
                          >
                            <CheckCircle2
                              className="size-3"
                              aria-hidden="true"
                            />
                            <span>{isExpired ? "Expired" : "Active"}</span>
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "px-1.5 py-0 text-[10px] font-medium",
                              isComposio
                                ? "border-gold-border bg-accent/50 text-gold-text"
                                : "border-status-info-border bg-status-info-bg text-status-info"
                            )}
                          >
                            {isComposio
                              ? "Managed OAuth (Composio)"
                              : "Direct OAuth"}
                          </Badge>
                        </div>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-border text-[11px] font-medium text-muted-foreground"
                        >
                          Disconnected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col justify-center text-xs text-muted-foreground">
                    {isPendingSelection && integration ? (
                      <div className="space-y-2 rounded-lg bg-status-warning-bg p-3 text-foreground">
                        <p className="text-xs font-bold text-status-warning">
                          Multiple Accounts / Pages Discovered
                        </p>
                        <p className="text-[11px] text-foreground/85">
                          Your OAuth authorization returned multiple eligible{" "}
                          {provider.name} accounts. Select which Page, Profile,
                          or Location to bind for publishing.
                        </p>
                        <Button
                          type="button"
                          size="xs"
                          onClick={() =>
                            handleOpenCandidateSelector(
                              provider.id,
                              integration.id
                            )
                          }
                          className="mt-1 w-full cursor-pointer bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          Select Account / Page to Activate
                        </Button>
                      </div>
                    ) : isConnected && integration ? (
                      <div className="space-y-2 rounded-lg bg-secondary/60 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">
                            {integration.name}
                          </span>
                          {integration.handle && (
                            <span className="font-mono text-[11px] font-medium text-primary">
                              @{integration.handle.replace(/^@/, "")}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Account ID:</span>
                            <span className="font-mono text-foreground">
                              {integration.internalAccountId}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Integration Status:</span>
                            <span className="font-mono font-semibold text-foreground">
                              {integration.status || "ACTIVE"}
                            </span>
                          </div>
                          {integration.tokenExpiresAt && (
                            <div className="flex justify-between">
                              <span>Token Expiry:</span>
                              <span
                                className={cn(
                                  "font-medium tabular-nums",
                                  isExpired
                                    ? "text-status-danger"
                                    : isExpiringSoon
                                      ? "text-status-warning"
                                      : "text-status-success"
                                )}
                              >
                                {isExpired
                                  ? "Expired (Refresh Needed)"
                                  : `Expires ${new Date(
                                      integration.tokenExpiresAt
                                    ).toLocaleDateString()}`}
                              </span>
                            </div>
                          )}
                          {integration.lastSyncedAt && (
                            <div className="flex justify-between">
                              <span>Last Verified:</span>
                              <span className="tabular-nums">
                                {new Date(
                                  integration.lastSyncedAt
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No active connection. Link via official OAuth
                        authorization or paste a long-lived system token to
                        enable automated campaign publishing.
                      </p>
                    )}
                  </CardContent>

                  <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                    {isConnected && integration ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={isRefreshingThis}
                            onClick={() =>
                              handleRefreshSingleToken(integration.id)
                            }
                            className="cursor-pointer gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            title="Refresh OAuth Token"
                          >
                            <RefreshCw
                              className={cn(
                                "size-3 text-gold-text motion-reduce:animate-none",
                                isRefreshingThis && "animate-spin"
                              )}
                              aria-hidden="true"
                            />
                            <span>Refresh Token</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => handleOpenManualModal(provider.id)}
                            className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            Update
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            render={<a href={provider.oauthUrl} />}
                          >
                            Reconnect
                          </Button>
                          <Button
                            variant="destructive"
                            size="xs"
                            disabled={disconnectingId === integration.id}
                            onClick={() => handleDisconnect(integration.id)}
                            className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            {disconnectingId === integration.id ? (
                              <Loader2
                                className="size-3 animate-spin motion-reduce:animate-none"
                                aria-hidden="true"
                              />
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
                          className="cursor-pointer text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          Manual Token
                        </Button>
                        <Button
                          size="xs"
                          className="cursor-pointer bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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

          {/* Multi-Page / Account / Location OAuth Candidate Selector Modal */}
          <Dialog
            open={isCandidateModalOpen}
            onOpenChange={setIsCandidateModalOpen}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <Sparkles
                    className="size-4 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>
                    Select Official{" "}
                    {candidateProvider
                      ? candidateProvider.toUpperCase()
                      : "Social"}{" "}
                    Account / Page
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Multiple eligible pages, business accounts, or locations were
                  discovered under your OAuth credentials. Choose which account
                  Al Ramlah Travels should publish to.
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={handleConfirmCandidateSelection}
                className="space-y-4 py-2"
              >
                {candidateError && (
                  <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
                    {candidateError}
                  </div>
                )}

                {isLoadingCandidates ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                    <Loader2
                      className="size-4 animate-spin text-gold-text motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    <span>Loading discovered OAuth accounts…</span>
                  </div>
                ) : pendingCandidates.length === 0 ? (
                  <div className="rounded-lg bg-secondary/60 p-6 text-center text-xs text-muted-foreground">
                    No pending candidate accounts found. Close this dialog and
                    click &ldquo;Connect via OAuth&rdquo; to re-authorize.
                  </div>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {pendingCandidates.map((cand) => {
                      const isSelected =
                        selectedCandidateInternalId === cand.internalAccountId
                      return (
                        <label
                          key={cand.internalAccountId}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-xs transition-colors motion-reduce:transition-none",
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border bg-card hover:border-gold-border"
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <input
                              type="radio"
                              name="socialCandidate"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedCandidateInternalId(
                                  cand.internalAccountId
                                )
                              }
                              className="accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-foreground">
                                {cand.name}
                              </p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground">
                                {cand.handle
                                  ? `@${cand.handle.replace(/^@/, "")} | `
                                  : ""}
                                ID: {cand.internalAccountId}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[11px] font-medium capitalize"
                          >
                            {cand.provider}
                          </Badge>
                        </label>
                      )
                    })}
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCandidateModalOpen(false)}
                    disabled={isSelectingCandidate}
                    className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      isSelectingCandidate ||
                      isLoadingCandidates ||
                      pendingCandidates.length === 0
                    }
                    className="cursor-pointer bg-primary font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {isSelectingCandidate ? (
                      <>
                        <Loader2
                          className="mr-1.5 size-3.5 animate-spin text-gold motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                        Activating Account…
                      </>
                    ) : (
                      "Activate Selected Account"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Paste Manual/System Token Modal Dialog */}
          <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <Key className="size-4 text-gold-text" aria-hidden="true" />
                  Paste Manual Access Token
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Connect without OAuth by providing a long-lived Page Token,
                  System User Token, or API Key.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSaveManualToken} className="space-y-4 py-2">
                {manualError && (
                  <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
                    {manualError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label
                    htmlFor="manual-provider"
                    className="text-xs font-semibold"
                  >
                    Target Social Channel
                  </Label>
                  <select
                    id="manual-provider"
                    value={manualProvider}
                    onChange={(e) =>
                      setManualProvider(e.target.value as SocialProviderId)
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                    <Label
                      htmlFor="manual-name"
                      className="text-xs font-semibold"
                    >
                      Account Label *
                    </Label>
                    <Input
                      id="manual-name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="e.g. Al Ramlah Official"
                      className="h-8 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="manual-handle"
                      className="text-xs font-semibold"
                    >
                      Username / Handle
                    </Label>
                    <Input
                      id="manual-handle"
                      value={manualHandle}
                      onChange={(e) => setManualHandle(e.target.value)}
                      placeholder="@alramlahtravels"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="manual-internal-id"
                    className="text-xs font-semibold"
                  >
                    Internal Account / Page ID *
                  </Label>
                  <Input
                    id="manual-internal-id"
                    value={manualInternalAccountId}
                    onChange={(e) => setManualInternalAccountId(e.target.value)}
                    placeholder="e.g. 10293847561829"
                    className="h-8 font-mono text-xs"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Facebook Page ID, Instagram Business ID, or YouTube Channel
                    ID.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="manual-access-token"
                    className="text-xs font-semibold"
                  >
                    Long-Lived Access Token *
                  </Label>
                  <Textarea
                    id="manual-access-token"
                    value={manualAccessToken}
                    onChange={(e) => setManualAccessToken(e.target.value)}
                    placeholder="Paste permanent Meta System User token or API secret token…"
                    rows={3}
                    className="resize-none font-mono text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="manual-refresh-token"
                      className="text-xs font-semibold"
                    >
                      Refresh Token (Optional)
                    </Label>
                    <Input
                      id="manual-refresh-token"
                      value={manualRefreshToken}
                      onChange={(e) => setManualRefreshToken(e.target.value)}
                      placeholder="Optional refresh token"
                      className="h-8 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="manual-expiry"
                      className="text-xs font-semibold"
                    >
                      Token Validity (Days)
                    </Label>
                    <Input
                      id="manual-expiry"
                      type="number"
                      value={manualExpiresInDays}
                      onChange={(e) => setManualExpiresInDays(e.target.value)}
                      placeholder="60"
                      className="h-8 text-xs"
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
                    className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={manualSubmitting}
                    className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {manualSubmitting ? (
                      <>
                        <Loader2
                          className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                        Saving Token…
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
      {/* TAB 2: Official Meta WhatsApp Cloud API (Dual-Line Coexistence + Agent)  */}
      {/* ========================================================================= */}
      {activeTab === "whatsapp" && (
        <div className="flex flex-col gap-6">
          {/* Native WhatsApp Linked-Device Engine (QR & 8-Digit Pairing Code, Spec 0021) */}
          <WhatsappLinkedDeviceCard />

          {/* Section 2: Official Meta Cloud API (WABA) & Message Templates */}
          <div className="flex flex-col gap-6 pt-2">
            <div className="flex flex-col gap-3 border-t border-border/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                  <Sparkles
                    className="size-4 text-gold-text"
                    aria-hidden="true"
                  />
                  Official Meta Cloud API (WABA) &amp; Message Templates
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Configure your official Meta WhatsApp Business Account for
                  automated customer notifications and broadcast campaigns.
                </p>
              </div>

              {whatsappAccounts.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {whatsappAccounts.length > 1 &&
                    whatsappAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleSelectAccountSlot(acc)}
                        className={cn(
                          "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                          selectedWabaId === acc.id
                            ? "border-gold bg-primary text-primary-foreground shadow-xs"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {acc.name} ({acc.displayPhoneNumber})
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => handleSelectAccountSlot("NEW_DEDICATED")}
                    className={cn(
                      "cursor-pointer rounded-lg border border-dashed px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                      selectedWabaId === "NEW_DEDICATED"
                        ? "border-gold bg-primary text-primary-foreground shadow-xs"
                        : "border-gold-border bg-card text-primary hover:bg-gold/10"
                    )}
                  >
                    + Add WABA Account
                  </button>
                </div>
              )}
            </div>

            {/* Webhook Callback Endpoint Banner */}
            <Card className="border-gold-border bg-accent/25">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio
                      className="size-5 text-gold-text"
                      aria-hidden="true"
                    />
                    <CardTitle className="text-sm font-bold text-foreground">
                      Meta Webhook Receiver &amp; Challenge Endpoint
                    </CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-gold-border font-mono text-[11px] text-gold-text"
                  >
                    wacrm Native Receiver
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  In your Meta Developer App under{" "}
                  <strong>WhatsApp &gt; Configuration</strong>, register this
                  Callback URL and Verify Token (subscribe to{" "}
                  <code>messages</code> and <code>smb_message_echoes</code>).
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pt-2">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {/* Callback URL */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Webhook Callback URL
                    </label>
                    <div className="flex items-center gap-2 rounded-lg bg-card p-2">
                      <span className="flex-1 truncate font-mono text-xs text-foreground select-all">
                        {webhookCallbackUrl}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          handleCopy(webhookCallbackUrl, "webhook")
                        }
                        title="Copy Webhook Callback URL"
                        className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {copiedKey === "webhook" ? (
                          <Check
                            className="size-3.5 text-status-success"
                            aria-hidden="true"
                          />
                        ) : (
                          <Copy
                            className="size-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Verify Token (Masked Preview — Plaintext Never Sent to Browser) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Webhook Verify Token
                    </label>
                    <div className="flex items-center gap-2 rounded-lg bg-card p-2">
                      <span className="flex-1 truncate font-mono text-xs text-foreground">
                        {activeWabaAccount?.hasVerifyToken
                          ? activeWabaAccount.verifyTokenPreview || "••••••••"
                          : "Set when connecting WABA"}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px] font-semibold",
                          activeWabaAccount?.hasVerifyToken
                            ? "border-status-success-border bg-status-success-bg text-status-success"
                            : "border-status-warning-border bg-status-warning-bg text-status-warning"
                        )}
                      >
                        {activeWabaAccount?.hasVerifyToken
                          ? "Redacted"
                          : "Pending"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Quality & Live Metrics Strip (if account exists) */}
            {activeWabaAccount && (
              <Card className="border-border/80 bg-card">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-success-bg text-status-success">
                        <Phone className="size-5" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-foreground">
                            {activeWabaAccount.verifiedName ||
                              activeWabaAccount.name}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="border-status-success-border bg-status-success-bg font-mono text-[11px] text-status-success tabular-nums"
                          >
                            {activeWabaAccount.displayPhoneNumber}
                          </Badge>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          Phone ID: {activeWabaAccount.phoneNumberId} | WABA ID:{" "}
                          {activeWabaAccount.wabaId}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSyncTemplates}
                        disabled={isSyncingTemplates}
                        className="cursor-pointer gap-1.5 border-gold-border text-xs text-foreground hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {isSyncingTemplates ? (
                          <Loader2
                            className="size-3.5 animate-spin text-gold-text motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : (
                          <RefreshCw
                            className="size-3.5 text-gold-text"
                            aria-hidden="true"
                          />
                        )}
                        Sync Meta Templates
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs sm:grid-cols-4">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Line Mode
                      </span>
                      <div className="font-semibold text-foreground">
                        {activeWabaAccount.accountRole ===
                          "COEXISTENCE_FOUNDER" || activeWabaAccount.isOnBizApp
                          ? "Coexistence (Mobile + Cloud)"
                          : "Dedicated Cloud API Agent"}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        AI Intent Gatekeeper
                      </span>
                      <div className="font-semibold text-status-success">
                        {activeWabaAccount.intentFilterEnabled !== false
                          ? "Active (Travel Leads Only)"
                          : "All Inquiries Active"}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Active Templates
                      </span>
                      <div className="font-semibold text-foreground tabular-nums">
                        {whatsappTemplates.length} Synced
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Webhook Subscription
                      </span>
                      <div className="flex items-center gap-1 font-semibold text-status-success">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Subscribed
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
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Lock className="size-4 text-gold-text" aria-hidden="true" />
                  {activeWabaAccount
                    ? `Configure ${activeWabaAccount.name}`
                    : "Connect Meta WhatsApp Cloud API Account"}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Configure your official Meta Cloud API credentials, Phone
                  Number ID, and Access Token.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSaveWabaAccount} className="space-y-4">
                  {wabaFeedback && (
                    <div
                      className={cn(
                        "rounded-lg border p-3 text-xs",
                        wabaFeedback.success
                          ? "border-status-success-border bg-status-success-bg text-status-success"
                          : "border-status-danger-border bg-status-danger-bg text-status-danger"
                      )}
                    >
                      {wabaFeedback.message}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 rounded-xl bg-secondary/60 p-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="waba-role"
                        className="text-xs font-semibold"
                      >
                        Account Line Role
                      </Label>
                      <select
                        id="waba-role"
                        value={wabaAccountRole}
                        onChange={(e) => {
                          const val = e.target.value as
                            | "COEXISTENCE_FOUNDER"
                            | "DEDICATED_AGENT"
                            | "PRIMARY_CLOUD"
                          setWabaAccountRole(val)
                        }}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <option value="PRIMARY_CLOUD">
                          Primary Cloud API Line
                        </option>
                        <option value="DEDICATED_AGENT">
                          Dedicated AI Agent Line
                        </option>
                        <option value="COEXISTENCE_FOUNDER">
                          Meta Coexistence Line (Mobile App + Cloud API)
                        </option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-center space-y-1">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
                        <input
                          type="checkbox"
                          checked={wabaIntentFilterEnabled}
                          onChange={(e) =>
                            setWabaIntentFilterEnabled(e.target.checked)
                          }
                          className="size-4 rounded border-border text-primary accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        />
                        <span>
                          Enable AI Intent Detection Gatekeeper (OpenRouter LLM)
                        </span>
                      </label>
                      <p className="pl-6 text-[11px] text-muted-foreground">
                        Automatically classifies incoming messages and mutes
                        travel auto-replies on personal/unrelated business
                        chats.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="waba-name"
                        className="text-xs font-semibold"
                      >
                        Account Name *
                      </Label>
                      <Input
                        id="waba-name"
                        value={wabaName}
                        onChange={(e) => setWabaName(e.target.value)}
                        placeholder="Al Ramlah Primary"
                        className="h-8 text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="waba-display-phone"
                        className="text-xs font-semibold"
                      >
                        Display Phone Number *
                      </Label>
                      <Input
                        id="waba-display-phone"
                        value={wabaDisplayPhone}
                        onChange={(e) => setWabaDisplayPhone(e.target.value)}
                        placeholder="e.g. +92 319 0462638"
                        className="h-8 text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="waba-phone-id"
                        className="text-xs font-semibold"
                      >
                        Phone Number ID *
                      </Label>
                      <Input
                        id="waba-phone-id"
                        value={wabaPhoneNumberId}
                        onChange={(e) => setWabaPhoneNumberId(e.target.value)}
                        placeholder="e.g. 1430405500153193"
                        className="h-8 font-mono text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="waba-account-id"
                        className="text-xs font-semibold"
                      >
                        WABA Account ID *
                      </Label>
                      <Input
                        id="waba-account-id"
                        value={wabaId}
                        onChange={(e) => setWabaId(e.target.value)}
                        placeholder="e.g. 2527960031014926"
                        className="h-8 font-mono text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="waba-verify-token"
                        className="text-xs font-semibold"
                      >
                        Custom Webhook Verify Token{" "}
                        {activeWabaAccount
                          ? "(Leave blank to keep existing)"
                          : ""}
                      </Label>
                      <Input
                        id="waba-verify-token"
                        type="password"
                        value={wabaVerifyToken}
                        onChange={(e) => setWabaVerifyToken(e.target.value)}
                        placeholder={
                          activeWabaAccount?.verifyTokenPreview
                            ? `${activeWabaAccount.verifyTokenPreview} (Stored securely)`
                            : "art_wa_token_verified"
                        }
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label
                        htmlFor="waba-access-token"
                        className="text-xs font-semibold"
                      >
                        Meta Permanent System User Access Token{" "}
                        {activeWabaAccount
                          ? "(Leave blank to keep existing)"
                          : "*"}
                      </Label>
                      <Input
                        id="waba-access-token"
                        type="password"
                        value={wabaAccessToken}
                        onChange={(e) => setWabaAccessToken(e.target.value)}
                        placeholder={
                          activeWabaAccount
                            ? "•••••••••••••••• (Encrypted in Neon DB)"
                            : "EAAB…"
                        }
                        className="h-8 font-mono text-xs"
                        required={!activeWabaAccount}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Generated under Meta Business Settings &gt; System Users
                        &gt; WhatsApp Business Messaging.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="waba-pin"
                        className="text-xs font-semibold"
                      >
                        Two-Step PIN (Dedicated Cloud Line Only)
                      </Label>
                      <Input
                        id="waba-pin"
                        type="password"
                        maxLength={6}
                        value={wabaPin}
                        onChange={(e) => setWabaPin(e.target.value)}
                        placeholder={
                          wabaAccountRole === "COEXISTENCE_FOUNDER"
                            ? "Skipped on Coexistence"
                            : "6-digit PIN"
                        }
                        disabled={wabaAccountRole === "COEXISTENCE_FOUNDER"}
                        className="h-8 font-mono text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Required only if 2-step verification is active on the
                        line.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={wabaIsDefault}
                        onChange={(e) => setWabaIsDefault(e.target.checked)}
                        className="size-4 rounded border-border text-primary accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                      <span>Set as Primary Dispatch WhatsApp Account</span>
                    </label>

                    <Button
                      type="submit"
                      disabled={isSavingWaba}
                      className="cursor-pointer bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {isSavingWaba ? (
                        <>
                          <Loader2
                            className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                          Verifying &amp; Saving…
                        </>
                      ) : (
                        "Save & Verify WABA Credentials"
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
                    Synchronized Meta Message Templates (
                    {whatsappTemplates.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Approved templates available for 24-hour window
                    re-engagement and broadcast campaigns.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setCreateTemplateError(null)
                      setIsCreateTemplateOpen(true)
                    }}
                    className="h-8 cursor-pointer gap-1.5 bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    Create Meta Template
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSyncTemplates}
                    disabled={isSyncingTemplates || !activeWabaAccount}
                    className="h-8 cursor-pointer gap-1.5 border-border/80 text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5 motion-reduce:animate-none",
                        isSyncingTemplates && "animate-spin"
                      )}
                      aria-hidden="true"
                    />
                    {isSyncingTemplates ? "Syncing…" : "Sync"}
                  </Button>
                </div>
              </div>

              {whatsappTemplates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                  <FileText
                    className="mx-auto mb-2 size-8 text-muted-foreground/60"
                    aria-hidden="true"
                  />
                  <p className="font-semibold text-foreground">
                    No Message Templates Synced Yet
                  </p>
                  <p className="mt-1">
                    Click <strong>Create Meta Template</strong> to author a new
                    template or <strong>Sync</strong> to pull down pre-approved
                    templates from Meta.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {whatsappTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="flex flex-col justify-between border-border/70 text-xs"
                    >
                      <div>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 pr-1">
                              <CardTitle
                                className="truncate font-mono text-xs font-bold"
                                title={template.name}
                              >
                                {template.name}
                              </CardTitle>
                              <span className="text-[11px] text-muted-foreground">
                                {template.language} | {template.category}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[11px] font-semibold",
                                  template.status === "APPROVED"
                                    ? "border-status-success-border bg-status-success-bg text-status-success"
                                    : template.status === "PENDING"
                                      ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                                      : "border-status-danger-border bg-status-danger-bg text-status-danger"
                                )}
                              >
                                {template.status}
                              </Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Delete template from Meta"
                                onClick={() => setTemplateToDelete(template)}
                                className="size-6 cursor-pointer text-muted-foreground hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                <Trash2
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="line-clamp-3 pb-2 text-[11px] text-muted-foreground">
                          {template.bodyText}
                        </CardContent>
                      </div>
                      {template.footerText && (
                        <CardFooter className="mt-1 border-t border-border/40 pt-0 pb-2 text-[11px] text-muted-foreground">
                          Footer: {template.footerText}
                        </CardFooter>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Cloud Infrastructure Status                                        */}
      {/* ========================================================================= */}
      {activeTab === "infrastructure" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* 1. Multimodal AI Extraction Gateway */}
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-accent/60 text-gold-text">
                      <Sparkles className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        Multimodal AI Extraction Gateway
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Google Gemini (3.8 / 3.5 Flash Primary) &amp; OpenRouter
                        Secondary
                      </CardDescription>
                    </div>
                  </div>
                  {infrastructureStatus.openRouterConfigured ||
                  infrastructureStatus.geminiConfigured ? (
                    <Badge
                      variant="outline"
                      className="border-status-success-border bg-status-success-bg text-[11px] font-semibold text-status-success"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-status-warning-border bg-status-warning-bg text-[11px] font-medium text-status-warning"
                    >
                      Missing Keys
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <p className="text-muted-foreground">
                  Drives multimodal flyer analysis inside Studio Hub:
                  automatically parses Urdu/English WhatsApp texts, dates,
                  airlines, Makkah/Madinah hotels, and quad/triple/double
                  sharing tariffs.
                </p>
                <div className="space-y-1.5 rounded-lg bg-secondary/60 p-3 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <code className="font-mono">
                      GOOGLE_GENERATIVE_AI_API_KEY:
                    </code>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        infrastructureStatus.geminiConfigured
                          ? "text-status-success"
                          : "text-status-warning"
                      )}
                    >
                      {infrastructureStatus.geminiConfigured ? (
                        <>
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          <span>Configured</span>
                        </>
                      ) : (
                        "Not Set"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <code className="font-mono">OPENROUTER_API_KEY:</code>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        infrastructureStatus.openRouterConfigured
                          ? "text-status-success"
                          : "text-status-warning"
                      )}
                    >
                      {infrastructureStatus.openRouterConfigured ? (
                        <>
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          <span>Configured</span>
                        </>
                      ) : (
                        "Not Set"
                      )}
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
                    <div className="flex size-10 items-center justify-center rounded-xl bg-status-warning-bg text-status-warning">
                      <Cloud className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        Cloudflare R2 Object Storage
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        S3-Compatible High Performance Storage (Zero Egress
                        Fees)
                      </CardDescription>
                    </div>
                  </div>
                  {infrastructureStatus.r2Configured ? (
                    <Badge
                      variant="outline"
                      className="border-status-success-border bg-status-success-bg text-[11px] font-semibold text-status-success"
                    >
                      Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-status-warning-border bg-status-warning-bg text-[11px] font-medium text-status-warning"
                    >
                      Local Fallback
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <p className="text-muted-foreground">
                  Stores raw supplier PDFs, presigned flyer uploads, 4K
                  multi-package sheets, spotlight posters, and generated 3-page
                  luxury vector PDF itineraries.
                </p>
                <div className="space-y-1.5 rounded-lg bg-secondary/60 p-3 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <code className="font-mono">
                      R2_BUCKET_NAME &amp; Credentials:
                    </code>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        infrastructureStatus.r2Configured
                          ? "text-status-success"
                          : "text-status-warning"
                      )}
                    >
                      {infrastructureStatus.r2Configured ? (
                        <>
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          <span>Connected</span>
                        </>
                      ) : (
                        "Local Mode"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">Storage Engine:</span>
                    <span className="font-mono text-foreground">
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
                    <div className="flex size-10 items-center justify-center rounded-xl bg-status-info-bg text-status-info">
                      <Activity className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        Trigger.dev Cloud Scheduler
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Durable Background Jobs, 4-Hour Post Hooks &amp;
                        Outreach Cooldowns
                      </CardDescription>
                    </div>
                  </div>
                  {infrastructureStatus.triggerConfigured ? (
                    <Badge
                      variant="outline"
                      className="border-status-success-border bg-status-success-bg text-[11px] font-semibold text-status-success"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-status-warning-border bg-status-warning-bg text-[11px] font-medium text-status-warning"
                    >
                      Sync Fallback
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <p className="text-muted-foreground">
                  Executes the two-step marketing campaign hook (publishes
                  single package spotlight immediately, delays multi-package
                  sheet by 4 hours) and maintains 14-day pilgrim contact
                  cooldowns.
                </p>
                <div className="space-y-1.5 rounded-lg bg-secondary/60 p-3 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <code className="font-mono">TRIGGER_SECRET_KEY:</code>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        infrastructureStatus.triggerConfigured
                          ? "text-status-success"
                          : "text-status-warning"
                      )}
                    >
                      {infrastructureStatus.triggerConfigured ? (
                        <>
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          <span>Authenticated</span>
                        </>
                      ) : (
                        "Local Runner"
                      )}
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
                    <div className="flex size-10 items-center justify-center rounded-xl bg-accent/50 text-gold-text">
                      <Server className="size-5" aria-hidden="true" />
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
                      className="border-status-success-border bg-status-success-bg text-[11px] font-semibold text-status-success"
                    >
                      Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-status-warning-border bg-status-warning-bg text-[11px] font-medium text-status-warning"
                    >
                      Local Chromium
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <p className="text-muted-foreground">
                  Converts Al Ramlah Travels quotation worksheets into official
                  3-page luxury vector PDF itineraries with custom Arabic
                  typography and metallic gold borders.
                </p>
                <div className="space-y-1.5 rounded-lg bg-secondary/60 p-3 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <code className="font-mono">GOTENBERG_API_URL:</code>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        infrastructureStatus.gotenbergConfigured
                          ? "text-status-success"
                          : "text-status-warning"
                      )}
                    >
                      {infrastructureStatus.gotenbergConfigured ? (
                        <>
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          <span>Connected</span>
                        </>
                      ) : (
                        "Local Chromium"
                      )}
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
                  <Server className="size-5 text-primary" aria-hidden="true" />
                  <CardTitle className="text-base font-bold text-foreground">
                    Oracle Cloud Always Free Deployment Setup
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className="border-gold-border bg-accent/40 text-[11px] font-bold text-gold-text tabular-nums"
                >
                  $0.00 / month forever
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Run an enterprise Gotenberg 8 PDF conversion microservice fully
                covered by Oracle Cloud Always Free tier (4 OCPU, 24 GB RAM, 200
                GB SSD) with automated Let&apos;s Encrypt TLS.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-card/85 p-3">
                  <div className="font-semibold text-foreground">
                    1. Setup Script
                  </div>
                  <div className="mt-1 font-mono text-[11px] break-all text-primary">
                    scripts/oracle-gotenberg/setup-oracle-arm.sh
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Turnkey bootstrap script: configures Docker, fixes Ubuntu
                    iptables &amp; starts Caddy.
                  </p>
                </div>

                <div className="rounded-lg bg-card/85 p-3">
                  <div className="font-semibold text-foreground">
                    2. Docker Compose
                  </div>
                  <div className="mt-1 font-mono text-[11px] break-all text-primary">
                    scripts/oracle-gotenberg/docker-compose.yml
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Multi-container bundle (Gotenberg 8 + Caddy 2) tuned for
                    ARM64 Ampere A1.
                  </p>
                </div>

                <div className="rounded-lg bg-card/85 p-3">
                  <div className="font-semibold text-foreground">
                    3. Caddy Reverse Proxy
                  </div>
                  <div className="mt-1 font-mono text-[11px] break-all text-primary">
                    scripts/oracle-gotenberg/Caddyfile
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Automated TLS, X-Gotenberg-Api-Key authentication &amp;
                    public /health route.
                  </p>
                </div>

                <div className="rounded-lg bg-card/85 p-3">
                  <div className="font-semibold text-foreground">
                    4. Documentation
                  </div>
                  <div className="mt-1 font-mono text-[11px] break-all text-primary">
                    scripts/oracle-gotenberg/README.md
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Complete architecture walkthrough, VCN security rules &amp;
                    healthchecks.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg bg-card/85 p-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground">
                    Deployment Documentation Guide:
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Follow the step-by-step instructions in{" "}
                    <code>scripts/oracle-gotenberg/README.md</code> to deploy to
                    Oracle Cloud in under 10 minutes.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 text-[11px] font-medium"
                >
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
          <SettingsClient
            initialSettings={agencySettings}
            isSuperAdmin={isSuperAdmin}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: Zero-Secret System Configuration Health (`?tab=health`)            */}
      {/* ========================================================================= */}
      {activeTab === "health" && configHealth && (
        <div className="min-h-[500px]">
          <ConfigHealthPanel initialSnapshot={configHealth} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: Staff Accounts & RBAC (Super Admin Only)                           */}
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
            <Card className="border-status-danger-border bg-status-danger-bg/40 p-8 text-center">
              <ShieldAlert
                className="mx-auto mb-3 size-10 text-status-danger"
                aria-hidden="true"
              />
              <CardTitle className="text-lg font-bold text-foreground">
                Access Restricted to Super Administrators
              </CardTitle>
              <CardDescription className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
                Managing staff accounts, role-based access control, and password
                resets requires <code>super_admin</code> privileges.
              </CardDescription>
            </Card>
          )}
        </div>
      )}
      {/* ========================================================================= */}
      {/* Create Meta Template Modal Dialog (Spec 0019 AC-6)                        */}
      {/* ========================================================================= */}
      <Dialog
        open={isCreateTemplateOpen}
        onOpenChange={setIsCreateTemplateOpen}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl gap-0 overflow-y-auto p-0">
          <DialogHeader className="border-b border-border/60 bg-secondary/40 p-6 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-status-success-bg text-status-success">
                <Plus className="size-4" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Create Meta WhatsApp Message Template
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Submit a structured template to Meta Graph API for marketing
                  or utility communications.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {createTemplateError && (
            <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              <span>{createTemplateError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-0 lg:grid-cols-12">
            {/* Left Column: Form Controls */}
            <form
              onSubmit={handleCreateTemplateSubmit}
              className="flex flex-col gap-4 border-r border-border/40 p-6 lg:col-span-7"
            >
              {/* Template Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tmpl-name" className="text-xs font-semibold">
                  Template Name <span className="text-status-danger">*</span>
                </Label>
                <Input
                  id="tmpl-name"
                  value={templateNameInput}
                  onChange={(e) =>
                    setTemplateNameInput(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_")
                    )
                  }
                  placeholder="e.g. ramadan_early_bird_offer_2027"
                  className="h-8 font-mono text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Meta requires lowercase alphanumeric characters and
                  underscores only.
                </p>
              </div>

              {/* Category & Language */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tmpl-cat" className="text-xs font-semibold">
                    Category
                  </Label>
                  <select
                    id="tmpl-cat"
                    value={templateCategoryInput}
                    onChange={(e) =>
                      setTemplateCategoryInput(
                        e.target.value as "MARKETING" | "UTILITY"
                      )
                    }
                    className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <option value="MARKETING">
                      Marketing (Broadcast &amp; Promotions)
                    </option>
                    <option value="UTILITY">
                      Utility (Quotes, Updates &amp; Confirmations)
                    </option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tmpl-lang" className="text-xs font-semibold">
                    Language
                  </Label>
                  <select
                    id="tmpl-lang"
                    value={templateLanguageInput}
                    onChange={(e) => setTemplateLanguageInput(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <option value="en_US">English (US) (en_US)</option>
                    <option value="en">English (UK) (en)</option>
                    <option value="ur">Urdu (Pakistan) (ur)</option>
                    <option value="ar">Arabic (ar)</option>
                  </select>
                </div>
              </div>

              {/* Header Type */}
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="tmpl-header-type"
                  className="text-xs font-semibold"
                >
                  Header Type
                </Label>
                <select
                  id="tmpl-header-type"
                  value={templateHeaderTypeInput}
                  onChange={(e) =>
                    setTemplateHeaderTypeInput(
                      e.target.value as "NONE" | "TEXT" | "IMAGE" | "DOCUMENT"
                    )
                  }
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <option value="NONE">None (No Header)</option>
                  <option value="TEXT">Text Header</option>
                  <option value="IMAGE">Image Header (Media flyer)</option>
                  <option value="DOCUMENT">Document Header (PDF)</option>
                </select>

                {templateHeaderTypeInput === "TEXT" && (
                  <Input
                    value={templateHeaderTextInput}
                    onChange={(e) =>
                      setTemplateHeaderTextInput(e.target.value.slice(0, 60))
                    }
                    placeholder="e.g. Al Ramlah Luxury Umrah"
                    className="mt-1 h-8 text-xs"
                    maxLength={60}
                  />
                )}
              </div>

              {/* Body Text */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tmpl-body" className="text-xs font-semibold">
                    Body Text <span className="text-status-danger">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const matches =
                        templateBodyTextInput.match(/\{\{(\d+)\}\}/g) || []
                      const nextNum = matches.length + 1
                      setTemplateBodyTextInput(
                        (prev) => prev + ` {{${nextNum}}}`
                      )
                    }}
                    className="h-6 cursor-pointer bg-status-success-bg px-2 text-[11px] text-status-success hover:bg-status-success-bg/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    + Insert Placeholder
                  </Button>
                </div>
                <Textarea
                  id="tmpl-body"
                  value={templateBodyTextInput}
                  onChange={(e) =>
                    setTemplateBodyTextInput(e.target.value.slice(0, 1024))
                  }
                  placeholder="Assalam-o-Alaikum {{1}}! We are delighted to share our {{2}} package…"
                  rows={4}
                  className="resize-none font-sans text-xs"
                  required
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>
                    Use &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; for
                    recipient variables
                  </span>
                  <span>{templateBodyTextInput.length}/1024 chars</span>
                </div>
              </div>

              {/* Footer Text */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tmpl-footer" className="text-xs font-semibold">
                  Footer Text (Optional)
                </Label>
                <Input
                  id="tmpl-footer"
                  value={templateFooterTextInput}
                  onChange={(e) =>
                    setTemplateFooterTextInput(e.target.value.slice(0, 60))
                  }
                  placeholder="e.g. Al Ramlah Travels, Askari 10 Lahore"
                  className="h-8 text-xs"
                  maxLength={60}
                />
              </div>

              {/* Buttons Builder */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Interactive Buttons ({templateButtonsInput.length}/3)
                  </Label>
                  {templateButtonsInput.length < 3 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setTemplateButtonsInput((prev) => [
                          ...prev,
                          { type: "QUICK_REPLY", text: "" },
                        ])
                      }
                      className="h-6 cursor-pointer px-2 text-[11px] text-status-success focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Plus className="mr-1 size-3" aria-hidden="true" /> Add
                      Button
                    </Button>
                  )}
                </div>

                {templateButtonsInput.map((btn, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg bg-secondary/60 p-2"
                  >
                    <select
                      value={btn.type}
                      onChange={(e) => {
                        const newType = e.target.value as
                          "QUICK_REPLY" | "URL" | "PHONE_NUMBER"
                        setTemplateButtonsInput((prev) =>
                          prev.map((b, i) =>
                            i === idx ? { ...b, type: newType } : b
                          )
                        )
                      }}
                      className="h-7 rounded border border-input bg-background px-1.5 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <option value="QUICK_REPLY">Quick Reply</option>
                      <option value="URL">CTA Website URL</option>
                      <option value="PHONE_NUMBER">Phone Call</option>
                    </select>

                    <Input
                      value={btn.text}
                      onChange={(e) =>
                        setTemplateButtonsInput((prev) =>
                          prev.map((b, i) =>
                            i === idx
                              ? { ...b, text: e.target.value.slice(0, 25) }
                              : b
                          )
                        )
                      }
                      placeholder="Button Title (max 25)"
                      className="h-7 flex-1 text-xs"
                      maxLength={25}
                    />

                    {btn.type === "URL" && (
                      <Input
                        value={btn.url || ""}
                        onChange={(e) =>
                          setTemplateButtonsInput((prev) =>
                            prev.map((b, i) =>
                              i === idx ? { ...b, url: e.target.value } : b
                            )
                          )
                        }
                        placeholder="https://…"
                        className="h-7 flex-1 font-mono text-xs"
                      />
                    )}

                    {btn.type === "PHONE_NUMBER" && (
                      <Input
                        value={btn.phone_number || ""}
                        onChange={(e) =>
                          setTemplateButtonsInput((prev) =>
                            prev.map((b, i) =>
                              i === idx
                                ? { ...b, phone_number: e.target.value }
                                : b
                            )
                          )
                        }
                        placeholder={`+${DEFAULT_COMPANY_INFO.normalizedWhatsapp}`}
                        className="h-7 flex-1 font-mono text-xs"
                      />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setTemplateButtonsInput((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="size-7 cursor-pointer text-muted-foreground hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>

              <DialogFooter className="mt-2 flex items-center justify-end gap-2 border-t border-border/40 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateTemplateOpen(false)}
                  disabled={isCreatingTemplate}
                  className="h-8 cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    isCreatingTemplate ||
                    !templateNameInput.trim() ||
                    !templateBodyTextInput.trim()
                  }
                  className="h-8 cursor-pointer bg-primary text-xs text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {isCreatingTemplate ? (
                    <>
                      <Loader2
                        className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      Submitting to Meta…
                    </>
                  ) : (
                    "Submit Template to Meta"
                  )}
                </Button>
              </DialogFooter>
            </form>

            {/* Right Column: Live Simulated WhatsApp Bubble Preview */}
            <div className="flex flex-col items-center justify-center bg-muted/30 p-6 lg:col-span-5">
              <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-secondary/90 shadow-md">
                {/* Simulated WhatsApp Chat Header */}
                <div className="flex items-center gap-2 bg-primary px-3 py-2 text-primary-foreground">
                  <div className="flex size-6 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-gold-foreground">
                    AR
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs leading-tight font-semibold">
                      Al Ramlah Travels
                    </p>
                    <p className="text-[10px] text-primary-foreground/80">
                      Official Business Account
                    </p>
                  </div>
                  <CheckCircle2
                    className="size-3.5 text-gold"
                    aria-hidden="true"
                  />
                </div>

                {/* Simulated Chat Canvas */}
                <div className="p-3">
                  <div className="overflow-hidden rounded-lg bg-card text-left text-xs shadow-sm">
                    {/* Header preview */}
                    {templateHeaderTypeInput === "TEXT" &&
                      templateHeaderTextInput && (
                        <div className="p-2.5 pb-1 text-xs font-bold text-foreground">
                          {templateHeaderTextInput}
                        </div>
                      )}
                    {templateHeaderTypeInput === "IMAGE" && (
                      <div className="flex h-28 flex-col items-center justify-center border-b border-border/40 bg-status-success-bg/70 text-muted-foreground">
                        <FileText
                          className="mb-1 size-6 text-status-success"
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-semibold text-status-success">
                          [Image Header: 1080×1520 Flyer]
                        </span>
                      </div>
                    )}
                    {templateHeaderTypeInput === "DOCUMENT" && (
                      <div className="flex items-center gap-2 border-b border-border/40 bg-secondary/60 p-2">
                        <FileText
                          className="size-5 text-status-danger"
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-semibold">
                          Itinerary_Dossier.pdf
                        </span>
                      </div>
                    )}

                    {/* Body preview with highlighted tokens */}
                    <div className="p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
                      {templateBodyTextInput ? (
                        templateBodyTextInput
                          .split(/(\{\{[A-Za-z0-9_]+\}\})/g)
                          .map((part, i) => {
                            if (/^\{\{[A-Za-z0-9_]+\}\}$/.test(part)) {
                              return (
                                <span
                                  key={i}
                                  className="mx-0.5 inline-block rounded border border-status-success-border bg-status-success-bg px-1 py-0.5 font-mono text-[10px] font-bold text-status-success"
                                >
                                  {part}
                                </span>
                              )
                            }
                            return <span key={i}>{part}</span>
                          })
                      ) : (
                        <span className="text-muted-foreground italic">
                          Template body preview will appear here as you type…
                        </span>
                      )}
                    </div>

                    {/* Footer preview */}
                    {templateFooterTextInput && (
                      <div className="border-t border-border/30 px-2.5 pt-1 pb-2 text-[10px] text-muted-foreground">
                        {templateFooterTextInput}
                      </div>
                    )}

                    {/* Buttons preview */}
                    {templateButtonsInput.length > 0 && (
                      <div className="divide-y divide-border/50 border-t border-border/50 bg-secondary/40">
                        {templateButtonsInput.map((b, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-center text-[11px] font-semibold text-primary"
                          >
                            {b.type === "URL" && (
                              <ExternalLink
                                className="size-3"
                                aria-hidden="true"
                              />
                            )}
                            {b.type === "PHONE_NUMBER" && (
                              <Phone className="size-3" aria-hidden="true" />
                            )}
                            {b.text || `Button ${i + 1}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-2 text-center text-[11px] text-muted-foreground">
                  Simulated WhatsApp pilgrim view
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation Dialog */}
      <Dialog
        open={templateToDelete !== null}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-status-danger">
              <Trash2 className="size-4" aria-hidden="true" />
              Delete Meta Message Template
            </DialogTitle>
            <DialogDescription className="pt-1 text-xs text-muted-foreground">
              Are you sure you want to delete template{" "}
              <strong className="text-foreground">
                {templateToDelete?.name}
              </strong>{" "}
              ({templateToDelete?.language})? This action will permanently
              remove the template from your Meta WhatsApp Business Account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTemplateToDelete(null)}
              disabled={isDeletingTemplate}
              className="h-8 cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteTemplateConfirm}
              disabled={isDeletingTemplate}
              className="h-8 cursor-pointer gap-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {isDeletingTemplate ? (
                <>
                  <Loader2
                    className="size-3.5 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Confirm Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
