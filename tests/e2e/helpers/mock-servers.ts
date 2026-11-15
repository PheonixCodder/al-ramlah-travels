import http from "node:http"
import sharp from "sharp"
import { E2E_GOTENBERG_API_KEY, E2E_MOCK_PORT } from "./env"

export interface RecordedMockRequest {
  id: number
  timestamp: string
  method: string
  path: string
  originalUrl: string | null
  headers: Record<string, string>
  bodyPreview: string
}

export interface FaultRule {
  target: "gotenberg" | "openrouter" | "meta"
  mode: "502_html" | "timeout_hang" | "none"
  remainingCount: number
}

const MAX_RECORDED_REQUESTS = 250

let cachedPosterPng1080x1520: Buffer | null = null
let cachedFlyerPng1200x1680: Buffer | null = null

async function getPosterPng1080x1520(): Promise<Buffer> {
  if (!cachedPosterPng1080x1520) {
    cachedPosterPng1080x1520 = await sharp({
      create: {
        width: 1080,
        height: 1520,
        channels: 4,
        background: { r: 6, g: 59, b: 45, alpha: 1 },
      },
    })
      .png()
      .toBuffer()
  }
  return cachedPosterPng1080x1520
}

async function getFlyerPng1200x1680(): Promise<Buffer> {
  if (!cachedFlyerPng1200x1680) {
    cachedFlyerPng1200x1680 = await sharp({
      create: {
        width: 1200,
        height: 1680,
        channels: 3,
        background: { r: 249, g: 246, b: 238 },
      },
    })
      .png()
      .toBuffer()
  }
  return cachedFlyerPng1200x1680
}

function buildMinimalValidPdf(titleText: string): Buffer {
  const safeTitle = titleText.replace(/[()\\]/g, "").slice(0, 80)
  const pdfContent = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj",
    `4 0 obj << /Length ${safeTitle.length + 34} >> stream`,
    `BT /F1 12 Tf 72 750 Td (${safeTitle}) Tj ET`,
    "endstream endobj",
    "xref",
    "0 5",
    "0000000000 65535 f ",
    "0000000009 00000 n ",
    "0000000058 00000 n ",
    "0000000115 00000 n ",
    "0000000202 00000 n ",
    "trailer << /Size 5 /Root 1 0 R >>",
    "startxref",
    "300",
    "%%EOF",
  ].join("\n")
  return Buffer.from(pdfContent, "utf8")
}

function readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  })
  res.end(body)
}

function buildFlyerExtractionJson(
  requestBodyText: string,
  lastFetchedAssetUrl: string
): Record<string, unknown> {
  const wantsMultiSheet =
    requestBodyText.includes("MULTI_SHEET_12_CARDS") ||
    lastFetchedAssetUrl.includes("multisheet-xss")
  const hasXssHotelProbe =
    requestBodyText.includes("<script>alert") ||
    lastFetchedAssetUrl.includes("multisheet-xss")
  const cardCount = wantsMultiSheet ? 12 : 2

  const cards = Array.from({ length: cardCount }, (_, idx) => {
    const num = String(idx + 1).padStart(2, "0")
    const isFirst = idx === 0
    return {
      cardNumber: num,
      postCode: requestBodyText.includes("ART-MODA-E2E")
        ? `ART-MODA-E2E-${num}`
        : null,
      outboundFlightNo: "SV 739",
      outboundDateLabel: "15 DEC 2026",
      outboundRoute: "LHE - JED",
      outboundDepTime: "04:15",
      outboundArrTime: "08:10",
      returnFlightNo: "SV 738",
      returnDateLabel: "29 DEC 2026",
      returnRoute: "MED - LHE",
      returnDepTime: "21:30",
      returnArrTime: "04:05",
      makkahNights: "08N",
      makkahHotelName:
        isFirst && hasXssHotelProbe
          ? '<script>alert("xss")</script>Al Kiswah Towers'
          : `Swissotel Al Maqam Tier ${num}`,
      makkahDistanceLabel: "150M",
      madinahNights: "06N",
      madinahHotelName: `Anwar Al Madinah Movenpick ${num}`,
      madinahDistanceLabel: "100M",
      mealPlanLabel: "Breakfast Included",
      transportLabel: "Haramain Luxury Bus",
      tier: isFirst ? "gold" : "silver",
      childPricePkr: 195000,
      infantPricePkr: 68000,
      pricingBasis: "per_person",
      // Card 01 explicitly preserves 0 ("On Request") on Sharing tier (`J10`)
      sharingPricePkr: isFirst ? 0 : 245000,
      quadPricePkr: 260000 + idx * 5000,
      triplePricePkr: 285000 + idx * 5000,
      doublePricePkr: 320000 + idx * 5000,
    }
  })

  return {
    title: wantsMultiSheet
      ? "DECEMBER MULTI-SHEET UMRAH COLLECTION"
      : "DECEMBER HARAMAIN SIGNATURE PACKAGES",
    airlineName: "Saudia",
    airlineIataCode: "SV",
    airlineLogoUrl: null,
    durationDays: 14,
    daysTitle: "14 DAYS UMRAH",
    routePill: "LHE - JED / MED - LHE",
    departureCityCode: "LHE",
    arrivalAirportCode: "JED",
    returnAirportCode: "MED",
    outboundBaggage: "2 x 23 Kg + 7 Kg",
    inboundBaggage: "2 x 23 Kg + 5L Zamzam",
    giftedInclusions: ["Umrah Visa", "Luxury Transport", "Complete Ziyarat"],
    cards,
  }
}

