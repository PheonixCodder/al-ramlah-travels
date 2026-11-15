import * as React from "react"
import {
  DEFAULT_COMPANY_INFO,
  normalizeWhatsappNumber,
  type CompanyInfo,
} from "@/lib/company-info"
import { CANONICAL_ORIGIN } from "@/lib/seo/metadata"

export const ORGANIZATION_JSONLD_ID = `${CANONICAL_ORIGIN}/#organization`
export const WEBSITE_JSONLD_ID = `${CANONICAL_ORIGIN}/#website`

function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) {
    return undefined
  }
  if (value === null || typeof value !== "object") {
    return value
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined)
  }
  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === "aggregateRating" || key === "review") {
      // OD-10 hard rich-result safety guard: never emit unverified AggregateRating/Review markup
      continue
    }
    const cleaned = stripUndefinedDeep(entry)
    if (cleaned !== undefined) {
      output[key] = cleaned
    }
  }
  return output
}

/**
 * XSS-safe Schema.org JSON-LD serializer (`SEO-009`, `S09-001`).
 * Escapes `<` as `\u003c` and line separators so CMS text can never break out of `<script type="application/ld+json">`.
 */
export function serializeJsonLd(data: unknown): string {
  const cleaned = stripUndefinedDeep(data)
  return JSON.stringify(cleaned)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

export interface JsonLdProps {
  data:
    | Record<string, unknown>
    | ReadonlyArray<Record<string, unknown>>
    | null
    | undefined
}

/**
 * Server-rendered `<script type="application/ld+json">` component.
 */
export function JsonLd({ data }: JsonLdProps): React.ReactElement | null {
  if (!data) {
    return null
  }
  if (Array.isArray(data) && data.length === 0) {
    return null
  }
  return React.createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: {
      __html: serializeJsonLd(data),
    },
  })
}

function toE164Phone(phone: string | null | undefined): string {
  const digits = normalizeWhatsappNumber(phone ?? "")
  return digits ? `+${digits}` : "+923274029701"
}

function isHttpsUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== "string") return false
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === "https:"
  } catch {
    return false
  }
}

function getTodayPktIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/**
 * Canonical `TravelAgency` entity graph (`OD-10`, `S09-002`).
 * Strictly gates regulatory license identifiers on non-null DB fields and bans `AggregateRating`.
 */
export function buildTravelAgencyJsonLd(
  companyInfo?: Partial<CompanyInfo> | null
): Record<string, unknown> {
  const info = {
    ...DEFAULT_COMPANY_INFO,
    ...(companyInfo ?? {}),
  }

  const primaryE164 = toE164Phone(info.primaryWhatsapp)
  const secondaryE164 = info.secondaryPhone
    ? toE164Phone(info.secondaryPhone)
    : null

  const sameAs = [
    info.facebookUrl,
    info.instagramUrl,
    info.youtubeUrl,
    info.tiktokUrl,
  ].filter(isHttpsUrl)

  const identifiers: Array<Record<string, string>> = []
  const pushIdentifier = (name: string, val: string | null | undefined) => {
    const trimmed = typeof val === "string" ? val.trim() : ""
    if (trimmed.length > 0) {
      identifiers.push({
        "@type": "PropertyValue",
        name,
        value: trimmed,
      })
    }
  }

  pushIdentifier("DTS License", info.dtsLicense)
  pushIdentifier("MORA Hajj & Umrah Organizer License", info.moraLicense)
  pushIdentifier("IATA Accreditation Code", info.iataCode)
  pushIdentifier("FBR NTN", info.ntnNumber ?? info.ntn)

  const streetAddress = (info.officeAddress || DEFAULT_COMPANY_INFO.officeAddress)
    .replace(/,\s*Pakistan$/i, "")
    .trim()

  return stripUndefinedDeep({
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": ORGANIZATION_JSONLD_ID,
    name: info.agencyName || DEFAULT_COMPANY_INFO.agencyName,
    legalName:
      info.legalEntityName ||
      info.agencyName ||
      DEFAULT_COMPANY_INFO.legalEntityName,
    slogan: info.tagline || DEFAULT_COMPANY_INFO.tagline,
    url: CANONICAL_ORIGIN,
    logo: {
      "@type": "ImageObject",
      url: `${CANONICAL_ORIGIN}/logo.jpg`,
    },
    image: `${CANONICAL_ORIGIN}/logo.jpg`,
    telephone: primaryE164,
    email: info.supportEmail || DEFAULT_COMPANY_INFO.supportEmail,
    priceRange: "PKR",
    currenciesAccepted: "PKR",
    areaServed: [
      { "@type": "Country", name: "Pakistan" },
      { "@type": "Country", name: "United Kingdom" },
      { "@type": "Country", name: "United States" },
      { "@type": "Country", name: "Canada" },
      { "@type": "Country", name: "United Arab Emirates" },
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress,
      addressLocality: "Lahore",
      addressRegion: "Punjab",
      postalCode: "54810",
      addressCountry: "PK",
    },
    hasMap: info.mapsEmbedUrl || DEFAULT_COMPANY_INFO.mapsEmbedUrl,
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        opens: "09:00",
        closes: "20:00",
      },
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: primaryE164,
        contactType: "customer service",
        areaServed: ["PK", "GB", "US", "CA", "AE"],
        availableLanguage: ["English", "Urdu"],
      },
      ...(secondaryE164 && secondaryE164 !== primaryE164
        ? [
            {
              "@type": "ContactPoint",
              telephone: secondaryE164,
              contactType: "reservations",
              areaServed: ["PK", "GB", "US", "CA", "AE"],
              availableLanguage: ["English", "Urdu"],
            },
          ]
        : []),
    ],
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(identifiers.length > 0 ? { identifier: identifiers } : {}),
  }) as Record<string, unknown>
}

