"use client"

import React, { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlink,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  deleteLinkedDeviceSessionSlotAction,
  disconnectLinkedDeviceAction,
  listLinkedDeviceSessionsAction,
  purgeFakeMarketingChannelsAction,
  type SafeLinkedDeviceSession,
} from "@/app/actions/whatsapp-linked-device"

interface WhatsappLinkedDeviceCardProps {
  className?: string
  onSyncComplete?: (count: number) => void
}

export function WhatsappLinkedDeviceCard({
  className = "",
  onSyncComplete,
}: WhatsappLinkedDeviceCardProps) {
  const router = useRouter()
  const [sessions, setSessions] = useState<SafeLinkedDeviceSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const loadSessions = async () => {
    try {
      const res = await listLinkedDeviceSessionsAction()
      if (res.success) {
        setSessions(res.sessions)
      }
    } catch {
      // Non-fatal UI load
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSessions()
  }, [])

  const handleClearSlotKeys = (sessionKey: string) => {
    setNotice(null)
    startTransition(async () => {
      const res = await disconnectLinkedDeviceAction(sessionKey)
      if (res.success) {
        setNotice({
          type: "success",
          text: `Cleared residual Signal credentials for slot "${sessionKey}".`,
        })
        await loadSessions()
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Super Admin permission required to clear session keys.",
        })
      }
    })
  }

  const handleDeleteSlot = (sessionKey: string) => {
    setNotice(null)
    startTransition(async () => {
      const res = await deleteLinkedDeviceSessionSlotAction({ sessionKey })
      if (res.success) {
        setNotice({
          type: "success",
          text: `Removed legacy line slot "${sessionKey}" without touching conversation history.`,
        })
        await loadSessions()
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to remove legacy line slot.",
        })
      }
    })
  }

  const handlePurgePlaceholderWaChannels = () => {
    setNotice(null)
    startTransition(async () => {
      const res = await purgeFakeMarketingChannelsAction()
      if (res.success) {
        const count = res.purgedCount ?? 0
        setNotice({
          type: "success",
          text:
            count > 0
              ? `Purged ${count} placeholder WhatsApp channel(s). Core 5 social channels were untouched.`
              : "All WhatsApp group/status channels are clean (0 placeholder rows found).",
        })
        onSyncComplete?.(0)
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text:
            res.error ||
            "Super Admin permission required to purge placeholder WhatsApp channels.",
        })
      }
    })
  }

  return (
    <Card
      className={cn(
        "border-[#C5A059]/35 bg-[#FBF9F4] shadow-sm overflow-hidden",
        className
      )}
    >
      <CardHeader className="border-b border-[#C5A059]/25 bg-gradient-to-r from-[#0A3622] to-[#114B31] text-[#FBF9F4] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E5C785]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base font-semibold text-[#FBF9F4]">
                  100% Ban-Safe WhatsApp Architecture
                </CardTitle>
                <Badge className="bg-[#C5A059] text-[#0A3622] hover:bg-[#C5A059] font-semibold text-[10px] uppercase tracking-wider">
                  0% SIM-Ban Risk
                </Badge>
              </div>
              <CardDescription className="text-xs text-[#FBF9F4]/80 mt-1">
                Unofficial WebSocket SIM linking is retired on serverless infrastructure. All 1:1 conversations, Guided Umrah Intake, and Templates run on Official Meta Cloud API v21.0 below, while WhatsApp Groups &amp; Status use the 1-Click Manual Assisted Share Queue.
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            render={<Link href="/admin/campaigns" />}
            className="border-[#C5A059]/60 bg-[#FBF9F4] text-[#0A3622] hover:bg-[#F3EFE4] font-semibold text-xs shrink-0 gap-1.5"
          >
            <Sparkles className="size-3.5 text-[#9A7532]" />
            Open Safe Group/Status Queue
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#0A3622]/15 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              1. 1:1 Inbox, Auto-Responder &amp; Broadcasts
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Powered exclusively by <strong>Official Meta WhatsApp Cloud API v21.0</strong> (Embedded Signup Coexistence on{" "}
              <span className="font-medium text-foreground">+92 327 4029701</span> &amp;{" "}
              <span className="font-medium text-foreground">+92 319 0462638</span>) with verified HMAC webhooks, 24-hour service window protection, and instant <code className="text-[11px]">STOP</code> opt-out compliance.
            </p>
          </div>

          <div className="rounded-xl border border-[#C5A059]/30 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8B6914]">
              2. WhatsApp Groups &amp; Status Distribution
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Meta Cloud API supports 1:1 E.164 recipients only. Share daily luxury posters to community groups and WhatsApp Status from <strong>Campaigns Hub &rarr; Safe WA Group/Status Queue</strong> with 1-click caption + HD poster download.
            </p>
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium",
              notice.type === "success"
                ? "border-emerald-600/30 bg-emerald-50 text-emerald-900"
                : "border-rose-600/30 bg-rose-50 text-rose-900"
            )}
          >
            {notice.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-rose-700" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#C5A059]/20">
          <div className="text-xs text-muted-foreground">
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" />
                Checking legacy session slots...
              </span>
            ) : sessions.length > 0 ? (
              <span>
                {sessions.length} legacy slot record(s) found — live WebSockets disabled (<code className="text-[11px]">manual_assisted_queue</code>).
              </span>
            ) : (
              <span>Zero legacy linked-device sockets active.</span>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handlePurgePlaceholderWaChannels}
            className="h-8 text-xs border-border bg-white hover:bg-muted/50"
          >
            {isPending ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5 mr-1.5 text-muted-foreground" />
            )}
            Clean Placeholder WA Channels
          </Button>
        </div>

        {sessions.length > 0 && (
          <div className="space-y-2 pt-1">
            {sessions.map((slot) => {
              const isProtectedSlot =
                slot.sessionKey === "default" || slot.sessionKey === "secondary"
              return (
                <div
                  key={slot.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-white px-3.5 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {slot.label}
                    </span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {slot.sessionKey}
                    </code>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-600/30 bg-amber-50 text-amber-900"
                    >
                      Retired (Manual Queue)
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleClearSlotKeys(slot.sessionKey)}
                      className="h-7 px-2.5 text-[11px]"
                    >
                      <Unlink className="size-3 mr-1" />
                      Scrub Auth Keys
                    </Button>
                    {!isProtectedSlot && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDeleteSlot(slot.sessionKey)}
                        className="h-7 px-2.5 text-[11px] text-rose-700 hover:text-rose-800 border-rose-200 hover:bg-rose-50"
                      >
                        <Trash2 className="size-3 mr-1" />
                        Delete Slot
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
