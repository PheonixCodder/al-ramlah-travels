"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  deleteContactMessage,
  updateContactMessageStatus,
} from "@/app/actions/cms"
import { buildWhatsappUrl, normalizeWhatsappNumber } from "@/lib/company-info"
import { inferAcquisitionChannel } from "@/lib/seo/utm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Archive,
  Calendar,
  CheckCircle,
  Mail,
  MessageCircle,
  Phone,
  Save,
  Search,
  Trash2,
} from "lucide-react"

export interface ContactMessageData {
  id: string
  name: string
  email?: string | null
  phone: string
  whatsapp?: string | null
  subject: string
  message: string
  status: "unread" | "read" | "replied" | "archived"
  adminNotes?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  landingPage?: string | null
  httpReferrer?: string | null
  createdAt: Date | string
}

interface MessagesClientProps {
  initialMessages: ContactMessageData[]
}

export function MessagesClient({ initialMessages }: MessagesClientProps) {
  const router = useRouter()
  const [messages, setMessages] =
    useState<ContactMessageData[]>(initialMessages)
  const [prevInitialMessages, setPrevInitialMessages] =
    useState(initialMessages)
  if (prevInitialMessages !== initialMessages) {
    setPrevInitialMessages(initialMessages)
    setMessages(initialMessages)
  }

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(
    initialMessages[0]?.id ?? null
  )
  const [adminNotes, setAdminNotes] = useState(
    initialMessages[0]?.adminNotes ?? ""
  )
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success"
    text: string
  } | null>(null)
  const [, startTransition] = useTransition()

  const selectedMessage = React.useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId]
  )

  // Keep active message pinned in list even if marking unread to read under statusFilter === "unread"
  const filteredMessages = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return messages.filter((m) => {
      const isCurrentlySelected = m.id === selectedId
      const matchesStatus =
        statusFilter === "all" ||
        m.status === statusFilter ||
        isCurrentlySelected
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.phone.includes(q)
      return matchesStatus && matchesSearch
    })
  }, [messages, statusFilter, search, selectedId])

  function handleSelect(m: ContactMessageData) {
    setSelectedId(m.id)
    setAdminNotes(m.adminNotes ?? "")
    setFeedback(null)
    if (m.status === "unread") {
      updateStatus(m.id, "read")
    }
  }

  function updateStatus(
    id: string,
    status: "unread" | "read" | "replied" | "archived"
  ) {
    const previous = messages
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)))
    startTransition(async () => {
      const res = await updateContactMessageStatus({ id, status })
      if (!res.success) {
        setMessages(previous)
        setFeedback({
          tone: "error",
          text: res.error || "Failed to update message status.",
        })
        return
      }
      router.refresh()
    })
  }

  function handleSaveNotes() {
    if (!selectedMessage) return
    const id = selectedMessage.id
    const currentStatus = selectedMessage.status
    setFeedback(null)
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, adminNotes } : m))
    )
    startTransition(async () => {
      const res = await updateContactMessageStatus({
        id,
        status: currentStatus,
        adminNotes,
      })
      if (!res.success) {
        setFeedback({
          tone: "error",
          text: res.error || "Failed to save internal notes.",
        })
        return
      }
      setFeedback({ tone: "success", text: "Internal staff notes saved." })
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    if (!window.confirm("Permanently delete this contact message?")) return
    const previous = messages
    setFeedback(null)
    setMessages((prev) => prev.filter((m) => m.id !== id))
    if (selectedId === id) {
      const fallbackNext = messages.find((m) => m.id !== id) ?? null
      setSelectedId(fallbackNext?.id ?? null)
      setAdminNotes(fallbackNext?.adminNotes ?? "")
    }
    startTransition(async () => {
      try {
        const res = await deleteContactMessage(id)
        if (!res.success) {
          setMessages(previous)
          setSelectedId(id)
          setFeedback({
            tone: "error",
            text:
              res.error ||
              "Only Super Admins can permanently delete inquiries.",
          })
          return
        }
        router.refresh()
      } catch (err: unknown) {
        setMessages(previous)
        setSelectedId(id)
        setFeedback({
          tone: "error",
          text:
            err instanceof Error
              ? err.message
              : "Only Super Admins can permanently delete inquiries.",
        })
      }
    })
  }

  const whatsappCandidate =
    selectedMessage?.whatsapp?.trim() || selectedMessage?.phone?.trim() || ""
  const hasValidWhatsapp =
    normalizeWhatsappNumber(whatsappCandidate).length >= 10
  const whatsappReplyHref = hasValidWhatsapp
    ? buildWhatsappUrl(
        whatsappCandidate,
        selectedMessage
          ? `Assalamu Alaikum ${selectedMessage.name}, regarding your inquiry "${selectedMessage.subject}" with Al Ramlah Travels:`
          : undefined
      )
    : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Contact Messages Inbox
        </h2>
        <p className="text-sm text-muted-foreground">
          Pilgrim inquiries, callback requests, and direct WhatsApp/email
          triage.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-3 text-xs font-medium ${
            feedback.tone === "error"
              ? "border-status-danger-border bg-status-danger-bg text-status-danger"
              : "border-status-success-border bg-status-success-bg text-status-success"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
              statusFilter === "all"
                ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({messages.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("unread")}
            className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
              statusFilter === "unread"
                ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Unread ({messages.filter((m) => m.status === "unread").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("read")}
            className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
              statusFilter === "read"
                ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Read ({messages.filter((m) => m.status === "read").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("replied")}
            className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
              statusFilter === "replied"
                ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Replied ({messages.filter((m) => m.status === "replied").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("archived")}
            className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
              statusFilter === "archived"
                ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Archived ({messages.filter((m) => m.status === "archived").length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, subject, or phone"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Split Pane: List & Reader */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left List */}
        <div className="space-y-2 lg:col-span-5">
          {filteredMessages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              No messages found.
            </div>
          ) : (
            filteredMessages.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => handleSelect(m)}
                aria-pressed={selectedMessage?.id === m.id}
                className={`w-full cursor-pointer rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
                  selectedMessage?.id === m.id
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border bg-card hover:bg-muted/30"
                } ${m.status === "unread" ? "border-l-4 border-l-status-warning font-medium" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {m.name}
                  </span>
                  <Badge
                    className={`text-[9px] font-semibold capitalize ${
                      m.status === "unread"
                        ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                        : m.status === "replied"
                          ? "border-status-success-border bg-status-success-bg text-status-success"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m.status}
                  </Badge>
                </div>
                <h4 className="mt-1 truncate text-xs font-medium text-foreground/90">
                  {m.subject}
                </h4>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {m.message}
                </p>
                <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                  <span className="font-mono">{m.phone}</span>
                  <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Right Reader */}
        <div className="lg:col-span-7">
          {selectedMessage ? (
            <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-xs">
              {/* Message Header */}
              <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">
                      {selectedMessage.subject}
                    </h3>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {selectedMessage.status}
                    </Badge>
                    {inferAcquisitionChannel(selectedMessage) && (
                      <Badge
                        variant="outline"
                        className="border-status-success-border bg-status-success-bg text-[10px] font-semibold text-status-success"
                      >
                        {inferAcquisitionChannel(selectedMessage)}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {selectedMessage.name}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Calendar
                        className="size-3 text-primary"
                        aria-hidden="true"
                      />
                      {new Date(selectedMessage.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {(selectedMessage.utmSource ||
                    selectedMessage.utmCampaign ||
                    selectedMessage.landingPage ||
                    selectedMessage.httpReferrer) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {selectedMessage.utmSource && (
                        <Badge
                          variant="outline"
                          className="border-status-success-border bg-status-success-bg text-[10px] font-semibold text-status-success"
                        >
                          {`${selectedMessage.utmSource.charAt(0).toUpperCase()}${selectedMessage.utmSource.slice(1)}${
                            selectedMessage.utmMedium
                              ? ` ${selectedMessage.utmMedium.toUpperCase()}`
                              : ""
                          }`}
                        </Badge>
                      )}
                      {selectedMessage.utmCampaign && (
                        <Badge
                          variant="outline"
                          className="border-gold-border bg-accent/35 text-[10px] font-medium text-gold-text"
                        >
                          Campaign: {selectedMessage.utmCampaign}
                        </Badge>
                      )}
                      {selectedMessage.landingPage && (
                        <Badge
                          variant="outline"
                          className="border-border bg-muted/40 text-[10px] font-normal text-foreground"
                        >
                          Entry: {selectedMessage.landingPage}
                        </Badge>
                      )}
                      {selectedMessage.httpReferrer && (
                        <Badge
                          variant="outline"
                          className="max-w-xs truncate border-border bg-muted/40 text-[10px] font-normal text-muted-foreground"
                          title={selectedMessage.httpReferrer}
                        >
                          Referrer: {selectedMessage.httpReferrer}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Status Switcher Buttons */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant={
                      selectedMessage.status === "replied"
                        ? "default"
                        : "outline"
                    }
                    size="xs"
                    onClick={() => updateStatus(selectedMessage.id, "replied")}
                    className="cursor-pointer gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <CheckCircle className="size-3.5" aria-hidden="true" />
                    <span>Replied</span>
                  </Button>
                  <Button
                    variant={
                      selectedMessage.status === "archived"
                        ? "default"
                        : "outline"
                    }
                    size="xs"
                    onClick={() => updateStatus(selectedMessage.id, "archived")}
                    className="cursor-pointer gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Archive className="size-3.5" aria-hidden="true" />
                    <span>Archive</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(selectedMessage.id)}
                    className="size-7 cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Delete Inquiry (Super Admin)"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {/* Quick Communication Actions */}
              <div className="flex flex-wrap gap-2 text-xs">
                <a
                  href={`tel:${selectedMessage.phone}`}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Phone
                    className="size-3.5 text-status-success"
                    aria-hidden="true"
                  />
                  <span>Call {selectedMessage.phone}</span>
                </a>

                {whatsappReplyHref && (
                  <a
                    href={whatsappReplyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-status-success-border bg-status-success-bg px-3 py-1.5 font-medium text-status-success hover:bg-status-success-bg/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <MessageCircle
                      className="size-3.5 text-status-success"
                      aria-hidden="true"
                    />
                    <span>
                      WhatsApp Pilgrim (+
                      {normalizeWhatsappNumber(whatsappCandidate)})
                    </span>
                  </a>
                )}

                {selectedMessage.email && (
                  <a
                    href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject)}`}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Mail
                      className="size-3.5 text-primary"
                      aria-hidden="true"
                    />
                    <span>Email ({selectedMessage.email})</span>
                  </a>
                )}
              </div>

              {/* Message Content Body */}
              <div className="rounded-lg bg-secondary/45 p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {selectedMessage.message}
                </p>
              </div>

              {/* Admin Staff Internal Notes */}
              <div className="space-y-2 border-t border-border pt-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Internal Staff Notes
                </span>
                <Textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Note discussions with the pilgrim, customized rate promises, or follow-up dates"
                  className="text-xs"
                />
                <Button
                  size="xs"
                  onClick={handleSaveNotes}
                  className="cursor-pointer gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Save className="size-3" aria-hidden="true" />
                  <span>Save Internal Notes</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
              Select a message from the list to view details and contact
              actions.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
