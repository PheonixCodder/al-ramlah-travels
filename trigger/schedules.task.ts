import { logger, schedules } from "@trigger.dev/sdk"
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm"
import { db } from "@/db"
import {
  applicationDocuments,
  applicationPayments,
  applicationQuotes,
  applications,
  applicationTravellers,
} from "@/db/schema/applications"
import { groupDepartures } from "@/db/schema/packages"
import {
  session as sessionTable,
  user as userTable,
  verification as verificationTable,
} from "@/db/schema/auth"
import { agencySettings } from "@/db/schema/settings"
import {
  scrubWhatsappRawPayload,
  whatsappConversations,
  whatsappLinkedDeviceSessions,
  whatsappMessages,
} from "@/db/schema/whatsapp-crm"
import { resolveAnchorReturnDateIso } from "@/lib/domain/pilgrim-documents"
import { sendTransactionalEmail } from "@/lib/security/mailer"
import { syncAllPublishedPostsAnalytics } from "@/lib/social/analytics"
import { refreshExpiringSocialTokens } from "@/lib/social/token-refresh"
import type { SocialProviderId } from "@/lib/social/types"
import { deleteR2Objects, type DeleteR2ObjectsResult } from "@/lib/storage/r2"
import { rethrowAsTaskError } from "@/trigger/errors"
import { updateTaskProgress } from "@/trigger/metadata"
import { scheduledMaintenanceQueue } from "@/trigger/queues"
import {
  runSweepDueSocialPosts,
  sweepDueSocialPostsSchedule,
} from "./publish-social-post.task"
import {
  runSweepDueWhatsappBroadcasts,
  sweepDueWhatsappBroadcastsSchedule,
} from "./send-whatsapp-broadcast.task"

export {
  runSweepDueSocialPosts,
  sweepDueSocialPostsSchedule,
  runSweepDueWhatsappBroadcasts,
  sweepDueWhatsappBroadcastsSchedule,
}

export interface ProactiveTokenRefreshItemResult {
  integrationId: string
  provider: SocialProviderId
  status:
    | "refreshed"
    | "deactivated_permanent_error"
    | "transient_error"
    | "skipped"
  newExpiresAt?: string | null
  error?: string
}

export interface ProactiveTokenRefreshSummary {
  checkedAt: string
  withinHours: number
  scannedCount: number
  checked: number
  refreshedCount: number
  refreshed: number
  deactivatedCount: number
  expiredCount: number
  transientErrorCount: number
  transientFailureCount: number
  failed: number
  skippedCount: number
  results: ProactiveTokenRefreshItemResult[]
  details: Array<{
    integrationId: string
    provider: string
    status: "refreshed" | "skipped" | "failed"
    error?: string
  }>
}

/**
 * Delegates proactive OAuth token renewal across Core 5 Social Integrations (`instagram`,
 * `facebook`, `tiktok`, `youtube`, `gmb`) to the single canonical `lib/social/token-refresh.ts`
 * engine (`T-074`, `A18-010`) — eliminating duplicated refresh logic.
 */
export async function runProactiveSocialTokenRefresh(options?: {
  withinHours?: number
}): Promise<ProactiveTokenRefreshSummary> {
  const withinHours = options?.withinHours ?? 24
  const checkedAt = new Date().toISOString()

  updateTaskProgress({
    taskType: "proactive-social-token-refresh",
    entityId: "system",
    stage: "initializing",
    progress: 15,
    detail: `Scanning social integrations expiring within ${withinHours}h`,
  })

  const batch = await refreshExpiringSocialTokens({ withinHours })

  const skippedCount = batch.results.filter(
    (r) => r.status === "skipped"
  ).length

  const mappedResults: ProactiveTokenRefreshItemResult[] = batch.results.map(
    (item) => ({
      integrationId: item.integrationId,
      provider: item.provider,
      status:
        item.status === "refreshed"
          ? "refreshed"
          : item.status === "expired"
            ? "deactivated_permanent_error"
            : item.status === "transient_failure"
              ? "transient_error"
              : "skipped",
      newExpiresAt: item.tokenExpiresAt ?? null,
      ...(item.error ? { error: item.error } : {}),
    })
  )

  updateTaskProgress({
    taskType: "proactive-social-token-refresh",
    entityId: "system",
    stage: "completed",
    progress: 100,
    detail: `Refreshed ${batch.refreshedCount}/${batch.scannedCount} expiring social tokens`,
    counters: {
      sent: batch.refreshedCount,
      failed: batch.expiredCount + batch.transientFailureCount,
      total: batch.scannedCount,
    },
  })

  return {
    checkedAt,
    withinHours,
    scannedCount: batch.scannedCount,
    checked: batch.scannedCount,
    refreshedCount: batch.refreshedCount,
    refreshed: batch.refreshedCount,
    deactivatedCount: batch.expiredCount,
    expiredCount: batch.expiredCount,
    transientErrorCount: batch.transientFailureCount,
    transientFailureCount: batch.transientFailureCount,
    failed: batch.expiredCount + batch.transientFailureCount,
    skippedCount,
    results: mappedResults,
    details: batch.results.map((item) => ({
      integrationId: item.integrationId,
      provider: item.provider,
      status:
        item.status === "refreshed"
          ? "refreshed"
          : item.status === "skipped"
            ? "skipped"
            : "failed",
      ...(item.error ? { error: item.error } : {}),
    })),
  }
}

export const runProactiveSocialTokenRefreshInline =
  runProactiveSocialTokenRefresh

