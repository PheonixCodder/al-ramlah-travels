"use client"

import * as React from "react"
import {
  Check,
  FileText,
  Image as ImageIcon,
  Layers,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createWhatsAppTemplateAction,
  deleteWhatsAppTemplateAction,
  syncWhatsappTemplatesAction,
} from "@/app/actions/whatsapp-crm"
import { extractTemplatePlaceholders } from "@/lib/whatsapp/template-variables"

export type MetaTemplateHeaderType =
  | "NONE"
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT"

export type MetaTemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION"

export interface MetaTemplateAccountOption {
  id: string
  name: string
  displayPhoneNumber: string
  wabaId?: string
  status?: string
}

export interface MetaTemplateRecordItem {
  id: string
  accountId: string
  metaTemplateId: string
  name: string
  language: string
  category: MetaTemplateCategory
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED"
  headerType?: string | null
  headerContent?: string | null
  bodyText: string
  footerText?: string | null
  buttons?: Array<Record<string, unknown>> | null
}

export interface MetaTemplateButtonDraft {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"
  text: string
  url?: string
  phone_number?: string
}

export interface MetaTemplateBuilderModalProps {
  open: boolean
  onClose: () => void
  accounts: MetaTemplateAccountOption[]
  activeAccountId?: string
  templates: MetaTemplateRecordItem[]
  onTemplatesChange: (templates: MetaTemplateRecordItem[]) => void
  canManageTemplates?: boolean
}

function formatHeaderTypeLabel(headerType?: string | null): string {
  switch ((headerType || "NONE").toUpperCase()) {
    case "TEXT":
      return "Text"
    case "IMAGE":
      return "Image"
    case "DOCUMENT":
      return "Document"
    case "VIDEO":
      return "Video"
    default:
      return "None"
  }
}

function formatTemplateStatusLabel(
  status: MetaTemplateRecordItem["status"]
): string {
  switch (status) {
    case "APPROVED":
      return "Approved"
    case "REJECTED":
      return "Rejected"
    case "PAUSED":
      return "Paused"
    case "DISABLED":
      return "Disabled"
    case "PENDING":
    default:
      return "Pending"
  }
}

export function MetaTemplateBuilderModal({
  open,
  onClose,
  accounts,
  activeAccountId,
  templates,
  onTemplatesChange,
  canManageTemplates = true,
}: MetaTemplateBuilderModalProps) {
  const initialAccountId = activeAccountId || accounts[0]?.id || ""
  const bodyKey = `${initialAccountId || "default"}-${open ? "open" : "closed"}`

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
        <MetaTemplateBuilderBody
          key={bodyKey}
          onClose={onClose}
          accounts={accounts}
          initialAccountId={initialAccountId}
          templates={templates}
          onTemplatesChange={onTemplatesChange}
          canManageTemplates={canManageTemplates}
        />
      </DialogContent>
    </Dialog>
  )
}

interface MetaTemplateBuilderBodyProps {
  onClose: () => void
  accounts: MetaTemplateAccountOption[]
  initialAccountId: string
  templates: MetaTemplateRecordItem[]
  onTemplatesChange: (templates: MetaTemplateRecordItem[]) => void
  canManageTemplates: boolean
}

