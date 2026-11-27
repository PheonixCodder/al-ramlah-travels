import { cache } from "react"
import { and, asc, desc, eq, gte, ne } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { getCachedCompanyInfo } from "@/lib/seo/company-info-loader"
import { resolveUmrahGatewayCity } from "@/lib/seo/slugs"

export { getCachedCompanyInfo }

export function getTodayPktIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export interface PublicHotelDto {
  id: string
  name: string
  city: "makkah" | "madinah"
  starRating: number
  distanceMeters: number
  distanceLabel: string
  accessType: "walking" | "shuttle"
  imageUrl: string | null
  galleryUrls: string[]
  amenities: string[]
  allowsSharedRooms: boolean
  allowsPrivateRooms: boolean
  availableRoomTypes: Array<"double" | "triple" | "quad">
  offersDining: boolean
  availableMealPlans: Array<
    "room_only" | "breakfast" | "half_board" | "full_board"
  >
  mealsAvailable: boolean
  validFrom: string | null
  validUntil: string | null
  locationNotes: string | null
  isFeatured: boolean
  sortOrder: number
  updatedAt: Date
}

function toPublicHotelDto(
  row: typeof schema.hotels.$inferSelect
): PublicHotelDto {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    starRating: row.starRating,
    distanceMeters: row.distanceMeters,
    distanceLabel: row.distanceLabel,
    accessType: row.accessType,
    imageUrl: row.imageUrl,
    galleryUrls: Array.isArray(row.galleryUrls) ? row.galleryUrls : [],
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    allowsSharedRooms: row.allowsSharedRooms,
    allowsPrivateRooms: row.allowsPrivateRooms,
    availableRoomTypes: Array.isArray(row.availableRoomTypes)
      ? row.availableRoomTypes
      : ["double", "triple", "quad"],
    offersDining: row.offersDining,
    availableMealPlans: Array.isArray(row.availableMealPlans)
      ? row.availableMealPlans
      : ["room_only", "breakfast", "half_board", "full_board"],
    mealsAvailable: row.offersDining,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    locationNotes: row.locationNotes,
    isFeatured: row.isFeatured,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
  }
}

export interface PublicAirlineDto {
  id: string
  name: string
  iataCode: string
  logoUrl: string | null
  isDirectAvailable: boolean
  isConnectingAvailable: boolean
}

export interface PublicDepartureCityDto {
  id: string
  cityName: string
  name: string
  airportCode: string
  airportName: string
}

export interface PublicGroupDepartureDto {
  id: string
  packageId: string
  batchCode: string
  departureCityId: string
  departureCity: PublicDepartureCityDto | null
  departureDate: string
  returnDate: string
  totalSeats: number
  bookedSeats: number
  seatsRemaining: number
  status: "open" | "filling_fast" | "sold_out" | "closed"
  quadPriceOverridePkr: number | null
  triplePriceOverridePkr: number | null
  doublePriceOverridePkr: number | null
  sharingPriceOverridePkr: number | null
  outboundFlightNumber: string | null
  returnFlightNumber: string | null
  flightScheduleSummary: string | null
  routingNote: string | null
  baggageAllowance: string | null
  updatedAt: Date
}

export interface PublicPackageVisualInput {
  coverImageUrl?: string | null
  bannerUrl?: string | null
  makkahHotel?: {
    imageUrl?: string | null
    galleryUrls?: ReadonlyArray<string | null | undefined> | null
  } | null
  madinahHotel?: {
    imageUrl?: string | null
    galleryUrls?: ReadonlyArray<string | null | undefined> | null
  } | null
}

export interface ResolvedPublicPackageVisuals {
  primaryImageUrl: string | null
  secondaryHotelImageUrl: string | null
}

function cleanPublicVisualUrl(
  raw: string | null | undefined
): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const cleanPath = trimmed.split("?")[0]?.split("#")[0]?.toLowerCase() ?? ""
  if (cleanPath.endsWith(".pdf")) return null
  return trimmed
}

function cleanLegacyCoverBannerUrl(
  raw: string | null | undefined
): string | null {
  const cleaned = cleanPublicVisualUrl(raw)
  if (!cleaned) return null
  const lower = cleaned.toLowerCase()
  if (
    lower.includes("/flyers/") ||
    lower.includes("/posters/spotlights/") ||
    lower.includes("/posters/multi-sheets/") ||
    lower.includes("/posters/wrapped") ||
    lower.includes("alramlah-wrapped-")
  ) {
    return null
  }
  return cleaned
}

