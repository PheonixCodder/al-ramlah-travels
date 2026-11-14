import { logger, schedules } from "@trigger.dev/sdk"
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm"
import { db } from "@/db"
import { applicationQuotes, applications } from "@/db/schema/applications"
import { socialIntegrations } from "@/db/schema/social-scheduler"
import { decryptToken, encryptToken } from "@/lib/social/crypto"
import { getSocialProvider } from "@/lib/social/providers"
import type { SocialProviderId } from "@/lib/social/types"
import { classifyTaskError } from "./errors"
import { updateTaskProgress } from "./metadata"
import {
  runSweepDueSocialPosts,
  sweepDueSocialPostsSchedule,
} from "./publish-social-post.task"
import {
  runSweepDueWhatsappBroadcasts,
  sweepDueWhatsappBroadcastsSchedule,
} from "./send-whatsapp-broadcast.task"

export interface ProactiveTokenRefreshItemResult {
  integrationId: string
  provider: SocialProviderId
  name: string
  status: "refreshed" | "deactivated_permanent_error" | "transient_error" | "skipped"
  newExpiresAt?: string | null
  error?: string
}

export interface ProactiveTokenRefreshSummary {
  checkedAt: string
  withinHours: number
  scannedCount: number
  refreshedCount: number
  deactivatedCount: number
  transientErrorCount: number
  skippedCount: number
  results: ProactiveTokenRefreshItemResult[]
}

function isPermanentOAuthRefreshError(error: unknown): boolean {
  const classification = classifyTaskError(error)
  if (!classification.retryable) {
    if (
      classification.reason.includes("oauth") ||
      classification.reason.includes("decryption") ||
      classification.statusCode === 400 ||
      classification.statusCode === 401 ||
      classification.statusCode === 403 ||
      classification.errorCode === 190
    ) {
      return true
    }
  }
  const msg =
    error instanceof Error ? error.message : String(error ?? "")
  return /\b(invalid_grant|OAuthException|token_revoked|invalid_client|unauthorized_client|code\s*[:=]?\s*190)\b/i.test(
    msg
  )
}

/**
 * Proactively refreshes active `socialIntegrations` whose `tokenExpiresAt` is within `withinHours` (default 24h).
 * Re-encrypts tokens with AES-256-GCM (`encryptToken`) and marks integrations `isActive: false` with
 * `metadata.reauthRequired = true` on permanent `invalid_grant` / `OAuthException 190` errors.
 */