/**
 * Scheduled Cron #1: Proactive Social OAuth Token Refresh (`T-074`, `OD-07`).
 * Runs every 6 hours in `Asia/Karachi` (`PRODUCTION` only, `concurrencyLimit: 1`) so Neon
 * can scale-to-zero between sweeps while keeping TikTok 24h & Google 1h refresh tokens healthy.
 */
export const proactiveSocialTokenRefreshSchedule = schedules.task({
  id: "proactive-social-token-refresh",
  cron: {
    pattern: "0 */6 * * *",
    timezone: "Asia/Karachi",
    environments: ["PRODUCTION"],
  },
  queue: scheduledMaintenanceQueue,
  maxDuration: 180,
  run: async (payload) => {
    logger.info("Running proactive social OAuth token refresh sweep", {
      timestamp: payload.timestamp.toISOString(),
    })

    try {
      const summary = await runProactiveSocialTokenRefresh({ withinHours: 24 })

      if (summary.transientFailureCount > 0 && summary.refreshed === 0) {
        throw new Error(
          `Transient OAuth token refresh failure across ${summary.transientFailureCount} integration(s)`
        )
      }

      logger.info("Completed proactive social OAuth token refresh", {
        scannedCount: summary.scannedCount,
        refreshedCount: summary.refreshedCount,
        expiredCount: summary.expiredCount,
        transientFailureCount: summary.transientFailureCount,
      })
      return summary
    } catch (error) {
      return rethrowAsTaskError(
        error,
        "Proactive social OAuth token refresh failed"
      )
    }
  },
})

/**
 * Scheduled Cron #2: Cross-Channel Social Analytics Sync (`T-074`, `OD-07`).
 * Runs 3 times daily during PKT business windows (`10:20`, `16:20`, `22:20` PKT, `PRODUCTION` only)
 * instead of every 2h 24/7 so Neon sleeps overnight.
 */
export const syncRecentSocialAnalyticsSchedule = schedules.task({
  id: "sync-recent-social-analytics",
  cron: {
    pattern: "20 10,16,22 * * *",
    timezone: "Asia/Karachi",
    environments: ["PRODUCTION"],
  },
  queue: scheduledMaintenanceQueue,
  maxDuration: 240,
  run: async () => {
    try {
      const result = await syncAllPublishedPostsAnalytics(25)
      logger.info("Synced cross-channel social post analytics", {
        syncedPostsCount: result.syncedPostsCount,
        syncedTargetsCount: result.syncedTargetsCount,
      })
      return {
        syncedPostsCount: result.syncedPostsCount,
        syncedTargetsCount: result.syncedTargetsCount,
        totalImpressions: result.overview.totalImpressions,
        totalEngagements: result.overview.totalEngagements,
      }
    } catch (error) {
      return rethrowAsTaskError(
        error,
        "Cross-channel social analytics sync failed"
      )
    }
  },
})

export interface SlaMonitorOptions {
  now?: Date
  slaHours?: number
  slaHoursOverride?: number
  /** Optional test filter scoping queries strictly to specific application UUIDs */
  applicationIdsFilter?: string[]
  sendEmailAlerts?: boolean
}

export interface SlaOverdueApplicationItem {
  id: string
  referenceNumber: string
  customerName: string
  customerPhone: string
  customerCity: string
  createdAt: string
  hoursWaiting: number
  newlyFlagged: boolean
}

export interface SlaOverdueQuoteMonitorSummary {
  checkedAt: string
  slaHours: number
  slaHoursThreshold: number
  overdueCount: number
  overdueUnquotedCount: number
  newlyFlaggedCount: number
  newlyFlagged: number
  flaggedRefs: string[]
  escalatedApplicationIds: string[]
  overdueApplications: SlaOverdueApplicationItem[]
}

export type SlaMonitorSummary = SlaOverdueQuoteMonitorSummary

/**
 * Evaluates unquoted Umrah/Hajj dossiers (`new` + `pending_quote` across BOTH web custom/group
 * builders and WhatsApp intake leads) that have exceeded `agency_settings.slaOverdueHours` (`T-074`).
 *
 * Key invariants (`A00-010`, `A08-011`, `A18-008`):
 * 1. Reads `agency_settings.slaOverdueHours` dynamically (default `24` hours).
 * 2. Selects leads where `quoteSentAt IS NULL` and NO `application_quotes` row has `quotedAt IS NOT NULL`
 *    (so web leads with an unsent v1 draft quote row `quotedAt = NULL` are NEVER skipped!).
 * 3. Stamps `applications.slaEscalatedAt = now` with **ZERO mutation to pilgrim-visible `specialRequests`**!
 */
