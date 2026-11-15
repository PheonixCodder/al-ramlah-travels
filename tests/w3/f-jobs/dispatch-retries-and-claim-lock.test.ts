import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { after, describe, it } from "node:test"
import { AbortTaskRunError, schemaTask } from "@trigger.dev/sdk"
import { eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db } from "../../../db"
import {
  scheduledPosts,
  scheduledPostTargets,
  socialIntegrations,
} from "../../../db/schema/social-scheduler"
import { encryptToken } from "../../../lib/social/crypto"
import {
  batchTriggerByIdOrInline,
  batchTriggerSocialPosts,
  dispatchInboundWhatsAppProcessing,
  setTriggerDispatchTransportForTests,
  triggerAndAwaitOrInline,
  triggerBackgroundOrInline,
  triggerByIdAndAwaitOrInline,
  triggerByIdBackgroundOrInline,
  TriggerDispatchConfigurationError,
} from "../../../trigger/dispatch"
import {
  classifyTaskError,
  rethrowAsTaskError,
  throwIfNonRetryable,
} from "../../../trigger/errors"
import { runPublishSocialPostExecution } from "../../../trigger/publish-social-post.task"

assertAuditSafeEnvironment()

const dummyTask = schemaTask({
  id: "test-dummy-heavy-task",
  schema: z.object({ value: z.string() }),
  run: async (payload) => ({ echoed: payload.value }),
})

async function withEnvOverrides<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const previous = new Map<string, string | undefined>()
  for (const [k, v] of Object.entries(overrides)) {
    previous.set(k, process.env[k])
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }
  try {
    return await fn()
  } finally {
    for (const [k, v] of previous.entries()) {
      if (v === undefined) {
        delete process.env[k]
      } else {
        process.env[k] = v
      }
    }
    setTriggerDispatchTransportForTests(null)
  }
}

