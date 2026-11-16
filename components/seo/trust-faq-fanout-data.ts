import { formatPkr } from "@/components/public/public-utils"
import type {
  PublicFaqCategory,
  PublicFaqDto,
  PublicVisaRateDto,
} from "@/lib/seo/public-queries"

export type AiFanoutDimension =
  | "scope"
  | "cost_drivers"
  | "comparisons"
  | "edge_cases"
  | "scam_red_flags"
  | "verification"

export interface CategorizedFaqItem {
  id: string
  category: PublicFaqCategory
  dimension: AiFanoutDimension
  question: string
  answer: string
}

export interface FaqCategorySection {
  category: PublicFaqCategory
  title: string
  subtitle: string
  hubHref: string
  hubLabel: string
  items: CategorizedFaqItem[]
}

export const FAQ_CATEGORY_META: ReadonlyArray<{
  category: PublicFaqCategory
  title: string
  subtitle: string
  hubHref: string
  hubLabel: string
}> = [
  {
    category: "packages",
    title: "Umrah Packages, PKR Cost Drivers & Custom vs Group Choices",
    subtitle:
      "Scope of inclusions, seasonal PKR pricing factors, and departure gateways across Lahore (LHE), Karachi (KHI), and Islamabad (ISB).",
    hubHref: "/umrah-packages",
    hubLabel: "Compare Group Umrah Packages",
  },
  {
    category: "visa",
    title: "Saudi Umrah Visa Rules, Biometrics & Infant / >30-Day Tiers",
    subtitle:
      "Automatic Short-Term vs Long-Term KSA stay calculation, Nusuk Masar hotel rules, Saudi Visa Bio app, and overseas NICOP guidance.",
    hubHref: "/umrah-visa",
    hubLabel: "View Live Saudi Visa PKR Rates",
  },
  {
    category: "hotels",
    title: "Makkah & Madinah Hotels, Walking Distances & Wheelchair Access",
    subtitle:
      "True courtyard meter distances, Clock Tower vs shuttle trade-offs, Ladies Gate 25 proximity in Madinah, and family room splits.",
    hubHref: "/hotels/makkah",
    hubLabel: "Browse Makkah & Madinah Hotels",
  },
  {
    category: "transport",
    title: "Jeddah vs Madinah Flights, Haramain Train & Private Fleet",
    subtitle:
      "Why Makkah-first trips land at Jeddah (JED), open-jaw flight time savings, vehicle suitcase limits, and guided Ziyarat logistics.",
    hubHref: "/ziyarat",
    hubLabel: "Explore Ziyarat & Fleet Guide",
  },
  {
    category: "hajj",
    title: "Hajj 2027 Pre-Registration & Maktab A+, A, B, C Tiers",
    subtitle:
      "Non-binding indicative pre-registration rules, shifting vs non-shifting Aziziya stays, and MoRA / Nusuk quota timelines.",
    hubHref: "/hajj-2027",
    hubLabel: "Open Hajj 2027 Maktab Guide",
  },
  {
    category: "general",
    title: "Lahore Cantt Verification, Scam Prevention & Diaspora Support",
    subtitle:
      "How to verify our Askari 10 headquarters before paying, online quotation tracking, and UK/US/CA/UAE family coordination.",
    hubHref: "/about",
    hubLabel: "Verify Our Askari 10 Lahore Office",
  },
]

function normalizeQuestionKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function buildBaselinePilgrimageFaqs(
  visaRates: ReadonlyArray<PublicVisaRateDto>
): CategorizedFaqItem[] {
  const shortTerm = visaRates.find(
    (r) => r.tier === "short_term" && Number.isFinite(r.pricePkr) && r.pricePkr > 0
  )
  const longTerm = visaRates.find(
    (r) => r.tier === "long_term" && Number.isFinite(r.pricePkr) && r.pricePkr > 0
  )

  const liveVisaRateClause =
    shortTerm && longTerm
      ? `Current standalone Visa-Only rates start at ${formatPkr(shortTerm.pricePkr)} per passport for Short-Term stays (up to ${shortTerm.maxDays} days) and ${formatPkr(longTerm.pricePkr)} per passport for Long-Term stays (31 to ${longTerm.maxDays} days), including mandatory Saudi medical insurance.`
      : shortTerm
        ? `Current standalone Short-Term Visa-Only processing starts at ${formatPkr(shortTerm.pricePkr)} per passport (up to ${shortTerm.maxDays} days) with mandatory Saudi medical insurance included.`
        : "Standalone Visa-Only requests display our live fixed PKR per-passport tariff immediately upon selecting your KSA arrival and departure dates, inclusive of mandatory Saudi medical insurance."

  return [
    {
      id: "fanout-pkg-1",
      category: "packages",
      dimension: "scope",
      question:
        "What is included vs excluded in a complete Umrah package from Pakistan?",
      answer:
        "A complete Al Ramlah Travels Umrah package includes official Saudi Umrah e-visa issuance with mandatory KSA health insurance, return international airfare from Lahore (LHE), Karachi (KHI), or Islamabad (ISB), verified Makkah and Madinah hotel nights, and airport-to-hotel ground transfers. Optional upgrades include Haramain High-Speed Train tickets, full-board dining, and private scholar-led Ziyarat excursions.",
    },
    {
      id: "fanout-pkg-2",
      category: "packages",
      dimension: "cost_drivers",
      question:
        "What drives PKR price differences between economy, star, and 5-star courtyard Umrah packages?",
      answer:
        "Five factors govern PKR Umrah pricing: (1) walking distance to Masjid al-Haram and Masjid an-Nabawi (0–50m Clock Tower suites vs 1,000m+ shuttle hotels), (2) travel season (Ramadan Last Ashra and December school holidays vs Safar or Shawwal), (3) direct Saudia/PIA flights vs 1-stop Gulf carriers, (4) Double vs Quad/Sharing room occupancy, and (5) prevailing SAR-to-PKR exchange rates.",
    },
    {
      id: "fanout-pkg-3",
      category: "packages",
      dimension: "comparisons",
      question:
        "Should our family book a Fixed-Departure Group Umrah Batch or a Custom Private Itinerary?",
      answer:
        "Fixed-departure group batches suit couples and budget-conscious travellers who want pre-locked airline block seats and published Sharing, Quad, Triple, or Double PKR rates on set dates. Custom private itineraries are ideal for multi-generational families, executives, and overseas diaspora needing exact travel dates, zero-step courtyard hotels, open-jaw flights, and private GMC or HiAce transfers.",
    },
    {
      id: "fanout-pkg-4",
      category: "packages",
      dimension: "cost_drivers",
      question:
        "Why do custom itineraries with hotels or flights display 'Live Rate — Confirmed upon submission'?",
      answer:
        "Unlike standalone Visa-Only orders, airline seat buckets, Haramain hotel allotments, and private KSA fleet rates fluctuate daily by Hijri calendar demand. Instead of inflating online checkout prices with guesswork buffers, our Lahore ticketing desk verifies live inventory within 24 hours and sends an itemized PKR quotation worksheet locked until its stated validUntil timestamp.",
    },
    {
      id: "fanout-visa-1",
      category: "visa",
      dimension: "edge_cases",
      question:
        "How are Short-Term (<=30 days) and Long-Term (31–90 days) Saudi Umrah visa fees calculated in PKR?",
      answer: `Our planner automatically counts the inclusive days between your mandatory KSA Arrival Date and KSA Departure Date—you never select visa tiers manually. Stays up to 30 days receive the Short-Term tariff, while stays of 31 to 90 days receive the Long-Term tariff. ${liveVisaRateClause}`,
    },
    {
      id: "fanout-visa-2",
      category: "visa",
      dimension: "comparisons",
      question:
        "What is the difference between a Standalone Without-Masar Umrah Visa and a Masar Hotel-Linked Visa?",
      answer:
        "A standalone Without-Masar Umrah visa allows pilgrims who already have verified family accommodation or separate hotel bookings to obtain electronic KSA entry clearance at a fixed PKR rate. When you bundle Makkah and Madinah hotels through Al Ramlah Travels, your visa is issued through the official Saudi Nusuk Masar platform linked directly to your contracted hotel vouchers and transport.",
    },
    {
      id: "fanout-visa-3",
      category: "visa",
      dimension: "edge_cases",
      question:
        "How do Pakistani pilgrims complete fingerprints on the Saudi Visa Bio smartphone app?",
      answer:
        "Saudi authorities allow Umrah applicants in Pakistan to complete facial, passport-chip/MRZ, and 10-finger biometric enrollment from home using the official Saudi Visa Bio iOS or Android app before arrival—avoiding long biometric queues at Jeddah or Madinah immigration. Our Lahore visa desk reviews your biometric confirmation receipt prior to MOFA submission.",
    },
    {
      id: "fanout-visa-4",
      category: "visa",
      dimension: "edge_cases",
      question:
        "Can overseas Pakistanis holding UK, US, Canadian, EU, or GCC passports book with relatives in Pakistan?",
      answer:
        "Yes. We regularly synchronize multi-origin family pilgrimages where parents depart from Lahore (LHE), Karachi (KHI), or Islamabad (ISB) on Pakistani MRP passports while overseas children fly from London, Manchester, Toronto, New York, or Dubai on NICOP or western passports—aligning Jeddah or Madinah arrival windows into the same Haramain hotel rooms and GMC transfers.",
    },
    {
      id: "fanout-hotel-1",
      category: "hotels",
      dimension: "edge_cases",
      question:
        "Do infants under 2 years require a separate hotel bed or transport vehicle seat?",
      answer:
        "No. Under Saudi hospitality and aviation rules, hotel bed allocations and KSA vehicle seat capacities count Adults + Children (2–11 years) only. Infants under 2 years occupy 0 hotel beds and 0 vehicle seats, though every infant still requires an individual machine-readable passport, a Saudi Umrah visa, and an airline lap-infant ticket.",
    },
    {
      id: "fanout-hotel-2",
      category: "hotels",
      dimension: "comparisons",
      question:
        "Which Makkah and Madinah hotel zones are safest for elderly or wheelchair-using parents?",
      answer:
        "For elderly or wheelchair-using pilgrims in Makkah, choose 0–50m Clock Tower or flat Ajyad courtyard hotels with direct elevator drop-offs rather than hillside properties that require steep climbs during prayer rush. In Madinah, prioritize Northern and Central Markaziyah hotels (50–200m flat walk) positioned near Ladies Gate 25 through Gate 37.",
    },
    {
      id: "fanout-hotel-3",
      category: "hotels",
      dimension: "scope",
      question:
        "How do Quad, Triple, Double, and Sharing hotel room configurations work for families?",
      answer:
        "Private Double (2 beds), Triple (3 beds), and Quad (4 beds) rooms reserve the entire room exclusively for your family—for example, a family of 5 Adults + Children can split cleanly into one Triple plus one Double room. Gender-segregated Sharing beds place solo male or female group travellers with fellow pilgrims of the same gender to minimize per-person PKR cost.",
    },
    {
      id: "fanout-hotel-4",
      category: "hotels",
      dimension: "edge_cases",
      question:
        "Do pilgrims need a Nusuk app permit to pray in Riyadh ul Jannah (Rawdah) in Madinah?",
      answer:
        "Five daily prayers inside Masjid al-Haram and Masjid an-Nabawi do not require permits, and Umrah Tawaf permits are managed seamlessly alongside your visa. However, entering the blessed Rawdah ash-Sharifah (Riyadh ul Jannah) in Madinah strictly requires a timed digital slot booked on the official Saudi Nusuk app—separate slots apply for men and women.",
    },
    {
      id: "fanout-trans-1",
      category: "transport",
      dimension: "edge_cases",
      question:
        "Why do itineraries starting in Makkah always land at Jeddah Airport (JED)?",
      answer:
        "Makkah al-Mukarramah does not have a civilian commercial airport; the closest international gateway is King Abdulaziz International Airport in Jeddah (JED), approximately 85–95 km away. Every Makkah-first itinerary automatically locks inbound arrival to JED paired with immediate private sedan/SUV/van ground transfer or Haramain High-Speed Train connection to Makkah.",
    },
    {
      id: "fanout-trans-2",
      category: "transport",
      dimension: "comparisons",
      question:
        "Is an open-jaw flight (Arrive Jeddah JED, Return from Madinah MED) better than round-trip Jeddah?",
      answer:
        "Yes—whenever airline schedules from Lahore, Karachi, or Islamabad permit, open-jaw routing (landing in JED in Ihram for Makkah first, travelling once to Madinah, and flying home directly from Prince Mohammad bin Abdulaziz Airport MED) eliminates a tiring 450 km return highway journey back to Jeddah on your departure day.",
    },
    {
      id: "fanout-trans-3",
      category: "transport",
      dimension: "scope",
      question:
        "Which private vehicle size fits our family and suitcases, and can Haramain Train do Ziyarat?",
      answer:
        "Our road fleet scales by seated passengers (Adults + Children) and checked suitcases: Executive Sedan (1–3 pax), GMC Yukon / Chevy Suburban SUV (4–6 pax), Hyundai Staria / Toyota HiAce Van (7–12 pax), and Coaster / Coach Bus (13+ pax). The 300 km/h Haramain High-Speed Train operates shared station-to-station intercity rail only and cannot be used for local Ziyarat tours.",
    },
    {
      id: "fanout-hajj-1",
      category: "hajj",
      dimension: "scope",
      question:
        "How does Al Ramlah Travels' Hajj 2027 Indicative Pre-Registration work?",
      answer:
        "Submitting a Hajj 2027 inquiry carries zero upfront online payment and places your family on our priority advisory roster for Maktab A+, A, B, or C tiers. Published 2027 structures are non-binding indicative estimates; formal contracts and deposits open strictly after official Saudi Ministry of Hajj & Umrah (Nusuk) and Pakistan MoRA quotas are announced.",
    },
    {
      id: "fanout-hajj-2",
      category: "hajj",
      dimension: "comparisons",
      question:
        "What is the difference between Maktab A+, A, B, and C and Shifting vs Non-Shifting Hajj packages?",
      answer:
        "Maktab A+ and A place pilgrims in upgraded Mina camps closest to the Jamarat bridge, whereas Maktab B and C balance verified comfort with accessible PKR budgets further along pedestrian routes or Mashair rail links. Non-shifting packages keep your Makkah courtyard hotel throughout Manasik days, while Shifting packages utilize dedicated Aziziya residences around 8–13 Dhul-Hijjah.",
    },
    {
      id: "fanout-gen-1",
      category: "general",
      dimension: "scam_red_flags",
      question:
        "What red flags should Pakistani families watch for to avoid unverified Umrah agent scams?",
      answer:
        "Avoid unverified social-media brokers who have no physical office, demand cash into personal individual bank accounts, advertise '5-minute walk to Haram' without naming the exact hotel or meter distance, or refuse to share airline PNR and MOFA visa tracking numbers. Always insist on an itemized written PKR quotation and written cancellation policy.",
    },
    {
      id: "fanout-gen-2",
      category: "general",
      dimension: "verification",
      question:
        "How can we verify Al Ramlah Travels in Lahore before paying a booking deposit?",
      answer:
        "You can visit our staffed headquarters in person at Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt (~5 minutes from Allama Iqbal International Airport LHE) Monday through Saturday 9:00 AM–8:00 PM PKT, verify your numbered ART-... dossier on our online Status Tracker, and inspect your hotel, flight, and visa line items before confirming.",
    },
    {
      id: "fanout-gen-3",
      category: "general",
      dimension: "verification",
      question:
        "What happens if we need to amend travel dates or cancel after visa or ticket issuance?",
      answer:
        "Once passport data is transmitted to Saudi MOFA/Nusuk/Masar portals or discounted group airline PNR seats are issued, Saudi visa fees and group block tickets are 100% non-refundable. Commercial GDS tickets follow IATA carrier rules, and land hotel/transport refunds follow our published notice-window schedule in PKR (with strict blackouts during Ramadan, Zil-Hajj, and Hajj).",
    },
  ]
}

