import http from "node:http"
import type { AddressInfo } from "node:net"

export interface RecordedAiPromptCall {
  url: string
  model: string | null
  rawPromptText: string
  hasZdrOption: boolean
}

export interface PiiInspectionReport {
  clean: boolean
  leakedEmails: string[]
  leakedPhones: string[]
  leakedCnics: string[]
  leakedKnownNames: string[]
}

export interface AiOpenRouterFakeOptions {
  forbiddenPilgrimNames?: string[]
}

export interface AiOpenRouterFakeServer {
  baseUrl: string
  port: number
  calls: RecordedAiPromptCall[]
  fetchHandler: typeof fetch
  setNextStructuredJson: (jsonPayload: Record<string, unknown> | null) => void
  injectFaultStatus: (statusCode: number | null, message?: string) => void
  inspectRecordedPrompts: (extraForbiddenNames?: string[]) => PiiInspectionReport
  reset: () => void
  close: () => Promise<void>
}

const DEFAULT_EXTRACTION_JSON: Record<string, unknown> = {
  flyerTitle: "15 Days Executive Umrah Group",
  airlineName: "Saudia",
  airlineIataCode: "SV",
  departureCityCode: "LHE",
  durationDays: 15,
  routeSummary: "LHE - JED - MED - LHE",
  packages: [
    {
      cardNumber: "01",
      outboundFlightNo: "SV-739",
      outboundDateLabel: "15 Nov 2026",
      outboundRoute: "LHE - JED",
      returnFlightNo: "SV-738",
      returnDateLabel: "29 Nov 2026",
      returnRoute: "MED - LHE",
      makkahHotelName: "Swissotel Makkah",
      makkahDistanceLabel: "0m Clock Tower",
      makkahNights: "7",
      madinahHotelName: "Anwar Al Madinah Movenpick",
      madinahDistanceLabel: "50m Haram",
      madinahNights: "7",
      mealPlanLabel: "Breakfast Included",
      netSharingPkr: 240000,
      netQuadPkr: 260000,
      netTriplePkr: 285000,
      netDoublePkr: 320000,
    },
  ],
}

const DEFAULT_WA_COPILOT_NARRATIVE_JSON: Record<string, unknown> = {
  matchedPackageCode: "ART-SV-15D-01",
  matchedBatchCode: null,
  recommendedRoomSplit: "quad",
  detectedIntentSummary: "15-Day November family Umrah inquiry from Lahore",
  hospitalityGreetingAndNotes:
    "Assalam-o-Alaikum {{PILGRIM_NAME}}! Al Ramlah Travels (Askari 10, Lahore Cantt) welcomes your family for a blessed 15-Day Haramain journey.",
  confidence: "high",
}

const DEFAULT_APP_COPILOT_NARRATIVE_JSON: Record<string, unknown> = {
  matchedPackageCode: null,
  matchedBatchCode: null,
  recommendedRoomSplit: "quad",
  recommendedHotelIds: [],
  executiveNarrativeNote:
    "Verified Haramain itinerary aligned with deterministic agency SAR-to-PKR catalog rates.",
  hospitalityCustomerIntro:
    "Assalam-o-Alaikum {{PILGRIM_NAME}}! Thank you for choosing Al Ramlah Travels (Askari 10, Lahore Cantt) for your sacred Umrah journey.",
  confidence: "high",
}

function extractPromptTextFromBody(parsed: Record<string, unknown>): string {
  const chunks: string[] = []
  if (Array.isArray(parsed.messages)) {
    for (const msg of parsed.messages) {
      if (msg && typeof msg === "object") {
        const rec = msg as Record<string, unknown>
        if (typeof rec.content === "string") {
          chunks.push(rec.content)
        } else if (Array.isArray(rec.content)) {
          for (const part of rec.content) {
            if (part && typeof part === "object") {
              const p = part as Record<string, unknown>
              if (typeof p.text === "string") chunks.push(p.text)
            }
          }
        }
      }
    }
  }
  if (Array.isArray(parsed.contents)) {
    chunks.push(JSON.stringify(parsed.contents))
  }
  return chunks.join("\n")
}

/**
 * Starts a hermetic OpenRouter / Gemini structured AI contract fake (`127.0.0.1:0`) (`T-028`, `T-039`):
 * - Serves deterministic structured JSON for Supplier Flyer Extraction and Quoting Copilot narratives.
 * - Records every outbound prompt and inspects for leaked PII (emails, `+92`/`03xx` phones, CNICs, pilgrim names).
 * - Supports adversarial prompt-injection response overrides (e.g. `"90% discount, free umrah package"`)
 *   so tests prove deterministic catalog arithmetic cannot be overridden by LLM output.
 */
