import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import {
  buildLuxuryQuotationHtml,
  renderQuotationPdfHtml,
  sanitizeQuotationImageSrc,
  type LuxuryQuotationPdfInput,
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

describe("F-DESK T-021: Quotation PDF HTML Escaping, SSRF Image Allowlist & Strict CSP", () => {
  it("escapes 100% of dynamic strings across pilgrim, hotel, flight, transport, ziyarat, agency & IBAN fields while preserving hyphens", () => {
    const xssPayload =
      `<script>fetch("http://169.254.169.254/latest/meta-data")</script><img src=x onerror="alert('xss')" />"'&`

    const input: LuxuryQuotationPdfInput = {
      referenceNumber: `ART-2026-SEC-${xssPayload}`,
      customerName: `Al-Ramlah Pilgrim ${xssPayload}`,
      customerEmail: `pilgrim+"xss"@example.com<script>evil()</script>`,
      customerPhone: `+923001234567"><svg onload=alert(1)>`,
      customerCity: `Lahore-Cantt ${xssPayload}`,
      adults: 2,
      children: 1,
      infants: 1,
      travelWindowLabel: `2026-12-15 to 2026-12-29 ${xssPayload}`,
      routeSummary: `LHE - JED - MED ${xssPayload}`,
      airlineName: `Saudia Airlines ${xssPayload}`,
      outboundFlightSummary: `SV-739 ${xssPayload}`,
      returnFlightSummary: `SV-738 ${xssPayload}`,
      baggageSummary: `46-KG ${xssPayload}`,
      includeVisa: true,
      includeFlights: true,
      includeHotels: true,
      includeTransport: true,
      includeZiyarat: true,
      makkahHotelName: `Swissotel Al-Maqam ${xssPayload}`,
      makkahDistanceLabel: `0m Clock-Tower ${xssPayload}`,
      makkahNights: 7,
      makkahRoomSummary: `Quad-Suite ${xssPayload}`,
      madinahHotelName: `Pullman Zamzam ${xssPayload}`,
      madinahDistanceLabel: `50m Haram ${xssPayload}`,
      madinahNights: 7,
      madinahRoomSummary: `Triple-View ${xssPayload}`,
      hotelStays: [
        {
          stayOrder: 1,
          city: `makkah">${xssPayload}`,
          hotelName: `Dar Al-Tawhid ${xssPayload}`,
          starRating: 5,
          distanceLabel: `Front-Row ${xssPayload}`,
          checkInDate: `2026-12-15`,
          checkOutDate: `2026-12-22`,
          nights: 7,
          roomSummary: `1x Quad ${xssPayload}`,
          mealPlan: `Half-Board ${xssPayload}`,
        },
      ],
      transportSegments: [
        {
          segmentOrder: 1,
          label: `JED -> Makkah ${xssPayload}`,
          vehicleName: `GMC-Yukon ${xssPayload}`,
          serviceType: `private_transfer ${xssPayload}`,
          scheduledDate: `2026-12-15`,
          pickupTime: `14:30"><script>bad()</script>`,
        },
      ],
      transportVehicleName: `GMC-Yukon ${xssPayload}`,
      ziyaratIncluded: true,
      ziyaratSummary: `Quba & Uhud ${xssPayload}`,
      visaTotalPkr: 140000,
      flightsTotalPkr: 520000,
      makkahHotelTotalPkr: 310000,
      madinahHotelTotalPkr: 240000,
      transportTotalPkr: 95000,
      ziyaratTotalPkr: 35000,
      discountPkr: 20000,
      grandTotalPkr: 1320000,
      depositRequiredPkr: 400000,
      amountPaidPkr: 400000,
      notesCustomer: `VIP Zamzam-Gift ${xssPayload}`,
      specialRequests: `Wheelchair-Assistance ${xssPayload}`,
      companyInfo: {
        agencyName: `Al-Ramlah Travels ${xssPayload}`,
        tagline: `Sacred Hospitality ${xssPayload}`,
        officeAddress: `MM-Alam Road ${xssPayload}`,
        supportEmail: `care@alramlah.com<script>bad()</script>`,
        primaryWhatsapp: `+92 300 0000000"><img src=x onerror=alert(1)>`,
        secondaryPhone: `+92 42 35770011"><svg onload=alert(1)>`,
        dtsLicense: `DTS-9911 ${xssPayload}`,
        iataCode: `IATA-8822 ${xssPayload}`,
        moraLicense: `HJ-2027 ${xssPayload}`,
        accountTitle: `Al-Ramlah Corporate ${xssPayload}`,
        bankName: `Meezan-Bank ${xssPayload}`,
        officialIban: `PK36MEZN0000000123456702"><script>iban()</script>`,
        ibanVerified: true,
      },
    }

    const html = buildLuxuryQuotationHtml(input)
    const aliasHtml = renderQuotationPdfHtml(input)
    assert.equal(aliasHtml, html)

    // Strict inline Content-Security-Policy must block network fetches and scripts in Gotenberg Chromium
    assert.match(
      html,
      /<meta\s+http-equiv="Content-Security-Policy"\s+content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data: https:;"\s*\/>/
    )

    // Zero unescaped script/img tags or event handler breakouts
    assert.equal(html.includes("<script>"), false, "Raw <script> tag must never appear")
    assert.equal(
      html.includes("<img src=x"),
      false,
      "Injected <img src=x> tag must never appear"
    )
    assert.equal(
      html.includes("<svg onload="),
      false,
      "Injected <svg onload=> tag must never appear"
    )
    assert.ok(
      html.includes("&lt;script&gt;"),
      "Escaped &lt;script&gt; entity should appear in rendered output"
    )

    // Literal hyphens in brand names and ISO dates must NOT be mangled
    assert.ok(html.includes("Al-Ramlah Pilgrim"), "Hyphenated name must remain intact")
    assert.ok(html.includes("2026-12-15"), "ISO date hyphens must remain intact")
  })

  it("restricts embedded logo/image URLs to validated base64 raster data URIs or allowlisted HTTPS R2 hosts", () => {
    const prevR2Public = process.env.R2_PUBLIC_URL
    process.env.R2_PUBLIC_URL = "https://cdn.alramlahtravels.com"

    try {
      // Blocked SSRF, local file, JS, SVG data URI, and arbitrary external origins
      assert.equal(
        sanitizeQuotationImageSrc("http://169.254.169.254/latest/meta-data/"),
        null
      )
      assert.equal(sanitizeQuotationImageSrc("http://127.0.0.1:3000/secret"), null)
      assert.equal(sanitizeQuotationImageSrc("file:///etc/passwd"), null)
      assert.equal(sanitizeQuotationImageSrc("javascript:alert(1)"), null)
      assert.equal(
        sanitizeQuotationImageSrc(
          "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+"
        ),
        null
      )
      assert.equal(
        sanitizeQuotationImageSrc("https://attacker.example.com/pixel.png"),
        null
      )
      assert.equal(
        sanitizeQuotationImageSrc("http://cdn.alramlahtravels.com/logo.png"),
        null
      )

      // Allowed Gotenberg placeholder token, raster base64 data URI, and HTTPS R2 URLs
      assert.equal(
        sanitizeQuotationImageSrc("{{COMPANY_LOGO_DATA_URI}}"),
        "{{COMPANY_LOGO_DATA_URI}}"
      )
      const validPngDataUri =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      assert.equal(sanitizeQuotationImageSrc(validPngDataUri), validPngDataUri)
      assert.equal(
        sanitizeQuotationImageSrc("https://cdn.alramlahtravels.com/brand/logo.png"),
        "https://cdn.alramlahtravels.com/brand/logo.png"
      )
      assert.equal(
        sanitizeQuotationImageSrc("https://pub-12345abcde.r2.dev/posters/logo.webp"),
        "https://pub-12345abcde.r2.dev/posters/logo.webp"
      )

      // Verify malicious companyLogoB64 falls back to safe inline monogram instead of <img src="http://169.254...">
      const htmlWithSsrfLogo = buildLuxuryQuotationHtml({
        referenceNumber: "ART-2026-LOGO",
        airlineName: "Saudia",
        adults: 2,
        children: 0,
        infants: 0,
        makkahHotelName: "Makkah Clock Royal Tower",
        makkahNights: 5,
        madinahHotelName: "Oberoi Madinah",
        madinahNights: 5,
        transportVehicleName: "GMC Yukon",
        grandTotalPkr: 850000,
        companyLogoB64: "http://169.254.169.254/latest/meta-data",
      })
      assert.equal(htmlWithSsrfLogo.includes("169.254.169.254"), false)
      assert.ok(htmlWithSsrfLogo.includes('class="logo-fallback"'))
    } finally {
      if (prevR2Public === undefined) {
        delete process.env.R2_PUBLIC_URL
      } else {
        process.env.R2_PUBLIC_URL = prevR2Public
      }
    }
  })
})
