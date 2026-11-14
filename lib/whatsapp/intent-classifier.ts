export type WhatsappIntentCategory =
  | "TRAVEL_LEAD"
  | "PERSONAL_OR_OTHER"
  | "FOUNDER_HANDOFF"
  | "UNCLASSIFIED"

export interface IntentClassificationInput {
  inboundText: string
  recentMessages?: Array<{ direction: "inbound" | "outbound"; body: string }>
  detectedPostCode?: string | null
  hasLinkedApplication?: boolean
  hasLinkedOutreachContact?: boolean
  existingIntentCategory?: string | null
  existingIntentConfidence?: number | null
  contactName?: string | null
}

export interface IntentClassificationResult {
  category: WhatsappIntentCategory
  confidence: number
  reason: string
  shouldTriggerAutoReply: boolean
  shouldSurfaceAsTravelLead: boolean
}

const HIGH_SIGNAL_TRAVEL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(umrah|umra|omrah)\b/i, label: "Umrah inquiry" },
  { pattern: /\b(hajj|haj|maktab)\b/i, label: "Hajj / Maktab inquiry" },
  { pattern: /\b(makkah|mecca|madinah|medina|haram|haramain|kaaba|ziyarat|ziaraat)\b/i, label: "Haramain destination mention" },
  { pattern: /\b(al\s*ramlah|ramlah\s*travels)\b/i, label: "Al Ramlah Travels brand mention" },
  { pattern: /\b(visa|passport|biometric|etimad|tasheer|nusuk|muqeem|iqama)\b/i, label: "Visa / passport documentation inquiry" },
  { pattern: /\b(quad|triple|sharing\s+room|double\s+room|shuttle\s+hotel|markazia|clock\s+tower|jabal\s+omar)\b/i, label: "Hotel room tier / Haram proximity inquiry" },
  { pattern: /\b(jeddah|taif|riyadh|dammam|saudia|flynas|flyadeal|airblue|serene\s*air|pia\s+flight)\b/i, label: "Saudi flight / route inquiry" },
  { pattern: /\b(umrah\s+package|tour\s+package|ramadan\s+package|rabi\s+ul\s+awal|shaban|shawal)\b/i, label: "Seasonal Umrah package inquiry" },
  { pattern: /(عمرہ|حج|مکہ|مدینہ|ویزا|پاسپورٹ|زیارت|حرم)/, label: "Urdu Haramain travel keyword" },
]

const MEDIUM_SIGNAL_TRAVEL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(flight|flights|ticket|tickets|airline|boarding|pnr|departure|return\s+date)\b/i, label: "Flight / ticketing keyword" },
  { pattern: /\b(hotel|nights|booking|packages|rate|rates|quotation|quote|itinerary|brochure|flyer)\b/i, label: "Package / hotel rate keyword" },
  { pattern: /\b(saudi|ksa|riyal|sar|pkr\s*\d+)\b/i, label: "Saudi / currency mention" },
]

const PERSONAL_OR_OTHER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(cricket|match|football|movie|netflix|game|pubg)\b/i, label: "Sports / entertainment chat" },
  { pattern: /\b(dinner|lunch|breakfast|chai|tea|coffee|biryani|iftar\s+party)\b/i, label: "Social / dining chat" },
  { pattern: /\b(happy\s+birthday|eid\s+mubarak|jumma\s+mubarak|congratulations|mubarak\s+ho)\b/i, label: "Personal greeting / wish" },
  { pattern: /\b(kya\s+haal|kesay\s+ho|kese\s+ho|kidhar\s+ho|kahan\s+ho|ghar\s+kab|call\s+pick)\b/i, label: "Personal Roman Urdu check-in" },
  { pattern: /\b(software|coding|github|nextjs|react|server|deployment|crypto|property|plot|real\s+estate)\b/i, label: "Non-travel business / tech topic" },
]

/**
 * Fast, deterministic pre-classifier for WhatsApp Coexistence messages.
 * Returns a decisive result when strong travel or personal signals are present,
 * or `null` if ambiguous so the OpenRouter LLM classifier can evaluate context.
 */
