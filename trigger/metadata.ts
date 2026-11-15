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

export interface TaskProgressScope {
  taskType?: string
  entityId?: string
  runId?: string
  actorUserId?: string
}

export interface TaskProgressMetadata {
  stage: TaskRunStage
  progress: number // 0..100
  label: string
  detail: string
  updatedAt: string
  taskType?: string
  entityId?: string
  runId?: string
  actorUserId?: string
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

export interface UpdateTaskProgressInput extends TaskProgressScope {
  stage: TaskRunStage
  progress: number
  label?: string
  detail?: string
  counters?: TaskProgressCounters
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

interface ScopedRunContextValue {
  runId: string
  taskType?: string
  entityId?: string
  actorUserId?: string
}

const localRunContext = new AsyncLocalStorage<ScopedRunContextValue>()

/**
 * Scoped in-memory progress store for local dev / test execution (`T-090`, `A18-012`).
 *
 * Keyed strictly by `(taskType, entityId, runId)` composite keys and explicit `runId` —
 * NEVER by a global `"latest"` singleton key — preventing concurrent entity or cross-staff
 * runs from leaking progress or output URLs across sessions.
 */
const localProgressByCompositeKey = new Map<string, TaskProgressMetadata>()
const localProgressByRunId = new Map<string, TaskProgressMetadata>()
const localRunTagsStore = new Map<string, string[]>()
const MAX_LOCAL_SNAPSHOTS = 500

export interface LocalActiveRunSummary {
  runId: string
  taskIdentifier: string
  status: "QUEUED" | "EXECUTING" | "REATTEMPTING" | "FROZEN"
  createdAt: string
  tags: string[]
  metadata?: Record<string, unknown>
}

function pruneMapIfNeeded<K, V>(map: Map<K, V>): void {
  if (map.size < MAX_LOCAL_SNAPSHOTS) return
  const firstKey = map.keys().next().value
  if (firstKey !== undefined) {
    map.delete(firstKey)
  }
}

export function buildScopedProgressKey(
  taskType: string,
  entityId: string,
  runId: string
): string {
  return `${taskType.trim()}::${entityId.trim()}::${runId.trim()}`
}

export function clearLocalRunProgressForTests(): void {
  localProgressByCompositeKey.clear()
  localProgressByRunId.clear()
  localRunTagsStore.clear()
}

export function recordLocalRunTags(runId: string, tags: string[]): void {
  const cleanRunId = runId.trim()
  if (!cleanRunId || cleanRunId.toLowerCase() === "latest" || tags.length === 0) {
    return
  }
  pruneMapIfNeeded(localRunTagsStore)
  localRunTagsStore.set(
    cleanRunId,
    tags.map((t) => t.trim()).filter((t) => t.length > 0)
  )
}

export function getLocalActiveRunsByTags(
  tags: string[]
): LocalActiveRunSummary[] {
  const cleanTags = tags.map((t) => t.trim()).filter((t) => t.length > 0)
  if (cleanTags.length === 0) {
    return []
  }

  const matching: LocalActiveRunSummary[] = []
  const requestedTags = new Set(cleanTags)

  for (const [runId, snapshot] of localProgressByRunId.entries()) {
    if (
      snapshot.stage === "completed" ||
      snapshot.stage === "failed" ||
      snapshot.progress >= 100
    ) {
      continue
    }
    const runTags = localRunTagsStore.get(runId) || []
    const hasTag = runTags.some((t) => requestedTags.has(t))
    if (hasTag) {
      matching.push({
        runId,
        taskIdentifier:
          snapshot.taskType ??
          (runId.startsWith("inline_") ? runId.split("_")[1] || "task" : "task"),
        status: snapshot.stage === "queued" || snapshot.stage === "waiting_until_scheduled"
          ? "QUEUED"
          : "EXECUTING",
        createdAt: snapshot.updatedAt,
        tags: runTags,
        metadata: snapshot as unknown as Record<string, unknown>,
      })
    }
  }

  return matching
}

/**
 * Runs a function within an `AsyncLocalStorage` scope bound to `(taskType, entityId, runId)`,
 * so all `updateTaskProgress()` calls inside an inline runner index strictly under that scoped run.
 */
export async function withLocalRunProgressScope<T>(
  runId: string,
  fn: () => Promise<T>,
  scope?: Omit<TaskProgressScope, "runId">
): Promise<T> {
  return localRunContext.run(
    {
      runId: runId.trim(),
      taskType: scope?.taskType,
      entityId: scope?.entityId,
      actorUserId: scope?.actorUserId,
    },
    fn
  )
}

/**
 * Explicitly records a progress snapshot in the scoped local fallback store (`T-090`).
 * Never writes to a global `"latest"` key.
 */
export function setLocalRunProgressSnapshot(
  runId: string,
  snapshot: TaskProgressMetadata,
  scope?: TaskProgressScope
): void {
  const cleanRunId = runId.trim()
  if (!cleanRunId || cleanRunId.toLowerCase() === "latest") {
    return
  }

  const enriched: TaskProgressMetadata = {
    ...snapshot,
    runId: cleanRunId,
    taskType: scope?.taskType ?? snapshot.taskType,
    entityId: scope?.entityId ?? snapshot.entityId,
    actorUserId: scope?.actorUserId ?? snapshot.actorUserId,
  }

  pruneMapIfNeeded(localProgressByRunId)
  localProgressByRunId.set(cleanRunId, enriched)

  if (enriched.taskType && enriched.entityId) {
    const compositeKey = buildScopedProgressKey(
      enriched.taskType,
      enriched.entityId,
      cleanRunId
    )
    pruneMapIfNeeded(localProgressByCompositeKey)
    localProgressByCompositeKey.set(compositeKey, enriched)
  }
}

/**
 * Retrieves the progress snapshot for a specific `runId` (and optional `(taskType, entityId)` scope).
 * Rejects `"latest"` and unknown run IDs cleanly with `null` (`T-090`).
 */
export function getLocalRunProgressSnapshot(
  runId: string,
  scope?: TaskProgressScope
): TaskProgressMetadata | null {
  const cleanRunId = (runId ?? "").trim()
  if (!cleanRunId || cleanRunId.toLowerCase() === "latest") {
    return null
  }

  if (scope?.taskType && scope?.entityId) {
    const compositeKey = buildScopedProgressKey(
      scope.taskType,
      scope.entityId,
      cleanRunId
    )
    return localProgressByCompositeKey.get(compositeKey) ?? null
  }

  const hit = localProgressByRunId.get(cleanRunId) ?? null
  if (!hit) {
    return null
  }

  if (scope?.taskType && hit.taskType && hit.taskType !== scope.taskType) {
    return null
  }
  if (scope?.entityId && hit.entityId && hit.entityId !== scope.entityId) {
    return null
  }
  if (
    scope?.actorUserId &&
    hit.actorUserId &&
    hit.actorUserId !== scope.actorUserId
  ) {
    return null
  }

  return hit
}

/**
 * Safely updates Trigger.dev run metadata inside a task run and caches a scoped in-memory
 * snapshot keyed strictly by `(taskType, entityId, runId)` when running in local dev/test mode.
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

  const sentCount = input.sentCount ?? mergedCounters.sent
  const failedCount = input.failedCount ?? mergedCounters.failed
  const totalRecipients = input.totalRecipients ?? mergedCounters.total

  const ctxScope = localRunContext.getStore()
  const scopedRunId = input.runId ?? ctxScope?.runId
  const scopedTaskType = input.taskType ?? ctxScope?.taskType
  const scopedEntityId = input.entityId ?? ctxScope?.entityId
  const scopedActorUserId = input.actorUserId ?? ctxScope?.actorUserId

  const snapshot: TaskProgressMetadata = {
    stage: input.stage,
    progress: clampedProgress,
    label: resolvedLabel,
    detail: resolvedDetail,
    updatedAt,
    ...(scopedTaskType ? { taskType: scopedTaskType } : {}),
    ...(scopedEntityId ? { entityId: scopedEntityId } : {}),
    ...(scopedRunId ? { runId: scopedRunId } : {}),
    ...(scopedActorUserId ? { actorUserId: scopedActorUserId } : {}),
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

  if (scopedRunId) {
    setLocalRunProgressSnapshot(scopedRunId, snapshot, {
      taskType: scopedTaskType,
      entityId: scopedEntityId,
      runId: scopedRunId,
      actorUserId: scopedActorUserId,
    })
  }

  try {
    metadata
      .set("stage", snapshot.stage)
      .set("progress", snapshot.progress)
      .set("label", snapshot.label)
      .set("detail", snapshot.detail)
      .set("updatedAt", snapshot.updatedAt)

    if (snapshot.taskType) {
      metadata.set("taskType", snapshot.taskType)
    }
    if (snapshot.entityId) {
      metadata.set("entityId", snapshot.entityId)
    }
    if (snapshot.counters) {
      const cleanCounters: Record<string, number> = {}
      for (const [k, v] of Object.entries(snapshot.counters)) {
        if (typeof v === "number") {
          cleanCounters[k] = v
        }
      }
      metadata.set("counters", cleanCounters)
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
