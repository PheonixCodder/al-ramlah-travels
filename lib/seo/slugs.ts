export type UmrahGatewayCitySlug = "lahore" | "karachi" | "islamabad"
export type HaramainCitySlug = "makkah" | "madinah"

export interface UmrahGatewayCityInfo {
  slug: UmrahGatewayCitySlug
  routeSegment: `from-${UmrahGatewayCitySlug}`
  cityName: string
  province: string
  airportCode: "LHE" | "KHI" | "ISB"
  airportName: string
  terminalBriefing: string
  catchmentCities: readonly string[]
  directCarriersSummary: string
}

export const UMRAH_GATEWAY_CITIES: Record<
  UmrahGatewayCitySlug,
  UmrahGatewayCityInfo
> = {
  lahore: {
    slug: "lahore",
    routeSegment: "from-lahore",
    cityName: "Lahore",
    province: "Punjab",
    airportCode: "LHE",
    airportName: "Allama Iqbal International Airport",
    terminalBriefing:
      "International Hajj & Umrah departures operate from the main Allama Iqbal International Terminal with dedicated Ihram changing rooms adjacent to Askari 10 & Airport Road.",
    catchmentCities: [
      "Lahore",
      "Gujranwala",
      "Faisalabad",
      "Sialkot",
      "Kasur",
      "Sheikhupura",
      "Okara",
    ],
    directCarriersSummary:
      "Direct non-stop flights to Jeddah (JED) and Madinah (MED) on Saudia (SV), PIA (PK), Airblue (PA), and SereneAir (ER), plus 1-stop Gulf connections.",
  },
  karachi: {
    slug: "karachi",
    routeSegment: "from-karachi",
    cityName: "Karachi",
    province: "Sindh",
    airportCode: "KHI",
    airportName: "Jinnah International Airport",
    terminalBriefing:
      "Shortest flight time from Pakistan to the Haramain (~4 hours non-stop to Jeddah) departing from Jinnah International Satellite West & East concourses.",
    catchmentCities: [
      "Karachi",
      "Hyderabad",
      "Sukkur",
      "Mirpurkhas",
      "Quetta",
      "Gwadar",
    ],
    directCarriersSummary:
      "High-frequency daily non-stop flights to Jeddah (JED) and Madinah (MED) via Saudia (SV), PIA (PK), Airblue (PA), SereneAir (ER), Emirates (EK), and Qatar Airways (QR).",
  },
  islamabad: {
    slug: "islamabad",
    routeSegment: "from-islamabad",
    cityName: "Islamabad",
    province: "Islamabad Capital Territory & Northern Punjab / KP",
    airportCode: "ISB",
    airportName: "Islamabad International Airport",
    terminalBriefing:
      "Modern greenfield international terminal near Fateh Jang serving twin-city, Potohar, Azad Kashmir, and Khyber Pakhtunkhwa pilgrims with spacious prayer lounges.",
    catchmentCities: [
      "Islamabad",
      "Peshawar",
      "Abbottabad",
      "Jhelum",
      "Chakwal",
      "Mirpur AJK",
      "Mardan",
    ],
    directCarriersSummary:
      "Direct wide-body Saudia (SV) and PIA (PK) departures to Jeddah (JED) and Madinah (MED) alongside Airblue (PA) and premium Gulf carriers.",
  },
} as const

export const UMRAH_GATEWAY_CITY_SLUGS: readonly UmrahGatewayCitySlug[] = [
  "lahore",
  "karachi",
  "islamabad",
] as const

export interface HaramainCityInfo {
  slug: HaramainCitySlug
  cityName: "Makkah" | "Madinah"
  formalName: string
  arabicName: string
  sacredMosqueName: string
  entryAirportNote: string
}

