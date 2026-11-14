"use client"

import * as React from "react"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { CheckCircle2, Loader2, Sparkles, X, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getTaskRunProgressAction } from "@/app/actions/trigger-realtime"
import { cn } from "@/lib/utils"

export const COPILOT_STAGES = [
  {
    key: "assembling_context",
    label: "Assembling Thread & Catalog Context",
    pct: 15,
  },
  {
    key: "running_domain_tools",
    label: "Querying Rates, Batches & Hotels",
    pct: 40,
  },
  {
    key: "generating_structured_draft",
    label: "Synthesizing Bilingual Hospitality Draft",
    pct: 70,
  },
  {
    key: "completed",
    label: "Draft Ready for Review",
    pct: 100,
  },
] as const

export type CopilotStageKey = (typeof COPILOT_STAGES)[number]["key"]

export interface CopilotRealtimeRunBannerProps {
  runId: string
  publicAccessToken?: string
  mode?: "cloud" | "inline" | "local"
  title?: string
  onComplete?: (output?: any) => void
  onDismiss?: () => void
  className?: string
}

export function CopilotRealtimeRunBanner({
  runId,
  publicAccessToken,
  mode = "cloud",
  title = "AI Quoting Copilot Telemetry",
  onComplete,
  onDismiss,
  className,
}: CopilotRealtimeRunBannerProps) {
  const isCloudSubscription = mode === "cloud" && Boolean(publicAccessToken) && Boolean(runId)

  const { run: realtimeRun, error: hookError } = useRealtimeRun(runId, {
    accessToken: publicAccessToken,
    skipColumns: ["payload", "output"],
    enabled: isCloudSubscription,
  })

  // Local fallback polling state for non-cloud or tokenless executions
  const [localProgress, setLocalProgress] = React.useState<number>(
    mode === "inline" ? 100 : 15
  )
  const [localStage, setLocalStage] = React.useState<string>(
    mode === "inline" ? "completed" : "assembling_context"
  )
  const [localLabel, setLocalLabel] = React.useState<string>(
    mode === "inline" ? "Completed" : "Starting..."
  )
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [hasTriggeredComplete, setHasTriggeredComplete] = React.useState(false)

  // Resolve current progress & stage from realtimeRun or local fallback
  const cloudMetadata = (realtimeRun?.metadata ?? {}) as Record<string, unknown>
  const currentStageKey = (
    isCloudSubscription && typeof cloudMetadata.stage === "string"
      ? cloudMetadata.stage
      : localStage
  ) as CopilotStageKey | string

  const currentProgress = isCloudSubscription
    ? realtimeRun?.status === "COMPLETED"
      ? 100
      : typeof cloudMetadata.progress === "number"
      ? cloudMetadata.progress
      : 25
    : localProgress

  const isCompleted =
    (isCloudSubscription && realtimeRun?.status === "COMPLETED") ||
    currentProgress >= 100 ||
    currentStageKey === "completed"

  const isFailed =
    (isCloudSubscription &&
      (realtimeRun?.status === "FAILED" ||
        realtimeRun?.status === "CRASHED" ||
        realtimeRun?.status === "CANCELED")) ||
    Boolean(hookError) ||
    Boolean(localError)

  // Local polling loop if not using cloud realtime hook
  React.useEffect(() => {
    if (isCloudSubscription || !runId || isCompleted || isFailed) return

    let cancelled = false
    const pollInterval = setInterval(async () => {
      try {
        const res = await getTaskRunProgressAction(runId)
        if (cancelled) return
        if (res.success && res.snapshot) {
          setLocalProgress(res.snapshot.progress)
          setLocalStage(res.snapshot.stage)
          setLocalLabel(res.snapshot.label)
          if (res.snapshot.stage === "failed") {
            setLocalError(res.snapshot.error || "Execution failed")
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[CopilotBanner] Local poll error:", err)
        }
      }
    }, 1200)

    return () => {
      cancelled = true
      clearInterval(pollInterval)
    }
  }, [isCloudSubscription, runId, isCompleted, isFailed])

  // Trigger onComplete callback once upon task completion
  React.useEffect(() => {
    if (isCompleted && !hasTriggeredComplete && onComplete) {
      setHasTriggeredComplete(true)
      onComplete(realtimeRun?.output)
    }
  }, [isCompleted, hasTriggeredComplete, onComplete, realtimeRun])

  const matchedStageObj = COPILOT_STAGES.find((s) => s.key === currentStageKey)
  const displayLabel =
    matchedStageObj?.label ||
    (typeof cloudMetadata.detail === "string" ? cloudMetadata.detail : localLabel)

  return (
    <div
      role="region"
      aria-label="Copilot Telemetry Banner"
      className={cn(
        "relative rounded-xl border p-3.5 shadow-sm transition-all duration-300",
        isCompleted
          ? "border-[#C5A059]/80 bg-[#0A3622]/10 text-foreground"
          : isFailed
          ? "border-red-500/40 bg-red-500/10 text-foreground"
          : "border-[#C5A059]/40 bg-card text-foreground",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="size-4 text-[#0A3622] dark:text-[#C5A059]" />
          ) : isFailed ? (
            <AlertCircle className="size-4 text-red-600" />
          ) : (
            <Loader2 className="size-4 animate-spin text-[#C5A059]" />
          )}
          <span className="text-xs font-semibold tracking-tight text-foreground font-display">
            {title}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] uppercase font-mono px-1.5 py-0",
              isCompleted
                ? "border-emerald-600/40 bg-emerald-50 text-emerald-800"
                : isFailed
                ? "border-red-500/40 bg-red-50 text-red-700"
                : "border-[#C5A059]/60 bg-[#C5A059]/10 text-[#0A3622]"
            )}
          >
            {isCompleted
              ? "Completed"
              : isFailed
              ? "Failed"
              : "AI Estimate Engine"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-[#0A3622]">
            {Math.round(currentProgress)}%
          </span>
          {onDismiss && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onDismiss}
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss banner"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary mb-2.5">
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out",
            isCompleted
              ? "bg-[#0A3622]"
              : isFailed
              ? "bg-red-500"
              : "bg-[#C5A059]"
          )}
          style={{ width: `${Math.max(5, Math.min(100, currentProgress))}%` }}
        />
      </div>

      {/* 4 Stage Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
        {COPILOT_STAGES.map((stg) => {
          const isStageActive = currentStageKey === stg.key
          const isStagePast = currentProgress >= stg.pct
          return (
            <div
              key={stg.key}
              className={cn(
                "rounded-md px-2 py-1 text-center font-medium border transition-colors",
                isStageActive
                  ? "border-[#C5A059] bg-[#C5A059]/20 text-[#0A3622] font-semibold"
                  : isStagePast
                  ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-800"
                  : "border-border/50 bg-secondary/30 text-muted-foreground"
              )}
            >
              <div className="truncate">{stg.label}</div>
            </div>
          )
        })}
      </div>

      {/* Detailed Status or Error */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{displayLabel}</span>
      </div>
    </div>
  )
}