/**
 * Root `WebSite` entity graph (`S09-002`).
 * Omits `SearchAction` unless a dedicated indexable query search route exists.
 */
export function buildWebSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_JSONLD_ID,
    url: CANONICAL_ORIGIN,
    name: DEFAULT_COMPANY_INFO.agencyName,
    inLanguage: "en-PK",
    publisher: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
  }
}

export interface BreadcrumbJsonLdInput {
  label?: string
  name?: string
  href?: string
  path?: string
}

/**
 * Builds a `BreadcrumbList` Schema.org graph with absolute canonical item URLs (`S09-005`).
 */
export function buildBreadcrumbJsonLd(
  items: ReadonlyArray<BreadcrumbJsonLdInput>
): Record<string, unknown> {
  const normalized = items
    .map((entry) => {
      const name = (entry.label ?? entry.name ?? "").trim()
      const rawPath = (entry.href ?? entry.path ?? "/").trim()
      if (!name) return null
      const absoluteItem = rawPath.startsWith("http")
        ? rawPath
        : rawPath === "/" || rawPath === ""
          ? CANONICAL_ORIGIN
          : `${CANONICAL_ORIGIN}${rawPath.startsWith("/") ? rawPath : `/${rawPath}`}`
      return { name, item: absoluteItem }
    })
    .filter((entry): entry is { name: string; item: string } => entry !== null)

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: normalized.map((entry, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: entry.name,
      item: entry.item,
    })),
  }
}

export interface FaqJsonLdItem {
  question: string
  answer: string
}

/**
 * Builds a `FAQPage` Schema.org graph strictly from visibly rendered Q&As (`S09-004`).
 * Returns `null` when no valid Q&A pairs are provided.
 */
export function buildFaqPageJsonLd(
  faqs: ReadonlyArray<FaqJsonLdItem>
): Record<string, unknown> | null {
  const validFaqs = faqs
    .map((item) => ({
      question: (item.question || "").trim(),
      answer: (item.answer || "").trim(),
    }))
    .filter((item) => item.question.length > 0 && item.answer.length > 0)

  if (validFaqs.length === 0) {
    return null
  }

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: validFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }
}

export interface UmrahDepartureJsonLdInput {
  departureDate: string
  returnDate?: string | null
  totalSeats: number
  bookedSeats: number
  status: string
  sharingPriceOverridePkr?: number | null
  quadPriceOverridePkr?: number | null
  triplePriceOverridePkr?: number | null
  doublePriceOverridePkr?: number | null
}