export async function runProactiveSocialTokenRefresh(options?: {
  withinHours?: number
}): Promise<ProactiveTokenRefreshSummary> {
  const withinHours = options?.withinHours ?? 24
  const now = new Date()
  const threshold = new Date(now.getTime() + withinHours * 3600 * 1000)

  updateTaskProgress({
    stage: "initializing",
    progress: 10,
    detail: `Scanning social integrations expiring within ${withinHours}h`,
  })

  const expiringIntegrations = await db
    .select()
    .from(socialIntegrations)
    .where(
      and(
        eq(socialIntegrations.isActive, true),
        isNotNull(socialIntegrations.tokenExpiresAt),
        lte(socialIntegrations.tokenExpiresAt, threshold)
      )
    )

  logger.info(
    "[ProactiveSocialTokenRefresh] Found expiring social integrations",
    {
      withinHours,
      count: expiringIntegrations.length,
    }
  )

  const results: ProactiveTokenRefreshItemResult[] = []
  let refreshedCount = 0
  let deactivatedCount = 0
  let transientErrorCount = 0
  let skippedCount = 0

  for (let i = 0; i < expiringIntegrations.length; i++) {
    const integration = expiringIntegrations[i]!
    const provider = integration.provider as SocialProviderId

    try {
      const adapter = getSocialProvider(provider)
      if (!adapter.refreshAccessToken) {
        skippedCount++
        results.push({
          integrationId: integration.id,
          provider,
          name: integration.name,
          status: "skipped",
          error: "Provider adapter does not implement refreshAccessToken",
        })
        continue
      }

      // Meta (facebook / instagram) can exchange long-lived access tokens directly when refreshToken is null
      const rawTokenSource =
        integration.encryptedRefreshToken ||
        (provider === "facebook" || provider === "instagram"
          ? integration.encryptedAccessToken
          : null)

      if (!rawTokenSource) {
        skippedCount++
        results.push({
          integrationId: integration.id,
          provider,
          name: integration.name,
          status: "skipped",
          error: "No refresh token stored for integration",
        })
        continue
      }

      const decryptedSourceToken = decryptToken(rawTokenSource)
      const refreshed = await adapter.refreshAccessToken(decryptedSourceToken)

      const newEncryptedAccess = encryptToken(refreshed.accessToken)
      const newEncryptedRefresh = refreshed.refreshToken
        ? encryptToken(refreshed.refreshToken)
        : integration.encryptedRefreshToken
      const newExpiresAt = refreshed.expiresIn
        ? new Date(Date.now() + refreshed.expiresIn * 1000)
        : new Date(Date.now() + 60 * 86400 * 1000)

      const existingMeta =
        (integration.metadata as Record<string, unknown> | null) ?? {}
      const updatedMeta: Record<string, unknown> = {
        ...existingMeta,
        reauthRequired: false,
        lastProactiveRefreshAt: new Date().toISOString(),
      }
      delete updatedMeta.lastRefreshError
      delete updatedMeta.lastRefreshErrorAt

      await db
        .update(socialIntegrations)
        .set({
          encryptedAccessToken: newEncryptedAccess,
          encryptedRefreshToken: newEncryptedRefresh,
          tokenExpiresAt: newExpiresAt,
          metadata: updatedMeta,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(socialIntegrations.id, integration.id))

      refreshedCount++
      results.push({
        integrationId: integration.id,
        provider,
        name: integration.name,
        status: "refreshed",
        newExpiresAt: newExpiresAt.toISOString(),
      })
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : String(err ?? "Unknown refresh error")
      const existingMeta =
        (integration.metadata as Record<string, unknown> | null) ?? {}

      if (isPermanentOAuthRefreshError(err)) {
        logger.warn(
          "[ProactiveSocialTokenRefresh] Permanent OAuth failure; deactivating integration",
          {
            integrationId: integration.id,
            provider,
            error: errMsg,
          }
        )

        await db
          .update(socialIntegrations)
          .set({
            isActive: false,
            metadata: {
              ...existingMeta,
              reauthRequired: true,
              lastRefreshError: errMsg,
              lastRefreshErrorAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(socialIntegrations.id, integration.id))

        deactivatedCount++
        results.push({
          integrationId: integration.id,
          provider,
          name: integration.name,
          status: "deactivated_permanent_error",
          error: errMsg,
        })
      } else {
        logger.warn(
          "[ProactiveSocialTokenRefresh] Transient refresh error; keeping integration active",
          {
            integrationId: integration.id,
            provider,
            error: errMsg,
          }
        )

        await db
          .update(socialIntegrations)
          .set({
            metadata: {
              ...existingMeta,
              lastTransientRefreshWarning: errMsg,
              lastTransientRefreshAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(socialIntegrations.id, integration.id))

        transientErrorCount++
        results.push({
          integrationId: integration.id,
          provider,
          name: integration.name,
          status: "transient_error",
          error: errMsg,
        })
      }
    }

    const stepProgress = Math.min(
      95,
      Math.round(15 + ((i + 1) / Math.max(1, expiringIntegrations.length)) * 80)
    )
    updateTaskProgress({
      stage: "saving_records",
      progress: stepProgress,
      detail: `Processed ${i + 1}/${expiringIntegrations.length} expiring integrations`,
      counters: {
        sent: refreshedCount,
        failed: deactivatedCount + transientErrorCount,
        total: expiringIntegrations.length,
      },
    })
  }

  updateTaskProgress({
    stage: "completed",
    progress: 100,
    detail: `Refreshed ${refreshedCount}/${expiringIntegrations.length} expiring social tokens`,
    counters: {
      sent: refreshedCount,
      failed: deactivatedCount + transientErrorCount,
      total: expiringIntegrations.length,
    },
  })

  return {
    checkedAt: now.toISOString(),
    withinHours,
    scannedCount: expiringIntegrations.length,
    refreshedCount,
    deactivatedCount,
    transientErrorCount,
    skippedCount,
    results,
  }
}

export const runProactiveSocialTokenRefreshInline =
  runProactiveSocialTokenRefresh

/**
 * Declarative 6-hour cron schedule for proactive social OAuth token refresh (Asia/Karachi).
 */
export const proactiveSocialTokenRefreshSchedule = schedules.task({
  id: "proactive-social-token-refresh",
  cron: {
    pattern: "0 */6 * * *",
    timezone: "Asia/Karachi",
  },
  run: async () => runProactiveSocialTokenRefresh({ withinHours: 24 }),
})

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
  overdueCount: number
  newlyFlaggedCount: number
  overdueApplications: SlaOverdueApplicationItem[]
}

const SLA_MARKER = "[SLA-OVERDUE-24H]"

/**
 * Monitors unquoted customer applications older than `slaHours` (default 24h)
 * that have no `applicationQuotes` record, flagging them idempotently with `[SLA-OVERDUE-24H]`.
 */
export async function runSlaOverdueQuoteMonitor(options?: {
  slaHours?: number
}): Promise<SlaOverdueQuoteMonitorSummary> {
  const slaHours = options?.slaHours ?? 24
  const now = new Date()
  const cutoff = new Date(now.getTime() - slaHours * 3600 * 1000)

  updateTaskProgress({
    stage: "initializing",
    progress: 15,
    detail: `Scanning unquoted applications older than ${slaHours}h`,
  })

  const candidateApps = await db
    .select({
      id: applications.id,
      referenceNumber: applications.referenceNumber,
      customerName: applications.customerName,
      customerPhone: applications.customerPhone,
      customerCity: applications.customerCity,
      specialRequests: applications.specialRequests,
      quoteSentAt: applications.quoteSentAt,
      createdAt: applications.createdAt,
    })
    .from(applications)
    .where(
      and(
        eq(applications.status, "pending_quote"),
        lte(applications.createdAt, cutoff)
      )
    )

  if (candidateApps.length === 0) {
    updateTaskProgress({
      stage: "completed",
      progress: 100,
      detail: "No overdue unquoted applications detected",
      counters: { total: 0, sent: 0, failed: 0 },
    })

    return {
      checkedAt: now.toISOString(),
      slaHours,
      overdueCount: 0,
      newlyFlaggedCount: 0,
      overdueApplications: [],
    }
  }

  const candidateIds = candidateApps.map((a) => a.id)
  const existingQuotes = await db
    .select({
      applicationId: applicationQuotes.applicationId,
    })
    .from(applicationQuotes)
    .where(inArray(applicationQuotes.applicationId, candidateIds))

  const quotedAppIds = new Set(existingQuotes.map((q) => q.applicationId))

  const overdueApplications: SlaOverdueApplicationItem[] = []
  let newlyFlaggedCount = 0

  for (const app of candidateApps) {
    if (app.quoteSentAt || quotedAppIds.has(app.id)) {
      continue
    }

    const hoursWaiting = Math.round(
      ((now.getTime() - app.createdAt.getTime()) / (3600 * 1000)) * 10
    ) / 10

    const currentNotes = app.specialRequests ?? ""
    const alreadyFlagged = currentNotes.includes(SLA_MARKER)

    if (!alreadyFlagged) {
      const updatedNotes = currentNotes
        ? `${currentNotes}\n${SLA_MARKER} Escalated at ${now.toISOString()}`
        : `${SLA_MARKER} Escalated at ${now.toISOString()}`

      await db
        .update(applications)
        .set({
          specialRequests: updatedNotes,
          updatedAt: now,
        })
        .where(eq(applications.id, app.id))

      newlyFlaggedCount++
    }

    overdueApplications.push({
      id: app.id,
      referenceNumber: app.referenceNumber,
      customerName: app.customerName,
      customerPhone: app.customerPhone,
      customerCity: app.customerCity,
      createdAt: app.createdAt.toISOString(),
      hoursWaiting,
      newlyFlagged: !alreadyFlagged,
    })
  }

  logger.info("[SlaOverdueQuoteMonitor] Completed SLA overdue sweep", {
    slaHours,
    overdueCount: overdueApplications.length,
    newlyFlaggedCount,
  })

  updateTaskProgress({
    stage: "completed",
    progress: 100,
    detail: `Found ${overdueApplications.length} overdue applications (${newlyFlaggedCount} newly flagged)`,
    counters: {
      total: overdueApplications.length,
      sent: newlyFlaggedCount,
      failed: 0,
    },
  })

  return {
    checkedAt: now.toISOString(),
    slaHours,
    overdueCount: overdueApplications.length,
    newlyFlaggedCount,
    overdueApplications,
  }
}

export const runSlaOverdueQuoteMonitorInline = runSlaOverdueQuoteMonitor

/**
 * Declarative 30-minute cron schedule for 24h SLA overdue quote monitoring (Asia/Karachi).
 */
export const slaOverdueQuoteMonitorSchedule = schedules.task({
  id: "sla-overdue-quote-monitor",
  cron: {
    pattern: "*/30 * * * *",
    timezone: "Asia/Karachi",
  },
  run: async () => runSlaOverdueQuoteMonitor({ slaHours: 24 }),
})

