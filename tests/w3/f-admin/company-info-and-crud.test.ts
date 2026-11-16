import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, before, describe, it } from "node:test"
import { eq, inArray } from "drizzle-orm"
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
import { POST as authPostHandler } from "../../../app/api/auth/[...all]/route"
import {
  buildWhatsappUrl,
  DEFAULT_COMPANY_INFO,
  getCompanyInfo,
  normalizeWhatsappNumber,
} from "../../../lib/company-info"
import {
  deleteHajjPackage,
  deleteHotel,
  deleteZiyaratPlace,
  getSystemConfigHealthAction,
  toggleHajjPackageActive,
  updateAgencySettings,
  updateHotelGalleryUrls,
  upsertHajjPackage,
  upsertHotel,
  upsertZiyaratPlace,
} from "../../../app/actions/catalog"
import { evaluateSystemConfigHealth } from "../../../components/admin/settings/config-health"

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

async function runActionWithCookie<T>(cookieHeader: string, fn: () => Promise<T>): Promise<T> {
  const rawHeaders = new Headers({
    cookie: cookieHeader,
    host: "localhost:3000",
    "x-forwarded-for": "203.0.113.88",
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies)

  const workStore: WorkStore = {
    page: "/admin/(dashboard)/settings/page",
    route: "/admin/settings",
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
    url: { pathname: "/admin/settings", search: "" },
    headers: sealedHeaders,
    cookies: sealedCookies,
    mutableCookies,
    userspaceMutableCookies: mutableCookies,
    draftMode: { isEnabled: false } as RequestStore["draftMode"],
    rootParams: {},
    resumeDataCache: null,
  }

  return workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, fn)
  )
}