export interface UmrahPackageJsonLdInput {
  slug: string
  title: string
  description?: string | null
  durationDays: number
  makkahNights: number
  madinahNights: number
  makkahHotelName?: string | null
  madinahHotelName?: string | null
  bannerUrl?: string | null
  sharingPricePkr?: number | null
  quadPricePkr?: number | null
  triplePricePkr?: number | null
  doublePricePkr?: number | null
  isActive?: boolean
  departures?: ReadonlyArray<UmrahDepartureJsonLdInput>
}

/**
 * Builds truthful `TouristTrip` + `AggregateOffer` JSON-LD for `/umrah-packages/[slug]` (`OD-09`, `OD-10`, `S09-003`).
 * Filters `price > 0`, derives `InStock`/`SoldOut` from future PKT departures, and omits `offers` if no positive PKR prices exist.
 */
export function buildUmrahPackageJsonLd(
  pkg: UmrahPackageJsonLdInput,
  departuresOverride?: ReadonlyArray<UmrahDepartureJsonLdInput>
): Record<string, unknown> {
  const canonicalUrl = `${CANONICAL_ORIGIN}/umrah-packages/${encodeURIComponent(pkg.slug)}`
  const departures = departuresOverride ?? pkg.departures ?? []
  const todayPkt = getTodayPktIsoDate()

  const futureDepartures = departures.filter(
    (dep) =>
      dep.departureDate >= todayPkt &&
      dep.status !== "closed" &&
      dep.status !== "cancelled"
  )

  const hasOpenFutureSeat = futureDepartures.some(
    (dep) =>
      (dep.status === "open" || dep.status === "filling_fast") &&
      dep.totalSeats - dep.bookedSeats > 0
  )

  const tierEntries: Array<{ name: string; price: number }> = [
    { name: "Sharing Occupancy", price: Number(pkg.sharingPricePkr ?? 0) },
    { name: "Quad Room Occupancy", price: Number(pkg.quadPricePkr ?? 0) },
    { name: "Triple Room Occupancy", price: Number(pkg.triplePricePkr ?? 0) },
    { name: "Double Room Occupancy", price: Number(pkg.doublePricePkr ?? 0) },
  ].filter((tier) => Number.isFinite(tier.price) && tier.price > 0)

  const isActive = pkg.isActive !== false
  const availabilityUrl = hasOpenFutureSeat
    ? "https://schema.org/InStock"
    : "https://schema.org/SoldOut"

  const earliestUpcomingDate = futureDepartures
    .map((d) => d.departureDate)
    .sort()[0]

  const offersBlock =
    isActive && tierEntries.length > 0
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "PKR",
          lowPrice: Math.min(...tierEntries.map((t) => t.price)),
          highPrice: Math.max(...tierEntries.map((t) => t.price)),
          offerCount: tierEntries.length,
          availability: availabilityUrl,
          url: canonicalUrl,
          offers: tierEntries.map((tier) => ({
            "@type": "Offer",
            name: tier.name,
            price: tier.price,
            priceCurrency: "PKR",
            availability: availabilityUrl,
            url: canonicalUrl,
            ...(earliestUpcomingDate ? { validThrough: earliestUpcomingDate } : {}),
          })),
        }
      : undefined

  const descriptionText =
    pkg.description?.trim() ||
    `${pkg.durationDays}-day guided Umrah group package (${pkg.makkahNights} nights Makkah, ${pkg.madinahNights} nights Madinah) curated by Al Ramlah Travels Lahore.`

  return stripUndefinedDeep({
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    "@id": `${canonicalUrl}#trip`,
    name: pkg.title,
    description: descriptionText,
    url: canonicalUrl,
    touristType: "Umrah Pilgrims",
    ...(isHttpsUrl(pkg.bannerUrl) ? { image: pkg.bannerUrl } : {}),
    provider: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
    itinerary: {
      "@type": "ItemList",
      numberOfItems: 2,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          item: {
            "@type": "TouristDestination",
            name: pkg.makkahHotelName
              ? `Makkah Stay (${pkg.makkahNights} Nights — ${pkg.makkahHotelName})`
              : `Makkah Stay (${pkg.makkahNights} Nights)`,
          },
        },
        {
          "@type": "ListItem",
          position: 2,
          item: {
            "@type": "TouristDestination",
            name: pkg.madinahHotelName
              ? `Madinah Stay (${pkg.madinahNights} Nights — ${pkg.madinahHotelName})`
              : `Madinah Stay (${pkg.madinahNights} Nights)`,
          },
        },
      ],
    },
    offers: offersBlock,
  }) as Record<string, unknown>
}

