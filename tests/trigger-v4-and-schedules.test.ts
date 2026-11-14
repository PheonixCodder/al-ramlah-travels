import "dotenv/config"
import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import { AbortTaskRunError } from "@trigger.dev/sdk"
import { db } from "../db"
import { decryptToken, encryptToken } from "../lib/social/crypto"
import { SOCIAL_PROVIDERS } from "../lib/social/providers"
import { MetaApiError } from "../lib/whatsapp/meta-api"
import {
  gotenbergQueue,
  whatsappBroadcastQueue,
  socialPublishQueue,
} from "../trigger/queues"
import {
  classifyTaskError,
  isNonRetryableTaskError,
  throwIfNonRetryable,
  rethrowAsTaskError,
} from "../trigger/errors"
import {
  updateTaskProgress,
  getLocalRunProgressSnapshot,
  setLocalRunProgressSnapshot,
  withLocalRunProgressScope,
} from "../trigger/metadata"
import {
  batchTriggerByIdOrInline,
  batchTriggerSocialPosts,
  setTriggerSdkForTests,
} from "../trigger/dispatch"
import {
  extractPackagesPayloadSchema,
  extractPackagesTask,
} from "../trigger/extract-packages.task"
import {
  publishSocialPostPayloadSchema,
  publishSocialPostTask,
  sweepDueSocialPostsSchedule,
} from "../trigger/publish-social-post.task"
import {
  sendWhatsAppBroadcastPayloadSchema,
  sendWhatsAppBroadcastTask,
  sweepDueWhatsappBroadcastsSchedule,
} from "../trigger/send-whatsapp-broadcast.task"
import {
  renderGotenbergAssetPayloadSchema,
  renderGotenbergAssetTask,
} from "../trigger/render-gotenberg-asset.task"
import {
  proactiveSocialTokenRefreshSchedule,
  slaOverdueQuoteMonitorSchedule,
  runProactiveSocialTokenRefresh,
  runSlaOverdueQuoteMonitor,
} from "../trigger/schedules.task"

