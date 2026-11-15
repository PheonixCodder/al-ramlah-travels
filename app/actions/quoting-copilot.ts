"use server"

import { auth as triggerAuth, tasks } from "@trigger.dev/sdk"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth-guard"
import {
  waConversationCopilotInputSchema,
  applicationQuoteCopilotInputSchema,
  generateApplicationQuoteCopilotDraft,
  type ApplicationQuoteCopilotGenerationOutput,
  type ApplicationQuoteCopilotResult,
  type WaCopilotDraftResult,
  type WaCopilotGenerationOutput,
} from "@/lib/ai/quoting-copilot"
import { logger } from "@/lib/logger"
import {
  isTriggerCloudConfigured,
  triggerByIdAndAwaitOrInline,
} from "@/trigger/dispatch"
import {
  runQuotingCopilotInline,
  type QuotingCopilotTaskPayload,
  type QuotingCopilotTaskResult,
} from "@/trigger/quoting-copilot.task"

export type GenerateWaConversationCopilotActionInput =
  | z.infer<typeof waConversationCopilotInputSchema>
  | string

export type GenerateApplicationQuoteCopilotActionInput =
  | z.infer<typeof applicationQuoteCopilotInputSchema>
  | string

export type GenerateWaConversationCopilotActionResult =
  | {
      success: true
      data: WaCopilotGenerationOutput
      draft: WaCopilotDraftResult
      modelUsed: string
      executionMode: "ai_provider" | "deterministic_fallback"
      runMode: "cloud" | "inline"
      runId?: string
      requiresHumanApproval: true
      requiresHumanConfirmation: true
    }
  | {
      success: false
      error: string
    }

export type GenerateApplicationQuoteCopilotActionResult =
  | {
      success: true
      data: ApplicationQuoteCopilotGenerationOutput
      draft: ApplicationQuoteCopilotResult
      modelUsed: string
      executionMode: "ai_provider" | "deterministic_fallback"
      runMode: "cloud" | "inline"
      runId?: string
      requiresHumanApproval: true
      requiresHumanConfirmation: true
    }
  | {
      success: false
      error: string
    }

async function requireStaffSession() {
  return requireAdmin()
}

/**
 * Server Action: Generates a Human-in-the-Loop bilingual WhatsApp reply draft
 * and package recommendation for an active `whatsapp_conversations` thread (`T-028`).
 * Strictly read-only: NEVER sends a message or mutates `whatsapp_messages`, and always
 * enforces `requiresHumanConfirmation: true` (`OD-06`).
 */
