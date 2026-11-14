"use client"

import { useState, useMemo } from "react"
import {
  Bot,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Zap,
  Clock,
  MessageSquare,
  Search,
  ToggleLeft,
  ToggleRight,
  FileText,
  ShieldCheck,
  ChevronRight,
  Layers,
} from "lucide-react"
import {
  upsertWhatsappAutoReplyRuleAction,
  deleteWhatsappAutoReplyRuleAction,
  toggleWhatsappAutoReplyRuleAction,
  updateWhatsappGreetingSettingsAction,
  upsertWhatsappQuickReplyAction,
  deleteWhatsappQuickReplyAction,
} from "@/app/actions/whatsapp-crm"

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

interface WhatsappAutoReplyStudioProps {
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
  "Assalamu Alaikum! 🕋 Welcome to *Al Ramlah Travels* (Chaklala Scheme 3 / Askari 10, Rawalpindi).\n\nHow may our Hajj & Umrah concierge assist you today? Reply with a package code (e.g. *ART-UMR-01*), or type *location*, *documents*, *hajj*, or *bank* for instant details."

const DEFAULT_AWAY_PREVIEW =
  "Assalamu Alaikum! 🌙 Thank you for messaging *Al Ramlah Travels*. Our Rawalpindi desk is currently outside PKT business hours, but our specialist will respond first thing in the morning Insha'Allah.\n\nFor instant answers now, reply with *location*, *documents*, *hajj*, or a package code like *ART-UMR-01*."


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
  const [activeTab, setActiveTab] = useState<"rules" | "greetings" | "quick_replies">("rules")
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const toast = {
    success: (message: string) => setStatusBanner({ type: "success", message }),
    error: (message: string) => setStatusBanner({ type: "error", message }),
  }

  // Tab 1: Keyword Rules state
  const [rules, setRules] = useState<AutoReplyRuleItem[]>(initialRules)
  const [isRuleEditorOpen, setIsRuleEditorOpen] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [ruleName, setRuleName] = useState("")
  const [ruleMatchType, setRuleMatchType] = useState<AutoReplyMatchType>("CONTAINS")
  const [ruleKeywordsInput, setRuleKeywordsInput] = useState("")
  const [ruleResponseText, setRuleResponseText] = useState("")
  const [ruleMediaUrl, setRuleMediaUrl] = useState("")
  const [ruleMediaFilename, setRuleMediaFilename] = useState("")
  const [rulePriority, setRulePriority] = useState(50)
  const [ruleCooldownMinutes, setRuleCooldownMinutes] = useState(30)
  const [ruleButtons, setRuleButtons] = useState<Array<{ id: string; title: string }>>([])
  const [isSavingRule, setIsSavingRule] = useState(false)

  // Tab 2: Greeting & Bot Settings state
  const [settings, setSettings] = useState<AccountBotAndGreetingSettings>({
    ...initialSettings,
    welcomeGreetingText: initialSettings.welcomeGreetingText || DEFAULT_WELCOME_PREVIEW,
    awayGreetingText: initialSettings.awayGreetingText || DEFAULT_AWAY_PREVIEW,
    businessHoursStart: initialSettings.businessHoursStart || "09:00",
    businessHoursEnd: initialSettings.businessHoursEnd || "21:00",
  })
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Tab 3: Quick Replies state
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>(initialQuickReplies)
  const [qrSearch, setQrSearch] = useState("")
  const [editingQrId, setEditingQrId] = useState<string | null>(null)
  const [qrShortcut, setQrShortcut] = useState("")
  const [qrTitle, setQrTitle] = useState("")
  const [qrCategory, setQrCategory] = useState("general")
  const [qrBodyText, setQrBodyText] = useState("")
  const [isSavingQr, setIsSavingQr] = useState(false)

  if (!open) return null

  const syncRules = (next: AutoReplyRuleItem[]) => {
    setRules(next)
    onRulesChange(next)
  }

