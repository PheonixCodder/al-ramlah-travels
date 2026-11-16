import crypto from "node:crypto"
import { describe, it, afterEach, before, after } from "node:test"
import assert from "node:assert/strict"
import { eq, or, inArray, sql } from "drizzle-orm"
import { db } from "../db"
import {
  whatsappConversations,
  whatsappMessages,
} from "../db/schema/whatsapp-crm"
import {
  socialIntegrations,
  scheduledPosts,
  scheduledPostTargets,
} from "../db/schema/social-scheduler"
import { encryptToken } from "../lib/social/crypto"

import {
  processInboundWhatsappPayloadSchema,
  processInboundWhatsappTask,
  runProcessInboundWhatsappInline,
  type ProcessInboundWhatsappPayload,
} from "../trigger/process-inbound-whatsapp.task"

import {
  dispatchInboundWhatsAppProcessing,
  normalizeDispatchOptions,
  setTriggerDispatchTransportForTests,
  setTriggerSdkForTests,
} from "../trigger/dispatch"

import {
  recordLocalRunTags,
  getLocalActiveRunsByTags,
  getLocalRunProgressSnapshot,
  setLocalRunProgressSnapshot,
} from "../trigger/metadata"

import {
  COPILOT_STAGES,
} from "../components/admin/desk/copilot-realtime-run-banner"

import {
  dispatchViaSocialBridge,
  dispatchViaWhatsAppBridge,
  type SocialBridgeDispatchInput,
  type WhatsAppBridgeDispatchInput,
} from "../lib/bridges/marketing-bridges"

import {
  buildDeterministicWaCopilotDraft,
  buildDeterministicApplicationQuoteCopilotDraft,
  normalizeCopilotQuoteWorksheet,
  calculateQuoteWorksheetHints,
  waConversationCopilotInputSchema,
  applicationQuoteCopilotInputSchema,
} from "../lib/ai/quoting-copilot"

const SAMPLE_UUID_1 = "11111111-2222-4333-8444-555555555555"
const SAMPLE_UUID_2 = "22222222-3333-4444-8555-666666666666"
const SAMPLE_UUID_3 = "33333333-4444-4555-8666-777777777777"

