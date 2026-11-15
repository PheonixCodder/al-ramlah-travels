import crypto from "node:crypto"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { getCompanyInfo, type ResolvedCompanyInfo } from "@/lib/company-info"
import { escapeAttr, escapeHtml, sanitizeSafeUrl } from "@/lib/security/html-escape"
import {
  createSignedMediaProxyUrl,
  extractStorageKeyFromUrlOrKey,
  uploadAssetToR2,
} from "@/lib/storage/r2"
import type { RenderHtmlOutput } from "./chromium-cdp"
import { renderHtmlViaGotenberg } from "./gotenberg"

export interface QuotationPdfHotelStayLeg {
  stayOrder?: number
  city: string
  hotelName: string
  starRating?: number
  distanceLabel?: string
  checkInDate?: string | null
  checkOutDate?: string | null
  nights: number
  roomSummary?: string | null
  mealPlan?: string | null
}

export interface QuotationPdfTransportLeg {
  segmentOrder?: number
  label: string
  vehicleName: string
  serviceType?: string | null
  vehicleQuantity?: number
  scheduledDate?: string | null
  pickupTime?: string | null
}

export interface LuxuryQuotationPdfInput {
  applicationId?: string
  quoteVersion?: number
  source?: "custom_builder" | "group_booking" | "hajj_inquiry" | string
  referenceNumber: string
  issueDateLabel?: string
  validUntilLabel?: string
  customerName?: string
  customerPhone?: string
  customerCity?: string
  customerEmail?: string
  adults: number
  children: number
  infants: number
  travelWindowLabel?: string
  totalDays?: number
  routeSummary?: string
  airlineName: string
  outboundFlightSummary?: string
  returnFlightSummary?: string
  baggageSummary?: string
  includeVisa?: boolean
  includeFlights?: boolean
  includeHotels?: boolean
  includeTransport?: boolean
  includeZiyarat?: boolean
  makkahHotelName: string
  makkahHotelStars?: number
  makkahDistanceLabel?: string
  makkahNights: number
  makkahRoomSummary?: string
  madinahHotelName: string
  madinahHotelStars?: number
  madinahDistanceLabel?: string
  madinahNights: number
  madinahRoomSummary?: string
  hotelStays?: QuotationPdfHotelStayLeg[]
  transportSegments?: QuotationPdfTransportLeg[]
  transportVehicleName: string
  ziyaratIncluded?: boolean
  ziyaratSummary?: string
  visaTotalPkr?: number
  flightsTotalPkr?: number
  makkahHotelTotalPkr?: number
  madinahHotelTotalPkr?: number
  transportTotalPkr?: number
  ziyaratTotalPkr?: number
  discountPkr?: number
  grandTotalPkr: number
  depositRequiredPkr?: number
  amountPaidPkr?: number
  notesCustomer?: string | null
  specialRequests?: string | null
  companyLogoB64?: string
  companyInfo?: Partial<ResolvedCompanyInfo>
  // Optional legacy compatibility fields
  clientName?: string
  totalNights?: number
  dateRangeText?: string
  airlineCode?: string
  outboundDateText?: string
  outboundDate?: string
  outboundRouteTitle?: string
  outboundRoute?: string
  outboundRouteDesc?: string
  returnDateText?: string
  returnDate?: string
  returnRouteTitle?: string
  returnRoute?: string
  returnRouteDesc?: string
  baggageLabel?: string
  makkahStars?: number
  makkahDistance?: string
  makkahDateRange?: string
  makkahCheckIn?: string
  makkahCheckOut?: string
  makkahMealPlanLabel?: string
  makkahMealPlan?: string
  makkahAllocationLabel?: string
  madinahStars?: number
  madinahDistance?: string
  madinahDateRange?: string
  madinahCheckIn?: string
  madinahCheckOut?: string
  madinahMealPlanLabel?: string
  madinahMealPlan?: string
  madinahAllocationLabel?: string
  transportRouteSummary?: string
  supplierName?: string
  transportSectors?: Array<{
    stepLabel: string
    dateText: string
    routeTitle: string
    routeDesc: string
  }>
}

const SAFE_DATA_IMAGE_RE =
  /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/i

/**
 * Strict image URL allowlist for Gotenberg Chromium HTML (`T-021`):
 * Permits ONLY validated base64 raster `data:image/(png|jpeg|jpg|webp)` URIs
 * or HTTPS URLs hosted on the configured Cloudflare R2 domain.
 * Blocks `file://`, `http://169.254.169.254`, `javascript:`, `data:image/svg+xml`,
 * and arbitrary third-party tracking/SSRF origins.
 */