export async function generateWaConversationCopilotDraftAction(
  rawInput: GenerateWaConversationCopilotActionInput,
  staffPromptHintArg?: string
): Promise<GenerateWaConversationCopilotActionResult> {
  await requireStaffSession()

  const normalizedInput =
    typeof rawInput === "string"
      ? {
          conversationId: rawInput,
          staffPromptHint: staffPromptHintArg,
        }
      : rawInput

  const parsed = waConversationCopilotInputSchema.safeParse(normalizedInput)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ")
    return {
      success: false,
      error: `Validation error: ${details}`,
    }
  }

  const payload: QuotingCopilotTaskPayload = {
    mode: "wa_conversation",
    conversationId: parsed.data.conversationId,
    staffPromptHint: parsed.data.staffPromptHint,
    allowOfflineFallbackOnly: parsed.data.allowOfflineFallbackOnly,
  }

  try {
    const dispatchRes = await triggerByIdAndAwaitOrInline<
      QuotingCopilotTaskPayload,
      QuotingCopilotTaskResult
    >({
      taskId: "quoting-copilot",
      payload,
      options: {
        tags: [`copilot:wa:${parsed.data.conversationId}`],
      },
      inlineRunner: (p) => runQuotingCopilotInline(p),
    })

    if (!dispatchRes.success || !dispatchRes.output) {
      return {
        success: false,
        error:
          dispatchRes.error || "Failed to generate WhatsApp copilot draft.",
      }
    }

    const output = dispatchRes.output
    const rawDraft = output.waDraft ?? (output.draft as WaCopilotDraftResult)
    const draft: WaCopilotDraftResult = {
      ...rawDraft,
      requiresHumanApproval: true,
      requiresHumanConfirmation: true,
    }
    const rawData = output.data as WaCopilotGenerationOutput
    const data: WaCopilotGenerationOutput = {
      ...rawData,
      ...draft,
      draft,
    }

    return {
      success: true,
      data,
      draft,
      modelUsed: output.modelUsed,
      executionMode: output.executionMode,
      runMode: dispatchRes.mode,
      runId: dispatchRes.runId,
      requiresHumanApproval: true,
      requiresHumanConfirmation: true,
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unexpected error generating WhatsApp copilot draft"
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Server Action: Generates a Human-in-the-Loop itemized SAR/PKR Quote Worksheet
 * pre-fill, executive summary, and bilingual customer message draft for an application (`T-028`).
 * Strictly read-only: NEVER mutates `application_quotes` or changes application status,
 * and enforces `requiresHumanConfirmation: true` (`OD-06`).
 */
export async function generateApplicationQuoteCopilotDraftAction(
  rawInput: GenerateApplicationQuoteCopilotActionInput,
  staffPromptHintArg?: string
): Promise<GenerateApplicationQuoteCopilotActionResult> {
  await requireStaffSession()

  const normalizedInput =
    typeof rawInput === "string"
      ? {
          applicationId: rawInput,
          staffPromptHint: staffPromptHintArg,
        }
      : rawInput

  const parsed = applicationQuoteCopilotInputSchema.safeParse(normalizedInput)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ")
    return {
      success: false,
      error: `Validation error: ${details}`,
    }
  }

  try {
    // When an explicit human-entered discount or margin floor is supplied, run directly through
    // the deterministic pricing engine so human-only overrides are preserved accurately.
    if (
      parsed.data.authorizedHumanDiscountPkr !== undefined ||
      parsed.data.minimumMarginFloorPkr !== undefined
    ) {
      const appOut = await generateApplicationQuoteCopilotDraft(parsed.data)
      const draft: ApplicationQuoteCopilotResult = {
        ...appOut.draft,
        requiresHumanApproval: true,
        requiresHumanConfirmation: true,
      }
      const data: ApplicationQuoteCopilotGenerationOutput = {
        ...appOut,
        ...draft,
        draft,
      }
      return {
        success: true,
        data,
        draft,
        modelUsed: appOut.modelUsed,
        executionMode: appOut.executionMode,
        runMode: "inline",
        requiresHumanApproval: true,
        requiresHumanConfirmation: true,
      }
    }

    const payload: QuotingCopilotTaskPayload = {
      mode: "application_quote",
      applicationId: parsed.data.applicationId,
      staffPromptHint: parsed.data.staffPromptHint,
      allowOfflineFallbackOnly: parsed.data.allowOfflineFallbackOnly,
    }

    const dispatchRes = await triggerByIdAndAwaitOrInline<
      QuotingCopilotTaskPayload,
      QuotingCopilotTaskResult
    >({
      taskId: "quoting-copilot",
      payload,
      options: {
        tags: [`copilot:app:${parsed.data.applicationId}`],
      },
      inlineRunner: (p) => runQuotingCopilotInline(p),
    })

    if (!dispatchRes.success || !dispatchRes.output) {
      return {
        success: false,
        error:
          dispatchRes.error ||
          "Failed to generate application quote copilot draft.",
      }
    }

    const output = dispatchRes.output
    const rawDraft =
      output.applicationDraft ??
      (output.draft as ApplicationQuoteCopilotResult)
    const draft: ApplicationQuoteCopilotResult = {
      ...rawDraft,
      requiresHumanApproval: true,
      requiresHumanConfirmation: true,
    }
    const rawData = output.data as ApplicationQuoteCopilotGenerationOutput
    const data: ApplicationQuoteCopilotGenerationOutput = {
      ...rawData,
      ...draft,
      draft,
    }

    return {
      success: true,
      data,
      draft,
      modelUsed: output.modelUsed,
      executionMode: output.executionMode,
      runMode: dispatchRes.mode,
      runId: dispatchRes.runId,
      requiresHumanApproval: true,
      requiresHumanConfirmation: true,
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unexpected error generating application quote copilot draft"
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Server Action: Non-blocking initiation of WhatsApp Quoting Copilot.
 */
export async function startWhatsappCopilotRunAction(
  rawInput: GenerateWaConversationCopilotActionInput,
  staffPromptHintArg?: string
): Promise<{
  success: boolean
  mode: "cloud" | "inline"
  runId: string
  publicAccessToken?: string
  inlineOutput?: GenerateWaConversationCopilotActionResult
  requiresHumanApproval: true
  requiresHumanConfirmation: true
  error?: string
}> {
  await requireStaffSession()
  const normalizedInput =
    typeof rawInput === "string"
      ? {
          conversationId: rawInput,
          staffPromptHint: staffPromptHintArg,
        }
      : rawInput

  const parsed = waConversationCopilotInputSchema.safeParse(normalizedInput)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ")
    return {
      success: false,
      mode: "inline",
      runId: "",
      requiresHumanApproval: true,
      requiresHumanConfirmation: true,
      error: `Validation error: ${details}`,
    }
  }

  const payload: QuotingCopilotTaskPayload = {
    mode: "wa_conversation",
    conversationId: parsed.data.conversationId,
    staffPromptHint: parsed.data.staffPromptHint,
    allowOfflineFallbackOnly: parsed.data.allowOfflineFallbackOnly,
  }

  if (isTriggerCloudConfigured()) {
    try {
      const handle = await tasks.trigger("quoting-copilot", payload, {
        tags: [`copilot:wa:${parsed.data.conversationId}`],
      })

      const publicAccessToken = await triggerAuth.createPublicToken({
        scopes: { read: { runs: [handle.id] } },
        expirationTime: "1h",
      })

      return {
        success: true,
        mode: "cloud",
        runId: handle.id,
        publicAccessToken,
        requiresHumanApproval: true,
        requiresHumanConfirmation: true,
      }
    } catch (err) {
      logger.warn("copilot_wa_cloud_dispatch_fallback", {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const inlineResult = await runQuotingCopilotInline(payload)
  const rawDraft =
    inlineResult.waDraft ?? (inlineResult.draft as WaCopilotDraftResult)
  const draft: WaCopilotDraftResult = {
    ...rawDraft,
    requiresHumanApproval: true,
    requiresHumanConfirmation: true,
  }
  const rawData = inlineResult.data as WaCopilotGenerationOutput
  const data: WaCopilotGenerationOutput = {
    ...rawData,
    ...draft,
    draft,
  }

  return {
    success: true,
    mode: "inline",
    runId: `inline_copilot_${Date.now()}`,
    requiresHumanApproval: true,
    requiresHumanConfirmation: true,
    inlineOutput: {
      success: true,
      data,
      draft,
      modelUsed: inlineResult.modelUsed,
      executionMode: inlineResult.executionMode,
      runMode: "inline",
      requiresHumanApproval: true,
      requiresHumanConfirmation: true,
    },
  }
}

/**
 * Server Action: Non-blocking initiation of Application Quote Copilot (`T-028`, `T-063`).
 * Routes through durable Trigger.dev Cloud (`quoting-copilot` task) when configured,
 * falling back cleanly to inline execution in offline/local environments.
 */
export async function startApplicationCopilotRunAction(
  rawInput: GenerateApplicationQuoteCopilotActionInput,
  staffPromptHintArg?: string
): Promise<{
  success: boolean
  mode: "cloud" | "inline"
  runId: string
  publicAccessToken?: string
  inlineOutput?: GenerateApplicationQuoteCopilotActionResult
  requiresHumanApproval: true
  requiresHumanConfirmation: true
  error?: string
}> {
  await requireStaffSession()
  const normalizedInput =
    typeof rawInput === "string"
      ? {
          applicationId: rawInput,
          staffPromptHint: staffPromptHintArg,
        }
      : rawInput

  const parsed = applicationQuoteCopilotInputSchema.safeParse(normalizedInput)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ")
    return {
      success: false,
      mode: "inline",
      runId: "",
      requiresHumanApproval: true,
      requiresHumanConfirmation: true,
      error: `Validation error: ${details}`,
    }
  }

  const payload: QuotingCopilotTaskPayload = {
    mode: "application_quote",
    applicationId: parsed.data.applicationId,
    staffPromptHint: parsed.data.staffPromptHint,
    allowOfflineFallbackOnly: parsed.data.allowOfflineFallbackOnly,
  }

  if (
    isTriggerCloudConfigured() &&
    parsed.data.authorizedHumanDiscountPkr === undefined &&
    parsed.data.minimumMarginFloorPkr === undefined
  ) {
    try {
      const handle = await tasks.trigger("quoting-copilot", payload, {
        tags: [`copilot:app:${parsed.data.applicationId}`],
      })

      const publicAccessToken = await triggerAuth.createPublicToken({
        scopes: { read: { runs: [handle.id] } },
        expirationTime: "1h",
      })

      return {
        success: true,
        mode: "cloud",
        runId: handle.id,
        publicAccessToken,
        requiresHumanApproval: true,
        requiresHumanConfirmation: true,
      }
    } catch (err) {
      logger.warn("copilot_application_cloud_dispatch_fallback", {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const res = await generateApplicationQuoteCopilotDraftAction(parsed.data)
  if (!res.success) {
    return {
      success: false,
      mode: "inline",
      runId: "",
      requiresHumanApproval: true,
      requiresHumanConfirmation: true,
      error: res.error,
    }
  }

  return {
    success: true,
    mode: "inline",
    runId: `inline_copilot_${Date.now()}`,
    requiresHumanApproval: true,
    requiresHumanConfirmation: true,
    inlineOutput: res,
  }
}

export const generateWaCopilotDraftAction =
  generateWaConversationCopilotDraftAction

export async function triggerQuotingCopilotAction(
  applicationId: string,
  staffPromptHint?: string
) {
  return startApplicationCopilotRunAction({ applicationId, staffPromptHint })
}
