import { db, type DbOrTx } from "@/db"
import { auditLogs } from "@/db/schema/audit-logs"
import { logger, redactPii } from "./logger"
import { hashIp } from "./rate-limit"

export interface AuditLogInput {
  actorId?: string | null
  actorRole?: string | null
  action: string
  entityType: string
  entityId?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  ipAddress?: string | null
  ipHash?: string | null
  requestId?: string | null
}

function sanitizeJsonSnapshot(
  input: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!input) {
    return null
  }
  const redacted = redactPii(input)
  if (redacted && typeof redacted === "object" && !Array.isArray(redacted)) {
    return redacted as Record<string, unknown>
  }
  return null
}

/**
 * Appends an immutable forensic record to `audit_logs` (`T-009`).
 * Automatically scrubs secrets/tokens/OTPs from `before`/`after` snapshots and
 * hashes raw IP addresses so plaintext client IPs are not persisted in audit logs.
 */
export async function recordAuditLog(
  input: AuditLogInput,
  executor: DbOrTx = db
): Promise<string | null> {
  const action = input.action.trim().slice(0, 128)
  const entityType = input.entityType.trim().slice(0, 64)
  if (!action || !entityType) {
    throw new Error("recordAuditLog requires non-empty action and entityType.")
  }

  const computedIpHash =
    input.ipHash?.trim() ||
    (input.ipAddress ? hashIp(input.ipAddress) : null)

  try {
    const [inserted] = await executor
      .insert(auditLogs)
      .values({
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ? input.actorRole.slice(0, 32) : null,
        action,
        entityType,
        entityId: input.entityId ?? null,
        beforeJson: sanitizeJsonSnapshot(input.before),
        afterJson: sanitizeJsonSnapshot(input.after),
        ipHash: computedIpHash ? computedIpHash.slice(0, 64) : null,
        requestId: input.requestId ? input.requestId.slice(0, 64) : null,
      })
      .returning({ id: auditLogs.id })

    return inserted?.id ?? null
  } catch (err: unknown) {
    logger.error("Failed to append audit_logs row", {
      action,
      entityType,
      entityId: input.entityId ?? null,
      error: err,
    })
    return null
  }
}
