"use client"

import * as React from "react"
import {
  Bot,
  Check,
  Clock,
  Edit3,
  FileText,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  Zap,
} from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  deleteWhatsappAutoReplyRuleAction,
  deleteWhatsappQuickReplyAction,
  toggleWhatsappAutoReplyRuleAction,
  updateWhatsappGreetingSettingsAction,
  upsertWhatsappAutoReplyRuleAction,
  upsertWhatsappQuickReplyAction,
} from "@/app/actions/whatsapp-crm"
import { isSafeAutoReplyRegex } from "@/lib/whatsapp/safe-regex"

export type AutoReplyMatchType = "CONTAINS" | "EXACT" | "STARTS_WITH" | "REGEX"

export interface AutoReplyRuleItem {
  id: string
  accountId: string
  name: string
  matchType: AutoReplyMatchType
  keywords: string[]
  responseText: string
  mediaUrl?: string | null
  mediaFilename?: string | null
  interactiveButtons?: Array<{ id: string; title: string }> | null
  priority: number
  cooldownMinutes: number
  isActive: boolean
  triggerCount: number
  lastTriggeredAt?: Date | string | null
}

export interface QuickReplyItem {
  id: string
  accountId?: string
  shortcut: string
  title: string
  category: string
  bodyText: string
  sortOrder?: number
  isActive?: boolean
}

export interface AccountBotAndGreetingSettings {
  id?: string
  name?: string
  displayPhoneNumber?: string
  autoReplyEnabled: boolean
  autoReplyCooldownMinutes: number
  welcomeGreetingEnabled: boolean
  welcomeGreetingText: string
  awayGreetingEnabled: boolean
  awayGreetingText: string
  businessHoursStart: string
  businessHoursEnd: string
}

export interface WhatsappAutoReplyStudioProps {
  open: boolean
  onClose: () => void
  accountId?: string
  initialRules: AutoReplyRuleItem[]
  onRulesChange: (rules: AutoReplyRuleItem[]) => void
  initialQuickReplies: QuickReplyItem[]
  onQuickRepliesChange: (replies: QuickReplyItem[]) => void
  initialSettings: AccountBotAndGreetingSettings
  onSettingsChange: (settings: AccountBotAndGreetingSettings) => void
}

const DEFAULT_WELCOME_PREVIEW =
  "Assalam-o-Alaikum! 🕋 Welcome to *Al Ramlah Travels* (Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt).\n\nHow may our Hajj & Umrah concierge (+92 327 4029701 · +92 319 0462638) assist you today? Reply with a package code (e.g. *ART-UMR-01*), or type *location*, *documents*, *hajj*, or *bank* for instant details. Reply *STOP* anytime to opt out."

const DEFAULT_AWAY_PREVIEW =
  "Assalam-o-Alaikum! 🌙 Thank you for messaging *Al Ramlah Travels (Askari 10, Lahore Cantt)*. Our Lahore desk is currently outside PKT business hours, but our specialist will respond first thing in the morning Insha'Allah.\n\nFor instant answers now, reply with *location*, *documents*, *hajj*, or a package code like *ART-UMR-01*, or reply *STOP* to opt out."

const STOP_OPTOUT_PREVIEW_RE =
  /^(?:stop|unsubscribe|opt\s*out|cancel\s+messages|remove\s+me|ruko|band\s*karo)$/i

const ART_POST_CODE_PREVIEW_RE = /\bART-[A-Z0-9]{2,8}(?:-[A-Z0-9]{1,8})+\b/i

export { WhatsappAutoReplyStudio as WhatsAppAutoReplyStudio }

export function WhatsappAutoReplyStudio({
  open,
  onClose,
  accountId,
  initialRules,
  onRulesChange,
  initialQuickReplies,
  onQuickRepliesChange,
  initialSettings,
  onSettingsChange,
}: WhatsappAutoReplyStudioProps) {
  const bodyKey = `${accountId ?? initialSettings.id ?? "default"}-${open ? "open" : "closed"}`

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl border border-gold-border bg-card p-0 text-foreground shadow-md sm:max-w-5xl"
      >
        <WhatsappAutoReplyStudioBody
          key={bodyKey}
          accountId={accountId}
          initialRules={initialRules}
          onRulesChange={onRulesChange}
          initialQuickReplies={initialQuickReplies}
          onQuickRepliesChange={onQuickRepliesChange}
          initialSettings={initialSettings}
          onSettingsChange={onSettingsChange}
        />
      </DialogContent>
    </Dialog>
  )
}

interface WhatsappAutoReplyStudioBodyProps {
  accountId?: string
  initialRules: AutoReplyRuleItem[]
  onRulesChange: (rules: AutoReplyRuleItem[]) => void
  initialQuickReplies: QuickReplyItem[]
  onQuickRepliesChange: (replies: QuickReplyItem[]) => void
  initialSettings: AccountBotAndGreetingSettings
  onSettingsChange: (settings: AccountBotAndGreetingSettings) => void
}

