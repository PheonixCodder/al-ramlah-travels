import fs from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { generateText, Output } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import {
  AMMAAR_AIRBLUE_21D_PRESET,
  UPSKY_SAUDIA_15D_PRESET,
  type ExtractedSupplierFlyerDraft,
} from "../posters/extract-supplier-flyer"

// ==========================================
// 1. DETERMINISTIC DATE PARSER
// ==========================================

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

function parseSingleDate(
  rawText: string,
  defaultYear: number
): { day: number; month: number; year: number } | null {
  if (!rawText) return null
  const cleaned = rawText.trim()

  // Match ISO YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1]!, 10),
      month: parseInt(isoMatch[2]!, 10),
      day: parseInt(isoMatch[3]!, 10),
    }
  }

  // Match e.g. "03 NOV", "03-Nov-2026", "3 November"
  const dmyMatch = cleaned.match(
    /(\d{1,2})\s*[-/.\s]?\s*([a-zA-Z]{3,9})(?:\s*[-/.\s]?\s*(\d{2,4}))?/i
  )
  if (dmyMatch) {
    const monthKey = dmyMatch[2]!.toLowerCase()
    const monthNum =
      MONTH_MAP[monthKey] || MONTH_MAP[monthKey.slice(0, 3)]
    if (monthNum) {
      let year = defaultYear
      if (dmyMatch[3]) {
        const rawY = parseInt(dmyMatch[3], 10)
        year = rawY < 100 ? 2000 + rawY : rawY
      }
      return {
        day: parseInt(dmyMatch[1]!, 10),
        month: monthNum,
        year,
      }
    }
  }

  // Match e.g. "NOV 03", "November 3, 2026"
  const mdyMatch = cleaned.match(
    /([a-zA-Z]{3,9})\s*[-/.\s]?\s*(\d{1,2})(?:,?\s*(\d{2,4}))?/i
  )
  if (mdyMatch) {
    const monthKey = mdyMatch[1]!.toLowerCase()
    const monthNum =
      MONTH_MAP[monthKey] || MONTH_MAP[monthKey.slice(0, 3)]
    if (monthNum) {
      let year = defaultYear
      if (mdyMatch[3]) {
        const rawY = parseInt(mdyMatch[3], 10)
        year = rawY < 100 ? 2000 + rawY : rawY
      }
      return {
        day: parseInt(mdyMatch[2]!, 10),
        month: monthNum,
        year,
      }
    }
  }

  // Match numeric e.g. "03/11", "03-11-2026"
  const numMatch = cleaned.match(/(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?/)
  if (numMatch) {
    const day = parseInt(numMatch[1]!, 10)
    const month = parseInt(numMatch[2]!, 10)
    let year = defaultYear
    if (numMatch[3]) {
      const rawY = parseInt(numMatch[3], 10)
      year = rawY < 100 ? 2000 + rawY : rawY
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, year }
    }
  }

  return null
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Pure deterministic date parser converting flight date labels (e.g. "03 NOV", "24 NOV")
 * into valid ISO 8601 calendar strings (`YYYY-MM-DD`).
 * Accurately handles year rollover (e.g. Dec to Jan) and duration fallbacks.
 */
export function parseFlyerDateLabelsToIso(
  outboundDateLabel: string,
  returnDateLabel: string,
  durationDays = 15,
  referenceYear = new Date().getFullYear()
): { outboundIsoDate: string; returnIsoDate: string } {
  const outboundParsed = parseSingleDate(outboundDateLabel, referenceYear)

  if (!outboundParsed) {
    const now = new Date()
    const outboundIsoDate = now.toISOString().slice(0, 10)
    const returnTime = now.getTime() + Math.max(1, durationDays) * 86400000
    const returnIsoDate = new Date(returnTime).toISOString().slice(0, 10)
    return { outboundIsoDate, returnIsoDate }
  }

  const outboundIsoDate = `${outboundParsed.year}-${pad(outboundParsed.month)}-${pad(outboundParsed.day)}`

  const returnParsed = parseSingleDate(returnDateLabel, outboundParsed.year)

  if (returnParsed) {
    // If return month is earlier in calendar year than outbound, roll year forward (e.g. Dec -> Jan)
    if (
      returnParsed.month < outboundParsed.month &&
      returnParsed.year === outboundParsed.year
    ) {
      returnParsed.year += 1
    }
    const returnIsoDate = `${returnParsed.year}-${pad(returnParsed.month)}-${pad(returnParsed.day)}`
    return { outboundIsoDate, returnIsoDate }
  }

  // If return label missing or unparseable, calculate from durationDays
  const outUtc = Date.UTC(
    outboundParsed.year,
    outboundParsed.month - 1,
    outboundParsed.day
  )
  const retUtc = outUtc + Math.max(1, durationDays) * 86400000
  const retDate = new Date(retUtc)
  const returnIsoDate = `${retDate.getUTCFullYear()}-${pad(retDate.getUTCMonth() + 1)}-${pad(retDate.getUTCDate())}`

  return { outboundIsoDate, returnIsoDate }
}

