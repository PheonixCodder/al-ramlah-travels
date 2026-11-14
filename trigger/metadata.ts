import { AsyncLocalStorage } from "node:async_hooks"
import { metadata } from "@trigger.dev/sdk"

export type TaskRunStage =
  | "queued"
  | "initializing"
  | "waiting_until_scheduled"
  | "extracting_ai"
  | "normalizing_jpeg"
  | "normalizing_jpegs"
  | "saving_records"
  | "persisting_db"
  | "rendering_gotenberg"
  | "uploading_r2"
  | "publishing_targets"
  | "waiting_step2_delay"
  | "publishing_step2"
  | "sending_broadcast"
  | "completed"
  | "failed"
  | (string & {})

export interface TaskProgressCounters {
  sent?: number
  failed?: number
  total?: number
  sentCount?: number
  failedCount?: number
  totalRecipients?: number
  completedTargets?: number
  failedTargets?: number
  totalTargets?: number
  extractedCount?: number
  [key: string]: number | undefined
}

export interface TaskProgressMetadata {
  stage: TaskRunStage
  progress: number // 0..100
  label: string
  detail: string
  updatedAt: string
  counters?: TaskProgressCounters
  // Optional domain fields
  extractedCount?: number
  totalRecipients?: number
  sentCount?: number
  failedCount?: number
  completedTargets?: number
  failedTargets?: number
  totalTargets?: number
  pdfUrl?: string
  pngUrl?: string
  socialJpegUrl?: string
  error?: string
}

export interface UpdateTaskProgressInput {
  stage: TaskRunStage
  progress: number
  label?: string
  detail?: string
  counters?: TaskProgressCounters
  runId?: string
  extractedCount?: number
  totalRecipients?: number
  sentCount?: number
  failedCount?: number
  completedTargets?: number
  failedTargets?: number
  totalTargets?: number
  pdfUrl?: string
  pngUrl?: string
  socialJpegUrl?: string
  error?: string
}

const localRunContext = new AsyncLocalStorage<string>()
const localProgressStore = new Map<string, TaskProgressMetadata>()
const localRunTagsStore = new Map<string, string[]>()
const MAX_LOCAL_SNAPSHOTS = 250

export interface LocalActiveRunSummary {
  runId: string
  taskIdentifier: string
  status: "QUEUED" | "EXECUTING" | "REATTEMPTING" | "FROZEN"
  createdAt: string
  tags: string[]
  metadata?: Record<string, unknown>
}

export function recordLocalRunTags(runId: string, tags: string[]): void {
  localRunTagsStore.set(runId, tags)
}

export function getLocalActiveRunsByTags(tags: string[]): LocalActiveRunSummary[] {
  const matching: LocalActiveRunSummary[] = []
  const requestedTags = new Set(tags)

  for (const [runId, snapshot] of localProgressStore.entries()) {
    if (runId === "latest") continue
    if (
      snapshot.stage === "completed" ||
      snapshot.stage === "failed" ||
      snapshot.progress >= 100
    ) {
      continue
    }
    const runTags = localRunTagsStore.get(runId) || []
    const hasTag = runTags.some((t) => requestedTags.has(t))
    if (hasTag || tags.length === 0) {
      matching.push({
        runId,
        taskIdentifier: runId.startsWith("inline_")
          ? runId.split("_")[1] || "task"
          : "task",
        status: "EXECUTING",
        createdAt: snapshot.updatedAt,
        tags: runTags,
        metadata: snapshot as unknown as Record<string, unknown>,
      })
    }
  }

  return matching
}

function pruneStoreIfNeeded() {
  if (localProgressStore.size <= MAX_LOCAL_SNAPSHOTS) return
  const firstKey = localProgressStore.keys().next().value
  if (firstKey) {
    localProgressStore.delete(firstKey)
  }
}

/**
 * Runs a function within an AsyncLocalStorage scope bound to a synthetic or local `runId`,
 * so all `updateTaskProgress()` calls inside the inline runner automatically index under `runId`.
 */
export async function withLocalRunProgressScope<T>(
  runId: string,
  fn: () => Promise<T>
): Promise<T> {
  return localRunContext.run(runId, fn)
}

/**
 * Explicitly records a progress snapshot in the local in-memory fallback store.
 */
export function setLocalRunProgressSnapshot(
  runId: string,
  snapshot: TaskProgressMetadata
): void {
  pruneStoreIfNeeded()
  localProgressStore.set(runId, snapshot)
  localProgressStore.set("latest", snapshot)
}

/**
 * Retrieves the latest progress snapshot for a given `runId` in local dev fallback mode.
 */
export function getLocalRunProgressSnapshot(
  runId: string
): TaskProgressMetadata | null {
  const direct = localProgressStore.get(runId)
  if (direct) return direct

  if (runId.startsWith("inline_") || runId.startsWith("local_")) {
    const latest = localProgressStore.get("latest")
    if (latest) return latest
    return {
      stage: "completed",
      progress: 100,
      label: "Completed locally",
      detail: "Completed locally",
      updatedAt: new Date().toISOString(),
    }
  }

  return null
}

/**
 * Safely updates Trigger.dev run metadata inside a task run and caches an in-memory
 * snapshot for local dev fallback when `TRIGGER_SECRET_KEY` is absent.
 */
