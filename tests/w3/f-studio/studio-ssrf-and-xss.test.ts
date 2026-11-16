import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { describe, it } from "node:test"

import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import {
  loadMediaBytes,
  MAX_STUDIO_MEDIA_BYTES,
  resolveAllowedStudioMediaHosts,
} from "../../../lib/ai/extract-packages"
import { renderMultiPackagePosterHtml } from "../../../lib/posters/render-multi-package-poster"
import { renderSinglePackagePosterHtml } from "../../../lib/posters/render-single-package-poster"
import { SSRFBlockedError } from "../../../lib/security/ssrf-guard"

if (process.env.NODE_ENV === "test") {
  for (const key of [
    "OPENROUTER_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "OPENAI_API_KEY",
    "COMPOSIO_API_KEY",
  ]) {
    process.env[key] = ""
  }
}
assertAuditSafeEnvironment()

describe("F-STUDIO T-025: Studio SSRF / Arbitrary File Read Defense & Gotenberg HTML Poster XSS Escaping", () => {
  it("T-025a: completely eliminates fs.readFile from lib/ai/extract-packages.ts and app/actions/marketing-ops.ts", async () => {
    const extractSource = await fs.readFile(
      path.resolve(process.cwd(), "lib/ai/extract-packages.ts"),
      "utf8"
    )
    const actionsSource = await fs.readFile(
      path.resolve(process.cwd(), "app/actions/marketing-ops.ts"),
      "utf8"
    )

    assert.ok(
      !extractSource.includes("fs.readFile"),
      "lib/ai/extract-packages.ts must contain zero fs.readFile calls"
    )
    assert.ok(
      !extractSource.includes("node:fs"),
      "lib/ai/extract-packages.ts must not import node:fs"
    )
    assert.ok(
      !actionsSource.includes("fs.readFile"),
      "app/actions/marketing-ops.ts must contain zero fs.readFile calls"
    )
    assert.ok(
      !actionsSource.includes("node:fs"),
      "app/actions/marketing-ops.ts must not import node:fs"
    )
  })

  it("T-025b: blocks local filesystem paths, file:// schemes, cloud metadata IPs, loopback/RFC1918 IPs, and non-R2 domains in loadMediaBytes", async () => {
    const allowedR2Host = "pub-test-alramlah.r2.dev"
    const publicDns = async () => [{ address: "104.18.2.15", family: 4 }]

    const forbiddenTargets = [
      "/etc/passwd",
      "../../.env",
      "C:\\Windows\\win.ini",
      "/uploads/sample-posts/ammaar.jpg",
      "file:///etc/passwd",
      "http://169.254.169.254/latest/meta-data/",
      "https://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:9222/json",
      "https://localhost/internal.png",
      "https://10.0.0.12/flyer.png",
      "https://192.168.1.50/flyer.png",
      "http://pub-test-alramlah.r2.dev/flyer.png", // HTTP rejected (HTTPS-only)
      "https://evil-attacker.example.com/flyer.png", // Outside R2 allowlist
    ]

    for (const badUrl of forbiddenTargets) {
      await assert.rejects(
        () =>
          loadMediaBytes(badUrl, {
            allowedHosts: [allowedR2Host],
            dnsLookup: publicDns,
            fetchImpl: async () => {
              throw new Error("fetch must NEVER be invoked for blocked URLs")
            },
          }),
        (err: unknown) => err instanceof SSRFBlockedError,
        `Expected SSRFBlockedError for ${badUrl}`
      )
    }

    // DNS rebinding check: R2-allowlisted hostname resolving to 169.254.169.254 is blocked before fetch
    await assert.rejects(
      () =>
        loadMediaBytes(`https://${allowedR2Host}/rebind.png`, {
          allowedHosts: [allowedR2Host],
          dnsLookup: async () => [{ address: "169.254.169.254", family: 4 }],
          fetchImpl: async () => {
            throw new Error("fetch must NEVER run on DNS rebinding to metadata IP")
          },
        }),
      (err: unknown) => err instanceof SSRFBlockedError
    )
  })

  it("T-025c: enforces 20 MB streaming byte cap and R2 HTTPS allowlist on valid fetches", async () => {
    const allowedR2Host = "pub-test-alramlah.r2.dev"
    const publicDns = async () => [{ address: "104.18.2.15", family: 4 }]

    assert.deepEqual(resolveAllowedStudioMediaHosts([allowedR2Host]).includes(allowedR2Host), true)

    // 1. Oversized Content-Length header rejected immediately
    await assert.rejects(
      () =>
        loadMediaBytes(`https://${allowedR2Host}/huge.png`, {
          allowedHosts: [allowedR2Host],
          dnsLookup: publicDns,
          fetchImpl: async () =>
            new Response("tiny", {
              status: 200,
              headers: {
                "content-type": "image/png",
                "content-length": String(MAX_STUDIO_MEDIA_BYTES + 1024),
              },
            }),
        }),
      /exceeds maximum allowed size/i
    )

    // 2. Chunked stream exceeding maxBytes mid-stream is cancelled and rejected
    const chunk = new Uint8Array(4096)
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk)
      },
    })
    await assert.rejects(
      () =>
        loadMediaBytes(`https://${allowedR2Host}/stream-bomb.png`, {
          allowedHosts: [allowedR2Host],
          maxBytes: 8192,
          dnsLookup: publicDns,
          fetchImpl: async () =>
            new Response(stream, {
              status: 200,
              headers: { "content-type": "image/png" },
            }),
        }),
      /exceeded maximum allowed size/i
    )

    // 3. Legitimate HTTPS R2 asset succeeds with redirect: "error" & AbortSignal
    let capturedRedirect: RequestRedirect | undefined
    let capturedSignalPresent = false
    const loaded = await loadMediaBytes(`https://${allowedR2Host}/posters/valid.png`, {
      allowedHosts: [allowedR2Host],
      dnsLookup: publicDns,
      fetchImpl: async (_input, init) => {
        capturedRedirect = init?.redirect
        capturedSignalPresent = Boolean(init?.signal)
        return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      },
    })

    assert.equal(capturedRedirect, "error")
    assert.equal(capturedSignalPresent, true)
    assert.ok(loaded)
    assert.equal(loaded.mimeType, "image/png")
    assert.equal(loaded.bytes.byteLength, 4)
  })

  it("T-025d: escapes XSS / local-file iframe payloads and injects strict CSP meta in both multi-package and single-package poster HTML renderers", () => {
    const xssPayload = `"><script>fetch('file:///etc/passwd')</script><iframe src="http://169.254.169.254/latest/meta-data/"></iframe>`
    const attrBreakout = `javascript:alert(1)" onerror="fetch('/api/health')`

    const multiHtml = renderMultiPackagePosterHtml({
      postCode: `ART-XSS"><svg onload=alert(1)>`,
      airlineName: `Saudia ${xssPayload}`,
      airlineLogoUrl: attrBreakout,
      daysTitle: `15 DAYS <img src=x onerror=alert(1)>`,
      routePill: `LHE-JED-LHE"><script>evil()</script>`,
      outboundBaggage: `23 Kg <script>bad()</script>`,
      inboundBaggage: `46 Kg <iframe src="file:///proc/self/environ">`,
      giftedItems: [`Visa ${xssPayload}`, `Ziyarat "onclick="evil()`],
      packages: [
        {
          number: `01<script>`,
          outFlight: `SV-739"><img src=x>`,
          outDate: `14 OCT"><script>`,
          outRoute: `LHE-JED<svg onload=1>`,
          outDep: `04:00"`,
          outArr: `07:30<`,
          retFlight: `SV-738>`,
          retDate: `28 OCT&`,
          retRoute: `JED-LHE'`,
          retDep: `20:00`,
          retArr: `02:45`,
          makkahNights: `10N<script>`,
          makkahHotel: `Pullman Zamzam ${xssPayload}`,
          makkahDist: `(0M)"><iframe src="file:///etc/hosts">`,
          madinahNights: `05N`,
          madinahHotel: `Anwar Al Madinah ${xssPayload}`,
          madinahDist: `(50M)`,
          sharingPrice: `280,000<script>`,
          quadPrice: `0`,
          triplePrice: `315,000`,
          doublePrice: `360,000`,
        },
      ],
    })

    assert.ok(multiHtml.includes(`http-equiv="Content-Security-Policy"`))
    assert.ok(!multiHtml.includes("<script>"), "Multi-poster HTML must contain zero raw <script> tags")
    assert.ok(!multiHtml.includes("<iframe"), "Multi-poster HTML must contain zero raw <iframe> tags")
    assert.ok(!multiHtml.includes(`onerror="fetch`), "Multi-poster HTML must block javascript: / attribute breakouts")
    assert.ok(multiHtml.includes("&lt;script&gt;fetch(&#39;file:///etc/passwd&#39;)&lt;/script&gt;"))

    const singleHtml = renderSinglePackagePosterHtml({
      postCode: `ART-SV-15D-01"><script>alert(1)</script>`,
      cardNumber: `01"><svg onload=1>`,
      airlineName: `Saudia ${xssPayload}`,
      airlineLogoUrl: attrBreakout,
      daysTitle: `15 DAYS ${xssPayload}`,
      routePill: `LHE-JED`,
      outboundFlightNo: `SV-739"><script>`,
      outboundDateLabel: `14 OCT 2026`,
      outboundRoute: `LHE-JED`,
      outboundDepTime: `04:00`,
      outboundArrTime: `07:30`,
      returnFlightNo: `SV-738`,
      returnDateLabel: `28 OCT 2026`,
      returnRoute: `JED-LHE`,
      returnDepTime: `20:00`,
      returnArrTime: `02:45`,
      makkahNights: `10N`,
      makkahHotelName: `Swissotel Makkah ${xssPayload}`,
      makkahDistanceLabel: `0m Clock Tower`,
      madinahNights: `5N`,
      madinahHotelName: `Dar Al Taqwa ${xssPayload}`,
      madinahDistanceLabel: `20m Haram`,
      mealPlanLabel: `Breakfast ${xssPayload}`,
      outboundBaggage: `23 Kg ${xssPayload}`,
      inboundBaggage: ``,
      giftedItems: [`Umrah Visa ${xssPayload}`],
      sharingPricePkr: 0,
      quadPricePkr: 310_000,
      triplePricePkr: 340_000,
      doublePricePkr: 390_000,
    })

    assert.ok(singleHtml.includes(`http-equiv="Content-Security-Policy"`))
    assert.ok(!singleHtml.includes("<script>"), "Single-poster HTML must contain zero raw <script> tags")
    assert.ok(!singleHtml.includes("<iframe"), "Single-poster HTML must contain zero raw <iframe> tags")
    assert.ok(singleHtml.includes("&lt;script&gt;fetch(&#39;file:///etc/passwd&#39;)&lt;/script&gt;"))
    assert.ok(singleHtml.includes("On Request"), "0-PKR Sharing tier renders cleanly as On Request")
    assert.ok(singleHtml.includes("10 NIGHTS"), "10N normalizes to 10 NIGHTS without duplicate N NIGHTS")
    assert.ok(!singleHtml.includes("10N NIGHTS"))
  })
})