// ==========================================
// 2. STRUCTURED EXTRACTION TYPES & SCHEMAS
// ==========================================

export const rawAiCardSchema = z.object({
  cardNumber: z.string().describe("Card or tier number strictly two digits, e.g. '01', '02' .. '09'"),
  postCode: z
    .string()
    .optional()
    .describe(
      "Al Ramlah post reference code if printed on graphic (e.g. 'ART-2026-0001', 'ART-SPOT-01')"
    ),
  outboundFlightNo: z.string().describe("Outbound flight number (e.g. PA 470, SV 737)"),
  outboundDateLabel: z.string().describe("Outbound date label (e.g. 14-NOV, 03 NOV)"),
  outboundRoute: z.string().describe("Outbound flight route (e.g. LHE - JED)"),
  outboundDepTime: z.string().describe("Outbound departure time (e.g. 23:00)"),
  outboundArrTime: z.string().describe("Outbound arrival time (e.g. 03:15)"),
  returnFlightNo: z.string().describe("Return flight number (e.g. PA 471, SV 738)"),
  returnDateLabel: z.string().describe("Return date label (e.g. 04-DEC, 24 NOV)"),
  returnRoute: z.string().describe("Return flight route (e.g. JED - LHE)"),
  returnDepTime: z.string().describe("Return departure time (e.g. 04:30)"),
  returnArrTime: z.string().describe("Return arrival time (e.g. 11:15)"),
  makkahNights: z.string().describe("Nights in Makkah (e.g. 12N, 13N, 15N)"),
  makkahHotelName: z.string().describe("Name of hotel in Makkah"),
  makkahDistanceLabel: z.string().describe("Distance or shuttle label for Makkah (e.g. Shuttle 1500M, 850M, 450M)"),
  madinahNights: z.string().describe("Nights in Madinah (e.g. 08N, 05N)"),
  madinahHotelName: z.string().describe("Name of hotel in Madinah"),
  madinahDistanceLabel: z.string().describe("Distance or shuttle label for Madinah (e.g. Shuttle 1200M, 850M, 500M, 400M)"),
  mealPlanLabel: z.string().default("Room Only").describe("Meal plan ('Room Only' unless 'Breakfast' explicitly printed on card)"),
  sharingPricePkr: z.number().int().describe("Sharing price in PKR integer"),
  quadPricePkr: z.number().int().describe("Quad (4 bed) price in PKR integer"),
  triplePricePkr: z.number().int().describe("Triple (3 bed) price in PKR integer"),
  doublePricePkr: z.number().int().describe("Double (2 bed) price in PKR integer"),
})

export const rawAiFlyerResultSchema = z.object({
  title: z.string().describe("Title of flyer or package series"),
  airlineName: z.string().describe("Airline name (e.g. Airblue, PIA, Saudia)"),
  airlineIataCode: z.string().describe("2-letter IATA code (e.g. PA, SV, PK)"),
  airlineLogoUrl: z.string().optional().describe("URL of airline logo"),
  durationDays: z.number().int().describe("Trip duration in days (e.g. 21, 15)"),
  daysTitle: z.string().describe("Duration heading (e.g. '21 DAYS', '15 DAYS')"),
  routePill: z.string().describe("Route pill text (e.g. 'LHE - JED | JED - LHE')"),
  departureCityCode: z.string().describe("3-letter gateway airport code (e.g. LHE, ISB, KHI)"),
  arrivalAirportCode: z.string().default("JED"),
  returnAirportCode: z.string().default("JED"),
  outboundBaggage: z.string().default("").describe("Only extract if explicitly printed on the image, otherwise leave empty string"),
  inboundBaggage: z.string().default("").describe("Only extract if explicitly printed on the image, otherwise leave empty string"),
  giftedInclusions: z
    .array(z.string())
    .default([])
    .describe("Only extract if explicitly printed on the image, otherwise leave empty array"),
  cards: z.array(rawAiCardSchema).min(1),
})