export function updateTaskProgress(
  input: UpdateTaskProgressInput
): TaskProgressMetadata {
  const clampedProgress = Math.max(
    0,
    Math.min(100, Math.round(Number(input.progress) || 0))
  )
  const resolvedLabel = input.label ?? input.detail ?? String(input.stage)
  const resolvedDetail = input.detail ?? input.label ?? String(input.stage)
  const updatedAt = new Date().toISOString()

  const mergedCounters: TaskProgressCounters = {
    ...(input.counters ?? {}),
  }

  if (input.sentCount !== undefined) {
    mergedCounters.sentCount = input.sentCount
    mergedCounters.sent = mergedCounters.sent ?? input.sentCount
  }
  if (input.failedCount !== undefined) {
    mergedCounters.failedCount = input.failedCount
    mergedCounters.failed = mergedCounters.failed ?? input.failedCount
  }
  if (input.totalRecipients !== undefined) {
    mergedCounters.totalRecipients = input.totalRecipients
    mergedCounters.total = mergedCounters.total ?? input.totalRecipients
  }
  if (input.completedTargets !== undefined) {
    mergedCounters.completedTargets = input.completedTargets
  }
  if (input.failedTargets !== undefined) {
    mergedCounters.failedTargets = input.failedTargets
  }
  if (input.totalTargets !== undefined) {
    mergedCounters.totalTargets = input.totalTargets
  }
  if (input.extractedCount !== undefined) {
    mergedCounters.extractedCount = input.extractedCount
  }

  // Also normalize shorthand sent/failed/total into canonical fields
  const sentCount = input.sentCount ?? mergedCounters.sent
  const failedCount = input.failedCount ?? mergedCounters.failed
  const totalRecipients = input.totalRecipients ?? mergedCounters.total

  const snapshot: TaskProgressMetadata = {
    stage: input.stage,
    progress: clampedProgress,
    label: resolvedLabel,
    detail: resolvedDetail,
    updatedAt,
    ...(Object.keys(mergedCounters).length > 0
      ? { counters: mergedCounters }
      : {}),
    ...(input.extractedCount !== undefined
      ? { extractedCount: input.extractedCount }
      : {}),
    ...(totalRecipients !== undefined ? { totalRecipients } : {}),
    ...(sentCount !== undefined ? { sentCount } : {}),
    ...(failedCount !== undefined ? { failedCount } : {}),
    ...(input.completedTargets !== undefined
      ? { completedTargets: input.completedTargets }
      : {}),
    ...(input.failedTargets !== undefined
      ? { failedTargets: input.failedTargets }
      : {}),
    ...(input.totalTargets !== undefined
      ? { totalTargets: input.totalTargets }
      : {}),
    ...(input.pdfUrl !== undefined ? { pdfUrl: input.pdfUrl } : {}),
    ...(input.pngUrl !== undefined ? { pngUrl: input.pngUrl } : {}),
    ...(input.socialJpegUrl !== undefined
      ? { socialJpegUrl: input.socialJpegUrl }
      : {}),
    ...(input.error !== undefined ? { error: input.error } : {}),
  }

  const scopedRunId = input.runId ?? localRunContext.getStore()
  if (scopedRunId) {
    setLocalRunProgressSnapshot(scopedRunId, snapshot)
  } else {
    pruneStoreIfNeeded()
    localProgressStore.set("latest", snapshot)
  }

  try {
    metadata
      .set("stage", snapshot.stage)
      .set("progress", snapshot.progress)
      .set("label", snapshot.label)
      .set("detail", snapshot.detail)
      .set("updatedAt", snapshot.updatedAt)

    if (snapshot.counters) {
      metadata.set("counters", snapshot.counters as Record<string, number>)
    }
    if (snapshot.extractedCount !== undefined) {
      metadata.set("extractedCount", snapshot.extractedCount)
    }
    if (snapshot.totalRecipients !== undefined) {
      metadata.set("totalRecipients", snapshot.totalRecipients)
    }
    if (snapshot.sentCount !== undefined) {
      metadata.set("sentCount", snapshot.sentCount)
    }
    if (snapshot.failedCount !== undefined) {
      metadata.set("failedCount", snapshot.failedCount)
    }
    if (snapshot.completedTargets !== undefined) {
      metadata.set("completedTargets", snapshot.completedTargets)
    }
    if (snapshot.failedTargets !== undefined) {
      metadata.set("failedTargets", snapshot.failedTargets)
    }
    if (snapshot.totalTargets !== undefined) {
      metadata.set("totalTargets", snapshot.totalTargets)
    }
    if (snapshot.pdfUrl !== undefined) {
      metadata.set("pdfUrl", snapshot.pdfUrl)
    }
    if (snapshot.pngUrl !== undefined) {
      metadata.set("pngUrl", snapshot.pngUrl)
    }
    if (snapshot.socialJpegUrl !== undefined) {
      metadata.set("socialJpegUrl", snapshot.socialJpegUrl)
    }
    if (snapshot.error !== undefined) {
      metadata.set("error", snapshot.error)
    }
  } catch {
    // Safe no-op when invoked outside a Trigger.dev task run context in local development
  }

  return snapshot
}
