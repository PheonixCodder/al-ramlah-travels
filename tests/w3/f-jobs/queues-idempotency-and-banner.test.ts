import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { after, describe, it } from "node:test"
import { AbortTaskRunError } from "@trigger.dev/sdk"
import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import triggerConfig from "../../../trigger.config"
import {
  COPILOT_REALTIME_SKIP_COLUMNS,
} from "../../../components/admin/desk/copilot-realtime-run-banner"
import {
  assertTriggerWorkerEnv,
  validateTriggerWorkerEnv,
} from "../../../lib/trigger/env"
import {
  composeDispatchIdempotencySeed,
  computePayloadContentHash,
  dispatchInboundWhatsAppProcessing,
  setTriggerDispatchTransportForTests,
} from "../../../trigger/dispatch"
import { extractPackagesTask } from "../../../trigger/extract-packages.task"
import { mirrorWhatsappMediaTask } from "../../../trigger/mirror-whatsapp-media.task"
import { processInboundWhatsappTask } from "../../../trigger/process-inbound-whatsapp.task"
import { publishSocialPostTask } from "../../../trigger/publish-social-post.task"
import {
  aiExtractionQueue,
  gotenbergQueue,
  inboundWhatsappQueue,
  mediaMirrorQueue,
  quotingCopilotQueue,
  scheduledMaintenanceQueue,
  socialPublishQueue,
  whatsappBroadcastQueue,
  whatsappGroupCampaignQueue,
} from "../../../trigger/queues"
import { quotingCopilotTask } from "../../../trigger/quoting-copilot.task"
import { renderGotenbergAssetTask } from "../../../trigger/render-gotenberg-asset.task"
import { sendWhatsappBroadcastTask } from "../../../trigger/send-whatsapp-broadcast.task"
import { sendWhatsappGroupCampaignTask } from "../../../trigger/send-whatsapp-group-campaign.task"

assertAuditSafeEnvironment()

