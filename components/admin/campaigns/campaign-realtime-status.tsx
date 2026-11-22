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

type TokenResolutionState = {
  runId: string
  mode: "cloud" | "local" | "error"
  accessToken: string | null
  snapshot: TaskProgressMetadata | null
  status: string
  error: string | null
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
  const [tokenState, setTokenState] =
    React.useState<TokenResolutionState | null>(null)

  const notifiedRunIdRef = React.useRef<string | null>(null)

  const isCurrentRun = tokenState?.runId === runId
  const tokenMode: "loading" | "cloud" | "local" | "error" = isCurrentRun
    ? tokenState.mode
    : "loading"
  const accessToken = isCurrentRun ? tokenState.accessToken : null
  const localSnapshot = isCurrentRun ? tokenState.snapshot : null
  const localStatus = isCurrentRun ? tokenState.status : "EXECUTING"
  const tokenError = isCurrentRun ? tokenState.error : null

  // 1. Mint scoped read-only public token or retrieve local fallback snapshot
  React.useEffect(() => {
    let active = true

    mintRealtimeRunPublicTokenAction(runId)
      .then((res) => {
        if (!active) return
        if (
          res.success &&
          res.mode === "cloud" &&
          (res.publicAccessToken || res.token)
        ) {
          setTokenState({
            runId,
            mode: "cloud",
            accessToken: res.publicAccessToken || res.token || null,
            snapshot: null,
            status: "EXECUTING",
            error: null,
          })
        } else if (res.success) {
          setTokenState({
            runId,
            mode: "local",
            accessToken: null,
            snapshot: res.snapshot ?? null,
            status: res.fallbackStatus ?? "COMPLETED",
            error: null,
          })
        } else {
          setTokenState({
            runId,
            mode: "error",
            accessToken: null,
            snapshot: null,
            status: "EXECUTING",
            error: res.error || "Unable to connect to live run stream",
          })
        }
      })
      .catch((err: unknown) => {
        if (!active) return
        setTokenState({
          runId,
          mode: "error",
          accessToken: null,
          snapshot: null,
          status: "EXECUTING",
          error:
            err instanceof Error ? err.message : "Realtime stream error",
        })
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
        setTokenState((prev) => {
          if (!prev || prev.runId !== runId) return prev
          return {
            ...prev,
            snapshot: res.snapshot,
            status: res.status || prev.status,
          }
        })
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
    if ((isCompleted || isFailed) && notifiedRunIdRef.current !== runId) {
      notifiedRunIdRef.current = runId
      onComplete?.()
    }
  }, [isCompleted, isFailed, onComplete, runId])

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
          ? "Dispatching rate-limited WhatsApp templates…"
          : "Publishing across connected social channels…")

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border p-3.5 shadow-2xs transition-colors motion-reduce:transition-none",
        isCompleted
          ? "border-status-success-border bg-status-success-bg text-status-success"
          : isFailed
            ? "border-status-danger-border bg-status-danger-bg text-status-danger"
            : "border-gold-border bg-accent/40 text-foreground",
        className
      )}
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          {isCompleted ? (
            <CheckCircle2
              className="size-4 shrink-0 text-status-success"
              aria-hidden="true"
            />
          ) : isFailed ? (
            <AlertTriangle
              className="size-4 shrink-0 text-status-danger"
              aria-hidden="true"
            />
          ) : (
            <Loader2
              className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}

          <span className="truncate text-xs font-bold tracking-tight">
            {title ||
              (mode === "whatsapp_broadcast"
                ? "Live Meta Broadcast Delivery Stream"
                : "Live Multi-Channel Publishing Stream")}
          </span>

          <Badge
            variant="outline"
            className={cn(
              "px-1.5 py-0 text-[10px] font-semibold",
              tokenMode === "cloud"
                ? "border-status-success-border bg-status-success-bg text-status-success"
                : "border-gold-border bg-background text-primary"
            )}
          >
            <Radio
              className="mr-1 inline-block size-2.5"
              aria-hidden="true"
            />
            {tokenMode === "cloud" ? "Trigger Realtime" : "Local Sync"}
          </Badge>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-[11px]">
          {mode === "social_post" && totalTargets > 0 && (
            <span className="rounded border border-border bg-background px-2 py-0.5 font-semibold text-foreground">
              Targets:{" "}
              <span className="font-mono tabular-nums">
                {completedTargets}/{totalTargets}
              </span>{" "}
              Published
              {failedTargets > 0 ? ` (${failedTargets} Failed)` : ""}
            </span>
          )}

          {mode === "whatsapp_broadcast" && totalRecipients > 0 && (
            <span className="inline-flex items-center gap-2 rounded border border-border bg-background px-2 py-0.5 font-semibold text-foreground">
              <span>
                Sent:{" "}
                <span className="font-mono tabular-nums">
                  {sentCount}/{totalRecipients}
                </span>
              </span>
              {failedCount > 0 && (
                <span className="text-status-danger">
                  Failed:{" "}
                  <span className="font-mono tabular-nums">{failedCount}</span>
                </span>
              )}
            </span>
          )}

          <span className="font-mono font-bold tabular-nums text-primary">
            {progressValue}%
          </span>
        </div>
      </div>

      <Progress value={progressValue} className="h-2 bg-background" />

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5 truncate font-medium text-foreground/85">
          <Sparkles
            className="size-3 shrink-0 text-gold-text"
            aria-hidden="true"
          />
          <span>{stageLabel}</span>
        </span>
        <span className="shrink-0 text-[11px]">
          Run:{" "}
          <span className="font-mono tabular-nums">{runId.slice(0, 14)}</span>
        </span>
      </div>

      {(tokenError || realtimeError) && (
        <p className="text-[11px] font-medium text-status-warning">
          Stream notice:{" "}
          <span className="font-mono">
            {tokenError || realtimeError?.message}
          </span>
        </p>
      )}
    </div>
  )
}