  const syncQuickReplies = (next: QuickReplyItem[]) => {
    setQuickReplies(next)
    onQuickRepliesChange(next)
  }

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
      toast.success(editingRuleId ? "Auto-reply rule updated" : "Auto-reply rule created")
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
        autoReplyCooldownMinutes: Number(settings.autoReplyCooldownMinutes) || 60,
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
        welcomeGreetingText: res.account.welcomeGreetingText || DEFAULT_WELCOME_PREVIEW,
        awayGreetingEnabled: res.account.awayGreetingEnabled,
        awayGreetingText: res.account.awayGreetingText || DEFAULT_AWAY_PREVIEW,
        businessHoursStart: res.account.businessHoursStart || "09:00",
        businessHoursEnd: res.account.businessHoursEnd || "21:00",
      }
      setSettings(nextSettings)
      onSettingsChange(nextSettings)
      toast.success("Bot & Greeting settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update settings")
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
        toast.error((res as { error?: string }).error || "Could not save quick reply")
        return
      }

      const saved = res.quickReply as unknown as QuickReplyItem
      const nextList = editingQrId
        ? quickReplies.map((q) => (q.id === editingQrId ? saved : q))
        : [saved, ...quickReplies]

      syncQuickReplies(nextList)
      resetQuickReplyForm()
      toast.success(editingQrId ? "Quick reply updated" : "Quick reply created")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save quick reply")
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
      toast.error(err instanceof Error ? err.message : "Failed to delete quick reply")
    }
  }

  const filteredQuickReplies = quickReplies.filter((q) => {
    if (!qrSearch.trim()) return true
    const term = qrSearch.toLowerCase()
    return (
      q.shortcut.toLowerCase().includes(term) ||
      q.title.toLowerCase().includes(term) ||
      q.category.toLowerCase().includes(term) ||
      q.bodyText.toLowerCase().includes(term)
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#C5A059]/30 bg-[#07110E] text-[#F4F0E8] shadow-2xl">
        {/* Studio Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#0A1713] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#C5A059]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-semibold text-[#F4F0E8]">
                  WhatsApp Auto-Replies &amp; Quick Shortcuts
                </h2>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-300 uppercase">
                  3-Priority Pipeline
                </span>
              </div>
              <p className="text-xs text-white/55">
                Priority 1: Package Bot · Priority 2: Custom Keyword Rules · Priority 3: PKT Away &amp; First-Contact Welcome
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {statusBanner && (
          <div
            className={`flex items-center justify-between border-b px-6 py-2 text-xs font-medium ${
              statusBanner.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            <span>{statusBanner.message}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-[11px] opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#091410] px-6 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-xs font-semibold transition ${
              activeTab === "rules"
                ? "border-[#C5A059] text-[#C5A059]"
                : "border-transparent text-white/55 hover:text-white"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Keyword Auto-Replies ({rules.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("greetings")}
            className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-xs font-semibold transition ${
              activeTab === "greetings"
                ? "border-[#C5A059] text-[#C5A059]"
                : "border-transparent text-white/55 hover:text-white"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Greeting & Bot Setup
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("quick_replies")}
            className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-xs font-semibold transition ${
              activeTab === "quick_replies"
                ? "border-[#C5A059] text-[#C5A059]"
                : "border-transparent text-white/55 hover:text-white"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
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
              {/* Top Action Bar */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0C1C17] p-4">
                <div>
                  <h3 className="text-xs font-semibold text-[#F4F0E8]">
                    Keyword Auto-Reply Rules
                  </h3>
                  <p className="mt-1 text-[11px] text-white/55">
                    Automatically answer frequent pilgrim inquiries with custom responses, media, and interactive buttons.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewRuleEditor}
                  className="flex items-center gap-1.5 rounded-lg bg-[#C5A059] px-3.5 py-2 text-xs font-semibold text-[#06100D] transition hover:bg-[#d4b26c] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Keyword Rule
                </button>
              </div>

              {/* Rule Editor Drawer / Form */}
              {isRuleEditorOpen && (
                <div className="rounded-xl border border-[#C5A059]/40 bg-[#0D1F1A] p-5 shadow-lg">
                  <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="font-serif text-sm font-semibold text-[#C5A059]">
                      {editingRuleId ? "Edit Keyword Auto-Reply Rule" : "Create Keyword Auto-Reply Rule"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsRuleEditorOpen(false)}
                      className="text-xs text-white/50 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-12">
                    <div className="md:col-span-5">
                      <label className="mb-1 block text-[11px] font-medium text-white/70">
                        Rule Name
                      </label>
                      <input
                        type="text"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        placeholder="e.g. Office Location & Askari 10 Pin"
                        className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="mb-1 block text-[11px] font-medium text-white/70">
                        Match Strategy
                      </label>
                      <select
                        value={ruleMatchType}
                        onChange={(e) =>
                          setRuleMatchType(e.target.value as AutoReplyMatchType)
                        }
                        className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                      >
                        <option value="CONTAINS">CONTAINS (Substring)</option>
                        <option value="EXACT">EXACT (Full Message)</option>
                        <option value="STARTS_WITH">STARTS_WITH (Prefix)</option>
                        <option value="REGEX">REGEX (Pattern &le; 120 chars)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-white/70">
                        Priority (0-1000)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={rulePriority}
                        onChange={(e) => setRulePriority(Number(e.target.value))}
                        className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-white/70">
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
                        className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-12">
                      <label className="mb-1 block text-[11px] font-medium text-white/70">
                        Trigger Keywords (comma-separated, case-insensitive)
                      </label>
                      <input
                        type="text"
                        value={ruleKeywordsInput}
                        onChange={(e) => setRuleKeywordsInput(e.target.value)}
                        placeholder="location, address, office, askari, chaklala, map"
                        className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-12">
                      <label className="mb-1 block text-[11px] font-medium text-white/70">
                        WhatsApp Auto-Reply Message Body
                      </label>
                      <textarea
                        rows={4}
                        value={ruleResponseText}
                        onChange={(e) => setRuleResponseText(e.target.value)}
                        placeholder="Assalamu Alaikum! Here are the requested details..."
                        className="w-full rounded-lg border border-white/10 bg-black/35 p-3 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-6">
                      <label className="mb-1 block text-[11px] font-medium text-white/70">
                        Optional PDF / Brochure URL (R2 or HTTPS)
                      </label>
                      <input
                        type="url"
                        value={ruleMediaUrl}
                        onChange={(e) => setRuleMediaUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-6">
                      <label className="mb-1 block text-[11px] font-medium text-white/70">
                        Optional Document Filename
                      </label>
                      <input
                        type="text"
                        value={ruleMediaFilename}
                        onChange={(e) => setRuleMediaFilename(e.target.value)}
                        placeholder="Al-Ramlah-Umrah-Checklist.pdf"
                        className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    {/* Interactive Quick-Reply Buttons (max 3) */}
                    <div className="md:col-span-12">
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-[11px] font-medium text-white/70">
                          Optional Interactive Reply Buttons (up to 3 buttons, max 20 chars each)
                        </label>
                        {ruleButtons.length < 3 && (
                          <button
                            type="button"
                            onClick={() =>
                              setRuleButtons([
                                ...ruleButtons,
                                {
                                  id: `rule_btn_${ruleButtons.length + 1}`,
                                  title: "",
                                },
                              ])
                            }
                            className="flex items-center gap-1 text-[11px] font-medium text-[#C5A059] hover:underline"
                          >
                            <Plus className="h-3 w-3" /> Add Button
                          </button>
                        )}
                      </div>
                      {ruleButtons.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-3">
                          {ruleButtons.map((btn, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 p-2"
                            >
                              <input
                                type="text"
                                maxLength={20}
                                value={btn.title}
                                onChange={(e) => {
                                  const next = [...ruleButtons]
                                  next[idx] = {
                                    ...next[idx],
                                    title: e.target.value,
                                  }
                                  setRuleButtons(next)
                                }}
                                placeholder={`Button ${idx + 1} title`}
                                className="w-full bg-transparent text-xs text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setRuleButtons(
                                    ruleButtons.filter((_, i) => i !== idx)
                                  )
                                }
                                className="text-white/40 hover:text-rose-400"
                              >
                                <X className="h-3.5 w-3.5" />
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
                      className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/70 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRule}
                      disabled={isSavingRule}
                      className="flex items-center gap-1.5 rounded-lg bg-[#C5A059] px-4 py-2 text-xs font-semibold text-[#06100D] hover:bg-[#d4b26c] disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {isSavingRule ? "Saving..." : "Save Rule"}
                    </button>
                  </div>
                </div>
              )}

              {/* Rules List */}
              {rules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-10 text-center">
                  <Bot className="mx-auto h-8 w-8 text-[#C5A059]/60" />
                  <h4 className="mt-2 font-serif text-sm font-semibold text-white">
                    No Custom Keyword Auto-Reply Rules Yet
                  </h4>
                  <p className="mx-auto mt-1 max-w-md text-xs text-white/50">
                    Load the 4 pre-built Al Ramlah Travels keyword rules (Office Location, Umrah Documents, Hajj 2027 Maktab Guide, Bank Details) or create a custom rule.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`rounded-xl border p-4 transition ${
                        rule.isActive
                          ? "border-white/10 bg-[#0B1914]"
                          : "border-white/5 bg-black/20 opacity-60"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-[#C5A059]/35 bg-[#C5A059]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C5A059]">
                              Priority {rule.priority}
                            </span>
                            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                              {rule.matchType}
                            </span>
                            <h4 className="text-sm font-semibold text-[#F4F0E8]">
                              {rule.name}
                            </h4>
                            <span className="text-[11px] text-white/45">
                              · Cooldown {rule.cooldownMinutes}m · Triggered{" "}
                              {rule.triggerCount ?? 0}x
                            </span>
                          </div>

                          {/* Keyword Chips */}
                          <div className="flex flex-wrap gap-1.5">
                            {(rule.keywords || []).map((kw, idx) => (
                              <span
                                key={idx}
                                className="rounded border border-white/10 bg-black/35 px-2 py-0.5 font-mono text-[11px] text-white/80"
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
                            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10"
                            title={rule.isActive ? "Pause rule" : "Activate rule"}
                          >
                            {rule.isActive ? (
                              <>
                                <ToggleRight className="h-4 w-4 text-emerald-400" />
                                <span className="text-[11px] text-emerald-300">Active</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="h-4 w-4 text-white/40" />
                                <span className="text-[11px] text-white/50">Paused</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditRuleEditor(rule)}
                            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                            title="Edit Rule"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300"
                            title="Delete Rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-3 whitespace-pre-line rounded-lg border border-white/5 bg-black/25 p-3 text-xs text-white/75">
                        {rule.responseText}
                      </p>

                      {((rule.interactiveButtons && rule.interactiveButtons.length > 0) ||
                        rule.mediaUrl) && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {rule.mediaUrl && (
                            <span className="flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                              <FileText className="h-3 w-3" />
                              PDF Attachment: {rule.mediaFilename || "Document"}
                            </span>
                          )}
                          {rule.interactiveButtons?.map((btn, i) => (
                            <span
                              key={i}
                              className="rounded border border-[#C5A059]/30 bg-[#C5A059]/10 px-2 py-0.5 text-[10px] text-[#C5A059]"
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
          {/* TAB 2: GREETING & BOT SETUP                */}
          {/* ========================================== */}
          {activeTab === "greetings" && (
            <div className="space-y-6">
              {/* Priority 1: Master Auto-Responder & ART-... Package Bot */}
              <div className="rounded-xl border border-[#C5A059]/30 bg-[#0B1914] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#C5A059]/20 px-2 py-0.5 text-[10px] font-semibold text-[#C5A059]">
                        PRIORITY 1 · MASTER SWITCH
                      </span>
                      <h3 className="font-serif text-sm font-semibold text-[#F4F0E8]">
                        Master WaCRM Auto-Responder & ART-... Package Code Bot
                      </h3>
                    </div>
                    <p className="text-xs text-white/60">
                      When enabled, the webhook automatically responds to detected <code className="text-[#C5A059]">ART-...</code> campaign codes, custom keyword rules, and greetings.
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/60">
                        ART-... Cooldown (mins):
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
                        className="w-20 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          autoReplyEnabled: !settings.autoReplyEnabled,
                        })
                      }
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        settings.autoReplyEnabled
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-white/5 text-white/50 border border-white/10"
                      }`}
                    >
                      {settings.autoReplyEnabled ? (
                        <>
                          <ToggleRight className="h-4 w-4" /> Bot Enabled
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-4 w-4" /> Bot Disabled
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Priority 3A: First-Contact Welcome Greeting */}
              <div className="rounded-xl border border-white/10 bg-[#0B1914] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        FIRST CONTACT GREETING
                      </span>
                      <h3 className="font-serif text-sm font-semibold text-[#F4F0E8]">
                        New Pilgrim Welcome Message
                      </h3>
                    </div>
                    <p className="mt-0.5 text-xs text-white/55">
                      Sent once when a pilgrim messages Al Ramlah Travels for the very first time and no package code or keyword rule matches.
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
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      settings.welcomeGreetingEnabled
                        ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                        : "border border-white/10 bg-white/5 text-white/50"
                    }`}
                  >
                    {settings.welcomeGreetingEnabled ? (
                      <>
                        <ToggleRight className="h-4 w-4" /> Enabled
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-4 w-4" /> Disabled
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
                  className="w-full rounded-lg border border-white/10 bg-black/35 p-3 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                />
              </div>

              {/* Priority 3B: After-Hours PKT Away Greeting */}
              <div className="rounded-xl border border-white/10 bg-[#0B1914] p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        PKT (ASIA/KARACHI) AFTER-HOURS
                      </span>
                      <h3 className="font-serif text-sm font-semibold text-[#F4F0E8]">
                        After-Hours Away Auto-Reply (12h Cooldown)
                      </h3>
                    </div>
                    <p className="mt-0.5 text-xs text-white/55">
                      Automatically replies outside your Rawalpindi office hours (Asia/Karachi timezone) when no ART-... code or keyword rule matches.
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
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      settings.awayGreetingEnabled
                        ? "border border-amber-500/40 bg-amber-500/20 text-amber-300"
                        : "border border-white/10 bg-white/5 text-white/50"
                    }`}
                  >
                    {settings.awayGreetingEnabled ? (
                      <>
                        <ToggleRight className="h-4 w-4" /> Enabled
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-4 w-4" /> Disabled
                      </>
                    )}
                  </button>
                </div>

                <div className="mb-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/70">
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
                      className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/70">
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
                      className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#C5A059] focus:outline-none"
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
                  className="w-full rounded-lg border border-white/10 bg-black/35 p-3 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="flex items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-xs font-semibold text-[#06100D] transition hover:bg-[#d4b26c] disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {isSavingSettings
                    ? "Saving Greeting & Bot Settings..."
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
              {/* Left Column: Create / Edit Quick Reply Form */}
              <div className="rounded-xl border border-[#C5A059]/30 bg-[#0B1914] p-5 lg:col-span-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-serif text-sm font-semibold text-[#C5A059]">
                    {editingQrId ? "Edit Quick Reply (/shortcut)" : "New Quick Reply (/shortcut)"}
                  </h3>
                  {editingQrId && (
                    <button
                      type="button"
                      onClick={resetQuickReplyForm}
                      className="text-xs text-white/50 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/70">
                      Slash Shortcut (type <code className="text-[#C5A059]">/</code> in chat composer)
                    </label>
                    <div className="flex items-center rounded-lg border border-white/10 bg-black/35 px-3 py-2">
                      <span className="mr-1 font-mono text-xs text-[#C5A059]">/</span>
                      <input
                        type="text"
                        value={qrShortcut}
                        onChange={(e) =>
                          setQrShortcut(e.target.value.replace(/^\/+/, ""))
                        }
                        placeholder="docs, bank, location, welcome"
                        className="w-full bg-transparent font-mono text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/70">
                        Title
                      </label>
                      <input
                        type="text"
                        value={qrTitle}
                        onChange={(e) => setQrTitle(e.target.value)}
                        placeholder="Umrah Visa Checklist"
                        className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/70">
                        Category
                      </label>
                      <input
                        type="text"
                        value={qrCategory}
                        onChange={(e) => setQrCategory(e.target.value)}
                        placeholder="documents / payment / general"
                        className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/70">
                      Message Body
                    </label>
                    <textarea
                      rows={5}
                      value={qrBodyText}
                      onChange={(e) => setQrBodyText(e.target.value)}
                      placeholder="Enter the canned response text inserted when an agent selects this /shortcut..."
                      className="w-full rounded-lg border border-white/10 bg-black/35 p-3 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveQuickReply}
                    disabled={isSavingQr}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#C5A059] py-2.5 text-xs font-semibold text-[#06100D] transition hover:bg-[#d4b26c] disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {isSavingQr
                      ? "Saving..."
                      : editingQrId
                        ? "Update Quick Reply"
                        : "Add Quick Reply"}
                  </button>
                </div>
              </div>

              {/* Right Column: Quick Replies List */}
              <div className="space-y-3 lg:col-span-7">
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-white/40" />
                  <input
                    type="text"
                    value={qrSearch}
                    onChange={(e) => setQrSearch(e.target.value)}
                    placeholder="Filter quick replies by /shortcut, title, or text..."
                    className="w-full bg-transparent text-xs text-white focus:outline-none"
                  />
                </div>

                {filteredQuickReplies.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-xs text-white/50">
                    No quick replies match your search. Create a <code className="text-[#C5A059]">/shortcut</code> on the left to speed up agent responses.
                  </div>
                ) : (
                  <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                    {filteredQuickReplies.map((qr) => (
                      <div
                        key={qr.id}
                        className="rounded-xl border border-white/10 bg-[#0B1914] p-3.5 transition hover:border-[#C5A059]/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded border border-[#C5A059]/40 bg-[#C5A059]/15 px-2 py-0.5 font-mono text-xs font-semibold text-[#C5A059]">
                              /{qr.shortcut}
                            </span>
                            <span className="text-xs font-semibold text-[#F4F0E8]">
                              {qr.title}
                            </span>
                            <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/50 uppercase">
                              {qr.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditQuickReply(qr)}
                              className="rounded border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                              title="Edit Quick Reply"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuickReply(qr.id)}
                              className="rounded border border-white/10 bg-white/5 p-1.5 text-white/60 hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300"
                              title="Delete Quick Reply"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <p className="mt-2 line-clamp-2 whitespace-pre-line text-xs text-white/65">
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
      </div>
    </div>
  )
}