export function classifyWhatsappIntentDeterministic(
  input: IntentClassificationInput
): IntentClassificationResult | null {
  const text = (input.inboundText || "").trim()

  // 1. Respect manual founder handoff or pre-linked CRM records
  if (input.existingIntentCategory === "FOUNDER_HANDOFF") {
    return {
      category: "FOUNDER_HANDOFF",
      confidence: 100,
      reason: "Manually marked or handed off by founder as an Al Ramlah Travels lead",
      shouldTriggerAutoReply: true,
      shouldSurfaceAsTravelLead: true,
    }
  }

  if (input.detectedPostCode) {
    return {
      category: "TRAVEL_LEAD",
      confidence: 100,
      reason: `Contains Al Ramlah package reference code (${input.detectedPostCode})`,
      shouldTriggerAutoReply: true,
      shouldSurfaceAsTravelLead: true,
    }
  }

  if (input.hasLinkedApplication || input.hasLinkedOutreachContact) {
    return {
      category: "TRAVEL_LEAD",
      confidence: 98,
      reason: "Contact is linked to an existing Al Ramlah Travels application or B2B outreach record",
      shouldTriggerAutoReply: true,
      shouldSurfaceAsTravelLead: true,
    }
  }

  // 2. Check high-signal Haramain / travel patterns
  const combinedHistory = [
    text,
    ...(input.recentMessages?.slice(-4).map((m) => m.body) ?? []),
  ].join(" \n ")

  for (const { pattern, label } of HIGH_SIGNAL_TRAVEL_PATTERNS) {
    if (pattern.test(text)) {
      return {
        category: "TRAVEL_LEAD",
        confidence: 95,
        reason: `Detected ${label} in message`,
        shouldTriggerAutoReply: true,
        shouldSurfaceAsTravelLead: true,
      }
    }
  }

  // Check if recent thread history already established a high-confidence travel lead
  if (
    input.existingIntentCategory === "TRAVEL_LEAD" &&
    (input.existingIntentConfidence ?? 0) >= 85
  ) {
    for (const { pattern, label } of HIGH_SIGNAL_TRAVEL_PATTERNS) {
      if (pattern.test(combinedHistory)) {
        return {
          category: "TRAVEL_LEAD",
          confidence: 90,
          reason: `Ongoing travel lead thread (${label})`,
          shouldTriggerAutoReply: true,
          shouldSurfaceAsTravelLead: true,
        }
      }
    }
  }

  // 3. Check medium-signal travel patterns (2+ matches = decisive travel lead)
  const mediumMatches = MEDIUM_SIGNAL_TRAVEL_PATTERNS.filter(({ pattern }) =>
    pattern.test(combinedHistory)
  )
  if (mediumMatches.length >= 2) {
    return {
      category: "TRAVEL_LEAD",
      confidence: 88,
      reason: `Matched multiple travel signals (${mediumMatches.map((m) => m.label).join(", ")})`,
      shouldTriggerAutoReply: true,
      shouldSurfaceAsTravelLead: true,
    }
  }

  // 4. Check explicit personal / non-travel patterns when zero travel signals exist
  if (mediumMatches.length === 0) {
    for (const { pattern, label } of PERSONAL_OR_OTHER_PATTERNS) {
      if (pattern.test(text)) {
        return {
          category: "PERSONAL_OR_OTHER",
          confidence: 92,
          reason: `Detected non-travel / personal topic (${label})`,
          shouldTriggerAutoReply: false,
          shouldSurfaceAsTravelLead: false,
        }
      }
    }
  }

  return null
}

/**
 * Full hybrid AI Intent Gatekeeper for WhatsApp Coexistence numbers (+92 319 0462638).
 * Uses deterministic rules first for 0ms latency on clear signals, then falls back
 * to OpenRouter LLM (`google/gemini-2.5-flash`) for nuanced messages.
 *
 * Safety invariant on Coexistence numbers:
 * When in doubt (e.g., a bare "Assalam o Alaikum" or "Hi" with no travel context),
 * defaults to `PERSONAL_OR_OTHER` so personal/other-business contacts NEVER receive
 * unsolicited travel agency auto-replies until they express travel intent.
 */
