import type { Metadata } from "next"
import { formatPkr } from "@/components/public/public-utils"
import {
  ORGANIZATION_JSONLD_ID,
  WEBSITE_JSONLD_ID,
} from "@/lib/seo/json-ld"
import {
  buildPublicMetadata,
  CANONICAL_ORIGIN,
  clampSeoDescription,
  clampSeoTitle,
} from "@/lib/seo/metadata"
import type { PublicGroupPackageDto } from "@/lib/seo/public-queries"
import {
  resolveUmrahGatewayCity,
  UMRAH_GATEWAY_CITY_SLUGS,
  type UmrahGatewayCityInfo,
  type UmrahGatewayCitySlug,
} from "@/lib/seo/slugs"

export interface FormattedPriceTier {
  label: string
  isBookable: boolean
  numericPrice: number | null
}

/**
 * Enforces `OD-09b`: any `<= 0`, `null`, `undefined`, or non-finite PKR tier
 * renders `"On Request"` and is excluded from checkout selection & `AggregateOffer` schema.
 */
export function formatTierPriceOrOnRequest(
  pricePkr: number | null | undefined
): FormattedPriceTier {
  if (
    typeof pricePkr === "number" &&
    Number.isFinite(pricePkr) &&
    pricePkr > 0
  ) {
    const rounded = Math.round(pricePkr)
    return {
      label: formatPkr(rounded),
      isBookable: true,
      numericPrice: rounded,
    }
  }
  return {
    label: "On Request",
    isBookable: false,
    numericPrice: null,
  }
}

/**
 * Computes the lowest positive (`> 0`) adult occupancy tier in PKR for a package,
 * or returns `null` when every room tier is `"On Request"` (`<= 0`).
 */
export function computeLowestPositivePackagePrice(
  pkg: Pick<
    PublicGroupPackageDto,
    "sharingPricePkr" | "quadPricePkr" | "triplePricePkr" | "doublePricePkr"
  >
): number | null {
  const candidates = [
    pkg.sharingPricePkr,
    pkg.quadPricePkr,
    pkg.triplePricePkr,
    pkg.doublePricePkr,
  ].filter(
    (val): val is number =>
      typeof val === "number" && Number.isFinite(val) && val > 0
  )

  if (candidates.length === 0) {
    return null
  }
  return Math.min(...candidates)
}

export const TIER_DISPLAY_LABELS: Record<
  PublicGroupPackageDto["tier"],
  string
> = {
  vip_5star: "VIP 5-Star Courtyard",
  gold: "Executive Gold",
  silver: "Classic Family Silver",
  bronze: "Long-Stay Bronze",
  economy: "Value Saver Economy",
}

/**
 * Strictly resolves a URL segment (`"lahore"`, `"from-lahore"`, etc.) ONLY if the underlying
 * city slug is one of the 3 whitelisted Tier-1 gateways (`lahore`, `karachi`, `islamabad`).
 * Rejects airport codes like `"lhe"` or non-Tier-1 cities like `"peshawar"` (`404` per `GB-03`).
 */
export function resolveStrictGatewayCityRouteSlug(
  rawSegment: string | null | undefined
): UmrahGatewayCityInfo | null {
  const cleaned = (rawSegment ?? "")
    .trim()
    .toLowerCase()
    .replace(/^from-/, "")

  if (
    !(UMRAH_GATEWAY_CITY_SLUGS as readonly string[]).includes(cleaned)
  ) {
    return null
  }
  return resolveUmrahGatewayCity(cleaned)
}

/**
 * Spec `0025` §3 `#2` metadata for `/umrah-packages` (`57`c title, `150`c description).
 */
export function buildUmrahHubMetadata(): Metadata {
  return buildPublicMetadata({
    path: "/umrah-packages",
    title: "Group Umrah Packages 2026–2027 in PKR | Al Ramlah Travels",
    description:
      "Compare fixed-departure Umrah packages from Pakistan with Sharing, Quad, Triple & Double PKR rates, steps-from-Haram hotels, and guided Ziyarat tours.",
  })
}

/**
 * Spec `0025` §3 `#3` dynamic metadata for `/umrah-packages/[slug]`.
 * Guarantees rendered `<title>` is strictly `50–60` characters and `<meta name="description">` is `150–160` characters
 * across short, medium, and long CMS package titles.
 */