export function sanitizeQuotationImageSrc(
  rawUrl: string | null | undefined
): string | null {
  if (typeof rawUrl !== "string") return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  if (
    trimmed === "{{COMPANY_LOGO_DATA_URI}}" ||
    trimmed === "__COMPANY_LOGO_DATA_URI__"
  ) {
    return trimmed
  }

  if (trimmed.toLowerCase().startsWith("data:")) {
    const safe = sanitizeSafeUrl(trimmed, { allowDataImage: true })
    if (!safe || !SAFE_DATA_IMAGE_RE.test(safe)) {
      return null
    }
    return safe
  }

  const safeUrl = sanitizeSafeUrl(trimmed, { allowDataImage: false })
  if (!safeUrl || !safeUrl.toLowerCase().startsWith("https://")) {
    return null
  }

  try {
    const parsed = new URL(safeUrl)
    if (parsed.protocol !== "https:") return null
    const host = parsed.hostname.toLowerCase()

    const configuredPublicR2 = process.env.R2_PUBLIC_URL?.trim()
    let allowedR2Host: string | null = null
    if (configuredPublicR2) {
      try {
        allowedR2Host = new URL(configuredPublicR2).hostname.toLowerCase()
      } catch {
        allowedR2Host = null
      }
    }

    const isAllowlistedHost =
      (allowedR2Host !== null && host === allowedR2Host) ||
      host.endsWith(".r2.dev") ||
      host.endsWith(".r2.cloudflarestorage.com")

    return isAllowlistedHost ? parsed.toString() : null
  } catch {
    return null
  }
}

/**
 * Normalizes standalone currency code `SAR` without mangling hyphens, ISO dates,
 * emails, or `"Al-Ramlah"` (`T-021`). Always called BEFORE `escapeHtml`.
 */
function normalizeDisplayText(val: string | undefined | null): string {
  if (!val) return ""
  return String(val).replace(/\bSAR\b/g, "PKR")
}

function safeText(val: string | number | undefined | null): string {
  if (val === null || val === undefined) return ""
  return escapeHtml(normalizeDisplayText(String(val)))
}

function safeRawText(val: string | number | undefined | null): string {
  if (val === null || val === undefined) return ""
  return escapeHtml(String(val))
}

function formatPkr(amount: number | undefined): string {
  const num = Number.isFinite(amount) ? Math.max(0, Math.round(amount ?? 0)) : 0
  return num.toLocaleString("en-PK")
}

function renderStars(count: number = 5): string {
  const safeCount = Math.min(5, Math.max(1, Math.round(count || 5)))
  return "★".repeat(safeCount)
}

function sanitizeOwnerKeySegment(raw: string): string {
  const cleaned = raw.trim().replace(/[^A-Za-z0-9_-]/g, "")
  return cleaned.slice(0, 64) || "application"
}

/**
 * Re-signs a stored private quotation PDF key or URL into a fresh short-lived
 * `/api/media/quotes/...?exp=...&sig=...` URL (`T-058`).
 */
export function resolveSignedQuotationPdfUrl(
  storedUrlOrKey: string | null | undefined
): string | null {
  if (!storedUrlOrKey) return null
  const key = extractStorageKeyFromUrlOrKey(storedUrlOrKey)
  if (!key) return null
  if (key.startsWith("quotes/") || key.startsWith("quotations/")) {
    return createSignedMediaProxyUrl(key)
  }
  return storedUrlOrKey
}

function resolveChronologicalHotelStays(
  data: LuxuryQuotationPdfInput,
  includeHotels: boolean
): QuotationPdfHotelStayLeg[] {
  if (!includeHotels) return []

  if (Array.isArray(data.hotelStays) && data.hotelStays.length > 0) {
    return [...data.hotelStays]
      .sort((a, b) => {
        const orderDiff = (a.stayOrder ?? 0) - (b.stayOrder ?? 0)
        if (orderDiff !== 0) return orderDiff
        const dateA = a.checkInDate ?? ""
        const dateB = b.checkInDate ?? ""
        return dateA.localeCompare(dateB)
      })
      .filter((s) => s.nights > 0 || Boolean(s.hotelName?.trim()))
  }

  const fallbackLegs: QuotationPdfHotelStayLeg[] = []
  if (data.makkahNights > 0 && data.makkahHotelName?.trim()) {
    fallbackLegs.push({
      stayOrder: 1,
      city: "makkah",
      hotelName: data.makkahHotelName,
      starRating: data.makkahHotelStars ?? 5,
      distanceLabel: data.makkahDistanceLabel || "Near Masjid al Haram",
      nights: data.makkahNights,
      roomSummary: data.makkahRoomSummary || "Private Family Suite / Room",
    })
  }
  if (data.madinahNights > 0 && data.madinahHotelName?.trim()) {
    fallbackLegs.push({
      stayOrder: 2,
      city: "madinah",
      hotelName: data.madinahHotelName,
      starRating: data.madinahHotelStars ?? 5,
      distanceLabel: data.madinahDistanceLabel || "Markazia Central Zone",
      nights: data.madinahNights,
      roomSummary: data.madinahRoomSummary || "Private Family Suite / Room",
    })
  }
  return fallbackLegs
}

/**
 * Generates an inline-styled multi-page A4 HTML document for Al Ramlah Travels
 * Luxury Pilgrimage Quotations:
 * - Page 1: Executive Cover, Pilgrim Manifest & Confirmed Service Pillars
 * - Page 2: Day-by-Day Chronological Sacred Itinerary (rendered strictly from booked pillars)
 * - Page 3: Official PKR Financial Breakdown, Agency Governance & Regulatory Terms
 */
