import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, before, describe, it } from "node:test"
import { eq, inArray, like } from "drizzle-orm"
import { NextRequest } from "next/server"
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external"
import type { WorkStore } from "next/dist/server/app-render/work-async-storage.external"
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external"
import type { RequestStore } from "next/dist/server/app-render/work-unit-async-storage.external"
import { HeadersAdapter } from "next/dist/server/web/spec-extension/adapters/headers"
import {
  MutableRequestCookiesAdapter,
  RequestCookiesAdapter,
} from "next/dist/server/web/spec-extension/adapters/request-cookies"
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies"
import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { provisionStaffAccountInternal } from "../../../lib/auth"
import { hashIp } from "../../../lib/rate-limit"
import { POST as authPostHandler } from "../../../app/api/auth/[...all]/route"
import {
  deleteAirline,
  deleteDepartureCity,
  deleteHajjPackage,
  deleteHotel,
  deleteTransportSector,
  deleteVehicle,
  deleteZiyaratPlace,
  inspectPgErrorCodeForDiagnostics,
  updateSarToPkrRate,
  updateVisaRate,
  upsertAirline,
  upsertDepartureCity,
  upsertHajjPackage,
  upsertHotel,
  upsertTransportSector,
  upsertVehicle,
  upsertZiyaratPlace,
} from "../../../app/actions/catalog"
import { submitContactMessage } from "../../../app/actions/cms"
import LegacyContentPage from "../../../app/admin/(dashboard)/content/page"
import LegacyFlightsPage from "../../../app/admin/(dashboard)/flights/page"
import LegacyGroupsPage from "../../../app/admin/(dashboard)/groups/page"
import LegacyHotelsPage from "../../../app/admin/(dashboard)/hotels/page"
import LegacyMessagesPage from "../../../app/admin/(dashboard)/messages/page"
import LegacyPostLookupPage from "../../../app/admin/(dashboard)/post-lookup/page"
import LegacyTransportPage from "../../../app/admin/(dashboard)/transport/page"
import LegacyUsersPage from "../../../app/admin/(dashboard)/users/page"
import LegacyVisaPage from "../../../app/admin/(dashboard)/visa/page"
import LegacyZiyaratPage from "../../../app/admin/(dashboard)/ziyarat/page"

if (process.env.NODE_ENV === "test") {
  for (const key of [
    "OPENROUTER_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "OPENAI_API_KEY",
    "COMPOSIO_API_KEY",
  ]) {
    process.env[key] = ""
  }
}
assertAuditSafeEnvironment()