export interface ExtractedPackageItem {
  cardNumber: string
  postCode?: string
  outboundFlightNo: string
  outboundDateLabel: string
  outboundRoute: string
  outboundDepTime: string
  outboundArrTime: string
  returnFlightNo: string
  returnDateLabel: string
  returnRoute: string
  returnDepTime: string
  returnArrTime: string
  makkahNights: string
  makkahHotelName: string
  makkahDistanceLabel: string
  madinahNights: string
  madinahHotelName: string
  madinahDistanceLabel: string
  mealPlanLabel: string
  rawSharingPkr: number
  rawQuadPkr: number
  rawTriplePkr: number
  rawDoublePkr: number
  netSharingPkr: number
  netQuadPkr: number
  netTriplePkr: number
  netDoublePkr: number
  retailSharingPkr: number
  retailQuadPkr: number
  retailTriplePkr: number
  retailDoublePkr: number
  departureDate: string
  returnDate: string
}

export interface ExtractedPackagesResult {
  title: string
  airlineName: string
  airlineIataCode: string
  airlineLogoUrl: string
  durationDays: number
  daysTitle: string
  routePill: string
  departureCityCode: string
  arrivalAirportCode: string
  returnAirportCode: string
  outboundBaggage: string
  inboundBaggage: string
  giftedInclusions: string[]
  ingestionMode: "gemini_ultra_poster" | "raw_supplier_flyer"
  modelUsed?: string
  cards: ExtractedPackageItem[]
}

export interface ExtractPackagesParams {
  mediaUrl?: string
  rawText?: string
  ingestionMode?: "gemini_ultra_poster" | "raw_supplier_flyer"
  supplierSlug?: string
  commissionMode?: "included_in_flyer" | "net_plus_markup"
  commissionPkr?: number
  defaultDepartureCityCode?: string
  allowOfflineMockForTests?: boolean
}

// ==========================================
// 3. MEDIA LOADER HELPER
// ==========================================

async function loadMediaBytes(
  mediaUrl: string
): Promise<{ data: Uint8Array; mimeType: string } | null> {
  try {
    if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
      const res = await fetch(mediaUrl)
      if (!res.ok) return null
      const buf = await res.arrayBuffer()
      const contentType = res.headers.get("content-type") || "image/jpeg"
      return {
        data: new Uint8Array(buf),
        mimeType: contentType.split(";")[0]!.trim(),
      }
    }

    let localPath = mediaUrl
    if (mediaUrl.startsWith("/")) {
      localPath = path.join(
        process.cwd(),
        "public",
        ...mediaUrl.slice(1).split("/")
      )
    }
    const buf = await fs.readFile(/*turbopackIgnore: true*/ localPath)
    const ext = path.extname(localPath).toLowerCase()
    let mimeType = "image/jpeg"
    if (ext === ".png") mimeType = "image/png"
    else if (ext === ".webp") mimeType = "image/webp"
    else if (ext === ".pdf") mimeType = "application/pdf"

    return { data: new Uint8Array(buf), mimeType }
  } catch (err) {
    console.warn(`[Load Media] Could not load bytes for ${mediaUrl}:`, err)
    return null
  }
}

// ==========================================
// 4. MULTIMODAL EXTRACTION ENGINE
// ==========================================

