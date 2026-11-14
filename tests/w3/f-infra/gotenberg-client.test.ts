import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { afterEach, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { renderHtmlViaChromiumCdp } from "../../../lib/posters/chromium-cdp"
import { renderHtmlViaGotenberg } from "../../../lib/posters/gotenberg"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(__dirname, "../../..")

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

describe("F-INFRA T-015: Gotenberg v8 /screenshot/html Endpoint, Timeouts, Error Propagation & CDP Prod Lock", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("T-015: posts screenshots to /forms/chromium/screenshot/html with AbortSignal.timeout and Gotenberg-Trace header", async () => {
    const seenCalls: Array<{
      url: string
      headers: Headers
      hasSignal: boolean
    }> = []

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      seenCalls.push({
        url,
        headers: new Headers(init?.headers),
        hasSignal: init?.signal instanceof AbortSignal,
      })

      if (url.endsWith("/forms/chromium/screenshot/html")) {
        return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      }
      if (url.endsWith("/forms/chromium/convert/html")) {
        return new Response(Buffer.from("%PDF-1.7", "utf8"), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        })
      }
      return new Response("Not Found", { status: 404 })
    }) as typeof fetch

    await withEnvOverrides(
      {
        NODE_ENV: "production",
        GOTENBERG_API_URL: "https://pdf.alramlahtravels.com/",
        GOTENBERG_API_KEY: "test_secret_gotenberg_key_64",
      },
      async () => {
        const result = await renderHtmlViaGotenberg({
          html: "<!DOCTYPE html><html><body><h1>Haramain Poster</h1></body></html>",
          width: 1080,
          height: 1520,
          deviceScaleFactor: 3,
          capturePng: true,
          capturePdf: true,
        })

        assert.ok(Buffer.isBuffer(result.pngBuffer) && result.pngBuffer.length === 4)
        assert.ok(Buffer.isBuffer(result.pdfBuffer) && result.pdfBuffer.length > 0)
        assert.equal(seenCalls.length, 2)

        const urls = seenCalls.map((c) => c.url).sort()
        assert.deepEqual(urls, [
          "https://pdf.alramlahtravels.com/forms/chromium/convert/html",
          "https://pdf.alramlahtravels.com/forms/chromium/screenshot/html",
        ])

        for (const call of seenCalls) {
          assert.equal(call.hasSignal, true, "Every Gotenberg fetch must attach AbortSignal.timeout")
          assert.equal(call.headers.get("X-Gotenberg-Api-Key"), "test_secret_gotenberg_key_64")
          assert.ok(
            (call.headers.get("Gotenberg-Trace") ?? "").length >= 8,
            "Every Gotenberg fetch must include a Gotenberg-Trace correlation header"
          )
        }
      }
    )
  })

  it("T-015: propagates HTTP 500/503 and timeout errors from Gotenberg instead of swallowing into local Chrome fallback", async () => {
    globalThis.fetch = (async () =>
      new Response("Chromium worker overloaded", {
        status: 503,
        statusText: "Service Unavailable",
      })) as typeof fetch

    await withEnvOverrides(
      {
        NODE_ENV: "production",
        GOTENBERG_API_URL: "https://pdf.alramlahtravels.com",
        GOTENBERG_API_KEY: "test_secret_gotenberg_key_64",
      },
      async () => {
        await assert.rejects(
          () =>
            renderHtmlViaGotenberg({
              html: "<html><body>Quote</body></html>",
              capturePng: false,
              capturePdf: true,
            }),
          /503|Gotenberg/i
        )
      }
    )
  })

  it("T-015: hard-blocks renderHtmlViaChromiumCdp in NODE_ENV=production unless ALLOW_LOCAL_CDP_DEV=1 and uses webpackIgnore", async () => {
    const cdpSource = fs.readFileSync(
      path.join(WEB_ROOT, "lib/posters/chromium-cdp.ts"),
      "utf8"
    )
    assert.ok(
      cdpSource.includes("webpackIgnore: true"),
      "chromium-cdp.ts must mark dev-only dynamic imports with /*webpackIgnore: true*/"
    )

    await withEnvOverrides(
      {
        NODE_ENV: "production",
        ALLOW_LOCAL_CDP_DEV: undefined,
        GOTENBERG_API_URL: undefined,
      },
      async () => {
        await assert.rejects(
          () =>
            renderHtmlViaChromiumCdp({
              html: "<html><body>Blocked in prod</body></html>",
            }),
          /disabled in production|ALLOW_LOCAL_CDP_DEV/i
        )

        await assert.rejects(
          () =>
            renderHtmlViaGotenberg({
              html: "<html><body>Blocked in prod</body></html>",
            }),
          /GOTENBERG_API_URL|disabled in production/i
        )
      }
    )
  })
})
