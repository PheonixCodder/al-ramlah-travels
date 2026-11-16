import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, describe, it } from "node:test"
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
import { getCompanyInfo } from "../../../lib/company-info"
import { deleteR2Objects } from "../../../lib/storage/r2"
import { POST as authPostHandler } from "../../../app/api/auth/[...all]/route"
import { saveApplicationQuote } from "../../../app/actions/quotes"
import {
  buildLuxuryQuotationHtml,
  renderAndUploadLuxuryQuotationPdf,
  resolveSignedQuotationPdfUrl,
} from "../../../lib/posters/render-quotation-pdf"

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

async function runAs<T>(cookieHeader: string, fn: () => Promise<T>): Promise<T> {
  const rawHeaders = new Headers({
    cookie: cookieHeader,
    host: "localhost:3000",
    "x-forwarded-for": "203.0.113.75",
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => {})

  const workStore: WorkStore = {
    page: "/admin/(dashboard)/applications/[id]/page",
    route: "/admin/applications/[id]",
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
    url: { pathname: "/admin/applications", search: "" },
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

describe("F-DESK T-058 (OD-09, OD-10): Private Versioned Quotation PDF R2 Keys, Multi-Leg Stays, Pillar Gating & Company Info", () => {
  const tag = crypto.randomBytes(4).toString("hex")
  const createdUserIds: string[] = []
  const createdAppIds: string[] = []
  const uploadedR2Keys: string[] = []

  after(async () => {
    if (uploadedR2Keys.length > 0) {
      await deleteR2Objects(uploadedR2Keys).catch(() => {})
    }
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
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
    await closeDatabasePool()
  })

  it("uploads PDFs to unguessable quotes/<appId>/v<ver>-<32hex>.pdf keys with signed proxy URLs and renders multi-leg stays + booked pillars only", async () => {
    const appId = crypto.randomUUID()
    const fakePdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "utf8")

    const uploadOut = await renderAndUploadLuxuryQuotationPdf(
      {
        applicationId: appId,
        quoteVersion: 3,
        referenceNumber: `ART-T058-${tag.toUpperCase()}`,
        customerName: "Haji Abdul Rahman",
        adults: 2,
        children: 1,
        infants: 0,
        airlineName: "Saudia",
        makkahHotelName: "Swissotel Makkah",
        makkahNights: 5,
        madinahHotelName: "Pullman Zamzam Madinah",
        madinahNights: 5,
        transportVehicleName: "GMC Yukon",
        grandTotalPkr: 980000,
      },
      {
        renderFn: async (html) => {
          assert.ok(html.includes("Haji Abdul Rahman"))
          return {
            pdfBuffer: fakePdfBytes,
          }
        },
      }
    )

    uploadedR2Keys.push(uploadOut.pdfKey)

    // Key must match `quotes/${applicationId}/v3-${32 hex chars}.pdf`
    const keyRegex = new RegExp(`^quotes/${appId}/v3-[a-f0-9]{32}\\.pdf$`)
    assert.match(uploadOut.pdfKey, keyRegex)

    // URL must be a short-lived HMAC-signed `/api/media/quotes/...` proxy URL
    assert.ok(uploadOut.pdfUrl.startsWith(`/api/media/quotes/${appId}/v3-`))
    assert.ok(uploadOut.pdfUrl.includes("exp="))
    assert.ok(uploadOut.pdfUrl.includes("sig="))

    // Re-signing a stored proxy URL or raw key refreshes signature cleanly
    const refreshedSigned = resolveSignedQuotationPdfUrl(uploadOut.pdfKey)
    assert.ok(refreshedSigned?.startsWith(`/api/media/quotes/${appId}/v3-`))

    // Multi-leg chronological hotelStays (Makkah Leg 1 -> Madinah Leg 2 -> Makkah Leg 3) + CompanyInfo governance
    const company = getCompanyInfo({
      agencyName: "Al Ramlah Sacred Journeys",
      tagline: "Verified Haramain Partner",
      officeAddress: "Suite 402, Gulberg III, Lahore",
      supportEmail: "concierge@alramlah.pk",
      primaryWhatsapp: "+92 321 9990001",
      secondaryPhone: "+92 42 35770011",
      dtsLicense: "DTS-LHR-7788",
      iataCode: "IATA-2739911",
      moraLicense: "MORA-HJ-551",
      accountTitle: "Al Ramlah Travels Pvt Ltd",
      bankName: "Meezan Bank Limited",
      officialIban: "PK36MEZN0001234567890102",
      ibanVerified: true,
    })

    const threeLegHtml = buildLuxuryQuotationHtml({
      referenceNumber: "ART-3LEG-2026",
      adults: 2,
      children: 0,
      infants: 0,
      includeVisa: true,
      includeFlights: true,
      includeHotels: true,
      includeTransport: true,
      includeZiyarat: true,
      airlineName: "Saudia",
      makkahHotelName: "Makkah Leg One Hotel",
      makkahNights: 4,
      madinahHotelName: "Madinah Leg Two Hotel",
      madinahNights: 5,
      hotelStays: [
        {
          stayOrder: 3,
          city: "makkah",
          hotelName: "Fairmont Clock Tower Leg Three",
          starRating: 5,
          nights: 3,
          checkInDate: "2027-01-10",
          checkOutDate: "2027-01-13",
        },
        {
          stayOrder: 1,
          city: "makkah",
          hotelName: "Swissotel Al Maqam Leg One",
          starRating: 5,
          nights: 4,
          checkInDate: "2027-01-01",
          checkOutDate: "2027-01-05",
        },
        {
          stayOrder: 2,
          city: "madinah",
          hotelName: "Oberoi Madinah Leg Two",
          starRating: 5,
          nights: 5,
          checkInDate: "2027-01-05",
          checkOutDate: "2027-01-10",
        },
      ],
      transportVehicleName: "Private H1 Van",
      grandTotalPkr: 1450000,
      companyInfo: company,
    })

    const idxLeg1 = threeLegHtml.indexOf("Swissotel Al Maqam Leg One")
    const idxLeg2 = threeLegHtml.indexOf("Oberoi Madinah Leg Two")
    const idxLeg3 = threeLegHtml.indexOf("Fairmont Clock Tower Leg Three")
    assert.ok(idxLeg1 > 0 && idxLeg2 > idxLeg1 && idxLeg3 > idxLeg2, "All 3 hotel legs must render in chronological stayOrder")
    assert.ok(threeLegHtml.includes("Suite 402, Gulberg III, Lahore"))
    assert.ok(threeLegHtml.includes("concierge@alramlah.pk"))
    assert.ok(threeLegHtml.includes("DTS-LHR-7788"))
    assert.ok(threeLegHtml.includes("IATA-2739911"))
    assert.ok(threeLegHtml.includes("PK36MEZN0001234567890102"))

    // Visa-Only pillar gating: unbooked Flights, Hotels, Transport & Ziyarat must NOT be rendered as included!
    const visaOnlyHtml = buildLuxuryQuotationHtml({
      referenceNumber: "ART-VISA-ONLY",
      adults: 2,
      children: 0,
      infants: 1,
      includeVisa: true,
      includeFlights: false,
      includeHotels: false,
      includeTransport: false,
      includeZiyarat: false,
      airlineName: "Unused Airline",
      makkahHotelName: "Unused Makkah Hotel",
      makkahNights: 0,
      madinahHotelName: "Unused Madinah Hotel",
      madinahNights: 0,
      transportVehicleName: "Unused Bus",
      visaTotalPkr: 165000,
      grandTotalPkr: 165000,
      companyInfo: {
        ...company,
        ibanVerified: false,
      },
    })

    assert.equal(visaOnlyHtml.includes("Unused Makkah Hotel"), false)
    assert.equal(visaOnlyHtml.includes("Unused Madinah Hotel"), false)
    assert.equal(visaOnlyHtml.includes("International Flight Schedule"), false)
    assert.equal(
      visaOnlyHtml.includes("PK36MEZN0001234567890102"),
      false,
      "Unverified IBAN must be suppressed per OD-10"
    )
    assert.ok(visaOnlyHtml.includes("Saudi Umrah eVisa"))

    // Verify `saveApplicationQuote` invalidates stale `quotationPdfUrl` when price or customer notes change
    const staffEmail = `fdesk.t058.${tag}@audit.local`
    const staffPass = `PdfInvalid!${tag}55`
    const staff = await provisionStaffAccountInternal({
      name: `PDF Staff ${tag}`,
      email: staffEmail,
      password: staffPass,
      role: "staff",
    })
    createdUserIds.push(staff.id)
    const cookie = await signInAndExtractCookie(staffEmail, staffPass)

    const [app] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-INV-${tag.toUpperCase()}`,
        source: "custom_builder",
        presetMode: "visa_only",
        status: "quoted",
        customerName: "PDF Invalidation Pilgrim",
        customerPhone: "+923008881122",
        customerWhatsapp: "+923008881122",
        customerCity: "Lahore",
        adults: 2,
        children: 0,
        infants: 0,
        bedAndSeatCount: 2,
        totalPassportCount: 2,
        includeVisa: true,
        includeFlights: false,
        includeHotels: false,
        includeTransport: false,
        includeZiyarat: false,
      })
      .returning()
    createdAppIds.push(app.id)

    await db.insert(schema.applicationQuotes).values({
      applicationId: app.id,
      version: 1,
      visaTotalPkr: 120000,
      flightsTotalPkr: 0,
      makkahHotelTotalPkr: 0,
      madinahHotelTotalPkr: 0,
      transportTotalPkr: 0,
      ziyaratTotalPkr: 0,
      discountPkr: 0,
      grandTotalPkr: 120000,
      depositRequiredPkr: 0,
      amountPaidPkr: 0,
      paymentStatus: "unpaid",
      quotationPdfUrl: uploadOut.pdfUrl,
      quotationPdfGeneratedAt: new Date(),
    })

    // Save v2 with updated visa price -> `quotationPdfUrl` on v2 MUST be invalidated (`null`)
    const updatedQuoteRes = await runAs(cookie, () =>
      saveApplicationQuote({
        applicationId: app.id,
        expectedVersion: 1,
        visaTotalPkr: 135000,
        flightsTotalPkr: 0,
        makkahHotelTotalPkr: 0,
        madinahHotelTotalPkr: 0,
        transportTotalPkr: 0,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        depositRequiredPkr: 0,
        amountPaidPkr: 0,
        paymentStatus: "unpaid",
        validUntilDays: 7,
      })
    )
    assert.equal(updatedQuoteRes.success, true)
    if (updatedQuoteRes.success) {
      const [v2Quote] = await db
        .select()
        .from(schema.applicationQuotes)
        .where(eq(schema.applicationQuotes.id, updatedQuoteRes.quoteId))
      assert.equal(v2Quote.version, 2)
      assert.equal(
        v2Quote.quotationPdfUrl,
        null,
        "Changed pricing must invalidate cached quotationPdfUrl so pilgrims never receive stale totals"
      )
    }
  })
})