/**
 * Resolves public website imagery for a group package (`AC-1`):
 * - `primaryImageUrl`: explicit `coverImageUrl` -> linked Makkah hotel image/gallery -> linked Madinah hotel image/gallery -> non-poster legacy `bannerUrl` -> `null`.
 * - `secondaryHotelImageUrl`: linked Madinah hotel image/gallery distinct from `primaryImageUrl` when possible.
 * Never consumes `internalPosterUrl`.
 */
export function resolvePublicPackageVisuals(
  input: PublicPackageVisualInput
): ResolvedPublicPackageVisuals {
  const explicitCover = cleanPublicVisualUrl(input.coverImageUrl)
  const makkahPrimary = cleanPublicVisualUrl(input.makkahHotel?.imageUrl)
  const madinahPrimary = cleanPublicVisualUrl(input.madinahHotel?.imageUrl)
  const makkahGalleryFirst =
    (input.makkahHotel?.galleryUrls ?? [])
      .map(cleanPublicVisualUrl)
      .find((url): url is string => Boolean(url)) ?? null
  const madinahGalleryFirst =
    (input.madinahHotel?.galleryUrls ?? [])
      .map(cleanPublicVisualUrl)
      .find((url): url is string => Boolean(url)) ?? null
  const legacyBanner = cleanLegacyCoverBannerUrl(input.bannerUrl)

  const primaryImageUrl =
    explicitCover ??
    makkahPrimary ??
    madinahPrimary ??
    makkahGalleryFirst ??
    madinahGalleryFirst ??
    legacyBanner ??
    null

  const madinahCandidates = [
    madinahPrimary,
    ...(input.madinahHotel?.galleryUrls ?? []).map(cleanPublicVisualUrl),
  ].filter((url): url is string => Boolean(url))

  const secondaryHotelImageUrl =
    madinahCandidates.find((url) => url !== primaryImageUrl) ?? null

  return {
    primaryImageUrl,
    secondaryHotelImageUrl,
  }
}

export interface PublicGroupPackageDto {
  id: string
  slug: string
  title: string
  tier: "vip_5star" | "gold" | "silver" | "bronze" | "economy"
  durationDays: number
  makkahNights: number
  madinahNights: number
  includesVisa: boolean
  includesTransport: boolean
  includesZiyarat: boolean
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
  sharingPricePkr: number
  infantPricePkr: number
  giftedInclusions: string[]
  multiHotelOptions: (typeof schema.groupPackages.$inferSelect)["multiHotelOptions"]
  highlights: string[]
  bannerUrl: string | null
  coverImageUrl: string | null
  resolvedCoverImageUrl: string | null
  secondaryHotelImageUrl: string | null
  isFeatured: boolean
  isActive: boolean
  sortOrder: number
  updatedAt: Date
  airline: PublicAirlineDto | null
  makkahHotel: PublicHotelDto | null
  madinahHotel: PublicHotelDto | null
  departures: PublicGroupDepartureDto[]
}