export async function classifyWhatsappConversationIntent(
  input: IntentClassificationInput
): Promise<IntentClassificationResult> {
  const deterministic = classifyWhatsappIntentDeterministic(input)
  if (deterministic) {
    return deterministic
  }

  const text = (input.inboundText || "").trim()
  const wordCount = text.split(/\s+/).filter(Boolean).length

  // Bare greetings ("Salam", "Hi", "Hello", "Assalam o Alaikum", "Brother") without travel context
  // on a Coexistence number should NOT trigger travel auto-replies yet.
  if (
    wordCount <= 4 &&
    /^(hi|hello|hey|salam|assalam[u\s-]*o[\s-]*alaikum|aoa|asalam\s*ikum|bhai|brother|janab|sir|ok|okay|thanks|shukriya|👍|🙏|\?)+$/i.test(
      text.replace(/[!.,]/g, "").trim()
    )
  ) {
    if (
      input.existingIntentCategory === "TRAVEL_LEAD" &&
      (input.existingIntentConfidence ?? 0) >= 85
    ) {
      return {
        category: "TRAVEL_LEAD",
        confidence: input.existingIntentConfidence ?? 85,
        reason: "Greeting within an active Al Ramlah Travels lead thread",
        shouldTriggerAutoReply: true,
        shouldSurfaceAsTravelLead: true,
      }
    }

    return {
      category: "PERSONAL_OR_OTHER",
      confidence: 80,
      reason: "General greeting without specific travel/Umrah/visa intent yet (auto-reply muted to protect coexistence contacts)",
      shouldTriggerAutoReply: false,
      shouldSurfaceAsTravelLead: false,
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    // Fallback heuristic if OpenRouter key is absent
    const hasSingleMediumSignal = MEDIUM_SIGNAL_TRAVEL_PATTERNS.some(({ pattern }) =>
      pattern.test(text)
    )
    if (hasSingleMediumSignal) {
      return {
        category: "TRAVEL_LEAD",
        confidence: 78,
        reason: "Matched travel/ticketing keyword heuristic",
        shouldTriggerAutoReply: true,
        shouldSurfaceAsTravelLead: true,
      }
    }
    return {
      category: "PERSONAL_OR_OTHER",
      confidence: 75,
      reason: "No Umrah, Hajj, visa, or travel keywords detected in message",
      shouldTriggerAutoReply: false,
      shouldSurfaceAsTravelLead: false,
    }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3500)

    const threadSnippet = (input.recentMessages ?? [])
      .slice(-5)
      .map((m) => `${m.direction === "inbound" ? "Contact" : "Founder"}: ${m.body}`)
      .join("\n")

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_FAST_MODEL || "google/gemini-2.5-flash",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are an AI Intent Gatekeeper for Muhammad Ismail's WhatsApp Business Coexistence number (+92 319 0462638).",
              "People message this number for TWO different reasons:",
              "1. TRAVEL_LEAD: Inquiries related to Al Ramlah Travels (Umrah packages, Hajj, Makkah/Madinah hotels, Saudi visas, flights, air tickets, passport processing, Ziyarat, travel dates, or agency location/bank details for travel).",
              "2. PERSONAL_OR_OTHER: Personal friends, family, social chat, or other unrelated businesses (software, real estate, general networking, casual check-ins).",
              "Respond strictly in JSON: {\"category\": \"TRAVEL_LEAD\" | \"PERSONAL_OR_OTHER\", \"confidence\": 0-100, \"reason\": \"short 1-sentence reason\"}.",
              "IMPORTANT: Only classify as TRAVEL_LEAD if there is clear intent related to travel, Umrah, Hajj, visas, flights, hotels, or Al Ramlah Travels.",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              contactName: input.contactName || "Unknown",
              recentThread: threadSnippet || "(new conversation)",
              latestMessage: text,
            }),
          },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const rawContent = data.choices?.[0]?.message?.content || "{}"
      const parsed = JSON.parse(rawContent) as {
        category?: string
        confidence?: number
        reason?: string
      }

      const isTravel = parsed.category === "TRAVEL_LEAD"
      const confidence = Math.max(
        50,
        Math.min(100, Number(parsed.confidence) || 80)
      )

      return {
        category: isTravel ? "TRAVEL_LEAD" : "PERSONAL_OR_OTHER",
        confidence,
        reason:
          parsed.reason ||
          (isTravel
            ? "AI detected travel/Umrah/visa inquiry intent"
            : "AI classified message as personal or unrelated business"),
        shouldTriggerAutoReply: isTravel && confidence >= 75,
        shouldSurfaceAsTravelLead: isTravel,
      }
    }
  } catch (err) {
    console.warn("[intent-classifier] OpenRouter fallback:", err)
  }

  return {
    category: "PERSONAL_OR_OTHER",
    confidence: 70,
    reason: "Ambiguous message on Coexistence line; auto-reply suppressed for safety",
    shouldTriggerAutoReply: false,
    shouldSurfaceAsTravelLead: false,
  }
}

export interface ParsedFounderForwardedLead {
  leadPhone: string
  leadName: string | null
  inquirySummary: string
}

/**
 * Parses a message sent/forwarded by the Founder's Coexistence number (+92 319 0462638)
 * to the Dedicated AI Agent number so the Dedicated Agent can automatically create
 * the lead in `/desk` and reach out.
 *
 * Example formats supported:
 * - "+92 300 1234567 Ahmed Bhai - Needs 15 Days Ramadan Umrah Quad for 4 pax"
 * - "0321-4567890 Umrah inquiry"
 */
export function parseFounderForwardedLead(
  text: string
): ParsedFounderForwardedLead | null {
  const cleaned = (text || "").trim()
  if (!cleaned) return null

  // Match Pakistani (+92 / 03xx) or international (+1, +44, +966, +971) phone numbers
  const phoneRegex =
    /(?:\+?92[\s-]?3\d{2}[\s-]?\d{7}|\b03\d{2}[\s-]?\d{7}\b|\+\d{1,3}[\s-]?\d{3,4}[\s-]?\d{5,8})/
  const match = cleaned.match(phoneRegex)
  if (!match) return null

  const rawPhone = match[0]
  let digits = rawPhone.replace(/\D/g, "")
  if (digits.startsWith("03") && digits.length === 11) {
    digits = "92" + digits.slice(1)
  }

  const remainder = cleaned
    .replace(rawPhone, "")
    .replace(/^[\s\-:•|]+/, "")
    .trim()

  return {
    leadPhone: digits,
    leadName: null,
    inquirySummary:
      remainder || "Forwarded by Founder (+92 319 0462638) for Al Ramlah Travels Desk follow-up",
  }
}
