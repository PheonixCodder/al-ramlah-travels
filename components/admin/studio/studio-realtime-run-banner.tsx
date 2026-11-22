"use client"

import * as React from "react"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Wand2,
  X,
} from "lucide-react"
import {
  getTaskRunProgressAction,
  mintRealtimeRunPublicTokenAction,
} from "@/app/actions/trigger-realtime"
import type { TaskProgressMetadata, TaskRunStage } from "@/trigger/metadata"
import type { extractPackagesTask } from "@/trigger/extract-packages.task"
import type { renderGotenbergAssetTask } from "@/trigger/render-gotenberg-asset.task"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export const STUDIO_REALTIME_STAGES = [
  {
    key: "initializing",
    label: "Initializing",
    shortLabel: "initializing",
    defaultPct: 10,
  },
  {
    key: "extracting_ai",
    label: "Extracting AI Cards",
    shortLabel: "extracting_ai",
    defaultPct: 40,
  },
  {
    key: "normalizing_jpegs",
    label: "Normalizing 1080p JPEGs",
    shortLabel: "normalizing_jpegs",
    defaultPct: 65,
  },
  {
    key: "rendering_gotenberg",
    label: "Rendering 4K Gotenberg",
    shortLabel: "rendering_gotenberg",
    defaultPct: 75,
  },
  {
    key: "uploading_r2",
    label: "Uploading to Cloudflare R2",
    shortLabel: "uploading_r2",
    defaultPct: 90,
  },
  {
    key: "completed",
    label: "Completed",
    shortLabel: "completed",
    defaultPct: 100,
  },
] as const

export type CanonicalStudioStageKey =
  (typeof STUDIO_REALTIME_STAGES)[number]["key"] | "failed"

/**
 * Normalizes any task stage variant (`normalizing_jpeg`, `saving_records`, `persisting_db`, etc.)
 * into the canonical Studio pipeline stage (`initializing` -> `extracting_ai` -> `normalizing_jpegs`
 * -> `rendering_gotenberg` -> `uploading_r2` -> `completed`).
 */
export function normalizeStudioStage(
  rawStage: TaskRunStage | string | undefined
): CanonicalStudioStageKey {
  if (!rawStage) return "initializing"
  switch (rawStage) {
    case "queued":
    case "initializing":
      return "initializing"
    case "extracting_ai":
      return "extracting_ai"
    case "normalizing_jpeg":
    case "normalizing_jpegs":
      return "normalizing_jpegs"
    case "rendering_gotenberg":
      return "rendering_gotenberg"
    case "uploading_r2":
    case "saving_records":
    case "persisting_db":
      return "uploading_r2"
    case "completed":
      return "completed"
    case "failed":
      return "failed"
    default:
      return "initializing"
  }
}

export interface StudioRealtimeRunBannerProps {
  /**
   * Active Trigger.dev run ID or synthetic local/inline run ID (`inline_*` / `local_*`).
   */
  runId?: string | null
  /**
   * Optional pre-minted Trigger.dev scoped Public Access Token.
   */
  publicAccessToken?: string | null
  /**
   * Alias for `publicAccessToken`.
   */
  accessToken?: string | null
  /**
   * Execution token mode (`"cloud"` uses `useRealtimeRun`, `"local"` / `"inline"` polls `getTaskRunProgressAction`).
   */
  tokenMode?: "cloud" | "local" | "inline"
  /**
   * Alias for `tokenMode`.
   */
  mode?: "cloud" | "local" | "inline"
  /**
   * Optional task category for tailored header copy.
   */
  taskKind?: "extract_packages" | "render_gotenberg" | "studio_pipeline"
  /**
   * Optional banner title override.
   */
  title?: string
  /**
   * Optional local/optimistic progress state (e.g. while R2 direct upload or inline server action is running).
   */
  localProgress?: Partial<TaskProgressMetadata> | null
  /**
   * Optional initial snapshot returned by token minting.
   */
  initialSnapshot?: Partial<TaskProgressMetadata> | null
  /**
   * Whether the studio operation is currently active even before a runId is assigned.
   */
  isActive?: boolean
  /**
   * Polling interval in ms when running in `"local"` fallback mode (default: 700ms).
   */
  pollIntervalMs?: number
  /**
   * Fired once when the run transitions to `"completed"` (`100%`).
   */
  onComplete?: (snapshot: TaskProgressMetadata) => void
  /**
   * Fired once if the run transitions to `"failed"`.
   */
  onError?: (errorMessage: string) => void
  /**
   * Optional dismiss handler to close the banner after completion or failure.
   */
  onDismiss?: () => void
  className?: string
}