function toPublicGroupPackageDto(
  row: typeof schema.groupPackages.$inferSelect & {
    airline: typeof schema.airlines.$inferSelect | null
    makkahHotel: typeof schema.hotels.$inferSelect | null
    madinahHotel: typeof schema.hotels.$inferSelect | null
    departures: Array<
      typeof schema.groupDepartures.$inferSelect & {
        departureCity: typeof schema.departureCities.$inferSelect | null
      }
    >
  }
): PublicGroupPackageDto {
  const makkahHotel = row.makkahHotel ? toPublicHotelDto(row.makkahHotel) : null
  const madinahHotel = row.madinahHotel
    ? toPublicHotelDto(row.madinahHotel)
    : null
  const visuals = resolvePublicPackageVisuals({
    coverImageUrl: row.coverImageUrl,
    bannerUrl: row.bannerUrl,
    makkahHotel,
    madinahHotel,
  })

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tier: row.tier,
    durationDays: row.durationDays,
    makkahNights: row.makkahNights,
    madinahNights: row.madinahNights,
    includesVisa: row.includesVisa,
    includesTransport: row.includesTransport,
    includesZiyarat: row.includesZiyarat,
    quadPricePkr: row.quadPricePkr,
    triplePricePkr: row.triplePricePkr,
    doublePricePkr: row.doublePricePkr,
    sharingPricePkr: row.sharingPricePkr,
    infantPricePkr: row.infantPricePkr,
    giftedInclusions: Array.isArray(row.giftedInclusions)
      ? row.giftedInclusions
      : [],
    multiHotelOptions: Array.isArray(row.multiHotelOptions)
      ? row.multiHotelOptions
      : [],
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
    bannerUrl: row.coverImageUrl ?? row.bannerUrl,
    coverImageUrl: row.coverImageUrl,
    resolvedCoverImageUrl: visuals.primaryImageUrl,
    secondaryHotelImageUrl: visuals.secondaryHotelImageUrl,
    isFeatured: row.isFeatured,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
    airline: row.airline
      ? {
          id: row.airline.id,
          name: row.airline.name,
          iataCode: row.airline.iataCode,
          logoUrl: row.airline.logoUrl,
          isDirectAvailable: row.airline.isDirectAvailable,
          isConnectingAvailable: row.airline.isConnectingAvailable,
        }
      : null,
    makkahHotel,
    madinahHotel,
    departures: row.departures.map((dep) => ({
      id: dep.id,
      packageId: dep.packageId,
      batchCode: dep.batchCode,
      departureCityId: dep.departureCityId,
      departureCity: dep.departureCity
        ? {
            id: dep.departureCity.id,
            cityName: dep.departureCity.cityName,
            name: dep.departureCity.cityName,
            airportCode: dep.departureCity.airportCode,
            airportName: dep.departureCity.airportName,
          }
        : null,
      departureDate: dep.departureDate,
      returnDate: dep.returnDate,
      totalSeats: dep.totalSeats,
      bookedSeats: dep.bookedSeats,
      seatsRemaining: Math.max(0, dep.totalSeats - dep.bookedSeats),
      status: dep.status,
      quadPriceOverridePkr: dep.quadPriceOverridePkr,
      triplePriceOverridePkr: dep.triplePriceOverridePkr,
      doublePriceOverridePkr: dep.doublePriceOverridePkr,
      sharingPriceOverridePkr: dep.sharingPriceOverridePkr,
      outboundFlightNumber: dep.outboundFlightNumber,
      returnFlightNumber: dep.returnFlightNumber,
      flightScheduleSummary: dep.flightScheduleSummary,
      routingNote: dep.routingNote,
      baggageAllowance: dep.baggageAllowance,
      updatedAt: dep.updatedAt,
    })),
  }
}

/**
 * 1. Cached loader for all active fixed-departure Umrah group packages (SAR wholesale stripped).
 */
export const getPublicGroupPackages = cache(
  async (): Promise<PublicGroupPackageDto[]> => {
    try {
      const todayPktIso = getTodayPktIso()
      const rows = await db.query.groupPackages.findMany({
        where: eq(schema.groupPackages.isActive, true),
        orderBy: [
          desc(schema.groupPackages.isFeatured),
          asc(schema.groupPackages.sortOrder),
        ],
        with: {
          airline: true,
          makkahHotel: true,
          madinahHotel: true,
          departures: {
            where: and(
              ne(schema.groupDepartures.status, "closed"),
              gte(schema.groupDepartures.departureDate, todayPktIso)
            ),
            orderBy: [asc(schema.groupDepartures.departureDate)],
            with: {
              departureCity: true,
            },
          },
        },
      })
      return rows.map(toPublicGroupPackageDto)
    } catch {
      return []
    }
  }
)

/**
 * 2. Cached loader for a single active Umrah group package by URL `slug` (SAR wholesale stripped).
 * Includes upcoming non-cancelled departures ordered chronologically.
 */