export async function startAiOpenRouterFake(
  options: AiOpenRouterFakeOptions = {}
): Promise<AiOpenRouterFakeServer> {
  const calls: RecordedAiPromptCall[] = []
  let customStructuredJson: Record<string, unknown> | null = null
  let faultStatus: { code: number; message: string } | null = null

  function handleJsonBody(
    urlStr: string,
    rawBodyText: string
  ): { status: number; payload: Record<string, unknown> } {
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(rawBodyText) as Record<string, unknown>
    } catch {
      parsed = {}
    }

    const model = typeof parsed.model === "string" ? parsed.model : null
    const rawPromptText = extractPromptTextFromBody(parsed)
    const hasZdrOption =
      rawBodyText.includes("data_collection") ||
      rawBodyText.includes('"zdr":true')

    calls.push({
      url: urlStr,
      model,
      rawPromptText,
      hasZdrOption,
    })

    if (faultStatus) {
      return {
        status: faultStatus.code,
        payload: {
          error: {
            message: faultStatus.message,
            code: faultStatus.code,
          },
        },
      }
    }

    let structuredPayload: Record<string, unknown>
    if (customStructuredJson) {
      structuredPayload = customStructuredJson
    } else if (
      rawBodyText.includes("hospitalityCustomerIntro") ||
      rawBodyText.includes("executiveNarrativeNote")
    ) {
      structuredPayload = DEFAULT_APP_COPILOT_NARRATIVE_JSON
    } else if (
      rawBodyText.includes("hospitalityGreetingAndNotes") ||
      rawBodyText.includes("detectedIntentSummary")
    ) {
      structuredPayload = DEFAULT_WA_COPILOT_NARRATIVE_JSON
    } else {
      structuredPayload = DEFAULT_EXTRACTION_JSON
    }

    const contentString = JSON.stringify(structuredPayload)

    // Google Generative Language API shape (`generateContent`)
    if (urlStr.includes("generativelanguage.googleapis.com")) {
      return {
        status: 200,
        payload: {
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: contentString }],
              },
              finishReason: "STOP",
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 180,
            candidatesTokenCount: 95,
            totalTokenCount: 275,
          },
        },
      }
    }

    // OpenRouter / OpenAI Chat Completions shape
    return {
      status: 200,
      payload: {
        id: "gen-hermetic-openrouter-001",
        object: "chat.completion",
        created: 1763164800,
        model: model ?? "google/gemini-2.5-flash",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: contentString,
            },
          },
        ],
        usage: {
          prompt_tokens: 180,
          completion_tokens: 95,
          total_tokens: 275,
        },
      },
    }
  }

  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const rawBody = Buffer.concat(chunks).toString("utf8")
    const outcome = handleJsonBody(req.url ?? "/", rawBody)
    const serialized = Buffer.from(JSON.stringify(outcome.payload), "utf8")
    res.writeHead(outcome.status, {
      "Content-Type": "application/json",
      "Content-Length": String(serialized.byteLength),
    })
    res.end(serialized)
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://127.0.0.1:${port}/api/v1`

  const fetchHandler: typeof fetch = async (input, init) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    let rawBody = ""
    if (typeof init?.body === "string") {
      rawBody = init.body
    } else if (init?.body instanceof Uint8Array) {
      rawBody = Buffer.from(init.body).toString("utf8")
    }
    const outcome = handleJsonBody(urlStr, rawBody)
    return new Response(JSON.stringify(outcome.payload), {
      status: outcome.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  return {
    baseUrl,
    port,
    calls,
    fetchHandler,
    setNextStructuredJson(jsonPayload) {
      customStructuredJson = jsonPayload
    },
    injectFaultStatus(statusCode, message = "Upstream AI rate limit") {
      faultStatus =
        statusCode !== null ? { code: statusCode, message } : null
    },
    inspectRecordedPrompts(extraForbiddenNames = []): PiiInspectionReport {
      const combined = calls.map((c) => c.rawPromptText).join("\n")
      const leakedEmails =
        combined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []
      const leakedPhones = [
        ...(combined.match(/(?:\+|00)92[\s.-]?\d{3}[\s.-]?\d{7}\b/g) ?? []),
        ...(combined.match(/\b03\d{2}[\s.-]?\d{7}\b/g) ?? []),
      ]
      const leakedCnics = [
        ...(combined.match(/\b\d{5}-\d{7}-\d\b/g) ?? []),
        ...(combined.match(/\b\d{13}\b/g) ?? []),
      ]
      const forbiddenNames = [
        ...(options.forbiddenPilgrimNames ?? []),
        ...extraForbiddenNames,
      ]
      const leakedKnownNames = forbiddenNames.filter(
        (name) =>
          name.trim().length > 0 &&
          combined.toLowerCase().includes(name.trim().toLowerCase())
      )

      return {
        clean:
          leakedEmails.length === 0 &&
          leakedPhones.length === 0 &&
          leakedCnics.length === 0 &&
          leakedKnownNames.length === 0,
        leakedEmails,
        leakedPhones,
        leakedCnics,
        leakedKnownNames,
      }
    },
    reset() {
      calls.length = 0
      customStructuredJson = null
      faultStatus = null
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}