describe("F-JOBS T-072: Trigger Config Logo Bundling + Env Checks, Bounded Queues, 30d Idempotency Anti-Poisoning & Copilot Banner Output", () => {
  after(() => {
    setTriggerDispatchTransportForTests(null)
  })

  it("configures additionalFiles(['public/logo*']), sharp external, retries.enabledInDev=false, and startup env checks in trigger.config.ts", async () => {
    const rawConfigSource = await readFile(
      path.join(process.cwd(), "trigger.config.ts"),
      "utf8"
    )

    assert.match(rawConfigSource, /additionalFiles\(\{\s*files:\s*\["public\/logo\*"\]\s*\}\)/)
    assert.equal(triggerConfig.retries?.enabledInDev, false)
    assert.ok(triggerConfig.build?.external?.includes("sharp"))
    assert.ok(
      Array.isArray(triggerConfig.build?.extensions) &&
        triggerConfig.build.extensions.length >= 1,
      "Expected additionalFiles build extension in trigger.config.ts"
    )

    const missingCheck = validateTriggerWorkerEnv({
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv)
    assert.equal(missingCheck.ok, false)
    assert.ok(missingCheck.missing.includes("DATABASE_URL"))
    assert.ok(missingCheck.missing.includes("ENCRYPTION_KEY"))
    assert.ok(missingCheck.missing.includes("GOTENBERG_API_URL"))

    assert.throws(
      () =>
        assertTriggerWorkerEnv({
          NODE_ENV: "production",
        } as NodeJS.ProcessEnv),
      (err) => err instanceof AbortTaskRunError
    )

    const validCheck = validateTriggerWorkerEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54329/audit",
      ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      R2_ACCOUNT_ID: "acc_123",
      R2_ACCESS_KEY_ID: "key_123",
      R2_SECRET_ACCESS_KEY: "sec_123",
      R2_BUCKET_NAME: "alramlah",
      R2_PUBLIC_URL: "https://cdn.alramlahtravels.com",
      GOTENBERG_API_URL: "https://gotenberg.example.com",
    } as NodeJS.ProcessEnv)
    assert.equal(validCheck.ok, true)
  })

  it("attaches explicit bounded concurrency queues to every schemaTask across trigger/*.task.ts", async () => {
    const allQueues = [
      gotenbergQueue,
      whatsappBroadcastQueue,
      socialPublishQueue,
      aiExtractionQueue,
      quotingCopilotQueue,
      inboundWhatsappQueue,
      mediaMirrorQueue,
      whatsappGroupCampaignQueue,
      scheduledMaintenanceQueue,
    ]
    for (const q of allQueues) {
      assert.ok(q && typeof q.name === "string" && q.name.length > 0)
    }

    const allTasks = [
      { name: "extract-packages", task: extractPackagesTask, expectedQueue: "ai-package-extraction" },
      { name: "render-gotenberg-asset", task: renderGotenbergAssetTask, expectedQueue: "gotenberg-chromium-render" },
      { name: "quoting-copilot", task: quotingCopilotTask, expectedQueue: "ai-quoting-copilot" },
      { name: "mirror-whatsapp-media", task: mirrorWhatsappMediaTask, expectedQueue: "whatsapp-media-mirror" },
      { name: "process-inbound-whatsapp", task: processInboundWhatsappTask, expectedQueue: "whatsapp-inbound-webhook" },
      { name: "publish-social-post", task: publishSocialPostTask, expectedQueue: "social-channel-publish" },
      { name: "send-whatsapp-broadcast", task: sendWhatsappBroadcastTask, expectedQueue: "whatsapp-broadcast-delivery" },
      { name: "send-whatsapp-group-campaign", task: sendWhatsappGroupCampaignTask, expectedQueue: "whatsapp-group-campaign" },
    ]

    for (const entry of allTasks) {
      assert.equal(entry.task.id, entry.name)
    }

    // Verify source-level `queue:` declaration on every schemaTask file
    const taskFiles = [
      "extract-packages.task.ts",
      "render-gotenberg-asset.task.ts",
      "quoting-copilot.task.ts",
      "mirror-whatsapp-media.task.ts",
      "process-inbound-whatsapp.task.ts",
      "publish-social-post.task.ts",
      "send-whatsapp-broadcast.task.ts",
      "send-whatsapp-group-campaign.task.ts",
    ]
    for (const file of taskFiles) {
      const content = await readFile(
        path.join(process.cwd(), "trigger", file),
        "utf8"
      )
      assert.match(
        content,
        /\bqueue:\s*[a-zA-Z0-9_]+Queue\b/,
        `Expected ${file} schemaTask to declare an explicit bounded queue`
      )
    }
  })

  it("prevents 30-day idempotency key poisoning when rescheduling posts, editing poster content, or retrying broadcasts, and sets per-conversation concurrencyKey", async () => {
    const postId = crypto.randomUUID()
    const slotA = new Date("2027-03-10T06:00:00.000Z")
    const slotB = new Date("2027-03-11T11:00:00.000Z")

    const keyScheduleA = composeDispatchIdempotencySeed({
      idempotencyKey: `soc-post-run-${postId}`,
      scheduledFor: slotA,
    })
    const keyScheduleAAgain = composeDispatchIdempotencySeed({
      idempotencyKey: `soc-post-run-${postId}`,
      scheduledFor: slotA.toISOString(),
    })
    const keyScheduleB = composeDispatchIdempotencySeed({
      idempotencyKey: `soc-post-run-${postId}`,
      scheduledFor: slotB,
    })

    assert.equal(
      keyScheduleA,
      keyScheduleAAgain,
      "Same post + same schedule slot must produce identical idempotency seed"
    )
    assert.notEqual(
      keyScheduleA,
      keyScheduleB,
      "Rescheduling a post to a new slot must produce a distinct idempotency seed"
    )

    const hashV1 = computePayloadContentHash({
      postCode: "ART-MKH-001",
      retailQuadPkr: 315000,
    })
    const hashV2 = computePayloadContentHash({
      postCode: "ART-MKH-001",
      retailQuadPkr: 329000,
    })
    assert.notEqual(hashV1, hashV2)

    const renderKeyV1 = composeDispatchIdempotencySeed({
      idempotencyKey: "spotlight-render-ART-MKH-001",
      contentHash: hashV1,
    })
    const renderKeyV2 = composeDispatchIdempotencySeed({
      idempotencyKey: "spotlight-render-ART-MKH-001",
      contentHash: hashV2,
    })
    assert.notEqual(
      renderKeyV1,
      renderKeyV2,
      "Edited poster prices/content must produce a distinct idempotency seed"
    )

    const broadcastAttempt1 = composeDispatchIdempotencySeed({
      idempotencyKey: "wa-bcast-run-123",
      retryAttempt: 1,
    })
    const broadcastAttempt2 = composeDispatchIdempotencySeed({
      idempotencyKey: "wa-bcast-run-123",
      retryAttempt: 2,
    })
    assert.notEqual(
      broadcastAttempt1,
      broadcastAttempt2,
      "Retrying a failed broadcast must produce a distinct idempotency seed"
    )

    // Verify dispatchInboundWhatsAppProcessing passes concurrencyKey = conversationId to Trigger Cloud
    const prevSecret = process.env.TRIGGER_SECRET_KEY
    const prevNodeEnv = process.env.NODE_ENV
    let capturedOptions: Record<string, unknown> | undefined
    const conversationId = crypto.randomUUID()

    try {
      process.env.NODE_ENV = "development"
      process.env.TRIGGER_SECRET_KEY = "tr_dev_capture_concurrency"
      setTriggerDispatchTransportForTests({
        trigger: async (_taskId, _payload, options) => {
          capturedOptions = options
          return { id: "run_wa_inbound_1" }
        },
        triggerAndWait: async () => ({
          ok: true,
          id: "run_wa_inbound_1",
          output: {},
        }),
        batchTrigger: async () => ({ runs: [] }),
        createPublicToken: async () => "tok_wa_1",
      })

      const res = await dispatchInboundWhatsAppProcessing({
        messageId: crypto.randomUUID(),
        accountId: crypto.randomUUID(),
        conversationId,
        senderPhone: "923274029701",
        wamid: `wamid.${crypto.randomUUID()}`,
        bodyText: "ART-MKH-001",
        msgType: "text",
      })

      assert.equal(res.mode, "cloud")
      assert.equal(
        capturedOptions?.concurrencyKey,
        conversationId,
        "Inbound WhatsApp dispatch must serialize per conversationId via concurrencyKey"
      )
      assert.ok(
        capturedOptions?.idempotencyKey,
        "Inbound WhatsApp dispatch must attach global idempotencyKey"
      )
    } finally {
      if (prevSecret === undefined) delete process.env.TRIGGER_SECRET_KEY
      else process.env.TRIGGER_SECRET_KEY = prevSecret
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = prevNodeEnv
      setTriggerDispatchTransportForTests(null)
    }
  })

  it("subscribes CopilotRealtimeRunBanner with skipColumns=['payload'] (preserving 'output') and zero dark-mode/any tokens", async () => {
    assert.deepEqual(
      [...COPILOT_REALTIME_SKIP_COLUMNS],
      ["payload"],
      "CopilotRealtimeRunBanner must skip only 'payload' and NEVER skip 'output'"
    )
    assert.equal(
      (COPILOT_REALTIME_SKIP_COLUMNS as readonly string[]).includes("output"),
      false
    )

    const bannerSource = await readFile(
      path.join(
        process.cwd(),
        "components",
        "admin",
        "desk",
        "copilot-realtime-run-banner.tsx"
      ),
      "utf8"
    )

    assert.equal(
      /\bskipColumns:\s*\[\s*"payload"\s*,\s*"output"\s*\]/.test(bannerSource),
      false,
      "Must not pass skipColumns: ['payload', 'output']"
    )
    assert.equal(
      /\bdark:/.test(bannerSource),
      false,
      "Single luxury light theme forbids dark:* classes"
    )
    assert.equal(
      /:\s*any\b|\bas\s+any\b/.test(bannerSource),
      false,
      "Banner must contain zero 'any' types"
    )
  })
})