export const getPublicGroupPackageBySlug = cache(
  async (slug: string): Promise<PublicGroupPackageDto | null> => {
    const cleanSlug = (slug || "").trim().toLowerCase()
    if (!cleanSlug) return null
    try {
      const todayPktIso = getTodayPktIso()
      const row = await db.query.groupPackages.findFirst({
        where: and(
          eq(schema.groupPackages.slug, cleanSlug),
          eq(schema.groupPackages.isActive, true)
        ),
        with: {
          airline: true,
          makkahHotel: true,
          madinahHotel: true,
          departures: {
            where: and(
              ne(schema.groupDepartures.status, "closed"),
              gte(schema.groupDepartures.departureDate, todayPktIso)
            ),
            orderBy: [asc(schema.groupDepartures.departureDate)],
            with: {
              departureCity: true,
            },
          },
        },
      })
      return row ? toPublicGroupPackageDto(row) : null
    } catch {
      return null
    }
  }
)

/**
 * 3. Cached loader for active Umrah group packages filtered to a gateway city (`lahore`/`LHE`, `karachi`/`KHI`, `islamabad`/`ISB`).
 */
export const getPublicGroupPackagesByCity = cache(
  async (citySlugOrCode: string): Promise<PublicGroupPackageDto[]> => {
    const gateway = resolveUmrahGatewayCity(citySlugOrCode)
    const targetCode = (
      gateway?.airportCode ?? citySlugOrCode.trim().toUpperCase()
    ).trim()
    if (!targetCode) return []

    const allPackages = await getPublicGroupPackages()
    return allPackages
      .map((pkg) => ({
        ...pkg,
        departures: pkg.departures.filter(
          (dep) =>
            dep.departureCity?.airportCode.toUpperCase() === targetCode
        ),
      }))
      .filter((pkg) => pkg.departures.length > 0)
  }
)

export interface PublicHajjPackageDto {
  id: string
  slug: string
  title: string
  seasonYear: number
  maktabTier: string
  durationDays: number
  makkahHotelName: string
  makkahDistanceLabel: string
  madinahHotelName: string
  madinahDistanceLabel: string
  aziziyahStayNotes: string | null
  indicativeSharingPkr: number
  indicativeQuadPkr: number | null
  indicativeTriplePkr: number | null
  indicativeDoublePkr: number | null
  isIndicative: boolean
  regulatoryDisclaimer: string
  highlights: string[]
  isFeatured: boolean
  sortOrder: number
  updatedAt: Date
}

/**
 * 4. Cached loader for active indicative Hajj 2027 pre-registration packages (`OD-09e`).
 */
export const getPublicHajjPackages = cache(
  async (): Promise<PublicHajjPackageDto[]> => {
    try {
      const rows = await db
        .select({
          id: schema.hajjPackages.id,
          slug: schema.hajjPackages.slug,
          title: schema.hajjPackages.title,
          seasonYear: schema.hajjPackages.seasonYear,
          maktabTier: schema.hajjPackages.maktabTier,
          durationDays: schema.hajjPackages.durationDays,
          makkahHotelName: schema.hajjPackages.makkahHotelName,
          makkahDistanceLabel: schema.hajjPackages.makkahDistanceLabel,
          madinahHotelName: schema.hajjPackages.madinahHotelName,
          madinahDistanceLabel: schema.hajjPackages.madinahDistanceLabel,
          aziziyahStayNotes: schema.hajjPackages.aziziyahStayNotes,
          indicativeSharingPkr: schema.hajjPackages.indicativeSharingPkr,
          indicativeQuadPkr: schema.hajjPackages.indicativeQuadPkr,
          indicativeTriplePkr: schema.hajjPackages.indicativeTriplePkr,
          indicativeDoublePkr: schema.hajjPackages.indicativeDoublePkr,
          isIndicative: schema.hajjPackages.isIndicative,
          regulatoryDisclaimer: schema.hajjPackages.regulatoryDisclaimer,
          highlights: schema.hajjPackages.highlights,
          isFeatured: schema.hajjPackages.isFeatured,
          sortOrder: schema.hajjPackages.sortOrder,
          updatedAt: schema.hajjPackages.updatedAt,
        })
        .from(schema.hajjPackages)
        .where(eq(schema.hajjPackages.isActive, true))
        .orderBy(asc(schema.hajjPackages.sortOrder))
      return rows.map((row) => ({
        ...row,
        highlights: Array.isArray(row.highlights) ? row.highlights : [],
      }))
    } catch {
      return []
    }
  }
)

export interface PublicVisaRateDto {
  id: string
  tier: "short_term" | "long_term"
  label: string
  maxDays: number
  pricePkr: number
  notes: string | null
  updatedAt: Date
}