describe("F-ADMIN T-077, OD-09e & OD-10: CompanyInfo Lahore HQ SSoT, Hajj 2027/Gallery/Ziyarat/Governance CRUD & Config Health", () => {
  const createdUserIds: string[] = []
  const createdHajjIds: string[] = []
  const createdHotelIds: string[] = []
  const createdZiyaratIds: string[] = []
  let superCookie = ""
  let originalSettings: typeof schema.agencySettings.$inferSelect | undefined

  before(async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const email = `f-admin-t077-${suffix}@alramlahtravels.com`
    const password = `SuperPass!${crypto.randomBytes(8).toString("hex")}`
    const admin = await provisionStaffAccountInternal({
      email,
      password,
      name: "F-ADMIN T-077 Super Admin",
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(admin.id)
    superCookie = await signInAndExtractCookie(email, password)

    const [snap] = await db
      .select()
      .from(schema.agencySettings)
      .where(eq(schema.agencySettings.id, "default"))
      .limit(1)
    originalSettings = snap
  })

  after(async () => {
    if (originalSettings) {
      await db
        .update(schema.agencySettings)
        .set({
          agencyName: originalSettings.agencyName,
          legalEntityName: originalSettings.legalEntityName,
          tagline: originalSettings.tagline,
          primaryWhatsapp: originalSettings.primaryWhatsapp,
          secondaryPhone: originalSettings.secondaryPhone,
          supportEmail: originalSettings.supportEmail,
          officeAddress: originalSettings.officeAddress,
          dtsLicense: originalSettings.dtsLicense,
          moraLicense: originalSettings.moraLicense,
          iataCode: originalSettings.iataCode,
          ntnNumber: originalSettings.ntnNumber,
          bankName: originalSettings.bankName,
          accountTitle: originalSettings.accountTitle,
          officialIban: originalSettings.officialIban,
          ibanVerified: originalSettings.ibanVerified,
          sarToPkrRate: originalSettings.sarToPkrRate,
          updatedAt: originalSettings.updatedAt,
        })
        .where(eq(schema.agencySettings.id, "default"))
    }
    if (createdHajjIds.length > 0) {
      await db
        .delete(schema.hajjPackages)
        .where(inArray(schema.hajjPackages.id, createdHajjIds))
    }
    if (createdHotelIds.length > 0) {
      await db.delete(schema.hotels).where(inArray(schema.hotels.id, createdHotelIds))
    }
    if (createdZiyaratIds.length > 0) {
      await db
        .delete(schema.ziyaratPlaces)
        .where(inArray(schema.ziyaratPlaces.id, createdZiyaratIds))
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

  it("T-077a: DEFAULT_COMPANY_INFO & buildWhatsappUrl enforce verified Askari 10 Lahore HQ and E.164 wa.me links", () => {
    assert.equal(
      DEFAULT_COMPANY_INFO.officeAddress,
      "Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan"
    )
    assert.equal(DEFAULT_COMPANY_INFO.primaryWhatsapp, "+92 327 4029701")
    assert.equal(DEFAULT_COMPANY_INFO.secondaryPhone, "+92 319 0462638")
    assert.equal(DEFAULT_COMPANY_INFO.ibanVerified, false)
    assert.equal(DEFAULT_COMPANY_INFO.dtsLicense, null)
    assert.equal(DEFAULT_COMPANY_INFO.moraLicense, null)

    assert.equal(normalizeWhatsappNumber("03274029701"), "923274029701")
    assert.equal(normalizeWhatsappNumber("+92 (0) 319-0462638"), "923190462638")
    assert.equal(buildWhatsappUrl("03274029701"), "https://wa.me/923274029701")
    assert.equal(
      buildWhatsappUrl("03274029701", "Assalamu Alaikum"),
      "https://wa.me/923274029701?text=Assalamu%20Alaikum"
    )
  })

  it("T-077b: supports full CRUD for Hajj 2027 Pre-Registration packages, Hotel Gallery URLs, Ziyarat items, and Agency Regulatory/IBAN SSoT", async () => {
    const suffix = crypto.randomBytes(3).toString("hex")

    // 1. Hajj 2027 Indicative Pre-Registration CRUD
    const createHajj = await runActionWithCookie(superCookie, () =>
      upsertHajjPackage({
        slug: `f-admin-hajj-crud-${suffix}`,
        title: `Executive Maktab A (${suffix})`,
        seasonYear: 2027,
        maktabTier: "A",
        durationDays: 18,
        makkahHotelName: "Swissotel Al Maqam",
        makkahDistanceLabel: "0m Haram Courtyard",
        madinahHotelName: "Anwar Al Madinah Movenpick",
        madinahDistanceLabel: "50m Ladies Gate",
        aziziyahStayNotes: "Shifting apartment near Jamarat",
        indicativeSharingPkr: 2350000,
        indicativeQuadPkr: 2500000,
        indicativeTriplePkr: 2750000,
        indicativeDoublePkr: 3100000,
        isIndicative: true,
        regulatoryDisclaimer:
          "Indicative 2027 Pre-Registration — final Maktab tariff subject to Saudi Ministry & Pakistan MORA quota announcement.",
        highlights: ["Maktab A Mina", "Haramain High-Speed Train"],
        isFeatured: true,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(createHajj.success, true)
    if (!createHajj.success) return
    createdHajjIds.push(createHajj.data.id)
    assert.equal(createHajj.data.isIndicative, true)
    assert.equal(createHajj.data.seasonYear, 2027)

    const toggleHajj = await runActionWithCookie(superCookie, () =>
      toggleHajjPackageActive(createHajj.data.id, false)
    )
    assert.equal(toggleHajj.success, true)

    const removeHajj = await runActionWithCookie(superCookie, () =>
      deleteHajjPackage(createHajj.data.id)
    )
    assert.equal(removeHajj.success, true)

    // 2. Hotel + Multi-Photo Property Gallery CRUD
    const createHotel = await runActionWithCookie(superCookie, () =>
      upsertHotel({
        name: `F-ADMIN Gallery Hotel ${suffix}`,
        city: "makkah",
        starRating: 5,
        distanceMeters: 80,
        distanceLabel: "80m Haram Courtyard",
        accessType: "walking",
        imageUrl: "https://alramlahtravels.com/images/lobby-cover.jpg",
        galleryUrls: ["https://alramlahtravels.com/images/lobby-1.jpg"],
        amenities: ["Kaaba View", "Executive Lounge"],
        doublePriceSar: 800,
        triplePriceSar: 900,
        quadPriceSar: 1000,
        sharingPriceSar: 280,
        isFeatured: true,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(createHotel.success, true)
    if (!createHotel.success) return
    createdHotelIds.push(createHotel.data.id)

    const galleryUpdate = await runActionWithCookie(superCookie, () =>
      updateHotelGalleryUrls({
        hotelId: createHotel.data.id,
        galleryUrls: [
          "https://alramlahtravels.com/images/haram-suite.jpg",
          "https://alramlahtravels.com/images/dining-hall.jpg",
        ],
      })
    )
    assert.equal(galleryUpdate.success, true)
    if (galleryUpdate.success) {
      assert.deepEqual(galleryUpdate.data.galleryUrls, [
        "https://alramlahtravels.com/images/haram-suite.jpg",
        "https://alramlahtravels.com/images/dining-hall.jpg",
      ])
    }

    await runActionWithCookie(superCookie, () => deleteHotel(createHotel.data.id))

    // 3. Ziyarat Master CRUD
    const createZiyarat = await runActionWithCookie(superCookie, () =>
      upsertZiyaratPlace({
        city: "madinah",
        name: `F-ADMIN Masjid Quba ${suffix}`,
        arabicName: "مسجد قباء",
        description: "First mosque in Islamic history",
        isIncludedDefault: true,
        additionalFeeSar: 0,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(createZiyarat.success, true)
    if (createZiyarat.success) {
      createdZiyaratIds.push(createZiyarat.data.id)
      const delZ = await runActionWithCookie(superCookie, () =>
        deleteZiyaratPlace(createZiyarat.data.id)
      )
      assert.equal(delZ.success, true)
    }

    // 4. Agency Settings Regulatory/IBAN Governance + `getCompanyInfo()` SSoT
    const invalidIbanRes = await runActionWithCookie(superCookie, () =>
      updateAgencySettings({
        agencyName: "Al Ramlah Travels",
        tagline: "Sacred Journeys",
        primaryWhatsapp: "+92 327 4029701",
        supportEmail: "info@alramlahtravels.com",
        officeAddress:
          "Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt",
        workingHours: "Mon - Sat: 10:00 AM - 7:00 PM PKT",
        slaOverdueHours: 24,
        sarToPkrRate: 75,
        officialIban: "INVALID-IBAN-123",
        ibanVerified: true,
      })
    )
    assert.equal(invalidIbanRes.success, false)

    const validGovernanceRes = await runActionWithCookie(superCookie, () =>
      updateAgencySettings({
        agencyName: "Al Ramlah Travels",
        legalEntityName: "Al Ramlah Travels & Tours (Pvt.) Ltd.",
        tagline: "Trusted Umrah & Hajj Services",
        primaryWhatsapp: "03274029701",
        secondaryPhone: "+92 319 0462638",
        supportEmail: "info@alramlahtravels.com",
        officeAddress:
          "Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt",
        workingHours: "Mon - Sat: 10:00 AM - 7:00 PM PKT",
        slaOverdueHours: 24,
        sarToPkrRate: 75.5,
        dtsLicense: "DTS-LHR-9988",
        moraLicense: "MORA-2027-441",
        iataCode: "27300112",
        ntnNumber: "7654321-8",
        bankName: "Meezan Bank Limited",
        accountTitle: "Al Ramlah Travels & Tours (Pvt.) Ltd.",
        officialIban: "pk36 mezn 0000 0001 2345 6789",
        ibanVerified: true,
      })
    )
    assert.equal(validGovernanceRes.success, true)
    if (!validGovernanceRes.success) return

    const resolvedInfo = getCompanyInfo(validGovernanceRes.data)
    assert.equal(resolvedInfo.legalEntityName, "Al Ramlah Travels & Tours (Pvt.) Ltd.")
    assert.equal(resolvedInfo.dtsLicense, "DTS-LHR-9988")
    assert.equal(resolvedInfo.moraLicense, "MORA-2027-441")
    assert.equal(resolvedInfo.iataCode, "27300112")
    assert.equal(resolvedInfo.ntnNumber, "7654321-8")
    assert.equal(resolvedInfo.officialIban, "PK36MEZN0000000123456789")
    assert.equal(resolvedInfo.ibanVerified, true)
    assert.equal(resolvedInfo.normalizedWhatsapp, "923274029701")
    assert.equal(resolvedInfo.whatsappUrl.startsWith("https://wa.me/923274029701"), true)
  })

  it("T-077c: Config Health evaluates 9 subsystems strictly as booleans with zero secret values exposed", async () => {
    const secretCanary = "a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00"
    const syntheticHealth = evaluateSystemConfigHealth(
      {
        NODE_ENV: "production",
        DATABASE_URL: `postgresql://user:${secretCanary}@127.0.0.1:54329/audit`,
        DATABASE_URL_POOLED: `postgresql://user:${secretCanary}@127.0.0.1:54329/audit`,
        BETTER_AUTH_SECRET: `${secretCanary}_LONG_32_CHAR_AUTH_SECRET_VALUE`,
        BETTER_AUTH_URL: "https://alramlahtravels.com",
        NEXT_PUBLIC_APP_URL: "https://alramlahtravels.com",
        ENCRYPTION_KEY: secretCanary,
        TOKEN_ENCRYPTION_KEY: secretCanary,
        R2_ACCOUNT_ID: secretCanary,
        R2_ACCESS_KEY_ID: secretCanary,
        R2_SECRET_ACCESS_KEY: secretCanary,
        R2_BUCKET_NAME: "al-ramlah-private",
        GOTENBERG_API_URL: "https://pdf.alramlahtravels.com",
        GOTENBERG_API_KEY: secretCanary,
        RESEND_API_KEY: secretCanary,
        EMAIL_FROM: "noreply@alramlahtravels.com",
        META_APP_ID: "123456",
        META_APP_SECRET: secretCanary,
        FACEBOOK_CLIENT_ID: "fb-id",
        FACEBOOK_CLIENT_SECRET: secretCanary,
        TRIGGER_SECRET_KEY: secretCanary,
        OPENROUTER_API_KEY: secretCanary,
      },
      { activeWabaCount: 1, activeSocialCount: 2, ibanVerified: true }
    )

    assert.equal(syntheticHealth.subsystems.length, 9)
    assert.equal(syntheticHealth.readyCount, 9)
    const serialized = JSON.stringify(syntheticHealth)
    assert.ok(
      !serialized.includes(secretCanary),
      "ConfigHealthSnapshot must never include any secret value"
    )

    const liveActionHealth = await runActionWithCookie(superCookie, () =>
      getSystemConfigHealthAction()
    )
    assert.equal(liveActionHealth.success, true)
    assert.equal(liveActionHealth.data.subsystems.length, 9)
  })
})