export async function runSlaOverdueQuoteMonitor(
  options?: SlaMonitorOptions
): Promise<SlaOverdueQuoteMonitorSummary> {
  const now = options?.now ?? new Date()

  let slaHours = options?.slaHoursOverride ?? options?.slaHours
  if (slaHours === undefined) {
    const [settingsRow] = await db
      .select({ slaOverdueHours: agencySettings.slaOverdueHours })
      .from(agencySettings)
      .orderBy(desc(agencySettings.updatedAt))
      .limit(1)
    slaHours = settingsRow?.slaOverdueHours ?? 24
  }
  const effectiveSlaHours = Math.max(1, Math.trunc(slaHours))
  const cutoffDate = new Date(
    now.getTime() - effectiveSlaHours * 60 * 60 * 1000
  )

  if (
    options?.applicationIdsFilter &&
    options.applicationIdsFilter.length === 0
  ) {
    return {
      checkedAt: now.toISOString(),
      slaHours: effectiveSlaHours,
      slaHoursThreshold: effectiveSlaHours,
      overdueCount: 0,
      overdueUnquotedCount: 0,
      newlyFlaggedCount: 0,
      newlyFlagged: 0,
      flaggedRefs: [],
      escalatedApplicationIds: [],
      overdueApplications: [],
    }
  }

  const conditions = [
    sql`${applications.status}::text IN ('new', 'pending_quote')`,
    lte(applications.createdAt, cutoffDate),
    isNull(applications.quoteSentAt),
    sql`NOT EXISTS (
      SELECT 1
      FROM ${applicationQuotes} aq
      WHERE aq.application_id = ${applications.id}
        AND aq.quoted_at IS NOT NULL
    )`,
  ]

  if (options?.applicationIdsFilter && options.applicationIdsFilter.length > 0) {
    conditions.push(inArray(applications.id, options.applicationIdsFilter))
  }

  const overdueUnquoted = await db
    .select({
      id: applications.id,
      referenceNumber: applications.referenceNumber,
      customerName: applications.customerName,
      customerPhone: applications.customerPhone,
      customerCity: applications.customerCity,
      createdAt: applications.createdAt,
      slaEscalatedAt: applications.slaEscalatedAt,
    })
    .from(applications)
    .where(and(...conditions))
    .limit(200)

  let newlyFlagged = 0
  const flaggedRefs: string[] = []
  const escalatedApplicationIds: string[] = []
  const overdueApplications: SlaOverdueApplicationItem[] = []

  for (const app of overdueUnquoted) {
    const hoursWaiting =
      Math.round(
        ((now.getTime() - app.createdAt.getTime()) / (3600 * 1000)) * 10
      ) / 10

    let wasNewlyFlagged = false
    if (!app.slaEscalatedAt) {
      const updated = await db
        .update(applications)
        .set({
          slaEscalatedAt: now,
          updatedAt: now,
        })
        .where(
          and(eq(applications.id, app.id), isNull(applications.slaEscalatedAt))
        )
        .returning({ id: applications.id })

      if (updated.length > 0) {
        wasNewlyFlagged = true
        newlyFlagged++
        flaggedRefs.push(app.referenceNumber)
        escalatedApplicationIds.push(app.id)
      }
    }

    overdueApplications.push({
      id: app.id,
      referenceNumber: app.referenceNumber,
      customerName: app.customerName,
      customerPhone: app.customerPhone,
      customerCity: app.customerCity,
      createdAt: app.createdAt.toISOString(),
      hoursWaiting,
      newlyFlagged: wasNewlyFlagged,
    })
  }

  if (newlyFlagged > 0 && options?.sendEmailAlerts !== false) {
    try {
      const admins = await db
        .select({ email: userTable.email })
        .from(userTable)
        .where(
          and(
            eq(userTable.role, "super_admin"),
            eq(userTable.isActive, true)
          )
        )
        .limit(5)

      const recipientEmails = admins
        .map((a) => a.email?.trim())
        .filter((e): e is string => Boolean(e))

      if (recipientEmails.length > 0) {
        await sendTransactionalEmail({
          to: recipientEmails,
          subject: `[SLA Alert] ${newlyFlagged} unquoted pilgrim lead(s) exceeded ${effectiveSlaHours}h SLA`,
          html: `<p><strong>${newlyFlagged}</strong> pilgrim dossier(s) have exceeded the ${effectiveSlaHours}-hour quote SLA:</p><p>${flaggedRefs.join(", ")}</p>`,
          text: `${newlyFlagged} pilgrim dossier(s) exceeded the ${effectiveSlaHours}h quote SLA: ${flaggedRefs.join(", ")}`,
        })
      }
    } catch (mailErr) {
      logger.warn("Non-fatal SLA alert email notification warning", {
        error: mailErr instanceof Error ? mailErr.message : String(mailErr),
      })
    }
  }

  return {
    checkedAt: now.toISOString(),
    slaHours: effectiveSlaHours,
    slaHoursThreshold: effectiveSlaHours,
    overdueCount: overdueApplications.length,
    overdueUnquotedCount: overdueApplications.length,
    newlyFlaggedCount: newlyFlagged,
    newlyFlagged,
    flaggedRefs,
    escalatedApplicationIds,
    overdueApplications,
  }
}

export const runSlaOverdueQuoteMonitorInline = runSlaOverdueQuoteMonitor

/**
 * Scheduled Cron #3: SLA Overdue Quote Escalation Monitor (`T-074`, `OD-07`).
 * Runs hourly during PKT business hours (`09:05–23:05 PKT`, `PRODUCTION` only, `concurrencyLimit: 1`)
 * so Neon scales to zero overnight while ensuring prompt daytime SLA escalations.
 */
export const slaOverdueQuoteMonitorSchedule = schedules.task({
  id: "sla-overdue-quote-monitor",
  cron: {
    pattern: "5 9-23 * * *",
    timezone: "Asia/Karachi",
    environments: ["PRODUCTION"],
  },
  queue: scheduledMaintenanceQueue,
  maxDuration: 120,
  run: async () => {
    try {
      const summary = await runSlaOverdueQuoteMonitor()
      if (summary.newlyFlagged > 0) {
        logger.warn("Escalated overdue unquoted Umrah/Hajj dossiers", {
          slaHours: summary.slaHours,
          overdueCount: summary.overdueCount,
          newlyFlagged: summary.newlyFlagged,
          flaggedRefs: summary.flaggedRefs,
        })
      } else {
        logger.info("SLA check passed", {
          slaHours: summary.slaHours,
          overdueCount: summary.overdueCount,
        })
      }
      return summary
    } catch (error) {
      return rethrowAsTaskError(error, "SLA overdue quote monitor failed")
    }
  },
})

