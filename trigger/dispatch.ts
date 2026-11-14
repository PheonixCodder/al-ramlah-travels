import {
  idempotencyKeys,
  runs as defaultRuns,
  tasks as defaultTasks,
  type AnyTask,
  type Task,
  type TriggerOptions,
} from "@trigger.dev/sdk"
import {
  recordLocalRunTags,
  setLocalRunProgressSnapshot,
  withLocalRunProgressScope,
} from "./metadata"
import {
  processInboundWhatsappPayloadSchema,
  type ProcessInboundWhatsappPayload,
  type ProcessInboundWhatsappResult,
} from "./process-inbound-whatsapp.task"

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
) {
  sdkTasks = overrides?.tasks ?? defaultTasks
  sdkRuns = overrides?.runs ?? defaultRuns
}

/**
 * Returns the configured Trigger.dev secret key if present.
 */
function getTriggerSecretKey(): string | undefined {
  const key = process.env.TRIGGER_SECRET_KEY
  return key && key.trim().length > 0 ? key.trim() : undefined
}

/**
 * Returns true if the environment has Trigger.dev Cloud credentials configured.
 */
export function isTriggerCloudConfigured(): boolean {
  return Boolean(getTriggerSecretKey())
}

/**
 * Returns true if the secret key targets Trigger.dev's always-on deployed `prod` workers.
 * (`tr_dev_` keys require `npm run trigger:dev` attached locally to execute queued runs.)
 */
export function isTriggerProdKeyConfigured(): boolean {
  const key = getTriggerSecretKey()
  return Boolean(key && key.startsWith("tr_prod_"))
}

export interface DispatchOptions extends TriggerOptions {
  tags?: string[]
}

