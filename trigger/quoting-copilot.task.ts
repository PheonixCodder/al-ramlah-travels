import {
  AbortTaskRunError,
  logger,
  metadata,
  schemaTask,
} from "@trigger.dev/sdk"
import { z } from "zod"

import {
  generateApplicationQuoteCopilotDraft,
  generateWaConversationCopilotDraft,
  InvalidCopilotTargetError,
  type ApplicationQuoteCopilotGenerationOutput,
  type ApplicationQuoteCopilotResult,
  type WaCopilotDraftResult,
  type WaCopilotGenerationOutput,
} from "@/lib/ai/quoting-copilot"
import { rethrowAsTaskError } from "./errors"
import { quotingCopilotQueue } from "./queues"

export type QuotingCopilotProgressStage =
  | "assembling_context"
  | "running_domain_tools"
  | "generating_structured_draft"
  | "completed"

export const quotingCopilotPayloadSchema = z
  .object({
    mode: z.enum(["wa_conversation", "application_quote"]),
    conversationId: z.string().min(1).optional(),
    applicationId: z.string().min(1).optional(),
    staffPromptHint: z.string().max(1000).optional(),
    allowOfflineFallbackOnly: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === "wa_conversation" && !val.conversationId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["conversationId"],
        message:
          "conversationId is required when mode is 'wa_conversation'.",
      })
    }
    if (val.mode === "application_quote" && !val.applicationId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicationId"],
        message:
          "applicationId is required when mode is 'application_quote'.",
      })
    }
  })

export const quotingCopilotTaskPayloadSchema = quotingCopilotPayloadSchema

export type QuotingCopilotTaskPayload = z.infer<
  typeof quotingCopilotPayloadSchema
>

export type QuotingCopilotPayload = QuotingCopilotTaskPayload

export interface QuotingCopilotTaskResult {
  success: true
  mode: "wa_conversation" | "application_quote"
  waDraft?: WaCopilotDraftResult
  applicationDraft?: ApplicationQuoteCopilotResult
  draft: WaCopilotDraftResult | ApplicationQuoteCopilotResult
  data: WaCopilotGenerationOutput | ApplicationQuoteCopilotGenerationOutput
  modelUsed: string
  executionMode: "ai_provider" | "deterministic_fallback"
  stagesCompleted: QuotingCopilotProgressStage[]
  requiresHumanApproval: true
}

function setStageMetadataSafely(
  stage: QuotingCopilotProgressStage,
  progress: number,
  mode: "wa_conversation" | "application_quote"
) {
  try {
    metadata
      .set("stage", stage)
      .set("progress", progress)
      .set("mode", mode)
      .set("updatedAt", new Date().toISOString())
  } catch {
    // No-op when executed inline outside a Trigger.dev worker context
  }
}

/**
 * Executes the AI Quoting Copilot workflow across all 4 telemetry stages (`T-037`, `T-072`).
 */
export async function runQuotingCopilotInline(
  rawPayload: QuotingCopilotTaskPayload,
  onStage?: (stage: QuotingCopilotProgressStage, progress: number) => void
): Promise<QuotingCopilotTaskResult> {
  const payload = quotingCopilotPayloadSchema.parse(rawPayload)
  const stagesCompleted: QuotingCopilotProgressStage[] = []

  const recordStage = (
    stage: QuotingCopilotProgressStage,
    progress: number
  ) => {
    stagesCompleted.push(stage)
    setStageMetadataSafely(stage, progress, payload.mode)
    onStage?.(stage, progress)
  }

  logger.info("[QuotingCopilotTask] Starting copilot execution", {
    mode: payload.mode,
    conversationId: payload.conversationId,
    applicationId: payload.applicationId,
  })

  recordStage("assembling_context", 15)
  recordStage("running_domain_tools", 40)
  recordStage("generating_structured_draft", 70)

  if (payload.mode === "wa_conversation") {
    const waOutput = await generateWaConversationCopilotDraft({
      conversationId: payload.conversationId!,
      staffPromptHint: payload.staffPromptHint,
      allowOfflineFallbackOnly: payload.allowOfflineFallbackOnly,
    })

    recordStage("completed", 100)

    logger.info("[QuotingCopilotTask] WhatsApp copilot draft completed", {
      conversationId: payload.conversationId,
      modelUsed: waOutput.modelUsed,
      executionMode: waOutput.executionMode,
      matchedPackageCode: waOutput.matchedPackageCode,
    })

    return {
      success: true,
      mode: "wa_conversation",
      waDraft: waOutput.draft,
      draft: waOutput.draft,
      data: waOutput,
      modelUsed: waOutput.modelUsed,
      executionMode: waOutput.executionMode,
      stagesCompleted,
      requiresHumanApproval: true,
    }
  }

  const appOutput = await generateApplicationQuoteCopilotDraft({
    applicationId: payload.applicationId!,
    staffPromptHint: payload.staffPromptHint,
    allowOfflineFallbackOnly: payload.allowOfflineFallbackOnly,
  })

  recordStage("completed", 100)

  logger.info("[QuotingCopilotTask] Application quote copilot draft completed", {
    applicationId: payload.applicationId,
    modelUsed: appOutput.modelUsed,
    executionMode: appOutput.executionMode,
    grandTotalPkr: appOutput.suggestedQuoteWorksheet.grandTotalPkr,
  })

  return {
    success: true,
    mode: "application_quote",
    applicationDraft: appOutput.draft,
    draft: appOutput.draft,
    data: appOutput,
    modelUsed: appOutput.modelUsed,
    executionMode: appOutput.executionMode,
    stagesCompleted,
    requiresHumanApproval: true,
  }
}

/**
 * Trigger.dev v4 durable `schemaTask` for the AI Quoting Copilot & WhatsApp Concierge Agent,
 * bound to `quotingCopilotQueue` (`concurrencyLimit: 3`) with `rethrowAsTaskError` classification (`T-037`, `T-072`).
 */
export const quotingCopilotTask = schemaTask({
  id: "quoting-copilot",
  schema: quotingCopilotPayloadSchema,
  queue: quotingCopilotQueue,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload) => {
    try {
      return await runQuotingCopilotInline(payload)
    } catch (err) {
      if (err instanceof InvalidCopilotTargetError) {
        throw new AbortTaskRunError(err.message)
      }
      rethrowAsTaskError(err, "QuotingCopilotTask")
    }
  },
})