export const buildTouristTripJsonLd = buildUmrahPackageJsonLd

export interface HajjServiceJsonLdInput {
  slug: string
  title: string
  maktabTier: string
  durationDays: number
  regulatoryDisclaimer?: string | null
}

/**
 * Builds truthful `Service` JSON-LD for `/hajj-2027` pre-registration (`OD-09e`).
 * Strictly omits binding `Offer.price` and `InStock` availability on indicative pre-registration tiers.
 */
export function buildHajjServiceJsonLd(
  packages?: ReadonlyArray<HajjServiceJsonLdInput>
): Record<string, unknown> {
  const canonicalUrl = `${CANONICAL_ORIGIN}/hajj-2027`
  const activeTiers = packages ?? []

  return stripUndefinedDeep({
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${canonicalUrl}#service`,
    name: "Hajj 2027 Pre-Registration & Maktab Advisory",
    serviceType: "Hajj Pilgrimage Pre-Registration & Consultation",
    url: canonicalUrl,
    description:
      "Indicative Hajj 2027 Maktab A+, A, B & C pre-registration and scholar-guided consultation for Pakistani and overseas diaspora pilgrims, subject to Saudi Ministry of Hajj & Umrah and Pakistan MORA quota announcements.",
    provider: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
    areaServed: [
      { "@type": "Country", name: "Pakistan" },
      { "@type": "Country", name: "United Kingdom" },
      { "@type": "Country", name: "United States" },
      { "@type": "Country", name: "Canada" },
      { "@type": "Country", name: "United Arab Emirates" },
    ],
    ...(activeTiers.length > 0
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Hajj 2027 Indicative Maktab Tiers (Pre-Registration Only)",
            itemListElement: activeTiers.map((tier, idx) => ({
              "@type": "ListItem",
              position: idx + 1,
              name: `${tier.title} (Maktab ${tier.maktabTier}, ${tier.durationDays} Days — Indicative Pre-Registration)`,
            })),
          },
        }
      : {}),
  }) as Record<string, unknown>
}

export interface VisaRateJsonLdInput {
  tier: string
  label: string
  fixedAdultPkr: number
  minDays: number
  maxDays: number
}

/**
 * Builds `Service` JSON-LD for `/umrah-visa` (`OD-09b`).
 * Only emits fixed `Offer` items when `fixedAdultPkr > 0` for standalone Visa-Only processing.
 */
export function buildVisaServiceJsonLd(
  rates?: ReadonlyArray<VisaRateJsonLdInput>
): Record<string, unknown> {
  const canonicalUrl = `${CANONICAL_ORIGIN}/umrah-visa`
  const validRates = (rates ?? []).filter(
    (rate) => Number.isFinite(rate.fixedAdultPkr) && rate.fixedAdultPkr > 0
  )

  return stripUndefinedDeep({
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${canonicalUrl}#service`,
    name: "Saudi Arabia Umrah E-Visa Processing from Pakistan",
    serviceType: "Umrah E-Visa & Mandatory Medical Insurance Processing",
    url: canonicalUrl,
    description:
      "Official Saudi Arabia short-term (up to 30 days) and long-term (31 to 90 days) Umrah e-visa processing in PKR with mandatory Saudi health insurance and Saudi Visa Bio app guidance.",
    provider: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
    areaServed: {
      "@type": "Country",
      name: "Pakistan",
    },
    ...(validRates.length > 0
      ? {
          offers: validRates.map((rate) => ({
            "@type": "Offer",
            name: `${rate.label} (${rate.minDays}–${rate.maxDays} Days KSA Stay — Adult Visa-Only)`,
            price: rate.fixedAdultPkr,
            priceCurrency: "PKR",
            url: canonicalUrl,
          })),
        }
      : {}),
  }) as Record<string, unknown>
}

