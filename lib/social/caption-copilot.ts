/**
 * Al Ramlah Travels — AI Social Caption & Hashtag Copilot
 * Spec 0020 (Slice 39)
 *
 * Generates tailored copy for Instagram, Facebook, TikTok, YouTube Shorts,
 * and Google Business Profile alongside 3 viral hooks and first-comment copy.
 * Uses Vercel AI SDK (OpenRouter / Gemini) with an offline deterministic
 * luxury Haramain fallback.
 */

import { generateText, Output } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { z } from "zod"

export interface GenerateSocialCaptionsInput {
  postCode?: string
  title?: string
  campaignStage?: "step_1_spotlight_hook" | "step_2_all_packages" | "standalone"
  postFormat?: "FEED" | "REEL" | "STORY"
  sharingPricePkr?: number | null
  quadPricePkr?: number | null
  triplePricePkr?: number | null
  doublePricePkr?: number | null
  makkahHotelName?: string | null
  madinahHotelName?: string | null
  nightsMakkah?: number | null
  nightsMadinah?: number | null
  airlineName?: string | null
  customNotes?: string | null
}

export interface GeneratedPlatformCaptionsResult {
  hooks: [string, string, string]
  captions: {
    instagram: { caption: string; firstComment: string }
    facebook: { caption: string; firstComment: string }
    tiktok: { caption: string; firstComment?: string }
    youtube: { caption: string; firstComment: string; title: string }
    gmb: { caption: string; callToActionType: "BOOK" | "LEARN_MORE" }
  }
  globalDefault: string
  suggestedFirstComment: string
  modelUsed: string
}

function formatPkr(num: number | null | undefined, fallback: string): string {
  if (typeof num === "number" && num > 0) {
    return `PKR ${num.toLocaleString("en-PK")}`
  }
  return fallback
}

/**
 * Deterministic luxury Haramain generator.
 * Produces complete, high-converting copy without external API dependencies.
 */