/**
 * 5. Cached loader for Umrah visa tiers (wholesale `*Sar` & `updatedByUserId` columns stripped).
 */
export const getPublicVisaRates = cache(
  async (): Promise<PublicVisaRateDto[]> => {
    try {
      return await db
        .select({
          id: schema.visaRates.id,
          tier: schema.visaRates.tier,
          label: schema.visaRates.label,
          maxDays: schema.visaRates.maxDays,
          pricePkr: schema.visaRates.pricePkr,
          notes: schema.visaRates.notes,
          updatedAt: schema.visaRates.updatedAt,
        })
        .from(schema.visaRates)
        .orderBy(asc(schema.visaRates.maxDays))
    } catch {
      return []
    }
  }
)

/**
 * 6. Cached loader for Makkah & Madinah hotels (ALL wholesale `*PriceSar*` columns stripped & expired contracts excluded).
 */
export const getPublicHotelsCatalog = cache(
  async (city?: "makkah" | "madinah"): Promise<PublicHotelDto[]> => {
    try {
      const todayPktIso = getTodayPktIso()
      const conditions = city
        ? and(eq(schema.hotels.isActive, true), eq(schema.hotels.city, city))
        : eq(schema.hotels.isActive, true)
      const rows = await db
        .select()
        .from(schema.hotels)
        .where(conditions)
        .orderBy(
          desc(schema.hotels.isFeatured),
          desc(schema.hotels.starRating),
          asc(schema.hotels.distanceMeters),
          asc(schema.hotels.sortOrder)
        )
      return rows
        .filter((row) => !row.validUntil || row.validUntil >= todayPktIso)
        .map(toPublicHotelDto)
    } catch {
      return []
    }
  }
)

export interface PublicVehicleDto {
  id: string
  name: string
  category: "sedan" | "suv" | "van" | "minibus" | "bus" | "train"
  bookingMode: "private_only" | "shared_only" | "shared_and_private"
  seatCapacity: number
  luggageCapacity: number
  allowsCustomPickupTime: boolean
  imageUrl: string | null
  description: string | null
  sortOrder: number
  updatedAt: Date
}

/**
 * 7. Cached loader for KSA ground transport & Haramain Train fleet (`defaultRateSar` & `ziyaratRateSar` stripped).
 */
export const getPublicVehiclesCatalog = cache(
  async (): Promise<PublicVehicleDto[]> => {
    try {
      return await db
        .select({
          id: schema.vehicles.id,
          name: schema.vehicles.name,
          category: schema.vehicles.category,
          bookingMode: schema.vehicles.bookingMode,
          seatCapacity: schema.vehicles.seatCapacity,
          luggageCapacity: schema.vehicles.luggageCapacity,
          allowsCustomPickupTime: schema.vehicles.allowsCustomPickupTime,
          imageUrl: schema.vehicles.imageUrl,
          description: schema.vehicles.description,
          sortOrder: schema.vehicles.sortOrder,
          updatedAt: schema.vehicles.updatedAt,
        })
        .from(schema.vehicles)
        .where(eq(schema.vehicles.isActive, true))
        .orderBy(asc(schema.vehicles.sortOrder))
    } catch {
      return []
    }
  }
)

export interface PublicZiyaratDto {
  id: string
  city: "makkah" | "madinah"
  name: string
  arabicName: string
  description: string
  imageUrl: string | null
  sortOrder: number
  updatedAt: Date
}

/**
 * 8. Cached loader for sacred Makkah & Madinah Ziyarat landmarks.
 */
export const getPublicZiyaratCatalog = cache(
  async (city?: "makkah" | "madinah"): Promise<PublicZiyaratDto[]> => {
    try {
      const conditions = city
        ? and(
            eq(schema.ziyaratPlaces.isActive, true),
            eq(schema.ziyaratPlaces.city, city)
          )
        : eq(schema.ziyaratPlaces.isActive, true)
      return await db
        .select({
          id: schema.ziyaratPlaces.id,
          city: schema.ziyaratPlaces.city,
          name: schema.ziyaratPlaces.name,
          arabicName: schema.ziyaratPlaces.arabicName,
          description: schema.ziyaratPlaces.description,
          imageUrl: schema.ziyaratPlaces.imageUrl,
          sortOrder: schema.ziyaratPlaces.sortOrder,
          updatedAt: schema.ziyaratPlaces.updatedAt,
        })
        .from(schema.ziyaratPlaces)
        .where(conditions)
        .orderBy(asc(schema.ziyaratPlaces.sortOrder))
    } catch {
      return []
    }
  }
)

