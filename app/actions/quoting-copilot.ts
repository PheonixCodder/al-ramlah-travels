"use server"

import { auth as triggerAuth, tasks } from "@trigger.dev/sdk"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth-guard"
import {
  waConversationCopilotInputSchema,
  applicationQuoteCopilotInputSchema,
  type ApplicationQuoteCopilotGenerationOutput,
  type ApplicationQuoteCopilotResult,
  type WaCopilotDraftResult,
  type WaCopilotGenerationOutput,
} from "@/lib/ai/quoting-copilot"
import {
  isTriggerCloudConfigured,
  triggerByIdAndAwaitOrInline,
} from "@/trigger/dispatch"
import {
  runQuotingCopilotInline,
  type QuotingCopilotTaskPayload,
  type QuotingCopilotTaskResult,
} from "@/trigger/quoting-copilot.task"

// ==========================================
// 1. INPUT VALIDATION SCHEMAS & TYPES
// (Schemas imported from @/lib/ai/quoting-copilot to satisfy Next.js 16 "use server" async function only rule)
// ==========================================

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
    }
  | {
      success: false
      error: string
    }

async function requireStaffSession() {
  return requireAdmin()
}

// ==========================================
// 2. AUTHENTICATED SERVER ACTIONS (AC-3)
// ==========================================

/**
 * Server Action: Generates a Human-in-the-Loop bilingual WhatsApp reply draft
 * and package recommendation for an active `whatsapp_conversations` thread.
 * Never sends a message or mutates `whatsapp_messages`.
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
          dispatchRes.error ||
          "Failed to generate WhatsApp copilot draft.",
      }
    }

    const output = dispatchRes.output
    const draft = output.waDraft ?? (output.draft as WaCopilotDraftResult)
    const data = output.data as WaCopilotGenerationOutput

    return {
      success: true,
      data,
      draft,
      modelUsed: output.modelUsed,
      executionMode: output.executionMode,
      runMode: dispatchRes.mode,
      runId: dispatchRes.runId,
      requiresHumanApproval: true,
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
 * pre-fill, executive summary, and bilingual customer message draft for an application.
 * Never mutates `application_quotes` or changes application status.
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

  const parsed =
    applicationQuoteCopilotInputSchema.safeParse(normalizedInput)
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
    mode: "application_quote",
    applicationId: parsed.data.applicationId,
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
    const draft =
      output.applicationDraft ??
      (output.draft as ApplicationQuoteCopilotResult)
    const data = output.data as ApplicationQuoteCopilotGenerationOutput

    return {
      success: true,
      data,
      draft,
      modelUsed: output.modelUsed,
      executionMode: output.executionMode,
      runMode: dispatchRes.mode,
      runId: dispatchRes.runId,
      requiresHumanApproval: true,
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
 * When Trigger.dev Cloud is configured, immediately triggers the background task,
 * mints a scoped public access token, and returns `{ success: true, mode: "cloud", runId, publicAccessToken }`
 * without blocking on runs.poll(), allowing browser UI to render live 4-stage progress via useRealtimeRun.
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
      }
    } catch (err) {
      console.warn(
        "[Copilot Cloud Dispatch Warning] Falling back to inline:",
        err
      )
    }
  }

  // Local/inline execution fallback
  const inlineResult = await runQuotingCopilotInline(payload)
  const draft =
    inlineResult.waDraft ?? (inlineResult.draft as WaCopilotDraftResult)
  const data = inlineResult.data as WaCopilotGenerationOutput

  return {
    success: true,
    mode: "inline",
    runId: `inline_copilot_${Date.now()}`,
    inlineOutput: {
      success: true,
      data,
      draft,
      modelUsed: inlineResult.modelUsed,
      executionMode: inlineResult.executionMode,
      runMode: "inline",
      requiresHumanApproval: true,
    },
  }
}

/**
 * Server Action: Non-blocking initiation of Application Quote Copilot.
 * When Trigger.dev Cloud is configured, immediately triggers the background task,
 * mints a scoped public access token, and returns `{ success: true, mode: "cloud", runId, publicAccessToken }`
 * without blocking on runs.poll().
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
      error: `Validation error: ${details}`,
    }
  }

  const payload: QuotingCopilotTaskPayload = {
    mode: "application_quote",
    applicationId: parsed.data.applicationId,
    staffPromptHint: parsed.data.staffPromptHint,
    allowOfflineFallbackOnly: parsed.data.allowOfflineFallbackOnly,
  }

  // Execute directly inline so clicking Generate Estimate returns real SAR/PKR breakdown immediately in 2–4s
  const inlineResult = await runQuotingCopilotInline(payload)
  const draft =
    inlineResult.applicationDraft ??
    (inlineResult.draft as ApplicationQuoteCopilotResult)
  const data = inlineResult.data as ApplicationQuoteCopilotGenerationOutput

  return {
    success: true,
    mode: "inline",
    runId: `inline_copilot_${Date.now()}`,
    inlineOutput: {
      success: true,
      data,
      draft,
      modelUsed: inlineResult.modelUsed,
      executionMode: inlineResult.executionMode,
      runMode: "inline",
      requiresHumanApproval: true,
    },
  }
}

/**
 * Convenience alias for triggering application quoting copilot directly inline.
 */
export async function triggerQuotingCopilotAction(
  applicationId: string,
  staffPromptHint?: string
) {
  return startApplicationCopilotRunAction({ applicationId, staffPromptHint })
}