describe("Spec 0018 / Slice 37 — Trigger.dev v4 Async Webhook & Realtime Copilot", () => {
  const originalKey = process.env.TRIGGER_SECRET_KEY

  afterEach(() => {
    setTriggerSdkForTests(null)
    setTriggerDispatchTransportForTests(null)
    if (originalKey === undefined) {
      delete process.env.TRIGGER_SECRET_KEY
    } else {
      process.env.TRIGGER_SECRET_KEY = originalKey
    }
  })

  // =========================================================================
  // AC-1: process-inbound-whatsapp schemaTask & Payload Validation
  // =========================================================================
  describe("AC-1: process-inbound-whatsapp schemaTask & Payload Validation", () => {
    it("exposes the canonical task id 'process-inbound-whatsapp'", () => {
      assert.equal(processInboundWhatsappTask.id, "process-inbound-whatsapp")
    })

    it("validates valid inbound WhatsApp text payload", () => {
      const validText = {
        messageId: SAMPLE_UUID_1,
        conversationId: SAMPLE_UUID_2,
        accountId: SAMPLE_UUID_3,
        senderPhone: "923001234567",
        wamid: "wamid.HBgLOTIzMDAxMjM0NTY3FQIAEhgg",
        bodyText: "Assalam-o-Alaikum, I need Umrah package details for 4 pax in November",
        msgType: "text",
      }

      const parsed = processInboundWhatsappPayloadSchema.safeParse(validText)
      assert.equal(parsed.success, true)
      if (parsed.success) {
        assert.equal(parsed.data.messageId, SAMPLE_UUID_1)
        assert.equal(parsed.data.rawMediaId, undefined)
      }
    })

    it("validates inbound WhatsApp media payload with rawMediaId and mimeType", () => {
      const validMedia: ProcessInboundWhatsappPayload = {
        messageId: SAMPLE_UUID_1,
        conversationId: SAMPLE_UUID_2,
        accountId: SAMPLE_UUID_3,
        senderPhone: "923001234567",
        wamid: "wamid.HBgLOTIzMDAxMjM0NTY3FQIAEhggMEDIA",
        bodyText: "Passport copy for visa verification",
        msgType: "image",
        rawMediaId: "media_waba_upload_98765",
        mediaMimeType: "image/jpeg",
      }

      const parsed = processInboundWhatsappPayloadSchema.safeParse(validMedia)
      assert.equal(parsed.success, true)
      if (parsed.success) {
        assert.equal(parsed.data.rawMediaId, "media_waba_upload_98765")
        assert.equal(parsed.data.msgType, "image")
        assert.equal(parsed.data.mediaMimeType, "image/jpeg")
      }
    })

    it("rejects invalid payloads with missing messageId or invalid UUIDs", () => {
      const invalidPayload = {
        messageId: "",
        conversationId: SAMPLE_UUID_2,
        accountId: SAMPLE_UUID_3,
        senderPhone: "923001234567",
      }

      const parsed = processInboundWhatsappPayloadSchema.safeParse(invalidPayload)
      assert.equal(parsed.success, false)
    })

    it("runProcessInboundWhatsappInline executes 4 stages and returns success", async () => {
      const payload: ProcessInboundWhatsappPayload = {
        messageId: SAMPLE_UUID_1,
        conversationId: SAMPLE_UUID_2,
        accountId: SAMPLE_UUID_3,
        senderPhone: "923001234567",
        wamid: "wamid.HBgLOTIzMDAxMjM0NTY3FQIAEhggINLINE",
        bodyText: "Looking for Umrah packages ART-786",
        msgType: "text",
      }

      const result = await runProcessInboundWhatsappInline(payload)
      assert.equal(result.success, true)
      assert.equal(result.messageId, SAMPLE_UUID_1)

      // Verify that progress was recorded to completed 100%
      const snapshot = getLocalRunProgressSnapshot(SAMPLE_UUID_1)
      assert.ok(snapshot)
      assert.equal(snapshot.stage, "completed")
      assert.equal(snapshot.progress, 100)
    })
  })

  // =========================================================================
  // AC-2: Zero-Timeout Webhook Decoupling (<150ms Response)
  // =========================================================================
  describe("AC-2: Zero-Timeout Webhook Decoupling (<150ms Response)", () => {
    it("dispatchInboundWhatsAppProcessing returns immediately without blocking on processing", async () => {
      process.env.TRIGGER_SECRET_KEY = "tr_prod_mock_key"
      setTriggerDispatchTransportForTests({
        trigger: async () => ({ id: "run_wa_immediate_123" }),
        triggerAndWait: async () => ({
          ok: true,
          id: "run_wa_immediate_123",
          output: {},
        }),
        batchTrigger: async () => ({ runs: [] }),
        createPublicToken: async () => "pub_tok_mock_123",
      })

      const startTime = Date.now()

      const payload: ProcessInboundWhatsappPayload = {
        messageId: SAMPLE_UUID_1,
        conversationId: SAMPLE_UUID_2,
        accountId: SAMPLE_UUID_3,
        senderPhone: "923001234567",
        wamid: "wamid.HBgLOTIzMDAxMjM0NTY3FQIAEhggDISPATCH",
        bodyText: "Testing webhook decoupling speed",
        msgType: "text",
      }

      const dispatchResult = await dispatchInboundWhatsAppProcessing(payload)
      const durationMs = Date.now() - startTime

      assert.equal(dispatchResult.success, true)
      assert.equal(dispatchResult.runId, "run_wa_immediate_123")
      assert.equal(dispatchResult.mode, "cloud")
      // Must complete well under 150ms
      assert.ok(durationMs < 150, `Dispatch took ${durationMs}ms, should be <150ms`)
    })

    it("dispatchInboundWhatsAppProcessing triggers cloud task when configured", async () => {
      process.env.TRIGGER_SECRET_KEY = "tr_prod_test_webhook_key"

      let cloudTriggered = false
      let triggeredTaskId: string | null = null
      let triggeredOptions: Record<string, unknown> | null = null

      setTriggerDispatchTransportForTests({
        trigger: async (
          taskId: string,
          _payload: unknown,
          options?: Record<string, unknown>
        ) => {
          cloudTriggered = true
          triggeredTaskId = taskId
          triggeredOptions = options ?? null
          return { id: "run_wa_inbound_cloud_123" }
        },
        triggerAndWait: async () => ({
          ok: true,
          id: "run_wa_inbound_cloud_123",
          output: {},
        }),
        batchTrigger: async () => ({ runs: [] }),
        createPublicToken: async () => "pub_tok_mock_456",
      })

      const payload: ProcessInboundWhatsappPayload = {
        messageId: SAMPLE_UUID_1,
        conversationId: SAMPLE_UUID_2,
        accountId: SAMPLE_UUID_3,
        senderPhone: "923001234567",
        wamid: "wamid.HBgLOTIzMDAxMjM0NTY3FQIAEhggCLOUD",
        bodyText: "Testing cloud trigger",
        msgType: "text",
      }

      const res = await dispatchInboundWhatsAppProcessing(payload)

      assert.equal(cloudTriggered, true)
      assert.equal(triggeredTaskId, "process-inbound-whatsapp")
      assert.equal(res.mode, "cloud")
      assert.equal(res.runId, "run_wa_inbound_cloud_123")
      assert.ok(triggeredOptions)
      const tags = Array.isArray(triggeredOptions.tags)
        ? (triggeredOptions.tags as string[])
        : []
      assert.ok(tags.includes(`wa-msg:${SAMPLE_UUID_1}`))
    })
  })

  // =========================================================================
  // AC-3: Global Broadcast Idempotency Keys
  // =========================================================================
  describe("AC-3: Global Broadcast Idempotency Keys", () => {
    it("normalizeDispatchOptions converts string idempotencyKey to global 64-char hash when cloud is active", async () => {
      process.env.TRIGGER_SECRET_KEY = "tr_prod_live_scope_test"

      const rawOptions = {
        idempotencyKey: "wa-broadcast-batch-101",
        tags: ["broadcast:batch-101"],
        concurrencyKey: "waba-phone-1",
      }

      const normalized = await normalizeDispatchOptions(rawOptions)
      assert.ok(normalized)
      assert.ok(normalized.idempotencyKey)
      // When idempotencyKeys.create is called with { scope: "global" }, a 64-char SHA-256 hash is generated
      assert.equal(typeof normalized.idempotencyKey, "string")
      assert.equal((normalized.idempotencyKey as string).length, 64)
    })

    it("normalizeDispatchOptions preserves existing idempotencyKey object with global scope", async () => {
      process.env.TRIGGER_SECRET_KEY = "tr_prod_live_scope_test"

      const existingKey = { key: "custom-global-key", scope: "global" as const }
      const normalized = await normalizeDispatchOptions({
        idempotencyKey: existingKey as unknown as string,
      })

      assert.ok(normalized)
      assert.deepEqual(normalized.idempotencyKey, existingKey)
    })
  })

  // =========================================================================
  // AC-4: Tag-Based Active Run Rehydration
  // =========================================================================
  describe("AC-4: Tag-Based Active Run Rehydration", () => {
    it("recordLocalRunTags and getLocalActiveRunsByTags store and query runs by tag in local mode", () => {
      const runId = "inline_quoting-copilot_test_active"
      const tags = ["copilot:wa:conv-123", "conversation:conv-123"]

      recordLocalRunTags(runId, tags)
      setLocalRunProgressSnapshot(runId, {
        stage: "running_domain_tools",
        progress: 40,
        label: "Querying Rates, Batches & Hotels",
        detail: "Querying Rates, Batches & Hotels",
        updatedAt: new Date().toISOString(),
      })

      // Query by exact tag
      const matched = getLocalActiveRunsByTags(["copilot:wa:conv-123"])
      assert.ok(matched.length > 0)
      const found = matched.find((r) => r.runId === runId)
      assert.ok(found)
      assert.equal(found.taskIdentifier, "quoting-copilot")
      assert.ok(found.tags.includes("copilot:wa:conv-123"))
      assert.equal(
        (found.metadata as Record<string, unknown> | undefined)?.stage,
        "running_domain_tools"
      )

      // Query by non-matching tag returns empty
      const nonMatched = getLocalActiveRunsByTags(["copilot:wa:conv-999"])
      const nonFound = nonMatched.find((r) => r.runId === runId)
      assert.equal(nonFound, undefined)
    })
  })

  // =========================================================================
  // AC-5: Non-Blocking Realtime Copilot & Luxury PDF Action Validation
  // =========================================================================
  describe("AC-5: Non-Blocking Realtime Copilot & Luxury PDF Action Validation", () => {
    it("waConversationCopilotInputSchema parses object conversationId and rejects bare strings", () => {
      const validUuid = "11111111-2222-4333-8444-555555555555"
      const fromObj = waConversationCopilotInputSchema.parse({
        conversationId: validUuid,
        staffPromptHint: "Focus on 5-star quad sharing",
      })
      assert.equal(fromObj.conversationId, validUuid)
      assert.equal(fromObj.staffPromptHint, "Focus on 5-star quad sharing")

      assert.equal(
        waConversationCopilotInputSchema.safeParse("conv-123").success,
        false
      )
    })

    it("applicationQuoteCopilotInputSchema parses object applicationId and rejects bare strings", () => {
      const validUuid = "22222222-3333-4444-8555-666666666666"
      const fromObj = applicationQuoteCopilotInputSchema.parse({
        applicationId: validUuid,
        staffPromptHint: "Include Makkah Clock Tower",
      })
      assert.equal(fromObj.applicationId, validUuid)
      assert.equal(fromObj.staffPromptHint, "Include Makkah Clock Tower")

      assert.equal(
        applicationQuoteCopilotInputSchema.safeParse("app-789").success,
        false
      )
    })
  })

  // =========================================================================
  // AC-6: CopilotRealtimeRunBanner Stage Mapping & Telemetry
  // =========================================================================
  describe("AC-6: CopilotRealtimeRunBanner Stage Mapping & Telemetry", () => {
    it("COPILOT_STAGES defines the 4 canonical stages in strict ascending order", () => {
      assert.equal(COPILOT_STAGES.length, 4)

      assert.equal(COPILOT_STAGES[0].key, "assembling_context")
      assert.equal(COPILOT_STAGES[0].pct, 15)

      assert.equal(COPILOT_STAGES[1].key, "running_domain_tools")
      assert.equal(COPILOT_STAGES[1].pct, 40)

      assert.equal(COPILOT_STAGES[2].key, "generating_structured_draft")
      assert.equal(COPILOT_STAGES[2].pct, 70)

      assert.equal(COPILOT_STAGES[3].key, "completed")
      assert.equal(COPILOT_STAGES[3].pct, 100)
    })

    it("verifies stage lookup percentage and label consistency", () => {
      for (const stage of COPILOT_STAGES) {
        assert.ok(stage.pct > 0 && stage.pct <= 100)
        assert.ok(stage.label.length > 0)
      }
    })
  })

  // =========================================================================
  // AC-7: Native Marketing Bridge Routing
  // =========================================================================
  describe("AC-7: Native Marketing Bridge Routing", () => {
    const tempIntegrationId = crypto.randomUUID()

    const cleanupTestRows = async () => {
      try {
        // Clean up test whatsapp messages & conversations
        const testPhones = [
          "923001234567",
          "120363024849102938",
          "120363024849102938@g.us",
        ]

        const convs = await db
          .select({ id: whatsappConversations.id })
          .from(whatsappConversations)
          .where(
            or(
              inArray(whatsappConversations.contactPhone, testPhones),
              sql`${whatsappConversations.contactPhone} LIKE '%120363024849102938%'`
            )
          )

        if (convs.length > 0) {
          const convIds = convs.map((c) => c.id)
          await db
            .delete(whatsappMessages)
            .where(inArray(whatsappMessages.conversationId, convIds))
          await db
            .delete(whatsappConversations)
            .where(inArray(whatsappConversations.id, convIds))
        }

        // Clean up test scheduled post targets & posts
        const posts = await db
          .select({ id: scheduledPosts.id })
          .from(scheduledPosts)
          .where(
            or(
              eq(scheduledPosts.caption, "Exclusive Umrah Package 2026 #AlRamlah"),
              sql`${scheduledPosts.mediaUrls}::text LIKE '%https://assets.alramlahtravels.com/flyers/post_101.jpg%'`
            )
          )

        if (posts.length > 0) {
          const postIds = posts.map((p) => p.id)
          await db
            .delete(scheduledPostTargets)
            .where(inArray(scheduledPostTargets.scheduledPostId, postIds))
          await db
            .delete(scheduledPosts)
            .where(inArray(scheduledPosts.id, postIds))
        }

        await db
          .delete(socialIntegrations)
          .where(eq(socialIntegrations.id, tempIntegrationId))
      } catch (err) {
        console.warn("[AC-7 Test Cleanup Warning]:", err)
      }
    }

    before(async () => {
      await cleanupTestRows()
    })

    after(async () => {
      await cleanupTestRows()
    })

    it("dispatchViaSocialBridge routes to native postiz when active DB integration exists", async () => {
      await db.insert(socialIntegrations).values({
        id: tempIntegrationId,
        provider: "instagram",
        internalAccountId: `ig_bridge_${tempIntegrationId.slice(0, 8)}`,
        name: "Official Instagram Bridge Test",
        isActive: true,
        status: "ACTIVE",
        encryptedAccessToken: encryptToken("ig_bridge_token"),
        metadata: {},
      })

      const futureIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      const input: SocialBridgeDispatchInput = {
        platform: "instagram",
        channelName: "Official Instagram",
        caption: "Exclusive Umrah Package 2026 #AlRamlah",
        imageUrl: "https://assets.alramlahtravels.com/flyers/post_101.jpg",
        scheduledAt: futureIso,
      }

      const res = await dispatchViaSocialBridge(input)
      assert.equal(res.dispatched, true)
      assert.equal(res.provider, "postiz")
      assert.ok(res.statusMessage.includes("INSTAGRAM"))
    })

    it("dispatchViaSocialBridge reports honest dispatched: false with NO_ACTIVE_SOCIAL_INTEGRATION when no active DB integration exists", async () => {
      const input: SocialBridgeDispatchInput = {
        platform: "tiktok",
        channelName: "Official TikTok",
        caption: "Exclusive Umrah Package 2026 #AlRamlah",
        imageUrl: "https://assets.alramlahtravels.com/flyers/post_101.jpg",
      }

      const res = await dispatchViaSocialBridge(input)
      assert.equal(res.dispatched, false)
      assert.equal(res.provider, "local_queue")
      assert.equal(res.errorCode, "NO_ACTIVE_SOCIAL_INTEGRATION")
      assert.ok(res.statusMessage.includes("TIKTOK"))
    })

    it("dispatchViaWhatsAppBridge returns manual_assisted wa.me link when no active Cloud API account or 24h window is open", async () => {
      const input: WhatsAppBridgeDispatchInput = {
        mode: "direct_1on1",
        senderLine: "03274029701",
        recipientIdOrPhone: "923001234567",
        recipientName: "Haji Muhammad Tariq",
        captionText: "Assalam-o-Alaikum Haji Tariq sb, sharing the 14-day Umrah package for your family.",
      }

      const res = await dispatchViaWhatsAppBridge(input)
      assert.equal(res.dispatched, false)
      assert.ok(res.whatsappClickUrl)
      assert.ok(res.whatsappClickUrl.startsWith("https://wa.me/923001234567"))
      assert.ok(res.whatsappClickUrl.includes("Assalam-o-Alaikum"))
    })

    it("dispatchViaWhatsAppBridge hard-rejects @g.us group targets onto the Ban-Safe Manual Assisted Share Queue (OD-01)", async () => {
      const input: WhatsAppBridgeDispatchInput = {
        mode: "group",
        senderLine: "03274029701",
        recipientIdOrPhone: "120363024849102938@g.us",
        recipientName: "Al Ramlah VIP Broadcast Group",
        captionText: "Special Ramadan Umrah Update",
      }

      const res = await dispatchViaWhatsAppBridge(input)
      assert.equal(res.dispatched, false)
      assert.equal(res.provider, "local_queue")
      assert.equal(res.channelMode, "manual_assisted")
      assert.equal(res.errorCode, "UNSUPPORTED_NON_1ON1_TARGET")
    })
  })

  // =========================================================================
  // AC-8: Verification Suite & Strict Human-in-the-Loop Safety Constraints
  // =========================================================================
  describe("AC-8: Verification Suite & Strict HITL Constraints", () => {
    it("buildDeterministicWaCopilotDraft strictly enforces requiresHumanApproval: true", () => {
      const draft = buildDeterministicWaCopilotDraft({
        conversationId: "conv-test",
        contactPhone: "923001234567",
        contactName: "Brother Ahmad",
        recentMessages: [
          {
            direction: "inbound",
            body: "Umrah package for 2 adults and 1 child ART-123",
          },
        ],
        detectedPostCodes: ["ART-123"],
        matchedPackages: [
          {
            id: "pkg-123",
            postCode: "ART-123",
            cardNumber: "01",
            title: "Executive Umrah November",
            supplierName: "Al-Haramain Deals",
            supplierSlug: "al-haramain",
            airlineIataCode: "SV",
            departureCityCode: "KHI",
            outboundFlightNo: "SV-735",
            outboundRoute: "KHI-JED",
            returnFlightNo: "SV-734",
            returnDateLabel: "29 Nov 2026",
            durationDays: 14,
            airlineName: "Saudia",
            outboundDateLabel: "15 Nov 2026",
            departureDate: "2026-11-15",
            returnDate: "2026-11-29",
            returnRoute: "JED-KHI",
            mealPlanLabel: "Room Only",
            sharingPricePkr: 260000,
            quadPricePkr: 285000,
            triplePricePkr: 315000,
            doublePricePkr: 360000,
            retailQuadPkr: 285000,
            retailTriplePkr: 315000,
            retailDoublePkr: 360000,
            retailSharingPkr: 260000,
            netSharingPkr: 240000,
            netQuadPkr: 265000,
            netTriplePkr: 295000,
            netDoublePkr: 340000,
            commissionPkr: 20000,
            pdfUrl: null,
            socialPosterUrl: null,
            makkahHotelName: "Swissotel Al Maqam",
            makkahNights: "08 Nights",
            makkahDistanceLabel: "50m",
            madinahHotelName: "Pullman Zamzam",
            madinahNights: "06 Nights",
            madinahDistanceLabel: "100m",
          },
        ],
        availableBatches: [],
      })

      assert.equal(draft.requiresHumanApproval, true)
      assert.ok(draft.bilingualReplyDraft.includes("Swissotel Al Maqam"))
      assert.ok(draft.bilingualReplyDraft.includes("285,000"))
    })

    it("buildDeterministicApplicationQuoteCopilotDraft strictly enforces requiresHumanApproval: true", () => {
      const worksheet = normalizeCopilotQuoteWorksheet({
        visaTotalPkr: 168000,
        flightsTotalPkr: 540000,
        makkahHotelTotalPkr: 360000,
        madinahHotelTotalPkr: 252000,
        transportTotalPkr: 105000,
        ziyaratTotalPkr: 60000,
        discountPkr: 0,
        grandTotalPkr: 1485000,
        supplierNetCostPkr: 1385000,
        commissionPkr: 100000,
        sarToPkrRate: 75,
        quoteNotesCustomer: "All inclusive luxury Umrah package with VIP Haramain transfers.",
        internalNotesAdmin: "High priority lead from Lahore desk.",
        itemizedBullets: ["4x Umrah e-Visa", "7N Makkah Swissotel", "7N Madinah Pullman"],
      })

      const emptyRateHints = calculateQuoteWorksheetHints({
        adults: 4,
        children: 0,
        infants: 0,
        visaRatePkr: 42000,
        sarToPkrRate: 75,
        hotelStays: [],
        transportSegments: [],
      })

      const appDraft = buildDeterministicApplicationQuoteCopilotDraft({
        applicationId: "app-test-456",
        referenceNumber: "ART-APP-786",
        customerName: "Haji Usman",
        customerCity: "Lahore",
        adults: 4,
        children: 0,
        infants: 0,
        totalPassportCount: 4,
        bedAndSeatCount: 4,
        totalKsaDays: 14,
        quoteBreakdown: {
          rateHints: emptyRateHints,
          worksheet,
          sarToPkrRate: 75,
          estimatedGrandTotalSar: 19800,
          estimatedGrandTotalPkr: 1485000,
        },
      })

      assert.equal(appDraft.requiresHumanApproval, true)
      assert.ok(appDraft.suggestedQuoteWorksheet)
      assert.ok(appDraft.suggestedQuoteWorksheet.grandTotalPkr > 0)
      assert.ok(appDraft.bilingualCustomerMessageDraft.includes("Haji Usman"))
    })
  })
})
