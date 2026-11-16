import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import * as cdpModule from "../../../lib/posters/chromium-cdp"
import * as gotenbergModule from "../../../lib/posters/gotenberg"

const originalFetch = globalThis.fetch

function withEnvOverrides<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key]
    const nextVal = overrides[key]
    if (nextVal === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = nextVal
    }
  }
  return fn().finally(() => {
    for (const [key, prevVal] of Object.entries(saved)) {
      if (prevVal === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = prevVal
      }
    }
  })
}

describe("F-INFRA T-082: Gotenberg HTML/Logo Deduplication & Bounded Concurrent Multi-Format Rendering", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("T-082: caches company logo data URI across calls, deduplicates HTML preparation, skips disabled formats, and parallelizes dual-format renders", async () => {
    const gotenbergExt = gotenbergModule as typeof gotenbergModule & {
      prepareGotenbergHtmlPayload: (html: string) => Promise<{
        html: string
        byteLength: number
        htmlBlob: Blob
      }>
      renderBatchViaGotenberg: <TIn, TOut>(
        items: readonly TIn[],
        worker: (item: TIn, index: number) => Promise<TOut>,
        options?: { concurrency?: number }
      ) => Promise<TOut[]>
    }

    // 1. Logo base64 is memoized in memory and non-empty
    const logoA = await cdpModule.getCompanyLogoBase64()
    const logoB = await cdpModule.getCompanyLogoBase64()
    assert.ok(logoA.length > 0)
    assert.equal(logoA, logoB)

    // 2. Shared HTML payload preparation resolves {{COMPANY_LOGO_DATA_URI}} once into a single reusable Blob
    const prepared = await gotenbergExt.prepareGotenbergHtmlPayload(
      '<html><body><img src="{{COMPANY_LOGO_DATA_URI}}" alt="Al Ramlah" /></body></html>'
    )
    assert.match(prepared.html, /^<html><body><img src="data:image\/(png|jpeg);base64,/)
    assert.ok(prepared.byteLength < 200 * 1024, "Prepared HTML payload must remain < 200 KB")

    // 3. Explicit single-format options issue exactly 1 HTTP call (0 redundant requests)
    let callCount = 0
    let inFlightNow = 0
    let maxConcurrent = 0

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      callCount++
      inFlightNow++
      maxConcurrent = Math.max(maxConcurrent, inFlightNow)
      await new Promise((resolve) => setTimeout(resolve, 35))
      inFlightNow--

      if (url.endsWith("/forms/chromium/screenshot/html")) {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
      }
      return new Response(new Uint8Array([4, 5, 6]), { status: 200 })
    }) as typeof fetch

    await withEnvOverrides(
      {
        GOTENBERG_API_URL: "https://pdf.alramlahtravels.com",
        GOTENBERG_API_KEY: "audit_test_key",
      },
      async () => {
        const pdfOnly = await gotenbergModule.renderHtmlViaGotenberg({
          html: "<html><body>PDF Only</body></html>",
          capturePng: false,
          capturePdf: true,
        })
        assert.equal(callCount, 1)
        assert.equal(pdfOnly.pngBuffer, undefined)
        assert.ok(pdfOnly.pdfBuffer)

        // 4. Dual-format render runs PNG + PDF concurrently (maxConcurrent === 2)
        callCount = 0
        maxConcurrent = 0
        const both = await gotenbergModule.renderHtmlViaGotenberg({
          html: "<html><body>4K PNG + Vector PDF</body></html>",
          capturePng: true,
          capturePdf: true,
        })
        assert.equal(callCount, 2)
        assert.equal(maxConcurrent, 2, "PNG and PDF requests must execute concurrently")
        assert.ok(both.pngBuffer && both.pdfBuffer)

        // 5. Bounded batch helper caps in-flight concurrency to <= 2 (matching Oracle Gotenberg --chromium-max-concurrency=2)
        let batchInFlight = 0
        let batchMaxInFlight = 0
        const items = [1, 2, 3, 4, 5]
        const outputs = await gotenbergExt.renderBatchViaGotenberg(
          items,
          async (n) => {
            batchInFlight++
            batchMaxInFlight = Math.max(batchMaxInFlight, batchInFlight)
            await new Promise((resolve) => setTimeout(resolve, 25))
            batchInFlight--
            return n * 10
          },
          { concurrency: 2 }
        )
        assert.deepEqual(outputs, [10, 20, 30, 40, 50])
        assert.equal(batchMaxInFlight, 2)
      }
    )
  })
})
