import type { FlightScheduleLeg } from "@/lib/ai/extract-packages"

export interface PerTierMarkupPkr {
  sharing?: number
  quad?: number
  triple?: number
  double?: number
}

export interface ExtractedFlyerCardInput {
  id?: string
  cardNumber: string
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
  flightSchedules?: FlightScheduleLeg[]
  makkahNights: string
  makkahHotelName: string
  makkahDistanceLabel: string
  madinahNights: string
  madinahHotelName: string
  madinahDistanceLabel: string
  mealPlanLabel?: string
  transportLabel?: string | null
  tier?: "economy" | "bronze" | "silver" | "gold" | "vip_5star"
  childPricePkr?: number | null
  infantPricePkr?: number | null
  pricingBasis?: "per_person" | "family_lump_sum"
  requiresManualReview?: boolean
  perTierMarkupPkr?: PerTierMarkupPkr
  rawSharingPkr: number
  rawQuadPkr: number
  rawTriplePkr: number
  rawDoublePkr: number
}

export interface ExtractedSupplierFlyerDraft {
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
  cards: ExtractedFlyerCardInput[]
}

export type FlexibleRawCardPrices =
  | {
      rawSharingPkr: number
      rawQuadPkr: number
      rawTriplePkr: number
      rawDoublePkr: number
      perTierMarkupPkr?: PerTierMarkupPkr
    }
  | {
      sharing: number
      quad: number
      triple: number
      double: number
      perTierMarkupPkr?: PerTierMarkupPkr
    }

/**
 * Deterministic financial calculator supporting both Supplier Commission modes (`T-026`, `OD-09b`):
 * 1) `included_in_flyer`: Supplier flyer shows retail prices; agency commission is already embedded inside.
 *    -> retail = raw, net = max(0, raw - commission)
 * 2) `net_plus_markup`: Supplier flyer shows wholesale net rates; agency adds flat or per-tier markup on top.
 *    -> net = raw, retail = raw + markup
 *
 * Invariant (`OD-09b`): Any tier whose raw price is `0` ("On Request" / unoffered tier) MUST remain `0`
 * across raw, net, and retail — never turned into a positive PKR price by adding markup.
 */
export function computeCardFinancials(
  card: FlexibleRawCardPrices,
  commissionMode: "included_in_flyer" | "net_plus_markup",
  commissionPkr: number,
  overridePerTierMarkup?: PerTierMarkupPkr
) {
  const safeBaseComm = Math.max(
    0,
    Math.round(Number.isFinite(commissionPkr) ? commissionPkr : 0)
  )
  const tierMarkups = overridePerTierMarkup ?? card.perTierMarkupPkr

  const rawSharing =
    "rawSharingPkr" in card ? card.rawSharingPkr : card.sharing
  const rawQuad = "rawQuadPkr" in card ? card.rawQuadPkr : card.quad
  const rawTriple = "rawTriplePkr" in card ? card.rawTriplePkr : card.triple
  const rawDouble = "rawDoublePkr" in card ? card.rawDoublePkr : card.double

  const resolveMarkup = (tierValue: number | undefined): number => {
    if (
      typeof tierValue === "number" &&
      Number.isFinite(tierValue) &&
      tierValue >= 0
    ) {
      return Math.round(tierValue)
    }
    return safeBaseComm
  }

  const calcTier = (rawVal: number, tierMarkup: number) => {
    const safeRaw = Math.max(
      0,
      Math.round(Number.isFinite(rawVal) ? rawVal : 0)
    )
    if (safeRaw === 0) {
      return { net: 0, retail: 0 }
    }
    if (commissionMode === "net_plus_markup") {
      return {
        net: safeRaw,
        retail: safeRaw + tierMarkup,
      }
    }
    return {
      net: Math.max(0, safeRaw - tierMarkup),
      retail: safeRaw,
    }
  }

  const s = calcTier(rawSharing, resolveMarkup(tierMarkups?.sharing))
  const q = calcTier(rawQuad, resolveMarkup(tierMarkups?.quad))
  const t = calcTier(rawTriple, resolveMarkup(tierMarkups?.triple))
  const d = calcTier(rawDouble, resolveMarkup(tierMarkups?.double))

  return {
    netSharingPkr: s.net,
    retailSharingPkr: s.retail,
    netQuadPkr: q.net,
    retailQuadPkr: q.retail,
    netTriplePkr: t.net,
    retailTriplePkr: t.retail,
    netDoublePkr: d.net,
    retailDoublePkr: d.retail,
  }
}