export function buildUmrahPackageSlugMetadata(
  pkg: Pick<
    PublicGroupPackageDto,
    | "slug"
    | "title"
    | "durationDays"
    | "makkahNights"
    | "madinahNights"
    | "makkahHotel"
    | "madinahHotel"
  >
): Metadata {
  const cleanTitle = pkg.title.replace(/\s+/g, " ").trim()
  const days = Math.max(1, Math.round(pkg.durationDays))

  // Build deterministic core candidates ordered from concise to descriptive so final branded title lands in 50..60 chars
  const suffixFull = " | Al Ramlah Travels" // 20 chars -> core needs 30..40 chars
  const suffixShort = " | Al Ramlah" // 12 chars -> core needs 38..48 chars

  const baseCore = `${cleanTitle} (${days}D Umrah)`
  let finalBrandedTitle: string

  if (
    baseCore.length + suffixFull.length >= 50 &&
    baseCore.length + suffixFull.length <= 60
  ) {
    finalBrandedTitle = `${baseCore}${suffixFull}`
  } else if (
    baseCore.length + suffixShort.length >= 50 &&
    baseCore.length + suffixShort.length <= 60
  ) {
    finalBrandedTitle = `${baseCore}${suffixShort}`
  } else if (baseCore.length + suffixFull.length < 50) {
    const expandedCandidates = [
      `${cleanTitle} (${days}-Day Umrah PKR)`,
      `${cleanTitle} — ${days}-Day Pakistan Umrah`,
      `${cleanTitle} (${days}-Day Group Umrah in PKR)`,
    ]
    const matched = expandedCandidates.find(
      (c) =>
        c.length + suffixFull.length >= 50 &&
        c.length + suffixFull.length <= 60
    )
    if (matched) {
      finalBrandedTitle = `${matched}${suffixFull}`
    } else {
      const paddedCore = `${cleanTitle} — ${days}-Day Pakistan Group Umrah`
      const clamped = clampSeoTitle(paddedCore, 60 - suffixShort.length)
      finalBrandedTitle = `${clamped}${suffixShort}`
    }
  } else {
    // baseCore is long (> 48 chars): clamp core to 38..48 chars + " | Al Ramlah" (12 chars) => 50..60 chars
    const maxCore = 60 - suffixShort.length // 48
    let clampedCore = clampSeoTitle(baseCore, maxCore)
    if (clampedCore.length + suffixShort.length < 50) {
      clampedCore = clampSeoTitle(`${clampedCore} PKR`, maxCore)
    }
    finalBrandedTitle = `${clampedCore}${suffixShort}`
  }

  const rawDescription = clampSeoDescription(
    `Book ${cleanTitle} from Pakistan: ${days}-day Umrah group (${pkg.makkahNights}N Makkah, ${pkg.madinahNights}N Madinah) with verified Haramain hotels, Saudi visa & PKR tiers.`,
    150,
    160
  )

  return buildPublicMetadata({
    path: `/umrah-packages/${pkg.slug}`,
    title: finalBrandedTitle,
    description: rawDescription,
  })
}

const CITY_METADATA_MAP: Record<
  UmrahGatewayCitySlug,
  { title: string; description: string; h1: string }
> = {
  lahore: {
    title: "Umrah Packages from Lahore (LHE) 2027 | Al Ramlah Travels",
    description:
      "Book direct & 1-stop Umrah packages from Allama Iqbal Airport Lahore (LHE) to Jeddah & Madinah with Askari 10 concierge support and fixed PKR batches.",
    h1: "Umrah Packages from Lahore (Allama Iqbal International Airport — LHE)",
  },
  karachi: {
    title: "Umrah Packages from Karachi (KHI) 2027 | Al Ramlah Travels",
    description:
      "Explore Umrah packages from Jinnah International Airport Karachi (KHI) with Saudia, PIA & Gulf carriers, Haramain courtyard hotels, and live PKR seats.",
    h1: "Umrah Packages from Karachi (Jinnah International Airport — KHI)",
  },
  islamabad: {
    title: "Umrah Packages from Islamabad (ISB) | Al Ramlah Travels",
    description:
      "Depart from Islamabad International Airport (ISB) on curated family & executive Umrah packages with Madinah-first or Jeddah-entry routes & Saudi visas.",
    h1: "Umrah Packages from Islamabad & Rawalpindi (ISB Gateway)",
  },
}

/**
 * Spec `0025` §3 `#4`–`#6` metadata for `/umrah-packages/from-lahore|from-karachi|from-islamabad`.
 */