export function StudioRealtimeRunBanner({
  runId,
  publicAccessToken,
  accessToken,
  tokenMode,
  mode,
  taskKind = "studio_pipeline",
  title,
  localProgress,
  initialSnapshot,
  isActive = false,
  pollIntervalMs = 700,
  onComplete,
  onError,
  onDismiss,
  className,
}: StudioRealtimeRunBannerProps) {
  const effectiveRunId = (runId ?? "").trim()
  const initialToken = publicAccessToken ?? accessToken ?? null

  const [mintedAuth, setMintedAuth] = React.useState<{
    runId: string
    token: string | null
    mode: "cloud" | "local" | "inline"
  } | null>(null)
  const [polledState, setPolledState] = React.useState<{
    runId: string
    snapshot: TaskProgressMetadata
  } | null>(() =>
    initialSnapshot
      ? {
          runId: effectiveRunId,
          snapshot: {
            stage: (initialSnapshot.stage as TaskRunStage) ?? "initializing",
            progress:
              typeof initialSnapshot.progress === "number"
                ? initialSnapshot.progress
                : 10,
            label:
              initialSnapshot.label ??
              initialSnapshot.detail ??
              "Initializing studio task...",
            detail:
              initialSnapshot.detail ??
              initialSnapshot.label ??
              "Initializing studio task...",
            updatedAt: initialSnapshot.updatedAt ?? "pending",
            ...initialSnapshot,
          },
        }
      : null
  )

  const propToken =
    publicAccessToken !== undefined || accessToken !== undefined
      ? (publicAccessToken ?? accessToken ?? null)
      : undefined
  const propMode =
    tokenMode !== undefined || mode !== undefined
      ? (tokenMode ?? mode ?? "local")
      : undefined

  const activeMinted =
    mintedAuth && mintedAuth.runId === effectiveRunId ? mintedAuth : null

  const resolvedToken =
    propToken !== undefined ? propToken : (activeMinted?.token ?? null)
  const resolvedMode: "cloud" | "local" | "inline" =
    propMode !== undefined
      ? propMode
      : (activeMinted?.mode ?? (resolvedToken ? "cloud" : "local"))

  const polledSnapshot =
    polledState && polledState.runId === effectiveRunId
      ? polledState.snapshot
      : null

  const completedRunRef = React.useRef<string | null>(null)
  const failedRunRef = React.useRef<string | null>(null)

  // Mint scoped public token automatically when a runId is provided without a token
  React.useEffect(() => {
    if (!effectiveRunId) {
      return
    }

    if (initialToken && (tokenMode === "cloud" || mode === "cloud")) {
      return
    }

    let cancelled = false

    async function resolveRunAuth() {
      try {
        const res = await mintRealtimeRunPublicTokenAction(effectiveRunId)
        if (cancelled || !res.success) return

        if (res.mode === "cloud" && (res.publicAccessToken || res.token)) {
          setMintedAuth({
            runId: effectiveRunId,
            token: res.publicAccessToken ?? res.token ?? null,
            mode: "cloud",
          })
        } else {
          setMintedAuth({
            runId: effectiveRunId,
            token: null,
            mode: "local",
          })
          if (res.snapshot) {
            setPolledState({
              runId: effectiveRunId,
              snapshot: res.snapshot,
            })
          }
        }
      } catch {
        if (!cancelled) {
          setMintedAuth({
            runId: effectiveRunId,
            token: null,
            mode: "local",
          })
        }
      }
    }

    void resolveRunAuth()

    return () => {
      cancelled = true
    }
  }, [effectiveRunId, initialToken, tokenMode, mode])

  // Subscribe via @trigger.dev/react-hooks useRealtimeRun when tokenMode === "cloud"
  const isCloudSubscriptionEnabled = Boolean(
    effectiveRunId &&
    resolvedToken &&
    resolvedMode === "cloud" &&
    !effectiveRunId.startsWith("inline_") &&
    !effectiveRunId.startsWith("local_")
  )

  const { run: realtimeRun, error: realtimeError } = useRealtimeRun<
    typeof extractPackagesTask | typeof renderGotenbergAssetTask
  >(effectiveRunId || undefined, {
    accessToken: resolvedToken ?? undefined,
    skipColumns: ["payload", "output"],
    enabled: isCloudSubscriptionEnabled,
  })

  // Fall back cleanly to local polling if cloud realtime stream errors or when tokenMode === "local"
  const shouldPollLocal = Boolean(
    effectiveRunId &&
    (resolvedMode === "local" ||
      resolvedMode === "inline" ||
      Boolean(realtimeError) ||
      !resolvedToken)
  )

  React.useEffect(() => {
    if (!shouldPollLocal || !effectiveRunId) return

    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function fetchProgress() {
      try {
        const res = await getTaskRunProgressAction(effectiveRunId)
        if (cancelled || !res.success || !res.snapshot) return
        setPolledState({
          runId: effectiveRunId,
          snapshot: res.snapshot,
        })

        if (
          res.snapshot.stage === "completed" ||
          res.snapshot.stage === "failed" ||
          res.snapshot.progress >= 100
        ) {
          if (timer) {
            clearInterval(timer)
            timer = null
          }
        }
      } catch {
        // Ignore transient poll errors in local dev
      }
    }

    void fetchProgress()
    timer = setInterval(() => {
      void fetchProgress()
    }, pollIntervalMs)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [shouldPollLocal, effectiveRunId, pollIntervalMs])

  // Derive unified TaskProgressMetadata snapshot from Cloud Realtime Run, Polled Snapshot, or Local Progress prop
  const mergedSnapshot = React.useMemo<TaskProgressMetadata | null>(() => {
    // 1. Cloud realtime run metadata
    if (isCloudSubscriptionEnabled && realtimeRun) {
      const meta = (realtimeRun.metadata ?? {}) as Record<string, unknown>
      const runStatus = String(realtimeRun.status ?? "")

      const rawStage: TaskRunStage =
        typeof meta.stage === "string"
          ? (meta.stage as TaskRunStage)
          : runStatus === "COMPLETED"
            ? "completed"
            : runStatus === "FAILED" ||
                runStatus === "CRASHED" ||
                runStatus === "CANCELED"
              ? "failed"
              : "initializing"

      const progress =
        typeof meta.progress === "number"
          ? Math.max(0, Math.min(100, Math.round(meta.progress)))
          : runStatus === "COMPLETED"
            ? 100
            : 15

      const detail =
        typeof meta.detail === "string"
          ? meta.detail
          : typeof meta.label === "string"
            ? meta.label
            : runStatus === "COMPLETED"
              ? "Task completed"
              : `Running ${rawStage}...`

      const label = typeof meta.label === "string" ? meta.label : detail

      return {
        stage: rawStage,
        progress,
        label,
        detail,
        updatedAt:
          typeof meta.updatedAt === "string" ? meta.updatedAt : "pending",
        ...(typeof meta.extractedCount === "number"
          ? { extractedCount: meta.extractedCount }
          : {}),
        ...(typeof meta.pngUrl === "string" ? { pngUrl: meta.pngUrl } : {}),
        ...(typeof meta.pdfUrl === "string" ? { pdfUrl: meta.pdfUrl } : {}),
        ...(typeof meta.socialJpegUrl === "string"
          ? { socialJpegUrl: meta.socialJpegUrl }
          : {}),
        ...(typeof meta.error === "string" ? { error: meta.error } : {}),
      }
    }

    // 2. If parent passed live localProgress override and either no polledSnapshot yet or localProgress is active
    if (localProgress && localProgress.stage) {
      const localPct =
        typeof localProgress.progress === "number"
          ? Math.max(0, Math.min(100, Math.round(localProgress.progress)))
          : 10

      // If polledSnapshot exists and has progressed further than localProgress, prefer the higher progress unless localProgress is terminal
      if (
        polledSnapshot &&
        polledSnapshot.progress > localPct &&
        localProgress.stage !== "completed" &&
        localProgress.stage !== "failed"
      ) {
        return polledSnapshot
      }

      const detail =
        localProgress.detail ??
        localProgress.label ??
        polledSnapshot?.detail ??
        "Processing in studio..."

      return {
        stage: localProgress.stage,
        progress: localPct,
        label: localProgress.label ?? detail,
        detail,
        updatedAt:
          localProgress.updatedAt ?? polledSnapshot?.updatedAt ?? "pending",
        extractedCount:
          localProgress.extractedCount ?? polledSnapshot?.extractedCount,
        pngUrl: localProgress.pngUrl ?? polledSnapshot?.pngUrl,
        pdfUrl: localProgress.pdfUrl ?? polledSnapshot?.pdfUrl,
        socialJpegUrl:
          localProgress.socialJpegUrl ?? polledSnapshot?.socialJpegUrl,
        error: localProgress.error ?? polledSnapshot?.error,
      }
    }

    // 3. Polled local snapshot
    if (polledSnapshot) {
      return polledSnapshot
    }

    // 4. Fallback when isActive is true before first snapshot arrives
    if (isActive) {
      return {
        stage: "initializing",
        progress: 10,
        label: "Initializing studio pipeline...",
        detail:
          "Preparing multimodal AI extraction & 4K Chromium asset pipeline...",
        updatedAt: "pending",
      }
    }

    return null
  }, [
    isCloudSubscriptionEnabled,
    realtimeRun,
    localProgress,
    polledSnapshot,
    isActive,
  ])

  // Fire onComplete / onError callbacks once per run lifecycle
  React.useEffect(() => {
    if (!mergedSnapshot) return
    const runKey = effectiveRunId || `local_${mergedSnapshot.updatedAt}`

    if (
      (mergedSnapshot.stage === "completed" ||
        mergedSnapshot.progress >= 100) &&
      mergedSnapshot.stage !== "failed"
    ) {
      if (completedRunRef.current !== runKey) {
        completedRunRef.current = runKey
        onComplete?.(mergedSnapshot)
      }
    } else if (mergedSnapshot.stage === "failed") {
      if (failedRunRef.current !== runKey) {
        failedRunRef.current = runKey
        onError?.(
          mergedSnapshot.error ||
            mergedSnapshot.detail ||
            "Studio background task failed"
        )
      }
    }
  }, [mergedSnapshot, effectiveRunId, onComplete, onError])

  if (!mergedSnapshot && !isActive && !effectiveRunId) {
    return null
  }

  const currentSnapshot: TaskProgressMetadata = mergedSnapshot ?? {
    stage: "initializing",
    progress: 10,
    label: "Initializing...",
    detail: "Preparing Trigger.dev v4 task run...",
    updatedAt: "pending",
  }

  const canonicalStage = normalizeStudioStage(currentSnapshot.stage)
  const isCompleted =
    canonicalStage === "completed" ||
    (currentSnapshot.progress >= 100 && canonicalStage !== "failed")
  const isFailed = canonicalStage === "failed"

  const currentStageIndex = STUDIO_REALTIME_STAGES.findIndex(
    (s) => s.key === canonicalStage
  )

  const defaultTitle =
    taskKind === "extract_packages"
      ? "Multimodal AI Flyer Extraction & 1080p Social JPEG Pipeline"
      : taskKind === "render_gotenberg"
        ? "4K Gotenberg Chromium Poster & Vector PDF Render Pipeline"
        : "Trigger.dev v4 Studio Realtime Execution Pipeline"

  return (
    <div
      data-testid="studio-realtime-run-banner"
      data-stage={canonicalStage}
      data-mode={resolvedMode}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-colors motion-reduce:transition-none",
        isFailed
          ? "border-destructive-foreground/30 bg-destructive text-destructive-foreground"
          : "border-gold/60 bg-gradient-to-r from-sidebar via-primary to-sidebar text-primary-foreground",
        className
      )}
    >
      {/* Top Row: Title, Mode Badge, Stage Badge, Percentage, and Dismiss */}
      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            {isFailed ? (
              <AlertCircle
                className="size-4 shrink-0 text-destructive-foreground"
                aria-hidden="true"
              />
            ) : isCompleted ? (
              <CheckCircle2
                className="size-4 shrink-0 text-gold"
                aria-hidden="true"
              />
            ) : (
              <Loader2
                className="size-4 shrink-0 animate-spin text-gold motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <h3 className="font-display text-sm font-bold tracking-tight text-primary-foreground">
              {title || defaultTitle}
            </h3>
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
              isFailed
                ? "border-destructive-foreground/35 bg-destructive-foreground/15 text-destructive-foreground"
                : "border-gold/50 bg-gold/15 text-gold"
            )}
          >
            {isCloudSubscriptionEnabled
              ? "Trigger.dev Cloud Realtime"
              : "Studio Live Telemetry"}
          </span>

          {/* Active Stage Badge */}
          <Badge
            variant="outline"
            className={cn(
              "border px-2.5 py-0.5 font-mono text-[11px] font-bold",
              isFailed
                ? "border-destructive-foreground/40 bg-destructive-foreground/15 text-destructive-foreground"
                : isCompleted
                  ? "border-gold/60 bg-gold/20 text-primary-foreground"
                  : "border-gold bg-gold/20 text-primary-foreground"
            )}
          >
            {canonicalStage}
          </Badge>

          {typeof currentSnapshot.extractedCount === "number" &&
            currentSnapshot.extractedCount > 0 && (
              <Badge className="bg-gold text-[11px] font-bold text-gold-foreground tabular-nums">
                <Sparkles className="mr-1 size-3" aria-hidden="true" />
                {currentSnapshot.extractedCount} Cards Extracted
              </Badge>
            )}
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span
            className={cn(
              "font-mono text-sm font-bold tabular-nums",
              isFailed ? "text-destructive-foreground" : "text-gold"
            )}
          >
            {currentSnapshot.progress}%
          </span>

          {onDismiss && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onDismiss}
              className="size-6 cursor-pointer rounded-full text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              title="Dismiss progress banner"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Luxury Haramain Gold/Emerald Progress Bar */}
      <div className="relative z-10 mt-3">
        <Progress
          value={currentSnapshot.progress}
          className="h-2.5 w-full overflow-hidden rounded-full bg-sidebar/50 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-gold [&_[data-slot=progress-indicator]]:to-primary-foreground [&_[data-slot=progress-track]]:h-2.5 [&_[data-slot=progress-track]]:bg-primary-foreground/15"
        />
      </div>

      {/* Detail Message & Asset Quick Links */}
      <div className="relative z-10 mt-2.5 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-primary-foreground/90">
          <Wand2
            className={cn(
              "size-3.5 shrink-0",
              isFailed ? "text-destructive-foreground" : "text-gold"
            )}
            aria-hidden="true"
          />
          <span className="font-medium">
            {currentSnapshot.error ||
              currentSnapshot.detail ||
              currentSnapshot.label}
          </span>
        </div>

        {/* Generated Asset Links when available */}
        {(currentSnapshot.pngUrl ||
          currentSnapshot.socialJpegUrl ||
          currentSnapshot.pdfUrl) && (
          <div className="flex flex-wrap items-center gap-2">
            {currentSnapshot.pngUrl && (
              <a
                href={currentSnapshot.pngUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-gold/60 bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-gold/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
              >
                <ImageIcon className="size-3 text-gold" aria-hidden="true" />
                <span>4K PNG</span>
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            )}
            {currentSnapshot.socialJpegUrl && (
              <a
                href={currentSnapshot.socialJpegUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-gold/50 bg-sidebar/60 px-2 py-0.5 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-sidebar/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
              >
                <span>1080p Social JPEG</span>
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            )}
            {currentSnapshot.pdfUrl && (
              <a
                href={currentSnapshot.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-primary-foreground/30 bg-primary-foreground/10 px-2 py-0.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
              >
                <FileText className="size-3 text-gold" aria-hidden="true" />
                <span>Vector PDF</span>
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Stage Stepper Pills: initializing -> extracting_ai -> normalizing_jpegs -> rendering_gotenberg -> uploading_r2 -> completed */}
      <div className="relative z-10 mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-6">
        {STUDIO_REALTIME_STAGES.map((stageItem, idx) => {
          const isStepDone =
            isCompleted ||
            (currentStageIndex > idx && !isFailed) ||
            currentSnapshot.progress >= 100
          const isStepCurrent =
            !isCompleted && !isFailed && currentStageIndex === idx

          return (
            <div
              key={stageItem.key}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[11px] transition-colors motion-reduce:transition-none",
                isStepDone
                  ? "border-gold/60 bg-gold/20 font-bold text-primary-foreground"
                  : isStepCurrent
                    ? "border-gold bg-primary-foreground/15 font-bold text-gold shadow-xs"
                    : "border-primary-foreground/15 bg-sidebar/35 text-primary-foreground/65"
              )}
            >
              {isStepDone ? (
                <CheckCircle2
                  className="size-3 shrink-0 text-gold"
                  aria-hidden="true"
                />
              ) : isStepCurrent ? (
                <Loader2
                  className="size-3 shrink-0 animate-spin text-gold motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <span className="size-1.5 shrink-0 rounded-full bg-primary-foreground/40" />
              )}
              <span className="truncate">{stageItem.shortLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
