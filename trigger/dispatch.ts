import {
  runs as defaultRuns,
  tasks as defaultTasks,
  type AnyTask,
  type Task,
  type TriggerOptions,
} from "@trigger.dev/sdk"

let sdkTasks: Pick<typeof defaultTasks, "trigger"> = defaultTasks
let sdkRuns: Pick<typeof defaultRuns, "poll" | "retrieve" | "cancel"> = defaultRuns

export function setTriggerSdkForTests(
  overrides: {
    tasks?: Pick<typeof defaultTasks, "trigger">
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

/**
 * Safely cancels a Trigger.dev run if a runId is recorded (e.g., cancelling a sleeping wait.until post).
 */
export async function cancelTriggerRunIfActive(
  runId: string | null | undefined
): Promise<void> {
  if (!runId || !isTriggerCloudConfigured()) return
  try {
    await sdkRuns.cancel(runId)
  } catch (err) {
    console.warn(`[Trigger Cancel Warning] Could not cancel run ${runId}:`, err)
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

  if (isTriggerCloudConfigured()) {
    try {
      const handle = await sdkTasks.trigger(taskId, payload, options)

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

  if (isFutureScheduled) {
    // Future-scheduled record remains persisted in Neon DB for safety cron sweep
    return {
      mode: "inline",
      success: true,
    }
  }

  try {
    const output = await inlineRunner(payload)
    return {
      mode: "inline",
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

  if (isTriggerCloudConfigured()) {
    try {
      const handle = await sdkTasks.trigger(taskId, payload, options)

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

  try {
    const output = await inlineRunner(payload)
    return {
      mode: "inline",
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
      success: false,
      error: errorMsg,
    }
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
