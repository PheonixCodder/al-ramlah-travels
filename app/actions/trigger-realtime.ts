"use server"

import { auth as triggerAuth, runs } from "@trigger.dev/sdk"
import { requireAdmin } from "@/lib/auth-guard"
import {
  ALLOWED_OBSERVABLE_TASK_IDS,
  batchRealtimeRunIdsSchema,
  listActiveRunsInputSchema,
  realtimeRunIdSchema,
  verifyRealtimeTagAuthorization,
  verifyRealtimeTagsBatchAuthorization,
} from "@/lib/trigger/realtime-scoping"
import { isTriggerCloudConfigured } from "@/trigger/dispatch"
import {
  getLocalActiveRunsByTags,
  getLocalRunProgressSnapshot,
  type TaskProgressMetadata,
  type TaskRunStage,
} from "@/trigger/metadata"

function parseValidatedRunId(rawInput: unknown): {
  ok: true
  runId: string
} | {
  ok: false
  rawRunId: string
  error: string
} {
  const candidate =
    rawInput &&
    typeof rawInput === "object" &&
    "runId" in rawInput &&
    !Array.isArray(rawInput)
      ? (rawInput as { runId?: unknown }).runId
      : rawInput

  const rawRunId = typeof candidate === "string" ? candidate : ""
  const parsed = realtimeRunIdSchema.safeParse(candidate)
  if (!parsed.success) {
    return {
      ok: false,
      rawRunId,
      error: parsed.error.issues[0]?.message || "Invalid Trigger runId",
    }
  }

  return {
    ok: true,
    runId: parsed.data,
  }
}

export interface MintRealtimeRunTokenResult {
  success: boolean
  mode: "cloud" | "local" | "inline"
  runId: string
  token?: string
  publicAccessToken?: string
  snapshot?: TaskProgressMetadata
  fallbackStatus?: "COMPLETED" | "EXECUTING" | "QUEUED" | "FAILED"
  fallbackMetadata?: Partial<TaskProgressMetadata>
  error?: string
}

export type RealtimeRunTokenResult = MintRealtimeRunTokenResult

export interface TaskRunProgressResult {
  success: boolean
  mode: "cloud" | "local"
  runId: string
  status?: string
  isCompleted?: boolean
  isSuccess?: boolean
  isFailed?: boolean
  snapshot: TaskProgressMetadata | null
  output?: unknown
  error?: string
}

export type TaskRunStatusResult = TaskRunProgressResult

async function verifyCloudRunAccess(
  runId: string,
  session: Awaited<ReturnType<typeof requireAdmin>>
): Promise<
  | { ok: true; run: Awaited<ReturnType<typeof runs.retrieve>> }
  | { ok: false; error: string }
> {
  const run = await runs.retrieve(runId)

  if (!ALLOWED_OBSERVABLE_TASK_IDS.has(run.taskIdentifier)) {
    return {
      ok: false,
      error: `Forbidden: Task "${run.taskIdentifier}" is not observable via client Realtime`,
    }
  }

  if (
    run.taskIdentifier === "send-whatsapp-broadcast" &&
    session.user.role !== "super_admin"
  ) {
    return {
      ok: false,
      error:
        "Forbidden: Super Administrator privilege required for broadcast runs",
    }
  }

  const runTags = Array.isArray(run.tags) ? run.tags : []
  const entityTags = runTags.filter(
    (t) => !t.startsWith("platform:") && !t.startsWith("pacing:")
  )

  if (entityTags.length > 0) {
    let anyAuthorized = false
    let lastError = "Forbidden: Run entity is not accessible"
    for (const tag of entityTags) {
      const check = await verifyRealtimeTagAuthorization(tag, session)
      if (check.ok) {
        anyAuthorized = true
        break
      }
      lastError = check.error
    }
    if (!anyAuthorized) {
      return { ok: false, error: lastError }
    }
  }

  return { ok: true, run }
}

