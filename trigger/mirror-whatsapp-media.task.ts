import { logger, schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"
import {
  mirrorInboundWhatsAppMediaToR2,
  type MirrorInboundWhatsAppMediaInput,
  type MirrorInboundWhatsAppMediaResult,
} from "@/lib/whatsapp/media-mirror"
import {
  triggerByIdBackgroundOrInline,
  type DispatchResult,
} from "@/trigger/dispatch"
import { rethrowAsTaskError } from "./errors"
import { mediaMirrorQueue } from "./queues"

export const mirrorWhatsappMediaPayloadSchema = z.object({
  messageId: z.string().min(1, "messageId is required"),
  accountId: z.string().optional(),
  conversationId: z.string().optional(),
  rawMediaId: z.string().optional(),
  wamid: z.string().optional(),
  fallbackMimeType: z.string().nullable().optional(),
})

export type MirrorWhatsappMediaPayload = z.infer<
  typeof mirrorWhatsappMediaPayloadSchema
>

export async function runMirrorWhatsappMediaTask(
  payload: MirrorWhatsappMediaPayload
): Promise<MirrorInboundWhatsAppMediaResult> {
  logger.info("[MirrorWhatsappMediaTask] Starting inbound media mirror to R2", {
    messageId: payload.messageId,
    rawMediaId: payload.rawMediaId,
  })

  try {
    const result = await mirrorInboundWhatsAppMediaToR2(payload)

    if (!result.success) {
      logger.warn("[MirrorWhatsappMediaTask] Media mirror failed", {
        messageId: payload.messageId,
        error: result.error,
      })
      rethrowAsTaskError(
        new Error(result.error || "WhatsApp media mirror failed"),
        "MirrorWhatsappMediaTask"
      )
    }

    logger.info("[MirrorWhatsappMediaTask] Media mirrored to R2", {
      messageId: payload.messageId,
      mediaUrl: result.mediaUrl,
      mediaMimeType: result.mediaMimeType,
      provider: result.provider,
    })

    return result
  } catch (err: unknown) {
    rethrowAsTaskError(err, "MirrorWhatsappMediaTask")
  }
}

export const mirrorWhatsappMediaTask = schemaTask({
  id: "mirror-whatsapp-media",
  schema: mirrorWhatsappMediaPayloadSchema,
  queue: mediaMirrorQueue,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1500,
    maxTimeoutInMs: 10000,
  },
  run: async (payload) => {
    return runMirrorWhatsappMediaTask(payload)
  },
})

/**
 * Dispatches the `mirror-whatsapp-media` task via Trigger.dev Cloud (`mediaMirrorQueue`),
 * failing closed in production (`T-037`) and passing optional `retryAttempt` (`T-072`).
 */
export async function dispatchMirrorWhatsAppMedia(
  input: MirrorInboundWhatsAppMediaInput,
  options?: { retryAttempt?: number }
): Promise<DispatchResult<MirrorInboundWhatsAppMediaResult>> {
  const validated = mirrorWhatsappMediaPayloadSchema.parse(input)
  return triggerByIdBackgroundOrInline({
    taskId: "mirror-whatsapp-media",
    payload: validated,
    options: {
      idempotencyKey: `wa-media-mirror-${validated.messageId}`,
      retryAttempt: options?.retryAttempt,
      tags: [`wa-msg:${validated.messageId}`],
    },
    inlineRunner: async (payload) => {
      return mirrorInboundWhatsAppMediaToR2(payload)
    },
  })
}
