import { createHash } from "node:crypto"
import {
  auth,
  idempotencyKeys,
  runs as defaultRuns,
  tasks as defaultTasks,
  type AnyTask,
  type Task,
  type TriggerOptions,
} from "@trigger.dev/sdk"
import { isAuditLocalE2eMode } from "@/lib/env"
import {
  processInboundWhatsappPayloadSchema,
  type ProcessInboundWhatsappPayload,
  type ProcessInboundWhatsappResult,
} from "@/lib/trigger/inbound-whatsapp-schema"
import {
  recordLocalRunTags,
  setLocalRunProgressSnapshot,
  withLocalRunProgressScope,
  type TaskProgressScope,
} from "./metadata"

export type ExecutionMode = "cloud" | "inline"

type TasksSdkSlice = {
  trigger: typeof defaultTasks.trigger
  batchTrigger?: typeof defaultTasks.batchTrigger
}

let sdkTasks: TasksSdkSlice = defaultTasks
let sdkRuns: Pick<typeof defaultRuns, "poll" | "retrieve" | "cancel"> =
  defaultRuns

export function setTriggerSdkForTests(
  overrides: {
    tasks?: TasksSdkSlice
    runs?: Pick<typeof defaultRuns, "poll" | "retrieve" | "cancel">
  } | null
): void {
  sdkTasks = overrides?.tasks ?? defaultTasks
  sdkRuns = overrides?.runs ?? defaultRuns
}

export interface TriggerDispatchTransport {
  trigger: (
    taskId: string,
    payload: unknown,
    options?: Record<string, unknown>
  ) => Promise<{ id: string }>
  triggerAndWait: (
    taskId: string,
    payload: unknown,
    options?: Record<string, unknown>
  ) => Promise<
    | { ok: true; id: string; output: unknown }
    | { ok: false; id: string; error: unknown }
  >
  batchTrigger: (
    taskId: string,
    items: Array<{ payload: unknown; options?: Record<string, unknown> }>
  ) => Promise<{ batchId?: string; runs: Array<{ id: string }> }>
  createPublicToken?: (runId: string) => Promise<string | undefined>
}

let testTransportOverride: TriggerDispatchTransport | null = null

export function setTriggerDispatchTransportForTests(
  transport: TriggerDispatchTransport | null
): void {
  testTransportOverride = transport
}

/**
 * Thrown when `NODE_ENV === "production"` attempts to execute a heavy 60–300s durable task
 * inline inside a Next.js serverless lambda because Trigger.dev Cloud is missing or
 * unreachable (`T-037`).
 */
export class TriggerDispatchConfigurationError extends Error {
  readonly code = "TRIGGER_CLOUD_REQUIRED_IN_PRODUCTION" as const

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "TriggerDispatchConfigurationError"
  }
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" && !isAuditLocalE2eMode()
}

function getTriggerSecretKey(): string | undefined {
  const key = process.env.TRIGGER_SECRET_KEY?.trim()
  if (!key) return undefined
  if (
    key === "tr_dev_placeholder" ||
    key === "tr_prod_placeholder" ||
    key.startsWith("tr_dev_replace") ||
    key.startsWith("tr_prod_replace")
  ) {
    return undefined
  }
  return key
}

/**
 * Returns true if the environment has valid Trigger.dev Cloud credentials configured.
 * In `NODE_ENV === "production"`, strictly requires a `tr_prod_*` key (`T-037`).
 */
export function isTriggerCloudConfigured(): boolean {
  const key = getTriggerSecretKey()
  if (!key) return false
  if (isProductionRuntime()) {
    return key.startsWith("tr_prod_")
  }
  return key.startsWith("tr_dev_") || key.startsWith("tr_prod_")
}

/**
 * Returns true if the secret key targets Trigger.dev's always-on deployed `prod` workers.
 */
export function isTriggerProdKeyConfigured(): boolean {
  const key = getTriggerSecretKey()
  return Boolean(key && key.startsWith("tr_prod_"))
}