export interface HotelJsonLdInput {
  name: string
  starRating: number
  distanceLabel: string
  accessType?: string | null
  imageUrl?: string | null
  amenities?: ReadonlyArray<string> | null
}

/**
 * Builds `ItemList` of `LodgingBusiness` entities for `/hotels/makkah` & `/hotels/madinah` (`OD-09c`, `OD-10`).
 * Strictly omits volatile `Offer.price`, wholesale SAR rates, and unverified `AggregateRating`.
 */
export function buildHotelItemListJsonLd(
  city: "makkah" | "madinah",
  hotels: ReadonlyArray<HotelJsonLdInput>
): Record<string, unknown> {
  const cityLabel = city === "makkah" ? "Makkah" : "Madinah"
  const canonicalUrl = `${CANONICAL_ORIGIN}/hotels/${city}`

  return stripUndefinedDeep({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${cityLabel} Haramain Hotels Curated by Al Ramlah Travels`,
    url: canonicalUrl,
    numberOfItems: hotels.length,
    itemListElement: hotels.map((hotel, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "LodgingBusiness",
        name: hotel.name,
        description: `${hotel.starRating}-star ${cityLabel} pilgrimage accommodation (${hotel.distanceLabel}).`,
        ...(isHttpsUrl(hotel.imageUrl) ? { image: hotel.imageUrl } : {}),
        starRating: {
          "@type": "Rating",
          ratingValue: hotel.starRating,
          bestRating: 5,
        },
        address: {
          "@type": "PostalAddress",
          addressLocality: cityLabel,
          addressCountry: "SA",
        },
        ...(hotel.amenities && hotel.amenities.length > 0
          ? {
              amenityFeature: hotel.amenities.map((amenity) => ({
                "@type": "LocationFeatureSpecification",
                name: amenity,
                value: true,
              })),
            }
          : {}),
      },
    })),
  }) as Record<string, unknown>
}

export interface TouristAttractionJsonLdInput {
  name: string
  arabicName?: string | null
  description?: string | null
  city: "makkah" | "madinah"
  imageUrl?: string | null
}

/**
 * Builds `ItemList` of `TouristAttraction` sacred Ziyarat sites (`OD-09`, `OD-10`).
 * Strictly omits fabricated `Offer.price` and `AggregateRating`.
 */
export function buildTouristAttractionListJsonLd(
  city: "makkah" | "madinah" | "all",
  places: ReadonlyArray<TouristAttractionJsonLdInput>
): Record<string, unknown> {
  const canonicalUrl =
    city === "all"
      ? `${CANONICAL_ORIGIN}/ziyarat`
      : `${CANONICAL_ORIGIN}/ziyarat/${city}`
  const listTitle =
    city === "all"
      ? "Sacred Ziyarat Landmarks of Makkah & Madinah"
      : `Sacred ${city === "makkah" ? "Makkah" : "Madinah"} Ziyarat Landmarks`

  return stripUndefinedDeep({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listTitle,
    url: canonicalUrl,
    numberOfItems: places.length,
    itemListElement: places.map((place, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "TouristAttraction",
        name: place.name,
        ...(place.arabicName?.trim()
          ? { alternateName: place.arabicName.trim() }
          : {}),
        ...(place.description?.trim()
          ? { description: place.description.trim() }
          : {}),
        ...(isHttpsUrl(place.imageUrl) ? { image: place.imageUrl } : {}),
        address: {
          "@type": "PostalAddress",
          addressLocality: place.city === "makkah" ? "Makkah" : "Madinah",
          addressCountry: "SA",
        },
      },
    })),
  }) as Record<string, unknown>
}

export const buildZiyaratItemListJsonLd = buildTouristAttractionListJsonLd
