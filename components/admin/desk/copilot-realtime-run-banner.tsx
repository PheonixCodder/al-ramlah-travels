"use client"

import * as React from "react"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { CheckCircle2, Loader2, X, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getTaskRunProgressAction } from "@/app/actions/trigger-realtime"
import type {
  ApplicationQuoteCopilotResult,
  WaCopilotDraftResult,
} from "@/lib/ai/quoting-copilot"
import { cn } from "@/lib/utils"

/**
 * Trigger.dev Cloud Realtime subscription column filter (`T-072`, `A18-009`):
 * Skips large input `payload` blobs while keeping `output` enabled so completed
 * AI Quoting Copilot proposals and Luxury Gotenberg PDF URLs hydrate immediately in the UI.
 */
export const COPILOT_REALTIME_SKIP_COLUMNS = ["payload"] as const

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

export interface CopilotBannerRunOutput {
  draft?: ApplicationQuoteCopilotResult & WaCopilotDraftResult
  modelUsed?: string
  executionMode?: "ai_provider" | "deterministic_fallback"
  pdfUrl?: string
  pngUrl?: string
  socialJpegUrl?: string
  [key: string]: unknown
}

export interface CopilotRealtimeRunBannerProps {
  runId: string
  publicAccessToken?: string
  mode?: "cloud" | "inline" | "local"
  title?: string
  label?: string
  onComplete?: (output?: CopilotBannerRunOutput) => void | Promise<void>
  onError?: (errorMessage: string) => void
  onDismiss?: () => void
  className?: string
}

export function CopilotRealtimeRunBanner({
  runId,
  publicAccessToken,
  mode = "cloud",
  title,
  label,
  onComplete,
  onError,
  onDismiss,
  className,
}: CopilotRealtimeRunBannerProps) {
  const effectiveTitle = title ?? label ?? "AI Quoting Copilot Telemetry"
  const isCloudSubscription =
    mode === "cloud" &&
    Boolean(publicAccessToken) &&
    Boolean(runId) &&
    !runId.startsWith("inline_")

  const { run: realtimeRun, error: hookError } = useRealtimeRun(runId, {
    accessToken: publicAccessToken,
    skipColumns: [...COPILOT_REALTIME_SKIP_COLUMNS],
    enabled: isCloudSubscription,
  })

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
  const completedRunIdRef = React.useRef<string | null>(null)
  const failedRunIdRef = React.useRef<string | null>(null)

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
    (!isCloudSubscription &&
      (currentProgress >= 100 || currentStageKey === "completed"))

  const isFailed =
    (isCloudSubscription &&
      (realtimeRun?.status === "FAILED" ||
        realtimeRun?.status === "CRASHED" ||
        realtimeRun?.status === "CANCELED")) ||
    Boolean(hookError) ||
    Boolean(localError)

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

  React.useEffect(() => {
    if (isCompleted && completedRunIdRef.current !== runId && onComplete) {
      completedRunIdRef.current = runId
      const hydratedOutput =
        realtimeRun?.output && typeof realtimeRun.output === "object"
          ? (realtimeRun.output as CopilotBannerRunOutput)
          : undefined
      void onComplete(hydratedOutput)
    }
  }, [isCompleted, runId, onComplete, realtimeRun])

  React.useEffect(() => {
    if (isFailed && failedRunIdRef.current !== runId && onError) {
      failedRunIdRef.current = runId
      const errMessage =
        hookError?.message ||
        localError ||
        (typeof realtimeRun?.error?.message === "string"
          ? realtimeRun.error.message
          : `${effectiveTitle} execution failed`)
      onError(errMessage)
    }
  }, [
    isFailed,
    runId,
    onError,
    hookError,
    localError,
    realtimeRun,
    effectiveTitle,
  ])

  const matchedStageObj = COPILOT_STAGES.find((s) => s.key === currentStageKey)
  const displayLabel =
    matchedStageObj?.label ||
    (typeof cloudMetadata.detail === "string"
      ? cloudMetadata.detail
      : localLabel)

  return (
    <div
      role="region"
      aria-label="Copilot Telemetry Banner"
      className={cn(
        "relative rounded-xl border p-3.5 shadow-sm transition-colors duration-300 motion-reduce:transition-none",
        isCompleted
          ? "border-status-success-border bg-status-success-bg text-foreground"
          : isFailed
            ? "border-status-danger-border bg-status-danger-bg text-foreground"
            : "border-gold-border bg-background text-foreground",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2
              className="size-4 text-status-success"
              aria-hidden="true"
            />
          ) : isFailed ? (
            <AlertCircle
              className="size-4 text-status-danger"
              aria-hidden="true"
            />
          ) : (
            <Loader2
              className="size-4 animate-spin text-gold-text motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          <span className="font-display text-xs font-semibold tracking-tight text-foreground">
            {effectiveTitle}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "px-1.5 py-0 text-[11px] font-medium",
              isCompleted
                ? "border-status-success-border bg-status-success-bg text-status-success"
                : isFailed
                  ? "border-status-danger-border bg-status-danger-bg text-status-danger"
                  : "border-gold-border bg-accent text-primary"
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
          <span className="font-mono text-xs font-bold tabular-nums text-primary">
            {Math.round(currentProgress)}%
          </span>
          {onDismiss && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onDismiss}
              className="size-6 p-0 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Dismiss banner"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full w-full origin-left transition-transform duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none",
            isCompleted
              ? "bg-status-success"
              : isFailed
                ? "bg-status-danger"
                : "bg-gold"
          )}
          style={{
            transform: `scaleX(${Math.max(5, Math.min(100, currentProgress)) / 100})`,
          }}
        />
      </div>

      {/* 4 Stage Pills */}
      <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-4">
        {COPILOT_STAGES.map((stg) => {
          const isStageActive = currentStageKey === stg.key
          const isStagePast = currentProgress >= stg.pct
          return (
            <div
              key={stg.key}
              className={cn(
                "rounded-md border px-2 py-1 text-center font-medium transition-colors motion-reduce:transition-none",
                isStageActive
                  ? "border-gold-border bg-accent font-semibold text-primary"
                  : isStagePast
                    ? "border-status-success-border bg-status-success-bg text-status-success"
                    : "border-border bg-secondary/50 text-muted-foreground"
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