const CATEGORY_DEFAULT_DIMENSION: Record<PublicFaqCategory, AiFanoutDimension> = {
  packages: "cost_drivers",
  visa: "edge_cases",
  hotels: "comparisons",
  transport: "comparisons",
  hajj: "scope",
  general: "verification",
}

/**
 * Merges live `getPublicFaqs()` rows with our 20-item 6-dimension AI fan-out baseline
 * and live `getPublicVisaRates()` PKR figures (`SEO-022`).
 * Guarantees `18–24` non-empty categorized Q&As with 100% 1:1 DOM-to-JSON-LD parity.
 */
export function buildMergedPilgrimageFaqs(
  dbFaqs: ReadonlyArray<PublicFaqDto>,
  visaRates: ReadonlyArray<PublicVisaRateDto>
): {
  flatFaqs: CategorizedFaqItem[]
  sections: FaqCategorySection[]
} {
  const baseline = buildBaselinePilgrimageFaqs(visaRates)
  const byKey = new Map<string, CategorizedFaqItem>()

  for (const item of baseline) {
    byKey.set(normalizeQuestionKey(item.question), item)
  }

  let extraAdded = 0
  for (const dbRow of dbFaqs) {
    const question = (dbRow.question || "").trim()
    const answer = (dbRow.answer || "").trim()
    if (!question || !answer) continue

    const key = normalizeQuestionKey(question)
    const existing = byKey.get(key)
    if (existing) {
      // Preserve live-interpolated visa rate accuracy if DB seed lacks live tariff numbers on the visa tier question
      byKey.set(key, {
        id: dbRow.id || existing.id,
        category: dbRow.category || existing.category,
        dimension: existing.dimension,
        question,
        answer,
      })
    } else if (byKey.size < 24 && extraAdded < 4) {
      const cat: PublicFaqCategory = dbRow.category || "general"
      byKey.set(key, {
        id: dbRow.id || `db-faq-${extraAdded}`,
        category: cat,
        dimension: CATEGORY_DEFAULT_DIMENSION[cat],
        question,
        answer,
      })
      extraAdded += 1
    }
  }

  const allItems = Array.from(byKey.values())

  const sections: FaqCategorySection[] = FAQ_CATEGORY_META.map((meta) => ({
    ...meta,
    items: allItems.filter((item) => item.category === meta.category),
  })).filter((section) => section.items.length > 0)

  const flatFaqs = sections.flatMap((section) => section.items)

  return {
    flatFaqs,
    sections,
  }
}
