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
  deleteHotel,
  reorderCatalogEntities,
  updateAgencySettings,
  updateHotelGalleryUrls,
  upsertAirline,
  upsertHajjPackage,
  upsertHotel,
} from "../../../app/actions/catalog"
import {
  deleteFaq,
  reorderCmsEntities,
  upsertFaq,
  upsertHeroSlide,
} from "../../../app/actions/cms"
import { resolveSettingsTab } from "../../../components/admin/settings/safe-settings-dto"
import { resolveCatalogTab } from "../../../components/admin/hubs/catalog-hub-client"

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
    "x-forwarded-for": "203.0.113.99",
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

  return workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, fn)
  )
}

describe("F-ADMIN T-091: Zod UUID/URL Validation, 23505 Unique Collision Handling, SortOrder Reordering & Settings/Catalog Tab Aliases", () => {
  const createdUserIds: string[] = []
  const createdAirlineIds: string[] = []
  const createdHajjIds: string[] = []
  const createdFaqIds: string[] = []
  let superCookie = ""

  before(async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const email = `f-admin-t091-${suffix}@alramlahtravels.com`
    const password = `SuperPass!${crypto.randomBytes(8).toString("hex")}`
    const admin = await provisionStaffAccountInternal({
      email,
      password,
      name: "F-ADMIN T-091 Super Admin",
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(admin.id)
    superCookie = await signInAndExtractCookie(email, password)
  })

  after(async () => {
    if (createdAirlineIds.length > 0) {
      await db
        .delete(schema.airlines)
        .where(inArray(schema.airlines.id, createdAirlineIds))
    }
    if (createdHajjIds.length > 0) {
      await db
        .delete(schema.hajjPackages)
        .where(inArray(schema.hajjPackages.id, createdHajjIds))
    }
    if (createdFaqIds.length > 0) {
      await db.delete(schema.faqs).where(inArray(schema.faqs.id, createdFaqIds))
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

  it("T-091a: rejects malformed UUIDs and blocks javascript:/data:/vbscript: URLs across Catalog & CMS actions", async () => {
    const badDeleteHotel = await runActionWithCookie(superCookie, () =>
      deleteHotel("not-a-valid-uuid")
    )
    assert.equal(badDeleteHotel.success, false)

    const badDeleteFaq = await runActionWithCookie(superCookie, () =>
      deleteFaq("12345")
    )
    assert.equal(badDeleteFaq.success, false)

    const xssHeroSlide = await runActionWithCookie(superCookie, () =>
      upsertHeroSlide({
        title: "XSS Slide",
        subtitle: "Dangerous CTA",
        ctaLabel: "Click Me",
        ctaHref: "javascript:alert(document.cookie)",
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(xssHeroSlide.success, false)

    const dataUriGallery = await runActionWithCookie(superCookie, () =>
      updateHotelGalleryUrls({
        hotelId: crypto.randomUUID(),
        galleryUrls: ["data:text/html,<script>alert(1)</script>"],
      })
    )
    assert.equal(dataUriGallery.success, false)

    const xssHotelImage = await runActionWithCookie(superCookie, () =>
      upsertHotel({
        name: "Unsafe Image Hotel",
        city: "makkah",
        starRating: 5,
        distanceMeters: 100,
        distanceBand: "haram_front",
        walkingMinutes: 2,
        isShuttleRequired: false,
        doubleRoomPriceSar: 500,
        tripleRoomPriceSar: 600,
        quadRoomPriceSar: 700,
        sharingBedPriceSar: 200,
        breakfastPriceSar: 50,
        halfBoardPriceSar: 90,
        fullBoardPriceSar: 130,
        imageUrl: "vbscript:msgbox(1)",
        amenities: [],
        galleryUrls: [],
        isFeatured: false,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(xssHotelImage.success, false)

    const xssSettingsSocial = await runActionWithCookie(superCookie, () =>
      updateAgencySettings({
        agencyName: "Al Ramlah Travels",
        tagline: "Sacred Journeys",
        primaryWhatsapp: "+923274029701",
        supportEmail: "info@alramlahtravels.com",
        officeAddress: "Lahore Cantt",
        facebookUrl: "javascript:alert(1)",
        workingHours: "Mon-Sat",
        slaOverdueHours: 24,
        sarToPkrRate: 75,
      })
    )
    assert.equal(xssSettingsSocial.success, false)
  })

  it("T-091b: catches Postgres 23505 unique constraint collisions cleanly without leaking raw SQL", async () => {
    const codeSuffix = crypto.randomBytes(2).toString("hex").toUpperCase().slice(0, 2)
    const uniqueIata = `Z${codeSuffix}`

    const firstAirline = await runActionWithCookie(superCookie, () =>
      upsertAirline({
        iataCode: uniqueIata,
        name: `F-ADMIN Primary Carrier ${uniqueIata}`,
        logoUrl: "",
        isDirectAvailable: true,
        isConnectingAvailable: true,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(firstAirline.success, true)
    if (firstAirline.success) {
      createdAirlineIds.push(firstAirline.data.id)
    }

    const duplicateAirline = await runActionWithCookie(superCookie, () =>
      upsertAirline({
        iataCode: uniqueIata,
        name: "Colliding Duplicate Carrier",
        logoUrl: "",
        isDirectAvailable: true,
        isConnectingAvailable: true,
        isActive: true,
        sortOrder: 1,
      })
    )
    assert.equal(duplicateAirline.success, false)
    if (!duplicateAirline.success) {
      assert.equal("code" in duplicateAirline ? duplicateAirline.code : "", "DUPLICATE_VALUE")
      assert.ok(!duplicateAirline.error.toLowerCase().includes("failed query:"))
    }

    const duplicateSlug = `f-admin-dup-hajj-${codeSuffix.toLowerCase()}`
    const firstHajj = await runActionWithCookie(superCookie, () =>
      upsertHajjPackage({
        slug: duplicateSlug,
        title: "First Hajj Tier",
        seasonYear: 2027,
        maktabTier: "B",
        durationDays: 20,
        makkahHotelName: "Makkah Hotel",
        makkahDistanceLabel: "300m",
        madinahHotelName: "Madinah Hotel",
        madinahDistanceLabel: "200m",
        indicativeSharingPkr: 1950000,
        isIndicative: true,
        regulatoryDisclaimer: "Indicative 2027 Pre-Registration.",
        highlights: [],
        isFeatured: false,
        isActive: true,
        sortOrder: 0,
      })
    )
    assert.equal(firstHajj.success, true)
    if (firstHajj.success) {
      createdHajjIds.push(firstHajj.data.id)
    }

    const secondHajj = await runActionWithCookie(superCookie, () =>
      upsertHajjPackage({
        slug: duplicateSlug,
        title: "Duplicate Slug Hajj Tier",
        seasonYear: 2027,
        maktabTier: "B",
        durationDays: 20,
        makkahHotelName: "Makkah Hotel",
        makkahDistanceLabel: "300m",
        madinahHotelName: "Madinah Hotel",
        madinahDistanceLabel: "200m",
        indicativeSharingPkr: 1950000,
        isIndicative: true,
        regulatoryDisclaimer: "Indicative 2027 Pre-Registration.",
        highlights: [],
        isFeatured: false,
        isActive: true,
        sortOrder: 1,
      })
    )
    assert.equal(secondHajj.success, false)
    if (!secondHajj.success) {
      assert.equal("code" in secondHajj ? secondHajj.code : "", "DUPLICATE_VALUE")
    }
  })

  it("T-091c: persists sortOrder reordering across Catalog & CMS entities and resolves Settings/Catalog URL tab aliases", async () => {
    // Settings `?tab=` alias map (`?tab=waba|devices|social|gotenberg|users|health|agency`)
    assert.equal(resolveSettingsTab("waba"), "whatsapp")
    assert.equal(resolveSettingsTab("devices"), "whatsapp")
    assert.equal(resolveSettingsTab("whatsapp"), "whatsapp")
    assert.equal(resolveSettingsTab("social"), "connections")
    assert.equal(resolveSettingsTab("connections"), "connections")
    assert.equal(resolveSettingsTab("gotenberg"), "infrastructure")
    assert.equal(resolveSettingsTab("infrastructure"), "infrastructure")
    assert.equal(resolveSettingsTab("users"), "staff")
    assert.equal(resolveSettingsTab("staff"), "staff")
    assert.equal(resolveSettingsTab("health"), "health")
    assert.equal(resolveSettingsTab("agency"), "agency")
    assert.equal(resolveSettingsTab("unknown-tab"), "connections")

    // Catalog `?tab=` alias map
    assert.deepEqual(resolveCatalogTab("messages"), { tab: "messages" })
    assert.deepEqual(resolveCatalogTab("inquiries"), { tab: "messages" })
    assert.deepEqual(resolveCatalogTab("hajj"), { tab: "hajj" })
    assert.deepEqual(resolveCatalogTab("hajj-2027"), { tab: "hajj" })
    assert.deepEqual(resolveCatalogTab("content"), { tab: "cms" })
    assert.deepEqual(resolveCatalogTab("gallery"), {
      tab: "cms",
      cmsSubTab: "gallery",
    })
    assert.deepEqual(resolveCatalogTab("invalid"), { tab: "hotels" })

    // CMS & Catalog sortOrder persistence
    const suffix = crypto.randomBytes(3).toString("hex")
    const faqA = await runActionWithCookie(superCookie, () =>
      upsertFaq({
        category: "visa",
        question: `F-ADMIN FAQ Alpha ${suffix}?`,
        answer: "Answer Alpha.",
        isActive: true,
        sortOrder: 10,
      })
    )
    const faqB = await runActionWithCookie(superCookie, () =>
      upsertFaq({
        category: "visa",
        question: `F-ADMIN FAQ Beta ${suffix}?`,
        answer: "Answer Beta.",
        isActive: true,
        sortOrder: 20,
      })
    )
    assert.equal(faqA.success, true)
    assert.equal(faqB.success, true)
    if (!faqA.success || !faqB.success) return
    createdFaqIds.push(faqA.data.id, faqB.data.id)

    const reorderCms = await runActionWithCookie(superCookie, () =>
      reorderCmsEntities({
        entityType: "faqs",
        orderedIds: [faqB.data.id, faqA.data.id],
      })
    )
    assert.equal(reorderCms.success, true)

    const [afterB] = await db
      .select()
      .from(schema.faqs)
      .where(eq(schema.faqs.id, faqB.data.id))
    const [afterA] = await db
      .select()
      .from(schema.faqs)
      .where(eq(schema.faqs.id, faqA.data.id))
    assert.equal(afterB?.sortOrder, 0)
    assert.equal(afterA?.sortOrder, 1)

    if (createdAirlineIds.length >= 1) {
      const reorderCatalog = await runActionWithCookie(superCookie, () =>
        reorderCatalogEntities({
          entityType: "airlines",
          orderedIds: [createdAirlineIds[0]!],
        })
      )
      assert.equal(reorderCatalog.success, true)
    }
  })
})
