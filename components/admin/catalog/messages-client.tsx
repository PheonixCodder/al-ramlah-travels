"use client"

import * as React from "react"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  deleteContactMessage,
  updateContactMessageStatus,
} from "@/app/actions/cms"
import { buildWhatsappUrl, normalizeWhatsappNumber } from "@/lib/company-info"
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
  createdAt: Date | string
}

interface MessagesClientProps {
  initialMessages: ContactMessageData[]
}

export function MessagesClient({ initialMessages }: MessagesClientProps) {
  const router = useRouter()
  const [messages, setMessages] =
    useState<ContactMessageData[]>(initialMessages)
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

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  const selectedMessage = React.useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId]
  )

  // Keep active message pinned in list even if marking unread -> read under statusFilter === "unread"
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
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status } : m))
    )
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
            text: res.error || "Only Super Admins can permanently delete inquiries.",
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
          Pilgrim inquiries, callback requests, and direct WhatsApp/email triage.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-3 text-xs font-medium ${
            feedback.tone === "error"
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-900"
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
            className={`rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer ${
              statusFilter === "all"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({messages.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("unread")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer ${
              statusFilter === "unread"
                ? "bg-card text-amber-900 shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Unread ({messages.filter((m) => m.status === "unread").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("read")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer ${
              statusFilter === "read"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Read ({messages.filter((m) => m.status === "read").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("replied")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer ${
              statusFilter === "replied"
                ? "bg-card text-emerald-900 shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Replied ({messages.filter((m) => m.status === "replied").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("archived")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer ${
              statusFilter === "archived"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Archived ({messages.filter((m) => m.status === "archived").length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, subject, or phone..."
            className="pl-8 text-xs h-8"
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
              <div
                key={m.id}
                onClick={() => handleSelect(m)}
                className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                  selectedMessage?.id === m.id
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border bg-card hover:bg-muted/30"
                } ${m.status === "unread" ? "border-l-4 border-l-amber-500 font-medium" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm text-foreground truncate">
                    {m.name}
                  </span>
                  <Badge
                    className={`text-[9px] font-semibold uppercase ${
                      m.status === "unread"
                        ? "bg-amber-100 text-amber-900 border-amber-300"
                        : m.status === "replied"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m.status}
                  </Badge>
                </div>
                <h4 className="text-xs font-medium text-foreground/90 mt-1 truncate">
                  {m.subject}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {m.message}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 mt-1 border-t border-border/50">
                  <span className="font-mono">{m.phone}</span>
                  <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Reader */}
        <div className="lg:col-span-7">
          {selectedMessage ? (
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
              {/* Message Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">
                      {selectedMessage.subject}
                    </h3>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {selectedMessage.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span className="font-semibold text-foreground">
                      {selectedMessage.name}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3 text-primary" />
                      {new Date(selectedMessage.createdAt).toLocaleString()}
                    </span>
                  </div>
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
                    className="gap-1 text-xs cursor-pointer"
                  >
                    <CheckCircle className="size-3.5" />
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
                    className="gap-1 text-xs cursor-pointer"
                  >
                    <Archive className="size-3.5" />
                    <span>Archive</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(selectedMessage.id)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    title="Delete Inquiry (Super Admin)"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Quick Communication Actions */}
              <div className="flex flex-wrap gap-2 text-xs">
                <a
                  href={`tel:${selectedMessage.phone}`}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 font-medium text-foreground hover:bg-muted"
                >
                  <Phone className="size-3.5 text-emerald-700" />
                  <span>Call {selectedMessage.phone}</span>
                </a>

                {whatsappReplyHref && (
                  <a
                    href={whatsappReplyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800 hover:bg-emerald-100"
                  >
                    <MessageCircle className="size-3.5 text-emerald-600" />
                    <span>
                      WhatsApp Pilgrim (+{normalizeWhatsappNumber(whatsappCandidate)})
                    </span>
                  </a>
                )}

                {selectedMessage.email && (
                  <a
                    href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject)}`}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 font-medium text-foreground hover:bg-muted"
                  >
                    <Mail className="size-3.5 text-primary" />
                    <span>Email ({selectedMessage.email})</span>
                  </a>
                )}
              </div>

              {/* Message Content Body */}
              <div className="rounded-lg bg-muted/20 p-4 border border-border/80">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {selectedMessage.message}
                </p>
              </div>

              {/* Admin Staff Internal Notes */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Internal Staff Notes
                </span>
                <Textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Note discussions with the pilgrim, customized rate promises, or follow-up dates..."
                  className="text-xs"
                />
                <Button
                  size="xs"
                  onClick={handleSaveNotes}
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  <Save className="size-3" />
                  <span>Save Internal Notes</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
              Select a message from the list to view details and contact actions.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