/**
 * Mints a short-lived (`15m`), read-only Trigger.dev Public Access Token (`scopes: { read: { runs: [runId] } }`)
 * after verifying `requireAdmin()`, `runId` format, observable task allowlist, and entity access (`T-090`).
 */
export async function mintRealtimeRunPublicTokenAction(
  rawInput: string | { runId: string }
): Promise<MintRealtimeRunTokenResult> {
  try {
    const session = await requireAdmin()
    const parsed = parseValidatedRunId(rawInput)
    if (!parsed.ok) {
      return {
        success: false,
        mode: "local",
        runId: parsed.rawRunId,
        error: parsed.error,
      }
    }

    const runId = parsed.runId
    const isLocalSynthetic =
      runId.startsWith("inline_") || runId.startsWith("local_")

    if (isTriggerCloudConfigured() && !isLocalSynthetic) {
      const access = await verifyCloudRunAccess(runId, session)
      if (!access.ok) {
        return {
          success: false,
          mode: "cloud",
          runId,
          error: access.error,
        }
      }

      const publicAccessToken = await triggerAuth.createPublicToken({
        scopes: {
          read: {
            runs: [runId],
          },
        },
        expirationTime: "15m",
      })

      return {
        success: true,
        mode: "cloud",
        runId,
        token: publicAccessToken,
        publicAccessToken,
      }
    }

    const snapshot = getLocalRunProgressSnapshot(runId)
    if (!snapshot) {
      return {
        success: false,
        mode: "local",
        runId,
        error: "Run not found in scoped local progress store",
      }
    }

    if (
      snapshot.taskType === "send-whatsapp-broadcast" &&
      session.user.role !== "super_admin"
    ) {
      return {
        success: false,
        mode: "local",
        runId,
        error:
          "Forbidden: Super Administrator privilege required for broadcast runs",
      }
    }

    return {
      success: true,
      mode: "local",
      runId,
      snapshot,
      fallbackStatus:
        snapshot.stage === "failed"
          ? "FAILED"
          : snapshot.progress >= 100 || snapshot.stage === "completed"
            ? "COMPLETED"
            : "EXECUTING",
      fallbackMetadata: snapshot,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to mint realtime run public token"
    return {
      success: false,
      mode: "local",
      runId: typeof rawInput === "string" ? rawInput : rawInput?.runId ?? "",
      error,
    }
  }
}

/**
 * Retrieves the current task run progress snapshot after verifying `requireAdmin()`, `runId` format,
 * observable task allowlist, and entity ownership (`T-090`).
 */
export async function getTaskRunProgressAction(
  rawInput: string | { runId: string }
): Promise<TaskRunProgressResult> {
  try {
    const session = await requireAdmin()
    const parsed = parseValidatedRunId(rawInput)
    if (!parsed.ok) {
      return {
        success: false,
        mode: "local",
        runId: parsed.rawRunId,
        snapshot: null,
        isCompleted: false,
        isSuccess: false,
        isFailed: true,
        error: parsed.error,
      }
    }

    const runId = parsed.runId
    const isLocalSynthetic =
      runId.startsWith("inline_") || runId.startsWith("local_")

    if (isTriggerCloudConfigured() && !isLocalSynthetic) {
      const access = await verifyCloudRunAccess(runId, session)
      if (!access.ok) {
        return {
          success: false,
          mode: "cloud",
          runId,
          snapshot: null,
          isCompleted: false,
          isSuccess: false,
          isFailed: true,
          error: access.error,
        }
      }

      const run = access.run
      const meta = (run.metadata ?? {}) as Record<string, unknown>

      const stage: TaskRunStage =
        typeof meta.stage === "string"
          ? (meta.stage as TaskRunStage)
          : run.status === "COMPLETED"
            ? "completed"
            : run.status === "FAILED" ||
                run.status === "CRASHED" ||
                run.status === "CANCELED"
              ? "failed"
              : "initializing"

      const progress =
        typeof meta.progress === "number"
          ? meta.progress
          : run.status === "COMPLETED"
            ? 100
            : 0

      const label =
        typeof meta.label === "string"
          ? meta.label
          : typeof meta.detail === "string"
            ? meta.detail
            : String(stage)

      const detail = typeof meta.detail === "string" ? meta.detail : label

      const snapshot: TaskProgressMetadata = {
        stage,
        progress,
        label,
        detail,
        updatedAt:
          typeof meta.updatedAt === "string"
            ? meta.updatedAt
            : new Date().toISOString(),
        ...(typeof meta.counters === "object" && meta.counters !== null
          ? { counters: meta.counters as TaskProgressMetadata["counters"] }
          : {}),
        ...(typeof meta.extractedCount === "number"
          ? { extractedCount: meta.extractedCount }
          : {}),
        ...(typeof meta.totalRecipients === "number"
          ? { totalRecipients: meta.totalRecipients }
          : {}),
        ...(typeof meta.sentCount === "number"
          ? { sentCount: meta.sentCount }
          : {}),
        ...(typeof meta.failedCount === "number"
          ? { failedCount: meta.failedCount }
          : {}),
        ...(typeof meta.completedTargets === "number"
          ? { completedTargets: meta.completedTargets }
          : {}),
        ...(typeof meta.failedTargets === "number"
          ? { failedTargets: meta.failedTargets }
          : {}),
        ...(typeof meta.totalTargets === "number"
          ? { totalTargets: meta.totalTargets }
          : {}),
        ...(typeof meta.pdfUrl === "string" ? { pdfUrl: meta.pdfUrl } : {}),
        ...(typeof meta.pngUrl === "string" ? { pngUrl: meta.pngUrl } : {}),
        ...(typeof meta.socialJpegUrl === "string"
          ? { socialJpegUrl: meta.socialJpegUrl }
          : {}),
        ...(typeof meta.error === "string" ? { error: meta.error } : {}),
      }

      const isCompleted = Boolean(run.isCompleted || run.status === "COMPLETED")
      const isFailed = Boolean(
        run.isFailed ||
          run.status === "FAILED" ||
          run.status === "CRASHED" ||
          run.status === "CANCELED"
      )

      return {
        success: true,
        mode: "cloud",
        runId,
        status: run.status,
        isCompleted: isCompleted || isFailed,
        isSuccess: Boolean(run.isSuccess || run.status === "COMPLETED"),
        isFailed,
        snapshot,
        output: run.output,
      }
    }

    const snapshot = getLocalRunProgressSnapshot(runId)
    if (!snapshot) {
      return {
        success: false,
        mode: "local",
        runId,
        snapshot: null,
        isCompleted: false,
        isSuccess: false,
        isFailed: true,
        error: "Run not found in scoped local progress store",
      }
    }

    if (
      snapshot.taskType === "send-whatsapp-broadcast" &&
      session.user.role !== "super_admin"
    ) {
      return {
        success: false,
        mode: "local",
        runId,
        snapshot: null,
        isCompleted: false,
        isSuccess: false,
        isFailed: true,
        error:
          "Forbidden: Super Administrator privilege required for broadcast runs",
      }
    }

    const status =
      snapshot.stage === "failed"
        ? "FAILED"
        : snapshot.progress >= 100 || snapshot.stage === "completed"
          ? "COMPLETED"
          : "EXECUTING"

    return {
      success: true,
      mode: "local",
      runId,
      status,
      isCompleted: status === "COMPLETED" || status === "FAILED",
      isSuccess: status === "COMPLETED",
      isFailed: status === "FAILED",
      snapshot,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to retrieve task run progress"
    return {
      success: false,
      mode: "local",
      runId: typeof rawInput === "string" ? rawInput : rawInput?.runId ?? "",
      snapshot: null,
      isCompleted: false,
      isSuccess: false,
      isFailed: true,
      error,
    }
  }
}

export async function createRealtimeRunTokenAction(
  rawInput: unknown
): Promise<MintRealtimeRunTokenResult> {
  return mintRealtimeRunPublicTokenAction(
    rawInput as string | { runId: string }
  )
}

export interface BatchRealtimeTokenResult {
  success: boolean
  mode: "cloud" | "local" | "inline"
  publicAccessToken?: string
  token?: string
  runIds: string[]
  error?: string
}

/**
 * Mints a short-lived (`15m`), read-only token covering multiple authorized run IDs (`<= 25`) (`T-090`).
 */
export async function createBatchRealtimeRunTokensAction(
  rawInput: unknown
): Promise<BatchRealtimeTokenResult> {
  try {
    const session = await requireAdmin()
    const candidate =
      rawInput &&
      typeof rawInput === "object" &&
      "runIds" in rawInput &&
      !Array.isArray(rawInput)
        ? (rawInput as { runIds?: unknown }).runIds
        : rawInput

    const parsed = batchRealtimeRunIdsSchema.safeParse(candidate)
    if (!parsed.success) {
      return {
        success: false,
        mode: "local",
        runIds: [],
        error:
          parsed.error.issues[0]?.message || "Invalid batch runIds payload",
      }
    }

    const runIds = parsed.data
    const cloudRunIds = runIds.filter(
      (id) => !id.startsWith("inline_") && !id.startsWith("local_")
    )

    if (isTriggerCloudConfigured() && cloudRunIds.length > 0) {
      for (const id of cloudRunIds) {
        const access = await verifyCloudRunAccess(id, session)
        if (!access.ok) {
          return {
            success: false,
            mode: "cloud",
            runIds: [],
            error: access.error,
          }
        }
      }

      const publicAccessToken = await triggerAuth.createPublicToken({
        scopes: {
          read: {
            runs: cloudRunIds,
          },
        },
        expirationTime: "15m",
      })
      return {
        success: true,
        mode: "cloud",
        publicAccessToken,
        token: publicAccessToken,
        runIds,
      }
    }

    return {
      success: true,
      mode: "local",
      runIds,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to mint batch realtime run tokens"
    return {
      success: false,
      mode: "local",
      runIds: [],
      error,
    }
  }
}

export async function mintBatchRealtimePublicTokenAction(
  runIds: string[]
): Promise<BatchRealtimeTokenResult> {
  return createBatchRealtimeRunTokensAction(runIds)
}

/**
 * Mints a short-lived (`15m`), read-only Trigger.dev Realtime token scoped strictly
 * to validated, entity-authorized tags (`T-090`).
 */
export async function mintRealtimeTagPublicTokenAction(
  tags: string[]
): Promise<{
  success: boolean
  mode: "cloud" | "local"
  publicAccessToken?: string
  token?: string
  error?: string
}> {
  try {
    const session = await requireAdmin()
    const parsed = listActiveRunsInputSchema.safeParse(tags)
    if (!parsed.success) {
      return {
        success: false,
        mode: "local",
        error:
          parsed.error.issues[0]?.message ||
          "At least one valid tag is required",
      }
    }

    const rawTags = Array.isArray(parsed.data) ? parsed.data : parsed.data.tags
    const authCheck = await verifyRealtimeTagsBatchAuthorization(
      rawTags,
      session
    )
    if (!authCheck.ok) {
      return {
        success: false,
        mode: isTriggerCloudConfigured() ? "cloud" : "local",
        error: authCheck.error,
      }
    }

    if (!isTriggerCloudConfigured()) {
      return {
        success: true,
        mode: "local",
      }
    }

    const publicAccessToken = await triggerAuth.createPublicToken({
      scopes: {
        read: {
          tags: authCheck.validTags,
        },
      },
      expirationTime: "15m",
    })

    return {
      success: true,
      mode: "cloud",
      publicAccessToken,
      token: publicAccessToken,
    }
  } catch (err: unknown) {
    return {
      success: false,
      mode: "local",
      error:
        err instanceof Error
          ? err.message
          : "Failed to mint tag-scoped Trigger Realtime token",
    }
  }
}

export interface ActiveRunSummary {
  runId: string
  taskIdentifier: string
  status: "QUEUED" | "EXECUTING" | "REATTEMPTING" | "FROZEN"
  createdAt: string
  tags: string[]
  metadata?: Record<string, unknown>
}

export type ActiveTaggedRunSummary = ActiveRunSummary

export interface ListActiveRunsResult {
  success: boolean
  mode: "cloud" | "local"
  activeRuns: ActiveRunSummary[]
  publicAccessToken?: string
  error?: string
}

export type ListActiveRunsByTagsResult = ListActiveRunsResult

type TriggerRunsListParams = NonNullable<Parameters<typeof runs.list>[0]>
type TriggerRunsListStatus = TriggerRunsListParams["status"]

const ACTIVE_TRIGGER_RUN_STATUSES: TriggerRunsListStatus = [
  "PENDING_VERSION",
  "QUEUED",
  "DEQUEUED",
  "EXECUTING",
  "WAITING",
  "DELAYED",
]

function mapCloudRunStatus(
  rawStatus: string
): ActiveRunSummary["status"] {
  if (rawStatus === "EXECUTING" || rawStatus === "DEQUEUED") {
    return "EXECUTING"
  }
  if (rawStatus === "WAITING" || rawStatus === "DELAYED") {
    return "FROZEN"
  }
  return "QUEUED"
}

/**
 * Queries active Trigger.dev runs by validated, entity-authorized tags and mints a `15m`
 * scoped public access token so browser tabs rehydrate in-flight tasks safely (`T-090`).
 */
export async function listActiveRunsByTagsAction(
  rawInput: { tags: string[]; limit?: number } | string[]
): Promise<ListActiveRunsResult> {
  try {
    const session = await requireAdmin()
    const parsed = listActiveRunsInputSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        mode: "local",
        activeRuns: [],
        error:
          parsed.error.issues[0]?.message ||
          "Invalid tags filter payload",
      }
    }

    const rawTags = Array.isArray(parsed.data) ? parsed.data : parsed.data.tags
    const limit = Array.isArray(parsed.data)
      ? 10
      : (parsed.data.limit ?? 10)

    const authCheck = await verifyRealtimeTagsBatchAuthorization(
      rawTags,
      session
    )
    if (!authCheck.ok) {
      return {
        success: false,
        mode: isTriggerCloudConfigured() ? "cloud" : "local",
        activeRuns: [],
        error: authCheck.error,
      }
    }

    const validTags = authCheck.validTags

    if (isTriggerCloudConfigured()) {
      try {
        const page = await runs.list({
          tag: validTags,
          status: ACTIVE_TRIGGER_RUN_STATUSES,
          limit,
        })

        const runItems = (page.data || []).filter((r) =>
          ALLOWED_OBSERVABLE_TASK_IDS.has(r.taskIdentifier)
        )
        const activeRuns: ActiveRunSummary[] = runItems.map((r) => ({
          runId: r.id,
          taskIdentifier: r.taskIdentifier,
          status: mapCloudRunStatus(r.status),
          createdAt:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : String(r.createdAt),
          tags: r.tags || [],
          metadata: (r.metadata ?? {}) as Record<string, unknown>,
        }))

        if (activeRuns.length > 0) {
          const publicAccessToken = await triggerAuth.createPublicToken({
            scopes: {
              read: {
                runs: activeRuns.map((r) => r.runId),
              },
            },
            expirationTime: "15m",
          })

          return {
            success: true,
            mode: "cloud",
            activeRuns,
            publicAccessToken,
          }
        }

        return { success: true, mode: "cloud", activeRuns: [] }
      } catch (cloudErr) {
        console.warn(
          "[Trigger Active Runs Warning] Failed to query cloud runs:",
          cloudErr
        )
      }
    }

    const localSnapshots = getLocalActiveRunsByTags(validTags).slice(0, limit)
    return {
      success: true,
      mode: "local",
      activeRuns: localSnapshots,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err.message : "Failed to list active runs by tags"
    return {
      success: false,
      mode: "local",
      activeRuns: [],
      error,
    }
  }
}