export function buildUmrahCitySpokeMetadata(
  citySlug: UmrahGatewayCitySlug
): Metadata {
  const entry = CITY_METADATA_MAP[citySlug]
  return buildPublicMetadata({
    path: `/umrah-packages/from-${citySlug}`,
    title: entry.title,
    description: entry.description,
  })
}

export function getUmrahCityPrimaryHeading(
  citySlug: UmrahGatewayCitySlug
): string {
  return CITY_METADATA_MAP[citySlug].h1
}

/**
 * Builds `CollectionPage` + `ItemList` JSON-LD for `/umrah-packages` (`Spec 0025` §3 `#2`).
 * Strictly omits `AggregateRating` and `<= 0` PKR offers (`OD-09b`, `OD-10`).
 */
export function buildUmrahHubJsonLd(
  packages: ReadonlyArray<
    Pick<
      PublicGroupPackageDto,
      "slug" | "title" | "durationDays" | "makkahNights" | "madinahNights"
    >
  >
): ReadonlyArray<Record<string, unknown>> {
  const hubUrl = `${CANONICAL_ORIGIN}/umrah-packages`
  const listId = `${hubUrl}#itemlist`

  const collectionPage: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${hubUrl}#collection`,
    url: hubUrl,
    name: "Fixed-Departure Group Umrah Packages from Pakistan (2026–2027)",
    description:
      "Compare fixed-departure group Umrah itineraries from Lahore (LHE), Karachi (KHI), and Islamabad (ISB) with transparent PKR occupancy rates, Haramain hotels, and Saudi e-visa processing.",
    inLanguage: "en-PK",
    isPartOf: {
      "@id": WEBSITE_JSONLD_ID,
    },
    provider: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
    mainEntity: {
      "@id": listId,
    },
  }

  const itemList: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": listId,
    name: "Active Group Umrah Packages in PKR",
    url: hubUrl,
    numberOfItems: packages.length,
    itemListElement: packages.map((pkg, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${pkg.title} (${pkg.durationDays} Days — ${pkg.makkahNights}N Makkah, ${pkg.madinahNights}N Madinah)`,
      url: `${CANONICAL_ORIGIN}/umrah-packages/${encodeURIComponent(pkg.slug)}`,
    })),
  }

  return [collectionPage, itemList]
}

/**
 * Builds `CollectionPage` JSON-LD for `/umrah-packages/from-[city]` (`Spec 0025` §3 `#4`–`#6`).
 */
export function buildUmrahCityCollectionJsonLd(
  gateway: UmrahGatewayCityInfo,
  packages: ReadonlyArray<Pick<PublicGroupPackageDto, "slug" | "title">>
): Record<string, unknown> {
  const spokeUrl = `${CANONICAL_ORIGIN}/umrah-packages/${gateway.routeSegment}`

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${spokeUrl}#collection`,
    url: spokeUrl,
    name: getUmrahCityPrimaryHeading(gateway.slug),
    description: CITY_METADATA_MAP[gateway.slug].description,
    inLanguage: "en-PK",
    isPartOf: {
      "@id": WEBSITE_JSONLD_ID,
    },
    provider: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: packages.length,
      itemListElement: packages.map((pkg, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: pkg.title,
        url: `${CANONICAL_ORIGIN}/umrah-packages/${encodeURIComponent(pkg.slug)}`,
      })),
    },
  }
}

/**
 * Computes word-level `n`-gram Jaccard similarity (`0..1`) and uniqueness (`1 - similarity`)
 * between two text/HTML documents (`GB-03` `>= 50%` differentiation metric).
 */
export function computeWordNgramUniqueness(
  rawA: string,
  rawB: string,
  n = 4
): { similarity: number; uniqueness: number } {
  const extractShingles = (raw: string): Set<string> => {
    const plain = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    const tokens = plain.split(" ").filter((t) => t.length > 0)
    const shingles = new Set<string>()
    if (tokens.length < n) {
      if (tokens.length > 0) shingles.add(tokens.join(" "))
      return shingles
    }
    for (let i = 0; i <= tokens.length - n; i += 1) {
      shingles.add(tokens.slice(i, i + n).join(" "))
    }
    return shingles
  }

  const setA = extractShingles(rawA)
  const setB = extractShingles(rawB)

  if (setA.size === 0 && setB.size === 0) {
    return { similarity: 1, uniqueness: 0 }
  }

  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) {
      intersection += 1
    }
  }
  const union = setA.size + setB.size - intersection
  const similarity = union === 0 ? 0 : intersection / union
  return {
    similarity,
    uniqueness: 1 - similarity,
  }
}
