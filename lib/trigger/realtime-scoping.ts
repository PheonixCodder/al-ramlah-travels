import { eq, or, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { applications } from "@/db/schema/applications"
import { scheduledPosts } from "@/db/schema/social-scheduler"
import {
  postAssets,
  supplierFlyerPackages,
  supplierFlyers,
  suppliers,
} from "@/db/schema/suppliers-and-marketing"
import {
  whatsappAccounts,
  whatsappBroadcasts,
  whatsappConversations,
  whatsappMessages,
} from "@/db/schema/whatsapp-crm"
import type { Session } from "@/lib/auth"

/**
 * Strict lowercase tag format (`^[a-z0-9:_-]{3,120}$`) plus uppercase `ART-...`
 * reference/post codes strictly after `quotation-pdf:`, `spotlight-poster:`, `poster:`, or `pdf:` (`T-090`).
 */
const STRICT_LOWERCASE_TAG_REGEX = /^[a-z0-9:_-]{3,120}$/
const ART_REFERENCE_CODE_TAG_REGEX =
  /^(?:quotation-pdf|spotlight-poster|poster|pdf):ART-[A-Z0-9_-]{1,96}$/
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ALLOWED_REALTIME_TAG_PREFIXES = [
  "copilot:app:",
  "copilot:wa:",
  "quotation-pdf:",
  "pdf:",
  "flyer-multi-poster:",
  "flyer:",
  "spotlight-poster:",
  "poster:",
  "card:",
  "extract:",
  "social-post:",
  "whatsapp-group-campaign:",
  "campaign:",
  "wa-msg:",
  "wa-conv:",
  "wa-inbound:",
  "whatsapp-broadcast:",
  "whatsapp-broadcast-retry:",
  "broadcast:",
] as const

export const SUPER_ADMIN_ONLY_TAG_PREFIXES = [
  "whatsapp-broadcast:",
  "whatsapp-broadcast-retry:",
  "broadcast:",
] as const

/**
 * Only UI-observable durable tasks may have Realtime tokens minted or run outputs read (`A02-012`).
 * Internal maintenance crons (`proactive-social-token-refresh`, `pii-and-media-retention-purge`, etc.)
 * are blocked from client subscription.
 */
export const ALLOWED_OBSERVABLE_TASK_IDS = new Set<string>([
  "quoting-copilot",
  "render-gotenberg-asset",
  "extract-packages",
  "publish-social-post",
  "send-whatsapp-broadcast",
  "send-whatsapp-group-campaign",
  "mirror-whatsapp-media",
  "process-inbound-whatsapp",
])

export const realtimeRunIdSchema = z
  .string()
  .trim()
  .min(4, "Valid Trigger runId is required")
  .max(128, "Run ID exceeds maximum length")
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid runId format")
  .refine((val) => val.toLowerCase() !== "latest", {
    message: 'Unscoped "latest" run lookup is forbidden',
  })

export const batchRealtimeRunIdsSchema = z
  .array(realtimeRunIdSchema)
  .min(1, "At least one runId is required")
  .max(25, "At most 25 runIds can be authorized per batch")

export const listActiveRunsInputSchema = z.union([
  z.array(z.string().min(1)).min(1).max(10),
  z.object({
    tags: z.array(z.string().min(1)).min(1).max(10),
    limit: z.number().int().min(1).max(20).optional(),
  }),
])

/**
 * Validates that a Realtime tag matches `^[a-z0-9:_-]{3,120}$` (or an `ART-...` code on
 * `quotation-pdf:`/`spotlight-poster:`) AND begins with an allowlisted entity prefix (`T-090`).
 */
export function isValidRealtimeTagFormat(rawTag: string): boolean {
  const tag = rawTag.trim()
  if (tag.length < 3 || tag.length > 120) {
    return false
  }

  const matchesCharset =
    STRICT_LOWERCASE_TAG_REGEX.test(tag) ||
    ART_REFERENCE_CODE_TAG_REGEX.test(tag)

  if (!matchesCharset) {
    return false
  }

  const matchedPrefix = ALLOWED_REALTIME_TAG_PREFIXES.find((prefix) =>
    tag.startsWith(prefix)
  )
  if (!matchedPrefix) {
    return false
  }

  const entityRef = tag.slice(matchedPrefix.length)
  return entityRef.length >= 1 && !entityRef.includes(":")
}

export type TagAuthorizationResult =
  | { ok: true; normalizedTag: string; prefix: string; entityRef: string }
  | { ok: false; error: string }

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

/**
 * Verifies tag format, allowlisted prefix, role gates (`super_admin` required for broadcast tags),
 * AND PostgreSQL entity existence/ownership before minting a Trigger Realtime token (`T-090`).
 */
export async function verifyRealtimeTagAuthorization(
  rawTag: string,
  session: Pick<Session, "user">
): Promise<TagAuthorizationResult> {
  const tag = rawTag.trim()
  if (!isValidRealtimeTagFormat(tag)) {
    return {
      ok: false,
      error: `Forbidden: Invalid or unallowlisted realtime tag "${rawTag}"`,
    }
  }

  const matchedPrefix = ALLOWED_REALTIME_TAG_PREFIXES.find((prefix) =>
    tag.startsWith(prefix)
  )!
  const entityRef = tag.slice(matchedPrefix.length)
  const isSuperAdmin = session.user.role === "super_admin"

  if (
    SUPER_ADMIN_ONLY_TAG_PREFIXES.some((prefix) => matchedPrefix === prefix) &&
    !isSuperAdmin
  ) {
    return {
      ok: false,
      error:
        "Forbidden: Super Administrator privilege required for broadcast telemetry",
    }
  }

  switch (matchedPrefix) {
    case "copilot:app:": {
      if (!isUuid(entityRef)) {
        return { ok: false, error: "Invalid application UUID in copilot tag" }
      }
      const [appRow] = await db
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.id, entityRef))
        .limit(1)
      if (!appRow) {
        return {
          ok: false,
          error: "Forbidden: Referenced application does not exist",
        }
      }
      return { ok: true, normalizedTag: tag, prefix: matchedPrefix, entityRef }
    }

    case "copilot:wa:":
    case "wa-conv:": {
      if (!isUuid(entityRef)) {
        return {
          ok: false,
          error: "Invalid WhatsApp conversation UUID in tag",
        }
      }
      const [convRow] = await db
        .select({
          id: whatsappConversations.id,
          assignedUserId: whatsappConversations.assignedUserId,
        })
        .from(whatsappConversations)
        .where(eq(whatsappConversations.id, entityRef))
        .limit(1)
      if (!convRow) {
        return {
          ok: false,
          error: "Forbidden: Referenced WhatsApp conversation does not exist",
        }
      }
      return { ok: true, normalizedTag: tag, prefix: matchedPrefix, entityRef }
    }

    case "quotation-pdf:":
    case "pdf:": {
      const conditions = isUuid(entityRef)
        ? or(
            eq(applications.id, entityRef),
            sql`lower(${applications.referenceNumber}) = lower(${entityRef})`
          )
        : sql`lower(${applications.referenceNumber}) = lower(${entityRef})`

      const [appRow] = await db
        .select({ id: applications.id })
        .from(applications)
        .where(conditions)
        .limit(1)
      if (!appRow) {
        return {
          ok: false,
          error: "Forbidden: Referenced quotation dossier does not exist",
        }
      }
      return { ok: true, normalizedTag: tag, prefix: matchedPrefix, entityRef }
    }

    case "flyer-multi-poster:":
    case "flyer:": {
      if (!isUuid(entityRef)) {
        return { ok: false, error: "Invalid supplier flyer UUID in tag" }
      }
      const [flyerRow] = await db
        .select({ id: supplierFlyers.id })
        .from(supplierFlyers)
        .where(eq(supplierFlyers.id, entityRef))
        .limit(1)
      if (!flyerRow) {
        return {
          ok: false,
          error: "Forbidden: Referenced supplier flyer does not exist",
        }
      }
      return { ok: true, normalizedTag: tag, prefix: matchedPrefix, entityRef }
    }

    case "spotlight-poster:":
    case "poster:":
    case "card:": {
      if (isUuid(entityRef)) {
        const [assetRow] = await db
          .select({ id: postAssets.id })
          .from(postAssets)
          .where(eq(postAssets.id, entityRef))
          .limit(1)
        if (assetRow) {
          return {
            ok: true,
            normalizedTag: tag,
            prefix: matchedPrefix,
            entityRef,
          }
        }
      }

      const [pkgRow] = await db
        .select({ id: supplierFlyerPackages.id })
        .from(supplierFlyerPackages)
        .where(
          sql`lower(${supplierFlyerPackages.postCode}) = lower(${entityRef})`
        )
        .limit(1)
      if (pkgRow) {
        return {
          ok: true,
          normalizedTag: tag,
          prefix: matchedPrefix,
          entityRef,
        }
      }

      const [assetByCode] = await db
        .select({ id: postAssets.id })
        .from(postAssets)
        .where(sql`lower(${postAssets.postCode}) = lower(${entityRef})`)
        .limit(1)
      if (!assetByCode) {
        return {
          ok: false,
          error: "Forbidden: Referenced poster asset does not exist",
        }
      }
      return { ok: true, normalizedTag: tag, prefix: matchedPrefix, entityRef }
    }

    case "extract:": {
      if (isUuid(entityRef)) {
        const [flyerRow] = await db
          .select({ id: supplierFlyers.id })
          .from(supplierFlyers)
          .where(eq(supplierFlyers.id, entityRef))
          .limit(1)
        if (flyerRow) {
          return {
            ok: true,
            normalizedTag: tag,
            prefix: matchedPrefix,
            entityRef,
          }
        }
      }

      const [supplierRow] = await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.slug, entityRef))
        .limit(1)
      if (!supplierRow) {
        return {
          ok: false,
          error: "Forbidden: Referenced supplier does not exist",
        }
      }
      return { ok: true, normalizedTag: tag, prefix: matchedPrefix, entityRef }
    }

    case "social-post:": {
      if (!isUuid(entityRef)) {
        return { ok: false, error: "Invalid scheduled post UUID in tag" }
      }
      const [postRow] = await db
        .select({ id: scheduledPosts.id })
        .from(scheduledPosts)
        .where(eq(scheduledPosts.id, entityRef))
        .limit(1)
      if (!postRow) {
        return {
          ok: false,
          error: "Forbidden: Referenced scheduled post does not exist",
        }
      }
      return { ok: true, normalizedTag: tag, prefix: matchedPrefix, entityRef }
    }

    case "whatsapp-group-campaign:":
    case "campaign:": {
      if (!isUuid(entityRef)) {
        return { ok: false, error: "Invalid campaign asset UUID in tag" }
      }
      const [assetRow] = await db
        .select({ id: postAssets.id })
        .from(postAssets)
        .where(eq(postAssets.id, entityRef))
        .limit(1)
      if (assetRow) {
        return {
          ok: true,
          normalizedTag: tag,
          prefix: matchedPrefix,
          entityRef,
        }
      }
      const [postRow] = await db
        .select({ id: scheduledPosts.id })
        .from(scheduledPosts)
        .where(eq(scheduledPosts.id, entityRef))
        .limit(1)
      if (!postRow) {
        return {
          ok: false,
          error: "Forbidden: Referenced campaign entity does not exist",
        }
      }
      return { ok: true, normalizedTag: tag, prefix: matchedPrefix, entityRef }
    }

    case "wa-msg:": {
      if (!isUuid(entityRef)) {
        return { ok: false, error: "Invalid WhatsApp message UUID in tag" }
      }
      const [msgRow] = await db
        .select({ id: whatsappMessages.id })
        .from(whatsappMessages)
        .where(eq(whatsappMessages.id, entityRef))
        .limit(1)
      if (!msgRow) {
        return {
          ok: false,
          error: "Forbidden: Referenced WhatsApp message does not exist",
        }
      }
      return { ok: true, normalizedTag: tag, prefix: matchedPrefix, entityRef }
    }

    case "wa-inbound:": {
      if (!isUuid(entityRef)) {
        return { ok: false, error: "Invalid WhatsApp account UUID in tag" }
      }
      const [accRow] = await db
        .select({ id: whatsappAccounts.id })
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, entityRef))
        .limit(1)
      if (!accRow) {
        return {
          ok: false,
          error: "Forbidden: Referenced WhatsApp account does not exist",
        }
      }
      return { ok: true, normalizedTag: tag, prefix: matchedPrefix, entityRef }
    }

    case "whatsapp-broadcast:":
    case "whatsapp-broadcast-retry:":
    case "broadcast:": {
      if (!isUuid(entityRef)) {
        return { ok: false, error: "Invalid WhatsApp broadcast UUID in tag" }
      }
      const [bcastRow] = await db
        .select({ id: whatsappBroadcasts.id })
        .from(whatsappBroadcasts)
        .where(eq(whatsappBroadcasts.id, entityRef))
        .limit(1)
      if (!bcastRow) {
        return {
          ok: false,
          error: "Forbidden: Referenced WhatsApp broadcast does not exist",
        }
      }
      return { ok: true, normalizedTag: tag, prefix: matchedPrefix, entityRef }
    }

    default:
      return {
        ok: false,
        error: `Forbidden: Unrecognized realtime tag prefix "${matchedPrefix}"`,
      }
  }
}

export async function verifyRealtimeTagsBatchAuthorization(
  rawTags: string[],
  session: Pick<Session, "user">
): Promise<{ ok: true; validTags: string[] } | { ok: false; error: string }> {
  const validTags: string[] = []
  for (const rawTag of rawTags) {
    const check = await verifyRealtimeTagAuthorization(rawTag, session)
    if (!check.ok) {
      return { ok: false, error: check.error }
    }
    validTags.push(check.normalizedTag)
  }
  return { ok: true, validTags }
}