export const HARAMAIN_CITIES: Record<HaramainCitySlug, HaramainCityInfo> = {
  makkah: {
    slug: "makkah",
    cityName: "Makkah",
    formalName: "Makkah al-Mukarramah",
    arabicName: "مكة المكرمة",
    sacredMosqueName: "Masjid al-Haram",
    entryAirportNote:
      "Makkah has no civilian airport; all Makkah-first itineraries arrive via King Abdulaziz International Airport in Jeddah (JED) with immediate 75-minute ground or Haramain High-Speed Train transfer.",
  },
  madinah: {
    slug: "madinah",
    cityName: "Madinah",
    formalName: "Al-Madinah al-Munawwarah",
    arabicName: "المدينة المنورة",
    sacredMosqueName: "Masjid an-Nabawi",
    entryAirportNote:
      "Madinah-first itineraries land directly at Prince Mohammad bin Abdulaziz International Airport (MED), approximately 25–30 minutes from the Markaziyah hotel courtyards.",
  },
} as const

export function resolveUmrahGatewayCity(
  slugOrCode: string | null | undefined
): UmrahGatewayCityInfo | null {
  const cleaned = (slugOrCode ?? "")
    .trim()
    .toLowerCase()
    .replace(/^from-/, "")
  if (cleaned === "lahore" || cleaned === "lhe") {
    return UMRAH_GATEWAY_CITIES.lahore
  }
  if (cleaned === "karachi" || cleaned === "khi") {
    return UMRAH_GATEWAY_CITIES.karachi
  }
  if (cleaned === "islamabad" || cleaned === "isb") {
    return UMRAH_GATEWAY_CITIES.islamabad
  }
  return null
}

export function resolveHaramainCity(
  slug: string | null | undefined
): HaramainCityInfo | null {
  const cleaned = (slug ?? "").trim().toLowerCase()
  if (cleaned === "makkah" || cleaned === "mecca") {
    return HARAMAIN_CITIES.makkah
  }
  if (cleaned === "madinah" || cleaned === "medina") {
    return HARAMAIN_CITIES.madinah
  }
  return null
}

/**
 * Normalizes arbitrary user/CMS text into a clean lowercase ASCII URL slug (`[a-z0-9-]`).
 */
export function normalizeRouteSlug(
  raw: string | null | undefined,
  maxLen = 120
): string {
  if (!raw) return ""
  const ascii = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  if (ascii.length <= maxLen) {
    return ascii
  }
  const sliced = ascii.slice(0, maxLen).replace(/-+$/g, "")
  const lastHyphen = sliced.lastIndexOf("-")
  return lastHyphen >= Math.floor(maxLen * 0.6)
    ? sliced.slice(0, lastHyphen)
    : sliced
}

export interface SemanticPackageSlugInput {
  title?: string | null
  durationDays?: number | null
  departureCityCode?: string | null
  makkahHotelName?: string | null
  postCode?: string | null
}

/**
 * Generates semantic, keyword-rich, collision-safe Umrah package slugs (`SEO-014`).
 * Example: `"15-day-umrah-lahore-swissotel-al-maqam-art-lh-01"`
 */
export function buildSemanticPackageSlug(
  input: SemanticPackageSlugInput
): string {
  const parts: string[] = []

  if (
    typeof input.durationDays === "number" &&
    Number.isFinite(input.durationDays) &&
    input.durationDays > 0
  ) {
    parts.push(`${Math.round(input.durationDays)}-day-umrah`)
  } else if (input.title) {
    parts.push(normalizeRouteSlug(input.title, 44))
  } else {
    parts.push("umrah-package")
  }

  const gateway = resolveUmrahGatewayCity(input.departureCityCode)
  if (gateway) {
    parts.push(gateway.slug)
  } else if (input.departureCityCode?.trim()) {
    parts.push(normalizeRouteSlug(input.departureCityCode, 12))
  }

  if (input.makkahHotelName?.trim()) {
    const hotelToken = normalizeRouteSlug(input.makkahHotelName, 38)
    if (hotelToken) {
      parts.push(hotelToken)
    }
  }

  if (input.postCode?.trim()) {
    const codeToken = normalizeRouteSlug(input.postCode, 28)
    if (codeToken) {
      parts.push(codeToken)
    }
  }

  return normalizeRouteSlug(parts.join("-"), 120) || "umrah-package"
}
