// covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10
import "../setup/hermetic-env"
import fs from "node:fs"
import path from "node:path"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/studio",
  useSearchParams: () => new URLSearchParams(),
}))

import type { PackageWithRelations } from "@/components/admin/catalog/groups-client"
import { StudioHubClient } from "@/components/admin/hubs/studio-hub-client"
import { PackageWorkbenchClient } from "@/components/admin/studio/package-workbench-client"
import { GroupPackagesSection } from "@/components/public/group-packages-section"
import {
  resolveCardVisualUrl,
  UmrahPackageCard,
} from "@/components/public/umrah-package-card"
import { UmrahPackagesExplorer } from "@/components/public/umrah-packages-explorer"
import { UmrahDeparturesSchedule } from "@/components/seo/umrah-departures-schedule"
import { UmrahPackageBookingCta } from "@/components/seo/umrah-package-booking-cta"
import {
  resolvePublicPackageVisuals,
  type PublicGroupPackageDto,
} from "@/lib/seo/public-queries"
import { UMRAH_GATEWAY_CITIES } from "@/lib/seo/slugs"
import {
  cloneGroupDepartureBatchSchema,
  upsertGroupPackageWithBatchesSchema,
} from "@/lib/validations/catalog"

const WEB_ROOT = process.cwd()

const TEST_UUID_1 = "11111111-1111-4111-8111-111111111111"
const TEST_UUID_2 = "22222222-2222-4222-8222-222222222222"
const TEST_UUID_3 = "33333333-3333-4333-8333-333333333333"
const TEST_UUID_4 = "44444444-4444-4444-8444-444444444444"
const TEST_UUID_5 = "55555555-5555-4555-8555-555555555555"

type AssertNoInternalPosterKey =
  "internalPosterUrl" extends keyof PublicGroupPackageDto ? never : true
const PUBLIC_DTO_OMITS_INTERNAL_POSTER: AssertNoInternalPosterKey = true