function MetaTemplateBuilderBody({
  onClose,
  accounts,
  initialAccountId,
  templates,
  onTemplatesChange,
  canManageTemplates,
}: MetaTemplateBuilderBodyProps) {
  const [userSelectedAccountId, setUserSelectedAccountId] =
    React.useState<string>(initialAccountId)
  const selectedAccountId = userSelectedAccountId || accounts[0]?.id || ""
  const [activeSubTab, setActiveSubTab] = React.useState<"builder" | "library">(
    "builder"
  )
  const [statusBanner, setStatusBanner] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Builder form state
  const [name, setName] = React.useState("ramadan_vip_umrah_offer")
  const [category, setCategory] =
    React.useState<MetaTemplateCategory>("MARKETING")
  const [language, setLanguage] = React.useState("en_US")
  const [headerType, setHeaderType] =
    React.useState<MetaTemplateHeaderType>("NONE")
  const [headerText, setHeaderText] = React.useState("")
  const [headerHandle, setHeaderHandle] = React.useState("")
  const [headerMediaUrl, setHeaderMediaUrl] = React.useState("")
  const [bodyText, setBodyText] = React.useState(
    "Assalam-o-Alaikum {{1}}! Al Ramlah Travels (Askari 10, Lahore Cantt) invites you to review our {{2}} Luxury Umrah package. Reply for your itemized itinerary or tap STOP to opt out."
  )
  const [sampleValuesByVar, setSampleValuesByVar] = React.useState<
    Record<number, string>
  >({
    1: "Brother Ahmad",
    2: "15-Day Haram View",
  })
  const [footerText, setFooterText] = React.useState(
    "Al Ramlah Travels, Askari 10 Lahore, Reply STOP to opt out"
  )
  const [buttons, setButtons] = React.useState<MetaTemplateButtonDraft[]>([
    { type: "QUICK_REPLY", text: "Send Package PDF" },
    { type: "QUICK_REPLY", text: "Talk to Consultant" },
  ])

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [deletingTemplateName, setDeletingTemplateName] = React.useState<
    string | null
  >(null)

  const bodyPlaceholders = React.useMemo(
    () => extractTemplatePlaceholders(bodyText),
    [bodyText]
  )

  const accountTemplates = React.useMemo(() => {
    if (!selectedAccountId) return templates
    return templates.filter((t) => t.accountId === selectedAccountId)
  }, [templates, selectedAccountId])

  const previewBody = React.useMemo(() => {
    return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_match, rawIdx) => {
      const idx = Number.parseInt(String(rawIdx), 10)
      return sampleValuesByVar[idx]?.trim() || `[Sample {{${idx}}}]`
    })
  }, [bodyText, sampleValuesByVar])

  const normalizeSlug = (raw: string) =>
    raw
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 64)

  const handleAddButton = () => {
    if (buttons.length >= 3) return
    setButtons((prev) => [
      ...prev,
      { type: "QUICK_REPLY", text: "View Details" },
    ])
  }

  const handleUpdateButton = (
    idx: number,
    patch: Partial<MetaTemplateButtonDraft>
  ) => {
    setButtons((prev) =>
      prev.map((btn, i) => (i === idx ? { ...btn, ...patch } : btn))
    )
  }

  const handleRemoveButton = (idx: number) => {
    setButtons((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmitTemplate = async () => {
    setStatusBanner(null)
    if (!canManageTemplates) {
      setStatusBanner({
        type: "error",
        message: "Super Admin permissions are required to submit Meta templates.",
      })
      return
    }

    const cleanName = normalizeSlug(name).replace(/^_+|_+$/g, "")
    if (!cleanName || cleanName.length < 2) {
      setStatusBanner({
        type: "error",
        message:
          "Template name must contain at least 2 lowercase letters, digits, or underscores.",
      })
      return
    }

    if (!bodyText.trim()) {
      setStatusBanner({
        type: "error",
        message: "Template body text is required.",
      })
      return
    }

    if (headerType === "TEXT" && !headerText.trim()) {
      setStatusBanner({
        type: "error",
        message: "Header text is required when Header Type is TEXT.",
      })
      return
    }

    if (
      (headerType === "IMAGE" ||
        headerType === "DOCUMENT" ||
        headerType === "VIDEO") &&
      !headerHandle.trim() &&
      !headerMediaUrl.trim()
    ) {
      setStatusBanner({
        type: "error",
        message: `Meta requires a sample media handle or HTTPS URL for ${headerType} headers (example.header_handle).`,
      })
      return
    }

    const orderedBodyExamples = bodyPlaceholders.map(
      (varNum) => sampleValuesByVar[varNum]?.trim() || ""
    )
    if (
      bodyPlaceholders.length > 0 &&
      orderedBodyExamples.some((val) => val.length === 0)
    ) {
      setStatusBanner({
        type: "error",
        message:
          "Please fill sample values for every {{N}} body variable (required by Meta example.body_text).",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const cleanedButtons = buttons
        .map((b) => ({
          type: b.type,
          text: b.text.trim().slice(0, 25),
          ...(b.type === "URL" && b.url?.trim() ? { url: b.url.trim() } : {}),
          ...(b.type === "PHONE_NUMBER" && b.phone_number?.trim()
            ? { phone_number: b.phone_number.trim() }
            : {}),
        }))
        .filter((b) => b.text.length > 0)
        .slice(0, 3)

      const res = await createWhatsAppTemplateAction({
        accountId: selectedAccountId || undefined,
        name: cleanName,
        category,
        language,
        headerType,
        headerText: headerType === "TEXT" ? headerText.trim() : undefined,
        headerHandle:
          headerType === "IMAGE" ||
          headerType === "DOCUMENT" ||
          headerType === "VIDEO"
            ? headerHandle.trim() || undefined
            : undefined,
        headerMediaUrl:
          headerType === "IMAGE" ||
          headerType === "DOCUMENT" ||
          headerType === "VIDEO"
            ? headerMediaUrl.trim() || undefined
            : undefined,
        bodyText: bodyText.trim(),
        bodyExamples:
          orderedBodyExamples.length > 0 ? orderedBodyExamples : undefined,
        footerText: footerText.trim() || undefined,
        buttons: cleanedButtons.length > 0 ? cleanedButtons : undefined,
      })

      if (!res.success || !res.template) {
        setStatusBanner({
          type: "error",
          message: res.error || "Meta Graph API rejected template creation.",
        })
        return
      }

      const created = res.template as unknown as MetaTemplateRecordItem
      const nextList = [
        created,
        ...templates.filter((t) => t.id !== created.id),
      ]
      onTemplatesChange(nextList)
      setStatusBanner({
        type: "success",
        message: `Submitted "${created.name}" (${created.status}) to Meta Business Manager.`,
      })
      setActiveSubTab("library")
    } catch (err) {
      setStatusBanner({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to submit Meta template.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSyncFromMeta = async () => {
    setStatusBanner(null)
    if (!selectedAccountId) {
      setStatusBanner({
        type: "error",
        message: "Please select an Official Meta WhatsApp Cloud API account first.",
      })
      return
    }
    setIsSyncing(true)
    try {
      const res = await syncWhatsappTemplatesAction(selectedAccountId)
      if (!res.success) {
        setStatusBanner({
          type: "error",
          message: res.error || "Could not sync templates from Meta WABA.",
        })
        return
      }
      setStatusBanner({
        type: "success",
        message: `Synced ${res.count ?? 0} templates from Meta Cloud API v21.0. Reloading latest statuses...`,
      })
    } catch (err) {
      setStatusBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Template sync failed.",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDeleteTemplate = async (tpl: MetaTemplateRecordItem) => {
    if (!canManageTemplates) return
    setStatusBanner(null)
    setDeletingTemplateName(tpl.name)
    try {
      const res = await deleteWhatsAppTemplateAction({
        accountId: tpl.accountId,
        templateName: tpl.name,
      })
      if (!res.success) {
        setStatusBanner({
          type: "error",
          message: res.error || "Failed to delete template on Meta.",
        })
        return
      }
      onTemplatesChange(
        templates.filter(
          (item) =>
            !(item.accountId === tpl.accountId && item.name === tpl.name)
        )
      )
      setStatusBanner({
        type: "success",
        message: `Deleted template "${tpl.name}" from Meta WABA and local catalog.`,
      })
    } catch (err) {
      setStatusBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Delete template failed.",
      })
    } finally {
      setDeletingTemplateName(null)
    }
  }

  return (
    <>
      {/* Haramain Emerald Header */}
      <div className="flex items-center justify-between border-b border-gold-border/40 bg-primary px-6 py-4 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-border/50 bg-gold/15 text-gold">
            <Layers className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="font-display text-lg font-semibold text-primary-foreground">
                Meta WhatsApp Template Studio
              </DialogTitle>
              <span className="rounded-full border border-gold-border/50 bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                Graph API v21.0
              </span>
            </div>
            <DialogDescription className="text-xs text-primary-foreground/85">
              Author HSM templates with Image or Document header handles and{" "}
              {"{{1}}"} variable samples for 24h+ re-engagement and broadcasts.
            </DialogDescription>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncFromMeta}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gold-border/50 bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin motion-reduce:animate-none" : ""}`}
              aria-hidden="true"
            />
            {isSyncing ? "Syncing…" : "Sync WABA"}
          </button>
          <DialogClose
            render={
              <button
                type="button"
                aria-label="Close Meta Template Studio"
                className="rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 p-2 text-primary-foreground/85 transition-colors hover:bg-primary-foreground/20 hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
              />
            }
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogClose>
        </div>
      </div>

      {statusBanner && (
        <div
          role="status"
          className={`flex items-center justify-between border-b px-6 py-2.5 text-xs font-medium ${
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

      {/* Sub-navigation + WABA Account Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/60 px-6 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("builder")}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none ${
              activeSubTab === "builder"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Create New Template
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("library")}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none ${
              activeSubTab === "library"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            WABA Template Library ({accountTemplates.length})
          </button>
        </div>

        {accounts.length > 0 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="meta-tpl-waba-select"
              className="text-[11px] font-medium text-muted-foreground"
            >
              WABA Line:
            </label>
            <select
              id="meta-tpl-waba-select"
              value={selectedAccountId}
              onChange={(e) => setUserSelectedAccountId(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.displayPhoneNumber})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeSubTab === "builder" ? (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left 7 cols: Form */}
            <div className="space-y-4 lg:col-span-7">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <label
                    htmlFor="meta-tpl-name"
                    className="mb-1 block text-[11px] font-semibold text-foreground"
                  >
                    Template Slug (a-z, 0-9, _)
                  </label>
                  <input
                    id="meta-tpl-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(normalizeSlug(e.target.value))}
                    placeholder="umrah_vip_followup"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="meta-tpl-category"
                    className="mb-1 block text-[11px] font-semibold text-foreground"
                  >
                    Meta Category
                  </label>
                  <select
                    id="meta-tpl-category"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as MetaTemplateCategory)
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <option value="MARKETING">Marketing (Promotions)</option>
                    <option value="UTILITY">Utility (Dossier / Visa Updates)</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="meta-tpl-language"
                    className="mb-1 block text-[11px] font-semibold text-foreground"
                  >
                    Language Code
                  </label>
                  <select
                    id="meta-tpl-language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <option value="en_US">English (en_US)</option>
                    <option value="en">English Generic (en)</option>
                    <option value="ur">Urdu (ur)</option>
                    <option value="ar">Arabic (ar)</option>
                  </select>
                </div>
              </div>

              {/* Header Configuration */}
              <div className="space-y-3 rounded-xl bg-secondary/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Header Component (Optional)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        "NONE",
                        "TEXT",
                        "IMAGE",
                        "DOCUMENT",
                        "VIDEO",
                      ] as MetaTemplateHeaderType[]
                    ).map((ht) => (
                      <button
                        key={ht}
                        type="button"
                        onClick={() => setHeaderType(ht)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none ${
                          headerType === ht
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {formatHeaderTypeLabel(ht)}
                      </button>
                    ))}
                  </div>
                </div>

                {headerType === "TEXT" && (
                  <div>
                    <label
                      htmlFor="meta-tpl-header-text"
                      className="mb-1 block text-[11px] font-medium text-muted-foreground"
                    >
                      Header Headline (max 60 chars)
                    </label>
                    <input
                      id="meta-tpl-header-text"
                      type="text"
                      maxLength={60}
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      placeholder="Al Ramlah Travels, Haramain Concierge"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>
                )}

                {(headerType === "IMAGE" ||
                  headerType === "DOCUMENT" ||
                  headerType === "VIDEO") && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="meta-tpl-header-handle"
                        className="mb-1 block text-[11px] font-medium text-foreground"
                      >
                        Meta Resumable Upload Handle (example.header_handle)
                      </label>
                      <input
                        id="meta-tpl-header-handle"
                        type="text"
                        value={headerHandle}
                        onChange={(e) => setHeaderHandle(e.target.value)}
                        placeholder="4::aW1hZ2UvanBlZw==…"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="meta-tpl-header-url"
                        className="mb-1 block text-[11px] font-medium text-foreground"
                      >
                        Or Sample HTTPS Media URL (Flyer / PDF)
                      </label>
                      <input
                        id="meta-tpl-header-url"
                        type="url"
                        value={headerMediaUrl}
                        onChange={(e) => setHeaderMediaUrl(e.target.value)}
                        placeholder="https://cdn.alramlahtravels.com/sample.pdf"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Body Text + Dynamic {{1}} Sample Values */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="meta-tpl-body"
                    className="text-xs font-semibold text-foreground"
                  >
                    Body Copy (supports {"{{1}}"}, {"{{2}}"} positional variables)
                  </label>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {bodyText.length}/1024 chars
                  </span>
                </div>
                <textarea
                  id="meta-tpl-body"
                  rows={4}
                  maxLength={1024}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />

                {bodyPlaceholders.length > 0 && (
                  <div className="space-y-2.5 rounded-xl bg-status-warning-bg/70 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-primary">
                        Required Meta Review Variable Samples (example.body_text)
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {bodyPlaceholders.length} variable
                        {bodyPlaceholders.length === 1 ? "" : "s"} detected
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {bodyPlaceholders.map((varNum) => (
                        <div key={varNum}>
                          <label
                            htmlFor={`meta-tpl-sample-${varNum}`}
                            className="mb-1 block text-[11px] font-semibold text-foreground"
                          >
                            Sample for{" "}
                            <code className="font-mono">{`{{${varNum}}}`}</code>
                          </label>
                          <input
                            id={`meta-tpl-sample-${varNum}`}
                            type="text"
                            value={sampleValuesByVar[varNum] ?? ""}
                            onChange={(e) =>
                              setSampleValuesByVar((prev) => ({
                                ...prev,
                                [varNum]: e.target.value,
                              }))
                            }
                            placeholder={
                              varNum === 1
                                ? "e.g. Haji Muhammad Tariq"
                                : "e.g. 15-Day Ramadan Umrah"
                            }
                            className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer + Interactive Buttons */}
              <div className="grid gap-4 sm:grid-cols-12">
                <div className="sm:col-span-12">
                  <label
                    htmlFor="meta-tpl-footer"
                    className="mb-1 block text-[11px] font-semibold text-foreground"
                  >
                    Optional Footer (max 60 chars, include STOP opt-out notice for marketing)
                  </label>
                  <input
                    id="meta-tpl-footer"
                    type="text"
                    maxLength={60}
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                </div>

                <div className="space-y-2 sm:col-span-12">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground">
                      Template Buttons (up to 3)
                    </span>
                    {buttons.length < 3 && (
                      <button
                        type="button"
                        onClick={handleAddButton}
                        className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-background px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" /> Add Button
                      </button>
                    )}
                  </div>

                  {buttons.map((btn, idx) => (
                    <div
                      key={idx}
                      className="grid gap-2 rounded-lg bg-secondary/60 p-2.5 sm:grid-cols-12"
                    >
                      <div className="sm:col-span-4">
                        <select
                          aria-label={`Button ${idx + 1} type`}
                          value={btn.type}
                          onChange={(e) =>
                            handleUpdateButton(idx, {
                              type: e.target
                                .value as MetaTemplateButtonDraft["type"],
                            })
                          }
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <option value="QUICK_REPLY">Quick Reply</option>
                          <option value="URL">Website URL</option>
                          <option value="PHONE_NUMBER">Call Phone</option>
                        </select>
                      </div>

                      <div
                        className={
                          btn.type === "QUICK_REPLY"
                            ? "sm:col-span-7"
                            : "sm:col-span-3"
                        }
                      >
                        <input
                          type="text"
                          maxLength={25}
                          value={btn.text}
                          onChange={(e) =>
                            handleUpdateButton(idx, { text: e.target.value })
                          }
                          placeholder="Button label (max 25)"
                          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        />
                      </div>

                      {btn.type === "URL" && (
                        <div className="sm:col-span-4">
                          <input
                            type="url"
                            value={btn.url || ""}
                            onChange={(e) =>
                              handleUpdateButton(idx, { url: e.target.value })
                            }
                            placeholder="https://alramlahtravels.com"
                            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          />
                        </div>
                      )}

                      {btn.type === "PHONE_NUMBER" && (
                        <div className="sm:col-span-4">
                          <input
                            type="tel"
                            value={btn.phone_number || ""}
                            onChange={(e) =>
                              handleUpdateButton(idx, {
                                phone_number: e.target.value,
                              })
                            }
                            placeholder="+923274029701"
                            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-end sm:col-span-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveButton(idx)}
                          aria-label={`Remove button ${idx + 1}`}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSubmitTemplate}
                  disabled={isSubmitting || !canManageTemplates}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  <ShieldCheck className="h-4 w-4 text-gold" aria-hidden="true" />
                  {isSubmitting
                    ? "Submitting to Meta…"
                    : "Submit Template for Meta Approval"}
                </button>
              </div>
            </div>

            {/* Right 5 cols: Live WhatsApp Bubble Preview */}
            <div className="lg:col-span-5">
              <div className="sticky top-0 rounded-2xl bg-secondary/80 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">
                    Live Pilgrim Handset Preview
                  </span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {category} · {language}
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-popover shadow-xs">
                  {headerType === "TEXT" && headerText.trim() && (
                    <div className="border-b border-border px-3.5 pt-3 pb-1.5 text-xs font-bold text-foreground">
                      {headerText}
                    </div>
                  )}
                  {(headerType === "IMAGE" ||
                    headerType === "DOCUMENT" ||
                    headerType === "VIDEO") && (
                    <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-3.5 py-4 text-xs font-medium text-primary">
                      {headerType === "IMAGE" && (
                        <ImageIcon
                          className="h-4 w-4 text-gold-text"
                          aria-hidden="true"
                        />
                      )}
                      {headerType === "DOCUMENT" && (
                        <FileText
                          className="h-4 w-4 text-gold-text"
                          aria-hidden="true"
                        />
                      )}
                      {headerType === "VIDEO" && (
                        <Video
                          className="h-4 w-4 text-gold-text"
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">
                        {formatHeaderTypeLabel(headerType)} Header (
                        {headerMediaUrl ||
                          headerHandle ||
                          "Sample Handle Required"}
                        )
                      </span>
                    </div>
                  )}

                  <div className="whitespace-pre-line px-3.5 py-3 text-xs leading-relaxed text-foreground">
                    {previewBody}
                  </div>

                  {footerText.trim() && (
                    <div className="px-3.5 pb-2.5 text-[11px] text-muted-foreground">
                      {footerText}
                    </div>
                  )}

                  {buttons.filter((b) => b.text.trim()).length > 0 && (
                    <div className="divide-y divide-border border-t border-border bg-secondary/40">
                      {buttons
                        .filter((b) => b.text.trim())
                        .map((btn, i) => (
                          <div
                            key={i}
                            className="py-2 text-center text-xs font-semibold text-primary"
                          >
                            {btn.text}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  <Check
                    className="mr-1 inline h-3.5 w-3.5 text-status-success"
                    aria-hidden="true"
                  />
                  Once Meta marks this template <strong>Approved</strong>, it
                  becomes immediately selectable in the Desk 24h+ Re-Engagement
                  Composer and Campaigns Broadcast Drawer.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {accountTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-10 text-center">
                <FileText
                  className="mx-auto h-8 w-8 text-gold-text"
                  aria-hidden="true"
                />
                <h4 className="mt-2 font-display text-sm font-semibold text-foreground">
                  No Meta Templates Found for Selected WABA
                </h4>
                <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                  Click &ldquo;Sync WABA&rdquo; above to import existing Meta
                  Business Manager templates, or create a new template in the
                  builder tab.
                </p>
              </div>
            ) : (
              accountTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-secondary/60 p-4"
                >
                  <div className="max-w-2xl space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">
                        {tpl.name}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          tpl.status === "APPROVED"
                            ? "border-status-success-border bg-status-success-bg text-status-success"
                            : tpl.status === "REJECTED"
                              ? "border-status-danger-border bg-status-danger-bg text-status-danger"
                              : "border-status-warning-border bg-status-warning-bg text-status-warning"
                        }`}
                      >
                        {formatTemplateStatusLabel(tpl.status)}
                      </span>
                      <span className="rounded border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {tpl.category} · {tpl.language}
                        {tpl.headerType && tpl.headerType !== "NONE"
                          ? ` (Header: ${formatHeaderTypeLabel(tpl.headerType)})`
                          : ""}
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-xs text-muted-foreground">
                      {tpl.bodyText}
                    </p>
                  </div>

                  {canManageTemplates && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl)}
                      disabled={deletingTemplateName === tpl.name}
                      className="inline-flex items-center gap-1 rounded-lg border border-status-danger-border bg-status-danger-bg px-2.5 py-1.5 text-xs font-medium text-status-danger hover:bg-status-danger-bg/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {deletingTemplateName === tpl.name
                        ? "Deleting…"
                        : "Delete"}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}