export function buildLuxuryQuotationHtml(
  data: LuxuryQuotationPdfInput,
  legacyCompanyLogoB64?: string
): string {
  const effectiveLogoInput =
    data.companyLogoB64 ||
    (legacyCompanyLogoB64
      ? legacyCompanyLogoB64.startsWith("data:") ||
        legacyCompanyLogoB64.startsWith("https://") ||
        legacyCompanyLogoB64.includes("COMPANY_LOGO_DATA_URI")
        ? legacyCompanyLogoB64
        : `data:image/png;base64,${legacyCompanyLogoB64}`
      : undefined)
  const company = {
    ...getCompanyInfo(null),
    ...(data.companyInfo ?? {}),
  }

  const totalPassports =
    Math.max(0, Math.floor(data.adults || 0)) +
    Math.max(0, Math.floor(data.children || 0)) +
    Math.max(0, Math.floor(data.infants || 0))
  const bedSeats =
    Math.max(0, Math.floor(data.adults || 0)) +
    Math.max(0, Math.floor(data.children || 0))

  const includeVisa = data.includeVisa ?? true
  const includeFlights = data.includeFlights ?? true
  const includeHotels = data.includeHotels ?? true
  const includeTransport = data.includeTransport ?? true
  const includeZiyarat =
    data.includeZiyarat ?? (data.ziyaratIncluded !== undefined ? data.ziyaratIncluded : true)

  const orderedHotelStays = resolveChronologicalHotelStays(data, includeHotels)
  const totalHotelNights = orderedHotelStays.reduce(
    (sum, leg) => sum + Math.max(0, Math.floor(leg.nights || 0)),
    0
  )
  const totalDays =
    data.totalDays && data.totalDays > 0
      ? data.totalDays
      : totalHotelNights > 0
        ? totalHotelNights + 1
        : 15

  const issueDate =
    data.issueDateLabel ||
    new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Karachi",
    })
  const validUntil = data.validUntilLabel || "7 Days from Issue"

  const isHajj = data.source === "hajj_inquiry"
  const coverEyebrow = isHajj
    ? "Bespoke Hajj 2027 Consultation & Proposal"
    : "Bespoke Haramain Pilgrimage Proposal"
  const coverHeading = isHajj
    ? "Luxury Hajj<br />Consultation &amp; Quotation"
    : "Luxury Umrah<br />Itinerary &amp; Quotation"

  const safeLogoUri = sanitizeQuotationImageSrc(effectiveLogoInput)
  const logoImgHtml = safeLogoUri
    ? `<img src="${escapeAttr(safeLogoUri)}" alt="${escapeAttr(company.agencyName)}" style="width:68px;height:68px;border-radius:14px;object-fit:cover;border:2px solid #D4AF37;" />`
    : `<div class="logo-fallback" style="width:68px;height:68px;border-radius:14px;background:#0A3622;border:2px solid #D4AF37;display:flex;align-items:center;justify-content:center;color:#D4AF37;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;">AR</div>`

  const visaTotal = Math.max(0, Math.round(data.visaTotalPkr ?? 0))
  const flightsTotal = Math.max(0, Math.round(data.flightsTotalPkr ?? 0))
  const makkahTotal = Math.max(0, Math.round(data.makkahHotelTotalPkr ?? 0))
  const madinahTotal = Math.max(0, Math.round(data.madinahHotelTotalPkr ?? 0))
  const transportTotal = Math.max(0, Math.round(data.transportTotalPkr ?? 0))
  const ziyaratTotal = Math.max(0, Math.round(data.ziyaratTotalPkr ?? 0))
  const discountTotal = Math.max(0, Math.round(data.discountPkr ?? 0))
  const amountPaid = Math.max(0, Math.round(data.amountPaidPkr ?? 0))
  const depositRequired = Math.max(0, Math.round(data.depositRequiredPkr ?? 0))
  const grandTotal = Math.max(0, Math.round(data.grandTotalPkr ?? 0))
  const balanceDue = Math.max(0, grandTotal - amountPaid)

  const hasItemizedBreakdown =
    visaTotal +
      flightsTotal +
      makkahTotal +
      madinahTotal +
      transportTotal +
      ziyaratTotal >
    0

  const activePillarsLabels: string[] = []
  if (includeVisa) activePillarsLabels.push(isHajj ? "Hajj Permit / Visa" : "Saudi Umrah eVisa")
  if (includeFlights) activePillarsLabels.push("Return Airfare")
  if (includeHotels) activePillarsLabels.push("Haramain Hotels")
  if (includeTransport) activePillarsLabels.push("Ground Transfers")
  if (includeZiyarat) activePillarsLabels.push("Guided Ziyarat")

  const licenseBadges: string[] = []
  if (company.dtsLicense) licenseBadges.push(`DTS: ${safeRawText(company.dtsLicense)}`)
  if (company.moraLicense) licenseBadges.push(`MORA: ${safeRawText(company.moraLicense)}`)
  if (company.iataCode) licenseBadges.push(`IATA: ${safeRawText(company.iataCode)}`)
  if (company.ntnNumber) licenseBadges.push(`NTN: ${safeRawText(company.ntnNumber)}`)

  const hotelItineraryHtml = orderedHotelStays
    .map((stay, idx) => {
      const cityLower = (stay.city || "").toLowerCase()
      const cityDisplay =
        cityLower === "makkah"
          ? "Makkah al Mukarramah"
          : cityLower === "madinah"
            ? "Madinah al Munawwarah"
            : safeText(stay.city || "Holy City")
      const checkInOutText =
        stay.checkInDate && stay.checkOutDate
          ? `${safeRawText(stay.checkInDate)} → ${safeRawText(stay.checkOutDate)}`
          : `${Math.max(0, Math.floor(stay.nights || 0))} Confirmed Nights`
      const mealPlanLabel = stay.mealPlan
        ? safeText(stay.mealPlan.replace(/_/g, " "))
        : "As Confirmed"

      return `
        <div class="itinerary-card">
          <div class="card-badge">Hotel Leg ${idx + 1} • ${cityDisplay} • ${Math.max(0, Math.floor(stay.nights || 0))} Nights</div>
          <div class="card-title bidi-auto" dir="auto">
            ${safeText(stay.hotelName)}
            <span class="stars">${renderStars(stay.starRating ?? 5)}</span>
          </div>
          <div class="spec-row">
            <div class="spec-box">
              <div class="spec-label">Check-In / Check-Out</div>
              <div class="spec-val">${checkInOutText}</div>
            </div>
            <div class="spec-box">
              <div class="spec-label">Proximity &amp; Dining</div>
              <div class="spec-val bidi-auto" dir="auto">${safeText(stay.distanceLabel || "Haramain Zone")} • ${mealPlanLabel}</div>
            </div>
            <div class="spec-box">
              <div class="spec-label">Room Configuration</div>
              <div class="spec-val bidi-auto" dir="auto">${safeText(stay.roomSummary || `${bedSeats} Beds Allocated`)}</div>
            </div>
          </div>
        </div>`
    })
    .join("\n")

  const transportItineraryHtml = includeTransport
    ? Array.isArray(data.transportSegments) && data.transportSegments.length > 0
      ? `
        <div class="itinerary-card">
          <div class="card-badge">Confirmed Ground Transport (${data.transportSegments.length} Sector${data.transportSegments.length === 1 ? "" : "s"})</div>
          <div class="card-title bidi-auto" dir="auto">${safeText(data.transportVehicleName || "Dedicated Pilgrim Transport")}</div>
          <div class="segment-list">
            ${data.transportSegments
              .map(
                (seg, idx) => `
              <div class="segment-item">
                <span class="segment-num">${idx + 1}.</span>
                <span class="bidi-auto" dir="auto"><strong>${safeText(seg.label)}</strong> — ${Math.max(1, Math.floor(seg.vehicleQuantity ?? 1))}x ${safeText(seg.vehicleName)}${seg.serviceType ? ` (${safeText(seg.serviceType)})` : ""}${seg.scheduledDate ? ` • ${safeRawText(seg.scheduledDate)}` : ""}${seg.pickupTime ? ` @ ${safeRawText(seg.pickupTime)}` : ""}</span>
              </div>`
              )
              .join("")}
          </div>
        </div>`
      : `
        <div class="itinerary-card">
          <div class="card-badge">Confirmed Ground Transport</div>
          <div class="card-title bidi-auto" dir="auto">${safeText(data.transportVehicleName || "Air-Conditioned Haramain Transfer")}</div>
          <div class="card-sub">Airport arrival pickup, intercity Haramain sector transfers, and return airport drop-off arranged per confirmed manifest (${bedSeats} seats).</div>
        </div>`
    : ""

  const ziyaratItineraryHtml = includeZiyarat
    ? `
        <div class="itinerary-card">
          <div class="card-badge">Sacred Historical Ziyarat</div>
          <div class="card-title">Guided Ziyarat in Makkah &amp; Madinah</div>
          <div class="card-sub bidi-auto" dir="auto">${safeText(
            data.ziyaratSummary ||
              "Guided visits to Jabal al-Nour, Jabal Thawr, Masjid Quba, Masjid Qiblatain, and Shuhada Uhud with dedicated transport."
          )}</div>
        </div>`
    : ""

  const flightsItineraryHtml = includeFlights
    ? `
        <div class="itinerary-card">
          <div class="card-badge">Airfare &amp; Routing</div>
          <div class="card-title bidi-auto" dir="auto">${safeText(data.airlineName || "Confirmed Carrier")}</div>
          <div class="card-sub bidi-auto" dir="auto">${safeText(data.routeSummary || "Pakistan ⇄ Kingdom of Saudi Arabia")}</div>
          <div class="spec-row">
            <div class="spec-box">
              <div class="spec-label">Outbound Sector</div>
              <div class="spec-val bidi-auto" dir="auto">${safeText(data.outboundFlightSummary || "Confirmed upon ticket issuance")}</div>
            </div>
            <div class="spec-box">
              <div class="spec-label">Return Sector</div>
              <div class="spec-val bidi-auto" dir="auto">${safeText(data.returnFlightSummary || "Confirmed upon ticket issuance")}</div>
            </div>
            <div class="spec-box">
              <div class="spec-label">Baggage Allowance</div>
              <div class="spec-val bidi-auto" dir="auto">${safeText(data.baggageSummary || "Standard Check-in + Hand Carry + Zamzam")}</div>
            </div>
          </div>
        </div>`
    : ""

  const visaItineraryHtml = includeVisa
    ? `
        <div class="itinerary-card">
          <div class="card-badge">Official Travel Authorization</div>
          <div class="card-title">${isHajj ? "Hajj Permit &amp; Documentation" : "Saudi Umrah eVisa &amp; Mandatory Health Insurance"}</div>
          <div class="card-sub">Electronic authorization processed for ${totalPassports} passport${totalPassports === 1 ? "" : "s"} (${Math.max(0, Math.floor(data.adults || 0))} Adults, ${Math.max(0, Math.floor(data.children || 0))} Children, ${Math.max(0, Math.floor(data.infants || 0))} Infants).</div>
        </div>`
    : ""

  const bankPaymentNote =
    company.ibanVerified && company.officialIban
      ? `Official Bank Account: <strong>${safeText(company.accountTitle || company.agencyName)}</strong>${company.bankName ? ` (${safeText(company.bankName)})` : ""} — IBAN: <span style="font-family:monospace;font-weight:700;">${safeRawText(company.officialIban)}</span>.`
      : `Official corporate banking coordinates for <strong>${safeText(company.legalEntityName || company.agencyName)}</strong> are shared directly upon booking confirmation.`

  const phoneLine = company.secondaryPhone
    ? `${safeRawText(company.primaryWhatsapp)}  |  ${safeRawText(company.secondaryPhone)}`
    : safeRawText(company.primaryWhatsapp)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data: https:;" />
  <title>${safeRawText(company.agencyName)} Quotation ${safeRawText(data.referenceNumber)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Plus Jakarta Sans', 'Segoe UI', Roboto, Helvetica, Arial, 'Noto Naskh Arabic', 'Noto Nastaliq Urdu', sans-serif;
      background: #FAF7F0;
      color: #1A1D1A;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .bidi-auto {
      unicode-bidi: plaintext;
    }
    .arabic-brand {
      font-family: 'Noto Naskh Arabic', 'Noto Nastaliq Urdu', 'Traditional Arabic', serif;
      direction: rtl;
      unicode-bidi: isolate;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      position: relative;
      background: #FAF7F0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .gold-frame {
      position: absolute;
      inset: 8mm;
      border: 1.5px solid rgba(197, 160, 89, 0.45);
      pointer-events: none;
      z-index: 10;
    }
    .emerald-header {
      background: linear-gradient(135deg, #062316 0%, #0A3622 55%, #0F4B30 100%);
      color: #FAF7F0;
      padding: 16mm 16mm 13mm 16mm;
      border-bottom: 3px solid #C5A059;
    }
    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-title {
      font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #FFFFFF;
      line-height: 1.1;
    }
    .brand-sub {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2.2px;
      color: #E2C275;
      margin-top: 4px;
      font-weight: 600;
    }
    .ref-pill {
      background: rgba(197, 160, 89, 0.16);
      border: 1px solid #C5A059;
      border-radius: 10px;
      padding: 8px 14px;
      text-align: right;
    }
    .ref-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #E2C275;
    }
    .ref-code {
      font-size: 15px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 0.5px;
      margin-top: 2px;
      font-family: 'Courier New', Courier, monospace;
    }
    .cover-hero {
      margin-top: 22px;
    }
    .cover-eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2.8px;
      text-transform: uppercase;
      color: #E2C275;
    }
    .cover-heading {
      font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
      font-size: 38px;
      font-weight: 700;
      line-height: 1.08;
      color: #FFFFFF;
      margin-top: 6px;
    }
    .content-pad {
      padding: 11mm 16mm;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .section-title {
      font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
      font-size: 21px;
      font-weight: 700;
      color: #0A3622;
      border-bottom: 1.5px solid #E6DEC8;
      padding-bottom: 5px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .section-tag {
      font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #9A7732;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .info-card {
      background: #FFFFFF;
      border: 1px solid #E6DEC8;
      border-radius: 12px;
      padding: 13px 15px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .info-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #686E65;
    }
    .info-value {
      font-size: 14px;
      font-weight: 700;
      color: #1A1D1A;
      margin-top: 4px;
    }
    .info-sub {
      font-size: 11.5px;
      color: #525850;
      margin-top: 2px;
    }
    .pillars-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .pillar-chip {
      background: #0A3622;
      color: #FAF7F0;
      border: 1px solid #C5A059;
      border-radius: 999px;
      padding: 5px 12px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.4px;
    }
    .highlight-banner {
      background: linear-gradient(135deg, #0A3622 0%, #114A30 100%);
      border: 1.5px solid #C5A059;
      border-radius: 14px;
      padding: 16px 20px;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: space-between;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .price-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.8px;
      color: #E2C275;
      font-weight: 700;
    }
    .price-value {
      font-size: 28px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.5px;
      margin-top: 3px;
    }
    .itinerary-card {
      background: #FFFFFF;
      border: 1px solid #E6DEC8;
      border-left: 4px solid #0A3622;
      border-radius: 12px;
      padding: 12px 15px;
      margin-bottom: 8px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .card-badge {
      display: inline-block;
      background: #F4EFE4;
      color: #0A3622;
      border: 1px solid #D8CCA8;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      padding: 3px 9px;
      border-radius: 99px;
      margin-bottom: 5px;
    }
    .card-title {
      font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
      font-size: 18.5px;
      font-weight: 700;
      color: #0A3622;
    }
    .stars {
      color: #C5A059;
      font-size: 13px;
      margin-left: 6px;
    }
    .card-sub {
      font-size: 11.5px;
      color: #4A5048;
      margin-top: 4px;
      line-height: 1.45;
    }
    .spec-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #E6DEC8;
    }
    .spec-box {
      background: #FAF7F0;
      border-radius: 8px;
      padding: 6px 9px;
    }
    .spec-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #686E65;
      font-weight: 700;
    }
    .spec-val {
      font-size: 11.5px;
      font-weight: 700;
      color: #1A1D1A;
      margin-top: 2px;
    }
    .segment-list {
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 11.5px;
      color: #363B35;
    }
    .segment-item {
      display: flex;
      gap: 6px;
      line-height: 1.4;
    }
    .segment-num {
      font-weight: 800;
      color: #0A3622;
    }
    table.pricing-table {
      width: 100%;
      border-collapse: collapse;
      background: #FFFFFF;
      border: 1px solid #E6DEC8;
      border-radius: 12px;
      overflow: hidden;
    }
    table.pricing-table th {
      background: #0A3622;
      color: #E2C275;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.4px;
      padding: 10px 14px;
    }
    table.pricing-table td {
      padding: 9px 14px;
      border-bottom: 1px solid #EFE9D8;
      font-size: 12px;
      color: #1A1D1A;
    }
    table.pricing-table td.amt {
      text-align: right;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    table.pricing-table tr.total-row td {
      background: #F4EFE4;
      font-size: 14.5px;
      font-weight: 800;
      color: #0A3622;
      border-top: 2px solid #C5A059;
      border-bottom: none;
      padding: 12px 14px;
    }
    .notes-box {
      background: #FFFFFF;
      border: 1px solid #E6DEC8;
      border-left: 4px solid #C5A059;
      border-radius: 10px;
      padding: 11px 14px;
      font-size: 11.5px;
      line-height: 1.5;
      color: #363B35;
      white-space: pre-line;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .terms-list {
      background: #FFFFFF;
      border: 1px solid #E6DEC8;
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 11px;
      line-height: 1.55;
      color: #363B35;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .terms-list li {
      margin-left: 16px;
      margin-bottom: 4px;
    }
    .footer-bar {
      background: #0A3622;
      color: #FAF7F0;
      padding: 8mm 16mm;
      border-top: 2px solid #C5A059;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
    }
    .footer-gold {
      color: #E2C275;
      font-weight: 700;
    }
  </style>
</head>
<body>

  <!-- ========================================================= -->
  <!-- PAGE 1: EXECUTIVE COVER & PILGRIM MANIFEST                -->
  <!-- ========================================================= -->
  <section class="page">
    <div class="gold-frame"></div>
    <div>
      <div class="emerald-header">
        <div class="brand-row">
          <div class="brand-left">
            ${logoImgHtml}
            <div>
              <div class="brand-title">${safeText(company.agencyName)}</div>
              <div class="brand-sub"><span class="arabic-brand">سفريات الرملة</span> • ${safeText(company.tagline)}</div>
            </div>
          </div>
          <div class="ref-pill">
            <div class="ref-label">Official Proposal Ref</div>
            <div class="ref-code">${safeRawText(data.referenceNumber)}</div>
          </div>
        </div>

        <div class="cover-hero">
          <div class="cover-eyebrow">${coverEyebrow}</div>
          <div class="cover-heading">${coverHeading}</div>
        </div>
      </div>

      <div class="content-pad">
        <div>
          <div class="section-title">
            <span>Lead Pilgrim &amp; Travel Summary</span>
            <span class="section-tag">Issued: ${safeRawText(issueDate)}</span>
          </div>
          <div class="grid-2">
            <div class="info-card">
              <div class="info-label">Prepared Exclusively For</div>
              <div class="info-value bidi-auto" dir="auto">${safeText(data.customerName || "Honored Pilgrim Family")}</div>
              <div class="info-sub bidi-auto" dir="auto">${safeText(data.customerCity || "Pakistan")}${data.customerPhone ? ` • ${safeRawText(data.customerPhone)}` : ""}${data.customerEmail ? ` • ${safeRawText(data.customerEmail)}` : ""}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Pilgrim Group Composition</div>
              <div class="info-value">${totalPassports} Total Passport${totalPassports === 1 ? "" : "s"}</div>
              <div class="info-sub">${Math.max(0, Math.floor(data.adults || 0))} Adults • ${Math.max(0, Math.floor(data.children || 0))} Children • ${Math.max(0, Math.floor(data.infants || 0))} Infants (${bedSeats} Beds &amp; Seats)</div>
            </div>
            <div class="info-card">
              <div class="info-label">Sacred Journey Duration</div>
              <div class="info-value">${totalDays} Days${totalHotelNights > 0 ? ` (${totalHotelNights} Hotel Nights)` : ""}</div>
              <div class="info-sub bidi-auto" dir="auto">${safeText(data.travelWindowLabel || "Preferred Departure Window")}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Quotation Validity</div>
              <div class="info-value">${safeText(validUntil)}</div>
              <div class="info-sub">Subject to live airline seat &amp; Haramain hotel inventory at booking</div>
            </div>
          </div>
        </div>

        <div>
          <div class="section-title">
            <span>Confirmed Service Scope</span>
            <span class="section-tag">${activePillarsLabels.length} Active Pillar${activePillarsLabels.length === 1 ? "" : "s"}</span>
          </div>
          <div class="pillars-strip">
            ${activePillarsLabels.map((lbl) => `<span class="pillar-chip">✓ ${lbl}</span>`).join("\n            ")}
          </div>
        </div>

        ${
          data.specialRequests
            ? `<div>
          <div class="section-title">
            <span>Pilgrim Special Requests</span>
            <span class="section-tag">Recorded Preferences</span>
          </div>
          <div class="notes-box bidi-auto" dir="auto">${safeText(data.specialRequests)}</div>
        </div>`
            : ""
        }

        <div class="highlight-banner">
          <div>
            <div class="price-label">All Inclusive Package Investment</div>
            <div class="price-value">PKR ${formatPkr(grandTotal)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:#E2C275;font-weight:700;">Single Currency Transparent Tariff</div>
            <div style="font-size:11px;color:#FAF7F0;margin-top:3px;">All taxes, service fees &amp; selected inclusions covered</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <div><span class="footer-gold">${safeText(company.agencyName)}</span> • ${safeText(company.officeAddress)}</div>
      <div>Page 1 • WhatsApp: ${phoneLine}</div>
    </div>
  </section>

  <!-- ========================================================= -->
  <!-- PAGE 2: CHRONOLOGICAL SACRED ITINERARY                    -->
  <!-- ========================================================= -->
  <section class="page">
    <div class="gold-frame"></div>
    <div>
      <div class="emerald-header" style="padding:11mm 16mm;">
        <div class="brand-row">
          <div>
            <div class="brand-sub" style="margin-top:0;">Confirmed Service Specifications</div>
            <div class="brand-title" style="font-size:23px;margin-top:2px;">Sacred Itinerary &amp; Confirmed Pillars</div>
          </div>
          <div class="ref-pill">
            <div class="ref-label">Proposal Ref</div>
            <div class="ref-code">${safeRawText(data.referenceNumber)}</div>
          </div>
        </div>
      </div>

      <div class="content-pad" style="gap:10px;">
        ${visaItineraryHtml}
        ${flightsItineraryHtml}
        ${hotelItineraryHtml}
        ${transportItineraryHtml}
        ${ziyaratItineraryHtml}
      </div>
    </div>

    <div class="footer-bar">
      <div><span class="footer-gold">${safeText(company.agencyName)}</span> • ${safeRawText(company.supportEmail)}</div>
      <div>Page 2 • WhatsApp: ${phoneLine}</div>
    </div>
  </section>

  <!-- ========================================================= -->
  <!-- PAGE 3: PKR FINANCIAL SUMMARY, NOTES & GOVERNANCE         -->
  <!-- ========================================================= -->
  <section class="page">
    <div class="gold-frame"></div>
    <div>
      <div class="emerald-header" style="padding:11mm 16mm;">
        <div class="brand-row">
          <div>
            <div class="brand-sub" style="margin-top:0;">Transparent PKR Financial Statement</div>
            <div class="brand-title" style="font-size:23px;margin-top:2px;">Investment Breakdown &amp; Booking Governance</div>
          </div>
          <div class="ref-pill">
            <div class="ref-label">Proposal Ref</div>
            <div class="ref-code">${safeRawText(data.referenceNumber)}</div>
          </div>
        </div>
      </div>

      <div class="content-pad" style="gap:12px;">
        <div>
          <div class="section-title">
            <span>Itemized Financial Summary (PKR)</span>
            <span class="section-tag">${totalPassports} Pilgrim${totalPassports === 1 ? "" : "s"} Total</span>
          </div>
          <table class="pricing-table">
            <thead>
              <tr>
                <th>Selected Service Pillar</th>
                <th>Allocation Basis</th>
                <th style="text-align:right;">Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              ${
                hasItemizedBreakdown
                  ? `
                ${includeVisa || visaTotal > 0 ? `<tr><td><strong>${isHajj ? "Hajj Permit &amp; Processing" : "Saudi Umrah eVisa &amp; Health Insurance"}</strong></td><td>${totalPassports} Passports</td><td class="amt">PKR ${formatPkr(visaTotal)}</td></tr>` : ""}
                ${includeFlights || flightsTotal > 0 ? `<tr><td><strong>Return International Airfare</strong></td><td class="bidi-auto" dir="auto">${safeText(data.airlineName || "Confirmed Carrier")} (${totalPassports} Pax)</td><td class="amt">PKR ${formatPkr(flightsTotal)}</td></tr>` : ""}
                ${includeHotels && makkahTotal > 0 ? `<tr><td><strong>Makkah Hotel Accommodation</strong></td><td>Confirmed Makkah Stays (${bedSeats} Beds)</td><td class="amt">PKR ${formatPkr(makkahTotal)}</td></tr>` : ""}
                ${includeHotels && madinahTotal > 0 ? `<tr><td><strong>Madinah Hotel Accommodation</strong></td><td>Confirmed Madinah Stays (${bedSeats} Beds)</td><td class="amt">PKR ${formatPkr(madinahTotal)}</td></tr>` : ""}
                ${includeTransport && transportTotal > 0 ? `<tr><td><strong>Ground Transport &amp; Transfers</strong></td><td class="bidi-auto" dir="auto">${safeText(data.transportVehicleName || "Haramain Transfer")}</td><td class="amt">PKR ${formatPkr(transportTotal)}</td></tr>` : ""}
                ${includeZiyarat && ziyaratTotal > 0 ? `<tr><td><strong>Guided Ziyarat Tours</strong></td><td>Sacred Historical Sites</td><td class="amt">PKR ${formatPkr(ziyaratTotal)}</td></tr>` : ""}
                ${discountTotal > 0 ? `<tr><td style="color:#0A3622;"><strong>Special Courtesy Discount</strong></td><td>Agency Privilege</td><td class="amt" style="color:#0A3622;">− PKR ${formatPkr(discountTotal)}</td></tr>` : ""}
              `
                  : `
                <tr>
                  <td><strong>Complete ${isHajj ? "Hajj" : "Umrah"} Package Tariff</strong></td>
                  <td>${totalDays} Days All-Selected Pillars (${totalPassports} Pilgrims)</td>
                  <td class="amt">PKR ${formatPkr(grandTotal)}</td>
                </tr>
              `
              }
              <tr class="total-row">
                <td colspan="2">GRAND TOTAL INVESTMENT (PKR)</td>
                <td class="amt">PKR ${formatPkr(grandTotal)}</td>
              </tr>
              ${
                depositRequired > 0 && amountPaid === 0
                  ? `<tr><td><strong>Minimum Confirmation Deposit Required</strong></td><td>To Lock Seats &amp; Hotel Rooms</td><td class="amt">PKR ${formatPkr(depositRequired)}</td></tr>`
                  : ""
              }
              ${
                amountPaid > 0
                  ? `
                <tr><td><strong>Verified Payment Received</strong></td><td>Official Ledger Receipt</td><td class="amt" style="color:#0A3622;">PKR ${formatPkr(amountPaid)}</td></tr>
                <tr><td><strong>Remaining Balance Due</strong></td><td>Payable Before Departure</td><td class="amt" style="color:#9A7732;">PKR ${formatPkr(balanceDue)}</td></tr>
              `
                  : ""
              }
            </tbody>
          </table>
        </div>

        ${
          data.notesCustomer
            ? `<div>
          <div class="section-title">
            <span>Quotation Inclusions &amp; Consultant Notes</span>
            <span class="section-tag">Special Remarks</span>
          </div>
          <div class="notes-box bidi-auto" dir="auto">${safeText(data.notesCustomer)}</div>
        </div>`
            : ""
        }

        <div>
          <div class="section-title">
            <span>Reservation Requirements &amp; Governance</span>
            <span class="section-tag">Booking Protocol</span>
          </div>
          <ul class="terms-list">
            <li><strong>Passport Validity:</strong> Machine-readable passports valid for at least 6 months from KSA arrival date alongside clear white-background photographs.</li>
            <li><strong>Rate Protection:</strong> Airline seats and Haramain hotel rooms remain subject to live availability until confirmation deposit is verified and tickets/vouchers are issued.</li>
            <li><strong>Official Remittance:</strong> ${bankPaymentNote}</li>
            ${
              licenseBadges.length > 0
                ? `<li><strong>Regulatory Credentials:</strong> ${licenseBadges.join(" • ")}</li>`
                : ""
            }
            <li><strong>24/7 Pilgrim Concierge:</strong> Direct WhatsApp &amp; phone support (${phoneLine}) • ${safeText(company.officeAddress)}.</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <div><span class="footer-gold">${safeText(company.agencyName)}</span> • ${safeText(company.tagline)}</div>
      <div>Page 3 • ${safeRawText(company.supportEmail)}</div>
    </div>
  </section>

</body>
</html>`
}

export const renderQuotationPdfHtml = buildLuxuryQuotationHtml

export async function renderAndUploadLuxuryQuotationPdf(
  input: LuxuryQuotationPdfInput,
  options?: {
    renderFn?: (html: string) => Promise<RenderHtmlOutput>
  }
): Promise<{ pdfUrl: string; pdfKey: string }> {
  let companyInfo = input.companyInfo
  if (!companyInfo) {
    try {
      const [settingsRow] = await db
        .select()
        .from(schema.agencySettings)
        .limit(1)
      companyInfo = getCompanyInfo(settingsRow ?? null)
    } catch {
      companyInfo = getCompanyInfo(null)
    }
  }

  const html = buildLuxuryQuotationHtml({
    ...input,
    companyLogoB64: input.companyLogoB64 || "{{COMPANY_LOGO_DATA_URI}}",
    companyInfo,
  })

  const rendered = options?.renderFn
    ? await options.renderFn(html)
    : await renderHtmlViaGotenberg({
        html,
        width: 1240,
        height: 1754,
        deviceScaleFactor: 2,
        capturePng: false,
        capturePdf: true,
      })

  if (!rendered.pdfBuffer) {
    throw new Error("Gotenberg quotation PDF render returned an empty PDF buffer.")
  }

  const ownerSegment = sanitizeOwnerKeySegment(
    input.applicationId || input.referenceNumber
  )
  const versionNum = Math.max(1, Math.floor(input.quoteVersion ?? 1))
  const randomHex = crypto.randomBytes(16).toString("hex")
  const pdfKey = `quotes/${ownerSegment}/v${versionNum}-${randomHex}.pdf`

  const uploadRes = await uploadAssetToR2(
    pdfKey,
    rendered.pdfBuffer,
    "application/pdf"
  )

  const signedPdfUrl = createSignedMediaProxyUrl(uploadRes.key)

  return {
    pdfUrl: signedPdfUrl,
    pdfKey: uploadRes.key,
  }
}