function makePublicPackageFixture(
  overrides: Partial<PublicGroupPackageDto> = {}
): PublicGroupPackageDto {
  return {
    id: TEST_UUID_1,
    slug: "15-days-courtyard-gold-umrah",
    title: "15 Days Courtyard Gold Umrah",
    tier: "gold",
    durationDays: 15,
    makkahNights: 8,
    madinahNights: 6,
    includesVisa: true,
    includesTransport: true,
    includesZiyarat: true,
    sharingPricePkr: 0,
    quadPricePkr: 425000,
    triplePricePkr: 465000,
    doublePricePkr: 0,
    infantPricePkr: 72000,
    giftedInclusions: ["5L Zamzam Water", "Pilgrim Backpack & Ihram"],
    multiHotelOptions: [
      {
        pkgCode: "OPT-FAIRMONT",
        label: "Clock Tower Kaaba View Upgrade",
        makkahHotelName: "Fairmont Makkah Clock Royal Tower",
        makkahDistance: "0m Courtyard",
        madinahHotelName: "Anwar Al Madinah Movenpick",
        madinahDistance: "30m Markaziyah",
        sharingPricePkr: 0,
        quadPricePkr: 495000,
        triplePricePkr: 540000,
        doublePricePkr: 625000,
      },
    ],
    highlights: ["Direct Saudia Flight", "Guided Haramain Ziyarat"],
    bannerUrl: null,
    coverImageUrl: null,
    resolvedCoverImageUrl:
      "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800",
    secondaryHotelImageUrl:
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
    isFeatured: true,
    isActive: true,
    sortOrder: 1,
    updatedAt: new Date("2026-11-24T00:00:00.000Z"),
    airline: {
      id: TEST_UUID_2,
      name: "Saudia",
      iataCode: "SV",
      logoUrl: null,
      isDirectAvailable: true,
      isConnectingAvailable: true,
    },
    makkahHotel: {
      id: TEST_UUID_3,
      name: "Swissotel Al Maqam Makkah",
      city: "makkah",
      starRating: 5,
      distanceMeters: 50,
      distanceLabel: "50m Clock Tower Courtyard",
      accessType: "walking",
      imageUrl:
        "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800",
      galleryUrls: [
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
      ],
      amenities: ["Direct Haram Access", "Breakfast Included"],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: ["breakfast"],
      mealsAvailable: true,
      validFrom: "2026-01-01",
      validUntil: "2027-12-31",
      locationNotes: "Clock Tower Courtyard access.",
      isFeatured: true,
      sortOrder: 1,
      updatedAt: new Date("2026-11-24T00:00:00.000Z"),
    },
    madinahHotel: {
      id: TEST_UUID_4,
      name: "Anwar Al Madinah Movenpick",
      city: "madinah",
      starRating: 5,
      distanceMeters: 30,
      distanceLabel: "30m Markaziyah",
      accessType: "walking",
      imageUrl:
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
      galleryUrls: [
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
      ],
      amenities: ["Ladies Gate 25 Access", "Buffet Dining"],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: ["breakfast"],
      mealsAvailable: true,
      validFrom: "2026-01-01",
      validUntil: "2027-12-31",
      locationNotes: "Steps from Prophet's Mosque.",
      isFeatured: true,
      sortOrder: 2,
      updatedAt: new Date("2026-11-24T00:00:00.000Z"),
    },
    departures: [
      {
        id: "dep-lhe-open",
        packageId: TEST_UUID_1,
        batchCode: "CRT-LHE-2702-01",
        departureCityId: TEST_UUID_5,
        departureCity: {
          id: TEST_UUID_5,
          cityName: "Lahore",
          name: "Lahore",
          airportCode: "LHE",
          airportName: "Allama Iqbal International Airport",
        },
        departureDate: "2099-02-10",
        returnDate: "2099-02-24",
        totalSeats: 40,
        bookedSeats: 12,
        seatsRemaining: 28,
        status: "open",
        quadPriceOverridePkr: null,
        triplePriceOverridePkr: null,
        doublePriceOverridePkr: null,
        sharingPriceOverridePkr: null,
        outboundFlightNumber: "SV-739",
        returnFlightNumber: "SV-738",
        flightScheduleSummary: "Direct LHE -> JED / MED -> LHE",
        routingNote: "Direct Flights (LHE to JED)",
        baggageAllowance: "23-KG Outbound / 46-KG Return",
        updatedAt: new Date("2026-11-24T00:00:00.000Z"),
      },
      {
        id: "dep-khi-fast",
        packageId: TEST_UUID_1,
        batchCode: "CRT-KHI-2702-02",
        departureCityId: "66666666-6666-4666-8666-666666666666",
        departureCity: {
          id: "66666666-6666-4666-8666-666666666666",
          cityName: "Karachi",
          name: "Karachi",
          airportCode: "KHI",
          airportName: "Jinnah International Airport",
        },
        departureDate: "2099-02-12",
        returnDate: "2099-02-26",
        totalSeats: 35,
        bookedSeats: 31,
        seatsRemaining: 4,
        status: "filling_fast",
        quadPriceOverridePkr: null,
        triplePriceOverridePkr: null,
        doublePriceOverridePkr: null,
        sharingPriceOverridePkr: null,
        outboundFlightNumber: "SV-701",
        returnFlightNumber: "SV-700",
        flightScheduleSummary: "Direct KHI -> JED / MED -> KHI",
        routingNote: "Direct Flights (KHI to JED)",
        baggageAllowance: "23-KG Outbound / 46-KG Return",
        updatedAt: new Date("2026-11-24T00:00:00.000Z"),
      },
    ],
    ...overrides,
  }
}

function makeAdminPackageFixture(
  overrides: Partial<PackageWithRelations> = {}
): PackageWithRelations {
  return {
    id: TEST_UUID_1,
    title: "15 Days Courtyard Gold Umrah",
    slug: "15-days-courtyard-gold-umrah",
    tier: "gold",
    durationDays: 15,
    makkahNights: 8,
    madinahNights: 6,
    airlineId: TEST_UUID_2,
    makkahHotelId: TEST_UUID_3,
    madinahHotelId: TEST_UUID_4,
    includesVisa: true,
    includesTransport: true,
    includesZiyarat: true,
    sharingPricePkr: 0,
    quadPricePkr: 425000,
    triplePricePkr: 465000,
    doublePricePkr: 520000,
    infantPricePkr: 72000,
    giftedInclusions: ["5L Zamzam Water"],
    multiHotelOptions: [],
    highlights: ["Direct Saudia Flight"],
    bannerUrl: null,
    coverImageUrl: null,
    internalPosterUrl: null,
    isFeatured: true,
    isActive: true,
    sortOrder: 0,
    airline: { id: TEST_UUID_2, name: "Saudia", iataCode: "SV" },
    makkahHotel: {
      id: TEST_UUID_3,
      name: "Swissotel Al Maqam Makkah",
      city: "makkah",
      starRating: 5,
      distanceMeters: 50,
      distanceLabel: "50m Courtyard",
      accessType: "walking",
      imageUrl:
        "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800",
      galleryUrls: [],
    },
    madinahHotel: {
      id: TEST_UUID_4,
      name: "Anwar Al Madinah Movenpick",
      city: "madinah",
      starRating: 5,
      distanceMeters: 30,
      distanceLabel: "30m Markaziyah",
      accessType: "walking",
      imageUrl:
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
      galleryUrls: [],
    },
    departures: [
      {
        id: "dep-admin-lhe",
        packageId: TEST_UUID_1,
        batchCode: "CRT-LHE-2702-01",
        departureCityId: TEST_UUID_5,
        departureDate: "2099-02-10",
        returnDate: "2099-02-24",
        totalSeats: 40,
        bookedSeats: 10,
        status: "open",
        outboundFlightNumber: "SV-739",
        returnFlightNumber: "SV-738",
        baggageAllowance: "23-KG Outbound / 46-KG Return",
        departureCity: {
          id: TEST_UUID_5,
          cityName: "Lahore",
          airportCode: "LHE",
        },
      },
    ],
    ...overrides,
  }
}