async function signInAndExtractCookie(email: string, password: string): Promise<string> {
  const req = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 10}`,
    },
    body: JSON.stringify({ email, password }),
  })
  const res = await authPostHandler(req)
  assert.equal(res.status, 200)
  return res.headers
    .getSetCookie()
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

async function runActionWithContext<T>(
  cookieHeader: string,
  fn: () => Promise<T>,
  clientIp = "203.0.113.77"
): Promise<{ result: T; revalidatedTags: string[] }> {
  const rawHeaders = new Headers({
    cookie: cookieHeader,
    host: "localhost:3000",
    "x-forwarded-for": clientIp,
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies)

  const workStore: WorkStore = {
    page: "/admin/(dashboard)/catalog/page",
    route: "/admin/catalog",
    incrementalCache: {} as WorkStore["incrementalCache"],
    cacheLifeProfiles: {},
    useCacheTimeout: 300_000,
    durableUseCacheEntries: false,
    staticPageGenerationTimeout: 60,
    afterContext: undefined as unknown as WorkStore["afterContext"],
    previouslyRevalidatedTags: [],
    pendingRevalidatedTags: [],
    requestStartTime: performance.timeOrigin + performance.now(),
    refreshTagsByCacheKind: new Map(),
    shouldTrackFetchMetrics: false,
    clientComponentLoadTracker: undefined,
  }

  const requestStore: RequestStore = {
    type: "request",
    phase: "action",
    implicitTags: { tags: [], expirationsByCacheKind: new Map() },
    url: { pathname: "/admin/catalog", search: "" },
    headers: sealedHeaders,
    cookies: sealedCookies,
    mutableCookies,
    userspaceMutableCookies: mutableCookies,
    draftMode: { isEnabled: false } as RequestStore["draftMode"],
    rootParams: {},
    resumeDataCache: null,
  }

  const result = await workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, fn)
  )

  return {
    result,
    revalidatedTags: (workStore.pendingRevalidatedTags ?? []).map((t) => t.tag),
  }
}

function extractRedirectTarget(fn: () => unknown): string {
  try {
    fn()
    assert.fail("Expected Next.js redirect() to throw NEXT_REDIRECT")
  } catch (err: unknown) {
    const digest =
      err && typeof err === "object" && "digest" in err && typeof err.digest === "string"
        ? err.digest
        : ""
    assert.ok(digest.startsWith("NEXT_REDIRECT;"), `Unexpected redirect digest: ${digest}`)
    const parts = digest.split(";")
    return parts[2] ?? ""
  }
}

describe("F-ADMIN T-076: Drizzle 23503 Soft-Deactivation, Public Contact Rate-Limit, Legacy Redirects, Visa Unlock & Revalidation", () => {
  const createdUserIds: string[] = []
  const createdApplicationIds: string[] = []
  const createdHotelIds: string[] = []
  const createdAirlineIds: string[] = []
  const createdCityIds: string[] = []
  const createdVehicleIds: string[] = []
  const createdSectorIds: string[] = []
  const createdZiyaratIds: string[] = []
  const createdHajjIds: string[] = []
  const createdMessageIds: string[] = []
  const rateLimitKeys: string[] = []

  let superCookie = ""
  let originalSettings: typeof schema.agencySettings.$inferSelect | undefined
  let originalVisaRows: Array<typeof schema.visaRates.$inferSelect> = []

  before(async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const email = `f-admin-t076-${suffix}@alramlahtravels.com`
    const password = `SuperPass!${crypto.randomBytes(8).toString("hex")}`
    const admin = await provisionStaffAccountInternal({
      email,
      password,
      name: "F-ADMIN T-076 Super Admin",
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(admin.id)
    superCookie = await signInAndExtractCookie(email, password)

    const [settingsSnap] = await db
      .select()
      .from(schema.agencySettings)
      .where(eq(schema.agencySettings.id, "default"))
      .limit(1)
    originalSettings = settingsSnap
    originalVisaRows = await db.select().from(schema.visaRates)
  })

  after(async () => {
    // Restore visa_rates & agency_settings snapshots
    if (originalSettings) {
      await db
        .update(schema.agencySettings)
        .set({
          sarToPkrRate: originalSettings.sarToPkrRate,
          updatedAt: originalSettings.updatedAt,
        })
        .where(eq(schema.agencySettings.id, "default"))
    }
    for (const row of originalVisaRows) {
      await db
        .update(schema.visaRates)
        .set({
          label: row.label,
          maxDays: row.maxDays,
          pricePkr: row.pricePkr,
          priceSar: row.priceSar,
          withoutMasarPriceSar: row.withoutMasarPriceSar,
          withMasar10DaysSar: row.withMasar10DaysSar,
          withMasar15DaysSar: row.withMasar15DaysSar,
          withMasar21DaysSar: row.withMasar21DaysSar,
          withMasar28DaysSar: row.withMasar28DaysSar,
          notes: row.notes,
        })
        .where(eq(schema.visaRates.id, row.id))
    }

    if (createdApplicationIds.length > 0) {
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdApplicationIds))
    }
    if (createdHotelIds.length > 0) {
      await db.delete(schema.hotels).where(inArray(schema.hotels.id, createdHotelIds))
    }
    if (createdAirlineIds.length > 0) {
      await db
        .delete(schema.airlines)
        .where(inArray(schema.airlines.id, createdAirlineIds))
    }
    if (createdCityIds.length > 0) {
      await db
        .delete(schema.departureCities)
        .where(inArray(schema.departureCities.id, createdCityIds))
    }
    if (createdSectorIds.length > 0) {
      await db
        .delete(schema.transportSectors)
        .where(inArray(schema.transportSectors.id, createdSectorIds))
    }
    if (createdVehicleIds.length > 0) {
      await db
        .delete(schema.vehicles)
        .where(inArray(schema.vehicles.id, createdVehicleIds))
    }
    if (createdZiyaratIds.length > 0) {
      await db
        .delete(schema.ziyaratPlaces)
        .where(inArray(schema.ziyaratPlaces.id, createdZiyaratIds))
    }
    if (createdHajjIds.length > 0) {
      await db
        .delete(schema.hajjPackages)
        .where(inArray(schema.hajjPackages.id, createdHajjIds))
    }
    if (createdMessageIds.length > 0) {
      await db
        .delete(schema.contactMessages)
        .where(inArray(schema.contactMessages.id, createdMessageIds))
    }
    for (const prefix of rateLimitKeys) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${hashIp(prefix)}%`))
    }
    if (createdUserIds.length > 0) {
      await db
        .delete(schema.session)
        .where(inArray(schema.session.userId, createdUserIds))
      await db
        .delete(schema.account)
        .where(inArray(schema.account.userId, createdUserIds))
      await db.delete(schema.user).where(inArray(schema.user.id, createdUserIds))
    }
    await closeDatabasePool()
  })

  it("T-076a: unwraps nested DrizzleQueryError.cause Postgres 23503 FK errors and soft-deactivates referenced catalog entities cleanly", async () => {
    const nestedDrizzleError = new Error("Failed query: delete from hotels where id = $1", {
      cause: Object.assign(new Error("update or delete on table violates foreign key constraint"), {
        code: "23503",
      }),
    })
    assert.equal(await inspectPgErrorCodeForDiagnostics(nestedDrizzleError), "23503")

    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase()

    // Create 7 catalog entities
    const { result: hotelRes, revalidatedTags } = await runActionWithContext(
      superCookie,
      () =>
        upsertHotel({
          name: `F-ADMIN FK Hotel ${suffix}`,
          city: "makkah",
          starRating: 5,
          distanceMeters: 150,
          distanceLabel: "150m to Masjid al-Haram",
          accessType: "walking",
          imageUrl: "https://alramlahtravels.com/images/makkah-hotel.jpg",
          galleryUrls: [],
          amenities: ["WiFi"],
          allowsSharedRooms: true,
          allowsPrivateRooms: true,
          availableRoomTypes: ["double", "triple", "quad"],
          offersDining: true,
          availableMealPlans: ["room_only", "breakfast", "half_board", "full_board"],
          breakfastPriceSarPerPax: 60,
          lunchPriceSarPerPax: 50,
          dinnerPriceSarPerPax: 60,
          fullBoardPriceSarPerPax: 150,
          sharingPriceSar: 220,
          roomPriceSar: 600,
          quadPriceSar: 850,
          triplePriceSar: 750,
          doublePriceSar: 650,
          isFeatured: false,
          isActive: true,
          sortOrder: 0,
        })
    )
    assert.equal(hotelRes.success, true)
    if (!hotelRes.success) return
    createdHotelIds.push(hotelRes.data.id)

    // Verify `/`, `/admin/catalog`, and `/admin/settings` revalidation tags
    assert.ok(revalidatedTags.some((tag) => tag.endsWith("/")))
    assert.ok(revalidatedTags.some((tag) => tag.endsWith("/admin/catalog")))
    assert.ok(revalidatedTags.some((tag) => tag.endsWith("/admin/settings")))

    const { result: airlineRes } = await runActionWithContext(superCookie, () =>
      upsertAirline({
        iataCode: `F${suffix.slice(0, 2)}`,
        name: `F-ADMIN Air ${suffix}`,
        logoUrl: "",
        isDirectAvailable: true,
        isConnectingAvailable: true,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(airlineRes.success, true)
    if (!airlineRes.success) return
    createdAirlineIds.push(airlineRes.data.id)

    const alphaCode = `Q${Array.from(crypto.randomBytes(2), (b) => String.fromCharCode(65 + (b % 26))).join("")}`
    const { result: cityRes } = await runActionWithContext(superCookie, () =>
      upsertDepartureCity({
        airportCode: alphaCode,
        cityName: `F-ADMIN City ${suffix}`,
        airportName: `F-ADMIN Intl ${suffix}`,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(cityRes.success, true)
    if (!cityRes.success) return
    createdCityIds.push(cityRes.data.id)

    const { result: vehicleRes } = await runActionWithContext(superCookie, () =>
      upsertVehicle({
        name: `F-ADMIN GMC ${suffix}`,
        category: "suv",
        bookingMode: "private_only",
        seatCapacity: 6,
        luggageCapacity: 5,
        allowsCustomPickupTime: true,
        defaultRateSar: 450,
        ziyaratRateSar: 350,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(vehicleRes.success, true)
    if (!vehicleRes.success) return
    createdVehicleIds.push(vehicleRes.data.id)

    const { result: sectorRes } = await runActionWithContext(superCookie, () =>
      upsertTransportSector({
        code: `F_ADMIN_SEC_${suffix}`,
        label: `Jeddah -> Makkah ${suffix}`,
        originCity: "Jeddah",
        destinationCity: "Makkah",
        originType: "airport",
        destinationType: "hotel",
        supportsTrain: false,
        sharedBusRateSarPerPax: 25,
        isSharedBusEligible: false,
        terminalParkingFeeSar: 0,
        approxDurationMinutes: 75,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(sectorRes.success, true)
    if (!sectorRes.success) return
    createdSectorIds.push(sectorRes.data.id)

    const { result: ziyaratRes } = await runActionWithContext(superCookie, () =>
      upsertZiyaratPlace({
        city: "makkah",
        name: `F-ADMIN Jabal Noor ${suffix}`,
        arabicName: "جبل النور",
        description: "Historic cave of Hira",
        isIncludedDefault: true,
        additionalFeeSar: 0,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(ziyaratRes.success, true)
    if (!ziyaratRes.success) return
    createdZiyaratIds.push(ziyaratRes.data.id)

    const hajjSlug = `f-admin-hajj-${suffix.toLowerCase()}`
    const { result: hajjRes } = await runActionWithContext(superCookie, () =>
      upsertHajjPackage({
        slug: hajjSlug,
        title: `F-ADMIN Maktab A ${suffix}`,
        seasonYear: 2027,
        maktabTier: "A",
        durationDays: 21,
        makkahHotelName: "Clock Tower Makkah",
        makkahDistanceLabel: "0m Haram",
        madinahHotelName: "Oberoi Madinah",
        madinahDistanceLabel: "50m Masjid Nabawi",
        indicativeSharingPkr: 2450000,
        isIndicative: true,
        regulatoryDisclaimer:
          "Indicative 2027 Pre-Registration — final MORA/KSA quota & tariff subject to official announcement.",
        highlights: ["VIP Mina Camp"],
        isFeatured: true,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(hajjRes.success, true)
    if (!hajjRes.success) return
    createdHajjIds.push(hajjRes.data.id)

    // Reference ALL 7 entities via a real application + hotel stay + transport segment
    const [appRow] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-20261114-FA${suffix}`,
        source: "custom_builder",
        status: "pending_quote",
        presetMode: "complete_umrah",
        customerName: "F-ADMIN Reference Pilgrim",
        customerPhone: "+923274029701",
        customerWhatsapp: "+923274029701",
        customerCity: "Lahore",
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        preferredAirlineId: airlineRes.data.id,
        departureCityId: cityRes.data.id,
        ziyaratVehicleId: vehicleRes.data.id,
        selectedZiyaratPlaceIds: [ziyaratRes.data.id],
        hajjInquiryJson: {
          packageId: hajjRes.data.id,
          packageSlug: hajjSlug,
        },
      })
      .returning({ id: schema.applications.id })
    createdApplicationIds.push(appRow!.id)

    await db.insert(schema.applicationHotelStays).values({
      applicationId: appRow!.id,
      stayOrder: 1,
      city: "makkah",
      hotelId: hotelRes.data.id,
      checkInDate: "2027-01-10",
      checkOutDate: "2027-01-15",
      nights: 5,
      roomCategory: "private",
      mealPlan: "room_only",
    })

    await db.insert(schema.applicationTransportSegments).values({
      applicationId: appRow!.id,
      segmentOrder: 1,
      sectorId: sectorRes.data.id,
      serviceType: "private",
      vehicleId: vehicleRes.data.id,
      vehicleQuantity: 1,
    })

    // Deleting each referenced entity must NOT throw 500; each must soft-deactivate (`isActive = false`)
    const delHotel = (await runActionWithContext(superCookie, () => deleteHotel(hotelRes.data.id))).result
    assert.equal(delHotel.success, false)
    assert.equal("softDeleted" in delHotel && delHotel.softDeleted, true)
    const [hotelInDb] = await db.select().from(schema.hotels).where(eq(schema.hotels.id, hotelRes.data.id))
    assert.equal(hotelInDb?.isActive, false)

    const delAirline = (await runActionWithContext(superCookie, () => deleteAirline(airlineRes.data.id))).result
    assert.equal("softDeleted" in delAirline && delAirline.softDeleted, true)
    const [airlineInDb] = await db.select().from(schema.airlines).where(eq(schema.airlines.id, airlineRes.data.id))
    assert.equal(airlineInDb?.isActive, false)

    const delCity = (await runActionWithContext(superCookie, () => deleteDepartureCity(cityRes.data.id))).result
    assert.equal("softDeleted" in delCity && delCity.softDeleted, true)
    const [cityInDb] = await db.select().from(schema.departureCities).where(eq(schema.departureCities.id, cityRes.data.id))
    assert.equal(cityInDb?.isActive, false)

    const delSector = (await runActionWithContext(superCookie, () => deleteTransportSector(sectorRes.data.id))).result
    assert.equal("softDeleted" in delSector && delSector.softDeleted, true)
    const [sectorInDb] = await db.select().from(schema.transportSectors).where(eq(schema.transportSectors.id, sectorRes.data.id))
    assert.equal(sectorInDb?.isActive, false)

    const delVehicle = (await runActionWithContext(superCookie, () => deleteVehicle(vehicleRes.data.id))).result
    assert.equal("softDeleted" in delVehicle && delVehicle.softDeleted, true)
    const [vehicleInDb] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, vehicleRes.data.id))
    assert.equal(vehicleInDb?.isActive, false)

    const delZiyarat = (await runActionWithContext(superCookie, () => deleteZiyaratPlace(ziyaratRes.data.id))).result
    assert.equal("softDeleted" in delZiyarat && delZiyarat.softDeleted, true)
    const [ziyaratInDb] = await db.select().from(schema.ziyaratPlaces).where(eq(schema.ziyaratPlaces.id, ziyaratRes.data.id))
    assert.equal(ziyaratInDb?.isActive, false)

    const delHajj = (await runActionWithContext(superCookie, () => deleteHajjPackage(hajjRes.data.id))).result
    assert.equal("softDeleted" in delHajj && delHajj.softDeleted, true)
    const [hajjInDb] = await db.select().from(schema.hajjPackages).where(eq(schema.hajjPackages.id, hajjRes.data.id))
    assert.equal(hajjInDb?.isActive, false)

    // Unreferenced entity deletes hard-remove cleanly
    const { result: unrefHotel } = await runActionWithContext(superCookie, () =>
      upsertHotel({
        name: `F-ADMIN Unref Hotel ${suffix}`,
        city: "madinah",
        starRating: 4,
        distanceMeters: 250,
        distanceLabel: "250m to Masjid an-Nabawi",
        accessType: "walking",
        imageUrl: "https://alramlahtravels.com/images/madinah-hotel.jpg",
        galleryUrls: [],
        amenities: [],
        doublePriceSar: 400,
        triplePriceSar: 500,
        quadPriceSar: 600,
        sharingPriceSar: 160,
        isFeatured: false,
        isActive: true,
        sortOrder: 1,
      })
    )
    assert.equal(unrefHotel.success, true)
    if (unrefHotel.success) {
      const hardDel = (await runActionWithContext(superCookie, () => deleteHotel(unrefHotel.data.id))).result
      assert.equal(hardDel.success, true)
    }
  })

  it("T-076b: submitContactMessage uses .safeParse() + enforceRateLimit (5 per 15m per IP) without throwing uncaught Zod errors", async () => {
    const testIp = `203.0.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}`
    rateLimitKeys.push(testIp)

    // Invalid payload returns structured VALIDATION_ERROR without throwing
    const { result: invalidRes } = await runActionWithContext(
      "",
      () =>
        submitContactMessage({
          name: "A",
          email: "not-an-email",
          phone: "12",
          subject: "Hi",
          message: "Too short",
        }),
      testIp
    )
    assert.equal(invalidRes.success, false)
    if (!invalidRes.success && "code" in invalidRes) {
      assert.equal(invalidRes.code, "VALIDATION_ERROR")
    }

    // Remaining 4 allowed calls in the 5-call window succeed, 6th call is rate-limited
    for (let attempt = 2; attempt <= 5; attempt++) {
      const { result: okRes } = await runActionWithContext(
        "",
        () =>
          submitContactMessage({
            name: "Rate Limit Tester",
            email: "pilgrim@alramlahtravels.com",
            phone: "03274029701",
            subject: `Rate Limit Attempt ${attempt}`,
            message: "Checking public contact rate limiter under burst load.",
          }),
        testIp
      )
      assert.equal(okRes.success, true)
      if (okRes.success) {
        createdMessageIds.push(okRes.id)
      }
    }

    const { result: blockedRes } = await runActionWithContext(
      "",
      () =>
        submitContactMessage({
          name: "Burst Spammer",
          email: "spam@example.com",
          phone: "03274029701",
          subject: "6th Burst Message",
          message: "This sixth submission within 15m must be rate-limited.",
        }),
      testIp
    )
    assert.equal(blockedRes.success, false)
    if (!blockedRes.success && "code" in blockedRes) {
      assert.equal(blockedRes.code, "RATE_LIMITED")
    }
  })

  it("T-076c: verifies all 10 legacy /admin/* redirect stubs (including /admin/messages -> /admin/catalog?tab=messages) and Visa/Forex editors", async () => {
    assert.equal(extractRedirectTarget(() => LegacyMessagesPage()), "/admin/catalog?tab=messages")
    assert.equal(extractRedirectTarget(() => LegacyContentPage()), "/admin/catalog?tab=cms")
    assert.equal(extractRedirectTarget(() => LegacyHotelsPage()), "/admin/catalog?tab=hotels")
    assert.equal(extractRedirectTarget(() => LegacyVisaPage()), "/admin/catalog?tab=visa")
    assert.equal(extractRedirectTarget(() => LegacyTransportPage()), "/admin/catalog?tab=transport")
    assert.equal(extractRedirectTarget(() => LegacyZiyaratPage()), "/admin/catalog?tab=ziyarat")
    assert.equal(extractRedirectTarget(() => LegacyFlightsPage()), "/admin/catalog?tab=flights")
    assert.equal(extractRedirectTarget(() => LegacyUsersPage()), "/admin/settings?tab=staff")
    assert.equal(extractRedirectTarget(() => LegacyGroupsPage()), "/admin/studio?tab=packages")
    assert.equal(extractRedirectTarget(() => LegacyPostLookupPage()), "/admin/desk?lookup=1")

    // Visa empty-state tier upsert + maxDays persistence + SAR->PKR conversion editor
    const { result: visaRes } = await runActionWithContext(superCookie, () =>
      updateVisaRate({
        tier: "short_term",
        maxDays: 30,
        pricePkr: 43500,
        priceSar: 470,
        withoutMasarPriceSar: 470,
        withMasar10DaysSar: 500,
        withMasar15DaysSar: 515,
        withMasar21DaysSar: 530,
        withMasar28DaysSar: 545,
        label: "Standard Umrah Visa (Up to 30 Days)",
        notes: "Updated in T-076 verification",
      })
    )
    assert.equal(visaRes.success, true)
    if (visaRes.success) {
      assert.equal(visaRes.data.maxDays, 30)
      assert.equal(visaRes.data.pricePkr, 43500)
    }

    const { result: sarRes } = await runActionWithContext(superCookie, () =>
      updateSarToPkrRate({ sarToPkrRate: 76.25 })
    )
    assert.equal(sarRes.success, true)
    if (sarRes.success) {
      assert.equal(sarRes.data.sarToPkrRate, 76.25)
    }
  })
})
