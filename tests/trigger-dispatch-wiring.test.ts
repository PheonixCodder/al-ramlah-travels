import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import {
  cancelTriggerRunIfActive,
  setTriggerSdkForTests,
  triggerByIdAndAwaitOrInline,
  triggerByIdBackgroundOrInline,
} from "../trigger/dispatch"

describe("Trigger.dev Server-Action Dispatch Wiring", () => {
  const originalKey = process.env.TRIGGER_SECRET_KEY

  afterEach(() => {
    setTriggerSdkForTests(null)
    if (originalKey === undefined) {
      delete process.env.TRIGGER_SECRET_KEY
    } else {
      process.env.TRIGGER_SECRET_KEY = originalKey
    }
  })

  it("executes cloud task and polls output when tr_prod_ secret key is configured", async () => {
    process.env.TRIGGER_SECRET_KEY = "tr_prod_live_test_key"

    let inlineCalled = false
    setTriggerSdkForTests({
      tasks: {
        trigger: (async () => ({
          id: "run_prod_001",
          publicAccessToken: "tok",
        })) as never,
      },
      runs: {
        poll: (async () => ({
          id: "run_prod_001",
          status: "COMPLETED",
          isSuccess: true,
          output: { pdfUrl: "https://r2.example.com/quote.pdf" },
        })) as never,
        retrieve: (async () => ({ status: "EXECUTING" })) as never,
        cancel: (async () => ({ id: "run_prod_001" })) as never,
      },
    })

    const res = await triggerByIdAndAwaitOrInline({
      taskId: "render-gotenberg-asset",
      payload: { kind: "quotation_pdf" },
      inlineRunner: async () => {
        inlineCalled = true
        return { pdfUrl: "inline.pdf" }
      },
    })

    assert.equal(res.mode, "cloud")
    assert.equal(res.success, true)
    assert.equal(res.runId, "run_prod_001")
    assert.deepEqual(res.output, { pdfUrl: "https://r2.example.com/quote.pdf" })
    assert.equal(inlineCalled, false)
  })

  it("dispatches future-scheduled background tasks to Trigger.dev Cloud immediately and returns runId", async () => {
    process.env.TRIGGER_SECRET_KEY = "tr_dev_local_key"

    let inlineCalled = false
    setTriggerSdkForTests({
      tasks: {
        trigger: (async () => ({
          id: "run_sched_999",
          publicAccessToken: "tok",
        })) as never,
      },
      runs: {
        poll: (async () => ({})) as never,
        retrieve: (async () => ({ status: "QUEUED" })) as never,
        cancel: (async () => ({ id: "run_sched_999" })) as never,
      },
    })

    const res = await triggerByIdBackgroundOrInline({
      taskId: "publish-social-post",
      payload: { scheduledPostId: "post_123" },
      isFutureScheduled: true,
      inlineRunner: async () => {
        inlineCalled = true
        return { ok: true }
      },
    })

    assert.equal(res.mode, "cloud")
    assert.equal(res.runId, "run_sched_999")
    assert.equal(res.success, true)
    assert.equal(inlineCalled, false)
  })

  it("cancels active Trigger.dev runs safely via cancelTriggerRunIfActive", async () => {
    process.env.TRIGGER_SECRET_KEY = "tr_prod_live_test_key"

    let cancelledId: string | null = null
    setTriggerSdkForTests({
      tasks: {
        trigger: (async () => ({ id: "run_1" })) as never,
      },
      runs: {
        poll: (async () => ({})) as never,
        retrieve: (async () => ({ status: "WAITING" })) as never,
        cancel: (async (id: string) => {
          cancelledId = id
          return { id }
        }) as never,
      },
    })

    await cancelTriggerRunIfActive("run_to_cancel")
    assert.equal(cancelledId, "run_to_cancel")
  })

  it("falls back cleanly to inlineRunner when TRIGGER_SECRET_KEY is unset", async () => {
    delete process.env.TRIGGER_SECRET_KEY

    const res = await triggerByIdAndAwaitOrInline({
      taskId: "extract-packages",
      payload: { mode: "multimodal" },
      inlineRunner: async () => ({ extractedCount: 4 }),
    })

    assert.equal(res.mode, "inline")
    assert.equal(res.success, true)
    assert.deepEqual(res.output, { extractedCount: 4 })
  })
})