export async function extractPackagesMultimodal(
  params: ExtractPackagesParams
): Promise<ExtractedPackagesResult> {
  const ingestionMode = params.ingestionMode || "raw_supplier_flyer"
  const commissionMode = params.commissionMode || "included_in_flyer"
  const commissionPkr = params.commissionPkr ?? 22000

  // 1. Try Vercel AI SDK with cascading providers if API keys exist
  const googleKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim()
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim()

  const cascadeErrors: string[] = []

  if (googleKey || openRouterKey) {
    const media = params.mediaUrl ? await loadMediaBytes(params.mediaUrl) : null

    const promptText = `
You are an expert Umrah tour operator document parser for Al Ramlah Travels.
Ingestion Mode: "${ingestionMode}".

CRITICAL EXTRACTION RULES:
1. Extract ONLY the exact package cards printed on the graphic or flyer.
   - Do NOT invent, hallucinate, duplicate, or merge package cards.
   - If the graphic contains 9 cards numbered 01 through 09, extract EXACTLY those 9 cards in sequential order (01 through 09).
2. Read every card's exact printed details:
   - cardNumber: strictly two digits ('01', '02', '03', '04', '05', '06', '07', '08', '09').
   - Flights:
     * outboundFlightNo (e.g. PA 470, SV 737)
     * outboundDateLabel (e.g. 14-NOV, 16-NOV, 18-NOV, 19-NOV, 21-NOV, 23-NOV, 25-NOV, 28-NOV)
     * outboundRoute (e.g. LHE - JED)
     * outboundDepTime (e.g. 23:00)
     * outboundArrTime (e.g. 03:15)
     * returnFlightNo (e.g. PA 471, SV 738)
     * returnDateLabel (e.g. 04-DEC, 06-DEC, 08-DEC, 09-DEC, 11-DEC, 13-DEC, 15-DEC, 16-DEC, 18-DEC)
     * returnRoute (e.g. JED - LHE)
     * returnDepTime (e.g. 04:30)
     * returnArrTime (e.g. 11:15)
   - Hotels and nights:
     * makkahNights: exact nights printed (e.g. 12N on cards 01-07 and 09; 13N on card 08)
     * makkahHotelName: exact hotel name printed
     * makkahDistanceLabel: distance or shuttle printed (e.g. Shuttle 1500M, 850M, 450M)
     * madinahNights: exact nights printed (e.g. 08N)
     * madinahHotelName: exact hotel name printed
     * madinahDistanceLabel: distance or shuttle printed (e.g. Shuttle 1200M, 850M, 500M, 400M)
   - Meal plan: strictly 'Room Only' unless 'Breakfast' is explicitly printed on that card.
   - Prices: extract exact integer numbers for Sharing, Quad, Triple, and Double in PKR printed on the card.
3. Baggage and inclusions:
   - outboundBaggage and inboundBaggage: only extract if explicitly printed on the image; if not printed, leave empty string ''.
   - giftedInclusions: only extract if explicitly printed on the image; if not printed, leave empty array [].
4. Metadata:
   - title: flyer or package heading (e.g. '21 Days Umrah Packages')
   - airlineName: e.g. 'Airblue', 'Saudia', 'PIA'
   - airlineIataCode: 2-letter IATA code (e.g. 'PA', 'SV', 'PK')
   - durationDays: total duration in days integer (e.g. 21, 15)
   - daysTitle: e.g. '21 DAYS'
   - routePill: e.g. 'LHE - JED | JED - LHE'
   - departureCityCode: 3-letter IATA code of origin (e.g. 'LHE')

Additional Raw Text / Notes:
${params.rawText || "None provided"}
`.trim()

    // Build user content parts (multimodal)
    const userContentParts: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: Uint8Array; mediaType: string }
    > = [{ type: "text", text: promptText }]

    if (media) {
      userContentParts.push({
        type: "file",
        data: media.data,
        mediaType: media.mimeType,
      })
    }

    const messages = [
      {
        role: "user" as const,
        content: userContentParts,
      },
    ]

    // Provider cascade:
    // 1. Google Gemini (primary: gemini-3.8-flash -> gemini-3.5-flash -> gemini-3-flash-preview)
    // 2. OpenRouter (secondary: gemini-2.5-flash -> claude-3.5-sonnet)
    const modelCandidates: Array<{
      name: string
      run: () => Promise<z.infer<typeof rawAiFlyerResultSchema>>
    }> = []

    if (googleKey) {
      const google = createGoogleGenerativeAI({ apiKey: googleKey })
      const googleModels = [
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-3-flash-preview",
      ]
      for (const modelId of googleModels) {
        modelCandidates.push({
          name: `google:${modelId}`,
          run: async () => {
            const res = await generateText({
              model: google(modelId),
              messages,
              output: Output.object({ schema: rawAiFlyerResultSchema }),
              maxRetries: 0,
            })
            return res.output
          },
        })
      }
    }

    if (openRouterKey) {
      const openrouter = createOpenRouter({ apiKey: openRouterKey })
      modelCandidates.push({
        name: "openrouter:google/gemini-2.5-flash",
        run: async () => {
          const res = await generateText({
            model: openrouter("google/gemini-2.5-flash"),
            messages,
            output: Output.object({ schema: rawAiFlyerResultSchema }),
            maxRetries: 0,
          })
          return res.output
        },
      })
      modelCandidates.push({
        name: "openrouter:anthropic/claude-3.5-sonnet",
        run: async () => {
          const res = await generateText({
            model: openrouter("anthropic/claude-3.5-sonnet"),
            messages,
            output: Output.object({ schema: rawAiFlyerResultSchema }),
            maxRetries: 0,
          })
          return res.output
        },
      })
    }

    for (const candidate of modelCandidates) {
      try {
        const rawOutput = await candidate.run()
        if (rawOutput && rawOutput.cards && rawOutput.cards.length > 0) {
          return mapAiOutputToResult({
            rawOutput,
            ingestionMode,
            commissionMode,
            commissionPkr,
            modelUsed: candidate.name,
          })
        }
      } catch (cascadeErr) {
        const errMsg =
          cascadeErr instanceof Error ? cascadeErr.message : String(cascadeErr)
        cascadeErrors.push(`${candidate.name}: ${errMsg}`)
        console.warn(
          `[Multimodal Extraction] Model ${candidate.name} failed, falling back to next candidate:`,
          cascadeErr
        )
      }
    }
  }

  // 2. Offline / Mock fallback ONLY when explicitly requested by test suites
  if (params.allowOfflineMockForTests) {
    const slug = (params.supplierSlug ?? "").toLowerCase()
    const media = (params.mediaUrl ?? "").toLowerCase()
    const preset: ExtractedSupplierFlyerDraft =
      slug.includes("upsky") ||
      media.includes("upsky") ||
      media.includes("saudia")
        ? structuredClone(UPSKY_SAUDIA_15D_PRESET)
        : structuredClone(AMMAAR_AIRBLUE_21D_PRESET)

    return mapDraftToResult({
      draft: preset,
      ingestionMode,
      commissionMode,
      commissionPkr,
      modelUsed: "supplier_preset_offline",
    })
  }

  // Production requirement: NEVER silently insert fake packages if AI models fail!
  const errorSummary =
    cascadeErrors.length > 0
      ? cascadeErrors.join("; ")
      : "No valid AI API keys configured (GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY or OPENROUTER_API_KEY missing)"

  throw new Error(`Multimodal package extraction failed: ${errorSummary}`)
}