export type PublicFaqCategory =
  | "general"
  | "visa"
  | "hotels"
  | "transport"
  | "packages"
  | "hajj"

export interface PublicFaqDto {
  id: string
  category: PublicFaqCategory
  question: string
  answer: string
  sortOrder: number
  updatedAt: Date
}

/**
 * 9. Cached loader for active FAQs (optionally filtered by category).
 */
export const getPublicFaqs = cache(
  async (category?: PublicFaqCategory): Promise<PublicFaqDto[]> => {
    try {
      const conditions = category
        ? and(
            eq(schema.faqs.isActive, true),
            eq(schema.faqs.category, category)
          )
        : eq(schema.faqs.isActive, true)
      return await db
        .select({
          id: schema.faqs.id,
          category: schema.faqs.category,
          question: schema.faqs.question,
          answer: schema.faqs.answer,
          sortOrder: schema.faqs.sortOrder,
          updatedAt: schema.faqs.updatedAt,
        })
        .from(schema.faqs)
        .where(conditions)
        .orderBy(asc(schema.faqs.sortOrder))
    } catch {
      return []
    }
  }
)

export interface PublicHeroSlideDto {
  id: string
  badge: string | null
  title: string
  subtitle: string
  imageUrl: string
  videoUrl: string | null
  primaryCtaLabel: string
  primaryCtaUrl: string
  secondaryCtaLabel: string | null
  secondaryCtaUrl: string | null
  sortOrder: number
  updatedAt: Date
}

/**
 * 10. Cached loader for active homepage hero slides.
 */
export const getPublicHeroSlides = cache(
  async (): Promise<PublicHeroSlideDto[]> => {
    try {
      return await db
        .select({
          id: schema.heroSlides.id,
          badge: schema.heroSlides.badge,
          title: schema.heroSlides.title,
          subtitle: schema.heroSlides.subtitle,
          imageUrl: schema.heroSlides.imageUrl,
          videoUrl: schema.heroSlides.videoUrl,
          primaryCtaLabel: schema.heroSlides.primaryCtaLabel,
          primaryCtaUrl: schema.heroSlides.primaryCtaUrl,
          secondaryCtaLabel: schema.heroSlides.secondaryCtaLabel,
          secondaryCtaUrl: schema.heroSlides.secondaryCtaUrl,
          sortOrder: schema.heroSlides.sortOrder,
          updatedAt: schema.heroSlides.updatedAt,
        })
        .from(schema.heroSlides)
        .where(eq(schema.heroSlides.isActive, true))
        .orderBy(asc(schema.heroSlides.sortOrder))
    } catch {
      return []
    }
  }
)

export interface PublicTestimonialDto {
  id: string
  pilgrimName: string
  city: string
  packageOrJourneyType: string
  rating: number
  quote: string
  avatarUrl: string | null
  isFeatured: boolean
  sortOrder: number
  updatedAt: Date
}

/**
 * 11. Cached loader for active public testimonials.
 */
export const getPublicTestimonials = cache(
  async (): Promise<PublicTestimonialDto[]> => {
    try {
      return await db
        .select({
          id: schema.testimonials.id,
          pilgrimName: schema.testimonials.pilgrimName,
          city: schema.testimonials.city,
          packageOrJourneyType: schema.testimonials.packageOrJourneyType,
          rating: schema.testimonials.rating,
          quote: schema.testimonials.quote,
          avatarUrl: schema.testimonials.avatarUrl,
          isFeatured: schema.testimonials.isFeatured,
          sortOrder: schema.testimonials.sortOrder,
          updatedAt: schema.testimonials.updatedAt,
        })
        .from(schema.testimonials)
        .where(eq(schema.testimonials.isActive, true))
        .orderBy(
          desc(schema.testimonials.isFeatured),
          asc(schema.testimonials.sortOrder)
        )
    } catch {
      return []
    }
  }
)