export interface PiiRetentionPurgeOptions {
  now?: Date
  /**
   * When `scopedOnly` is true (used in parallel DB integration tests), queries and mutations
   * are strictly restricted to the provided UUID lists so shared PG rows are never touched.
   */
  scopedOnly?: boolean
  scopedApplicationIds?: string[]
  scopedMessageIds?: string[]
  scopedSessionIds?: string[]
  scopedVerificationIds?: string[]
  scopedLinkedDeviceIds?: string[]
  deleteStorageObjects?: (
    keys: string[]
  ) => Promise<
    | DeleteR2ObjectsResult
    | { deletedCount: number; errors: Array<string | { key: string; message: string }> }
  >
}

export interface PiiRetentionPurgeSummary {
  executedAt: string
  passportMediaObjectsPurged: number
  whatsappMediaObjectsPurged: number
  deletedR2Keys: string[]
  unbookedLeadsRedacted: number
  rawPayloadsScrubbed: number
  expiredSessionsDeleted: number
  expiredVerificationsDeleted: number
  staleLinkedDevicesScrubbed: number
  r2DeleteErrors: string[]
}

export type PiiAndMediaRetentionPurgeSummary = PiiRetentionPurgeSummary

const DAY_MS = 24 * 60 * 60 * 1000
const PASSPORT_POST_RETURN_TTL_DAYS = 60
const UNBOOKED_LEAD_AND_WA_MEDIA_TTL_DAYS = 730 // 24 months per OD-06
const RAW_WEBHOOK_PAYLOAD_TTL_DAYS = 90
const STALE_DISCONNECTED_DEVICE_TTL_DAYS = 30

/**
 * Extracts a normalized Cloudflare R2 object key (`passports/...` or `whatsapp-media/...`)
 * from either a full HTTPS URL, `/api/media/...` proxy path, local `/uploads/r2-local/...` path, or bare key.
 */
export function extractRetentionR2Key(
  urlOrKey: string | null | undefined
): string | null {
  if (!urlOrKey) return null
  const trimmed = urlOrKey.trim()
  if (!trimmed) return null

  let candidate = trimmed
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed)
      candidate = decodeURIComponent(parsed.pathname).replace(/^\/+/, "")
    } catch {
      return null
    }
  } else if (trimmed.startsWith("/uploads/r2-local/")) {
    candidate = trimmed.slice("/uploads/r2-local/".length).replace(/^\/+/, "")
  } else if (trimmed.startsWith("/api/media/")) {
    candidate = decodeURIComponent(
      trimmed.slice("/api/media/".length).replace(/^\/+/, "")
    )
  } else {
    candidate = trimmed.replace(/^\/+/, "")
  }

  for (const prefix of ["passports/", "whatsapp-media/"]) {
    const idx = candidate.indexOf(prefix)
    if (idx === 0) {
      return candidate
    }
    if (idx > 0 && candidate[idx - 1] === "/") {
      return candidate.slice(idx)
    }
  }

  return null
}

function collectPassportKeysFromJson(value: unknown, bucket: Set<string>): void {
  if (!value) return
  if (typeof value === "string") {
    const key = extractRetentionR2Key(value)
    if (key && key.startsWith("passports/")) {
      bucket.add(key)
    }
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPassportKeysFromJson(item, bucket)
    }
    return
  }
  if (typeof value === "object") {
    for (const val of Object.values(value as Record<string, unknown>)) {
      collectPassportKeysFromJson(val, bucket)
    }
  }
}

function scrubPassportUrlsInJson(value: unknown): unknown {
  if (!value) return value
  if (typeof value === "string") {
    const key = extractRetentionR2Key(value)
    return key && key.startsWith("passports/") ? null : value
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubPassportUrlsInJson(item))
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubPassportUrlsInJson(v)
    }
    return out
  }
  return value
}

function normalizeDeleteStorageResult(
  raw:
    | DeleteR2ObjectsResult
    | { deletedCount: number; errors: Array<string | { key: string; message: string }> }
): { count: number; errorMessages: string[] } {
  const count = "deleted" in raw ? raw.deleted.length : raw.deletedCount
  const errorMessages = raw.errors.map((e) =>
    typeof e === "string" ? e : `${e.key}: ${e.message}`
  )
  return { count, errorMessages }
}

function analyzePortalDeleteResult(
  raw:
    | DeleteR2ObjectsResult
    | {
        deletedCount: number
        errors: Array<string | { key: string; message: string }>
      },
  attemptedKeys: readonly string[]
): {
  deletedCount: number
  deletedKeys: string[]
  failedKeys: Set<string>
  errorMessages: string[]
} {
  const failedKeys = new Set<string>()
  const errorMessages: string[] = []

  for (const err of raw.errors) {
    if (typeof err === "string") {
      errorMessages.push(err)
      for (const key of attemptedKeys) {
        if (err.includes(key)) {
          failedKeys.add(key)
        }
      }
    } else {
      errorMessages.push(`${err.key}: ${err.message}`)
      if (err.key) {
        failedKeys.add(err.key)
      }
    }
  }

  if ("deleted" in raw) {
    const deletedSet = new Set(raw.deleted)
    if (raw.errors.length > 0) {
      for (const key of attemptedKeys) {
        if (!deletedSet.has(key)) {
          failedKeys.add(key)
        }
      }
    }
    const deletedKeys = raw.deleted.filter((k) => !failedKeys.has(k))
    return {
      deletedCount: deletedKeys.length,
      deletedKeys,
      failedKeys,
      errorMessages,
    }
  }

  const deletedKeys = attemptedKeys.filter((k) => !failedKeys.has(k))
  return {
    deletedCount: Math.max(0, Math.min(raw.deletedCount, deletedKeys.length)),
    deletedKeys,
    failedKeys,
    errorMessages,
  }
}