describe("Spec 0031: Umrah Package Lifecycle, Media Split, Explorer & Sticky Calculator", () => {
  // covers: AC-1
  it("AC-1: resolves public visuals in priority order, blocks internal posters/PDFs, and strips internalPosterUrl from PublicGroupPackageDto", () => {
    expect(PUBLIC_DTO_OMITS_INTERNAL_POSTER).toBe(true)

    // 1. Explicit coverImageUrl wins over hotel photos; secondaryHotelImageUrl resolves to Madinah hotel photo
    expect(
      resolvePublicPackageVisuals({
        coverImageUrl:
          "https://assets.alramlahtravels.com/posters/banners/hero.jpg",
        makkahHotel: {
          imageUrl: "https://images.unsplash.com/makkah.jpg",
          galleryUrls: ["https://images.unsplash.com/makkah-g1.jpg"],
        },
        madinahHotel: {
          imageUrl: "https://images.unsplash.com/madinah.jpg",
          galleryUrls: ["https://images.unsplash.com/madinah-g1.jpg"],
        },
      })
    ).toEqual({
      primaryImageUrl:
        "https://assets.alramlahtravels.com/posters/banners/hero.jpg",
      secondaryHotelImageUrl: "https://images.unsplash.com/madinah.jpg",
    })

    // 2. Null or PDF coverImageUrl falls back to makkahHotel.imageUrl
    expect(
      resolvePublicPackageVisuals({
        coverImageUrl: "https://assets.alramlahtravels.com/posters/sheet.pdf",
        makkahHotel: {
          imageUrl: "https://images.unsplash.com/makkah.jpg",
        },
        madinahHotel: {
          imageUrl: "https://images.unsplash.com/madinah.jpg",
        },
      })
    ).toEqual({
      primaryImageUrl: "https://images.unsplash.com/makkah.jpg",
      secondaryHotelImageUrl: "https://images.unsplash.com/madinah.jpg",
    })

    // 3. Null makkahHotel.imageUrl falls back to madinahHotel.imageUrl without duplicating secondaryHotelImageUrl
    expect(
      resolvePublicPackageVisuals({
        coverImageUrl: null,
        makkahHotel: { imageUrl: null, galleryUrls: [] },
        madinahHotel: {
          imageUrl: "https://images.unsplash.com/madinah.jpg",
          galleryUrls: ["https://images.unsplash.com/madinah-g1.jpg"],
        },
      })
    ).toEqual({
      primaryImageUrl: "https://images.unsplash.com/madinah.jpg",
      secondaryHotelImageUrl: "https://images.unsplash.com/madinah-g1.jpg",
    })

    // 4. Null primary imageUrl falls back to makkahHotel.galleryUrls[0], then madinahHotel.galleryUrls[0]
    expect(
      resolvePublicPackageVisuals({
        coverImageUrl: null,
        makkahHotel: {
          imageUrl: null,
          galleryUrls: [
            "https://assets.alramlahtravels.com/docs/brochure.pdf",
            "https://images.unsplash.com/makkah-gallery.jpg",
          ],
        },
        madinahHotel: {
          imageUrl: null,
          galleryUrls: ["https://images.unsplash.com/madinah-gallery.jpg"],
        },
      })
    ).toEqual({
      primaryImageUrl: "https://images.unsplash.com/makkah-gallery.jpg",
      secondaryHotelImageUrl: "https://images.unsplash.com/madinah-gallery.jpg",
    })

    expect(
      resolvePublicPackageVisuals({
        coverImageUrl: null,
        makkahHotel: { imageUrl: null, galleryUrls: [] },
        madinahHotel: {
          imageUrl: null,
          galleryUrls: ["https://images.unsplash.com/madinah-gallery-only.jpg"],
        },
      })
    ).toEqual({
      primaryImageUrl: "https://images.unsplash.com/madinah-gallery-only.jpg",
      secondaryHotelImageUrl: null,
    })

    // 5. Internal poster paths on legacy bannerUrl never leak onto public website cards
    for (const posterBanner of [
      "https://pub-audit.r2.dev/posters/spotlights/ART-1.png",
      "https://pub-audit.r2.dev/posters/multi-sheets/sheet-1.png",
      "https://pub-audit.r2.dev/posters/wrapped/w-1.png",
      "https://pub-audit.r2.dev/flyers/raw-b2b.jpg",
      "https://pub-audit.r2.dev/posters/alramlah-wrapped-abc.png",
      "https://pub-audit.r2.dev/posters/doc.pdf",
    ]) {
      expect(
        resolvePublicPackageVisuals({
          coverImageUrl: null,
          bannerUrl: posterBanner,
          makkahHotel: null,
          madinahHotel: null,
        })
      ).toEqual({
        primaryImageUrl: null,
        secondaryHotelImageUrl: null,
      })

      expect(
        resolveCardVisualUrl(
          makePublicPackageFixture({
            coverImageUrl: null,
            resolvedCoverImageUrl: null,
            makkahHotel: null,
            madinahHotel: null,
            bannerUrl: posterBanner,
          })
        )
      ).toBeNull()
    }

    // 6. Verify DTO & Cmd+K source contracts for media split
    const publicQueriesSrc = fs.readFileSync(
      path.join(WEB_ROOT, "lib/seo/public-queries.ts"),
      "utf8"
    )
    const dtoBody = publicQueriesSrc.slice(
      publicQueriesSrc.indexOf("function toPublicGroupPackageDto"),
      publicQueriesSrc.indexOf("export const getPublicGroupPackages")
    )
    expect(dtoBody).not.toContain("internalPosterUrl")

    const cmdLookupSrc = fs.readFileSync(
      path.join(WEB_ROOT, "app/actions/command-lookup.ts"),
      "utf8"
    )
    expect(cmdLookupSrc).toContain(
      "row.pkg.internalPosterUrl ?? row.pkg.bannerUrl"
    )
    expect(cmdLookupSrc).toContain("isSuperAdmin ? row.pkg.netSharingPkr : 0")
  })

  // covers: AC-2
  it("AC-2: validates upsertGroupPackageWithBatchesSchema and cloneGroupDepartureBatchSchema and checks requireAdmin/transaction contracts", () => {
    const validUpsert = upsertGroupPackageWithBatchesSchema.safeParse({
      package: {
        title: "15 Days Courtyard Gold Umrah",
        slug: "15-days-courtyard-gold-umrah",
        tier: "gold",
        durationDays: 15,
        makkahNights: 8,
        madinahNights: 6,
        airlineId: TEST_UUID_2,
        makkahHotelId: TEST_UUID_3,
        madinahHotelId: TEST_UUID_4,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
        sharingPricePkr: 0,
        quadPricePkr: 425000,
        triplePricePkr: 465000,
        doublePricePkr: 520000,
        infantPricePkr: 72000,
        giftedInclusions: ["5L Zamzam Water"],
        highlights: ["Direct Saudia Flight"],
        coverImageUrl: null,
        bannerUrl: null,
        isFeatured: true,
        isActive: true,
        sortOrder: 0,
      },
      batches: [
        {
          batchCode: "CRT-LHE-2702-01",
          departureCityId: TEST_UUID_5,
          departureDate: "2027-02-10",
          returnDate: "2027-02-24",
          totalSeats: 40,
          bookedSeats: 0,
          status: "open",
        },
        {
          batchCode: "CRT-KHI-2702-02",
          departureCityId: TEST_UUID_4,
          departureDate: "2027-02-12",
          returnDate: "2027-02-26",
          totalSeats: 35,
          bookedSeats: 5,
          status: "open",
        },
      ],
    })
    expect(validUpsert.success).toBe(true)

    // Reject returnDate < departureDate
    const badDateOrder = upsertGroupPackageWithBatchesSchema.safeParse({
      package: {
        title: "Bad Date Order",
        slug: "bad-date-order",
        tier: "silver",
        durationDays: 14,
        makkahNights: 7,
        madinahNights: 6,
        quadPricePkr: 310000,
        triplePricePkr: 340000,
        doublePricePkr: 380000,
        bannerUrl: null,
        coverImageUrl: null,
        internalPosterUrl: null,
      },
      batches: [
        {
          batchCode: "BAD-DATE-01",
          departureCityId: TEST_UUID_5,
          departureDate: "2027-03-20",
          returnDate: "2027-03-10",
          totalSeats: 30,
          bookedSeats: 0,
        },
      ],
    })
    expect(badDateOrder.success).toBe(false)

    // Reject bookedSeats > totalSeats
    const badSeats = upsertGroupPackageWithBatchesSchema.safeParse({
      package: {
        title: "Overbooked Batch",
        slug: "overbooked-batch",
        tier: "silver",
        durationDays: 14,
        makkahNights: 7,
        madinahNights: 6,
        quadPricePkr: 310000,
        triplePricePkr: 340000,
        doublePricePkr: 380000,
        bannerUrl: null,
        coverImageUrl: null,
        internalPosterUrl: null,
      },
      batches: [
        {
          batchCode: "OVERBOOK-01",
          departureCityId: TEST_UUID_5,
          departureDate: "2027-03-10",
          returnDate: "2027-03-24",
          totalSeats: 20,
          bookedSeats: 25,
        },
      ],
    })
    expect(badSeats.success).toBe(false)

    // Valid clone payload & rejecting empty targetCityIds
    const validClone = cloneGroupDepartureBatchSchema.safeParse({
      sourceBatchId: TEST_UUID_1,
      targetCityIds: [TEST_UUID_2, TEST_UUID_3],
      departureDateOffsetDays: 7,
    })
    expect(validClone.success).toBe(true)

    const emptyCloneTargets = cloneGroupDepartureBatchSchema.safeParse({
      sourceBatchId: TEST_UUID_1,
      targetCityIds: [],
      departureDateOffsetDays: 0,
    })
    expect(emptyCloneTargets.success).toBe(false)

    const invalidUuidClone = cloneGroupDepartureBatchSchema.safeParse({
      sourceBatchId: "not-a-uuid",
      targetCityIds: [TEST_UUID_2],
    })
    expect(invalidUuidClone.success).toBe(false)

    // Action security & transaction boundary checks
    const groupsActionsSrc = fs.readFileSync(
      path.join(WEB_ROOT, "app/actions/groups.ts"),
      "utf8"
    )
    expect(groupsActionsSrc).toMatch(
      /export async function upsertGroupPackageWithBatches[\s\S]{0,120}await requireAdmin\(\)/
    )
    expect(groupsActionsSrc).toMatch(
      /export async function cloneGroupDepartureBatch[\s\S]{0,120}await requireAdmin\(\)/
    )
    expect(groupsActionsSrc).toContain("withTransaction(")
    expect(groupsActionsSrc).toContain("recordAuditLog(")
    expect(groupsActionsSrc).toContain("revalidatePublicSeoPaths(")
  })

  // covers: AC-5, AC-6, AC-9, AC-10
  it("AC-5, AC-6 & AC-9: renders UmrahPackageCard & UmrahPackagesExplorer (Unfiltered + lockedGateway), On Request 0-tier, Infant 0-bed/0-seat, and hidden SEO Comparison Matrix", () => {
    const goldPkg = makePublicPackageFixture()

    // 1. UmrahPackageCard with image + 0-priced active tier -> On Request & Arabic fallback when image missing
    const onRequestCardHtml = renderToStaticMarkup(
      React.createElement(UmrahPackageCard, {
        pkg: goldPkg,
        activeOccupancy: "sharing",
        activeGatewayCode: "LHE",
      })
    )
    expect(onRequestCardHtml).toContain("15 Days Courtyard Gold Umrah")
    expect(onRequestCardHtml).toContain("Swissotel Al Maqam Makkah")
    expect(onRequestCardHtml).toContain("Anwar Al Madinah Movenpick")
    expect(onRequestCardHtml).toContain("On Request")
    expect(onRequestCardHtml).toContain("PKR 72,000")
    expect(onRequestCardHtml).toContain("(0 bed · 0 seat)")
    expect(onRequestCardHtml).not.toContain("PKR 0")
    expect(onRequestCardHtml).toContain("<img")

    const noPhotoFallbackHtml = renderToStaticMarkup(
      React.createElement(UmrahPackageCard, {
        pkg: makePublicPackageFixture({
          coverImageUrl: null,
          resolvedCoverImageUrl: null,
          bannerUrl: null,
          makkahHotel: {
            ...goldPkg.makkahHotel!,
            imageUrl: null,
            galleryUrls: [],
          },
          madinahHotel: {
            ...goldPkg.madinahHotel!,
            imageUrl: null,
            galleryUrls: [],
          },
        }),
        activeOccupancy: "quad",
      })
    )
    expect(noPhotoFallbackHtml).toContain("PKR 425,000")
    expect(noPhotoFallbackHtml).toContain('lang="ar"')
    expect(noPhotoFallbackHtml).toContain('dir="rtl"')
    expect(noPhotoFallbackHtml).toContain("لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ")

    // 2. UmrahPackagesExplorer (unfiltered mode)
    const explorerHtml = renderToStaticMarkup(
      React.createElement(UmrahPackagesExplorer, {
        packages: [goldPkg],
        agencyWhatsapp: "03274029701",
      })
    )
    expect(explorerHtml).toContain("All Pakistan")
    expect(explorerHtml).toContain("Lahore (LHE)")
    expect(explorerHtml).toContain("Karachi (KHI)")
    expect(explorerHtml).toContain("Islamabad (ISB)")
    expect(explorerHtml).toContain("Quad (4-Bed)")
    expect(explorerHtml).toContain("Sharing")
    expect(explorerHtml).toContain("Triple (3-Bed)")
    expect(explorerHtml).toContain("Double (2-Bed)")
    expect(explorerHtml).toContain("Visual Cards")
    expect(explorerHtml).toContain("Compare Matrix")
    expect(explorerHtml).toContain('aria-pressed="true"')
    expect(explorerHtml).toContain("PKR 425,000")
    expect(explorerHtml).toContain("On Request")
    expect(explorerHtml).not.toContain("PKR 0")
    // Comparison table MUST stay mounted in SSR DOM inside hidden wrapper for SEO crawlers
    expect(explorerHtml).toContain("<table")
    expect(explorerHtml).toContain("0 bed · 0 seat")
    expect(explorerHtml).toMatch(
      /<div[^>]*hidden=""[^>]*aria-hidden="true"[^>]*><div[^>]*><table/
    )

    // 3. UmrahPackagesExplorer (lockedGateway mode for /umrah-packages/from-lahore)
    const lockedLahoreHtml = renderToStaticMarkup(
      React.createElement(UmrahPackagesExplorer, {
        packages: [goldPkg],
        lockedGateway: UMRAH_GATEWAY_CITIES.lahore,
        agencyWhatsapp: "03274029701",
      })
    )
    expect(lockedLahoreHtml).toContain("Departing Lahore (LHE)")
    expect(lockedLahoreHtml).toContain('href="/umrah-packages"')
    expect(lockedLahoreHtml).toContain('href="/umrah-packages/from-karachi"')
    expect(lockedLahoreHtml).toContain('href="/umrah-packages/from-islamabad"')
    expect(lockedLahoreHtml).not.toContain(
      "Filter Umrah packages by Pakistani departure gateway"
    )

    // 4. Homepage GroupPackagesSection uses synced UmrahPackageCard & occupancy switcher
    const homeGroupHtml = renderToStaticMarkup(
      React.createElement(GroupPackagesSection, {
        packages: [goldPkg],
        agencyWhatsapp: "+923274029701",
      })
    )
    expect(homeGroupHtml).toContain("Preview Occupancy Rate:")
    expect(homeGroupHtml).toContain("PKR 425,000")
    expect(homeGroupHtml).toContain("Book Package Seats")
  })

  // covers: AC-3, AC-4, AC-10
  it("AC-3, AC-4 & AC-10: renders PackageWorkbenchClient truthful storefront visibility badges, Internal Poster isolation, and StudioHubClient package-first default tab", () => {
    const baseAdminPkg = makeAdminPackageFixture()
    const liveWithPoster = makeAdminPackageFixture({
      id: TEST_UUID_1,
      title: "Live Courtyard Gold",
      slug: "live-courtyard-gold",
      isActive: true,
      coverImageUrl: null,
      internalPosterUrl: "https://pub-audit.r2.dev/posters/spotlights/live.png",
      makkahHotel: {
        ...baseAdminPkg.makkahHotel!,
        imageUrl: "https://images.unsplash.com/makkah-cover.jpg",
      },
    })

    const activeNeedsBatch = makeAdminPackageFixture({
      id: TEST_UUID_2,
      title: "Active Missing Batch",
      slug: "active-missing-batch",
      isActive: true,
      departures: [
        {
          id: "dep-closed",
          packageId: TEST_UUID_2,
          batchCode: "CLOSED-01",
          departureCityId: TEST_UUID_5,
          departureDate: "2099-03-01",
          returnDate: "2099-03-15",
          totalSeats: 30,
          bookedSeats: 0,
          status: "closed",
          departureCity: {
            id: TEST_UUID_5,
            cityName: "Lahore",
            airportCode: "LHE",
          },
        },
      ],
    })

    const hiddenDraft = makeAdminPackageFixture({
      id: TEST_UUID_3,
      title: "Draft Silver Package",
      slug: "draft-silver-package",
      tier: "silver",
      isActive: false,
      departures: [],
    })

    const workbenchHtml = renderToStaticMarkup(
      React.createElement(PackageWorkbenchClient, {
        initialPackages: [liveWithPoster, activeNeedsBatch, hiddenDraft],
        airlines: [{ id: TEST_UUID_2, name: "Saudia", iataCode: "SV" }],
        hotels: [
          {
            id: TEST_UUID_3,
            name: "Swissotel Al Maqam Makkah",
            city: "makkah",
            starRating: 5,
            distanceMeters: 50,
            distanceLabel: "50m Courtyard",
            accessType: "walking",
            imageUrl: "https://images.unsplash.com/makkah-cover.jpg",
          },
        ],
        departureCities: [
          { id: TEST_UUID_5, cityName: "Lahore", airportCode: "LHE" },
        ],
        todayPktIso: "2026-11-24",
      })
    )

    expect(workbenchHtml).toContain("Live (1 Open Batch)")
    expect(workbenchHtml).toContain("Hidden on Site (0 Open Batches)")
    expect(workbenchHtml).toContain("Hidden Draft")
    expect(workbenchHtml).toContain("Internal Poster")
    expect(workbenchHtml).toContain("Clone to Gateways")
    expect(workbenchHtml).toContain("Create Package &amp; Batches")
    // Cover thumbnail uses hotel image, never the internal 4K poster URL
    expect(workbenchHtml).toContain("makkah-cover.jpg")
    expect(workbenchHtml).not.toContain("/posters/spotlights/live.png")

    const studioHubHtml = renderToStaticMarkup(
      React.createElement(StudioHubClient, {
        initialTab: "packages",
        todayPktIso: "2026-11-24",
        suppliers: [],
        supplierFlyers: [],
        postAssets: [],
        groupPackages: [liveWithPoster],
        airlines: [{ id: TEST_UUID_2, name: "Saudia", iataCode: "SV" }],
        hotels: [],
        departureCities: [
          { id: TEST_UUID_5, cityName: "Lahore", airportCode: "LHE" },
        ],
      })
    )
    expect(studioHubHtml).toContain("1. Umrah Packages &amp; Batches")
    expect(studioHubHtml).toContain("2. AI Flyer &amp; Poster Importer")
    expect(studioHubHtml).toContain("3. Internal 4K Poster Vault")
    expect(studioHubHtml).toContain('aria-selected="true"')
    expect(studioHubHtml).toContain("Live (1 Open Batch)")
    // Regression guard: WCAG 2.5.3 Label in Name uses visible /slug + sr-only suffix without parenthetical aria-label mismatch
    expect(studioHubHtml).toMatch(
      /<span class="font-mono">\/[a-z0-9-]+<\/span><span class="sr-only">\s*View [^<]+ on public website<\/span>/
    )
    expect(studioHubHtml).not.toContain("aria-label=\"View ")

    // Regression guard: sold-out fallback batch renders "Sold Out" rather than "0 seats left"
    const soldOutCardHtml = renderToStaticMarkup(
      React.createElement(UmrahPackageCard, {
        pkg: makePublicPackageFixture({
          departures: [
            {
              id: TEST_UUID_4,
              batchCode: "ART-SOLD-OUT-01",
              departureDate: "2027-04-10",
              returnDate: "2027-04-24",
              totalSeats: 40,
              bookedSeats: 40,
              seatsRemaining: 0,
              status: "sold_out",
              quadPriceOverridePkr: null,
              triplePriceOverridePkr: null,
              doublePriceOverridePkr: null,
              sharingPriceOverridePkr: null,
              outboundFlightNumber: "SV-739",
              returnFlightNumber: "SV-738",
              flightScheduleSummary: "Direct LHE-JED",
              routingNote: null,
              baggageAllowance: "46 KG",
              departureCity: {
                id: TEST_UUID_5,
                cityName: "Lahore",
                airportCode: "LHE",
              },
            },
          ],
        }),
      })
    )
    expect(soldOutCardHtml).toContain("Sold Out")
    expect(soldOutCardHtml).not.toContain("0 seats left")

    // Confirm Operate UI craft laws (0 window.confirm/alert, 0 asChild, 0 HaramainSectionReveal) + PackageBuilderSheet regressions
    const builderSheetSrc = fs.readFileSync(
      path.join(WEB_ROOT, "components/admin/studio/package-builder-sheet.tsx"),
      "utf8"
    )
    expect(builderSheetSrc).toContain('key="pb-next-step-btn"')
    expect(builderSheetSrc).toContain('key="pb-submit-package-btn"')
    expect(builderSheetSrc).toContain("if (step < 3)")
    expect(builderSheetSrc).toContain("data-[side=right]:sm:max-w-3xl")
    expect(builderSheetSrc).toContain("data-[side=right]:lg:max-w-4xl")

    for (const rel of [
      "components/admin/studio/package-workbench-client.tsx",
      "components/admin/studio/package-builder-sheet.tsx",
    ]) {
      const src = fs.readFileSync(path.join(WEB_ROOT, rel), "utf8")
      expect(src).not.toContain("window.confirm")
      expect(src).not.toContain("window.alert")
      expect(src).not.toContain("asChild")
      expect(src).not.toContain("HaramainSectionReveal")
    }
  })

  // covers: AC-7, AC-8, AC-10
  it("AC-7 & AC-8: renders UmrahDeparturesSchedule interactive batch cards and UmrahPackageBookingCta sticky calculator with disabled 0-tiers and normalized WhatsApp link", () => {
    const pkg = makePublicPackageFixture()

    const scheduleHtml = renderToStaticMarkup(
      React.createElement(UmrahDeparturesSchedule, {
        departures: pkg.departures,
        defaultQuadPricePkr: pkg.quadPricePkr,
      })
    )
    expect(scheduleHtml).toContain("All Gateways (2)")
    expect(scheduleHtml).toContain("Lahore")
    expect(scheduleHtml).toContain("(LHE)")
    expect(scheduleHtml).toContain("Karachi")
    expect(scheduleHtml).toContain("(KHI)")
    expect(scheduleHtml).toContain("CRT-LHE-2702-01")
    expect(scheduleHtml).toContain("CRT-KHI-2702-02")
    expect(scheduleHtml).toContain("SV-739 / SV-738")
    expect(scheduleHtml).toContain("Selected Batch")
    expect(scheduleHtml).toContain("Select Batch")
    expect(scheduleHtml).toContain("PKR 425,000")

    const ctaHtml = renderToStaticMarkup(
      React.createElement(UmrahPackageBookingCta, {
        pkg: {
          id: pkg.id,
          slug: pkg.slug,
          title: pkg.title,
          durationDays: pkg.durationDays,
          sharingPricePkr: 0,
          quadPricePkr: 425000,
          triplePricePkr: 465000,
          doublePricePkr: 0,
          infantPricePkr: 72000,
          giftedInclusions: pkg.giftedInclusions,
          multiHotelOptions: pkg.multiHotelOptions,
          departures: pkg.departures,
        },
        agencyWhatsapp: "0327 4029701",
      })
    )

    expect(ctaHtml).toContain('id="reserve-seats"')
    expect(ctaHtml).toContain("Sharing Bed")
    expect(ctaHtml).toContain("Quad (4-Bed)")
    expect(ctaHtml).toContain("Triple (3-Bed)")
    expect(ctaHtml).toContain("Double (2-Bed)")
    expect(ctaHtml).toContain("On Request")
    expect(ctaHtml).toContain('disabled=""')
    expect(ctaHtml).not.toContain("PKR 0")
    expect(ctaHtml).toContain('aria-label="Decrease Adults"')
    expect(ctaHtml).toContain('aria-label="Increase Adults"')
    expect(ctaHtml).toContain('aria-label="Decrease Children"')
    expect(ctaHtml).toContain('aria-label="Increase Children"')
    expect(ctaHtml).toContain('aria-label="Decrease Infants"')
    expect(ctaHtml).toContain('aria-label="Increase Infants"')
    // Default 2 Adults x 425,000 = PKR 850,000
    expect(ctaHtml).toContain("PKR 850,000")
    expect(ctaHtml).toContain("0 hotel beds, 0 vehicle seats")
    expect(ctaHtml).toMatch(/https:\/\/wa\.me\/923274029701\?text=/)
    expect(ctaHtml).toContain("Enter Pilgrim Details")
  })
})