function WhatsappAutoReplyStudioBody({
  accountId,
  initialRules,
  onRulesChange,
  initialQuickReplies,
  onQuickRepliesChange,
  initialSettings,
  onSettingsChange,
}: WhatsappAutoReplyStudioBodyProps) {
  const [activeTab, setActiveTab] = React.useState<
    "rules" | "greetings" | "quick_replies"
  >("rules")
  const [statusBanner, setStatusBanner] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Tab 1: Keyword Rules state (synced cleanly to prop updates without useEffect)
  const [rulesOverride, setRulesOverride] = React.useState<{
    base: AutoReplyRuleItem[]
    value: AutoReplyRuleItem[]
  } | null>(null)
  const rules =
    rulesOverride && rulesOverride.base === initialRules
      ? rulesOverride.value
      : initialRules
  const [simulatorInput, setSimulatorInput] = React.useState("")
  const [isRuleEditorOpen, setIsRuleEditorOpen] = React.useState(false)
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null)
  const [ruleName, setRuleName] = React.useState("")
  const [ruleMatchType, setRuleMatchType] =
    React.useState<AutoReplyMatchType>("CONTAINS")
  const [ruleKeywordsInput, setRuleKeywordsInput] = React.useState("")
  const [ruleResponseText, setRuleResponseText] = React.useState("")
  const [ruleMediaUrl, setRuleMediaUrl] = React.useState("")
  const [ruleMediaFilename, setRuleMediaFilename] = React.useState("")
  const [rulePriority, setRulePriority] = React.useState(50)
  const [ruleCooldownMinutes, setRuleCooldownMinutes] = React.useState(30)
  const [ruleButtons, setRuleButtons] = React.useState<
    Array<{ id: string; title: string }>
  >([])
  const [isSavingRule, setIsSavingRule] = React.useState(false)

  // Tab 2: Greeting & Bot Settings state
  const [settings, setSettings] =
    React.useState<AccountBotAndGreetingSettings>({
      ...initialSettings,
      welcomeGreetingText:
        initialSettings.welcomeGreetingText || DEFAULT_WELCOME_PREVIEW,
      awayGreetingText:
        initialSettings.awayGreetingText || DEFAULT_AWAY_PREVIEW,
      businessHoursStart: initialSettings.businessHoursStart || "09:00",
      businessHoursEnd: initialSettings.businessHoursEnd || "21:00",
    })
  const [isSavingSettings, setIsSavingSettings] = React.useState(false)

  // Tab 3: Quick Replies state
  const [quickRepliesOverride, setQuickRepliesOverride] = React.useState<{
    base: QuickReplyItem[]
    value: QuickReplyItem[]
  } | null>(null)
  const quickReplies =
    quickRepliesOverride && quickRepliesOverride.base === initialQuickReplies
      ? quickRepliesOverride.value
      : initialQuickReplies
  const [qrSearch, setQrSearch] = React.useState("")
  const [editingQrId, setEditingQrId] = React.useState<string | null>(null)
  const [qrShortcut, setQrShortcut] = React.useState("")
  const [qrTitle, setQrTitle] = React.useState("")
  const [qrCategory, setQrCategory] = React.useState("general")
  const [qrBodyText, setQrBodyText] = React.useState("")
  const [isSavingQr, setIsSavingQr] = React.useState(false)

  const toast = {
    success: (message: string) => setStatusBanner({ type: "success", message }),
    error: (message: string) => setStatusBanner({ type: "error", message }),
  }

  const syncRules = (next: AutoReplyRuleItem[]) => {
    setRulesOverride({ base: initialRules, value: next })
    onRulesChange(next)
  }

  const syncQuickReplies = (next: QuickReplyItem[]) => {
    setQuickRepliesOverride({ base: initialQuickReplies, value: next })
    onQuickRepliesChange(next)
  }

  const simulatorOutcome = (() => {
    const sample = simulatorInput.trim()
    if (!sample) return null

    if (STOP_OPTOUT_PREVIEW_RE.test(sample)) {
      return {
        tier: "Priority 0 · Compliance STOP Opt-Out",
        summary:
          "Sets do_not_contact = true on conversation + VIP lead, sends single opt-out confirmation, and silences future automation.",
      }
    }

    const postMatch = sample.match(ART_POST_CODE_PREVIEW_RE)
    if (postMatch) {
      return {
        tier: "Priority 1 · ART-... Package Bot",
        summary: `Resolves package code ${postMatch[0].toUpperCase()} and dispatches itemized PKR hospitality card + luxury PDF.`,
      }
    }

    const orderedActive = [...rules]
      .filter((r) => r.isActive)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

    const lower = sample.toLowerCase()
    for (const rule of orderedActive) {
      for (const rawKw of rule.keywords || []) {
        const kw = rawKw.trim()
        if (!kw) continue
        let matched = false
        if (rule.matchType === "EXACT") {
          matched = lower === kw.toLowerCase()
        } else if (rule.matchType === "STARTS_WITH") {
          matched = lower.startsWith(kw.toLowerCase())
        } else if (rule.matchType === "REGEX") {
          if (isSafeAutoReplyRegex(kw)) {
            matched = new RegExp(kw, "i").test(sample)
          }
        } else {
          matched = lower.includes(kw.toLowerCase())
        }
        if (matched) {
          return {
            tier: `Priority 2 · Keyword Rule "${rule.name}" (${rule.matchType})`,
            summary: rule.responseText,
          }
        }
      }
    }

    return {
      tier: "Priority 3: PKT Greeting / Human Consultant Queue",
      summary: settings.welcomeGreetingEnabled
        ? "Triggers first-contact Welcome or PKT After-Hours Away greeting (if outside Askari 10 Lahore business hours)."
        : "No bot rule matched; routes cleanly to the live Askari 10 Lahore consultant inbox.",
    }
  })()

  const filteredQuickReplies = React.useMemo(() => {
    return quickReplies.filter((q) => {
      if (!qrSearch.trim()) return true
      const term = qrSearch.toLowerCase()
      return (
        q.shortcut.toLowerCase().includes(term) ||
        q.title.toLowerCase().includes(term) ||
        q.category.toLowerCase().includes(term) ||
        q.bodyText.toLowerCase().includes(term)
      )
    })
  }, [quickReplies, qrSearch])

  const openNewRuleEditor = () => {
    setEditingRuleId(null)
    setRuleName("")
    setRuleMatchType("CONTAINS")
    setRuleKeywordsInput("")
    setRuleResponseText("")
    setRuleMediaUrl("")
    setRuleMediaFilename("")
    setRulePriority(50)
    setRuleCooldownMinutes(30)
    setRuleButtons([])
    setIsRuleEditorOpen(true)
  }

  const openEditRuleEditor = (rule: AutoReplyRuleItem) => {
    setEditingRuleId(rule.id)
    setRuleName(rule.name)
    setRuleMatchType(rule.matchType)
    setRuleKeywordsInput((rule.keywords || []).join(", "))
    setRuleResponseText(rule.responseText)
    setRuleMediaUrl(rule.mediaUrl || "")
    setRuleMediaFilename(rule.mediaFilename || "")
    setRulePriority(rule.priority ?? 50)
    setRuleCooldownMinutes(rule.cooldownMinutes ?? 30)
    setRuleButtons(rule.interactiveButtons ? [...rule.interactiveButtons] : [])
    setIsRuleEditorOpen(true)
  }

  const handleSaveRule = async () => {
    const parsedKeywords = ruleKeywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)

    if (!ruleName.trim()) {
      toast.error("Please enter a rule name.")
      return
    }
    if (parsedKeywords.length === 0) {
      toast.error("Please provide at least one trigger keyword.")
      return
    }
    if (ruleMatchType === "REGEX") {
      const unsafePattern = parsedKeywords.find(
        (pattern) => !isSafeAutoReplyRegex(pattern)
      )
      if (unsafePattern) {
        toast.error(
          `Unsafe or invalid REGEX pattern "${unsafePattern}". Nested quantifiers, backreferences, and >120 char patterns are blocked.`
        )
        return
      }
    }
    if (!ruleResponseText.trim()) {
      toast.error("Please provide the auto-reply response text.")
      return
    }

    setIsSavingRule(true)
    try {
      const cleanedButtons = ruleButtons
        .map((b, idx) => ({
          id: (b.id || `btn_${idx + 1}`).trim(),
          title: b.title.trim().slice(0, 20),
        }))
        .filter((b) => b.title.length > 0)
        .slice(0, 3)

      const res = await upsertWhatsappAutoReplyRuleAction({
        id: editingRuleId || undefined,
        accountId,
        name: ruleName.trim(),
        matchType: ruleMatchType,
        keywords: parsedKeywords,
        responseText: ruleResponseText.trim(),
        mediaUrl: ruleMediaUrl.trim() || null,
        mediaFilename: ruleMediaFilename.trim() || null,
        interactiveButtons: cleanedButtons,
        priority: Number(rulePriority) || 0,
        cooldownMinutes: Number(ruleCooldownMinutes) || 30,
        isActive: true,
      })

      if (!res.success || !res.rule) {
        toast.error(res.error || "Could not save auto-reply rule.")
        return
      }

      const saved = res.rule as unknown as AutoReplyRuleItem
      const updatedList = editingRuleId
        ? rules.map((r) => (r.id === editingRuleId ? saved : r))
        : [saved, ...rules]

      syncRules(
        [...updatedList].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      )
      setIsRuleEditorOpen(false)
      toast.success(
        editingRuleId ? "Auto-reply rule updated" : "Auto-reply rule created"
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save rule")
    } finally {
      setIsSavingRule(false)
    }
  }

  const handleToggleRule = async (rule: AutoReplyRuleItem) => {
    try {
      const res = await toggleWhatsappAutoReplyRuleAction({
        id: rule.id,
        isActive: !rule.isActive,
      })
      if (res.success && res.rule) {
        const updated = res.rule as unknown as AutoReplyRuleItem
        syncRules(rules.map((r) => (r.id === rule.id ? updated : r)))
        toast.success(
          updated.isActive ? `Enabled "${rule.name}"` : `Paused "${rule.name}"`
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle rule")
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await deleteWhatsappAutoReplyRuleAction({ id: ruleId })
      if (res.success) {
        syncRules(rules.filter((r) => r.id !== ruleId))
        toast.success("Auto-reply rule deleted")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete rule")
    }
  }

  const handleSaveSettings = async () => {
    setIsSavingSettings(true)
    try {
      const res = await updateWhatsappGreetingSettingsAction({
        accountId: settings.id || accountId,
        autoReplyEnabled: settings.autoReplyEnabled,
        autoReplyCooldownMinutes:
          Number(settings.autoReplyCooldownMinutes) || 60,
        welcomeGreetingEnabled: settings.welcomeGreetingEnabled,
        welcomeGreetingText: settings.welcomeGreetingText,
        awayGreetingEnabled: settings.awayGreetingEnabled,
        awayGreetingText: settings.awayGreetingText,
        businessHoursStart: settings.businessHoursStart,
        businessHoursEnd: settings.businessHoursEnd,
      })

      if (!res.success || !res.account) {
        toast.error(res.error || "Failed to save greeting settings")
        return
      }

      const nextSettings: AccountBotAndGreetingSettings = {
        ...settings,
        id: res.account.id,
        autoReplyEnabled: res.account.autoReplyEnabled,
        autoReplyCooldownMinutes: res.account.autoReplyCooldownMinutes,
        welcomeGreetingEnabled: res.account.welcomeGreetingEnabled,
        welcomeGreetingText:
          res.account.welcomeGreetingText || DEFAULT_WELCOME_PREVIEW,
        awayGreetingEnabled: res.account.awayGreetingEnabled,
        awayGreetingText: res.account.awayGreetingText || DEFAULT_AWAY_PREVIEW,
        businessHoursStart: res.account.businessHoursStart || "09:00",
        businessHoursEnd: res.account.businessHoursEnd || "21:00",
      }
      setSettings(nextSettings)
      onSettingsChange(nextSettings)
      toast.success("Bot & Greeting settings saved")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update settings"
      )
    } finally {
      setIsSavingSettings(false)
    }
  }

  const startEditQuickReply = (qr: QuickReplyItem) => {
    setEditingQrId(qr.id)
    setQrShortcut(qr.shortcut)
    setQrTitle(qr.title)
    setQrCategory(qr.category || "general")
    setQrBodyText(qr.bodyText)
  }

  const resetQuickReplyForm = () => {
    setEditingQrId(null)
    setQrShortcut("")
    setQrTitle("")
    setQrCategory("general")
    setQrBodyText("")
  }

  const handleSaveQuickReply = async () => {
    if (!qrShortcut.trim() || !qrTitle.trim() || !qrBodyText.trim()) {
      toast.error("Please fill in shortcut, title, and response text.")
      return
    }
    setIsSavingQr(true)
    try {
      const res = await upsertWhatsappQuickReplyAction({
        id: editingQrId || undefined,
        accountId,
        shortcut: qrShortcut.trim(),
        title: qrTitle.trim(),
        category: qrCategory.trim() || "general",
        bodyText: qrBodyText.trim(),
        sortOrder: 0,
        isActive: true,
      })

      if (!res.success || !res.quickReply) {
        toast.error(
          (res as { error?: string }).error || "Could not save quick reply"
        )
        return
      }

      const saved = res.quickReply as unknown as QuickReplyItem
      const nextList = editingQrId
        ? quickReplies.map((q) => (q.id === editingQrId ? saved : q))
        : [saved, ...quickReplies]

      syncQuickReplies(nextList)
      resetQuickReplyForm()
      toast.success(
        editingQrId ? "Quick reply updated" : "Quick reply created"
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save quick reply"
      )
    } finally {
      setIsSavingQr(false)
    }
  }

  const handleDeleteQuickReply = async (id: string) => {
    try {
      const res = await deleteWhatsappQuickReplyAction({ id })
      if (res.success) {
        syncQuickReplies(quickReplies.filter((q) => q.id !== id))
        if (editingQrId === id) resetQuickReplyForm()
        toast.success("Quick reply deleted")
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete quick reply"
      )
    }
  }

  return (
    <>
      {/* Haramain Luxury Studio Header */}
      <div className="flex items-center justify-between border-b border-gold-border/40 bg-primary px-6 py-4 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-border/50 bg-gold/15 text-gold">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="font-display text-lg font-semibold text-primary-foreground">
                WhatsApp Auto-Replies &amp; Quick Shortcuts
              </DialogTitle>
              <span className="rounded-full border border-gold-border/50 bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                3-Priority Pipeline
              </span>
            </div>
            <DialogDescription className="text-xs text-primary-foreground/85">
              STOP compliance guard, Priority 1 ART package bot, Priority 2
              account-scoped keyword rules, and Priority 3 PKT greetings.
            </DialogDescription>
          </div>
        </div>

        <DialogClose
          render={
            <button
              type="button"
              aria-label="Close Auto-Replies Studio"
              className="rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 p-2 text-primary-foreground/85 transition-colors hover:bg-primary-foreground/20 hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            />
          }
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogClose>
      </div>

      {statusBanner && (
        <div
          role="status"
          className={`flex items-center justify-between border-b px-6 py-2 text-xs font-medium ${
            statusBanner.type === "success"
              ? "border-status-success-border bg-status-success-bg text-status-success"
              : "border-status-danger-border bg-status-danger-bg text-status-danger"
          }`}
        >
          <span>{statusBanner.message}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="rounded text-[11px] font-semibold underline opacity-85 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="WhatsApp Auto-Reply Studio Sections"
        className="flex items-center gap-2 overflow-x-auto border-b border-border bg-secondary/60 px-6 pt-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "rules"}
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 pb-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none ${
            activeTab === "rules"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          Keyword Auto-Replies ({rules.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "greetings"}
          onClick={() => setActiveTab("greetings")}
          className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 pb-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none ${
            activeTab === "greetings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Greeting &amp; Bot Setup
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "quick_replies"}
          onClick={() => setActiveTab("quick_replies")}
          className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 pb-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none ${
            activeTab === "quick_replies"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          Quick Replies (/shortcuts) ({quickReplies.length})
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ========================================== */}
        {/* TAB 1: KEYWORD AUTO-REPLIES                */}
        {/* ========================================== */}
        {activeTab === "rules" && (
          <div className="space-y-6">
            {/* Top Action Bar + Live Pipeline Simulator */}
            <div className="grid gap-4 rounded-xl bg-secondary/60 p-4 lg:grid-cols-12">
              <div className="flex flex-col justify-between gap-3 lg:col-span-5">
                <div>
                  <h3 className="text-xs font-semibold text-foreground">
                    Account-Scoped Keyword Auto-Reply Rules
                  </h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Answer frequent pilgrim inquiries for your Askari 10 Lahore
                    Cantt WABA line with verified details, PDFs, and interactive
                    buttons.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={openNewRuleEditor}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
                  >
                    <Plus className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    New Keyword Rule
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-background p-3 lg:col-span-7">
                <label
                  htmlFor="auto-reply-live-simulator"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary"
                >
                  <Sparkles
                    className="h-3.5 w-3.5 text-gold-text"
                    aria-hidden="true"
                  />
                  Live 3-Priority Inbound Simulator
                </label>
                <input
                  id="auto-reply-live-simulator"
                  type="text"
                  value={simulatorInput}
                  onChange={(e) => setSimulatorInput(e.target.value)}
                  placeholder="Test a message: e.g. STOP, ART-UMR-01, location, documents, bank…"
                  className="w-full rounded-md border border-input bg-secondary/40 px-3 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                {simulatorOutcome && (
                  <div className="mt-2 rounded-md border border-status-success-border bg-status-success-bg px-2.5 py-2 text-[11px] text-status-success">
                    <div className="font-semibold">
                      {simulatorOutcome.tier}
                    </div>
                    <div className="mt-0.5 line-clamp-2 opacity-90">
                      {simulatorOutcome.summary}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rule Editor Form */}
            {isRuleEditorOpen && (
              <div className="rounded-xl border border-gold-border bg-secondary/60 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-display text-sm font-semibold text-primary">
                    {editingRuleId
                      ? "Edit Keyword Auto-Reply Rule"
                      : "Create Keyword Auto-Reply Rule"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsRuleEditorOpen(false)}
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-12">
                  <div className="md:col-span-5">
                    <label className="mb-1 block text-[11px] font-semibold text-foreground">
                      Rule Name
                    </label>
                    <input
                      type="text"
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      placeholder="e.g. Office Location & Askari 10 Lahore Pin"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="mb-1 block text-[11px] font-semibold text-foreground">
                      Match Strategy
                    </label>
                    <select
                      value={ruleMatchType}
                      onChange={(e) =>
                        setRuleMatchType(e.target.value as AutoReplyMatchType)
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <option value="CONTAINS">Contains (Substring)</option>
                      <option value="EXACT">Exact (Full Message)</option>
                      <option value="STARTS_WITH">Starts With (Prefix)</option>
                      <option value="REGEX">
                        Regex (Safe Pattern &le; 120 chars)
                      </option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-foreground">
                      Priority (0-1000)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={rulePriority}
                      onChange={(e) => setRulePriority(Number(e.target.value))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-foreground">
                      Cooldown (mins)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10080}
                      value={ruleCooldownMinutes}
                      onChange={(e) =>
                        setRuleCooldownMinutes(Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>

                  <div className="md:col-span-12">
                    <label className="mb-1 block text-[11px] font-semibold text-foreground">
                      Trigger Keywords (comma-separated, case-insensitive)
                    </label>
                    <input
                      type="text"
                      value={ruleKeywordsInput}
                      onChange={(e) => setRuleKeywordsInput(e.target.value)}
                      placeholder="location, address, office, askari 10, lahore cantt, airport road, map"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>

                  <div className="md:col-span-12">
                    <label className="mb-1 block text-[11px] font-semibold text-foreground">
                      WhatsApp Auto-Reply Message Body
                    </label>
                    <textarea
                      rows={4}
                      value={ruleResponseText}
                      onChange={(e) => setRuleResponseText(e.target.value)}
                      placeholder="Assalam-o-Alaikum! Visit our Askari 10 Sector C Lahore Cantt office…"
                      className="w-full rounded-lg border border-input bg-background p-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>

                  <div className="md:col-span-6">
                    <label className="mb-1 block text-[11px] font-semibold text-foreground">
                      Optional PDF / Brochure URL (HTTPS)
                    </label>
                    <input
                      type="url"
                      value={ruleMediaUrl}
                      onChange={(e) => setRuleMediaUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>

                  <div className="md:col-span-6">
                    <label className="mb-1 block text-[11px] font-semibold text-foreground">
                      Optional Document Filename
                    </label>
                    <input
                      type="text"
                      value={ruleMediaFilename}
                      onChange={(e) => setRuleMediaFilename(e.target.value)}
                      placeholder="Al-Ramlah-Umrah-Checklist.pdf"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>

                  {/* Interactive Quick-Reply Buttons (max 3) */}
                  <div className="md:col-span-12">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-foreground">
                        Interactive Reply Buttons (Optional, max 3, 20 chars each)
                      </span>
                      {ruleButtons.length < 3 && (
                        <button
                          type="button"
                          onClick={() =>
                            setRuleButtons([
                              ...ruleButtons,
                              {
                                id: `btn_${ruleButtons.length + 1}`,
                                title: "",
                              },
                            ])
                          }
                          className="inline-flex items-center gap-1 rounded border border-primary/30 bg-background px-2 py-1 text-[11px] font-semibold text-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" /> Add Button
                        </button>
                      )}
                    </div>

                    {ruleButtons.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-3">
                        {ruleButtons.map((btn, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              maxLength={20}
                              value={btn.title}
                              onChange={(e) => {
                                const next = [...ruleButtons]
                                next[idx] = {
                                  ...next[idx]!,
                                  title: e.target.value,
                                }
                                setRuleButtons(next)
                              }}
                              placeholder={`Button ${idx + 1} label`}
                              className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setRuleButtons(
                                  ruleButtons.filter((_, i) => i !== idx)
                                )
                              }
                              aria-label={`Remove interactive button ${idx + 1}`}
                              className="rounded p-1 text-muted-foreground hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRuleEditorOpen(false)}
                    className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRule}
                    disabled={isSavingRule}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    {isSavingRule ? "Saving…" : "Save Rule"}
                  </button>
                </div>
              </div>
            )}

            {/* Rules List */}
            {rules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-10 text-center">
                <Bot
                  className="mx-auto h-8 w-8 text-gold-text"
                  aria-hidden="true"
                />
                <h4 className="mt-2 font-display text-sm font-semibold text-foreground">
                  No Custom Keyword Auto-Reply Rules Yet
                </h4>
                <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                  Create an account-scoped rule for Askari 10 Lahore Cantt
                  directions, Umrah visa checklists, Hajj 2027 Maktab A/B/C
                  tiers, or verified corporate payment instructions.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`rounded-xl p-4 transition-colors motion-reduce:transition-none ${
                      rule.isActive
                        ? "bg-secondary/60"
                        : "bg-secondary/35 opacity-70"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-gold-border bg-accent px-2 py-0.5 text-[11px] font-semibold text-gold-text">
                            Priority {rule.priority}
                          </span>
                          <span className="rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[11px] font-semibold text-status-success">
                            {rule.matchType}
                          </span>
                          <h4 className="text-sm font-semibold text-foreground">
                            {rule.name}
                          </h4>
                          <span className="text-[11px] text-muted-foreground">
                            Cooldown {rule.cooldownMinutes}m, triggered{" "}
                            {rule.triggerCount ?? 0}x
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {(rule.keywords || []).map((kw, idx) => (
                            <span
                              key={idx}
                              className="rounded border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule)}
                          className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                          title={rule.isActive ? "Pause rule" : "Activate rule"}
                        >
                          {rule.isActive ? (
                            <>
                              <ToggleRight
                                className="h-4 w-4 text-status-success"
                                aria-hidden="true"
                              />
                              <span className="text-[11px] text-status-success">
                                Active
                              </span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft
                                className="h-4 w-4 text-muted-foreground"
                                aria-hidden="true"
                              />
                              <span className="text-[11px] text-muted-foreground">
                                Paused
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditRuleEditor(rule)}
                          aria-label={`Edit rule ${rule.name}`}
                          className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          aria-label={`Delete rule ${rule.name}`}
                          className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:border-status-danger-border hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-3 whitespace-pre-line rounded-lg bg-background p-3 text-xs text-foreground/85">
                      {rule.responseText}
                    </p>

                    {((rule.interactiveButtons &&
                      rule.interactiveButtons.length > 0) ||
                      rule.mediaUrl) && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {rule.mediaUrl && (
                          <span className="flex items-center gap-1 rounded border border-status-info-border bg-status-info-bg px-2 py-0.5 text-[11px] font-medium text-status-info">
                            <FileText className="h-3 w-3" aria-hidden="true" />
                            PDF Attachment: {rule.mediaFilename || "Document"}
                          </span>
                        )}
                        {rule.interactiveButtons?.map((btn, i) => (
                          <span
                            key={i}
                            className="rounded border border-gold-border bg-accent px-2 py-0.5 text-[11px] font-medium text-primary"
                          >
                            [Button] {btn.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: GREETING & BOT CONFIGURATION        */}
        {/* ========================================== */}
        {activeTab === "greetings" && (
          <div className="space-y-5">
            {/* Master Auto-Reply Switch */}
            <div className="rounded-xl bg-secondary/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Master 3-Priority Auto-Responder Engine
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Controls ART-… package cards, guided Umrah intake, and
                    keyword rules (STOP opt-out compliance remains active at all
                    times).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      autoReplyEnabled: !settings.autoReplyEnabled,
                    })
                  }
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 active:opacity-80 motion-reduce:transition-none ${
                    settings.autoReplyEnabled
                      ? "bg-primary text-primary-foreground focus-visible:outline-gold"
                      : "border border-border bg-background text-muted-foreground focus-visible:outline-primary"
                  }`}
                >
                  {settings.autoReplyEnabled ? (
                    <>
                      <ToggleRight
                        className="h-4 w-4 text-gold"
                        aria-hidden="true"
                      />{" "}
                      Auto-Responder Active
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-4 w-4" aria-hidden="true" />{" "}
                      Auto-Responder Paused
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 max-w-xs">
                <label className="mb-1 block text-[11px] font-semibold text-foreground">
                  Package Code Cooldown Window (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10080}
                  value={settings.autoReplyCooldownMinutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      autoReplyCooldownMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </div>
            </div>

            {/* Priority 3A: First-Contact Welcome Greeting */}
            <div className="rounded-xl bg-secondary/60 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    First-Message Welcome Greeting (First Contact)
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sent once on a pilgrim&apos;s very first inbound message when
                    no ART-… code or keyword rule matches.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      welcomeGreetingEnabled: !settings.welcomeGreetingEnabled,
                    })
                  }
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none ${
                    settings.welcomeGreetingEnabled
                      ? "border-status-success-border bg-status-success-bg text-status-success"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {settings.welcomeGreetingEnabled ? (
                    <>
                      <ToggleRight className="h-4 w-4" aria-hidden="true" />{" "}
                      Enabled
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-4 w-4" aria-hidden="true" />{" "}
                      Disabled
                    </>
                  )}
                </button>
              </div>

              <textarea
                rows={4}
                value={settings.welcomeGreetingText}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    welcomeGreetingText: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-input bg-background p-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            </div>

            {/* Priority 3B: After-Hours PKT Away Greeting */}
            <div className="rounded-xl bg-secondary/60 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    After-Hours Away Auto-Reply (PKT Asia/Karachi, 12h Cooldown)
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Automatically replies outside your Askari 10 Lahore Cantt
                    office hours (Asia/Karachi timezone) when no ART-… code or
                    keyword rule matches.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      awayGreetingEnabled: !settings.awayGreetingEnabled,
                    })
                  }
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none ${
                    settings.awayGreetingEnabled
                      ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {settings.awayGreetingEnabled ? (
                    <>
                      <ToggleRight className="h-4 w-4" aria-hidden="true" />{" "}
                      Enabled
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-4 w-4" aria-hidden="true" />{" "}
                      Disabled
                    </>
                  )}
                </button>
              </div>

              <div className="mb-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-foreground">
                    PKT Business Hours Start (24h HH:MM)
                  </label>
                  <input
                    type="time"
                    value={settings.businessHoursStart}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        businessHoursStart: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-foreground">
                    PKT Business Hours End (24h HH:MM)
                  </label>
                  <input
                    type="time"
                    value={settings.businessHoursEnd}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        businessHoursEnd: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                </div>
              </div>

              <textarea
                rows={4}
                value={settings.awayGreetingText}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    awayGreetingText: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-input bg-background p-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                <ShieldCheck className="h-4 w-4 text-gold" aria-hidden="true" />
                {isSavingSettings
                  ? "Saving Greeting & Bot Settings…"
                  : "Save Greeting & Bot Configuration"}
              </button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: QUICK REPLIES (/SHORTCUTS)          */}
        {/* ========================================== */}
        {activeTab === "quick_replies" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-xl bg-secondary/60 p-5 lg:col-span-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-primary">
                  {editingQrId
                    ? "Edit Quick Reply (/shortcut)"
                    : "New Quick Reply (/shortcut)"}
                </h3>
                {editingQrId && (
                  <button
                    type="button"
                    onClick={resetQuickReplyForm}
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-foreground">
                    Slash Shortcut (type{" "}
                    <code className="text-primary">/</code> in chat composer)
                  </label>
                  <div className="flex items-center rounded-lg border border-input bg-background px-3 py-2">
                    <span className="mr-1 font-mono text-xs font-bold text-primary">
                      /
                    </span>
                    <input
                      type="text"
                      value={qrShortcut}
                      onChange={(e) =>
                        setQrShortcut(e.target.value.replace(/^\/+/, ""))
                      }
                      placeholder="docs, bank, location, welcome"
                      className="w-full bg-transparent font-mono text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-foreground">
                      Title
                    </label>
                    <input
                      type="text"
                      value={qrTitle}
                      onChange={(e) => setQrTitle(e.target.value)}
                      placeholder="Umrah Visa Checklist"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-foreground">
                      Category
                    </label>
                    <input
                      type="text"
                      value={qrCategory}
                      onChange={(e) => setQrCategory(e.target.value)}
                      placeholder="documents / payment / general"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-foreground">
                    Message Body
                  </label>
                  <textarea
                    rows={5}
                    value={qrBodyText}
                    onChange={(e) => setQrBodyText(e.target.value)}
                    placeholder="Enter the canned response text inserted when a consultant selects this /shortcut…"
                    className="w-full rounded-lg border border-input bg-background p-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveQuickReply}
                  disabled={isSavingQr}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  <Check className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                  {isSavingQr
                    ? "Saving…"
                    : editingQrId
                      ? "Update Quick Reply"
                      : "Add Quick Reply"}
                </button>
              </div>
            </div>

            <div className="space-y-3 lg:col-span-7">
              <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
                <Search
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={qrSearch}
                  onChange={(e) => setQrSearch(e.target.value)}
                  placeholder="Filter quick replies by /shortcut, title, or text…"
                  className="w-full bg-transparent text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </div>

              {filteredQuickReplies.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-8 text-center text-xs text-muted-foreground">
                  No quick replies match your search. Create a{" "}
                  <code className="font-semibold text-primary">/shortcut</code>{" "}
                  on the left to speed up consultant responses.
                </div>
              ) : (
                <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                  {filteredQuickReplies.map((qr) => (
                    <div
                      key={qr.id}
                      className="rounded-xl bg-secondary/60 p-3.5 transition-colors hover:bg-secondary/80 motion-reduce:transition-none"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded border border-status-success-border bg-status-success-bg px-2 py-0.5 font-mono text-xs font-semibold text-status-success">
                            /{qr.shortcut}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {qr.title}
                          </span>
                          <span className="rounded bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {qr.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditQuickReply(qr)}
                            aria-label={`Edit quick reply ${qr.shortcut}`}
                            className="rounded border border-border bg-background p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                          >
                            <Edit3 className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuickReply(qr.id)}
                            aria-label={`Delete quick reply ${qr.shortcut}`}
                            className="rounded border border-border bg-background p-1.5 text-muted-foreground hover:border-status-danger-border hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <p className="mt-2 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
                        {qr.bodyText}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