function assertInlineAllowedOrThrow(taskId: string, reason: string): void {
  if (isProductionRuntime()) {
    throw new TriggerDispatchConfigurationError(
      `[Trigger Fail-Closed] Refusing to execute heavy task "${taskId}" inline in production (${reason}). Configure a valid tr_prod_* TRIGGER_SECRET_KEY and ensure Trigger.dev Cloud is reachable.`
    )
  }
}

export interface DispatchOptions extends TriggerOptions {
  tags?: string[]
  /** Optional schedule timestamp mixed into global idempotency key so rescheduling is never poisoned for 30 days (`T-072`) */
  scheduledFor?: Date | string | number
  /** Optional content/template hash mixed into global idempotency key so edited renders run fresh (`T-072`) */
  contentHash?: string
  /** Optional retry attempt counter mixed into global idempotency key so retries run fresh (`T-072`) */
  retryAttempt?: number
}

export interface DispatchResult<TOutput> {
  mode: ExecutionMode
  runId?: string
  publicAccessToken?: string
  output?: TOutput
  success: boolean
  error?: string
}

export interface BatchDispatchItem<TPayload> {
  payload: TPayload
  options?: DispatchOptions
  isFutureScheduled?: boolean
}

export interface BatchDispatchResult<TOutput = unknown> {
  mode: ExecutionMode
  success: boolean
  batchId?: string
  runIds: string[]
  runs: Array<{
    id: string
    scheduledPostId?: string
    mode: ExecutionMode
    output?: TOutput
    error?: string
  }>
  outputs?: TOutput[]
  error?: string
}

function buildSyntheticInlineRunId(taskId: string, suffix?: string): string {
  const cleanTask = taskId.replace(/[^a-zA-Z0-9_-]/g, "_")
  const rand = Math.random().toString(36).slice(2, 8)
  return suffix
    ? `inline_${cleanTask}_${suffix}_${rand}`
    : `inline_${cleanTask}_${Date.now()}_${rand}`
}