describe("F-JOBS T-037: Fail-Closed Production Dispatch, Retry Classification & Atomic Scheduled Post Claim Lock", () => {
  const createdIntegrationIds: string[] = []
  const createdPostIds: string[] = []

  after(async () => {
    setTriggerDispatchTransportForTests(null)
    if (createdPostIds.length > 0) {
      await db
        .delete(scheduledPostTargets)
        .where(inArray(scheduledPostTargets.scheduledPostId, createdPostIds))
      await db
        .delete(scheduledPosts)
        .where(inArray(scheduledPosts.id, createdPostIds))
    }
    if (createdIntegrationIds.length > 0) {
      await db
        .delete(socialIntegrations)
        .where(inArray(socialIntegrations.id, createdIntegrationIds))
    }
    await closeDatabasePool()
  })

  it("blocks inline execution across all dispatch helpers when NODE_ENV=production and TRIGGER_SECRET_KEY is missing or dev-scoped", async () => {
    let inlineCalls = 0
    const inlineRunner = async () => {
      inlineCalls++
      return { echoed: "should-never-run" }
    }

    await withEnvOverrides(
      { NODE_ENV: "production", TRIGGER_SECRET_KEY: "" },
      async () => {
        await assert.rejects(
          () =>
            triggerAndAwaitOrInline({
              taskHandle: dummyTask,
              payload: { value: "a" },
              inlineRunner,
            }),
          (err) => err instanceof TriggerDispatchConfigurationError
        )

        await assert.rejects(
          () =>
            triggerBackgroundOrInline({
              taskHandle: dummyTask,
              payload: { value: "b" },
              inlineRunner,
            }),
          (err) => err instanceof TriggerDispatchConfigurationError
        )

        await assert.rejects(
          () =>
            triggerByIdAndAwaitOrInline({
              taskId: "render-gotenberg-asset",
              payload: { value: "c" },
              inlineRunner,
            }),
          (err) => err instanceof TriggerDispatchConfigurationError
        )

        await assert.rejects(
          () =>
            triggerByIdBackgroundOrInline({
              taskId: "publish-social-post",
              payload: { value: "d" },
              inlineRunner,
            }),
          (err) => err instanceof TriggerDispatchConfigurationError
        )

        await assert.rejects(
          () =>
            batchTriggerByIdOrInline({
              taskId: "render-gotenberg-asset",
              items: [{ payload: { value: "e" } }],
              inlineRunner,
            }),
          (err) => err instanceof TriggerDispatchConfigurationError
        )

        await assert.rejects(
          () =>
            batchTriggerSocialPosts({
              items: [{ scheduledPostId: crypto.randomUUID() }],
              inlineRunner: async () => {
                inlineCalls++
                return { ok: true }
              },
            }),
          (err) => err instanceof TriggerDispatchConfigurationError
        )

        await assert.rejects(
          () =>
            dispatchInboundWhatsAppProcessing({
              messageId: crypto.randomUUID(),
              accountId: crypto.randomUUID(),
              conversationId: crypto.randomUUID(),
              senderPhone: "923001234567",
              wamid: "wamid.test_prod_1",
              bodyText: "Salam",
              msgType: "text",
            }),
          (err) => err instanceof TriggerDispatchConfigurationError
        )
      }
    )

    // Also reject accidental tr_dev_* keys in NODE_ENV=production
    await withEnvOverrides(
      { NODE_ENV: "production", TRIGGER_SECRET_KEY: "tr_dev_accidental_key" },
      async () => {
        await assert.rejects(
          () =>
            triggerByIdAndAwaitOrInline({
              taskId: "quoting-copilot",
              payload: { value: "f" },
              inlineRunner,
            }),
          (err) => err instanceof TriggerDispatchConfigurationError
        )
      }
    )

    assert.equal(
      inlineCalls,
      0,
      "inlineRunner must NEVER execute in NODE_ENV=production"
    )
  })

  it("never falls back to inlineRunner in NODE_ENV=production when Trigger Cloud is unreachable or returns a failed run", async () => {
    let inlineCalls = 0
    const inlineRunner = async () => {
      inlineCalls++
      return { echoed: "inline-fallback" }
    }

    await withEnvOverrides(
      { NODE_ENV: "production", TRIGGER_SECRET_KEY: "tr_prod_simulated_unit" },
      async () => {
        // Case 1: Trigger Cloud API unreachable (network rejection)
        setTriggerDispatchTransportForTests({
          trigger: async () => {
            throw new Error("connect ECONNREFUSED api.trigger.dev:443")
          },
          triggerAndWait: async () => {
            throw new Error("connect ECONNREFUSED api.trigger.dev:443")
          },
          batchTrigger: async () => {
            throw new Error("connect ECONNREFUSED api.trigger.dev:443")
          },
        })

        await assert.rejects(
          () =>
            triggerByIdAndAwaitOrInline({
              taskId: "extract-packages",
              payload: { value: "x" },
              inlineRunner,
            }),
          (err) => err instanceof TriggerDispatchConfigurationError
        )

        // Case 2: Trigger Cloud executed run and returned !ok -> surface failure without running inline
        setTriggerDispatchTransportForTests({
          trigger: async () => ({ id: "run_cloud_1" }),
          triggerAndWait: async () => ({
            ok: false,
            id: "run_cloud_failed_1",
            error: { message: "AbortTaskRunError: HTTP 401 Invalid API Key" },
          }),
          batchTrigger: async () => ({ runs: [{ id: "run_cloud_b1" }] }),
          createPublicToken: async () => "pub_tok_123",
        })

        const failedRes = await triggerByIdAndAwaitOrInline({
          taskId: "quoting-copilot",
          payload: { value: "y" },
          inlineRunner,
        })

        assert.equal(failedRes.success, false)
        assert.equal(failedRes.mode, "cloud")
        assert.match(failedRes.error ?? "", /401/)
      }
    )

    assert.equal(
      inlineCalls,
      0,
      "inlineRunner must NEVER run when Cloud fails or rejects in production"
    )

    // Verify explicit non-production test mode still supports inline execution cleanly
    await withEnvOverrides(
      { NODE_ENV: "test", TRIGGER_SECRET_KEY: "" },
      async () => {
        const devRes = await triggerByIdAndAwaitOrInline({
          taskId: "quoting-copilot",
          payload: { value: "local-ok" },
          inlineRunner: async (p) => ({ echoed: p.value }),
        })
        assert.equal(devRes.success, true)
        assert.equal(devRes.mode, "inline")
        assert.deepEqual(devRes.output, { echoed: "local-ok" })
      }
    )
  })

  it("classifies 400/401/403/404/422 as AbortTaskRunError and 429/5xx/network timeouts as retryable Errors across all tasks", async () => {
    for (const statusCode of [400, 401, 403, 404, 410, 422]) {
      const permanentErr = Object.assign(
        new Error(`Upstream failed with HTTP ${statusCode}`),
        { statusCode }
      )
      const classified = classifyTaskError(permanentErr)
      assert.equal(
        classified.retryable,
        false,
        `Expected status ${statusCode} to be non-retryable`
      )
      assert.throws(
        () => rethrowAsTaskError(permanentErr, "TaskContext"),
        (thrown) => thrown instanceof AbortTaskRunError
      )
    }

    // OAuth code 190 without explicit numeric statusCode also aborts immediately
    assert.throws(
      () =>
        throwIfNonRetryable(
          new Error(
            "OAuthException (#190): Error validating access token: Session has expired"
          )
        ),
      (thrown) => thrown instanceof AbortTaskRunError
    )

    for (const statusCode of [408, 425, 429, 500, 502, 503, 504]) {
      const transientErr = Object.assign(
        new Error(`Transient upstream HTTP ${statusCode}`),
        { statusCode }
      )
      const classified = classifyTaskError(transientErr)
      assert.equal(
        classified.retryable,
        true,
        `Expected status ${statusCode} to be retryable`
      )
      assert.throws(
        () => rethrowAsTaskError(transientErr, "RetryContext"),
        (thrown) =>
          thrown instanceof Error && !(thrown instanceof AbortTaskRunError)
      )
    }

    // DNS ENOTFOUND must retry (never misclassified by 'not found' text heuristic)
    const dnsErr = Object.assign(
      new Error("getaddrinfo ENOTFOUND graph.facebook.com"),
      { code: "ENOTFOUND" }
    )
    assert.equal(classifyTaskError(dnsErr).retryable, true)

    // Verify all 7 required task files wire rethrowAsTaskError
    const requiredTaskFiles = [
      "publish-social-post.task.ts",
      "extract-packages.task.ts",
      "quoting-copilot.task.ts",
      "render-gotenberg-asset.task.ts",
      "send-whatsapp-broadcast.task.ts",
      "mirror-whatsapp-media.task.ts",
      "process-inbound-whatsapp.task.ts",
    ]

    for (const fileName of requiredTaskFiles) {
      const src = await readFile(
        path.join(process.cwd(), "trigger", fileName),
        "utf8"
      )
      assert.match(
        src,
        /\brethrowAsTaskError\b/,
        `Expected trigger/${fileName} to wire rethrowAsTaskError`
      )
    }
  })

  it("enforces atomic compare-and-set claim locking so concurrent wait.until and sweeper runs publish a scheduled post strictly ONCE", async () => {
    const [integration] = await db
      .insert(socialIntegrations)
      .values({
        provider: "instagram",
        name: `F-JOBS Claim Lock IG ${crypto.randomUUID().slice(0, 8)}`,
        handle: "@alramlah_claim_test",
        internalAccountId: `ig_claim_${crypto.randomUUID().slice(0, 8)}`,
        encryptedAccessToken: encryptToken("ig_access_token_test"),
        status: "ACTIVE",
        isActive: true,
      })
      .returning({ id: socialIntegrations.id })
    createdIntegrationIds.push(integration.id)

    const [post] = await db
      .insert(scheduledPosts)
      .values({
        caption: "Luxury Ramadan Umrah 2027 — Atomic Claim Lock Test",
        postType: "single_image",
        postFormat: "FEED",
        mediaUrls: ["https://cdn.example.com/posters/test-1080x1520.jpg"],
        socialJpegUrls: ["https://cdn.example.com/posters/test-1080x1520.jpg"],
        status: "scheduled",
        scheduledFor: new Date(Date.now() - 60_000),
      })
      .returning({ id: scheduledPosts.id })
    createdPostIds.push(post.id)

    await db.insert(scheduledPostTargets).values({
      scheduledPostId: post.id,
      integrationId: integration.id,
      status: "pending",
      idempotencyKey: `soc-pub-${post.id}-${integration.id}-1`,
    })

    let externalPublishCallCount = 0
    const fakePublisher = async () => {
      externalPublishCallCount++
      await new Promise((resolve) => setTimeout(resolve, 40))
      return {
        publishResult: {
          externalPostId: `ig_ext_${crypto.randomUUID().slice(0, 8)}`,
          publishedUrl: "https://instagram.com/p/claim-lock-test",
        },
        activeAccessToken: "ig_access_token_test",
      }
    }

    // Fire two concurrent executions (simulating wait.until wakeup + sweeper cron collision)
    const [runA, runB] = await Promise.all([
      runPublishSocialPostExecution({
        scheduledPostId: post.id,
        runId: "run_claim_worker_a",
        publisherOverride: fakePublisher,
      }),
      runPublishSocialPostExecution({
        scheduledPostId: post.id,
        runId: "run_claim_worker_b",
        publisherOverride: fakePublisher,
      }),
    ])

    assert.equal(
      externalPublishCallCount,
      1,
      "Provider publish API must be invoked AT MOST ONCE across concurrent workers"
    )

    const skippedRuns = [runA, runB].filter((r) => r.skipped === true)
    const activeRuns = [runA, runB].filter((r) => !r.skipped)
    assert.equal(activeRuns.length, 1, "Exactly one worker must claim the post")
    assert.equal(
      skippedRuns.length,
      1,
      "Concurrent contender must skip cleanly"
    )
    assert.equal(activeRuns[0]?.completedTargets, 1)

    const [finalPost] = await db
      .select({ status: scheduledPosts.status })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, post.id))
    assert.equal(finalPost?.status, "completed")

    // Verify transient 503 failure releases claim back to 'scheduled' and rethrows retryable Error,
    // whereas permanent 401 failure finalizes 'failed' and throws AbortTaskRunError
    const [retryPost] = await db
      .insert(scheduledPosts)
      .values({
        caption: "Transient 503 Retry Test",
        postType: "single_image",
        postFormat: "FEED",
        mediaUrls: ["https://cdn.example.com/posters/retry.jpg"],
        socialJpegUrls: ["https://cdn.example.com/posters/retry.jpg"],
        status: "scheduled",
        scheduledFor: new Date(Date.now() - 30_000),
      })
      .returning({ id: scheduledPosts.id })
    createdPostIds.push(retryPost.id)

    await db.insert(scheduledPostTargets).values({
      scheduledPostId: retryPost.id,
      integrationId: integration.id,
      status: "pending",
      idempotencyKey: `soc-pub-${retryPost.id}-${integration.id}-1`,
    })

    await assert.rejects(
      () =>
        runPublishSocialPostExecution({
          scheduledPostId: retryPost.id,
          publisherOverride: async () => {
            throw Object.assign(new Error("HTTP 503 Service Unavailable"), {
              statusCode: 503,
            })
          },
        }),
      (err) => err instanceof Error && !(err instanceof AbortTaskRunError)
    )

    const [afterTransient] = await db
      .select({ status: scheduledPosts.status })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, retryPost.id))
    assert.equal(
      afterTransient?.status,
      "scheduled",
      "Transient 503 must release post back to 'scheduled' so Trigger retry can re-claim it"
    )

    await assert.rejects(
      () =>
        runPublishSocialPostExecution({
          scheduledPostId: retryPost.id,
          publisherOverride: async () => {
            throw Object.assign(
              new Error("HTTP 401 OAuthException: Invalid access token"),
              { statusCode: 401 }
            )
          },
        }),
      (err) => err instanceof AbortTaskRunError
    )

    const [afterPermanent] = await db
      .select({ status: scheduledPosts.status })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, retryPost.id))
    assert.equal(
      afterPermanent?.status,
      "failed",
      "Permanent 401 must finalize post as 'failed' and abort retries"
    )
  })
})