/**
 * Enforces Owner Decision **`OD-06` Option A** PII & Media Retention Schedule (`T-074`, `A25-008`):
 *
 * 1. **`60 days` post-return** (`ksaDepartureDate <= now - 60d` or `passports/` media `>= 60d`):
 *    Deletes `passports/` R2 objects via `deleteR2Objects()` and clears stored URLs.
 * 2. **`24 months` (`730 days`) unbooked leads & `whatsapp-media/`**:
 *    Deletes expired `whatsapp-media/` R2 objects via `deleteR2Objects()` and anonymizes PII on
 *    unbooked applications (`status != 'approved'` and zero `application_payments`), while
 *    **strictly preserving `6 years` (`2190 days`)** booked `approved` dossiers, quotes, and
 *    `application_payments` tax/accounting ledgers.
 * 3. **`90 days` `whatsapp_messages.rawPayload` scrubbing**:
 *    Redacts PII via `scrubWhatsappRawPayload()` and stamps `payloadRedactedAt`.
 * 4. **Expired `session`, `verification`, and stale disconnected `whatsapp_linked_device_sessions` cleanup**.
 */
export async function runPiiAndMediaRetentionPurge(
  options?: PiiRetentionPurgeOptions
): Promise<PiiRetentionPurgeSummary> {
  const now = options?.now ?? new Date()
  const scopedOnly = Boolean(options?.scopedOnly)
  const deleteStorage = options?.deleteStorageObjects ?? deleteR2Objects

  const passportReturnCutoffDate = new Date(
    now.getTime() - PASSPORT_POST_RETURN_TTL_DAYS * DAY_MS
  )
  const passportReturnCutoffIso = passportReturnCutoffDate
    .toISOString()
    .slice(0, 10)
  const unbookedCutoffDate = new Date(
    now.getTime() - UNBOOKED_LEAD_AND_WA_MEDIA_TTL_DAYS * DAY_MS
  )
  const rawPayloadCutoffDate = new Date(
    now.getTime() - RAW_WEBHOOK_PAYLOAD_TTL_DAYS * DAY_MS
  )
  const staleDeviceCutoffDate = new Date(
    now.getTime() - STALE_DISCONNECTED_DEVICE_TTL_DAYS * DAY_MS
  )

  const passportKeysToDelete = new Set<string>()
  const waMediaKeysToDelete = new Set<string>()
  const r2DeleteErrors: string[] = []

  // ---------------------------------------------------------------------------
  // 1. 60-day post-return `passports/` R2 cleanup (`OD-06`)
  // ---------------------------------------------------------------------------
  const canQueryApps =
    !scopedOnly || (options?.scopedApplicationIds?.length ?? 0) > 0

  if (canQueryApps) {
    const returnedConditions = [
      isNotNull(applications.ksaDepartureDate),
      lte(applications.ksaDepartureDate, passportReturnCutoffIso),
    ]
    if (options?.scopedApplicationIds?.length) {
      returnedConditions.push(
        inArray(applications.id, options.scopedApplicationIds)
      )
    }

    const returnedApps = await db
      .select({
        id: applications.id,
        hajjInquiryJson: applications.hajjInquiryJson,
      })
      .from(applications)
      .where(and(...returnedConditions))
      .limit(300)

    for (const app of returnedApps) {
      const appPassportKeys = new Set<string>()
      collectPassportKeysFromJson(app.hajjInquiryJson, appPassportKeys)
      if (appPassportKeys.size > 0) {
        for (const k of appPassportKeys) {
          passportKeysToDelete.add(k)
        }
        await db
          .update(applications)
          .set({
            hajjInquiryJson: scrubPassportUrlsInJson(
              app.hajjInquiryJson
            ) as Record<string, unknown> | null,
            updatedAt: now,
          })
          .where(eq(applications.id, app.id))
      }

      const linkedMsgRows = await db
        .select({
          id: whatsappMessages.id,
          mediaUrl: whatsappMessages.mediaUrl,
        })
        .from(whatsappMessages)
        .innerJoin(
          whatsappConversations,
          eq(whatsappMessages.conversationId, whatsappConversations.id)
        )
        .where(
          and(
            eq(whatsappConversations.applicationId, app.id),
            isNotNull(whatsappMessages.mediaUrl)
          )
        )

      for (const msg of linkedMsgRows) {
        const key = extractRetentionR2Key(msg.mediaUrl)
        if (key && key.startsWith("passports/")) {
          passportKeysToDelete.add(key)
          await db
            .update(whatsappMessages)
            .set({ mediaUrl: null })
            .where(eq(whatsappMessages.id, msg.id))
        }
      }
    }
  }

  const canQueryMessages =
    !scopedOnly || (options?.scopedMessageIds?.length ?? 0) > 0

  if (canQueryMessages) {
    const expiredPassportMsgConditions = [
      isNotNull(whatsappMessages.mediaUrl),
      lte(whatsappMessages.createdAt, passportReturnCutoffDate),
    ]
    if (options?.scopedMessageIds?.length) {
      expiredPassportMsgConditions.push(
        inArray(whatsappMessages.id, options.scopedMessageIds)
      )
    }

    const candidatePassportMsgs = await db
      .select({
        id: whatsappMessages.id,
        mediaUrl: whatsappMessages.mediaUrl,
      })
      .from(whatsappMessages)
      .where(and(...expiredPassportMsgConditions))
      .limit(500)

    for (const msg of candidatePassportMsgs) {
      const key = extractRetentionR2Key(msg.mediaUrl)
      if (key && key.startsWith("passports/")) {
        passportKeysToDelete.add(key)
        await db
          .update(whatsappMessages)
          .set({ mediaUrl: null })
          .where(eq(whatsappMessages.id, msg.id))
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. 24-month (`730d`) `whatsapp-media/` R2 cleanup & unbooked lead PII redaction (`OD-06`)
  // ---------------------------------------------------------------------------
  if (canQueryMessages) {
    const oldMediaConditions = [
      isNotNull(whatsappMessages.mediaUrl),
      lte(whatsappMessages.createdAt, unbookedCutoffDate),
    ]
    if (options?.scopedMessageIds?.length) {
      oldMediaConditions.push(
        inArray(whatsappMessages.id, options.scopedMessageIds)
      )
    }

    const oldMediaMsgs = await db
      .select({
        id: whatsappMessages.id,
        mediaUrl: whatsappMessages.mediaUrl,
      })
      .from(whatsappMessages)
      .where(and(...oldMediaConditions))
      .limit(500)

    for (const msg of oldMediaMsgs) {
      const key = extractRetentionR2Key(msg.mediaUrl)
      if (key && key.startsWith("whatsapp-media/")) {
        waMediaKeysToDelete.add(key)
        await db
          .update(whatsappMessages)
          .set({ mediaUrl: null })
          .where(eq(whatsappMessages.id, msg.id))
      }
    }
  }

  let passportMediaObjectsPurged = 0
  let whatsappMediaObjectsPurged = 0
  const allR2Keys = [
    ...Array.from(passportKeysToDelete),
    ...Array.from(waMediaKeysToDelete),
  ]

  if (passportKeysToDelete.size > 0) {
    const res = normalizeDeleteStorageResult(
      await deleteStorage(Array.from(passportKeysToDelete))
    )
    passportMediaObjectsPurged = res.count
    r2DeleteErrors.push(...res.errorMessages)
  }

  // ---------------------------------------------------------------------------
  // 1b. Spec 0029: 60-day post-return `application_travellers` & `application_documents` purge (`AC-9`)
  // ---------------------------------------------------------------------------
  if (canQueryApps) {
    const decisionFallbackCutoffDate = new Date(now.getTime() - 150 * DAY_MS)
    const portalPurgeConditions = [
      sql`(
        EXISTS (
          SELECT 1 FROM ${applicationDocuments} ad
          WHERE ad.application_id = ${applications.id}
            AND ad.pii_purged_at IS NULL
        )
        OR EXISTS (
          SELECT 1 FROM ${applicationTravellers} atv
          WHERE atv.application_id = ${applications.id}
            AND atv.pii_purged_at IS NULL
        )
      )`,
      or(
        and(
          isNotNull(applications.ksaDepartureDate),
          lte(applications.ksaDepartureDate, passportReturnCutoffIso)
        ),
        and(
          isNull(applications.ksaDepartureDate),
          isNotNull(groupDepartures.returnDate),
          lte(groupDepartures.returnDate, passportReturnCutoffIso)
        ),
        and(
          isNull(applications.ksaDepartureDate),
          isNull(groupDepartures.returnDate),
          isNotNull(applications.ksaArrivalDate),
          lte(applications.ksaArrivalDate, passportReturnCutoffIso)
        ),
        and(
          isNull(applications.ksaDepartureDate),
          isNull(groupDepartures.returnDate),
          isNull(applications.ksaArrivalDate),
          sql`${applications.status}::text = 'approved'`,
          isNotNull(applications.decisionAt),
          lte(applications.decisionAt, decisionFallbackCutoffDate)
        )
      ),
    ]
    if (options?.scopedApplicationIds?.length) {
      portalPurgeConditions.push(
        inArray(applications.id, options.scopedApplicationIds)
      )
    }

    const candidatePortalApps = await db
      .select({
        id: applications.id,
        status: sql<string>`${applications.status}::text`,
        decisionAt: applications.decisionAt,
        ksaArrivalDate: applications.ksaArrivalDate,
        ksaDepartureDate: applications.ksaDepartureDate,
        totalKsaDays: applications.totalKsaDays,
        groupReturnDate: groupDepartures.returnDate,
      })
      .from(applications)
      .leftJoin(
        groupDepartures,
        eq(applications.groupDepartureId, groupDepartures.id)
      )
      .where(and(...portalPurgeConditions))
      .orderBy(asc(applications.ksaDepartureDate), asc(applications.createdAt))
      .limit(500)

    const eligiblePortalAppIds: string[] = []
    for (const app of candidatePortalApps) {
      const anchorReturnDateIso = resolveAnchorReturnDateIso({
        ksaDepartureDate: app.ksaDepartureDate,
        groupReturnDate: app.groupReturnDate,
        ksaArrivalDate: app.ksaArrivalDate,
        totalKsaDays: app.totalKsaDays,
      })
      const isReturnExpired =
        anchorReturnDateIso !== null &&
        anchorReturnDateIso <= passportReturnCutoffIso
      const isNullDateDecisionExpired =
        anchorReturnDateIso === null &&
        app.status === "approved" &&
        app.decisionAt !== null &&
        app.decisionAt <= decisionFallbackCutoffDate

      if (isReturnExpired || isNullDateDecisionExpired) {
        eligiblePortalAppIds.push(app.id)
      }
    }

    if (eligiblePortalAppIds.length > 0) {
      const unpurgedDocs = await db
        .select({
          id: applicationDocuments.id,
          travellerId: applicationDocuments.travellerId,
          storageKey: applicationDocuments.storageKey,
        })
        .from(applicationDocuments)
        .where(
          and(
            inArray(applicationDocuments.applicationId, eligiblePortalAppIds),
            isNull(applicationDocuments.piiPurgedAt)
          )
        )

      const portalStorageKeys = Array.from(
        new Set(
          unpurgedDocs
            .map((d) => d.storageKey?.trim() ?? "")
            .filter((k) => k.length > 0)
        )
      )

      const failedPortalKeys = new Set<string>()
      if (portalStorageKeys.length > 0) {
        try {
          const rawDeleteRes = await deleteStorage(portalStorageKeys)
          const analyzed = analyzePortalDeleteResult(
            rawDeleteRes,
            portalStorageKeys
          )
          passportMediaObjectsPurged += analyzed.deletedCount
          allR2Keys.push(...analyzed.deletedKeys)
          r2DeleteErrors.push(...analyzed.errorMessages)
          for (const fk of analyzed.failedKeys) {
            failedPortalKeys.add(fk)
          }
        } catch (deleteErr: unknown) {
          r2DeleteErrors.push(
            deleteErr instanceof Error
              ? deleteErr.message
              : "Failed to delete pilgrim passport media objects from storage"
          )
          for (const key of portalStorageKeys) {
            failedPortalKeys.add(key)
          }
        }
      }

      // Only scrub DB document rows whose R2 key was absent or deleted cleanly (`AC-9`)
      const scrubbableDocIds = unpurgedDocs
        .filter((d) => {
          const cleanKey = d.storageKey?.trim() ?? ""
          return !cleanKey || !failedPortalKeys.has(cleanKey)
        })
        .map((d) => d.id)

      if (scrubbableDocIds.length > 0) {
        await db
          .update(applicationDocuments)
          .set({
            storageKey: null,
            originalFilename: null,
            status: "purged",
            piiPurgedAt: now,
            updatedAt: now,
          })
          .where(inArray(applicationDocuments.id, scrubbableDocIds))
      }

      const [unpurgedTravellers, remainingUnpurgedDocs] = await Promise.all([
        db
          .select({ id: applicationTravellers.id })
          .from(applicationTravellers)
          .where(
            and(
              inArray(applicationTravellers.applicationId, eligiblePortalAppIds),
              isNull(applicationTravellers.piiPurgedAt)
            )
          ),
        db
          .select({ travellerId: applicationDocuments.travellerId })
          .from(applicationDocuments)
          .where(
            and(
              inArray(applicationDocuments.applicationId, eligiblePortalAppIds),
              isNull(applicationDocuments.piiPurgedAt)
            )
          ),
      ])

      const travellersWithPendingDocs = new Set(
        remainingUnpurgedDocs.map((d) => d.travellerId)
      )
      const scrubbableTravellerIds = unpurgedTravellers
        .map((t) => t.id)
        .filter((tid) => !travellersWithPendingDocs.has(tid))

      if (scrubbableTravellerIds.length > 0) {
        await db
          .update(applicationTravellers)
          .set({
            passportNumber: null,
            passportExpiryDate: null,
            nationalIdNumber: null,
            piiPurgedAt: now,
            updatedAt: now,
          })
          .where(inArray(applicationTravellers.id, scrubbableTravellerIds))
      }
    }
  }

  if (waMediaKeysToDelete.size > 0) {
    const res = normalizeDeleteStorageResult(
      await deleteStorage(Array.from(waMediaKeysToDelete))
    )
    whatsappMediaObjectsPurged = res.count
    r2DeleteErrors.push(...res.errorMessages)
  }

  let unbookedLeadsRedacted = 0
  if (canQueryApps) {
    const unbookedConditions = [
      lte(applications.createdAt, unbookedCutoffDate),
      sql`${applications.status}::text NOT IN ('approved')`,
      ne(applications.customerName, "[REDACTED EXPIRED LEAD]"),
      sql`NOT EXISTS (
        SELECT 1
        FROM ${applicationPayments} ap
        WHERE ap.application_id = ${applications.id}
      )`,
      sql`NOT EXISTS (
        SELECT 1
        FROM ${applicationQuotes} aq
        WHERE aq.application_id = ${applications.id}
          AND (aq.payment_status::text != 'unpaid' OR aq.amount_paid_pkr > 0)
      )`,
    ]
    if (options?.scopedApplicationIds?.length) {
      unbookedConditions.push(
        inArray(applications.id, options.scopedApplicationIds)
      )
    }

    const expiredUnbookedLeads = await db
      .select({ id: applications.id })
      .from(applications)
      .where(and(...unbookedConditions))
      .limit(300)

    if (expiredUnbookedLeads.length > 0) {
      const ids = expiredUnbookedLeads.map((r) => r.id)
      const redacted = await db
        .update(applications)
        .set({
          customerName: "[REDACTED EXPIRED LEAD]",
          customerPhone: "REDACTED",
          customerWhatsapp: "REDACTED",
          customerCity: "REDACTED",
          customerEmail: null,
          specialRequests: null,
          revisionNotesCustomer: null,
          hajjInquiryJson: null,
          updatedAt: now,
        })
        .where(inArray(applications.id, ids))
        .returning({ id: applications.id })
      unbookedLeadsRedacted = redacted.length
    }
  }

  // ---------------------------------------------------------------------------
  // 3. 90-day `whatsapp_messages.rawPayload` PII scrubbing (`OD-06`, `T-080`)
  // ---------------------------------------------------------------------------
  let rawPayloadsScrubbed = 0
  if (canQueryMessages) {
    const rawPayloadConditions = [
      isNotNull(whatsappMessages.rawPayload),
      isNull(whatsappMessages.payloadRedactedAt),
      lte(whatsappMessages.createdAt, rawPayloadCutoffDate),
    ]
    if (options?.scopedMessageIds?.length) {
      rawPayloadConditions.push(
        inArray(whatsappMessages.id, options.scopedMessageIds)
      )
    }

    const unredactedMsgs = await db
      .select({
        id: whatsappMessages.id,
        rawPayload: whatsappMessages.rawPayload,
      })
      .from(whatsappMessages)
      .where(and(...rawPayloadConditions))
      .limit(500)

    for (const row of unredactedMsgs) {
      const scrubbed = scrubWhatsappRawPayload(row.rawPayload)
      await db
        .update(whatsappMessages)
        .set({
          rawPayload: scrubbed,
          payloadRedactedAt: now,
        })
        .where(eq(whatsappMessages.id, row.id))
      rawPayloadsScrubbed++
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Expired `session`, `verification` & stale disconnected device credentials (`OD-06`)
  // ---------------------------------------------------------------------------
  let expiredSessionsDeleted = 0
  const canPurgeSessions =
    !scopedOnly || (options?.scopedSessionIds?.length ?? 0) > 0
  if (canPurgeSessions) {
    const sessionConditions = [lt(sessionTable.expiresAt, now)]
    if (options?.scopedSessionIds?.length) {
      sessionConditions.push(
        inArray(sessionTable.id, options.scopedSessionIds)
      )
    }
    const deletedSessions = await db
      .delete(sessionTable)
      .where(and(...sessionConditions))
      .returning({ id: sessionTable.id })
    expiredSessionsDeleted = deletedSessions.length
  }

  let expiredVerificationsDeleted = 0
  const canPurgeVerifications =
    !scopedOnly || (options?.scopedVerificationIds?.length ?? 0) > 0
  if (canPurgeVerifications) {
    const verificationConditions = [lt(verificationTable.expiresAt, now)]
    if (options?.scopedVerificationIds?.length) {
      verificationConditions.push(
        inArray(verificationTable.id, options.scopedVerificationIds)
      )
    }
    const deletedVerifications = await db
      .delete(verificationTable)
      .where(and(...verificationConditions))
      .returning({ id: verificationTable.id })
    expiredVerificationsDeleted = deletedVerifications.length
  }

  let staleLinkedDevicesScrubbed = 0
  const canPurgeDevices =
    !scopedOnly || (options?.scopedLinkedDeviceIds?.length ?? 0) > 0
  if (canPurgeDevices) {
    const deviceConditions = [
      eq(whatsappLinkedDeviceSessions.status, "disconnected"),
      lte(whatsappLinkedDeviceSessions.updatedAt, staleDeviceCutoffDate),
    ]
    if (options?.scopedLinkedDeviceIds?.length) {
      deviceConditions.push(
        inArray(whatsappLinkedDeviceSessions.id, options.scopedLinkedDeviceIds)
      )
    }
    const scrubbedDevices = await db
      .update(whatsappLinkedDeviceSessions)
      .set({
        qrDataUrl: null,
        pairingCode: null,
        encryptedAuthCreds: null,
        encryptedAuthKeys: null,
        updatedAt: now,
      })
      .where(and(...deviceConditions))
      .returning({ id: whatsappLinkedDeviceSessions.id })
    staleLinkedDevicesScrubbed = scrubbedDevices.length
  }

  return {
    executedAt: now.toISOString(),
    passportMediaObjectsPurged,
    whatsappMediaObjectsPurged,
    deletedR2Keys: allR2Keys,
    unbookedLeadsRedacted,
    rawPayloadsScrubbed,
    expiredSessionsDeleted,
    expiredVerificationsDeleted,
    staleLinkedDevicesScrubbed,
    r2DeleteErrors,
  }
}

export const runPiiAndMediaRetentionPurgeInline = runPiiAndMediaRetentionPurge

/**
 * Scheduled Cron #4: Nightly PII & Media Retention Purge (`T-074`, `OD-06`, `OD-07`).
 * Runs once nightly at `03:30 PKT` (`Asia/Karachi`, `PRODUCTION` only, `concurrencyLimit: 1`).
 */
export const piiAndMediaRetentionPurgeSchedule = schedules.task({
  id: "pii-and-media-retention-purge",
  cron: {
    pattern: "30 3 * * *",
    timezone: "Asia/Karachi",
    environments: ["PRODUCTION"],
  },
  queue: scheduledMaintenanceQueue,
  maxDuration: 240,
  run: async () => {
    try {
      const summary = await runPiiAndMediaRetentionPurge()
      logger.info("Completed nightly PII & media retention purge (OD-06)", {
        passportMediaObjectsPurged: summary.passportMediaObjectsPurged,
        whatsappMediaObjectsPurged: summary.whatsappMediaObjectsPurged,
        unbookedLeadsRedacted: summary.unbookedLeadsRedacted,
        rawPayloadsScrubbed: summary.rawPayloadsScrubbed,
        expiredSessionsDeleted: summary.expiredSessionsDeleted,
        expiredVerificationsDeleted: summary.expiredVerificationsDeleted,
      })
      return summary
    } catch (error) {
      return rethrowAsTaskError(
        error,
        "Nightly PII & media retention purge failed"
      )
    }
  },
})
