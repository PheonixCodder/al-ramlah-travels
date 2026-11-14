"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Image as ImageIcon,
  Loader2,
  Phone,
  Radio,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Users,
  X,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  parseWhatsappBroadcastCsv,
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
                <Radio className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>{broadcast.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold uppercase",
                      broadcast.status === "completed"
                        ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/10"
                        : broadcast.status === "processing"
                        ? "border-blue-500/40 text-blue-700 bg-blue-500/10"
                        : broadcast.status === "scheduled"
                        ? "border-amber-500/40 text-amber-700 bg-amber-500/10"
                        : "border-rose-500/40 text-rose-700 bg-rose-500/10"
                    )}
                  >
                    {broadcast.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Template:{" "}
                  <code className="font-semibold text-foreground">
                    {broadcast.templateName}
                  </code>{" "}
                  ({broadcast.templateLanguage || "en_US"})
                  {broadcast.senderPhone && (
                    <> &bull; WABA Line: <strong className="text-foreground">📱 {broadcast.senderPhone}</strong></>
                  )}
                  {broadcast.headerMediaUrl && " • Media Header attached"}
                </DialogDescription>
              </div>
            </div>

            {/* 1-Click Retry Failed Button */}
            {broadcast.failedCount > 0 && onRetryFailed && (
              <Button
                type="button"
                size="sm"
                onClick={() => onRetryFailed(broadcast.id)}
                disabled={isRetrying}
                className="h-8 gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm shrink-0"
              >
                <RefreshCw
                  className={cn("size-3.5", isRetrying && "animate-spin")}
                />
                {isRetrying
                  ? "Retrying..."
                  : `Retry Failed (${broadcast.failedCount})`}
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Funnel Progress Visual Strip */}
        <div className="p-6 pb-4 border-b border-border/50 bg-background">
          <div className="text-xs font-semibold text-foreground mb-3 flex items-center justify-between">
            <span>Delivery Funnel Breakdown</span>
            <span className="text-[11px] text-muted-foreground font-normal">
              Total Target:{" "}
              <strong className="text-foreground">
                {broadcast.totalRecipients}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Sent */}
            <div className="rounded-lg border border-border/70 p-3 bg-muted/15 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Send className="size-3.5 text-blue-600" />
                  Sent
                </span>
                <span className="font-mono text-[10px]">{sentPercent}%</span>
              </div>
              <div className="mt-2 text-lg font-bold text-foreground">
                {broadcast.sentCount}
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${sentPercent}%` }}
                />
              </div>
            </div>

            {/* Delivered */}
            <div className="rounded-lg border border-border/70 p-3 bg-muted/15 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-600" />
                  Delivered
                </span>
                <span className="font-mono text-[10px]">
                  {deliveredPercent}%
                </span>
              </div>
              <div className="mt-2 text-lg font-bold text-foreground">
                {broadcast.deliveredCount}
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${deliveredPercent}%` }}
                />
              </div>
            </div>

            {/* Read */}
            <div className="rounded-lg border border-border/70 p-3 bg-muted/15 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCheck className="size-3.5 text-violet-600" />
                  Read (Ticks)
                </span>
                <span className="font-mono text-[10px]">{readPercent}%</span>
              </div>
              <div className="mt-2 text-lg font-bold text-foreground">
                {broadcast.readCount}
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-violet-600 transition-all duration-300"
                  style={{ width: `${readPercent}%` }}
                />
              </div>
            </div>

            {/* Failed */}
            <div className="rounded-lg border border-border/70 p-3 bg-muted/15 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <XCircle className="size-3.5 text-rose-600" />
                  Failed
                </span>
                <span className="font-mono text-[10px]">{failedPercent}%</span>
              </div>
              <div className="mt-2 text-lg font-bold text-rose-600">
                {broadcast.failedCount}
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-rose-600 transition-all duration-300"
                  style={{ width: `${failedPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recipients Filter Bar */}
        <div className="px-6 py-2.5 border-b border-border/40 bg-muted/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant={filterTab === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterTab("all")}
              className="h-7 text-[11px] px-2.5"
            >
              All ({recipients.length})
            </Button>
            <Button
              type="button"
              variant={filterTab === "delivered_read" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterTab("delivered_read")}
              className="h-7 text-[11px] px-2.5"
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
              className="h-7 text-[11px] px-2.5 text-rose-700"
            >
              Failed ({recipients.filter((r) => r.status === "failed").length})
            </Button>
            <Button
              type="button"
              variant={filterTab === "pending" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterTab("pending")}
              className="h-7 text-[11px] px-2.5"
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
            <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phone or error..."
              className="h-7 text-xs pl-7 pr-2"
            />
          </div>
        </div>

        {/* Recipients Table */}
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center">
              <Loader2 className="size-6 animate-spin text-emerald-600 mb-2" />
              Loading recipient dispatches...
            </div>
          ) : filteredRecipients.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No recipients match the selected filter.
            </div>
          ) : (
            <div className="rounded-lg border border-border/70 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[11px] font-semibold text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="px-3 py-2">Recipient Phone</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Parameters / Name</th>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Failure Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredRecipients.map((recip) => (
                    <tr key={recip.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-mono text-foreground font-semibold">
                        {recip.contactPhone}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold uppercase",
                            recip.status === "read"
                              ? "border-violet-500/40 text-violet-700 bg-violet-500/10"
                              : recip.status === "delivered"
                              ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/10"
                              : recip.status === "sent"
                              ? "border-blue-500/40 text-blue-700 bg-blue-500/10"
                              : recip.status === "failed"
                              ? "border-rose-500/40 text-rose-700 bg-rose-500/10"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {recip.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-xs truncate text-[11px]">
                        {recip.templateParams &&
                        Object.keys(recip.templateParams).length > 0 ? (
                          <span className="font-mono text-[10px]">
                            {JSON.stringify(recip.templateParams)}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground/60">
                            Default
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-[11px]">
                        {recip.readAt ? (
                          <span className="text-violet-700 font-semibold">
                            Read{" "}
                            {new Date(recip.readAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : recip.deliveredAt ? (
                          <span>
                            Delivered{" "}
                            {new Date(recip.deliveredAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
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
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-rose-600 text-[11px] max-w-xs">
                        {recip.errorMessage || recip.failureReason ? (
                          <span
                            title={recip.errorMessage || recip.failureReason || ""}
                            className="line-clamp-1"
                          >
                            {recip.errorCode && `[${recip.errorCode}] `}
                            {recip.errorMessage || recip.failureReason}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border/40 bg-muted/10 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">
            Showing {filteredRecipients.length} of {recipients.length} recipients
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs"
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
        <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-border/80 bg-muted/20">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <ImageIcon className="size-3.5 text-emerald-600" />
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
            className="text-xs h-8 font-mono"
          />
        </div>
      )}

      {/* Dynamic Placeholder Variable Inputs */}
      {placeholders.length > 0 && (
        <div className="flex flex-col gap-3 p-4 rounded-lg border border-border/80 bg-background">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-amber-600" />
              Template Parameters ({placeholders.length} detected)
            </Label>
            <span className="text-[10px] text-muted-foreground">
              Supports static text or dynamic tokens (&#123;&#123;name&#125;&#125;, &#123;&#123;phone&#125;&#125;)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {placeholders.map((idx) => {
              const val = templateParams[String(idx)] || ""
              return (
                <div
                  key={idx}
                  className="flex flex-col gap-1.5 p-2.5 rounded border border-border/60 bg-muted/15"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-emerald-800 dark:text-emerald-300">
                      Placeholder &#123;&#123;{idx}&#125;&#125;
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleInsertToken(idx, "{{name}}")}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 font-mono"
                      >
                        + &#123;&#123;name&#125;&#125;
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertToken(idx, "{{phone}}")}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 font-mono"
                      >
                        + &#123;&#123;phone&#125;&#125;
                      </button>
                    </div>
                  </div>
                  <Input
                    value={val}
                    onChange={(e) => handleParamChange(idx, e.target.value)}
                    placeholder={`e.g. Ramadan 2027 or {{name}}`}
                    className="text-xs h-7"
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
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
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
          className="text-xs font-mono resize-none"
        />

        {parsedRecipients.length > 0 && (
          <div className="flex items-center justify-between text-[11px] text-emerald-700 font-medium px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
            <span>
              ✓ Successfully parsed <strong>{parsedRecipients.length}</strong> unique recipients
            </span>
            <span className="text-[10px] text-muted-foreground">
              Sample: {parsedRecipients[0]?.phone} ({parsedRecipients[0]?.name || "No Name"})
            </span>
          </div>
        )}

        {csvErrors && csvErrors.length > 0 && (
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px]">
            <span className="font-semibold">CSV Warnings:</span>
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[10px]">
              {csvErrors.slice(0, 3).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {csvErrors.length > 3 && (
                <li>...and {csvErrors.length - 3} more invalid rows.</li>
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
          <div className="p-3 rounded-xl bg-[#EFEAE2] dark:bg-stone-900 border border-border/80 text-xs">
            <div className="p-3 rounded-lg bg-white dark:bg-card border border-border/40 shadow-sm text-foreground whitespace-pre-wrap leading-relaxed text-[11px]">
              {simulatedPreview}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
