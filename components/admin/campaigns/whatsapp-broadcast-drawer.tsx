"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import {
  Check,
  CheckCheck,
  CheckCircle2,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Sparkles,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  extractTemplatePlaceholders,
  interpolateTemplateVariables,
  type ParsedBroadcastRecipient,
} from "@/lib/whatsapp/template-variables"
import { cn } from "@/lib/utils"

// ==========================================
// Types
// ==========================================

export interface BroadcastRecipientDetail {
  id: string
  contactPhone: string
  status: "pending" | "sent" | "delivered" | "read" | "failed"
  wamid?: string | null
  templateParams?: Record<string, unknown> | string[] | null
  errorCode?: string | null
  errorMessage?: string | null
  failureReason?: string | null
  sentAt?: Date | string | null
  deliveredAt?: Date | string | null
  readAt?: Date | string | null
}

export interface BroadcastSummaryDetail {
  id: string
  name: string
  templateName: string
  templateLanguage?: string | null
  status: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  headerMediaUrl?: string | null
  senderPhone?: string | null
  accountName?: string | null
  scheduledAt?: Date | string | null
  startedAt?: Date | string | null
  completedAt?: Date | string | null
  createdAt?: Date | string | null
}

export interface WhatsappBroadcastDetailsDialogProps {
  open: boolean
  broadcast: BroadcastSummaryDetail | null
  recipients?: BroadcastRecipientDetail[]
  isLoading?: boolean
  onClose: () => void
  onRetryFailed?: (broadcastId: string) => Promise<void> | void
  isRetrying?: boolean
  userRole?: "super_admin" | "staff"
}

export function filterTemplatesForWhatsappAccount<
  T extends { accountId: string; status: string },
>(templates: T[], selectedAccountId: string): T[] {
  if (!selectedAccountId) return []
  return templates.filter(
    (t) => t.accountId === selectedAccountId && t.status === "APPROVED"
  )
}

// ==========================================
// 1. Broadcast Details & Funnel Drawer Modal
// ==========================================

