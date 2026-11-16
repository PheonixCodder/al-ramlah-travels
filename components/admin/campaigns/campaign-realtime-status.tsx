"use client"

import * as React from "react"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Radio,
  Sparkles,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  mintRealtimeRunPublicTokenAction,
  getTaskRunProgressAction,
} from "@/app/actions/trigger-realtime"
import type { TaskProgressMetadata } from "@/trigger/metadata"
import { cn } from "@/lib/utils"

export interface CampaignRealtimeStatusProps {
  runId: string
  mode?: "social_post" | "whatsapp_broadcast"
  title?: string
  onComplete?: () => void
  className?: string
}

/**
 * Live Trigger.dev v4 Realtime Campaign Progress Indicator.
 *
 * Uses `useRealtimeRun` from `@trigger.dev/react-hooks` with `skipColumns: ["payload", "output"]`
 * when Trigger.dev Cloud is configured (`tokenMode === "cloud"`), and gracefully falls back
 * to `getTaskRunProgressAction(runId)` in zero-config local dev mode.
 */
export function CampaignRealtimeStatus({
  runId,
  mode = "social_post",
  title,
  onComplete,
  className,
}: CampaignRealtimeStatusProps) {
  const [accessToken, setAccessToken] = React.useState<string | null>(null)
  const [tokenMode, setTokenMode] = React.useState<
    "loading" | "cloud" | "local" | "error"
  >("loading")
  const [localSnapshot, setLocalSnapshot] =
    React.useState<TaskProgressMetadata | null>(null)
  const [localStatus, setLocalStatus] = React.useState<string>("EXECUTING")
  const [tokenError, setTokenError] = React.useState<string | null>(null)

  const hasNotifiedCompleteRef = React.useRef(false)

  // 1. Mint scoped read-only public token or retrieve local fallback snapshot
  React.useEffect(() => {
    let active = true
    hasNotifiedCompleteRef.current = false
    setTokenMode("loading")
    setTokenError(null)

    mintRealtimeRunPublicTokenAction(runId)
      .then((res) => {
        if (!active) return
        if (
          res.success &&
          res.mode === "cloud" &&
          (res.publicAccessToken || res.token)
        ) {
          setAccessToken(res.publicAccessToken || res.token || null)
          setTokenMode("cloud")
        } else if (res.success) {
          setLocalSnapshot(res.snapshot ?? null)
          setLocalStatus(res.fallbackStatus ?? "COMPLETED")
          setTokenMode("local")
        } else {
          setTokenError(res.error || "Unable to connect to live run stream")
          setTokenMode("error")
        }
      })
      .catch((err: unknown) => {
        if (!active) return
        setTokenError(
          err instanceof Error ? err.message : "Realtime stream error"
        )
        setTokenMode("error")
      })

    return () => {
      active = false
    }
  }, [runId])

  // 2. In local mode, if not yet completed, poll getTaskRunProgressAction briefly
  React.useEffect(() => {
    if (tokenMode !== "local") return
    if (
      localStatus === "COMPLETED" ||
      localStatus === "FAILED" ||
      (localSnapshot && localSnapshot.progress >= 100)
    ) {
      return
    }

    const timer = setInterval(async () => {
      const res = await getTaskRunProgressAction(runId)
      if (res.success && res.snapshot) {
        setLocalSnapshot(res.snapshot)
        if (res.status) {
          setLocalStatus(res.status)
        }
      }
    }, 1500)

    return () => clearInterval(timer)
  }, [tokenMode, localStatus, localSnapshot, runId])

  // 3. Subscribe to Trigger.dev Cloud Realtime WebSocket stream when in cloud mode
  const { run: realtimeRun, error: realtimeError } = useRealtimeRun(runId, {
    accessToken: accessToken ?? undefined,
    enabled: tokenMode === "cloud" && Boolean(accessToken),
    skipColumns: ["payload", "output"],
  })

  // 4. Derive unified metadata & status across cloud and local modes
  const metadata: Partial<TaskProgressMetadata> = React.useMemo(() => {
    if (tokenMode === "cloud" && realtimeRun?.metadata) {
      return realtimeRun.metadata as unknown as Partial<TaskProgressMetadata>
    }
    return localSnapshot ?? {}
  }, [tokenMode, realtimeRun?.metadata, localSnapshot])

  const effectiveStatus = React.useMemo(() => {
    if (tokenMode === "cloud" && realtimeRun?.status) {
      return realtimeRun.status
    }
    if (tokenMode === "local") {
      return localStatus
    }
    return "EXECUTING"
  }, [tokenMode, realtimeRun, localStatus])

  const isCompleted =
    effectiveStatus === "COMPLETED" ||
    metadata.stage === "completed" ||
    (typeof metadata.progress === "number" && metadata.progress >= 100)

  const isFailed =
    effectiveStatus === "FAILED" ||
    effectiveStatus === "CRASHED" ||
    effectiveStatus === "CANCELED" ||
    metadata.stage === "failed"

  const progressValue = React.useMemo(() => {
    if (typeof metadata.progress === "number") {
      return Math.max(0, Math.min(100, Math.round(metadata.progress)))
    }
    if (isCompleted) return 100
    return 15
  }, [metadata.progress, isCompleted])

  // Trigger onComplete callback once when run finishes
  React.useEffect(() => {
    if ((isCompleted || isFailed) && !hasNotifiedCompleteRef.current) {
      hasNotifiedCompleteRef.current = true
      onComplete?.()
    }
  }, [isCompleted, isFailed, onComplete])

  // Extract counters for Social Post Publishing or WhatsApp Broadcasts
  const completedTargets =
    metadata.completedTargets ?? metadata.counters?.completedTargets ?? 0
  const failedTargets =
    metadata.failedTargets ?? metadata.counters?.failedTargets ?? 0
  const totalTargets =
    metadata.totalTargets ?? metadata.counters?.totalTargets ?? 0

  const sentCount =
    metadata.sentCount ??
    metadata.counters?.sentCount ??
    metadata.counters?.sent ??
    0
  const failedCount =
    metadata.failedCount ??
    metadata.counters?.failedCount ??
    metadata.counters?.failed ??
    0
  const totalRecipients =
    metadata.totalRecipients ??
    metadata.counters?.totalRecipients ??
    metadata.counters?.total ??
    0

  const stageLabel =
    metadata.detail ||
    metadata.label ||
    (isCompleted
      ? mode === "whatsapp_broadcast"
        ? "Broadcast delivery completed"
        : "Multi-channel publishing completed"
      : isFailed
      ? metadata.error || "Execution encountered an error"
      : mode === "whatsapp_broadcast"
      ? "Dispatching rate-limited WhatsApp templates..."
      : "Publishing across connected social channels...")

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 transition-all shadow-2xs space-y-2.5",
        isCompleted
          ? "border-emerald-500/40 bg-emerald-50/60 text-emerald-950"
          : isFailed
          ? "border-rose-500/40 bg-rose-50/60 text-rose-950"
          : "border-[#C5A059]/50 bg-[#C5A059]/10 text-foreground",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isCompleted ? (
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          ) : isFailed ? (
            <AlertTriangle className="size-4 text-rose-600 shrink-0" />
          ) : (
            <Loader2 className="size-4 text-[#0A3622] animate-spin shrink-0" />
          )}

          <span className="text-xs font-bold tracking-tight truncate">
            {title ||
              (mode === "whatsapp_broadcast"
                ? "Live Meta Broadcast Delivery Stream"
                : "Live Multi-Channel Publishing Stream")}
          </span>

          <Badge
            variant="outline"
            className={cn(
              "text-[9px] font-mono px-1.5 py-0 uppercase",
              tokenMode === "cloud"
                ? "border-emerald-600/40 text-emerald-800 bg-emerald-500/10"
                : "border-[#C5A059]/50 text-[#0A3622] bg-white/80"
            )}
          >
            <Radio className="size-2.5 mr-1 inline-block" />
            {tokenMode === "cloud" ? "Trigger Realtime" : "Local Sync"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
          {mode === "social_post" && totalTargets > 0 && (
            <span className="rounded bg-white/90 px-2 py-0.5 border border-border text-foreground font-semibold">
              Targets: {completedTargets}/{totalTargets} Published
              {failedTargets > 0 ? ` (${failedTargets} Failed)` : ""}
            </span>
          )}

          {mode === "whatsapp_broadcast" && totalRecipients > 0 && (
            <span className="rounded bg-white/90 px-2 py-0.5 border border-border text-foreground font-semibold">
              Sent: {sentCount}/{totalRecipients}
              {failedCount > 0 ? ` • Failed: ${failedCount}` : ""}
            </span>
          )}

          <span className="font-bold text-[#0A3622]">{progressValue}%</span>
        </div>
      </div>

      <Progress value={progressValue} className="h-2 bg-white/80" />

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate font-medium text-foreground/85 flex items-center gap-1.5">
          <Sparkles className="size-3 text-[#C5A059] shrink-0" />
          <span>{stageLabel}</span>
        </span>
        <span className="font-mono text-[10px] shrink-0">
          Run: {runId.slice(0, 14)}
        </span>
      </div>

      {(tokenError || realtimeError) && (
        <p className="text-[10px] text-amber-800 font-mono">
          Stream notice: {tokenError || realtimeError?.message}
        </p>
      )}
    </div>
  )
}