describe("Spec 0012 — Trigger.dev v4 Hardening, Queues, Metadata & Cron Schedules", () => {
  // =========================================================================
  // AC-1: schemaTask Payload Validation
  // =========================================================================
  describe("AC-1: schemaTask Zod Payload Validation", () => {
    it("exposes schemaTask definitions with canonical task IDs", () => {
      assert.equal(extractPackagesTask.id, "extract-packages")
      assert.equal(publishSocialPostTask.id, "publish-social-post")
      assert.equal(sendWhatsAppBroadcastTask.id, "send-whatsapp-broadcast")
      assert.equal(renderGotenbergAssetTask.id, "render-gotenberg-asset")
    })

    it("extractPackagesPayloadSchema accepts valid multimodal and draft payloads and rejects invalid enums/types", () => {
      const validMultimodal = extractPackagesPayloadSchema.safeParse({
        mode: "multimodal",
        flyerId: "d2f8dc5c-9ec0-4332-8446-ad20768c1cf7",
        supplierId: "a0000000-0000-4000-8000-000000000001",
        rawFlyerUrl: "https://assets.alramlahtravels.com/flyers/sample.jpg",
        ingestionMode: "raw_supplier_flyer",
        commissionMode: "included_in_flyer",
        commissionPkr: 22000,
        renderSpotlights: true,
      })
      assert.equal(validMultimodal.success, true)

      const validDraft = extractPackagesPayloadSchema.safeParse({
        mode: "supplier_flyer_draft",
        presetKey: "ammaar_airblue_21d",
        mediaUrl: "https://assets.alramlahtravels.com/flyers/ammaar.jpg",
      })
      assert.equal(validDraft.success, true)

      const invalidMode = extractPackagesPayloadSchema.safeParse({
        mode: "invalid_extraction_mode",
      })
      assert.equal(invalidMode.success, false)

      const invalidCommission = extractPackagesPayloadSchema.safeParse({
        mode: "multimodal",
        commissionMode: "unsupported_commission_mode",
        commissionPkr: "not-a-number",
      })
      assert.equal(invalidCommission.success, false)
    })

    it("publishSocialPostPayloadSchema accepts non-empty scheduledPostId and rejects empty or missing values", () => {
      const valid = publishSocialPostPayloadSchema.safeParse({
        scheduledPostId: "post_01HXYZ",
      })
      assert.equal(valid.success, true)

      const invalidEmpty = publishSocialPostPayloadSchema.safeParse({
        scheduledPostId: "",
      })
      assert.equal(invalidEmpty.success, false)

      const invalidMissing = publishSocialPostPayloadSchema.safeParse({})
      assert.equal(invalidMissing.success, false)
    })

    it("sendWhatsAppBroadcastPayloadSchema validates broadcastId and optional paceMs bounds (0..10000)", () => {
      const validDefault = sendWhatsAppBroadcastPayloadSchema.safeParse({
        broadcastId: "bc_12345",
      })
      assert.equal(validDefault.success, true)

      const validWithPace = sendWhatsAppBroadcastPayloadSchema.safeParse({
        broadcastId: "bc_12345",
        paceMs: 250,
      })
      assert.equal(validWithPace.success, true)

      const invalidEmptyId = sendWhatsAppBroadcastPayloadSchema.safeParse({
        broadcastId: "",
      })
      assert.equal(invalidEmptyId.success, false)

      const invalidNegativePace = sendWhatsAppBroadcastPayloadSchema.safeParse({
        broadcastId: "bc_12345",
        paceMs: -50,
      })
      assert.equal(invalidNegativePace.success, false)

      const invalidExcessivePace = sendWhatsAppBroadcastPayloadSchema.safeParse({
        broadcastId: "bc_12345",
        paceMs: 25000,
      })
      assert.equal(invalidExcessivePace.success, false)
    })

    it("renderGotenbergAssetPayloadSchema validates discriminated union kinds and rejects malformed payloads", () => {
      const validQuotePdf = renderGotenbergAssetPayloadSchema.safeParse({
        kind: "quotation_pdf",
        applicationQuoteId: "quote_001",
        data: {
          referenceNumber: "ART-2026-0042",
          adults: 2,
          children: 1,
          infants: 0,
          airlineName: "Saudia",
          makkahHotelName: "Swissotel Makkah",
          makkahNights: 7,
          madinahHotelName: "Pullman Zamzam Madinah",
          madinahNights: 7,
          transportVehicleName: "GMC Yukon XL VIP",
          grandTotalPkr: 1450000,
        },
      })
      assert.equal(validQuotePdf.success, true)

      const validMultiPoster = renderGotenbergAssetPayloadSchema.safeParse({
        kind: "multi_poster",
        flyerId: "flyer_123",
        data: {
          postCode: "ART-AM-21D",
          airlineName: "Airblue",
          daysTitle: "21 DAYS UMRAH",
          routePill: "LHE - JED - LHE",
          packages: [{ cardNumber: "01", sharingPricePkr: 269899 }],
        },
      })
      assert.equal(validMultiPoster.success, true)

      const validSinglePoster = renderGotenbergAssetPayloadSchema.safeParse({
        kind: "single_poster",
        postAssetId: "asset_01",
        data: {
          cardNumber: "01",
          daysTitle: "15 DAYS UMRAH",
          routePill: "ISB - MED - JED - ISB",
          airlineName: "Saudia",
          outboundFlightNo: "SV 727",
          outboundDateLabel: "12 NOV",
          outboundRoute: "ISB - MED",
          outboundDepTime: "04:15",
          outboundArrTime: "08:05",
          returnFlightNo: "SV 726",
          returnDateLabel: "27 NOV",
          returnRoute: "JED - ISB",
          returnDepTime: "19:30",
          returnArrTime: "02:10",
          makkahNights: "08N",
          makkahHotelName: "Makkah Clock Royal Tower",
          makkahDistanceLabel: "(0M Shuttle/Clock Tower)",
          madinahNights: "06N",
          madinahHotelName: "Anwar Al Madinah Movenpick",
          madinahDistanceLabel: "(50MMarkazia)",
          sharingPricePkr: 310000,
          quadPricePkr: 325000,
          triplePricePkr: 355000,
          doublePricePkr: 410000,
        },
      })
      assert.equal(validSinglePoster.success, true)

      const invalidUnknownKind = renderGotenbergAssetPayloadSchema.safeParse({
        kind: "unknown_poster_kind",
        data: {},
      })
      assert.equal(invalidUnknownKind.success, false)

      const invalidEmptyMultiPackages =
        renderGotenbergAssetPayloadSchema.safeParse({
          kind: "multi_poster",
          data: {
            postCode: "ART-AM-21D",
            airlineName: "Airblue",
            daysTitle: "21 DAYS UMRAH",
            routePill: "LHE - JED - LHE",
            packages: [],
          },
        })
      assert.equal(invalidEmptyMultiPackages.success, false)
    })
  })

  // =========================================================================
  // AC-2: Non-Retryable Error Discrimination & AbortTaskRunError
  // =========================================================================
  describe("AC-2: classifyTaskError, isNonRetryableTaskError & throwIfNonRetryable", () => {
    it("throws AbortTaskRunError on permanent HTTP 400, 401, 403, 404, and 422 status errors", () => {
      for (const status of [400, 401, 403, 404, 422]) {
        const httpErr = Object.assign(new Error(`Upstream failed (${status})`), {
          status,
        })
        const classification = classifyTaskError(httpErr)
        assert.equal(classification.retryable, false)
        assert.equal(classification.statusCode, status)
        assert.equal(isNonRetryableTaskError(httpErr), true)

        assert.throws(
          () => throwIfNonRetryable(httpErr, `HttpTest_${status}`),
          (thrown: unknown) => {
            assert.ok(thrown instanceof AbortTaskRunError)
            assert.match(thrown.message, new RegExp(`HttpTest_${status}`))
            return true
          }
        )
      }
    })

    it("throws AbortTaskRunError on missing database records", () => {
      const missingRecordErr = new Error("Scheduled post post_999 not found")
      const classification = classifyTaskError(missingRecordErr)
      assert.equal(classification.retryable, false)
      assert.equal(classification.reason, "missing_database_record")
      assert.equal(isNonRetryableTaskError(missingRecordErr), true)

      assert.throws(
        () => throwIfNonRetryable(missingRecordErr, "PublishSocialPostTask"),
        (thrown: unknown) => thrown instanceof AbortTaskRunError
      )
    })

    it("throws AbortTaskRunError on AES-256-GCM decryption failures", () => {
      const decryptErr = new Error(
        "Decryption failed: Token authentication tag mismatch or corrupted ciphertext."
      )
      const classification = classifyTaskError(decryptErr)
      assert.equal(classification.retryable, false)
      assert.equal(classification.reason, "aes_gcm_decryption_failure")

      assert.throws(
        () => throwIfNonRetryable(decryptErr, "SendWhatsAppBroadcastTask.decrypt"),
        (thrown: unknown) => thrown instanceof AbortTaskRunError
      )
    })

    it("throws AbortTaskRunError on revoked OAuth (invalid_grant and OAuthException 190)", () => {
      const invalidGrantErr = new Error(
        "OAuth token refresh failed: invalid_grant - Token has been expired or revoked."
      )
      const grantClass = classifyTaskError(invalidGrantErr)
      assert.equal(grantClass.retryable, false)
      assert.equal(grantClass.reason, "oauth_token_revoked")
      assert.throws(
        () => throwIfNonRetryable(invalidGrantErr, "OAuthRefresh"),
        (thrown: unknown) => thrown instanceof AbortTaskRunError
      )

      const oauth190Err = new MetaApiError(
        "Error validating access token: Session has expired",
        {
          code: 190,
          type: "OAuthException",
          httpStatus: 401,
        }
      )
      const oauth190Class = classifyTaskError(oauth190Err)
      assert.equal(oauth190Class.retryable, false)
      assert.equal(oauth190Class.reason, "oauth_token_revoked_or_expired_190")
      assert.equal(oauth190Class.errorCode, 190)
      assert.throws(
        () => throwIfNonRetryable(oauth190Err, "MetaOAuth"),
        (thrown: unknown) => thrown instanceof AbortTaskRunError
      )
    })

    it("throws AbortTaskRunError on invalid Meta WhatsApp template code 132001", () => {
      const metaTemplateErr = new MetaApiError(
        "Template name does not exist in the translation",
        {
          code: 132001,
          type: "OAuthException",
          httpStatus: 404,
        }
      )
      const classification = classifyTaskError(metaTemplateErr)
      assert.equal(classification.retryable, false)
      assert.equal(classification.reason, "meta_invalid_template_132001")
      assert.equal(classification.errorCode, 132001)

      assert.throws(
        () => throwIfNonRetryable(metaTemplateErr, "SendWhatsAppBroadcastTask"),
        (thrown: unknown) => thrown instanceof AbortTaskRunError
      )
    })

    it("allows transient 429 rate-limit and 503 service-unavailable errors to retry without throwing AbortTaskRunError", () => {
      const rateLimit429 = Object.assign(
        new Error("HTTP 429 Too Many Requests - rate limit exceeded"),
        { status: 429 }
      )
      const class429 = classifyTaskError(rateLimit429)
      assert.equal(class429.retryable, true)
      assert.equal(isNonRetryableTaskError(rateLimit429), false)
      assert.doesNotThrow(() => throwIfNonRetryable(rateLimit429))

      const metaRateLimit = new MetaApiError("Cloud API rate limit hit", {
        code: 130429,
        type: "OAuthException",
        httpStatus: 429,
      })
      assert.equal(classifyTaskError(metaRateLimit).retryable, true)
      assert.doesNotThrow(() => throwIfNonRetryable(metaRateLimit))

      const gateway503 = Object.assign(
        new Error("Gotenberg Chromium render 503 Service Unavailable"),
        { statusCode: 503 }
      )
      const class503 = classifyTaskError(gateway503)
      assert.equal(class503.retryable, true)
      assert.equal(class503.statusCode, 503)
      assert.equal(isNonRetryableTaskError(gateway503), false)
      assert.doesNotThrow(() => throwIfNonRetryable(gateway503))

      // rethrowAsTaskError rethrows transient errors as normal Error (not AbortTaskRunError)
      assert.throws(
        () => rethrowAsTaskError(gateway503, "Gotenberg"),
        (thrown: unknown) =>
          thrown instanceof Error && !(thrown instanceof AbortTaskRunError)
      )
    })
  })

  // =========================================================================
  // AC-3: Dedicated Concurrency Queues
  // =========================================================================
  describe("AC-3: Dedicated Concurrency Queues in web/trigger/queues.ts", () => {
    it("configures gotenbergQueue (limit 2), whatsappBroadcastQueue (limit 1), and socialPublishQueue (limit 5)", () => {
      const getLimit = (q: unknown) => {
        const rec = q as {
          concurrencyLimit?: number
          options?: { concurrencyLimit?: number }
        }
        return rec.concurrencyLimit ?? rec.options?.concurrencyLimit
      }

      assert.equal(gotenbergQueue.name, "gotenberg-render-queue")
      assert.equal(getLimit(gotenbergQueue), 2)

      assert.equal(whatsappBroadcastQueue.name, "whatsapp-broadcast-queue")
      assert.equal(getLimit(whatsappBroadcastQueue), 1)

      assert.equal(socialPublishQueue.name, "social-publish-queue")
      assert.equal(getLimit(socialPublishQueue), 5)
    })
  })

  // =========================================================================
  // AC-4 & AC-5: Metadata Progress Telemetry, Scoped Local Store & Batch Fan-Out
  // =========================================================================
  describe("AC-4 & AC-5: updateTaskProgress, withLocalRunProgressScope & Batch Fan-Out", () => {
    const originalTriggerKey = process.env.TRIGGER_SECRET_KEY

    afterEach(() => {
      setTriggerSdkForTests(null)
      if (originalTriggerKey === undefined) {
        delete process.env.TRIGGER_SECRET_KEY
      } else {
        process.env.TRIGGER_SECRET_KEY = originalTriggerKey
      }
    })

    it("tracks stages (0%–100%), clamps bounds, and records domain counters inwithLocalRunProgressScope", async () => {
      const runId = "inline_extract-packages_test_001"

      await withLocalRunProgressScope(runId, async () => {
        const initSnap = updateTaskProgress({
          stage: "initializing",
          progress: -15, // should clamp to 0
          detail: "Starting extraction",
        })
        assert.equal(initSnap.progress, 0)
        assert.equal(initSnap.stage, "initializing")

        const midSnap = updateTaskProgress({
          stage: "sending_broadcast",
          progress: 55,
          detail: "Sending paced messages",
          sentCount: 11,
          failedCount: 1,
          totalRecipients: 20,
        })
        assert.equal(midSnap.progress, 55)
        assert.equal(midSnap.sentCount, 11)
        assert.equal(midSnap.failedCount, 1)
        assert.equal(midSnap.totalRecipients, 20)
        assert.equal(midSnap.counters?.sent, 11)
        assert.equal(midSnap.counters?.failed, 1)
        assert.equal(midSnap.counters?.total, 20)

        const doneSnap = updateTaskProgress({
          stage: "completed",
          progress: 140, // should clamp to 100
          detail: "Completed broadcast",
          sentCount: 19,
          failedCount: 1,
          totalRecipients: 20,
          completedTargets: 4,
          totalTargets: 4,
          extractedCount: 6,
          pdfUrl: "https://r2.example.com/sheet.pdf",
          pngUrl: "https://r2.example.com/sheet.png",
          socialJpegUrl: "https://r2.example.com/sheet.jpg",
        })
        assert.equal(doneSnap.progress, 100)
        assert.equal(doneSnap.stage, "completed")
      })

      const stored = getLocalRunProgressSnapshot(runId)
      assert.ok(stored)
      assert.equal(stored.stage, "completed")
      assert.equal(stored.progress, 100)
      assert.equal(stored.sentCount, 19)
      assert.equal(stored.failedCount, 1)
      assert.equal(stored.totalRecipients, 20)
      assert.equal(stored.completedTargets, 4)
      assert.equal(stored.extractedCount, 6)
      assert.equal(stored.pdfUrl, "https://r2.example.com/sheet.pdf")
      assert.equal(stored.pngUrl, "https://r2.example.com/sheet.png")
      assert.equal(stored.socialJpegUrl, "https://r2.example.com/sheet.jpg")

      setLocalRunProgressSnapshot("local_manual_snap", {
        stage: "rendering_gotenberg",
        progress: 75,
        label: "Rendering 4K PNG",
        detail: "Rendering 4K PNG",
        updatedAt: new Date().toISOString(),
      })
      const manualSnap = getLocalRunProgressSnapshot("local_manual_snap")
      assert.equal(manualSnap?.stage, "rendering_gotenberg")
      assert.equal(manualSnap?.progress, 75)
    })

    it("batchTriggerByIdOrInline and batchTriggerSocialPosts fan out via batchTrigger on Cloud and Promise.all inline locally", async () => {
      // 1. Cloud mode uses sdkTasks.batchTrigger
      process.env.TRIGGER_SECRET_KEY = "tr_prod_batch_test_key"
      let capturedTaskId = ""
      let capturedBatchCount = 0

      setTriggerSdkForTests({
        tasks: {
          trigger: (async () => ({ id: "run_single" })) as never,
          batchTrigger: (async (taskId: string, items: unknown[]) => {
            capturedTaskId = taskId
            capturedBatchCount = items.length
            return {
              batchId: "batch_cloud_01",
              runs: [{ id: "run_b1" }, { id: "run_b2" }],
            }
          }) as never,
        },
      })

      const cloudRes = await batchTriggerSocialPosts([
        { scheduledPostId: "post_A" },
        { scheduledPostId: "post_B" },
      ])
      assert.equal(cloudRes.mode, "cloud")
      assert.equal(cloudRes.success, true)
      assert.equal(capturedTaskId, "publish-social-post")
      assert.equal(capturedBatchCount, 2)
      assert.deepEqual(cloudRes.runIds, ["run_b1", "run_b2"])

      // 2. Local inline mode falls back to Promise.all with scoped progress tracking
      delete process.env.TRIGGER_SECRET_KEY
      setTriggerSdkForTests(null)

      const inlineRes = await batchTriggerByIdOrInline({
        taskId: "render-gotenberg-asset",
        items: [
          { payload: { card: "01" } },
          { payload: { card: "02" } },
        ],
        inlineRunner: async (payload) => {
          updateTaskProgress({
            stage: "completed",
            progress: 100,
            detail: `Rendered card ${payload.card}`,
          })
          return { rendered: payload.card }
        },
      })

      assert.equal(inlineRes.mode, "inline")
      assert.equal(inlineRes.success, true)
      assert.equal(inlineRes.runIds.length, 2)
      assert.deepEqual(inlineRes.outputs, [
        { rendered: "01" },
        { rendered: "02" },
      ])
      const firstRunSnap = getLocalRunProgressSnapshot(inlineRes.runIds[0]!)
      assert.equal(firstRunSnap?.stage, "completed")
      assert.equal(firstRunSnap?.progress, 100)
    })
  })

  // =========================================================================
  // AC-7: Declarative Cron Schedules & Inline Runner Behavior
  // =========================================================================
  describe("AC-7: proactiveSocialTokenRefreshSchedule & slaOverdueQuoteMonitorSchedule", () => {
    const originalDbSelect = db.select.bind(db)
    const originalDbUpdate = db.update.bind(db)
    const originalIgRefresh = SOCIAL_PROVIDERS.instagram.refreshAccessToken
    const originalTiktokRefresh = SOCIAL_PROVIDERS.tiktok.refreshAccessToken

    afterEach(() => {
      ;(db as unknown as { select: typeof db.select }).select = originalDbSelect
      ;(db as unknown as { update: typeof db.update }).update = originalDbUpdate
      SOCIAL_PROVIDERS.instagram.refreshAccessToken = originalIgRefresh
      SOCIAL_PROVIDERS.tiktok.refreshAccessToken = originalTiktokRefresh
    })

    it("defines declarative schedules.task exports with canonical IDs", () => {
      assert.equal(
        proactiveSocialTokenRefreshSchedule.id,
        "proactive-social-token-refresh"
      )
      assert.equal(
        slaOverdueQuoteMonitorSchedule.id,
        "sla-overdue-quote-monitor"
      )
      assert.equal(sweepDueSocialPostsSchedule.id, "sweep-due-social-posts")
      assert.equal(
        sweepDueWhatsappBroadcastsSchedule.id,
        "sweep-due-whatsapp-broadcasts"
      )
    })

    it("runProactiveSocialTokenRefresh refreshes expiring tokens, re-encrypts via AES-256-GCM, and deactivates integrations on permanent OAuth errors", async () => {
      const encryptedValidRefresh = encryptToken("rft_valid_ig_token")
      const encryptedRevokedRefresh = encryptToken("rft_revoked_tiktok_token")

      const mockIntegrations = [
        {
          id: "int_ig_1",
          provider: "instagram",
          name: "Al Ramlah Instagram",
          isActive: true,
          encryptedAccessToken: encryptToken("old_ig_access"),
          encryptedRefreshToken: encryptedValidRefresh,
          tokenExpiresAt: new Date(Date.now() + 2 * 3600 * 1000),
          metadata: {},
        },
        {
          id: "int_tt_2",
          provider: "tiktok",
          name: "Al Ramlah TikTok",
          isActive: true,
          encryptedAccessToken: encryptToken("old_tt_access"),
          encryptedRefreshToken: encryptedRevokedRefresh,
          tokenExpiresAt: new Date(Date.now() + 4 * 3600 * 1000),
          metadata: { handle: "@alramlahtravels" },
        },
      ]

      const dbUpdates: Array<Record<string, unknown>> = []

      ;(db as unknown as { select: unknown }).select = () => ({
        from: () => ({
          where: async () => mockIntegrations,
        }),
      })
      ;(db as unknown as { update: unknown }).update = () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            dbUpdates.push(values)
            return []
          },
        }),
      })

      SOCIAL_PROVIDERS.instagram.refreshAccessToken = async (
        refreshToken: string
      ) => {
        assert.equal(refreshToken, "rft_valid_ig_token")
        return {
          accessToken: "new_ig_access_token_2026",
          refreshToken: "new_ig_refresh_token_2026",
          expiresIn: 5184000,
          internalAccountId: "ig_acc_01",
          name: "Al Ramlah Instagram",
          scopes: ["instagram_basic", "instagram_content_publish"],
        }
      }

      SOCIAL_PROVIDERS.tiktok.refreshAccessToken = async () => {
        throw new Error(
          "OAuthException 190: invalid_grant - Token has been expired or revoked"
        )
      }

      const summary = await runProactiveSocialTokenRefresh({ withinHours: 24 })

      assert.equal(summary.scannedCount, 2)
      assert.equal(summary.refreshedCount, 1)
      assert.equal(summary.deactivatedCount, 1)
      assert.equal(summary.transientErrorCount, 0)
      assert.equal(dbUpdates.length, 2)

      // Verify first integration was refreshed and AES-256-GCM encrypted
      const refreshedUpdate = dbUpdates[0]!
      assert.equal(
        decryptToken(refreshedUpdate.encryptedAccessToken as string),
        "new_ig_access_token_2026"
      )
      assert.equal(
        decryptToken(refreshedUpdate.encryptedRefreshToken as string),
        "new_ig_refresh_token_2026"
      )
      assert.equal(
        (refreshedUpdate.metadata as Record<string, unknown>).reauthRequired,
        false
      )

      // Verify second integration was deactivated with metadata.reauthRequired = true
      const deactivatedUpdate = dbUpdates[1]!
      assert.equal(deactivatedUpdate.isActive, false)
      const deactMeta = deactivatedUpdate.metadata as Record<string, unknown>
      assert.equal(deactMeta.reauthRequired, true)
      assert.match(String(deactMeta.lastRefreshError), /invalid_grant/)
    })

    it("runSlaOverdueQuoteMonitor flags unquoted pending_quote applications older than 24h idempotently and skips quoted leads", async () => {
      const thirtyHoursAgo = new Date(Date.now() - 30 * 3600 * 1000)

      const mockCandidateApps = [
        {
          id: "app_overdue_unflagged",
          referenceNumber: "ART-2611-0001",
          customerName: "Tariq Mahmood",
          customerPhone: "+923001112233",
          customerCity: "Lahore",
          specialRequests: "Wheelchair assistance for mother",
          quoteSentAt: null,
          createdAt: thirtyHoursAgo,
        },
        {
          id: "app_overdue_already_flagged",
          referenceNumber: "ART-2611-0002",
          customerName: "Ayesha Siddiqui",
          customerPhone: "+923214445566",
          customerCity: "Islamabad",
          specialRequests: "[SLA-OVERDUE-24H] Escalated at 2026-11-06T12:00:00Z",
          quoteSentAt: null,
          createdAt: thirtyHoursAgo,
        },
        {
          id: "app_already_quoted",
          referenceNumber: "ART-2611-0003",
          customerName: "Zainab Khan",
          customerPhone: "+923337778899",
          customerCity: "Karachi",
          specialRequests: null,
          quoteSentAt: null,
          createdAt: thirtyHoursAgo,
        },
      ]

      let selectCallIndex = 0
      const updatedRecords: Array<Record<string, unknown>> = []

      ;(db as unknown as { select: unknown }).select = () => ({
        from: () => ({
          where: async () => {
            selectCallIndex++
            if (selectCallIndex === 1) {
              return mockCandidateApps
            }
            // Second select queries applicationQuotes
            return [{ applicationId: "app_already_quoted" }]
          },
        }),
      })
      ;(db as unknown as { update: unknown }).update = () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            updatedRecords.push(values)
            return []
          },
        }),
      })

      const summary = await runSlaOverdueQuoteMonitor({ slaHours: 24 })

      assert.equal(summary.slaHours, 24)
      assert.equal(summary.overdueCount, 2)
      assert.equal(summary.newlyFlaggedCount, 1)
      assert.equal(updatedRecords.length, 1)
      assert.match(
        String(updatedRecords[0]!.specialRequests),
        /\[SLA-OVERDUE-24H\]/
      )

      const unflaggedItem = summary.overdueApplications.find(
        (a) => a.id === "app_overdue_unflagged"
      )
      const alreadyFlaggedItem = summary.overdueApplications.find(
        (a) => a.id === "app_overdue_already_flagged"
      )
      assert.equal(unflaggedItem?.newlyFlagged, true)
      assert.equal(alreadyFlaggedItem?.newlyFlagged, false)
    })
  })
})