export function buildDeterministicSocialCaptions(
  input: GenerateSocialCaptionsInput
): GeneratedPlatformCaptionsResult {
  const code = (input.postCode || "ART-UMRAH-01").toUpperCase().trim()
  const title = (input.title || "Executive Luxury Umrah Package 2026").trim()
  const makkahHotel = input.makkahHotelName || "5-Star Clock Tower Makkah"
  const madinahHotel = input.madinahHotelName || "5-Star Central Area Madinah"
  const nightsMakkah = input.nightsMakkah || 7
  const nightsMadinah = input.nightsMadinah || 7
  const airline = input.airlineName || "Saudia / PIA Direct Flights"

  const quadPkr = formatPkr(input.quadPricePkr, "PKR 295,000")
  const triplePkr = formatPkr(input.triplePricePkr, "PKR 315,000")
  const doublePkr = formatPkr(input.doublePricePkr, "PKR 345,000")
  const sharingPkr = formatPkr(input.sharingPricePkr, "PKR 275,000")

  const waLink = `https://wa.me/923274029701?text=${encodeURIComponent(
    `Salam Al Ramlah Travels! I am inquiring about package [${code}]: ${title}. Please share available departure dates.`
  )}`

  const hooks: [string, string, string] = [
    "Labbaik Allahumma Labbaik — Complete VIP Umrah Journey 2026.",
    "Executive Umrah at Economy Pricing — Direct Flights & 5-Star Haramain Comfort.",
    "Limited Ramadan & Season Slots — Reserve Your Sacred Pilgrimage Today.",
  ]

  const suggestedFirstComment = `🕋 Assalamu Alaikum! To reserve your seats for [${code}] or customize your family itinerary:\n\n📱 Instant WhatsApp: ${waLink}\n📞 Helpline: +92 327 4029701\n📍 Askari 10 & DHA Lahore Offices`

  const instagramCaption = `﷽
Labbaik Allahumma Labbaik 🕋✨

Experience the sacred pilgrimage with absolute peace of mind. Al Ramlah Travels presents our signature ${title} [${code}].

✨ PACKAGE HIGHLIGHTS:
• ${nightsMakkah} Nights Makkah: ${makkahHotel} (Walking distance)
• ${nightsMadinah} Nights Madinah: ${madinahHotel} (Close to Bab-e-Salam)
• Airline: ${airline}
• Complete Ground Transfer via Haramain High-Speed Train & VIP Buses
• Full Umrah Visa Processing with Saudi Medical Insurance
• Guided Ziyarat of Holy Sites in Makkah & Madinah

🏷️ RETAIL INVESTMENT PER PILGRIM:
• Sharing: ${sharingPkr}
• Quad (4 Beds): ${quadPkr}
• Triple (3 Beds): ${triplePkr}
• Double (2 Beds): ${doublePkr}

👇 Comment "UMRAH" or click the link in bio / first comment to book instantly with code [${code}].

#Umrah2026 #AlRamlahTravels #UmrahPackages #Makkah #Madinah #Haramain #LahoreUmrah #UmrahPakistan #VIPUmrah #HajjUmrah #UmrahGuide #Askari10 #DHALahore #SacredJourney #KhidmatEHujjaj #UmrahVisa #UmrahFromLahore #SwissotelMakkah`

  const facebookCaption = `🕋 Executive Umrah 2026 with Al Ramlah Travels — Reserve Your Spiritual Journey [${code}]

Plan your sacred pilgrimage with verified luxury accommodations and seamless ground arrangements:

🏨 ACCOMMODATIONS:
• Makkah (${nightsMakkah} Nights): ${makkahHotel}
• Madinah (${nightsMadinah} Nights): ${madinahHotel}
• Flights: ${airline}
• Transfers: VIP Air-conditioned Coaches & High-Speed Train
• Umrah Visa & Comprehensive Medical Insurance Included

💰 ALL-INCLUSIVE RATES PER PASSENGER:
▫️ Sharing Room: ${sharingPkr}
▫️ Quad Room (4 Pax): ${quadPkr}
▫️ Triple Room (3 Pax): ${triplePkr}
▫️ Double Room (2 Pax): ${doublePkr}

📲 Direct Booking & Inquiries:
WhatsApp: ${waLink}
UAN / Helpline: +92 327 4029701

🏢 Visit Our Offices:
Askari 10 Commercial Area & DHA Phase 5, Lahore, Pakistan.`

  const tiktokCaption = `🕋 ${title} [${code}] | 5-Star Haramain from ${quadPkr}! Direct Flights & VIP Ziyarat. WhatsApp 0327-4029701 to book. #umrah #makkah #madinah #alramlahtravels #pakistan #fyp #viral`

  const youtubeTitle = `[${code}] Luxury Umrah 2026 Package | Al Ramlah Travels #Shorts`

  const youtubeCaption = `🕋 Al Ramlah Travels | ${title} [${code}]

Book your executive Umrah pilgrimage with 5-star comfort and verified walking-distance Haramain hotels.

Package Details:
• Makkah: ${makkahHotel} (${nightsMakkah} Nights)
• Madinah: ${madinahHotel} (${nightsMadinah} Nights)
• Flights: ${airline}
• Quad: ${quadPkr} | Triple: ${triplePkr} | Double: ${doublePkr} | Sharing: ${sharingPkr}

Contact & WhatsApp Reservations:
WhatsApp: ${waLink}
Helpline: +92 327 4029701
Offices: Askari 10 & DHA Lahore, Pakistan.

#Shorts #Umrah #Makkah #Madinah #AlRamlahTravels #Umrah2026`

  const gmbCaption = `🕋 New Executive Umrah Package Available: ${title} [${code}]

Al Ramlah Travels announces confirmed departure dates for our 2026 Umrah series. Featuring 5-star hotels in Makkah (${makkahHotel}) and Madinah (${madinahHotel}) with direct flights via ${airline}. Quad rooms starting from ${quadPkr}.

Visit our Lahore offices at Askari 10 & DHA or chat with our pilgrim consultants on WhatsApp: +92 327 4029701.`

  return {
    hooks,
    captions: {
      instagram: {
        caption: instagramCaption,
        firstComment: suggestedFirstComment,
      },
      facebook: {
        caption: facebookCaption,
        firstComment: suggestedFirstComment,
      },
      tiktok: {
        caption: tiktokCaption,
        firstComment: suggestedFirstComment,
      },
      youtube: {
        title: youtubeTitle,
        caption: youtubeCaption,
        firstComment: suggestedFirstComment,
      },
      gmb: {
        caption: gmbCaption,
        callToActionType: "BOOK",
      },
    },
    globalDefault: instagramCaption,
    suggestedFirstComment,
    modelUsed: "deterministic-luxury-haramain",
  }
}

const aiCopilotResponseSchema = z.object({
  hooks: z.tuple([z.string(), z.string(), z.string()]),
  instagramCaption: z.string(),
  instagramFirstComment: z.string(),
  facebookCaption: z.string(),
  facebookFirstComment: z.string(),
  tiktokCaption: z.string(),
  youtubeTitle: z.string(),
  youtubeCaption: z.string(),
  youtubeFirstComment: z.string(),
  gmbCaption: z.string(),
  gmbCallToAction: z.enum(["BOOK", "LEARN_MORE"]).default("BOOK"),
})

/**
 * Generates platform-tailored social media captions using Vercel AI SDK
 * with OpenRouter / Google Gemini, or falls back to deterministic luxury output.
 */