export interface DispatchResult<TOutput> {
  mode: "cloud" | "inline"
  runId?: string
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
  mode: "cloud" | "inline"
  success: boolean
  batchId?: string
  runIds: string[]
  runs: Array<{
    id: string
    scheduledPostId?: string
    mode: "cloud" | "inline"
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

/**
 * Safely cancels a Trigger.dev run if a runId is recorded (e.g., cancelling a sleeping wait.until post).
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
 * Promotes raw string idempotency keys to global project scope in Trigger.dev v4.
 */
export async function normalizeDispatchOptions(
  options?: DispatchOptions
): Promise<DispatchOptions | undefined> {
  if (!options) return undefined
  if (!options.idempotencyKey || typeof options.idempotencyKey !== "string") {
    return options
  }
  if (!isTriggerCloudConfigured()) {
    return options
  }
  try {
    const globalKey = await idempotencyKeys.create(options.idempotencyKey, {
      scope: "global",
    })
    return {
      ...options,
      idempotencyKey: globalKey,
    }
  } catch {
    return options
  }
}

/**
 * Triggers a Trigger.dev task by string ID (avoiding runtime task bundle imports in Next.js Server Actions)
 * for fire-and-forget / scheduled background jobs (e.g. social publishing & WhatsApp broadcasts).
 *
 * - For future-scheduled runs (`isFutureScheduled: true`): always dispatches to Trigger.dev Cloud and returns `runId`.
 * - For immediate runs (`isFutureScheduled: false`):
 *   - On `tr_prod_` keys: dispatches to Trigger.dev Cloud's 24/7 deployed worker and returns immediately.
 *   - On `tr_dev_` keys: dispatches to Trigger.dev Dev and checks after 2.2s whether a local `trigger:dev` worker
 *     picked it up; if still `QUEUED` (no local worker running), cancels the unattached dev run and executes `inlineRunner`
 *     so local dev testing never stalls.
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
      const handle = await sdkTasks.trigger(taskId, payload, resolvedOptions)

      if (isFutureScheduled || isTriggerProdKeyConfigured()) {
        return {
          mode: "cloud",
          runId: handle.id,
          success: true,
        }
      }

      // In local tr_dev_ mode, verify a local `trigger:dev` worker picked up the immediate job
      await new Promise((resolve) => setTimeout(resolve, 2200))
      const snapshot = await sdkRuns.retrieve(handle.id)

      if (snapshot.status !== "QUEUED") {
        return {
          mode: "cloud",
          runId: handle.id,
          success: true,
        }
      }

      console.warn(
        `[Trigger Dev Fallback] Task '${taskId}' (${handle.id}) remained QUEUED with tr_dev_ key (no local trigger:dev worker attached). Cancelling dev run and executing inline.`
      )
      await cancelTriggerRunIfActive(handle.id)
    } catch (cloudErr: unknown) {
      console.warn(
        `[Trigger Cloud Dispatch Warning] Failed to trigger background task '${taskId}' on Cloud. Falling back to inline execution:`,
        cloudErr
      )
    }
  }

  const syntheticRunId = buildSyntheticInlineRunId(taskId)
  if (options?.tags && options.tags.length > 0) {
    recordLocalRunTags(syntheticRunId, options.tags)
  }
  if (options?.tags && options.tags.length > 0) {
    recordLocalRunTags(syntheticRunId, options.tags)
  }

  if (isFutureScheduled) {
    setLocalRunProgressSnapshot(syntheticRunId, {
      stage: "waiting_until_scheduled",
      progress: 20,
      label: "Scheduled locally",
      detail: "Persisted in database for scheduled execution",
      updatedAt: new Date().toISOString(),
    })
    return {
      mode: "inline",
      runId: syntheticRunId,
      success: true,
    }
  }

  try {
    const output = await withLocalRunProgressScope(syntheticRunId, () =>
      inlineRunner(payload)
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
 * Triggers a heavy compute task by string ID on Trigger.dev Cloud (Multimodal AI extraction, `sharp`, Gotenberg PDF/4K poster)
 * and awaits its typed output via `runs.poll` so CPU/memory-heavy work executes on Trigger.dev Cloud's 300s container
 * rather than inside Vercel's serverless function memory.
 *
 * Automatically falls back to `inlineRunner` if Trigger.dev credentials are unset or if using a `tr_dev_` key
 * without a local `npm run trigger:dev` worker attached.
 */
export async function triggerByIdAndAwaitOrInline<
  TPayload,
  TOutput,
>(params: {
  taskId: string
  payload: TPayload
  inlineRunner: (payload: TPayload) => Promise<TOutput>
  options?: DispatchOptions
}): Promise<DispatchResult<TOutput>> {
  const { taskId, payload, inlineRunner, options } = params

  const resolvedOptions = await normalizeDispatchOptions(options)

  if (isTriggerCloudConfigured()) {
    try {
      const handle = await sdkTasks.trigger(taskId, payload, resolvedOptions)

      let shouldPollCloud = isTriggerProdKeyConfigured()

      if (!shouldPollCloud) {
        // Check if a local `trigger:dev` worker picked up the run within 2.2s
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
        const finished = await sdkRuns.poll(handle, { pollIntervalMs: 800 })
        if (finished.isSuccess) {
          return {
            mode: "cloud",
            runId: finished.id,
            output: finished.output as TOutput,
            success: true,
          }
        }

        const cloudErrMsg =
          finished.error?.message ||
          `Trigger.dev run ${finished.id} ended with status ${finished.status}`
        console.warn(
          `[Trigger Cloud Run Failed] ${taskId} (${finished.id}): ${cloudErrMsg}. Falling back to inline execution.`
        )
      }
    } catch (cloudErr: unknown) {
      console.warn(
        `[Trigger Cloud Await Warning] Failed to execute '${taskId}' on Cloud. Falling back to inline execution:`,
        cloudErr
      )
    }
  }

  const syntheticRunId = buildSyntheticInlineRunId(taskId)
  if (options?.tags && options.tags.length > 0) {
    recordLocalRunTags(syntheticRunId, options.tags)
  }

  try {
    const output = await withLocalRunProgressScope(syntheticRunId, () =>
      inlineRunner(payload)
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
    console.error(`[Inline Task Execution Error] ${taskId}:`, inlineErr)
    return {
      mode: "inline",
      runId: syntheticRunId,
      success: false,
      error: errorMsg,
    }
  }
}

/**
 * Parallel batch fan-out helper by task string ID with `Promise.all` local inline fallback.
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
      const batchTriggerFn = sdkTasks.batchTrigger ?? defaultTasks.batchTrigger
      if (typeof batchTriggerFn === "function") {
        const batchHandle = (await batchTriggerFn(
          taskId,
          items.map((item) => ({
            payload: item.payload,
            options: item.options,
          }))
        )) as { batchId?: string; runs?: Array<{ id: string }> }
        const runs = (batchHandle.runs ?? []).map((r: { id: string }) => ({
          id: r.id,
          mode: "cloud" as const,
        }))
        return {
          mode: "cloud",
          success: true,
          batchId: batchHandle.batchId,
          runIds: runs.map((r: { id: string }) => r.id),
          runs,
        }
      }

      // Fallback if test mock only overrides sdkTasks.trigger
      const handles = await Promise.all(
        items.map((item) =>
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
      console.warn(
        `[Trigger Batch Dispatch Warning] Failed to batchTrigger '${taskId}' on Cloud. Falling back to Promise.all inline execution:`,
        cloudErr
      )
    }
  }

  const settled = await Promise.all(
    items.map(async (item, idx) => {
      const syntheticRunId = buildSyntheticInlineRunId(taskId, String(idx + 1))
      if (item.isFutureScheduled) {
        setLocalRunProgressSnapshot(syntheticRunId, {
          stage: "waiting_until_scheduled",
          progress: 20,
          label: "Scheduled locally",
          detail: "Persisted in database for scheduled execution",
          updatedAt: new Date().toISOString(),
        })
        return {
          id: syntheticRunId,
          mode: "inline" as const,
          ok: true,
          output: undefined as TOutput | undefined,
        }
      }

      try {
        const output = await withLocalRunProgressScope(syntheticRunId, () =>
          inlineRunner(item.payload)
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
 * `isTriggerCloudConfigured()` is true, and `Promise.all` local fallback otherwise.
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
    await Promise.all(
      normalizedItems.map(async (item) => {
        const rawKey =
          item.idempotencyKey || `soc-post-run-${item.scheduledPostId}`
        let idemKey = rawKey
        if (isTriggerCloudConfigured()) {
          try {
            idemKey = await idempotencyKeys.create(rawKey, {
              scope: "global",
            })
          } catch {
            idemKey = rawKey
          }
        }
        return {
          payload: { scheduledPostId: item.scheduledPostId },
          isFutureScheduled: item.isFutureScheduled,
          options: {
            idempotencyKey: idemKey,
            tags: item.tags ?? [`social-post:${item.scheduledPostId}`],
          },
        }
      })
    )

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

/**
 * Clean typed dispatcher helper (triggerOrRunInline) that dispatches to Trigger.dev Cloud
 * via task.trigger(...) when env.TRIGGER_SECRET_KEY is configured, and gracefully
 * executes inline / locally when TRIGGER_SECRET_KEY is unset in local development.
 */
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
 * with global idempotency, or falls back to inline execution when running locally.
 */
export async function dispatchInboundWhatsAppProcessing(
  rawPayload: ProcessInboundWhatsappPayload
): Promise<DispatchResult<ProcessInboundWhatsappResult>> {
  const payload = processInboundWhatsappPayloadSchema.parse(rawPayload)
  const rawKey = `wa-inbound-process-${payload.messageId}`

  let idempotencyKey: string = rawKey
  if (isTriggerCloudConfigured()) {
    try {
      idempotencyKey = await idempotencyKeys.create(rawKey, {
        scope: "global",
      })
    } catch {
      idempotencyKey = rawKey
    }
  }

  return triggerByIdBackgroundOrInline({
    taskId: "process-inbound-whatsapp",
    payload,
    options: {
      idempotencyKey,
      tags: [
        `wa-inbound:${payload.messageId}`,
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