export async function startE2eMockServer(
  port: number = E2E_MOCK_PORT
): Promise<http.Server> {
  const recordedRequests: RecordedMockRequest[] = []
  let nextReqId = 1
  let activeFault: FaultRule | null = null
  let lastFetchedAssetUrl = ""
  const igContainerPollCounts = new Map<string, number>()

  const consumeFaultIfMatching = (
    target: FaultRule["target"],
    res: http.ServerResponse
  ): boolean => {
    if (
      !activeFault ||
      activeFault.target !== target ||
      activeFault.remainingCount <= 0 ||
      activeFault.mode === "none"
    ) {
      return false
    }

    activeFault.remainingCount -= 1
    if (activeFault.mode === "502_html") {
      const html =
        "<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway — nginx</h1></body></html>"
      res.writeHead(502, {
        "content-type": "text/html; charset=utf-8",
        "content-length": Buffer.byteLength(html),
      })
      res.end(html)
      return true
    }

    if (activeFault.mode === "timeout_hang") {
      // Destroy socket after brief delay to simulate upstream ECONNRESET / abort cleanly without hanging tests 45s
      setTimeout(() => {
        res.destroy()
      }, 250)
      return true
    }

    return false
  }

  const server = http.createServer(async (req, res) => {
    try {
      const rawUrl = req.url || "/"
      const parsedUrl = new URL(rawUrl, `http://127.0.0.1:${port}`)
      const pathname = parsedUrl.pathname
      const method = (req.method || "GET").toUpperCase()

      if (pathname === "/health" && method === "GET") {
        sendJson(res, 200, { status: "up" })
        return
      }

      if (pathname === "/__mock/requests" && method === "GET") {
        const filterTarget = parsedUrl.searchParams.get("contains")
        const items = filterTarget
          ? recordedRequests.filter(
              (r) =>
                r.path.includes(filterTarget) ||
                (r.originalUrl && r.originalUrl.includes(filterTarget))
            )
          : recordedRequests
        sendJson(res, 200, { requests: items })
        return
      }

      if (pathname === "/__mock/requests" && method === "DELETE") {
        recordedRequests.length = 0
        igContainerPollCounts.clear()
        activeFault = null
        sendJson(res, 200, { cleared: true })
        return
      }

      const bodyBuffer = await readRequestBody(req)
      const bodyText = bodyBuffer.toString("utf8")

      if (pathname === "/__mock/fault" && method === "POST") {
        const parsed = JSON.parse(bodyText || "{}") as Partial<FaultRule>
        if (
          (parsed.target === "gotenberg" ||
            parsed.target === "openrouter" ||
            parsed.target === "meta") &&
          (parsed.mode === "502_html" ||
            parsed.mode === "timeout_hang" ||
            parsed.mode === "none")
        ) {
          activeFault = {
            target: parsed.target,
            mode: parsed.mode,
            remainingCount:
              typeof parsed.remainingCount === "number"
                ? parsed.remainingCount
                : 1,
          }
          sendJson(res, 200, { ok: true, activeFault })
          return
        }
        sendJson(res, 400, { error: "Invalid fault rule" })
        return
      }

      const normalizedHeaders: Record<string, string> = {}
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string") {
          normalizedHeaders[k.toLowerCase()] = v
        } else if (Array.isArray(v)) {
          normalizedHeaders[k.toLowerCase()] = v.join(", ")
        }
      }

      recordedRequests.push({
        id: nextReqId++,
        timestamp: new Date().toISOString(),
        method,
        path: `${pathname}${parsedUrl.search}`,
        originalUrl: normalizedHeaders["x-mock-original-url"] ?? null,
        headers: normalizedHeaders,
        bodyPreview: bodyText.slice(0, 250_000),
      })
      if (recordedRequests.length > MAX_RECORDED_REQUESTS) {
        recordedRequests.shift()
      }

      // 1. Gotenberg HTML -> PNG Screenshot & HTML -> PDF Conversion
      if (
        pathname === "/forms/chromium/screenshot/html" ||
        pathname === "/forms/chromium/convert/html"
      ) {
        if (consumeFaultIfMatching("gotenberg", res)) return

        const apiKey = normalizedHeaders["x-gotenberg-api-key"]
        if (apiKey !== E2E_GOTENBERG_API_KEY) {
          sendJson(res, 401, { error: "Missing or invalid X-Gotenberg-Api-Key" })
          return
        }

        if (pathname === "/forms/chromium/screenshot/html") {
          const png = await getPosterPng1080x1520()
          res.writeHead(200, {
            "content-type": "image/png",
            "content-length": png.byteLength,
          })
          res.end(png)
          return
        }

        const pdf = buildMinimalValidPdf("Al Ramlah Travels Luxury Quotation")
        res.writeHead(200, {
          "content-type": "application/pdf",
          "content-length": pdf.byteLength,
        })
        res.end(pdf)
        return
      }

      // 2. Intercepted R2 / CDN Studio Media Assets & Seeded Unsplash Images
      if (
        pathname.startsWith("/__upstream/assets.alramlahtravels.com/") ||
        pathname.startsWith("/__upstream/r2.alramlahtravels.com/") ||
        pathname.startsWith("/__upstream/pub-audit-test.r2.dev/") ||
        pathname.startsWith("/__upstream/images.unsplash.com/") ||
        pathname.startsWith("/__upstream/plus.unsplash.com/")
      ) {
        if (
          pathname.startsWith("/__upstream/assets.alramlahtravels.com/") ||
          pathname.startsWith("/__upstream/r2.alramlahtravels.com/")
        ) {
          lastFetchedAssetUrl = `${pathname}${parsedUrl.search}`
        }
        const png = await getFlyerPng1200x1680()
        res.writeHead(200, {
          "content-type": "image/png",
          "content-length": png.byteLength,
        })
        res.end(png)
        return
      }

      // 3. Intercepted OpenRouter Chat Completions
      if (pathname.startsWith("/__upstream/openrouter.ai/")) {
        if (consumeFaultIfMatching("openrouter", res)) return

        let structuredContent: Record<string, unknown>
        if (
          bodyText.includes("hospitalityCustomerIntro") ||
          bodyText.includes("executiveNarrativeNote")
        ) {
          structuredContent = {
            matchedPackageCode: null,
            matchedBatchCode: null,
            recommendedRoomSplit: "quad",
            recommendedHotelIds: [],
            executiveNarrativeNote:
              "Catalog-verified Umrah itinerary prepared for {{PILGRIM_NAME}} with Haramain hospitality.",
            hospitalityCustomerIntro:
              "Assalamu Alaikum {{PILGRIM_NAME}}, Al Ramlah Travels is honored to prepare your bespoke Haramain Umrah itinerary from Lahore.",
            confidence: "high",
          }
        } else if (bodyText.includes("hospitalityGreetingAndNotes")) {
          structuredContent = {
            matchedPackageCode: null,
            matchedBatchCode: null,
            recommendedRoomSplit: "quad",
            detectedIntentSummary: "Umrah package consultation request",
            hospitalityGreetingAndNotes:
              "Assalamu Alaikum {{PILGRIM_NAME}}, JazakAllah Khair for reaching Al Ramlah Travels Askari 10 concierge.",
            confidence: "high",
          }
        } else {
          structuredContent = buildFlyerExtractionJson(
            bodyText,
            lastFetchedAssetUrl
          )
        }

        sendJson(res, 200, {
          id: `chatcmpl_e2e_${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "google/gemini-2.5-flash",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify(structuredContent),
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 180,
            completion_tokens: 140,
            total_tokens: 320,
          },
        })
        return
      }

      // 4. Intercepted Meta Graph API (WhatsApp Cloud API + Facebook/Instagram OAuth & Publishing)
      if (pathname.startsWith("/__upstream/graph.facebook.com/")) {
        if (consumeFaultIfMatching("meta", res)) return

        const graphPath = pathname.replace("/__upstream/graph.facebook.com", "")

        if (graphPath.endsWith("/oauth/access_token")) {
          sendJson(res, 200, {
            access_token: "fb_user_long_lived_e2e_token",
            token_type: "bearer",
            expires_in: 5184000,
          })
          return
        }

        if (graphPath.endsWith("/me/accounts") && method === "GET") {
          sendJson(res, 200, {
            data: [
              {
                id: "fb_page_e2e_101",
                name: "Al Ramlah Travels Official",
                access_token: "fb_page_token_e2e_101",
                category: "Travel Agency",
                picture: {
                  data: { url: "https://assets.alramlahtravels.com/logo-1.png" },
                },
                instagram_business_account: {
                  id: "ig_biz_e2e_201",
                  username: "alramlahtravels",
                  name: "Al Ramlah Travels",
                },
              },
              {
                id: "fb_page_e2e_102",
                name: "Al Ramlah Haramain VIP",
                access_token: "fb_page_token_e2e_102",
                category: "Tour Agency",
                picture: {
                  data: { url: "https://assets.alramlahtravels.com/logo-2.png" },
                },
              },
            ],
          })
          return
        }

        if (graphPath.endsWith("/messages") && method === "POST") {
          sendJson(res, 200, {
            messaging_product: "whatsapp",
            contacts: [{ input: "+923001234567", wa_id: "923001234567" }],
            messages: [
              {
                id: `wamid.e2e_out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              },
            ],
          })
          return
        }

        if (graphPath.endsWith("/message_templates") && method === "POST") {
          sendJson(res, 200, {
            id: `meta_tpl_${Date.now()}`,
            status: "APPROVED",
            category: "MARKETING",
          })
          return
        }

        if (graphPath.endsWith("/message_templates") && method === "GET") {
          sendJson(res, 200, { data: [] })
          return
        }

        if (graphPath.includes("/media_bytes/") && method === "GET") {
          const png = await getFlyerPng1200x1680()
          res.writeHead(200, {
            "content-type": "image/png",
            "content-length": png.byteLength,
          })
          res.end(png)
          return
        }

        if (graphPath.endsWith("/media_e2e_pilgrim_img") && method === "GET") {
          sendJson(res, 200, {
            id: "media_e2e_pilgrim_img",
            url: "https://graph.facebook.com/v21.0/media_bytes/media_e2e_pilgrim_img",
            mime_type: "image/png",
            sha256: "e2e_sha256",
            file_size: 2048,
          })
          return
        }

        // Instagram Graph API container creation -> polling -> publish
        if (graphPath.endsWith("/media") && method === "POST") {
          sendJson(res, 200, { id: "ig_container_e2e_reel_1" })
          return
        }

        if (
          graphPath.endsWith("/ig_container_e2e_reel_1") &&
          method === "GET"
        ) {
          const prev = igContainerPollCounts.get("ig_container_e2e_reel_1") ?? 0
          const next = prev + 1
          igContainerPollCounts.set("ig_container_e2e_reel_1", next)
          const statusCode = next === 1 ? "IN_PROGRESS" : "FINISHED"
          sendJson(res, 200, {
            id: "ig_container_e2e_reel_1",
            status_code: statusCode,
            status: statusCode,
          })
          return
        }

        if (graphPath.endsWith("/media_publish") && method === "POST") {
          sendJson(res, 200, { id: "ig_published_e2e_reel_999" })
          return
        }

        if (
          graphPath.endsWith("/ig_published_e2e_reel_999") &&
          method === "GET"
        ) {
          const requestedFields = parsedUrl.searchParams.get("fields") ?? ""
          if (requestedFields.includes("like_count")) {
            sendJson(res, 400, {
              error: {
                message: "Application does not have permission for insights/metrics",
                type: "OAuthException",
                code: 10,
              },
            })
            return
          }
          sendJson(res, 200, {
            id: "ig_published_e2e_reel_999",
            permalink: "https://www.instagram.com/reel/E2EReel999/",
          })
          return
        }

        if (graphPath.endsWith("/comments") && method === "POST") {
          sendJson(res, 200, { id: `ig_comment_${Date.now()}` })
          return
        }

        if (graphPath.includes("/insights") && method === "GET") {
          sendJson(res, 400, {
            error: {
              message: "Insights metric unavailable for recently published media",
              type: "OAuthException",
              code: 100,
            },
          })
          return
        }

        // Default Graph GET phone / profile check
        sendJson(res, 200, {
          id: "e2e_graph_node",
          display_phone_number: "+92 300 0000001",
          verified_name: "Al Ramlah Travels E2E",
          quality_rating: "GREEN",
          status: "CONNECTED",
          platform_type: "CLOUD_API",
        })
        return
      }

      sendJson(res, 404, { error: `Unhandled mock route: ${method} ${pathname}` })
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : "Mock server error",
      })
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => resolve())
  })

  return server
}
