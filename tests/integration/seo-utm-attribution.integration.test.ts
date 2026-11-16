import "next/dist/server/node-environment-baseline"
import crypto from "node:crypto"
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
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  submitCustomApplication,
  submitGroupBookingApplication,
  submitHajjInquiryApplication,
  submitPublicContactInquiryAction,
} from "../../app/actions/applications"
import { submitContactMessage } from "../../app/actions/cms"
import { exportApplicationsCsvAction } from "../../app/actions/quotes"
import { POST as authPostHandler } from "../../app/api/auth/[...all]/route"
import { db } from "../../db"
import * as schema from "../../db/schema"
import { provisionStaffAccountInternal } from "../../lib/auth"
import { hashIp } from "../../lib/rate-limit"
import { assertAuditSafeEnvironment } from "../helpers/audit-guard"

async function signInAndExtractCookie(
  email: string,
  password: string
): Promise<string> {
  const req = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 150) + 20}`,
    },
    body: JSON.stringify({ email, password }),
  })
  const res = await authPostHandler(req)
  expect(res.status).toBe(200)
  return res.headers
    .getSetCookie()
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

async function runInActionContext<T>(
  options: {
    cookieHeader?: string
    ipAddress?: string
    referer?: string
    pathname?: string
  },
  fn: () => Promise<T>
): Promise<T> {
  const headerInit: Record<string, string> = {
    host: "localhost:3000",
    "x-forwarded-for": options.ipAddress ?? "203.0.113.144",
  }
  if (options.cookieHeader) {
    headerInit.cookie = options.cookieHeader
  }
  if (options.referer) {
    headerInit.referer = options.referer
  }

  const rawHeaders = new Headers(headerInit)
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(
    reqCookies,
    () => undefined
  )

  const pathname = options.pathname ?? "/"

  const workStore: WorkStore = {
    page: "/(public)/page",
    route: pathname,
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
    url: { pathname, search: "" },
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

describe("SEO-026 / GB-07: Real PostgreSQL 7-Column Attribution Persistence & Formula-Safe CSV Export", () => {
  const createdUserIds: string[] = []
  const createdApplicationIds: string[] = []
  const createdContactIds: string[] = []
  const createdDepartureIds: string[] = []
  const createdPackageIds: string[] = []
  const usedIps = [
    "203.0.113.141",
    "203.0.113.142",
    "203.0.113.143",
    "203.0.113.144",
    "203.0.113.145",
    "203.0.113.146",
  ]

  let superAdminCookie = ""
  let fixturePackageId = ""
  let fixtureDepartureId = ""

  beforeAll(async () => {
    assertAuditSafeEnvironment()
    const suffix = crypto.randomBytes(4).toString("hex")

    const superEmail = `seo-csv-super-${suffix}@alramlahtravels.com`
    const superPass = `SeoCsvSuper!${suffix}9`
    const superAdmin = await provisionStaffAccountInternal({
      email: superEmail,
      password: superPass,
      name: "SEO Attribution QA Super Admin",
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(superAdmin.id)
    superAdminCookie = await signInAndExtractCookie(superEmail, superPass)

    // Create dedicated test Group Package + Open Departure so tests never mutate shared rows
    let lheCity = await db.query.departureCities.findFirst({
      where: eq(schema.departureCities.airportCode, "LHE"),
    })
    if (!lheCity) {
      const [insertedCity] = await db
        .insert(schema.departureCities)
        .values({
          cityName: "Lahore",
          airportCode: "LHE",
          airportName: "Allama Iqbal International Airport",
          isActive: true,
        })
        .returning()
      lheCity = insertedCity!
    }

    const [pkg] = await db
      .insert(schema.groupPackages)
      .values({
        title: `W6C Attribution Group Package ${suffix}`,
        slug: `w6c-attribution-group-${suffix}`,
        tier: "gold",
        durationDays: 14,
        makkahNights: 7,
        madinahNights: 7,
        quadPricePkr: 325000,
        triplePricePkr: 355000,
        doublePricePkr: 395000,
        sharingPricePkr: 295000,
        infantPricePkr: 68000,
        isFeatured: false,
        isActive: true,
      })
      .returning()
    fixturePackageId = pkg!.id
    createdPackageIds.push(fixturePackageId)

    const [dep] = await db
      .insert(schema.groupDepartures)
      .values({
        packageId: fixturePackageId,
        batchCode: `W6C-BATCH-${suffix.toUpperCase()}`,
        departureCityId: lheCity.id,
        departureDate: "2027-03-10",
        returnDate: "2027-03-24",
        totalSeats: 30,
        bookedSeats: 4,
        status: "open",
      })
      .returning()
    fixtureDepartureId = dep!.id
    createdDepartureIds.push(fixtureDepartureId)
  }, 45_000)

  afterAll(async () => {
    for (const ip of usedIps) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${hashIp(ip)}%`))
    }
    if (createdContactIds.length > 0) {
      await db
        .delete(schema.contactMessages)
        .where(inArray(schema.contactMessages.id, createdContactIds))
    }
    if (createdApplicationIds.length > 0) {
      await db
        .delete(schema.applicationHotelStays)
        .where(
          inArray(
            schema.applicationHotelStays.applicationId,
            createdApplicationIds
          )
        )
      await db
        .delete(schema.applicationTransportSegments)
        .where(
          inArray(
            schema.applicationTransportSegments.applicationId,
            createdApplicationIds
          )
        )
      await db
        .delete(schema.applicationQuotes)
        .where(
          inArray(schema.applicationQuotes.applicationId, createdApplicationIds)
        )
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdApplicationIds))
    }
    if (createdDepartureIds.length > 0) {
      await db
        .delete(schema.groupDepartures)
        .where(inArray(schema.groupDepartures.id, createdDepartureIds))
    }
    if (createdPackageIds.length > 0) {
      await db
        .delete(schema.groupPackages)
        .where(inArray(schema.groupPackages.id, createdPackageIds))
    }
    if (createdUserIds.length > 0) {
      await db
        .delete(schema.session)
        .where(inArray(schema.session.userId, createdUserIds))
      await db
        .delete(schema.account)
        .where(inArray(schema.account.userId, createdUserIds))
      await db
        .delete(schema.user)
        .where(inArray(schema.user.id, createdUserIds))
    }
  })

  it("persists all 7 attribution columns across Custom Builder, Group Booking, Hajj Pre-Registration, and Contact inquiries in real PostgreSQL", async () => {
    // 1. Custom Builder (`submitCustomApplication`)
    const customRes = await runInActionContext(
      { ipAddress: "203.0.113.141", pathname: "/" },
      () =>
        submitCustomApplication({
          presetMode: "visa_only",
          includeVisa: true,
          includeFlights: false,
          includeHotels: false,
          includeTransport: false,
          includeZiyarat: false,
          passengers: { adults: 2, children: 1, infants: 1 },
          ksaArrivalDate: "2027-02-05",
          ksaDepartureDate: "2027-02-20",
          contact: {
            customerName: "W6C Custom Attribution Pilgrim",
            customerPhone: "0300 4445566",
            customerWhatsapp: "0300 4445566",
            customerCity: "Lahore",
          },
          attribution: {
            utmSource: "google",
            utmMedium: "cpc",
            utmCampaign: "ramadan_2027",
            utmContent: "hero_cta",
            utmTerm: "umrah from lahore",
            landingPage:
              "/umrah-packages/from-lahore?utm_source=google&utm_medium=cpc&utm_campaign=ramadan_2027",
            httpReferrer: "https://www.google.com.pk/search?q=umrah+from+lahore",
          },
        })
    )

    expect(customRes.success).toBe(true)
    expect(customRes.applicationId).toBeTruthy()
    createdApplicationIds.push(customRes.applicationId!)

    const savedCustom = await db.query.applications.findFirst({
      where: eq(schema.applications.id, customRes.applicationId!),
    })
    expect(savedCustom).toBeDefined()
    expect(savedCustom?.utmSource).toBe("google")
    expect(savedCustom?.utmMedium).toBe("cpc")
    expect(savedCustom?.utmCampaign).toBe("ramadan_2027")
    expect(savedCustom?.utmContent).toBe("hero_cta")
    expect(savedCustom?.utmTerm).toBe("umrah from lahore")
    expect(savedCustom?.landingPage).toBe(
      "/umrah-packages/from-lahore?utm_source=google&utm_medium=cpc&utm_campaign=ramadan_2027"
    )
    expect(savedCustom?.httpReferrer).toBe(
      "https://www.google.com.pk/search?q=umrah+from+lahore"
    )

    // 2. Group Booking (`submitGroupBookingApplication`)
    const groupRes = await runInActionContext(
      {
        ipAddress: "203.0.113.142",
        pathname: `/umrah-packages/w6c-attribution-group`,
      },
      () =>
        submitGroupBookingApplication({
          groupPackageId: fixturePackageId,
          groupDepartureId: fixtureDepartureId,
          selectedRoomType: "quad",
          passengers: { adults: 2, children: 0, infants: 0 },
          contact: {
            customerName: "W6C Group Attribution Pilgrim",
            customerPhone: "0321 7778899",
            customerWhatsapp: "0321 7778899",
            customerCity: "Karachi",
          },
          attribution: {
            utmSource: "chatgpt.com",
            utmMedium: "referral",
            utmCampaign: "geo_umrah_groups",
            utmContent: "package_table",
            utmTerm: "fixed group umrah pakistan",
            landingPage: "/umrah-packages/from-karachi?utm_source=chatgpt.com",
            httpReferrer: "https://chatgpt.com/c/987654",
          },
        })
    )

    expect(groupRes.success).toBe(true)
    expect(groupRes.applicationId).toBeTruthy()
    createdApplicationIds.push(groupRes.applicationId!)

    const savedGroup = await db.query.applications.findFirst({
      where: eq(schema.applications.id, groupRes.applicationId!),
    })
    expect(savedGroup?.utmSource).toBe("chatgpt.com")
    expect(savedGroup?.utmMedium).toBe("referral")
    expect(savedGroup?.utmCampaign).toBe("geo_umrah_groups")
    expect(savedGroup?.utmContent).toBe("package_table")
    expect(savedGroup?.utmTerm).toBe("fixed group umrah pakistan")
    expect(savedGroup?.landingPage).toBe(
      "/umrah-packages/from-karachi?utm_source=chatgpt.com"
    )
    expect(savedGroup?.httpReferrer).toBe("https://chatgpt.com/c/987654")

    // 3. Hajj 2027 Pre-Registration (`submitHajjInquiryApplication`)
    const hajjRes = await runInActionContext(
      { ipAddress: "203.0.113.143", pathname: "/hajj-2027" },
      () =>
        submitHajjInquiryApplication({
          hajjConsultationType: "Maktab A+ Indicative Pre-Registration",
          maktabTier: "A+",
          passengers: { adults: 2, children: 0, infants: 0 },
          contact: {
            customerName: "W6C Hajj Attribution Pilgrim",
            customerPhone: "+44 7911 654321",
            customerWhatsapp: "+44 7911 654321",
            customerCity: "Manchester",
            customerCountry: "United Kingdom",
          },
          attribution: {
            utmSource: "perplexity",
            utmMedium: "ai_citation",
            utmCampaign: "hajj_2027_diaspora",
            utmContent: "maktab_matrix",
            utmTerm: "hajj 2027 maktab a+ pakistan uk",
            landingPage: "/hajj-2027?utm_source=perplexity",
            httpReferrer: "https://www.perplexity.ai/search/hajj-2027-pakistan",
          },
        })
    )

    expect(hajjRes.success).toBe(true)
    expect(hajjRes.applicationId).toBeTruthy()
    createdApplicationIds.push(hajjRes.applicationId!)

    const savedHajj = await db.query.applications.findFirst({
      where: eq(schema.applications.id, hajjRes.applicationId!),
    })
    expect(savedHajj?.utmSource).toBe("perplexity")
    expect(savedHajj?.utmMedium).toBe("ai_citation")
    expect(savedHajj?.utmCampaign).toBe("hajj_2027_diaspora")
    expect(savedHajj?.utmContent).toBe("maktab_matrix")
    expect(savedHajj?.utmTerm).toBe("hajj 2027 maktab a+ pakistan uk")
    expect(savedHajj?.landingPage).toBe("/hajj-2027?utm_source=perplexity")
    expect(savedHajj?.httpReferrer).toBe(
      "https://www.perplexity.ai/search/hajj-2027-pakistan"
    )

    // 4A. Direct Contact Inquiry (`submitPublicContactInquiryAction`)
    const contactDirectRes = await runInActionContext(
      { ipAddress: "203.0.113.144", pathname: "/contact" },
      () =>
        submitPublicContactInquiryAction({
          name: "W6C Contact Attribution Pilgrim",
          phone: "0333 1122334",
          whatsapp: "0333 1122334",
          email: "w6c-contact@example.com",
          subject: "Askari 10 Walk-In Appointment",
          message:
            "Requesting family Umrah consultation at your Askari 10 Lahore Cantt desk.",
          attribution: {
            utmSource: "google",
            utmMedium: "cpc",
            utmCampaign: "lahore_local_desk",
            utmContent: "contact_form",
            utmTerm: "umrah travel agency askari 10 lahore",
            landingPage: "/contact?utm_source=google&utm_medium=cpc",
            httpReferrer: "https://www.google.com/",
          },
        })
    )

    expect(contactDirectRes.success).toBe(true)
    if (contactDirectRes.success) {
      createdContactIds.push(contactDirectRes.id)
      const [savedContact] = await db
        .select()
        .from(schema.contactMessages)
        .where(eq(schema.contactMessages.id, contactDirectRes.id))
        .limit(1)
      expect(savedContact).toBeDefined()
      expect(savedContact?.utmSource).toBe("google")
      expect(savedContact?.utmMedium).toBe("cpc")
      expect(savedContact?.utmCampaign).toBe("lahore_local_desk")
      expect(savedContact?.utmContent).toBe("contact_form")
      expect(savedContact?.utmTerm).toBe("umrah travel agency askari 10 lahore")
      expect(savedContact?.landingPage).toBe(
        "/contact?utm_source=google&utm_medium=cpc"
      )
      expect(savedContact?.httpReferrer).toBe("https://www.google.com/")
    }

    // 4B. Delegated CMS Contact Wrapper (`cms.submitContactMessage`)
    const contactDelegatedRes = await runInActionContext(
      { ipAddress: "203.0.113.145", pathname: "/contact" },
      () =>
        submitContactMessage({
          name: "W6C Delegated CMS Contact Pilgrim",
          phone: "0345 9988776",
          subject: "Islamabad Family Umrah Quote",
          message:
            "Verifying delegated cms.submitContactMessage persists all 7 attribution columns.",
          attribution: {
            utmSource: "claude.ai",
            utmMedium: "referral",
            utmCampaign: "ai_search_isb",
            utmContent: "footer_cta",
            utmTerm: "umrah packages from islamabad",
            landingPage: "/umrah-packages/from-islamabad",
            httpReferrer: "https://user:pass@claude.ai/chat/abc#frag",
          },
        })
    )

    expect(contactDelegatedRes.success).toBe(true)
    if (contactDelegatedRes.success) {
      createdContactIds.push(contactDelegatedRes.id)
      const [savedDelegated] = await db
        .select()
        .from(schema.contactMessages)
        .where(eq(schema.contactMessages.id, contactDelegatedRes.id))
        .limit(1)
      expect(savedDelegated?.utmSource).toBe("claude.ai")
      expect(savedDelegated?.httpReferrer).toBe("https://claude.ai/chat/abc")
    }
  })

  it("neutralizes CSV formula injection (=CMD|..., +SUM, -HYPERLINK, @IMPORT) across attribution columns in exportApplicationsCsvAction", async () => {
    const formulaRes = await runInActionContext(
      { ipAddress: "203.0.113.146", pathname: "/" },
      () =>
        submitCustomApplication({
          presetMode: "visa_only",
          includeVisa: true,
          includeFlights: false,
          includeHotels: false,
          includeTransport: false,
          includeZiyarat: false,
          passengers: { adults: 1, children: 0, infants: 0 },
          ksaArrivalDate: "2027-04-01",
          ksaDepartureDate: "2027-04-12",
          contact: {
            customerName: "W6C Formula Injection Guard Pilgrim",
            customerPhone: "0301 2233445",
            customerWhatsapp: "0301 2233445",
            customerCity: "Lahore",
          },
          attribution: {
            utmSource: "=CMD|' /C calc'!A0",
            utmMedium: "+SUM(1,2)",
            utmCampaign: "-2+3+cmd|' /C notepad'!A0",
            utmContent: "@IMPORTXML(A1,A2)",
            utmTerm: "|dangerous_pipe_formula",
            landingPage: "/umrah-visa?q==CMD",
            httpReferrer: "https://external.example.org/ref?x==1",
          },
        })
    )

    expect(formulaRes.success).toBe(true)
    expect(formulaRes.applicationId).toBeTruthy()
    expect(formulaRes.referenceNumber).toBeTruthy()
    createdApplicationIds.push(formulaRes.applicationId!)

    const csvExport = await runInActionContext(
      { cookieHeader: superAdminCookie, ipAddress: "203.0.113.146" },
      () => exportApplicationsCsvAction({})
    )

    expect(csvExport.success).toBe(true)
    if (!csvExport.success) {
      return
    }

    const lines = csvExport.csvContent.split(/\r?\n/)
    const headerLine = lines[0] ?? ""
    expect(headerLine).toContain("UTM Source")
    expect(headerLine).toContain("UTM Medium")
    expect(headerLine).toContain("UTM Campaign")
    expect(headerLine).toContain("UTM Content")
    expect(headerLine).toContain("UTM Term")
    expect(headerLine).toContain("Landing Page")
    expect(headerLine).toContain("HTTP Referrer")

    const targetRow = lines.find((line) =>
      line.includes(formulaRes.referenceNumber!)
    )
    expect(targetRow).toBeDefined()

    // Every formula-triggering prefix (`=`, `+`, `-`, `@`, `|`) MUST be prefixed with a leading single quote `'`
    expect(targetRow).toContain(`"'=CMD|' /C calc'!A0"`)
    expect(targetRow).toContain(`"'+SUM(1,2)"`)
    expect(targetRow).toContain(`"'-2+3+cmd|' /C notepad'!A0"`)
    expect(targetRow).toContain(`"'@IMPORTXML(A1,A2)"`)
    expect(targetRow).toContain(`"'|dangerous_pipe_formula"`)
    expect(targetRow).not.toContain(`",=CMD`)
    expect(targetRow).not.toContain(`"=CMD`)
  })
})