export async function generateSocialCaptionsCopilot(
  input: GenerateSocialCaptionsInput
): Promise<GeneratedPlatformCaptionsResult> {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim()
  const geminiKey = process.env.GEMINI_API_KEY?.trim()

  if (!openRouterKey && !geminiKey) {
    return buildDeterministicSocialCaptions(input)
  }

  const code = (input.postCode || "ART-UMRAH-01").toUpperCase().trim()
  const title = (input.title || "Executive Umrah Package 2026").trim()

  const systemPrompt = `You are the lead marketing copywriter for Al Ramlah Travels, an elite Umrah & Hajj agency based in Askari 10 and DHA Lahore, Pakistan.
Brand Voice: Reverent, luxurious, trustworthy, professional ("Khidmat-e-Hujjaj"), transparent on pricing in PKR, urgent yet spiritual.
Language: English with authentic Islamic greetings (﷽, Bismillah, Labbaik Allahumma Labbaik, SubhanAllah).
Rules:
1. Instagram: Rich narrative, line breaks, emojis, bullet points, hotel walk distances, room price table, 15-20 Umrah hashtags, call to action referencing link in bio / first comment.
2. Facebook: Community-focused, full quad/triple/double/sharing PKR matrix, clickable WhatsApp CTA (https://wa.me/923274029701), office NAP (Askari 10 & DHA Lahore).
3. TikTok: Punchy 80-120 character hook, key price, discovery hashtags (#umrah #makkah #madinah #alramlahtravels).
4. YouTube Shorts: Title under 100 characters ending with #Shorts. Comprehensive video description with itinerary & helpline.
5. Google Business Profile: Local business update format (max 1500 chars), NAP consistency, Book action.
6. Provide 3 distinct viral hooks: Hook 1 (Spiritual journey), Hook 2 (Luxury value), Hook 3 (Seasonal/Ramadan urgency).`

  const userPrompt = `Generate complete platform-tailored captions for:
Reference Code: [${code}]
Title: ${title}
Campaign Stage: ${input.campaignStage || "standalone"}
Post Format: ${input.postFormat || "FEED"}
Makkah Hotel: ${input.makkahHotelName || "5-Star Clock Tower Makkah"} (${input.nightsMakkah || 7} Nights)
Madinah Hotel: ${input.madinahHotelName || "5-Star Central Area Madinah"} (${input.nightsMadinah || 7} Nights)
Airline: ${input.airlineName || "Saudia / PIA Direct"}
Pricing (PKR):
- Quad: ${input.quadPricePkr ? `PKR ${input.quadPricePkr.toLocaleString()}` : "PKR 295,000"}
- Triple: ${input.triplePricePkr ? `PKR ${input.triplePricePkr.toLocaleString()}` : "PKR 315,000"}
- Double: ${input.doublePricePkr ? `PKR ${input.doublePricePkr.toLocaleString()}` : "PKR 345,000"}
- Sharing: ${input.sharingPricePkr ? `PKR ${input.sharingPricePkr.toLocaleString()}` : "PKR 275,000"}
${input.customNotes ? `Custom Notes: ${input.customNotes}` : ""}`

  try {
    let modelInstance: any
    let modelName = "openrouter/google/gemini-2.5-flash"

    if (openRouterKey) {
      const openrouter = createOpenRouter({ apiKey: openRouterKey })
      modelInstance = openrouter("google/gemini-2.5-flash")
    } else if (geminiKey) {
      const google = createGoogleGenerativeAI({ apiKey: geminiKey })
      modelInstance = google("gemini-2.5-flash")
      modelName = "google/gemini-2.5-flash"
    }

    const { output } = await generateText({
      model: modelInstance,
      system: systemPrompt,
      prompt: userPrompt,
      output: Output.object({ schema: aiCopilotResponseSchema }),
      temperature: 0.7,
    })

    if (output) {
      const waLink = `https://wa.me/923274029701?text=${encodeURIComponent(
        `Salam Al Ramlah Travels! Inquiring about [${code}]: ${title}.`
      )}`
      const suggestedFirstComment =
        output.instagramFirstComment ||
        `🕋 Assalamu Alaikum! To book [${code}] or customize your itinerary: WhatsApp ${waLink} | Helpline: +92 327 4029701`

      return {
        hooks: output.hooks,
        captions: {
          instagram: {
            caption: output.instagramCaption,
            firstComment: output.instagramFirstComment || suggestedFirstComment,
          },
          facebook: {
            caption: output.facebookCaption,
            firstComment: output.facebookFirstComment || suggestedFirstComment,
          },
          tiktok: {
            caption: output.tiktokCaption,
            firstComment: suggestedFirstComment,
          },
          youtube: {
            title: output.youtubeTitle,
            caption: output.youtubeCaption,
            firstComment: output.youtubeFirstComment || suggestedFirstComment,
          },
          gmb: {
            caption: output.gmbCaption,
            callToActionType: output.gmbCallToAction,
          },
        },
        globalDefault: output.instagramCaption,
        suggestedFirstComment,
        modelUsed: modelName,
      }
    }

    return buildDeterministicSocialCaptions(input)
  } catch (err) {
    console.warn(
      "[Social Caption Copilot] AI call failed, falling back to deterministic luxury output:",
      err instanceof Error ? err.message : String(err)
    )
    return buildDeterministicSocialCaptions(input)
  }
}
