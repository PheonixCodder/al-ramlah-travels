"use client"

import React, { useCallback, useEffect, useState, useTransition } from "react"
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

  const refreshSessions = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(async () => {
      try {
        const res = await listLinkedDeviceSessionsAction()
        if (active && res.success) {
          setSessions(res.sessions)
        }
      } catch {
        // Non-fatal UI load
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    })
    return () => {
      active = false
    }
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
        await refreshSessions()
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
        await refreshSessions()
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
        "overflow-hidden border-gold-border/60 bg-card shadow-sm",
        className
      )}
    >
      <CardHeader className="border-b border-gold-border/40 bg-primary p-6 text-primary-foreground">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold-border/50 bg-gold/15 text-gold">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base font-semibold text-primary-foreground">
                  100% Ban-Safe WhatsApp Architecture
                </CardTitle>
                <Badge className="bg-gold text-[11px] font-semibold text-gold-foreground hover:bg-gold">
                  0% SIM-Ban Risk
                </Badge>
              </div>
              <CardDescription className="mt-1 text-xs text-primary-foreground/85">
                Unofficial WebSocket SIM linking is retired on serverless infrastructure. All 1:1 conversations, Guided Umrah Intake, and Templates run on Official Meta Cloud API v21.0 below, while WhatsApp Groups &amp; Status use the 1-Click Manual Assisted Share Queue.
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            render={<Link href="/admin/campaigns" />}
            className="shrink-0 gap-1.5 whitespace-nowrap border-gold-border bg-background text-xs font-semibold text-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
          >
            <Sparkles className="size-3.5 text-gold-text" aria-hidden="true" />
            <span>Open Safe Group/Status Queue</span>
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-secondary/60 p-4">
            <p className="text-xs font-semibold text-primary">
              1. 1:1 Inbox, Auto-Responder &amp; Broadcasts
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Powered exclusively by <strong>Official Meta WhatsApp Cloud API v21.0</strong> (Embedded Signup Coexistence on{" "}
              <span className="font-medium text-foreground">+92 327 4029701</span> &amp;{" "}
              <span className="font-medium text-foreground">+92 319 0462638</span>) with verified HMAC webhooks, 24-hour service window protection, and instant <code className="text-[11px]">STOP</code> opt-out compliance.
            </p>
          </div>

          <div className="rounded-xl bg-secondary/60 p-4">
            <p className="text-xs font-semibold text-gold-text">
              2. WhatsApp Groups &amp; Status Distribution
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Meta Cloud API supports 1:1 E.164 recipients only. Share daily luxury posters to community groups and WhatsApp Status from <strong>Campaigns Hub (Safe WA Group/Status Queue)</strong> with 1-click caption + HD poster download.
            </p>
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium",
              notice.type === "success"
                ? "border-status-success-border bg-status-success-bg text-status-success"
                : "border-status-danger-border bg-status-danger-bg text-status-danger"
            )}
          >
            {notice.type === "success" ? (
              <CheckCircle2
                className="size-4 shrink-0 text-status-success"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="size-4 shrink-0 text-status-danger"
                aria-hidden="true"
              />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="text-xs text-muted-foreground">
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Checking legacy session slots…
              </span>
            ) : sessions.length > 0 ? (
              <span>
                {sessions.length} legacy slot record(s) found; live WebSockets are disabled (<code className="text-[11px]">manual_assisted_queue</code>).
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
            className="h-8 whitespace-nowrap border-border bg-background text-xs hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <Loader2
                className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Trash2
                className="mr-1.5 size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
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
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3.5 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {slot.label}
                    </span>
                    <code className="rounded bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {slot.sessionKey}
                    </code>
                    <Badge
                      variant="outline"
                      className="border-status-warning-border bg-status-warning-bg text-[11px] text-status-warning"
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
                      className="h-7 px-2.5 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Unlink className="mr-1 size-3" aria-hidden="true" />
                      Scrub Auth Keys
                    </Button>
                    {!isProtectedSlot && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDeleteSlot(slot.sessionKey)}
                        className="h-7 border-status-danger-border px-2.5 text-[11px] text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="mr-1 size-3" aria-hidden="true" />
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
