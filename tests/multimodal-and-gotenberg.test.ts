import { describe, it, beforeEach, afterEach, after } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import {
  parseFlyerDateLabelsToIso,
  extractPackagesMultimodal,
  rawAiFlyerResultSchema,
} from "../lib/ai/extract-packages"
import {
  createPresignedUploadUrl,
  optimizePosterForSocialToR2,
} from "../lib/storage/r2"
import { checkGotenbergHealth } from "../lib/posters/gotenberg"

const originalEnv = { ...process.env }
const originalFetch = globalThis.fetch

// ============================================================================
// 1. DETERMINISTIC FLYER DATE LABELS TO ISO CONVERTER
// ============================================================================

describe("parseFlyerDateLabelsToIso", () => {
  it("parses standard month-day labels for a fixed reference year", () => {
    const res = parseFlyerDateLabelsToIso("14 NOV", "04 DEC", 21, 2026)
    assert.equal(res.outboundIsoDate, "2026-11-14")
    assert.equal(res.returnIsoDate, "2026-12-04")
  })

  it("handles single-digit days with leading zero padding", () => {
    const res = parseFlyerDateLabelsToIso("3 NOV", "4 DEC", 21, 2026)
    assert.equal(res.outboundIsoDate, "2026-11-03")
    assert.equal(res.returnIsoDate, "2026-12-04")
  })

  it("parses labels with explicit embedded years", () => {
    const res = parseFlyerDateLabelsToIso(
      "14 NOV 2026",
      "04 DEC 2026",
      21,
      2025
    )
    assert.equal(res.outboundIsoDate, "2026-11-14")
    assert.equal(res.returnIsoDate, "2026-12-04")
  })

  it("parses full month names (case-insensitive)", () => {
    const res = parseFlyerDateLabelsToIso(
      "14 November",
      "4 December",
      21,
      2026
    )
    assert.equal(res.outboundIsoDate, "2026-11-14")
    assert.equal(res.returnIsoDate, "2026-12-04")
  })

  it("parses month-first formats (e.g. 'NOV 14', 'DEC 04')", () => {
    const res = parseFlyerDateLabelsToIso("NOV 14", "DEC 04", 21, 2026)
    assert.equal(res.outboundIsoDate, "2026-11-14")
    assert.equal(res.returnIsoDate, "2026-12-04")
  })

  it("parses hyphenated and slash date formats ('10-NOV', '25 DEC')", () => {
    const resHyphen = parseFlyerDateLabelsToIso(
      "10-NOV",
      "25 DEC",
      15,
      2026
    )
    assert.equal(resHyphen.outboundIsoDate, "2026-11-10")
    assert.equal(resHyphen.returnIsoDate, "2026-12-25")

    const resSlash = parseFlyerDateLabelsToIso("10/11", "25/12", 15, 2026)
    assert.equal(resSlash.outboundIsoDate, "2026-11-10")
    assert.equal(resSlash.returnIsoDate, "2026-12-25")
  })

  it("accurately rolls return year forward across December-to-January boundary ('20 DEC' -> '09 JAN')", () => {
    const res = parseFlyerDateLabelsToIso("20 DEC", "09 JAN", 21, 2026)
    assert.equal(res.outboundIsoDate, "2026-12-20")
    assert.equal(res.returnIsoDate, "2027-01-09")
  })

  it("rolls return year forward for end-of-year flight dates ('31 DEC' -> '15 JAN')", () => {
    const res = parseFlyerDateLabelsToIso("31 DEC", "15 JAN", 15, 2026)
    assert.equal(res.outboundIsoDate, "2026-12-31")
    assert.equal(res.returnIsoDate, "2027-01-15")
  })

  it("falls back to outboundIsoDate + durationDays when returnDateLabel is empty", () => {
    const res = parseFlyerDateLabelsToIso("14 NOV", "", 21, 2026)
    assert.equal(res.outboundIsoDate, "2026-11-14")
    // Nov has 30 days -> 14 + 21 = 35 -> Dec 5
    assert.equal(res.returnIsoDate, "2026-12-05")
  })

  it("falls back to durationDays calculation when returnDateLabel is unparseable text", () => {
    const res = parseFlyerDateLabelsToIso(
      "14 NOV",
      "Subject to moon sighting",
      15,
      2026
    )
    assert.equal(res.outboundIsoDate, "2026-11-14")
    // 14 + 15 = 29 Nov
    assert.equal(res.returnIsoDate, "2026-11-29")
  })

  it("computes durationDays fallback crossing year-end boundary ('20 DEC' + 15 days -> 2027-01-04)", () => {
    const res = parseFlyerDateLabelsToIso("20 DEC", "", 15, 2026)
    assert.equal(res.outboundIsoDate, "2026-12-20")
    assert.equal(res.returnIsoDate, "2027-01-04")
  })

  it("gracefully returns valid current calendar dates when outbound label is completely unparseable", () => {
    const res = parseFlyerDateLabelsToIso("UNPARSEABLE_DATE", "", 15)
    assert.match(res.outboundIsoDate, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(res.returnIsoDate, /^\d{4}-\d{2}-\d{2}$/)
    assert.notEqual(res.outboundIsoDate, res.returnIsoDate)
  })
})

// ============================================================================
// 2. R2 PRESIGNED UPLOAD URL & LOCAL DEV FALLBACK
// ============================================================================

describe("createPresignedUploadUrl (Offline / Local Dev Fallback)", () => {
  beforeEach(() => {
    delete process.env.R2_ACCOUNT_ID
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY
    delete process.env.R2_PUBLIC_URL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("returns mode 'local_put' and local upload endpoints when R2 env vars are absent", async () => {
    const res = await createPresignedUploadUrl({
      filename: "sample-flyer.png",
      contentType: "image/png",
    })

    assert.equal(res.mode, "local_put")
    assert.equal(res.expiresInSeconds, 900)
    assert.ok(
      res.uploadUrl.startsWith("/api/uploads/local?key="),
      `Expected uploadUrl to start with /api/uploads/local?key=, got ${res.uploadUrl}`
    )
    assert.ok(
      res.publicUrl.startsWith("/uploads/r2-local/"),
      `Expected publicUrl to start with /uploads/r2-local/, got ${res.publicUrl}`
    )
    assert.equal(
      res.uploadUrl,
      `/api/uploads/local?key=${encodeURIComponent(res.key)}`
    )
    assert.equal(res.publicUrl, `/uploads/r2-local/${res.key}`)
  })

  it("sanitizes filename and isolates assets by target folder", async () => {
    const res = await createPresignedUploadUrl({
      filename: "Raw Supplier Flyer (Nov 2026) #1.jpg",
      contentType: "image/jpeg",
      folder: "posters/social",
    })

    assert.equal(res.mode, "local_put")
    assert.ok(
      res.key.startsWith("posters/social/"),
      `Key should start with sanitized folder path, got ${res.key}`
    )
    assert.ok(
      res.key.endsWith("Raw_Supplier_Flyer__Nov_2026___1.jpg"),
      `Key should have spaces and hashes sanitized, got ${res.key}`
    )
  })

  it("defaults folder to 'uploads' when folder option is omitted", async () => {
    const res = await createPresignedUploadUrl({
      filename: "test.pdf",
      contentType: "application/pdf",
    })

    assert.ok(
      res.key.startsWith("uploads/"),
      `Expected default folder 'uploads/', got ${res.key}`
    )
  })
})

// ============================================================================
// 3. SHARP 4K POSTER TO SOCIAL OPTIMIZER
// ============================================================================

describe("optimizePosterForSocialToR2", () => {
  const testOutputDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "r2-local",
    "tests-slice27"
  )

  beforeEach(() => {
    delete process.env.R2_ACCOUNT_ID
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  after(async () => {
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true })
    } catch {
      // Best-effort directory cleanup
    }
  })

  it("resizes 3240x4560 4K poster in memory to 1080x1520 progressive social JPEG", async () => {
    // Generate an in-memory 3240x4560 PNG buffer via sharp
    const bigPosterBuffer = await sharp({
      create: {
        width: 3240,
        height: 4560,
        channels: 3,
        background: { r: 15, g: 23, b: 42 },
      },
    })
      .png()
      .toBuffer()

    const result = await optimizePosterForSocialToR2(
      bigPosterBuffer,
      "tests-slice27/poster-portrait-4k"
    )

    // Invariant: shortest dimension must be <= 1080 (specifically 1080x1520)
    assert.ok(
      Math.min(result.width, result.height) <= 1080,
      `Expected shortest dimension <= 1080, got ${result.width}x${result.height}`
    )
    assert.equal(result.width, 1080)
    assert.equal(result.height, 1520)
    assert.equal(
      result.key,
      "tests-slice27/poster-portrait-4k_social.jpg"
    )
    assert.equal(
      result.socialJpegUrl,
      "/uploads/r2-local/tests-slice27/poster-portrait-4k_social.jpg"
    )
    assert.ok(result.sizeBytes > 0)

    // Verify written file on disk is a valid JPEG
    const diskPath = path.join(
      process.cwd(),
      "public",
      result.socialJpegUrl.replace(/^\//, "")
    )
    const diskMeta = await sharp(diskPath).metadata()
    assert.equal(diskMeta.format, "jpeg")
    assert.equal(diskMeta.width, 1080)
    assert.equal(diskMeta.height, 1520)
  })

  it("resizes landscape 4560x3240 poster so shortest dimension is <= 1080 (1520x1080)", async () => {
    const landscapeBuffer = await sharp({
      create: {
        width: 4560,
        height: 3240,
        channels: 3,
        background: { r: 24, g: 30, b: 45 },
      },
    })
      .png()
      .toBuffer()

    const result = await optimizePosterForSocialToR2(
      landscapeBuffer,
      "tests-slice27/poster-landscape-4k"
    )

    assert.ok(Math.min(result.width, result.height) <= 1080)
    assert.equal(result.height, 1080)
    assert.equal(result.width, 1520)
    assert.ok(result.key.endsWith("_social.jpg"))
  })

  it("preserves dimensions when image shortest side is already <= 1080", async () => {
    const smallBuffer = await sharp({
      create: {
        width: 800,
        height: 1200,
        channels: 3,
        background: { r: 40, g: 40, b: 40 },
      },
    })
      .png()
      .toBuffer()

    const result = await optimizePosterForSocialToR2(
      smallBuffer,
      "tests-slice27/poster-small"
    )

    assert.ok(Math.min(result.width, result.height) <= 1080)
    assert.equal(result.width, 800)
    assert.equal(result.height, 1200)
  })
})

// ============================================================================
// 4. MULTIMODAL EXTRACTION: OFFLINE PRESET FALLBACK & MODE A / B SHAPE INVARIANTS
// ============================================================================

describe("extractPackagesMultimodal (Offline Presets & Mode Invariants)", () => {
  beforeEach(() => {
    // Force zero-key offline dev mode so extraction triggers presets deterministically when allowOfflineMockForTests is set
    delete process.env.OPENROUTER_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("strictly throws descriptive error in production mode when AI models fail and allowOfflineMockForTests is omitted", async () => {
    await assert.rejects(
      async () => {
        await extractPackagesMultimodal({
          supplierSlug: "ammaar",
          ingestionMode: "raw_supplier_flyer",
        })
      },
      /Multimodal package extraction failed/
    )
  })

  it("falls back to Ammaar Airblue 21-day preset when allowOfflineMockForTests is explicitly enabled with Mode B included_in_flyer commission", async () => {
    const res = await extractPackagesMultimodal({
      supplierSlug: "ammaar",
      ingestionMode: "raw_supplier_flyer",
      commissionMode: "included_in_flyer",
      commissionPkr: 22000,
      allowOfflineMockForTests: true,
    })

    assert.equal(res.airlineName, "Airblue")
    assert.equal(res.airlineIataCode, "PA")
    assert.equal(res.durationDays, 21)
    assert.equal(res.daysTitle, "21 DAYS")
    assert.equal(res.departureCityCode, "LHE")
    assert.equal(res.ingestionMode, "raw_supplier_flyer")
    assert.equal(res.modelUsed, "supplier_preset_offline")
    assert.ok(res.cards.length >= 3)

    const firstCard = res.cards[0]!
    assert.equal(firstCard.cardNumber, "01")
    assert.equal(firstCard.outboundFlightNo, "PA 470")
    assert.match(firstCard.departureDate, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(firstCard.returnDate, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(firstCard.makkahHotelName.length > 0)
    assert.ok(firstCard.madinahHotelName.length > 0)

    // Pricing invariant for Mode B included_in_flyer: retail = raw, net = raw - commission
    assert.equal(firstCard.retailSharingPkr, firstCard.rawSharingPkr)
    assert.equal(
      firstCard.netSharingPkr,
      Math.max(0, firstCard.rawSharingPkr - 22000)
    )
    assert.equal(firstCard.retailQuadPkr, firstCard.rawQuadPkr)
    assert.equal(
      firstCard.netQuadPkr,
      Math.max(0, firstCard.rawQuadPkr - 22000)
    )
    assert.equal(firstCard.retailTriplePkr, firstCard.rawTriplePkr)
    assert.equal(
      firstCard.netTriplePkr,
      Math.max(0, firstCard.rawTriplePkr - 22000)
    )
    assert.equal(firstCard.retailDoublePkr, firstCard.rawDoublePkr)
    assert.equal(
      firstCard.netDoublePkr,
      Math.max(0, firstCard.rawDoublePkr - 22000)
    )
  })

  it("falls back to Upsky Saudia 15-day preset with Mode B net_plus_markup commission when allowOfflineMockForTests is set", async () => {
    const res = await extractPackagesMultimodal({
      supplierSlug: "upsky",
      ingestionMode: "raw_supplier_flyer",
      commissionMode: "net_plus_markup",
      commissionPkr: 25000,
      allowOfflineMockForTests: true,
    })

    assert.ok(
      res.airlineName.toLowerCase().includes("saudia") ||
        res.airlineName.toLowerCase().includes("saudi"),
      `Expected Saudia airline name, got ${res.airlineName}`
    )
    assert.equal(res.airlineIataCode, "SV")
    assert.equal(res.durationDays, 15)
    assert.equal(res.daysTitle, "15 DAYS")
    assert.ok(res.cards.length >= 1)

    const firstCard = res.cards[0]!
    // Pricing invariant for Mode B net_plus_markup: net = raw, retail = raw + commission
    assert.equal(firstCard.netSharingPkr, firstCard.rawSharingPkr)
    assert.equal(firstCard.retailSharingPkr, firstCard.rawSharingPkr + 25000)
    assert.equal(firstCard.retailSharingPkr - firstCard.netSharingPkr, 25000)

    assert.equal(firstCard.netQuadPkr, firstCard.rawQuadPkr)
    assert.equal(firstCard.retailQuadPkr, firstCard.rawQuadPkr + 25000)
    assert.equal(firstCard.retailQuadPkr - firstCard.netQuadPkr, 25000)

    assert.equal(firstCard.netTriplePkr, firstCard.rawTriplePkr)
    assert.equal(firstCard.retailTriplePkr, firstCard.rawTriplePkr + 25000)
    assert.equal(firstCard.retailTriplePkr - firstCard.netTriplePkr, 25000)

    assert.equal(firstCard.netDoublePkr, firstCard.rawDoublePkr)
    assert.equal(firstCard.retailDoublePkr, firstCard.rawDoublePkr + 25000)
    assert.equal(firstCard.retailDoublePkr - firstCard.netDoublePkr, 25000)
  })

  it("selects Saudia preset when mediaUrl mentions 'saudia' with allowOfflineMockForTests", async () => {
    const res = await extractPackagesMultimodal({
      mediaUrl: "https://example.com/saudia-umrah-flyer.png",
      ingestionMode: "raw_supplier_flyer",
      allowOfflineMockForTests: true,
    })

    assert.equal(res.airlineIataCode, "SV")
    assert.equal(res.durationDays, 15)
  })

  it("preserves Mode A (gemini_ultra_poster) ingestionMode and structure shape with allowOfflineMockForTests", async () => {
    const res = await extractPackagesMultimodal({
      ingestionMode: "gemini_ultra_poster",
      commissionPkr: 20000,
      allowOfflineMockForTests: true,
    })

    assert.equal(res.ingestionMode, "gemini_ultra_poster")
    assert.ok(Array.isArray(res.giftedInclusions))
    assert.ok(res.giftedInclusions.length > 0)
    assert.ok(res.cards.length > 0)
    for (const card of res.cards) {
      assert.ok(typeof card.retailSharingPkr === "number")
      assert.ok(typeof card.netSharingPkr === "number")
      assert.ok(typeof card.departureDate === "string")
      assert.ok(typeof card.returnDate === "string")
      assert.ok(card.outboundFlightNo.length > 0)
    }
  })

  it("validates Mode A Al Ramlah 4K poster output against rawAiFlyerResultSchema", () => {
    const sampleModeAPosterPayload = {
      title: "Al Ramlah Travels 21-Day Premium Umrah",
      airlineName: "Airblue",
      airlineIataCode: "PA",
      airlineLogoUrl: "https://images.kiwi.com/airlines/64/PA.png",
      durationDays: 21,
      daysTitle: "21 DAYS",
      routePill: "LHE - JED | JED - LHE",
      departureCityCode: "LHE",
      arrivalAirportCode: "JED",
      returnAirportCode: "JED",
      outboundBaggage: "20 Kg + 7 Kg",
      inboundBaggage: "30 Kg + 7 Kg + 5 Ltr Zamzam",
      giftedInclusions: [
        "Visa",
        "Insurance",
        "Hotel",
        "Return Ticket",
        "Transport",
      ],
      cards: [
        {
          cardNumber: "01",
          postCode: "ART-2026-0001",
          outboundFlightNo: "PA 470",
          outboundDateLabel: "03 NOV",
          outboundRoute: "LHE - JED",
          outboundDepTime: "06:35",
          outboundArrTime: "10:35",
          returnFlightNo: "PA 471",
          returnDateLabel: "24 NOV",
          returnRoute: "JED - LHE",
          returnDepTime: "11:35",
          returnArrTime: "18:20",
          makkahNights: "15N",
          makkahHotelName: "Fajr Al Badea 2",
          makkahDistanceLabel: "(Shuttle)",
          madinahNights: "05N",
          madinahHotelName: "Burj Al Mukhtara",
          madinahDistanceLabel: "(600M)",
          mealPlanLabel: "Room Only",
          sharingPricePkr: 261899,
          quadPricePkr: 267899,
          triplePricePkr: 278899,
          doublePricePkr: 301899,
        },
      ],
    }

    const parsed = rawAiFlyerResultSchema.parse(sampleModeAPosterPayload)
    assert.equal(parsed.title, sampleModeAPosterPayload.title)
    assert.equal(parsed.cards[0]!.postCode, "ART-2026-0001")
    assert.equal(parsed.cards[0]!.sharingPricePkr, 261899)
  })

  it("rejects invalid flyer payloads with empty cards list or missing required fields", () => {
    const invalidPayload = {
      title: "Missing Cards Flyer",
      airlineName: "Airblue",
      airlineIataCode: "PA",
      durationDays: 21,
      daysTitle: "21 DAYS",
      routePill: "LHE - JED",
      departureCityCode: "LHE",
      cards: [],
    }

    assert.throws(
      () => rawAiFlyerResultSchema.parse(invalidPayload),
      /too_small|Too small|cards/i
    )
  })
})

// ============================================================================
// 5. GOTENBERG HEALTH CONNECTIVITY & FALLBACKS
// ============================================================================

describe("checkGotenbergHealth", () => {
  beforeEach(() => {
    delete process.env.GOTENBERG_API_URL
    delete process.env.GOTENBERG_API_KEY
    globalThis.fetch = originalFetch
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    globalThis.fetch = originalFetch
  })

  it("reports unconfigured status with 0ms latency when GOTENBERG_API_URL is absent", async () => {
    const health = await checkGotenbergHealth()
    assert.equal(health.ok, false)
    assert.equal(health.latencyMs, 0)
    assert.ok(
      health.message.includes("GOTENBERG_API_URL is not configured"),
      `Expected unconfigured message, got ${health.message}`
    )
  })

  it("reports healthy status when Gotenberg microservice returns 200 OK", async () => {
    process.env.GOTENBERG_API_URL = "https://gotenberg.internal:3000"
    process.env.GOTENBERG_API_KEY = "test-secret-key"

    let capturedUrl = ""
    let capturedHeader = ""

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedHeader = (init?.headers as Record<string, string>)?.[
        "X-Gotenberg-Api-Key"
      ] || ""
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ status: "up" }),
      } as Response
    }) as typeof fetch

    const health = await checkGotenbergHealth()
    assert.equal(health.ok, true)
    assert.equal(capturedUrl, "https://gotenberg.internal:3000/health")
    assert.equal(capturedHeader, "test-secret-key")
    assert.ok(health.message.includes("status: up"))
    assert.equal(health.endpoint, "https://gotenberg.internal:3000")
  })

  it("reports failure when Gotenberg returns HTTP 503 Service Unavailable", async () => {
    process.env.GOTENBERG_API_URL = "https://gotenberg.internal:3000"

    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      } as Response
    }) as typeof fetch

    const health = await checkGotenbergHealth()
    assert.equal(health.ok, false)
    assert.ok(health.message.includes("HTTP 503"))
  })

  it("handles network connection rejection gracefully without unhandled errors", async () => {
    process.env.GOTENBERG_API_URL = "https://gotenberg.internal:3000"

    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED 10.0.0.1:3000")
    }) as typeof fetch

    const health = await checkGotenbergHealth()
    assert.equal(health.ok, false)
    assert.ok(health.message.includes("ECONNREFUSED"))
  })
})
