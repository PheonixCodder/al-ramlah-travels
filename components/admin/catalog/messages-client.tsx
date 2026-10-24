"use client"

import * as React from "react"
import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  updateContactMessageStatus,
  deleteContactMessage,
} from "@/app/actions/cms"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Phone,
  MessageCircle,
  Mail,
  Calendar,
  CheckCircle,
  Archive,
  Trash2,
  Save,
  Search,
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
  const [selectedMessage, setSelectedMessage] =
    useState<ContactMessageData | null>(messages[0] ?? null)
  const [adminNotes, setAdminNotes] = useState(
    selectedMessage?.adminNotes ?? ""
  )
  const [, startTransition] = useTransition()

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  // Filter messages
  const filteredMessages = messages.filter((m) => {
    const matchesStatus = statusFilter === "all" || m.status === statusFilter
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.subject.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search)
    return matchesStatus && matchesSearch
  })

  function handleSelect(m: ContactMessageData) {
    setSelectedMessage(m)
    setAdminNotes(m.adminNotes ?? "")
    // Auto-mark as read if unread
    if (m.status === "unread") {
      updateStatus(m.id, "read")
    }
  }

  function updateStatus(
    id: string,
    status: "unread" | "read" | "replied" | "archived"
  ) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status } : m))
    )
    if (selectedMessage?.id === id) {
      setSelectedMessage((prev) => (prev ? { ...prev, status } : null))
    }
    startTransition(async () => {
      await updateContactMessageStatus({ id, status })
    })
  }

  function handleSaveNotes() {
    if (!selectedMessage) return
    const id = selectedMessage.id
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, adminNotes } : m))
    )
    startTransition(async () => {
      await updateContactMessageStatus({
        id,
        status: selectedMessage.status,
        adminNotes,
      })
    })
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this contact message?")) return
    setMessages((prev) => prev.filter((m) => m.id !== id))
    if (selectedMessage?.id === id) {
      setSelectedMessage(null)
    }
    startTransition(async () => {
      await deleteContactMessage(id)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Contact Messages Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Pilgrim inquiries, callback requests, and direct customer communication.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
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
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              statusFilter === "unread"
                ? "bg-card text-amber-900 shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Unread ({messages.filter((m) => m.status === "unread").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("replied")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
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
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
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
                  <span>{m.phone}</span>
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
                  <h2 className="text-lg font-bold text-foreground">
                    {selectedMessage.subject}
                  </h2>
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
                    variant={selectedMessage.status === "replied" ? "default" : "outline"}
                    size="xs"
                    onClick={() => updateStatus(selectedMessage.id, "replied")}
                    className="gap-1 text-xs"
                  >
                    <CheckCircle className="size-3.5" />
                    <span>Replied</span>
                  </Button>
                  <Button
                    variant={selectedMessage.status === "archived" ? "default" : "outline"}
                    size="xs"
                    onClick={() => updateStatus(selectedMessage.id, "archived")}
                    className="gap-1 text-xs"
                  >
                    <Archive className="size-3.5" />
                    <span>Archive</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(selectedMessage.id)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700"
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

                {selectedMessage.whatsapp && (
                  <a
                    href={`https://wa.me/${selectedMessage.whatsapp.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800 hover:bg-emerald-100"
                  >
                    <MessageCircle className="size-3.5 text-emerald-600" />
                    <span>WhatsApp Pilgrim</span>
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
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
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
