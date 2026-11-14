"use client"

import React, { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Edit2,
  KeyRound,
  Loader2,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unlink,
  Users,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  createLinkedDeviceSessionSlotAction,
  deleteLinkedDeviceSessionSlotAction,
  disconnectLinkedDeviceAction,
  getLinkedDeviceStatusAction,
  listLinkedDeviceSessionsAction,
  startLinkedDeviceConnectionAction,
  syncAllConnectedLinkedDevicesAction,
  syncRealWhatsappGroupsAction,
  updateLinkedDeviceSessionSlotAction,
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
  const [activeSessionKey, setActiveSessionKey] = useState<string>("primary")
  const [activeTab, setActiveTab] = useState<"qr" | "pairing_code">("qr")
  const [phoneNumberInput, setPhoneNumberInput] = useState("")
  const [copiedCode, setCopiedCode] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)

  // Add line slot dialog state
  const [isAddSlotOpen, setIsAddSlotOpen] = useState(false)
  const [newSlotLabel, setNewSlotLabel] = useState("")
  const [newSlotKey, setNewSlotKey] = useState("")

  // Edit slot label inline state
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editLabelInput, setEditLabelInput] = useState("")

  const activeSession =
    sessions.find((s) => s.sessionKey === activeSessionKey) ||
    sessions[0] ||
    null

  const isConnected = activeSession?.status === "connected"

  const shouldPoll =
    activeSession &&
    (activeSession.status === "connecting" ||
      activeSession.status === "qr_ready" ||
      activeSession.status === "pairing_code_ready")

  // Fetch full list of session slots and update active session
  const fetchSessions = async () => {
    try {
      const res = await listLinkedDeviceSessionsAction()
      if (res.success) {
        setSessions(res.sessions)
        if (res.sessions.length > 0) {
          if (!res.sessions.some((s) => s.sessionKey === activeSessionKey)) {
            setActiveSessionKey(res.sessions[0]!.sessionKey)
          }
        }
      }
    } catch (err) {
      console.error("[WhatsappLinkedDeviceCard] Error listing sessions:", err)
    } finally {
      setIsLoadingStatus(false)
    }
  }

  // Refresh single active session status
  const fetchActiveStatus = async () => {
    try {
      const res = await getLinkedDeviceStatusAction(activeSessionKey)
      if (res.success && res.session) {
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionKey === activeSessionKey ? res.session! : s
          )
        )
      }
    } catch (err) {
      console.error("[WhatsappLinkedDeviceCard] Poll active status error:", err)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    if (activeSession?.phoneNumber) {
      setPhoneNumberInput(activeSession.phoneNumber)
    }
    setEditLabelInput(activeSession?.label || "")
    setIsEditingLabel(false)
  }, [activeSessionKey, activeSession?.phoneNumber, activeSession?.label])

  useEffect(() => {
    if (!shouldPoll) return

    const interval = setInterval(() => {
      fetchActiveStatus()
    }, 2500)

    return () => clearInterval(interval)
  }, [shouldPoll, activeSession?.status, activeSessionKey])

  const handleStartConnection = (mode: "qr" | "pairing_code", targetKey?: string) => {
    const key = targetKey || activeSessionKey || "primary"
    setActiveSessionKey(key)
    setActionMessage(null)
    startTransition(async () => {
      const res = await startLinkedDeviceConnectionAction({
        sessionKey: key,
        mode,
        phoneNumber: mode === "pairing_code" ? phoneNumberInput : undefined,
      })
      if (res.success) {
        await fetchSessions()
        await fetchActiveStatus()
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Failed to start WhatsApp linking process.",
        })
      }
    })
  }

  const handleDisconnect = () => {
    if (
      !window.confirm(
        `Are you sure you want to disconnect line "${activeSession?.label || activeSessionKey}"? You will need to scan QR or enter a pairing code again to re-link.`
      )
    ) {
      return
    }

    setActionMessage(null)
    startTransition(async () => {
      const res = await disconnectLinkedDeviceAction(activeSessionKey)
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Line "${activeSession?.label || activeSessionKey}" unlinked successfully.`,
        })
        await fetchSessions()
        router.refresh()
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Failed to unlink device line.",
        })
      }
    })
  }

  const handleSyncGroupsNow = () => {
    setActionMessage(null)
    startTransition(async () => {
      const res = await syncRealWhatsappGroupsAction(activeSessionKey)
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Successfully synced ${res.syncedCount ?? 0} real WhatsApp groups for ${activeSession?.label || activeSessionKey}!`,
        })
        await fetchSessions()
        router.refresh()
        if (onSyncComplete && res.syncedCount !== undefined) {
          onSyncComplete(res.syncedCount)
        }
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Failed to sync WhatsApp groups.",
        })
      }
    })
  }

  const handleSyncAllLines = async () => {
    setIsSyncingAll(true)
    setActionMessage(null)
    try {
      const res = await syncAllConnectedLinkedDevicesAction()
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `1-Click All Lines Sync Complete: Discovered ${res.totalSyncedGroups} total WhatsApp groups across ${res.connectedLinesCount} connected lines!`,
        })
        await fetchSessions()
        router.refresh()
        if (onSyncComplete && res.totalSyncedGroups !== undefined) {
          onSyncComplete(res.totalSyncedGroups)
        }
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Failed to synchronize connected WhatsApp lines.",
        })
      }
    } catch (err: unknown) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error syncing all lines",
      })
    } finally {
      setIsSyncingAll(false)
    }
  }

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSlotLabel.trim()) return

    startTransition(async () => {
      const res = await createLinkedDeviceSessionSlotAction({
        label: newSlotLabel.trim(),
        sessionKey: newSlotKey.trim() || undefined,
      })

      if (res.success && res.session) {
        setActionMessage({
          type: "success",
          text: `Created WhatsApp line slot: "${res.session.label}"`,
        })
        setNewSlotLabel("")
        setNewSlotKey("")
        setIsAddSlotOpen(false)
        await fetchSessions()
        setActiveSessionKey(res.session.sessionKey)
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Failed to create line slot.",
        })
      }
    })
  }

  const handleSaveLabelEdit = async () => {
    if (!editLabelInput.trim() || editLabelInput.trim() === activeSession?.label) {
      setIsEditingLabel(false)
      return
    }

    startTransition(async () => {
      const res = await updateLinkedDeviceSessionSlotAction({
        sessionKey: activeSessionKey,
        label: editLabelInput.trim(),
      })

      if (res.success) {
        setActionMessage({
          type: "success",
          text: "Line label updated successfully.",
        })
        setIsEditingLabel(false)
        await fetchSessions()
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Failed to update line label.",
        })
      }
    })
  }

  const handleDeleteSlot = async (sessionKey: string) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete line slot "${activeSession?.label || sessionKey}"? This will disconnect the line and remove it.`
      )
    ) {
      return
    }

    startTransition(async () => {
      const res = await deleteLinkedDeviceSessionSlotAction({ sessionKey })
      if (res.success) {
        setActionMessage({
          type: "success",
          text: "Line slot deleted successfully.",
        })
        const updated = await listLinkedDeviceSessionsAction()
        if (updated.success) {
          setSessions(updated.sessions)
          if (updated.sessions.length > 0) {
            setActiveSessionKey(updated.sessions[0]!.sessionKey)
          } else {
            setActiveSessionKey("primary")
          }
        }
        router.refresh()
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Failed to delete slot.",
        })
      }
    })
  }

  const handleCopyPairingCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      // ignore
    }
  }

  const statusLabel = isConnected
    ? "Connected"
    : activeSession?.status === "qr_ready"
    ? "Scan QR Code"
    : activeSession?.status === "pairing_code_ready"
    ? "Enter 8-Digit Code"
    : activeSession?.status === "connecting"
    ? "Connecting..."
    : "Disconnected"

  const statusBadgeVariant = isConnected
    ? "bg-emerald-600 text-white"
    : activeSession?.status === "qr_ready" || activeSession?.status === "pairing_code_ready"
    ? "bg-amber-500 text-white"
    : activeSession?.status === "connecting"
    ? "bg-blue-600 text-white"
    : "bg-muted text-muted-foreground"

  return (
    <Card className={cn("border-border/80 shadow-xs overflow-hidden", className)}>
      {/* Top Emerald Header */}
      <CardHeader className="bg-gradient-to-r from-[#0A3622] to-[#124B30] text-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shrink-0">
              <Smartphone className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Connected WhatsApp Phones (QR / Pairing Code)
                </CardTitle>
                <Badge className={cn("text-[10px] font-mono px-2 py-0.5", statusBadgeVariant)}>
                  {statusLabel}
                </Badge>
              </div>
              <CardDescription className="text-emerald-200/80 text-xs mt-0.5">
                Link your WhatsApp phone(s) to automatically sync your WhatsApp Groups, Status, and direct chats.
              </CardDescription>
            </div>
          </div>

          {/* Quick Action Badges / Status */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {isConnected && (
              <Badge className="bg-[#C5A059] text-[#0A3622] font-semibold text-xs flex items-center gap-1.5">
                <Radio className="size-3 animate-pulse text-[#0A3622]" />
                <span>Live Socket Active</span>
              </Badge>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSyncAllLines}
              disabled={isSyncingAll || isPending}
              className="h-8 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-xs gap-1.5 cursor-pointer"
            >
              {isSyncingAll ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5 text-[#C5A059]" />
              )}
              <span>Sync All Connected Lines</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Luxury Phone Line Switcher Bar */}
      {sessions.length > 0 && (
        <div className="bg-secondary/40 border-b border-border px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Connected Phones:
            </span>

            {sessions.map((slot) => {
              const isSlotActive = slot.sessionKey === activeSessionKey
              const isSlotConnected = slot.status === "connected"
              const isSlotReady =
                slot.status === "qr_ready" || slot.status === "pairing_code_ready"

              return (
                <button
                  key={slot.sessionKey}
                  type="button"
                  onClick={() => setActiveSessionKey(slot.sessionKey)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer select-none",
                    isSlotActive
                      ? "bg-[#0A3622] text-white border-[#C5A059] shadow-xs"
                      : "bg-white text-muted-foreground hover:text-foreground border-border hover:border-[#C5A059]/60"
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full shrink-0",
                      isSlotConnected
                        ? "bg-emerald-400 animate-pulse"
                        : isSlotReady
                        ? "bg-amber-400 animate-pulse"
                        : slot.status === "connecting"
                        ? "bg-blue-400 animate-spin"
                        : "bg-slate-300"
                    )}
                  />
                  <span className="truncate max-w-[140px] sm:max-w-none">{slot.label}</span>
                  {slot.phoneNumber && (
                    <span className={cn("text-[10px] font-mono", isSlotActive ? "text-emerald-200" : "text-muted-foreground")}>
                      +{slot.phoneNumber}
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] px-1 py-0",
                      isSlotActive ? "border-emerald-300/40 text-emerald-100" : "border-border text-muted-foreground"
                    )}
                  >
                    {slot.groupsSyncedCount} G
                  </Badge>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsAddSlotOpen(true)}
              className="h-8 text-xs font-semibold border-dashed border-[#C5A059] text-primary hover:bg-[#C5A059]/10 gap-1.5 cursor-pointer"
            >
              <Plus className="size-3.5 text-[#C5A059]" />
              <span>Connect Another Phone</span>
            </Button>
          </div>
        </div>
      )}

      <CardContent className="p-4 sm:p-6 space-y-4">
        {actionMessage && (
          <div
            className={cn(
              "p-3 rounded-lg text-xs flex items-start gap-2",
              actionMessage.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
                : "bg-red-50 text-red-900 border border-red-300"
            )}
          >
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span className="flex-1 font-medium">{actionMessage.text}</span>
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="max-w-xl mx-auto text-center py-8 space-y-4">
            <div className="size-14 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center text-[#0A3622]">
              <Smartphone className="size-7 text-[#0A3622]" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-foreground font-display">
                No WhatsApp Phones Connected Yet
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your WhatsApp phone to automatically sync your WhatsApp Groups, Status line, and direct chats without manual entry.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                onClick={() => handleStartConnection("qr", "primary")}
                disabled={isPending}
                className="w-full sm:w-auto bg-[#0A3622] hover:bg-[#124B30] text-white text-xs h-9 font-semibold gap-2 cursor-pointer shadow-xs"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <QrCode className="size-4" />
                )}
                <span>Scan QR Code</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActiveSessionKey("primary")
                  setActiveTab("pairing_code")
                  handleStartConnection("pairing_code", "primary")
                }}
                disabled={isPending}
                className="w-full sm:w-auto text-xs h-9 border-[#C5A059] text-foreground hover:bg-[#C5A059]/10 gap-2 cursor-pointer"
              >
                <KeyRound className="size-4 text-[#C5A059]" />
                <span>8-Digit Pairing Code</span>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Active Line Header with Label Edit & Slot Deletion */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                {isEditingLabel ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editLabelInput}
                      onChange={(e) => setEditLabelInput(e.target.value)}
                      className="h-8 text-xs font-bold w-64 bg-white"
                      placeholder="Line Display Label"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveLabelEdit}
                      disabled={isPending}
                      className="h-8 text-xs bg-[#0A3622] text-white"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingLabel(false)}
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground">
                      {activeSession?.label || activeSessionKey}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditingLabel(true)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
                      title="Rename line slot"
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                  </div>
                )}
                <Badge variant="outline" className="font-mono text-[10px]">
                  key: {activeSessionKey}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteSlot(activeSessionKey)}
                  disabled={isPending}
                  className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 gap-1 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete Slot</span>
                </Button>
              </div>
            </div>

            {/* State A: Active Slot is Connected */}
            {isConnected ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/70 p-4 text-emerald-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Check className="size-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-emerald-900">
                        Linked as +{activeSession?.phoneNumber || "Connected"}
                      </h4>
                      <p className="text-xs text-emerald-800">
                        Push Name: <strong>{activeSession?.pushName || "Al Ramlah Travels Desk"}</strong> &bull; Authenticated via Neon PostgreSQL AES-256-GCM.
                      </p>
                    </div>
                  </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncGroupsNow}
                  disabled={isPending}
                  className="h-8 text-xs font-semibold bg-white border-emerald-300 text-emerald-950 hover:bg-emerald-100 cursor-pointer"
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="size-3.5 mr-1.5 text-emerald-700" />
                  )}
                  <span>Sync Line Groups ({activeSession?.groupsSyncedCount ?? 0})</span>
                </Button>

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isPending}
                  className="h-8 text-xs font-semibold cursor-pointer"
                >
                  <Unlink className="size-3.5 mr-1.5" />
                  <span>Disconnect Line</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2.5">
                <Users className="size-4 text-[#C5A059]" />
                <div>
                  <div className="text-muted-foreground text-[11px]">Synced Communities</div>
                  <div className="font-bold text-foreground">
                    {activeSession?.groupsSyncedCount ?? 0} WhatsApp Groups
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2.5">
                <Radio className="size-4 text-emerald-600" />
                <div>
                  <div className="text-muted-foreground text-[11px]">WhatsApp Status Line</div>
                  <div className="font-bold text-foreground">
                    status@broadcast:{activeSessionKey}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2.5">
                <ShieldCheck className="size-4 text-blue-600" />
                <div>
                  <div className="text-muted-foreground text-[11px]">Meta 24h Window</div>
                  <div className="font-bold text-foreground">Bypassed for Direct 1-on-1s</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* State B: Active Slot is Disconnected / Pairing Wizard */
          <div className="space-y-4">
            {/* Connection Mode Tabs */}
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab("qr")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer",
                  activeTab === "qr"
                    ? "border-[#0A3622] text-[#0A3622] dark:border-emerald-400 dark:text-emerald-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <QrCode className="size-4" />
                <span>Option 1: Scan Live QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("pairing_code")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer",
                  activeTab === "pairing_code"
                    ? "border-[#0A3622] text-[#0A3622] dark:border-emerald-400 dark:text-emerald-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <KeyRound className="size-4" />
                <span>Option 2: 8-Digit Pairing Code (No Camera)</span>
              </button>
            </div>

            {/* TAB 1: QR CODE SCAN */}
            {activeTab === "qr" && (
              <div className="flex flex-col md:flex-row items-center gap-6 p-2">
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-dashed border-emerald-300/80 bg-emerald-50/30 w-full md:w-64 min-h-64 shrink-0">
                  {activeSession?.qrDataUrl ? (
                    <div className="space-y-2 flex flex-col items-center">
                      <img
                        src={activeSession.qrDataUrl}
                        alt="WhatsApp QR Code"
                        className="size-52 rounded-xl border border-border shadow-xs bg-white p-2"
                      />
                      <div className="text-[10px] text-muted-foreground text-center animate-pulse">
                        Auto-refreshing every 2.5s &bull; Point camera now
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center p-4 space-y-3">
                      <QrCode className="size-12 text-muted-foreground/60" />
                      <div className="text-xs text-muted-foreground">
                        {isPending
                          ? "Generating QR code..."
                          : `Click button below to generate QR code for ${activeSession?.label || activeSessionKey}`}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 text-xs">
                  <h4 className="font-bold text-sm text-foreground">
                    Link {activeSession?.label || activeSessionKey} via Camera:
                  </h4>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground leading-relaxed">
                    <li>Open WhatsApp on the physical mobile device for this line.</li>
                    <li>Tap <strong>Settings</strong> (iOS) or <strong>Three Dots &gt; Linked Devices</strong> (Android).</li>
                    <li>Tap <strong>Link a Device</strong> and point camera at the QR code on the left.</li>
                    <li>The system will detect the connection and automatically sync groups for this line!</li>
                  </ol>

                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleStartConnection("qr")}
                      disabled={isPending}
                      className="bg-[#0A3622] hover:bg-[#124B30] text-white text-xs h-9 font-semibold cursor-pointer"
                    >
                      {isPending ? (
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      ) : (
                        <RefreshCw className="size-3.5 mr-1.5" />
                      )}
                      <span>
                        {activeSession?.qrDataUrl ? "Regenerate QR Code" : "Generate Live QR Code"}
                      </span>
                    </Button>

                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: 8-DIGIT PAIRING CODE */}
            {activeTab === "pairing_code" && (
              <div className="flex flex-col md:flex-row items-center gap-6 p-2">
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-emerald-300/80 bg-emerald-50/30 w-full md:w-72 min-h-64 shrink-0">
                  {activeSession?.pairingCode ? (
                    <div className="space-y-3 text-center">
                      <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                        Enter in WhatsApp Mobile
                      </div>
                      <div className="text-2xl sm:text-3xl font-mono tracking-widest font-black text-emerald-950 bg-white border-2 border-emerald-400 rounded-xl px-4 py-2 shadow-xs">
                        {activeSession.pairingCode}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyPairingCode(activeSession.pairingCode!)}
                        className="h-7 text-xs bg-white text-emerald-950 border-emerald-300 cursor-pointer"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="size-3 mr-1 text-emerald-600" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3 mr-1" />
                            <span>Copy 8-Digit Code</span>
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center p-4 space-y-3">
                      <KeyRound className="size-12 text-muted-foreground/60" />
                      <div className="text-xs text-muted-foreground">
                        Enter phone number on right and click Request Code.
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 text-xs">
                  <div className="space-y-1.5 max-w-sm">
                    <Label htmlFor="phone-input" className="text-xs font-semibold">
                      WhatsApp Phone Number for {activeSession?.label || activeSessionKey}
                    </Label>
                    <Input
                      id="phone-input"
                      value={phoneNumberInput}
                      onChange={(e) => setPhoneNumberInput(e.target.value)}
                      placeholder="03211234567 or 923211234567"
                      className="h-9 text-xs font-mono bg-white"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Pakistani format accepted (e.g. 03211234567 will auto-format to 923211234567).
                    </p>
                  </div>

                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground leading-relaxed pt-1">
                    <li>Open WhatsApp on the mobile device &gt; <strong>Linked Devices &gt; Link a Device</strong>.</li>
                    <li>Tap <strong>Link with phone number instead</strong> at the bottom of the camera screen.</li>
                    <li>Enter the 8-digit code shown on the left.</li>
                  </ol>

                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleStartConnection("pairing_code")}
                      disabled={isPending || !phoneNumberInput.trim()}
                      className="bg-[#0A3622] hover:bg-[#124B30] text-white text-xs h-9 font-semibold cursor-pointer"
                    >
                      {isPending ? (
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      ) : (
                        <KeyRound className="size-3.5 mr-1.5" />
                      )}
                      <span>Request 8-Digit Pairing Code</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    )}
  </CardContent>

      {/* Add Custom WhatsApp Line Dialog */}
      <Dialog open={isAddSlotOpen} onOpenChange={setIsAddSlotOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateSlot}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                Add WhatsApp Line Slot
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Register a new phone line slot (e.g. Ramadan Desk, Seasonal Consultant SIM). Once added, you can pair it independently via QR Code or Pairing Code.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="slot-label" className="text-xs font-semibold">
                  Line Display Label *
                </Label>
                <Input
                  id="slot-label"
                  required
                  value={newSlotLabel}
                  onChange={(e) => setNewSlotLabel(e.target.value)}
                  placeholder="e.g. Line 3 — Ramadan 2026 Executive Desk"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slot-key" className="text-xs font-semibold">
                  Custom Session Key (Optional slug)
                </Label>
                <Input
                  id="slot-key"
                  value={newSlotKey}
                  onChange={(e) => setNewSlotKey(e.target.value)}
                  placeholder="e.g. line3_ramadan (auto-generated if empty)"
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Alphanumeric, hyphens and underscores only.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddSlotOpen(false)}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || !newSlotLabel.trim()}
                className="bg-[#0A3622] hover:bg-[#124B30] text-white text-xs h-9 font-semibold"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                ) : (
                  <Plus className="size-3.5 mr-1.5" />
                )}
                <span>Register Line Slot</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