export const AMMAAR_AIRBLUE_21D_PRESET: ExtractedSupplierFlyerDraft = {
  title: "Ammaar 21 Days Airblue Umrah Packages (Nov 2026)",
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
      rawSharingPkr: 261899,
      rawQuadPkr: 267899,
      rawTriplePkr: 278899,
      rawDoublePkr: 301899,
    },
    {
      cardNumber: "02",
      outboundFlightNo: "PA 470",
      outboundDateLabel: "05 NOV",
      outboundRoute: "LHE - JED",
      outboundDepTime: "06:35",
      outboundArrTime: "10:35",
      returnFlightNo: "PA 471",
      returnDateLabel: "26 NOV",
      returnRoute: "JED - LHE",
      returnDepTime: "11:35",
      returnArrTime: "18:20",
      makkahNights: "15N",
      makkahHotelName: "Zavaj Aloko / Malak Aloko",
      makkahDistanceLabel: "(Shuttle)",
      madinahNights: "05N",
      madinahHotelName: "Minar Al Madinah",
      madinahDistanceLabel: "(550M)",
      mealPlanLabel: "Room Only",
      rawSharingPkr: 266899,
      rawQuadPkr: 271899,
      rawTriplePkr: 285899,
      rawDoublePkr: 311899,
    },
    {
      cardNumber: "03",
      outboundFlightNo: "PA 470",
      outboundDateLabel: "08 NOV",
      outboundRoute: "LHE - JED",
      outboundDepTime: "06:35",
      outboundArrTime: "10:35",
      returnFlightNo: "PA 471",
      returnDateLabel: "29 NOV",
      returnRoute: "JED - LHE",
      returnDepTime: "11:35",
      returnArrTime: "18:20",
      makkahNights: "15N",
      makkahHotelName: "Snood Al Azama",
      makkahDistanceLabel: "(950M)",
      madinahNights: "05N",
      madinahHotelName: "Karam Al Hejaz",
      madinahDistanceLabel: "(450M)",
      mealPlanLabel: "Room Only",
      rawSharingPkr: 276899,
      rawQuadPkr: 284899,
      rawTriplePkr: 300899,
      rawDoublePkr: 331899,
    },
    {
      cardNumber: "04",
      outboundFlightNo: "PA 470",
      outboundDateLabel: "10 NOV",
      outboundRoute: "LHE - JED",
      outboundDepTime: "06:35",
      outboundArrTime: "10:35",
      returnFlightNo: "PA 471",
      returnDateLabel: "01 DEC",
      returnRoute: "JED - LHE",
      returnDepTime: "11:35",
      returnArrTime: "18:20",
      makkahNights: "15N",
      makkahHotelName: "Voco Makkah (IHG)",
      makkahDistanceLabel: "(VIP Shuttle)",
      madinahNights: "05N",
      madinahHotelName: "Emaar Taibah",
      madinahDistanceLabel: "(300M)",
      mealPlanLabel: "Breakfast Included",
      rawSharingPkr: 315000,
      rawQuadPkr: 329000,
      rawTriplePkr: 358000,
      rawDoublePkr: 412000,
    },
  ],
}

export const UPSKY_SAUDIA_15D_PRESET: ExtractedSupplierFlyerDraft = {
  title: "Upsky 15 Days Saudia Direct Umrah Packages (Nov–Dec 2026)",
  airlineName: "Saudia",
  airlineIataCode: "SV",
  airlineLogoUrl: "https://images.kiwi.com/airlines/64/SV.png",
  durationDays: 15,
  daysTitle: "15 DAYS",
  routePill: "LHE - JED | MED - LHE",
  departureCityCode: "LHE",
  arrivalAirportCode: "JED",
  returnAirportCode: "MED",
  outboundBaggage: "23 Kg + 7 Kg",
  inboundBaggage: "2x23 Kg + 7 Kg + 5 Ltr Zamzam",
  giftedInclusions: [
    "Visa",
    "Insurance",
    "Hotel",
    "Return Ticket",
    "Transport",
    "Ziyarat",
  ],
  cards: [
    {
      cardNumber: "01",
      outboundFlightNo: "SV 739",
      outboundDateLabel: "12 NOV",
      outboundRoute: "LHE - JED",
      outboundDepTime: "11:15",
      outboundArrTime: "14:55",
      returnFlightNo: "SV 736",
      returnDateLabel: "27 NOV",
      returnRoute: "MED - LHE",
      returnDepTime: "02:30",
      returnArrTime: "09:10",
      makkahNights: "08N",
      makkahHotelName: "Kiswah Towers",
      makkahDistanceLabel: "(Shuttle)",
      madinahNights: "06N",
      madinahHotelName: "Markaziyah Star",
      madinahDistanceLabel: "(250M)",
      mealPlanLabel: "Room Only",
      rawSharingPkr: 298000,
      rawQuadPkr: 309000,
      rawTriplePkr: 329000,
      rawDoublePkr: 365000,
    },
    {
      cardNumber: "02",
      outboundFlightNo: "SV 739",
      outboundDateLabel: "16 NOV",
      outboundRoute: "LHE - JED",
      outboundDepTime: "11:15",
      outboundArrTime: "14:55",
      returnFlightNo: "SV 736",
      returnDateLabel: "01 DEC",
      returnRoute: "MED - LHE",
      returnDepTime: "02:30",
      returnArrTime: "09:10",
      makkahNights: "08N",
      makkahHotelName: "Swissotel Al Maqam",
      makkahDistanceLabel: "(0M Clock Tower)",
      madinahNights: "06N",
      madinahHotelName: "Anwar Al Madinah Movenpick",
      madinahDistanceLabel: "(50M Front)",
      mealPlanLabel: "Breakfast Buffet",
      rawSharingPkr: 465000,
      rawQuadPkr: 495000,
      rawTriplePkr: 560000,
      rawDoublePkr: 690000,
    },
  ],
}