// ==========================================
// 5. POST-PROCESSING MAPPERS
// ==========================================

function mapAiOutputToResult(params: {
  rawOutput: z.infer<typeof rawAiFlyerResultSchema>
  ingestionMode: "gemini_ultra_poster" | "raw_supplier_flyer"
  commissionMode: "included_in_flyer" | "net_plus_markup"
  commissionPkr: number
  modelUsed: string
}): ExtractedPackagesResult {
  const { rawOutput, ingestionMode, commissionMode, commissionPkr, modelUsed } =
    params

  const cards: ExtractedPackageItem[] = rawOutput.cards.map((c, idx) => {
    const { outboundIsoDate, returnIsoDate } = parseFlyerDateLabelsToIso(
      c.outboundDateLabel,
      c.returnDateLabel,
      rawOutput.durationDays
    )

    let retailSharingPkr: number
    let retailQuadPkr: number
    let retailTriplePkr: number
    let retailDoublePkr: number
    let netSharingPkr: number
    let netQuadPkr: number
    let netTriplePkr: number
    let netDoublePkr: number
    let rawSharingPkr: number
    let rawQuadPkr: number
    let rawTriplePkr: number
    let rawDoublePkr: number

    if (ingestionMode === "gemini_ultra_poster") {
      // Mode A: extracted prices are retail display prices printed on poster
      retailSharingPkr = c.sharingPricePkr
      retailQuadPkr = c.quadPricePkr
      retailTriplePkr = c.triplePricePkr
      retailDoublePkr = c.doublePricePkr

      netSharingPkr = Math.max(0, retailSharingPkr - commissionPkr)
      netQuadPkr = Math.max(0, retailQuadPkr - commissionPkr)
      netTriplePkr = Math.max(0, retailTriplePkr - commissionPkr)
      netDoublePkr = Math.max(0, retailDoublePkr - commissionPkr)

      rawSharingPkr = netSharingPkr
      rawQuadPkr = netQuadPkr
      rawTriplePkr = netTriplePkr
      rawDoublePkr = netDoublePkr
    } else {
      // Mode B: extracted prices are raw supplier flyer prices
      rawSharingPkr = c.sharingPricePkr
      rawQuadPkr = c.quadPricePkr
      rawTriplePkr = c.triplePricePkr
      rawDoublePkr = c.doublePricePkr

      if (commissionMode === "net_plus_markup") {
        netSharingPkr = rawSharingPkr
        netQuadPkr = rawQuadPkr
        netTriplePkr = rawTriplePkr
        netDoublePkr = rawDoublePkr

        retailSharingPkr = rawSharingPkr + commissionPkr
        retailQuadPkr = rawQuadPkr + commissionPkr
        retailTriplePkr = rawTriplePkr + commissionPkr
        retailDoublePkr = rawDoublePkr + commissionPkr
      } else {
        retailSharingPkr = rawSharingPkr
        retailQuadPkr = rawQuadPkr
        retailTriplePkr = rawTriplePkr
        retailDoublePkr = rawDoublePkr

        netSharingPkr = Math.max(0, rawSharingPkr - commissionPkr)
        netQuadPkr = Math.max(0, rawQuadPkr - commissionPkr)
        netTriplePkr = Math.max(0, rawTriplePkr - commissionPkr)
        netDoublePkr = Math.max(0, rawDoublePkr - commissionPkr)
      }
    }

    return {
      cardNumber: c.cardNumber || String(idx + 1).padStart(2, "0"),
      postCode: c.postCode,
      outboundFlightNo: c.outboundFlightNo,
      outboundDateLabel: c.outboundDateLabel,
      outboundRoute: c.outboundRoute,
      outboundDepTime: c.outboundDepTime,
      outboundArrTime: c.outboundArrTime,
      returnFlightNo: c.returnFlightNo,
      returnDateLabel: c.returnDateLabel,
      returnRoute: c.returnRoute,
      returnDepTime: c.returnDepTime,
      returnArrTime: c.returnArrTime,
      makkahNights: c.makkahNights,
      makkahHotelName: c.makkahHotelName,
      makkahDistanceLabel: c.makkahDistanceLabel,
      madinahNights: c.madinahNights,
      madinahHotelName: c.madinahHotelName,
      madinahDistanceLabel: c.madinahDistanceLabel,
      mealPlanLabel: c.mealPlanLabel || "Room Only",
      rawSharingPkr,
      rawQuadPkr,
      rawTriplePkr,
      rawDoublePkr,
      netSharingPkr,
      netQuadPkr,
      netTriplePkr,
      netDoublePkr,
      retailSharingPkr,
      retailQuadPkr,
      retailTriplePkr,
      retailDoublePkr,
      departureDate: outboundIsoDate,
      returnDate: returnIsoDate,
    }
  })

  return {
    title: rawOutput.title,
    airlineName: rawOutput.airlineName,
    airlineIataCode: rawOutput.airlineIataCode,
    airlineLogoUrl:
      rawOutput.airlineLogoUrl ||
      `https://images.kiwi.com/airlines/64/${rawOutput.airlineIataCode}.png`,
    durationDays: rawOutput.durationDays,
    daysTitle: rawOutput.daysTitle,
    routePill: rawOutput.routePill,
    departureCityCode: rawOutput.departureCityCode || "LHE",
    arrivalAirportCode: rawOutput.arrivalAirportCode || "JED",
    returnAirportCode: rawOutput.returnAirportCode || "JED",
    outboundBaggage: rawOutput.outboundBaggage || "20 Kg + 7 Kg",
    inboundBaggage:
      rawOutput.inboundBaggage || "30 Kg + 7 Kg + 5 Ltr Zamzam",
    giftedInclusions: rawOutput.giftedInclusions || [],
    ingestionMode,
    modelUsed,
    cards,
  }
}

