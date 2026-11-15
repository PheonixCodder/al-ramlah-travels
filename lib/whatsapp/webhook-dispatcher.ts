import { idempotencyKeys, tasks } from "@trigger.dev/sdk"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import {
  whatsappConversations,
  whatsappMessages,
} from "@/db/schema/whatsapp-crm"
import { isTriggerCloudConfigured } from "@/trigger/dispatch"
import {
  processInboundWhatsappPayloadSchema,
  type ProcessInboundWhatsappPayload,
} from "@/trigger/process-inbound-whatsapp.task"
import {
  resolvePostRefCode,
  unlockOutreachCooldownForPhone,
} from "./post-ref-detector"

export interface WebhookDispatchResult {
  dispatched: boolean
  mode: "cloud" | "queued_async"
  runId?: string
  error?: string
}

export type WebhookInboundDispatchFn = (
  payload: ProcessInboundWhatsappPayload
) => Promise<WebhookDispatchResult>

let customWebhookDispatcher: WebhookInboundDispatchFn | null = null

/**
 * Allows deterministic unit/integration testing of webhook fast-ACK and `retry_pending` outbox fallback (`T-029`).
 */
export function setWebhookInboundDispatcherForTests(
  dispatcher: WebhookInboundDispatchFn | null
): void {
  customWebhookDispatcher = dispatcher
}

async function enrichConversationPostRefAndCooldownAsync(
  payload: ProcessInboundWhatsappPayload
): Promise<ProcessInboundWhatsappPayload> {
  const detectedPostCode = payload.detectedPostCode ?? null
  let linkedApplicationId = payload.linkedApplicationId ?? null
  let outreachContactId = payload.outreachContactId ?? null

  try {
    const cooldownRes = await unlockOutreachCooldownForPhone(
      payload.senderPhone,
      payload.bodyText,
      payload.interactiveReplyId
    )
    if (cooldownRes.contactId && !outreachContactId) {
      outreachContactId = cooldownRes.contactId
    }
  } catch {
    // non-fatal enrichment
  }

  if (detectedPostCode) {
    try {
      const resolved = await resolvePostRefCode(detectedPostCode)
      if (resolved?.applicationId && !linkedApplicationId) {
        linkedApplicationId = resolved.applicationId
      }
    } catch {
      // non-fatal enrichment
    }
  }

  if (linkedApplicationId || outreachContactId) {
    await db
      .update(whatsappConversations)
      .set({
        ...(linkedApplicationId ? { applicationId: linkedApplicationId } : {}),
        ...(outreachContactId ? { outreachContactId } : {}),
      })
      .where(eq(whatsappConversations.id, payload.conversationId))
      .catch(() => null)
  }

  return {
    ...payload,
    detectedPostCode,
    linkedApplicationId,
    outreachContactId,
  }
}

export async function markInboundMessageRetryPending(
  messageId: string,
  errorMessage: string
): Promise<void> {
  const [existing] = await db
    .select({ rawPayload: whatsappMessages.rawPayload })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.id, messageId))
    .limit(1)

  const baseRaw =
    existing?.rawPayload && typeof existing.rawPayload === "object"
      ? (existing.rawPayload as Record<string, unknown>)
      : {}

  await db
    .update(whatsappMessages)
    .set({
      errorCode: "DISPATCH_RETRY_PENDING",
      errorMessage,
      rawPayload: {
        ...baseRaw,
        processingStatus: "retry_pending",
        dispatchFailedAt: new Date().toISOString(),
        dispatchError: errorMessage,
      },
    })
    .where(eq(whatsappMessages.id, messageId))
}

async function markInboundMessageCompleted(
  messageId: string,
  runId?: string
): Promise<void> {
  const [existing] = await db
    .select({ rawPayload: whatsappMessages.rawPayload })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.id, messageId))
    .limit(1)

  const baseRaw =
    existing?.rawPayload && typeof existing.rawPayload === "object"
      ? (existing.rawPayload as Record<string, unknown>)
      : {}

  await db
    .update(whatsappMessages)
    .set({
      errorCode: null,
      errorMessage: null,
      rawPayload: {
        ...baseRaw,
        processingStatus: "completed",
        ...(runId ? { triggerRunId: runId } : {}),
        processedAt: new Date().toISOString(),
      },
    })
    .where(eq(whatsappMessages.id, messageId))
}

/**
 * Non-blocking webhook dispatcher (`T-029`):
 * - Never executes R2 media downloads, OpenRouter AI classification, or Meta Graph API replies synchronously inside `POST /api/webhooks/whatsapp`.
 * - Dispatches immediately to Trigger.dev Cloud when `TRIGGER_SECRET_KEY` is configured (propagating dispatch errors so `route.ts` marks `retry_pending`).
 * - Schedules asynchronous next-tick execution in local non-Cloud environments so HTTP `200 OK` returns in `<150ms`.
 */
export async function dispatchProcessInboundWhatsapp(
  rawPayload: ProcessInboundWhatsappPayload
): Promise<WebhookDispatchResult> {
  const payload = processInboundWhatsappPayloadSchema.parse(rawPayload)

  if (customWebhookDispatcher) {
    return customWebhookDispatcher(payload)
  }

  if (isTriggerCloudConfigured()) {
    const rawKey = `wa-inbound-process-${payload.messageId}`
    let idemKey: string = rawKey
    try {
      idemKey = await idempotencyKeys.create(rawKey, { scope: "global" })
    } catch {
      idemKey = rawKey
    }

    const handle = await tasks.trigger("process-inbound-whatsapp", payload, {
      idempotencyKey: idemKey,
      tags: [
        `wa-inbound:${payload.messageId}`,
        `wa-conv:${payload.conversationId}`,
        `wa-msg:${payload.messageId}`,
      ],
    })

    // Fire-and-forget lightweight cooldown/post-ref enrichment without blocking HTTP response
    setTimeout(() => {
      void enrichConversationPostRefAndCooldownAsync(payload)
    }, 0)

    return {
      dispatched: true,
      mode: "cloud",
      runId: handle.id,
    }
  }

  // Local / non-Cloud mode: detach onto next event-loop tick so HTTP 200 ACK returns in <150ms
  const asyncRunId = `async_inbound_${payload.messageId}`
  setTimeout(() => {
    void (async () => {
      try {
        const enriched = await enrichConversationPostRefAndCooldownAsync(payload)
        const { runProcessInboundWhatsappInline } = await import(
          "@/trigger/process-inbound-whatsapp.task"
        )
        const result = await runProcessInboundWhatsappInline(enriched)
        if (!result.success) {
          await markInboundMessageRetryPending(
            payload.messageId,
            result.error || "Inline inbound processor returned success=false"
          )
          return
        }
        await markInboundMessageCompleted(payload.messageId, asyncRunId)
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Unhandled async inbound processing error"
        await markInboundMessageRetryPending(payload.messageId, msg).catch(
          () => null
        )
      }
    })()
  }, 0)

  return {
    dispatched: true,
    mode: "queued_async",
    runId: asyncRunId,
  }
}