export const SUPPLIER_FLYER_PRESETS: Record<string, ExtractedSupplierFlyerDraft> = {
  ammaar_airblue_21d: AMMAAR_AIRBLUE_21D_PRESET,
  upsky_saudia_15d: UPSKY_SAUDIA_15D_PRESET,
}

/**
 * Extracts structured package cards from an uploaded supplier flyer image URL.
 * Delegates to the production multimodal AI extractor (`lib/ai/extract-packages.ts`),
 * which enforces `assertSafeExternalUrl` R2 HTTPS allowlisting, `20 MB` caps, and GA model slugs.
 */
export async function extractSupplierFlyerWithAi(params: {
  imageUrl?: string
  supplierSlug?: string
  presetKey?: "ammaar_airblue_21d" | "upsky_saudia_15d" | string
}): Promise<ExtractedSupplierFlyerDraft> {
  if (params.presetKey && SUPPLIER_FLYER_PRESETS[params.presetKey]) {
    return structuredClone(SUPPLIER_FLYER_PRESETS[params.presetKey]!)
  }

  const { extractPackagesMultimodal } = await import("@/lib/ai/extract-packages")
  const result = await extractPackagesMultimodal({
    mediaUrl: params.imageUrl,
    supplierSlug: params.supplierSlug,
    ingestionMode: "raw_supplier_flyer",
    commissionMode: "included_in_flyer",
    commissionPkr: 22000,
  })

  return {
    title: result.title,
    airlineName: result.airlineName,
    airlineIataCode: result.airlineIataCode,
    airlineLogoUrl:
      result.airlineLogoUrl ||
      `https://images.kiwi.com/airlines/64/${result.airlineIataCode || "PA"}.png`,
    durationDays: result.durationDays,
    daysTitle: result.daysTitle,
    routePill: result.routePill,
    departureCityCode: result.departureCityCode || "LHE",
    arrivalAirportCode: result.arrivalAirportCode || "JED",
    returnAirportCode: result.returnAirportCode || "JED",
    outboundBaggage: result.outboundBaggage ?? "",
    inboundBaggage: result.inboundBaggage ?? "",
    giftedInclusions: result.giftedInclusions,
    cards: result.cards.map((c) => ({
      cardNumber: c.cardNumber,
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
      flightSchedules: c.flightSchedules,
      makkahNights: c.makkahNights,
      makkahHotelName: c.makkahHotelName,
      makkahDistanceLabel: c.makkahDistanceLabel,
      madinahNights: c.madinahNights,
      madinahHotelName: c.madinahHotelName,
      madinahDistanceLabel: c.madinahDistanceLabel,
      mealPlanLabel: c.mealPlanLabel,
      transportLabel: c.transportLabel,
      tier: c.tier,
      childPricePkr: c.childPricePkr,
      infantPricePkr: c.infantPricePkr,
      pricingBasis: c.pricingBasis,
      requiresManualReview: c.requiresManualReview,
      rawSharingPkr: c.rawSharingPkr,
      rawQuadPkr: c.rawQuadPkr,
      rawTriplePkr: c.rawTriplePkr,
      rawDoublePkr: c.rawDoublePkr,
    })),
  }
}

export const extractSupplierFlyerDraft = extractSupplierFlyerWithAi