export function WhatsappBroadcastDetailsDialog({
  open,
  broadcast,
  recipients = [],
  isLoading = false,
  onClose,
  onRetryFailed,
  isRetrying = false,
  userRole = "super_admin",
}: WhatsappBroadcastDetailsDialogProps) {
  const [filterTab, setFilterTab] = useState<
    "all" | "delivered_read" | "failed" | "pending"
  >("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredRecipients = useMemo(() => {
    let result = recipients

    if (filterTab === "delivered_read") {
      result = result.filter(
        (r) => r.status === "delivered" || r.status === "read"
      )
    } else if (filterTab === "failed") {
      result = result.filter((r) => r.status === "failed")
    } else if (filterTab === "pending") {
      result = result.filter(
        (r) => r.status === "pending" || r.status === "sent"
      )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (r) =>
          r.contactPhone.toLowerCase().includes(q) ||
          (r.errorMessage && r.errorMessage.toLowerCase().includes(q)) ||
          JSON.stringify(r.templateParams || {}).toLowerCase().includes(q)
      )
    }

    return result
  }, [recipients, filterTab, searchQuery])

  if (!broadcast) return null

  const total = broadcast.totalRecipients || 1
  const sentPercent = Math.min(
    100,
    Math.round((broadcast.sentCount / total) * 100)
  )
  const deliveredPercent = Math.min(
    100,
    Math.round((broadcast.deliveredCount / total) * 100)
  )
  const readPercent = Math.min(
    100,
    Math.round((broadcast.readCount / total) * 100)
  )
  const failedPercent = Math.min(
    100,
    Math.round((broadcast.failedCount / total) * 100)
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden bg-card p-0">
        {/* Header */}
        <DialogHeader className="border-b border-border/60 bg-secondary/40 p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-status-success-bg text-status-success">
                <Radio className="size-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <span>{broadcast.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px] font-semibold capitalize",
                      broadcast.status === "completed"
                        ? "border-status-success-border bg-status-success-bg text-status-success"
                        : broadcast.status === "processing"
                          ? "border-status-info-border bg-status-info-bg text-status-info"
                          : broadcast.status === "scheduled"
                            ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                            : "border-status-danger-border bg-status-danger-bg text-status-danger"
                    )}
                  >
                    {broadcast.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    Template:{" "}
                    <code className="font-semibold text-foreground">
                      {broadcast.templateName}
                    </code>{" "}
                    ({broadcast.templateLanguage || "en_US"})
                  </span>
                  {broadcast.senderPhone && (
                    <span className="inline-flex items-center gap-1">
                      <span>WABA Line:</span>
                      <Smartphone
                        className="size-3 text-gold-text"
                        aria-hidden="true"
                      />
                      <strong className="font-mono text-foreground tabular-nums">
                        {broadcast.senderPhone}
                      </strong>
                    </span>
                  )}
                  {broadcast.headerMediaUrl && (
                    <span>Media Header attached</span>
                  )}
                </DialogDescription>
              </div>
            </div>

            {/* 1-Click Retry Failed Button (Super Admin Only per OD-07) */}
            {broadcast.failedCount > 0 &&
              onRetryFailed &&
              userRole === "super_admin" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onRetryFailed(broadcast.id)}
                  disabled={isRetrying}
                  className="h-8 shrink-0 cursor-pointer gap-1.5 bg-status-warning text-xs font-semibold text-primary-foreground shadow-sm hover:bg-status-warning/90 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <RefreshCw
                    className={cn(
                      "size-3.5",
                      isRetrying && "animate-spin motion-reduce:animate-none"
                    )}
                    aria-hidden="true"
                  />
                  {isRetrying
                    ? "Retrying…"
                    : `Retry Failed (${broadcast.failedCount})`}
                </Button>
              )}
          </div>
        </DialogHeader>

        {/* Funnel Progress Visual Strip */}
        <div className="border-b border-border/50 bg-background p-6 pb-4">
          <div className="mb-3 flex items-center justify-between text-xs font-semibold text-foreground">
            <span>Delivery Funnel Breakdown</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              Total Target:{" "}
              <strong className="font-mono text-foreground tabular-nums">
                {broadcast.totalRecipients}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Sent */}
            <div className="flex flex-col justify-between rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Send
                    className="size-3.5 text-status-info"
                    aria-hidden="true"
                  />
                  Sent
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  {sentPercent}%
                </span>
              </div>
              <div className="mt-2 font-mono text-lg font-bold text-foreground tabular-nums">
                {broadcast.sentCount}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full w-full origin-left bg-status-info transition-transform duration-300 motion-reduce:transition-none"
                  style={{ transform: `scaleX(${sentPercent / 100})` }}
                />
              </div>
            </div>

            {/* Delivered */}
            <div className="flex flex-col justify-between rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check
                    className="size-3.5 text-status-success"
                    aria-hidden="true"
                  />
                  Delivered
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  {deliveredPercent}%
                </span>
              </div>
              <div className="mt-2 font-mono text-lg font-bold text-foreground tabular-nums">
                {broadcast.deliveredCount}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full w-full origin-left bg-status-success transition-transform duration-300 motion-reduce:transition-none"
                  style={{ transform: `scaleX(${deliveredPercent / 100})` }}
                />
              </div>
            </div>

            {/* Read */}
            <div className="flex flex-col justify-between rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCheck
                    className="size-3.5 text-gold-text"
                    aria-hidden="true"
                  />
                  Read (Ticks)
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  {readPercent}%
                </span>
              </div>
              <div className="mt-2 font-mono text-lg font-bold text-foreground tabular-nums">
                {broadcast.readCount}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full w-full origin-left bg-gold transition-transform duration-300 motion-reduce:transition-none"
                  style={{ transform: `scaleX(${readPercent / 100})` }}
                />
              </div>
            </div>

            {/* Failed */}
            <div className="flex flex-col justify-between rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <XCircle
                    className="size-3.5 text-status-danger"
                    aria-hidden="true"
                  />
                  Failed
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  {failedPercent}%
                </span>
              </div>
              <div className="mt-2 font-mono text-lg font-bold text-status-danger tabular-nums">
                {broadcast.failedCount}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full w-full origin-left bg-status-danger transition-transform duration-300 motion-reduce:transition-none"
                  style={{ transform: `scaleX(${failedPercent / 100})` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recipients Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-secondary/40 px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant={filterTab === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterTab("all")}
              className="h-7 cursor-pointer px-2.5 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              All ({recipients.length})
            </Button>
            <Button
              type="button"
              variant={filterTab === "delivered_read" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterTab("delivered_read")}
              className="h-7 cursor-pointer px-2.5 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Delivered / Read (
              {
                recipients.filter(
                  (r) => r.status === "delivered" || r.status === "read"
                ).length
              }
              )
            </Button>
            <Button
              type="button"
              variant={filterTab === "failed" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterTab("failed")}
              className={cn(
                "h-7 cursor-pointer px-2.5 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                filterTab === "failed"
                  ? "bg-status-danger text-primary-foreground hover:bg-status-danger/90"
                  : "text-status-danger"
              )}
            >
              Failed ({recipients.filter((r) => r.status === "failed").length})
            </Button>
            <Button
              type="button"
              variant={filterTab === "pending" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterTab("pending")}
              className="h-7 cursor-pointer px-2.5 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              In Flight (
              {
                recipients.filter(
                  (r) => r.status === "pending" || r.status === "sent"
                ).length
              }
              )
            </Button>
          </div>

          <div className="relative w-48">
            <Search
              className="absolute top-2 left-2.5 size-3 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phone or error…"
              className="h-7 bg-background pr-2 pl-7 text-xs"
            />
          </div>
        </div>

        {/* Recipients Table */}
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-xs text-muted-foreground">
              <Loader2
                className="mb-2 size-6 animate-spin text-primary motion-reduce:animate-none"
                aria-hidden="true"
              />
              Loading recipient dispatches…
            </div>
          ) : filteredRecipients.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No recipients match the selected filter.
            </div>
          ) : (
            <div
              tabIndex={0}
              aria-label="Broadcast recipients status table"
              className="overflow-x-auto rounded-xl bg-secondary/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/60 bg-secondary/60 text-[11px] font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Recipient Phone</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Parameters / Name</th>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Failure Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredRecipients.map((recip) => (
                    <tr key={recip.id} className="hover:bg-secondary/40">
                      <td className="px-3 py-2.5 font-mono font-semibold text-foreground tabular-nums">
                        {recip.contactPhone}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px] font-semibold capitalize",
                            recip.status === "read"
                              ? "border-gold-border bg-accent text-gold-text"
                              : recip.status === "delivered"
                                ? "border-status-success-border bg-status-success-bg text-status-success"
                                : recip.status === "sent"
                                  ? "border-status-info-border bg-status-info-bg text-status-info"
                                  : recip.status === "failed"
                                    ? "border-status-danger-border bg-status-danger-bg text-status-danger"
                                    : "border-border text-muted-foreground"
                          )}
                        >
                          {recip.status}
                        </Badge>
                      </td>
                      <td className="max-w-xs truncate px-3 py-2.5 text-[11px] text-muted-foreground">
                        {recip.templateParams &&
                        Object.keys(recip.templateParams).length > 0 ? (
                          <span className="font-mono text-[10px]">
                            {JSON.stringify(recip.templateParams)}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground/70">
                            Default
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground tabular-nums">
                        {recip.readAt ? (
                          <span className="font-semibold text-gold-text">
                            Read{" "}
                            {new Date(recip.readAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : recip.deliveredAt ? (
                          <span>
                            Delivered{" "}
                            {new Date(recip.deliveredAt).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        ) : recip.sentAt ? (
                          <span>
                            Sent{" "}
                            {new Date(recip.sentAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="max-w-xs px-3 py-2.5 text-[11px] text-status-danger">
                        {recip.errorMessage || recip.failureReason ? (
                          <span
                            title={
                              recip.errorMessage || recip.failureReason || ""
                            }
                            className="line-clamp-1"
                          >
                            {recip.errorCode && `[${recip.errorCode}] `}
                            {recip.errorMessage || recip.failureReason}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between border-t border-border/40 bg-secondary/40 p-4">
          <div className="text-[11px] text-muted-foreground tabular-nums">
            Showing {filteredRecipients.length} of {recipients.length} recipients
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const WhatsappBroadcastDrawer = WhatsappBroadcastDetailsDialog

// ==========================================
// 2. Reusable Broadcast Personalizer Subcomponent
// ==========================================

export interface WhatsappBroadcastPersonalizerFieldsProps {
  templateBodyText?: string
  templateHeaderType?: string | null
  headerMediaUrl: string
  onHeaderMediaUrlChange: (url: string) => void
  templateParams: Record<string, string>
  onTemplateParamsChange: (params: Record<string, string>) => void
  csvText: string
  onCsvTextChange: (csvText: string) => void
  parsedRecipients?: ParsedBroadcastRecipient[]
  csvErrors?: string[]
}

export function WhatsappBroadcastPersonalizerFields({
  templateBodyText = "",
  templateHeaderType = "NONE",
  headerMediaUrl,
  onHeaderMediaUrlChange,
  templateParams,
  onTemplateParamsChange,
  csvText,
  onCsvTextChange,
  parsedRecipients = [],
  csvErrors = [],
}: WhatsappBroadcastPersonalizerFieldsProps) {
  const placeholders = useMemo(() => {
    return extractTemplatePlaceholders(templateBodyText)
  }, [templateBodyText])

  const sampleContact = useMemo(() => {
    return {
      name: parsedRecipients[0]?.name || "Muhammad Ali",
      phone: parsedRecipients[0]?.phone || "+923008451122",
    }
  }, [parsedRecipients])

  const simulatedPreview = useMemo(() => {
    return interpolateTemplateVariables(
      templateBodyText,
      templateParams,
      sampleContact
    )
  }, [templateBodyText, templateParams, sampleContact])

  const handleParamChange = (index: number, value: string) => {
    onTemplateParamsChange({
      ...templateParams,
      [String(index)]: value,
    })
  }

  const handleInsertToken = (index: number, token: "{{name}}" | "{{phone}}") => {
    const current = templateParams[String(index)] || ""
    handleParamChange(index, `${current} ${token}`.trim())
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Media Header URL input (if template has media) */}
      {(templateHeaderType === "IMAGE" ||
        templateHeaderType === "DOCUMENT" ||
        templateHeaderType === "VIDEO") && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-secondary/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <ImageIcon
                className="size-3.5 text-status-success"
                aria-hidden="true"
              />
              Header Media URL ({templateHeaderType})
            </Label>
            <span className="text-[10px] text-muted-foreground">
              Direct HTTPS image or PDF link
            </span>
          </div>
          <Input
            value={headerMediaUrl}
            onChange={(e) => onHeaderMediaUrlChange(e.target.value)}
            placeholder="https://.../posters/ramadan_offer.jpg"
            className="h-8 bg-background font-mono text-xs"
          />
        </div>
      )}

      {/* Dynamic Placeholder Variable Inputs */}
      {placeholders.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl bg-secondary/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles
                className="size-3.5 text-gold-text"
                aria-hidden="true"
              />
              Template Parameters ({placeholders.length} detected)
            </Label>
            <span className="text-[10px] text-muted-foreground">
              Supports static text or dynamic tokens (&#123;&#123;name&#125;&#125;, &#123;&#123;phone&#125;&#125;)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {placeholders.map((idx) => {
              const val = templateParams[String(idx)] || ""
              return (
                <div
                  key={idx}
                  className="flex flex-col gap-1.5 rounded-lg bg-background p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-primary">
                      Placeholder{" "}
                      <span className="font-mono">
                        &#123;&#123;{idx}&#125;&#125;
                      </span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleInsertToken(idx, "{{name}}")}
                        className="cursor-pointer whitespace-nowrap rounded bg-status-success-bg px-1.5 py-0.5 text-[10px] font-semibold text-status-success hover:bg-status-success-border/40 active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {"+ {{name}}"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertToken(idx, "{{phone}}")}
                        className="cursor-pointer whitespace-nowrap rounded bg-status-info-bg px-1.5 py-0.5 text-[10px] font-semibold text-status-info hover:bg-status-info-border/40 active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {"+ {{phone}}"}
                      </button>
                    </div>
                  </div>
                  <Input
                    value={val}
                    onChange={(e) => handleParamChange(idx, e.target.value)}
                    placeholder={`e.g. Ramadan 2027 or {{name}}`}
                    className="h-7 text-xs"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* CSV Ingestion Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-xs font-semibold">
            <FileSpreadsheet
              className="size-3.5 text-status-success"
              aria-hidden="true"
            />
            CSV Recipient Import (Paste or Upload)
          </Label>
          <span className="text-[10px] text-muted-foreground">
            Format: <code>name,phone</code> or <code>phone,name</code>
          </span>
        </div>

        <Textarea
          value={csvText}
          onChange={(e) => onCsvTextChange(e.target.value)}
          placeholder={`Name,Phone\nMuhammad Ali,03001234567\nUsman Tariq,+923219876543\nFatima Bibi,03451122334`}
          rows={4}
          className="resize-none bg-background font-mono text-xs"
        />

        {parsedRecipients.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-status-success-bg px-2.5 py-1.5 text-[11px] font-medium text-status-success">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Successfully parsed{" "}
                <strong className="font-mono tabular-nums">
                  {parsedRecipients.length}
                </strong>{" "}
                unique recipients
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              Sample:{" "}
              <span className="font-mono tabular-nums">
                {parsedRecipients[0]?.phone}
              </span>{" "}
              ({parsedRecipients[0]?.name || "No Name"})
            </span>
          </div>
        )}

        {csvErrors && csvErrors.length > 0 && (
          <div className="rounded-lg bg-status-warning-bg p-2.5 text-[11px] text-status-warning">
            <span className="font-semibold">CSV Warnings:</span>
            <ul className="mt-1 list-disc pl-4 text-[10px]">
              {csvErrors.slice(0, 3).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {csvErrors.length > 3 && (
                <li>…and {csvErrors.length - 3} more invalid rows.</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Live Preview Bubble */}
      {templateBodyText && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">
            Live Preview for First Recipient ({sampleContact.name}):
          </Label>
          <div className="rounded-xl bg-secondary/60 p-3 text-xs">
            <div className="rounded-lg bg-background p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-foreground shadow-2xs">
              {simulatedPreview}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
