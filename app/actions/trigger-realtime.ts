"use server"

import { auth as triggerAuth, runs } from "@trigger.dev/sdk"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth-guard"
import { isTriggerCloudConfigured } from "@/trigger/dispatch"
import {
  getLocalRunProgressSnapshot,
  getLocalActiveRunsByTags,
  type TaskProgressMetadata,
  type TaskRunStage,
} from "@/trigger/metadata"

const runIdInputSchema = z.union([
  z.string().min(1, "runId is required"),
  z.object({
    runId: z.string().min(1, "runId is required"),
  }),
])

const batchRunIdsInputSchema = z.union([
  z.array(z.string().min(1)).min(1),
  z.object({
    runIds: z.array(z.string().min(1)).min(1),
  }),
])

function extractRunId(rawInput: unknown): string {
  const parsed = runIdInputSchema.parse(rawInput)
  return typeof parsed === "string" ? parsed.trim() : parsed.runId.trim()
}

function buildDefaultLocalSnapshot(): TaskProgressMetadata {
  return {
    stage: "completed",
    progress: 100,
    label: "Completed locally",
    detail: "Completed locally",
    updatedAt: new Date().toISOString(),
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

export interface TaskRunProgressResult {
  success: boolean
  mode: "cloud" | "local"
  runId: string
  status?: string
  snapshot: TaskProgressMetadata | null
  error?: string
}

/**
 * Mints a scoped read-only Trigger.dev Public Access Token (`scopes: { read: { runs: [runId] } }`)
 * for browser `useRealtimeRun` subscriptions after verifying a Better Auth staff/super_admin session.
 *
 * When `TRIGGER_SECRET_KEY` is absent or `runId` is a local/inline synthetic ID, returns
 * `{ success: true, mode: "local", runId, snapshot }` for zero-config local dev fallback.
 */
export async function mintRealtimeRunPublicTokenAction(
  rawInput: string | { runId: string }
): Promise<MintRealtimeRunTokenResult> {
  try {
    await requireAdmin()
    const runId = extractRunId(rawInput)

    const isLocalSynthetic =
      runId.startsWith("inline_") || runId.startsWith("local_")

    if (isTriggerCloudConfigured() && !isLocalSynthetic) {
      try {
        const publicAccessToken = await triggerAuth.createPublicToken({
          scopes: {
            read: {
              runs: [runId],
            },
          },
          expirationTime: "1h",
        })

        return {
          success: true,
          mode: "cloud",
          runId,
          token: publicAccessToken,
          publicAccessToken,
        }
      } catch (tokenErr) {
        console.warn(
          `[Trigger Realtime Token Warning] Could not mint cloud public token for ${runId}; falling back to local snapshot:`,
          tokenErr
        )
      }
    }

    const snapshot =
      getLocalRunProgressSnapshot(runId) ?? buildDefaultLocalSnapshot()

    return {
      success: true,
      mode: "local",
      runId,
      snapshot,
      fallbackStatus:
        snapshot.stage === "failed"
          ? "FAILED"
          : snapshot.progress >= 100
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
 * Retrieves the current task run progress snapshot (from Trigger.dev Cloud when configured,
 * or from the in-memory local dev fallback snapshot store when running locally).
 */
export async function getTaskRunProgressAction(
  rawInput: string | { runId: string }
): Promise<TaskRunProgressResult> {
  try {
    await requireAdmin()
    const runId = extractRunId(rawInput)

    const isLocalSynthetic =
      runId.startsWith("inline_") || runId.startsWith("local_")

    if (isTriggerCloudConfigured() && !isLocalSynthetic) {
      try {
        const run = await runs.retrieve(runId)
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

        const detail =
          typeof meta.detail === "string" ? meta.detail : label

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

        return {
          success: true,
          mode: "cloud",
          runId,
          status: run.status,
          snapshot,
        }
      } catch (cloudErr) {
        console.warn(
          `[Trigger Run Progress Warning] Could not retrieve cloud run ${runId}; checking local snapshot:`,
          cloudErr
        )
      }
    }

    const snapshot =
      getLocalRunProgressSnapshot(runId) ?? buildDefaultLocalSnapshot()

    return {
      success: true,
      mode: "local",
      runId,
      status:
        snapshot.stage === "failed"
          ? "FAILED"
          : snapshot.progress >= 100
          ? "COMPLETED"
          : "EXECUTING",
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
      error,
    }
  }
}

/**
 * Alias matching Spec 0012 Section 6 signature.
 */
export async function createRealtimeRunTokenAction(
  rawInput: unknown
): Promise<MintRealtimeRunTokenResult> {
  return mintRealtimeRunPublicTokenAction(
    rawInput as string | { runId: string }
  )
}

/**
 * Mints a scoped read-only token covering multiple run IDs in a single call.
 */
export async function createBatchRealtimeRunTokensAction(
  rawInput: unknown
): Promise<{
  success: boolean
  mode: "cloud" | "local" | "inline"
  publicAccessToken?: string
  token?: string
  runIds: string[]
  error?: string
}> {
  try {
    await requireAdmin()
    const parsed = batchRunIdsInputSchema.parse(rawInput)
    const runIds = Array.isArray(parsed) ? parsed : parsed.runIds

    const cloudRunIds = runIds.filter(
      (id) => !id.startsWith("inline_") && !id.startsWith("local_")
    )

    if (isTriggerCloudConfigured() && cloudRunIds.length > 0) {
      const publicAccessToken = await triggerAuth.createPublicToken({
        scopes: {
          read: {
            runs: cloudRunIds,
          },
        },
        expirationTime: "1h",
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

export interface ActiveRunSummary {
  runId: string
  taskIdentifier: string
  status: "QUEUED" | "EXECUTING" | "REATTEMPTING" | "FROZEN"
  createdAt: string
  tags: string[]
  metadata?: Record<string, unknown>
}

export interface ListActiveRunsResult {
  success: boolean
  mode: "cloud" | "local"
  activeRuns: ActiveRunSummary[]
  publicAccessToken?: string
  error?: string
}

const listActiveRunsInputSchema = z.union([
  z.array(z.string().min(1)),
  z.object({
    tags: z.array(z.string().min(1)),
    limit: z.number().int().positive().max(100).optional(),
  }),
])

/**
 * Queries active Trigger.dev runs by tags and mints a scoped public access token
 * so browser tabs can rehydrate in-flight tasks upon page reload.
 */
export async function listActiveRunsByTagsAction(
  rawInput: { tags: string[]; limit?: number } | string[]
): Promise<ListActiveRunsResult> {
  try {
    await requireAdmin()
    const parsed = listActiveRunsInputSchema.parse(rawInput)
    const tags = Array.isArray(parsed) ? parsed : parsed.tags
    const limit = Array.isArray(parsed) ? 10 : parsed.limit ?? 10

    if (isTriggerCloudConfigured()) {
      try {
        const activeStatuses = [
          "EXECUTING",
          "QUEUED",
          "WAITING_FOR_DEPLOY",
          "REATTEMPTING",
          "FROZEN",
        ] as const

        const page = await runs.list({
          tag: tags,
          status: activeStatuses as unknown as any,
          limit,
        })

        const runItems = page.data || []
        const activeRuns: ActiveRunSummary[] = runItems.map((r) => ({
          runId: r.id,
          taskIdentifier: r.taskIdentifier,
          status: r.status as ActiveRunSummary["status"],
          createdAt: r.createdAt.toISOString(),
          tags: r.tags || [],
          metadata: r.metadata as Record<string, unknown>,
        }))

        if (activeRuns.length > 0) {
          const publicAccessToken = await triggerAuth.createPublicToken({
            scopes: {
              read: {
                runs: activeRuns.map((r) => r.runId),
              },
            },
            expirationTime: "1h",
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

    // Local dev snapshot store fallback
    const localSnapshots = getLocalActiveRunsByTags(tags)
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