function inferScopeFromTaskAndTags(
  taskId: string,
  tags?: string[]
): Omit<TaskProgressScope, "runId"> {
  const firstTag = tags?.[0]?.trim()
  if (!firstTag) {
    return { taskType: taskId }
  }
  const colonIdx = firstTag.lastIndexOf(":")
  if (colonIdx > 0 && colonIdx < firstTag.length - 1) {
    return {
      taskType: taskId,
      entityId: firstTag.slice(colonIdx + 1),
    }
  }
  return { taskType: taskId }
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null"
  if (typeof value !== "object") return JSON.stringify(value)
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${stableSerialize(obj[k])}`
  )
  return `{${pairs.join(",")}}`
}

/**
 * Computes a compact 16-hex-character SHA-256 content hash over any JSON-serializable value
 * so callers can include edited poster/template state in `DispatchOptions.contentHash` (`T-072`).
 */
export function computePayloadContentHash(value: unknown): string {
  return createHash("sha256")
    .update(stableSerialize(value))
    .digest("hex")
    .slice(0, 16)
}

function normalizeScheduledForSegment(
  scheduledFor: Date | string | number
): string {
  if (scheduledFor instanceof Date) {
    return Number.isNaN(scheduledFor.getTime())
      ? "invalid-date"
      : scheduledFor.toISOString()
  }
  if (typeof scheduledFor === "number") {
    const parsed = new Date(scheduledFor)
    return Number.isNaN(parsed.getTime())
      ? String(scheduledFor)
      : parsed.toISOString()
  }
  const trimmed = scheduledFor.trim()
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString()
}

/**
 * Composes the deterministic seed passed to `idempotencyKeys.create(seed, { scope: "global" })` (`T-072`):
 * Incorporates optional `scheduledFor`, `contentHash`, and `retryAttempt` discriminators so
 * rescheduling a post, re-rendering an edited poster, or retrying a broadcast never collides with
 * Trigger.dev's 30-day idempotency cache (`A18-006`).
 */
export function composeDispatchIdempotencySeed(
  options?: Pick<
    DispatchOptions,
    "idempotencyKey" | "scheduledFor" | "contentHash" | "retryAttempt"
  >
): string | undefined {
  const baseKey =
    typeof options?.idempotencyKey === "string"
      ? options.idempotencyKey.trim()
      : undefined
  if (!baseKey) return undefined

  const segments: string[] = [baseKey]

  if (options?.scheduledFor !== undefined) {
    segments.push(`sched:${normalizeScheduledForSegment(options.scheduledFor)}`)
  }
  if (options?.contentHash && options.contentHash.trim().length > 0) {
    segments.push(`hash:${options.contentHash.trim()}`)
  }
  if (
    options?.retryAttempt !== undefined &&
    Number.isFinite(options.retryAttempt)
  ) {
    segments.push(`attempt:${Math.max(0, Math.trunc(options.retryAttempt))}`)
  }

  return segments.join("|")
}

/**
 * Safely cancels a Trigger.dev run if a runId is recorded (e.g., cancelling a sleeping `wait.until` post).
 */
export async function cancelTriggerRunIfActive(
  runId: string | null | undefined
): Promise<void> {
  if (
    !runId ||
    runId.startsWith("inline_") ||
    runId.startsWith("local_") ||
    !isTriggerCloudConfigured()
  ) {
    return
  }
  try {
    await sdkRuns.cancel(runId)
  } catch (err) {
    console.warn(`[Trigger Cancel Warning] Could not cancel run ${runId}:`, err)
  }
}

/**
 * Promotes raw string idempotency keys (plus optional `scheduledFor`, `contentHash`, `retryAttempt`
 * discriminators) to global project scope in Trigger.dev v4 (`T-072`).
 */
export async function normalizeDispatchOptions(
  options?: DispatchOptions
): Promise<TriggerOptions | undefined> {
  if (!options) return undefined

  const {
    scheduledFor,
    contentHash,
    retryAttempt,
    idempotencyKey,
    ...restTriggerOptions
  } = options

  if (!idempotencyKey) {
    return restTriggerOptions
  }

  if (typeof idempotencyKey !== "string") {
    return {
      ...restTriggerOptions,
      idempotencyKey,
    }
  }

  const composedSeed =
    composeDispatchIdempotencySeed({
      idempotencyKey,
      scheduledFor,
      contentHash,
      retryAttempt,
    }) ?? idempotencyKey

  try {
    const globalKey = await idempotencyKeys.create(composedSeed, {
      scope: "global",
    })
    return {
      ...restTriggerOptions,
      idempotencyKey: globalKey,
    }
  } catch {
    return {
      ...restTriggerOptions,
      idempotencyKey: composedSeed,
    }
  }
}

export async function mintSingleRunRealtimeToken(
  runId: string
): Promise<string | undefined> {
  if (testTransportOverride?.createPublicToken) {
    return testTransportOverride.createPublicToken(runId)
  }
  if (!isTriggerCloudConfigured()) return undefined
  try {
    return await auth.createPublicToken({
      scopes: {
        read: {
          runs: [runId],
        },
      },
      expirationTime: "15m",
    })
  } catch {
    return undefined
  }
}

function formatCloudRunFailure(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === "string" && msg.length > 0) return msg
  }
  if (typeof error === "string" && error.length > 0) return error
  return fallback
}

/**
 * Triggers a Trigger.dev task by string ID for fire-and-forget / scheduled background jobs (`T-037`).
 *
 * Fail-closed production invariants:
 * - In `NODE_ENV === "production"`, missing/invalid `TRIGGER_SECRET_KEY` or unreachable Trigger Cloud
 *   throws `TriggerDispatchConfigurationError` — NEVER executing heavy work inline inside Next.js lambdas.
 * - In explicit non-production dev/test mode, cleanly falls back to `inlineRunner` when unconfigured
 *   or when a `tr_dev_` run has no local `trigger:dev` worker attached.
 */
export async function triggerByIdBackgroundOrInline<
  TPayload,
  TOutput,
>(params: {
  taskId: string
  payload: TPayload
  isFutureScheduled?: boolean
  inlineRunner: (payload: TPayload) => Promise<TOutput>
  options?: DispatchOptions
}): Promise<DispatchResult<TOutput>> {
  const {
    taskId,
    payload,
    isFutureScheduled = false,
    inlineRunner,
    options,
  } = params

  const resolvedOptions = await normalizeDispatchOptions(options)

  if (isTriggerCloudConfigured()) {
    try {
      if (testTransportOverride) {
        const handle = await testTransportOverride.trigger(
          taskId,
          payload,
          resolvedOptions as Record<string, unknown> | undefined
        )
        const publicAccessToken = await mintSingleRunRealtimeToken(handle.id)
        return {
          mode: "cloud",
          runId: handle.id,
          publicAccessToken,
          success: true,
        }
      }

      const handle = await sdkTasks.trigger(taskId, payload, resolvedOptions)

      if (isFutureScheduled || isTriggerProdKeyConfigured()) {
        const publicAccessToken = await mintSingleRunRealtimeToken(handle.id)
        return {
          mode: "cloud",
          runId: handle.id,
          publicAccessToken,
          success: true,
        }
      }

      // In local tr_dev_ mode, verify a local `trigger:dev` worker picked up the immediate job
      await new Promise((resolve) => setTimeout(resolve, 2200))
      const snapshot = await sdkRuns.retrieve(handle.id)

      if (snapshot.status !== "QUEUED") {
        const publicAccessToken = await mintSingleRunRealtimeToken(handle.id)
        return {
          mode: "cloud",
          runId: handle.id,
          publicAccessToken,
          success: true,
        }
      }

      console.warn(
        `[Trigger Dev Fallback] Task '${taskId}' (${handle.id}) remained QUEUED with tr_dev_ key (no local trigger:dev worker attached). Cancelling dev run and executing inline.`
      )
      await cancelTriggerRunIfActive(handle.id)
    } catch (cloudErr: unknown) {
      if (isProductionRuntime()) {
        throw new TriggerDispatchConfigurationError(
          `[Trigger Fail-Closed] Failed to dispatch background task "${taskId}" to Trigger.dev Cloud in production: ${
            cloudErr instanceof Error ? cloudErr.message : String(cloudErr)
          }`,
          { cause: cloudErr }
        )
      }
      console.warn(
        `[Trigger Cloud Dispatch Warning] Failed to trigger background task '${taskId}' on Cloud in non-production. Falling back to inline execution:`,
        cloudErr
      )
    }
  } else {
    assertInlineAllowedOrThrow(
      taskId,
      "TRIGGER_SECRET_KEY (tr_prod_*) is missing or invalid"
    )
  }

  const syntheticRunId = buildSyntheticInlineRunId(taskId)
  const scope = inferScopeFromTaskAndTags(taskId, options?.tags)
  if (options?.tags && options.tags.length > 0) {
    recordLocalRunTags(syntheticRunId, options.tags)
  }

  if (isFutureScheduled) {
    setLocalRunProgressSnapshot(
      syntheticRunId,
      {
        stage: "waiting_until_scheduled",
        progress: 20,
        label: "Scheduled locally",
        detail: "Persisted in database for scheduled execution",
        updatedAt: new Date().toISOString(),
      },
      scope
    )
    return {
      mode: "inline",
      runId: syntheticRunId,
      success: true,
    }
  }

  setLocalRunProgressSnapshot(
    syntheticRunId,
    {
      stage: "initializing",
      progress: 10,
      label: `Running ${taskId}`,
      detail: `Executing ${taskId} in local dev mode`,
      updatedAt: new Date().toISOString(),
    },
    scope
  )

  try {
    const output = await withLocalRunProgressScope(
      syntheticRunId,
      () => inlineRunner(payload),
      scope
    )
    setLocalRunProgressSnapshot(
      syntheticRunId,
      {
        stage: "completed",
        progress: 100,
        label: "Completed locally",
        detail: `Completed ${taskId}`,
        updatedAt: new Date().toISOString(),
      },
      scope
    )
    return {
      mode: "inline",
      runId: syntheticRunId,
      output,
      success: true,
    }
  } catch (inlineErr: unknown) {
    const errorMsg =
      inlineErr instanceof Error
        ? inlineErr.message
        : "Failed to execute background task inline"
    setLocalRunProgressSnapshot(
      syntheticRunId,
      {
        stage: "failed",
        progress: 100,
        label: "Failed locally",
        detail: errorMsg,
        error: errorMsg,
        updatedAt: new Date().toISOString(),
      },
      scope
    )
    console.error(`[Inline Background Execution Error] ${taskId}:`, inlineErr)
    return {
      mode: "inline",
      runId: syntheticRunId,
      success: false,
      error: errorMsg,
    }
  }
}

/**
 * Triggers a heavy compute task by string ID on Trigger.dev Cloud and awaits its typed output (`T-037`).
 *
 * Fail-closed production invariants:
 * - In `NODE_ENV === "production"`, missing `tr_prod_*` `TRIGGER_SECRET_KEY` or unreachable Trigger Cloud
 *   throws `TriggerDispatchConfigurationError`.
 * - If Trigger Cloud executes the run and it fails (`!finished.isSuccess`), returns `{ mode: "cloud", success: false, error }`
 *   instead of double-running `inlineRunner` inside the Next.js lambda!
 */
export async function triggerByIdAndAwaitOrInline<
  TPayload,
  TOutput,
>(params: {
  taskId: string
  payload: TPayload
  inlineRunner: (payload: TPayload) => Promise<TOutput>
  options?: DispatchOptions
  pollIntervalMs?: number
}): Promise<DispatchResult<TOutput>> {
  const {
    taskId,
    payload,
    inlineRunner,
    options,
    pollIntervalMs = 800,
  } = params

  const resolvedOptions = await normalizeDispatchOptions(options)

  if (isTriggerCloudConfigured()) {
    try {
      if (testTransportOverride) {
        const finished = await testTransportOverride.triggerAndWait(
          taskId,
          payload,
          resolvedOptions as Record<string, unknown> | undefined
        )
        const publicAccessToken = await mintSingleRunRealtimeToken(finished.id)
        if (finished.ok) {
          return {
            mode: "cloud",
            runId: finished.id,
            publicAccessToken,
            output: finished.output as TOutput,
            success: true,
          }
        }
        return {
          mode: "cloud",
          runId: finished.id,
          publicAccessToken,
          success: false,
          error: formatCloudRunFailure(
            finished.error,
            `Trigger.dev run ${finished.id} failed`
          ),
        }
      }

      const handle = await sdkTasks.trigger(taskId, payload, resolvedOptions)

      let shouldPollCloud = isTriggerProdKeyConfigured()

      if (!shouldPollCloud) {
        await new Promise((resolve) => setTimeout(resolve, 2200))
        const snapshot = await sdkRuns.retrieve(handle.id)
        if (snapshot.status !== "QUEUED") {
          shouldPollCloud = true
        } else {
          console.warn(
            `[Trigger Dev Fallback] Task '${taskId}' (${handle.id}) remained QUEUED with tr_dev_ key (no local trigger:dev worker attached). Cancelling dev run and executing inline.`
          )
          await cancelTriggerRunIfActive(handle.id)
        }
      }

      if (shouldPollCloud) {
        const publicAccessToken = await mintSingleRunRealtimeToken(handle.id)
        const finished = await sdkRuns.poll(handle, { pollIntervalMs })
        if (finished.isSuccess) {
          return {
            mode: "cloud",
            runId: finished.id,
            publicAccessToken,
            output: finished.output as TOutput,
            success: true,
          }
        }

        const cloudErrMsg = formatCloudRunFailure(
          finished.error,
          `Trigger.dev run ${finished.id} ended with status ${finished.status}`
        )
        return {
          mode: "cloud",
          runId: finished.id,
          publicAccessToken,
          success: false,
          error: cloudErrMsg,
        }
      }
    } catch (cloudErr: unknown) {
      if (isProductionRuntime()) {
        throw new TriggerDispatchConfigurationError(
          `[Trigger Fail-Closed] Failed to dispatch/poll "${taskId}" on Trigger.dev Cloud in production: ${
            cloudErr instanceof Error ? cloudErr.message : String(cloudErr)
          }`,
          { cause: cloudErr }
        )
      }
      console.warn(
        `[Trigger Cloud Await Warning] Failed to execute '${taskId}' on Cloud in non-production. Falling back to inline execution:`,
        cloudErr
      )
    }
  } else {
    assertInlineAllowedOrThrow(
      taskId,
      "TRIGGER_SECRET_KEY (tr_prod_*) is missing or invalid"
    )
  }

  const syntheticRunId = buildSyntheticInlineRunId(taskId)
  const scope = inferScopeFromTaskAndTags(taskId, options?.tags)
  if (options?.tags && options.tags.length > 0) {
    recordLocalRunTags(syntheticRunId, options.tags)
  }

  setLocalRunProgressSnapshot(
    syntheticRunId,
    {
      stage: "initializing",
      progress: 10,
      label: `Running ${taskId}`,
      detail: `Executing ${taskId} in local dev mode`,
      updatedAt: new Date().toISOString(),
    },
    scope
  )

  try {
    const output = await withLocalRunProgressScope(
      syntheticRunId,
      () => inlineRunner(payload),
      scope
    )
    setLocalRunProgressSnapshot(
      syntheticRunId,
      {
        stage: "completed",
        progress: 100,
        label: "Completed locally",
        detail: `Completed ${taskId}`,
        updatedAt: new Date().toISOString(),
      },
      scope
    )
    return {
      mode: "inline",
      runId: syntheticRunId,
      output,
      success: true,
    }
  } catch (inlineErr: unknown) {
    const errorMsg =
      inlineErr instanceof Error
        ? inlineErr.message
        : "Failed to execute task inline"
    setLocalRunProgressSnapshot(
      syntheticRunId,
      {
        stage: "failed",
        progress: 100,
        label: "Failed locally",
        detail: errorMsg,
        error: errorMsg,
        updatedAt: new Date().toISOString(),
      },
      scope
    )
    console.error(`[Inline Task Execution Error] ${taskId}:`, inlineErr)
    return {
      mode: "inline",
      runId: syntheticRunId,
      success: false,
      error: errorMsg,
    }
  }
}

export async function triggerAndAwaitOrInline<TPayload, TOutput>(params: {
  taskHandle: Task<string, TPayload, TOutput> | AnyTask
  payload: TPayload
  inlineRunner: (payload: TPayload) => Promise<TOutput>
  options?: DispatchOptions
  pollIntervalMs?: number
}): Promise<DispatchResult<TOutput>> {
  return triggerByIdAndAwaitOrInline({
    taskId: params.taskHandle.id,
    payload: params.payload,
    inlineRunner: params.inlineRunner,
    options: params.options,
    pollIntervalMs: params.pollIntervalMs,
  })
}

export async function triggerBackgroundOrInline<TPayload, TOutput>(params: {
  taskHandle: Task<string, TPayload, TOutput> | AnyTask
  payload: TPayload
  inlineRunner: (payload: TPayload) => Promise<TOutput>
  options?: DispatchOptions
  isFutureScheduled?: boolean
}): Promise<DispatchResult<TOutput>> {
  return triggerByIdBackgroundOrInline({
    taskId: params.taskHandle.id,
    payload: params.payload,
    inlineRunner: params.inlineRunner,
    options: params.options,
    isFutureScheduled: params.isFutureScheduled,
  })
}

/**
 * Parallel batch fan-out helper by task string ID with fail-closed production enforcement (`T-037`)
 * and global idempotency normalization (`T-072`).
 */
export async function batchTriggerByIdOrInline<TPayload, TOutput>(params: {
  taskId: string
  items: Array<BatchDispatchItem<TPayload>>
  inlineRunner: (payload: TPayload) => Promise<TOutput>
}): Promise<BatchDispatchResult<TOutput>> {
  const { taskId, items, inlineRunner } = params

  if (items.length === 0) {
    return {
      mode: isTriggerCloudConfigured() ? "cloud" : "inline",
      success: true,
      runIds: [],
      runs: [],
      outputs: [],
    }
  }

  if (isTriggerCloudConfigured()) {
    try {
      const normalizedItems = await Promise.all(
        items.map(async (item) => ({
          payload: item.payload,
          options: await normalizeDispatchOptions(item.options),
        }))
      )

      if (testTransportOverride) {
        const batchHandle = await testTransportOverride.batchTrigger(
          taskId,
          normalizedItems as Array<{
            payload: unknown
            options?: Record<string, unknown>
          }>
        )
        const runs = (batchHandle.runs ?? []).map((r) => ({
          id: r.id,
          mode: "cloud" as const,
        }))
        return {
          mode: "cloud",
          success: true,
          batchId: batchHandle.batchId,
          runIds: runs.map((r) => r.id),
          runs,
        }
      }

      const batchTriggerFn = sdkTasks.batchTrigger ?? defaultTasks.batchTrigger
      if (typeof batchTriggerFn === "function") {
        const batchHandle = (await batchTriggerFn(
          taskId,
          normalizedItems
        )) as { batchId?: string; runs?: Array<{ id: string }> }
        const runs = (batchHandle.runs ?? []).map((r) => ({
          id: r.id,
          mode: "cloud" as const,
        }))
        return {
          mode: "cloud",
          success: true,
          batchId: batchHandle.batchId,
          runIds: runs.map((r) => r.id),
          runs,
        }
      }

      const handles = await Promise.all(
        normalizedItems.map((item) =>
          sdkTasks.trigger(taskId, item.payload, item.options)
        )
      )
      const runs = handles.map((h) => ({
        id: h.id,
        mode: "cloud" as const,
      }))
      return {
        mode: "cloud",
        success: true,
        runIds: runs.map((r) => r.id),
        runs,
      }
    } catch (cloudErr: unknown) {
      if (isProductionRuntime()) {
        throw new TriggerDispatchConfigurationError(
          `[Trigger Fail-Closed] Failed to batchTrigger "${taskId}" on Trigger.dev Cloud in production: ${
            cloudErr instanceof Error ? cloudErr.message : String(cloudErr)
          }`,
          { cause: cloudErr }
        )
      }
      console.warn(
        `[Trigger Batch Dispatch Warning] Failed to batchTrigger '${taskId}' on Cloud in non-production. Falling back to Promise.all inline execution:`,
        cloudErr
      )
    }
  } else {
    assertInlineAllowedOrThrow(
      taskId,
      "TRIGGER_SECRET_KEY (tr_prod_*) is missing or invalid"
    )
  }

  const settled = await Promise.all(
    items.map(async (item, idx) => {
      const syntheticRunId = buildSyntheticInlineRunId(taskId, String(idx + 1))
      const scope = inferScopeFromTaskAndTags(taskId, item.options?.tags)
      if (item.options?.tags && item.options.tags.length > 0) {
        recordLocalRunTags(syntheticRunId, item.options.tags)
      }

      if (item.isFutureScheduled) {
        setLocalRunProgressSnapshot(
          syntheticRunId,
          {
            stage: "waiting_until_scheduled",
            progress: 20,
            label: "Scheduled locally",
            detail: "Persisted in database for scheduled execution",
            updatedAt: new Date().toISOString(),
          },
          scope
        )
        return {
          id: syntheticRunId,
          mode: "inline" as const,
          ok: true,
          output: undefined as TOutput | undefined,
        }
      }

      try {
        const output = await withLocalRunProgressScope(
          syntheticRunId,
          () => inlineRunner(item.payload),
          scope
        )
        return {
          id: syntheticRunId,
          mode: "inline" as const,
          ok: true,
          output,
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        return {
          id: syntheticRunId,
          mode: "inline" as const,
          ok: false,
          error: errorMsg,
        }
      }
    })
  )

  return {
    mode: "inline",
    success: settled.every((r) => r.ok),
    runIds: settled.map((r) => r.id),
    runs: settled.map((r) => ({
      id: r.id,
      mode: r.mode,
      output: r.output,
      error: r.error,
    })),
    outputs: settled
      .filter((r): r is typeof r & { output: TOutput } => r.output !== undefined)
      .map((r) => r.output),
  }
}

export interface BatchTriggerSocialPostItem {
  scheduledPostId: string
  isFutureScheduled?: boolean
  idempotencyKey?: string
  scheduledFor?: Date | string | number
  contentHash?: string
  retryAttempt?: number
  tags?: string[]
}

export type BatchTriggerSocialPostsInput<TOutput = unknown> =
  | Array<string | BatchTriggerSocialPostItem>
  | {
      posts?: Array<string | BatchTriggerSocialPostItem>
      items?: Array<string | BatchTriggerSocialPostItem>
      scheduledPostIds?: string[]
      inlineRunner?: (payload: { scheduledPostId: string }) => Promise<TOutput>
    }

/**
 * Dispatches multiple scheduled social posts in parallel using `batchTrigger` when
 * `isTriggerCloudConfigured()` is true, and `Promise.all` local fallback in non-production.
 */
export async function batchTriggerSocialPosts<TOutput = unknown>(
  input: BatchTriggerSocialPostsInput<TOutput>,
  options?: {
    inlineRunner?: (payload: { scheduledPostId: string }) => Promise<TOutput>
  }
): Promise<BatchDispatchResult<TOutput>> {
  const rawList: Array<string | BatchTriggerSocialPostItem> = Array.isArray(
    input
  )
    ? input
    : input.posts ??
      input.items ??
      (input.scheduledPostIds ?? []).map((id) => ({ scheduledPostId: id }))

  const customRunner =
    options?.inlineRunner ??
    (!Array.isArray(input) ? input.inlineRunner : undefined)

  const normalizedItems: BatchTriggerSocialPostItem[] = rawList.map((entry) =>
    typeof entry === "string" ? { scheduledPostId: entry } : entry
  )

  const batchItems: Array<BatchDispatchItem<{ scheduledPostId: string }>> =
    normalizedItems.map((item) => ({
      payload: { scheduledPostId: item.scheduledPostId },
      isFutureScheduled: item.isFutureScheduled,
      options: {
        idempotencyKey:
          item.idempotencyKey || `soc-post-run-${item.scheduledPostId}`,
        scheduledFor: item.scheduledFor,
        contentHash: item.contentHash,
        retryAttempt: item.retryAttempt,
        tags: item.tags ?? [`social-post:${item.scheduledPostId}`],
      },
    }))

  const resolvedRunner =
    customRunner ??
    (async (payload: { scheduledPostId: string }) => {
      const { runPublishSocialPostInline } = await import(
        "./publish-social-post.task"
      )
      return (await runPublishSocialPostInline(payload)) as unknown as TOutput
    })

  const res = await batchTriggerByIdOrInline({
    taskId: "publish-social-post",
    items: batchItems,
    inlineRunner: resolvedRunner,
  })

  return {
    ...res,
    runs: res.runs.map((r, idx) => ({
      ...r,
      scheduledPostId: normalizedItems[idx]?.scheduledPostId,
    })),
  }
}

export async function triggerOrRunInline<
  TIdentifier extends string,
  TPayload,
  TOutput,
>(params: {
  task: Task<TIdentifier, TPayload, TOutput> | AnyTask
  payload: TPayload
  inlineRunner: (payload: TPayload) => Promise<TOutput>
  options?: DispatchOptions
}): Promise<DispatchResult<TOutput>> {
  return triggerByIdBackgroundOrInline({
    taskId: params.task.id,
    payload: params.payload,
    inlineRunner: params.inlineRunner,
    options: params.options,
  })
}

/**
 * Dispatches the decoupled `process-inbound-whatsapp` durable task via Trigger.dev Cloud
 * with global idempotency and per-conversation `concurrencyKey: payload.conversationId` (`T-072`),
 * failing closed in `NODE_ENV === "production"` (`T-037`).
 */
export async function dispatchInboundWhatsAppProcessing(
  rawPayload: ProcessInboundWhatsappPayload,
  options?: { retryAttempt?: number }
): Promise<DispatchResult<ProcessInboundWhatsappResult>> {
  const payload = processInboundWhatsappPayloadSchema.parse(rawPayload)

  return triggerByIdBackgroundOrInline({
    taskId: "process-inbound-whatsapp",
    payload,
    options: {
      idempotencyKey: `wa-inbound-process-${payload.messageId}`,
      retryAttempt: options?.retryAttempt,
      concurrencyKey: payload.conversationId,
      tags: [
        `wa-inbound:${payload.accountId}`,
        `wa-conv:${payload.conversationId}`,
        `wa-msg:${payload.messageId}`,
      ],
    },
    inlineRunner: async (p) => {
      const { runProcessInboundWhatsappInline } = await import(
        "./process-inbound-whatsapp.task"
      )
      return runProcessInboundWhatsappInline(p)
    },
  })
}