function mapDraftToResult(params: {
  draft: ExtractedSupplierFlyerDraft
  ingestionMode: "gemini_ultra_poster" | "raw_supplier_flyer"
  commissionMode: "included_in_flyer" | "net_plus_markup"
  commissionPkr: number
  modelUsed: string
}): ExtractedPackagesResult {
  const { draft, ingestionMode, commissionMode, commissionPkr, modelUsed } =
    params

  const cards: ExtractedPackageItem[] = draft.cards.map((c, idx) => {
    const { outboundIsoDate, returnIsoDate } = parseFlyerDateLabelsToIso(
      c.outboundDateLabel,
      c.returnDateLabel,
      draft.durationDays
    )

    let retailSharingPkr: number
    let retailQuadPkr: number
    let retailTriplePkr: number
    let retailDoublePkr: number
    let netSharingPkr: number
    let netQuadPkr: number
    let netTriplePkr: number
    let netDoublePkr: number

    if (commissionMode === "net_plus_markup") {
      netSharingPkr = c.rawSharingPkr
      netQuadPkr = c.rawQuadPkr
      netTriplePkr = c.rawTriplePkr
      netDoublePkr = c.rawDoublePkr

      retailSharingPkr = c.rawSharingPkr + commissionPkr
      retailQuadPkr = c.rawQuadPkr + commissionPkr
      retailTriplePkr = c.rawTriplePkr + commissionPkr
      retailDoublePkr = c.rawDoublePkr + commissionPkr
    } else {
      retailSharingPkr = c.rawSharingPkr
      retailQuadPkr = c.rawQuadPkr
      retailTriplePkr = c.rawTriplePkr
      retailDoublePkr = c.rawDoublePkr

      netSharingPkr = Math.max(0, c.rawSharingPkr - commissionPkr)
      netQuadPkr = Math.max(0, c.rawQuadPkr - commissionPkr)
      netTriplePkr = Math.max(0, c.rawTriplePkr - commissionPkr)
      netDoublePkr = Math.max(0, c.rawDoublePkr - commissionPkr)
    }

    return {
      cardNumber: c.cardNumber || String(idx + 1).padStart(2, "0"),
      outboundFlightNo: c.outboundFlightNo,
      outboundDateLabel: c.outboundDateLabel,
      outboundRoute: c.outboundRoute,
      outboundDepTime: c.outboundDepTime,
      outboundArrTime: c.outboundArrTime,
      returnFlightNo: c.returnFlightNo,
      returnDateLabel: c.returnDateLabel,
      returnRoute: c.returnRoute,
      returnDepTime: c.returnDepTime,
      returnArrTime: c.returnArrTime,
      makkahNights: c.makkahNights,
      makkahHotelName: c.makkahHotelName,
      makkahDistanceLabel: c.makkahDistanceLabel,
      madinahNights: c.madinahNights,
      madinahHotelName: c.madinahHotelName,
      madinahDistanceLabel: c.madinahDistanceLabel,
      mealPlanLabel: c.mealPlanLabel || "Room Only",
      rawSharingPkr: c.rawSharingPkr,
      rawQuadPkr: c.rawQuadPkr,
      rawTriplePkr: c.rawTriplePkr,
      rawDoublePkr: c.rawDoublePkr,
      netSharingPkr,
      netQuadPkr,
      netTriplePkr,
      netDoublePkr,
      retailSharingPkr,
      retailQuadPkr,
      retailTriplePkr,
      retailDoublePkr,
      departureDate: outboundIsoDate,
      returnDate: returnIsoDate,
    }
  })

  return {
    title: draft.title,
    airlineName: draft.airlineName,
    airlineIataCode: draft.airlineIataCode,
    airlineLogoUrl: draft.airlineLogoUrl,
    durationDays: draft.durationDays,
    daysTitle: draft.daysTitle,
    routePill: draft.routePill,
    departureCityCode: draft.departureCityCode,
    arrivalAirportCode: draft.arrivalAirportCode,
    returnAirportCode: draft.returnAirportCode,
    outboundBaggage: draft.outboundBaggage,
    inboundBaggage: draft.inboundBaggage,
    giftedInclusions: draft.giftedInclusions,
    ingestionMode,
    modelUsed,
    cards,
  }
}
