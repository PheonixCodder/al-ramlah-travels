import { getCompanyLogoBase64 } from "./chromium-cdp"
import { renderHtmlViaGotenberg } from "./gotenberg"
import { uploadAssetToR2 } from "../storage/r2"

export interface LuxuryQuotationPdfInput {
  referenceNumber: string
  clientName?: string
  customerName?: string
  customerCity?: string
  adults: number
  children: number
  infants: number
  totalNights?: number
  totalDays?: number
  dateRangeText?: string
  airlineName: string
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
  makkahHotelName: string
  makkahNights: number
  makkahStars?: number
  makkahDistance?: string
  makkahDateRange?: string
  makkahCheckIn?: string
  makkahCheckOut?: string
  makkahMealPlanLabel?: string
  makkahMealPlan?: string
  makkahAllocationLabel?: string
  makkahRoomSummary?: string
  madinahHotelName: string
  madinahNights: number
  madinahStars?: number
  madinahDistance?: string
  madinahDateRange?: string
  madinahCheckIn?: string
  madinahCheckOut?: string
  madinahMealPlanLabel?: string
  madinahMealPlan?: string
  madinahAllocationLabel?: string
  madinahRoomSummary?: string
  transportVehicleName: string
  transportRouteSummary?: string
  supplierName?: string
  notesCustomer?: string | null
  transportSectors?: Array<{
    stepLabel: string
    dateText: string
    routeTitle: string
    routeDesc: string
  }>
  grandTotalPkr: number
}

function sanitizeNoHyphensNoSar(text: string): string {
  return text
    .replace(/\bSAR\b/gi, "PKR")
    .replace(/(\w)-(\w)/g, "$1 $2")
}

export function buildLuxuryQuotationHtml(
  rawInput: LuxuryQuotationPdfInput,
  companyLogoB64: string
): string {
  const outboundDateText = rawInput.outboundDateText || rawInput.outboundDate || "12 NOV 2026"
  const returnDateText = rawInput.returnDateText || rawInput.returnDate || "24 NOV 2026"
  const input = {
    ...rawInput,
    clientName: rawInput.clientName || rawInput.customerName || "Valued Pilgrim Family",
    totalNights:
      rawInput.totalNights ??
      rawInput.makkahNights + rawInput.madinahNights,
    dateRangeText:
      rawInput.dateRangeText || `${outboundDateText} to ${returnDateText}`,
    outboundDateText,
    outboundRouteTitle:
      rawInput.outboundRouteTitle || rawInput.outboundRoute || "Lahore to Jeddah",
    outboundRouteDesc:
      rawInput.outboundRouteDesc ||
      rawInput.baggageLabel ||
      "Confirmed Economy Return Tickets with Baggage & Zamzam Allowance.",
    returnDateText,
    returnRouteTitle:
      rawInput.returnRouteTitle || rawInput.returnRoute || "Jeddah to Lahore",
    returnRouteDesc:
      rawInput.returnRouteDesc ||
      "Confirmed Return Departure Transfer & Boarding Assistance.",
    makkahDateRange:
      rawInput.makkahDateRange || `${rawInput.makkahNights} Nights Haramain Stay`,
    makkahCheckIn: rawInput.makkahCheckIn || outboundDateText,
    makkahCheckOut: rawInput.makkahCheckOut || "Intercity Transfer Day",
    makkahMealPlanLabel:
      rawInput.makkahMealPlanLabel || rawInput.makkahMealPlan || "Room Only",
    makkahAllocationLabel:
      rawInput.makkahAllocationLabel ||
      rawInput.makkahRoomSummary ||
      "Private Family Room",
    madinahDateRange:
      rawInput.madinahDateRange || `${rawInput.madinahNights} Nights Nabawi Stay`,
    madinahCheckIn: rawInput.madinahCheckIn || "Intercity Transfer Day",
    madinahCheckOut: rawInput.madinahCheckOut || returnDateText,
    madinahMealPlanLabel:
      rawInput.madinahMealPlanLabel || rawInput.madinahMealPlan || "Room Only",
    madinahAllocationLabel:
      rawInput.madinahAllocationLabel ||
      rawInput.madinahRoomSummary ||
      "Private Family Room",
    transportSectors: rawInput.transportSectors || [],
  }
  const totalTravelers = input.adults + input.children + input.infants
  const paxBreakdownParts = [`${input.adults} Adult${input.adults === 1 ? "" : "s"}`]
  if (input.children > 0) {
    paxBreakdownParts.push(
      `${input.children} Child${input.children === 1 ? "" : "ren"}`
    )
  }
  if (input.infants > 0) {
    paxBreakdownParts.push(
      `${input.infants} Infant${input.infants === 1 ? "" : "s"}`
    )
  }
  const paxBreakdown = sanitizeNoHyphensNoSar(paxBreakdownParts.join(" · "))
  const clientName = sanitizeNoHyphensNoSar(input.clientName)
  const airlineName = sanitizeNoHyphensNoSar(input.airlineName)
  const makkahHotel = sanitizeNoHyphensNoSar(input.makkahHotelName)
  const madinahHotel = sanitizeNoHyphensNoSar(input.madinahHotelName)
  const vehicleName = sanitizeNoHyphensNoSar(input.transportVehicleName)
  const dateRange = sanitizeNoHyphensNoSar(input.dateRangeText)
  const priceFormatted = `PKR ${Math.max(0, Math.round(input.grandTotalPkr)).toLocaleString()}`

  const sectors =
    input.transportSectors.length > 0
      ? input.transportSectors.slice(0, 3)
      : [
          {
            stepLabel: "Sector 01",
            dateText: input.makkahCheckIn,
            routeTitle: "Arrival Airport to First Hotel",
            routeDesc: `Private arrival pickup and direct transfer in ${vehicleName}.`,
          },
          {
            stepLabel: "Sector 02",
            dateText: input.makkahCheckOut,
            routeTitle: "Makkah Hotel to Madinah Hotel",
            routeDesc: `Comfortable intercity journey between ${makkahHotel} and ${madinahHotel}.`,
          },
          {
            stepLabel: "Sector 03",
            dateText: input.madinahCheckOut,
            routeTitle: "Hotel to Departure Airport",
            routeDesc: `Timely departure transfer to airport for your return flight.`,
          },
        ]

  const sectorsHtml = sectors
    .map(
      (s) => `
      <div class="transport-card">
        <div>
          <div class="transport-top">
            <span class="step-pill">${sanitizeNoHyphensNoSar(s.stepLabel)}</span>
            <span class="transport-date">${sanitizeNoHyphensNoSar(s.dateText)}</span>
          </div>
          <div class="transport-route">${sanitizeNoHyphensNoSar(s.routeTitle)}</div>
          <div class="transport-sub">${sanitizeNoHyphensNoSar(s.routeDesc)}</div>
        </div>
        <div class="meal-tag" style="margin-top: 10px;">${vehicleName}</div>
      </div>`
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Al Ramlah Travels Quotation (${clientName})</title>
  <style>
    :root { --primary: #0C2633; --primary-mid: #143446; --accent: #9A7433; --gold-light: #E2C58A; --gold-mid: #C9A25B; --sand-bg: #F5EFE1; --sand-border: #E3D8BF; --text: #14232E; --muted: #5E6B73; --bg: #FDFBF6; --card-bg: #FFFFFF; }

    @page {
      size: A4;
      margin: 12mm 15mm;
      background: var(--bg);
      @bottom-right {
        content: counter(page) " / " counter(pages);
        font-family: 'Inter', 'Noto Sans', sans-serif;
        font-size: 8.5pt;
        color: var(--muted);
      }
      @bottom-left {
        content: "03274029701 · 03190462638    www.alramlahtravels.com";
        font-family: 'Inter', 'Noto Sans', sans-serif;
        font-size: 8.5pt;
        color: var(--muted);
      }
    }

    @page :first {
      margin: 0;
      background: #0C2633;
      @bottom-right { content: none; }
      @bottom-left { content: none; }
    }

    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: transparent; }
    body { font-family: 'Inter', 'Noto Sans', sans-serif; font-size: 9.8pt; line-height: 1.55; color: var(--text); }

    main.document-flow { width: 100%; margin: 0; padding: 0; }

    .cover-page { position: relative; width: 100%; min-height: 297mm; padding: 22mm 22mm 18mm 22mm; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; color: #F5EFE1; page-break-after: always; break-after: page; overflow: hidden; background: #0C2633; }
    .cover-svg-bg { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
    .cover-page > :not(.cover-svg-bg) { position: relative; z-index: 1; width: 100%; }
    .cover-logo { width: 175px; height: auto; margin: 0 auto 14px auto; display: block; border-radius: 14px; }
    .cover-brand { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 28pt; font-weight: 700; letter-spacing: 3px; color: #F5EFE1; margin: 0 0 6px 0; }
    .cover-subbrand { font-size: 11pt; letter-spacing: 7px; color: var(--gold-mid); margin: 0 0 12px 0; font-weight: 500; }
    .cover-tagline { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-style: italic; font-size: 11.5pt; color: var(--gold-light); margin: 0 0 22px 0; }
    .cover-title { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 32pt; font-weight: 700; letter-spacing: 2px; color: var(--gold-light); margin: 14px 0 8px 0; }
    .cover-subtitle { font-size: 11pt; letter-spacing: 5px; color: #F5EFE1; text-transform: uppercase; margin: 0 0 24px 0; }
    .cover-client-label { font-size: 9pt; letter-spacing: 3px; text-transform: uppercase; color: var(--gold-mid); margin: 18px 0 6px 0; }
    .cover-client-name { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 19pt; font-weight: 700; color: #FFFFFF; margin: 0 0 6px 0; }
    .cover-client-meta { font-size: 10.5pt; color: var(--gold-light); margin: 0 0 18px 0; }
    .cover-summary-table { width: 92%; margin: 12px auto 0 auto; border-collapse: collapse; }
    .cover-summary-table th { font-size: 8.5pt; letter-spacing: 1.5px; text-transform: uppercase; color: var(--gold-mid); border-bottom: 1px solid rgba(201, 162, 91, 0.45); padding: 8px 10px; text-align: center; }
    .cover-summary-table td { font-size: 10.5pt; font-weight: 600; color: #F5EFE1; border-bottom: 1px solid rgba(201, 162, 91, 0.25); padding: 10px 10px; text-align: center; }
    .cover-footer { font-size: 9.5pt; color: #F5EFE1; letter-spacing: 1px; }
    .cover-footer-url { font-size: 9.5pt; color: var(--gold-mid); margin-top: 6px; letter-spacing: 0.8px; }

    .full-bleed-header { background: var(--primary); color: #F5EFE1; padding: 12px 18px; margin-bottom: 14px; border-bottom: 3px solid var(--gold-mid); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-logo { width: 42px; height: auto; display: block; border-radius: 6px; }
    .header-brand-title { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 13pt; font-weight: 700; letter-spacing: 1.5px; color: #F5EFE1; margin: 0; }
    .header-brand-sub { font-size: 7pt; letter-spacing: 3.5px; color: var(--gold-mid); margin: 2px 0 0 0; }
    .header-right { text-align: right; }
    .header-doc-title { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 12.5pt; color: var(--gold-light); letter-spacing: 1px; margin: 0; }
    .header-doc-sub { font-size: 7.5pt; letter-spacing: 2px; color: #F5EFE1; text-transform: uppercase; margin: 2px 0 0 0; }

    h1 { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 17pt; line-height: 1.22; margin: 0 0 6px 0; color: var(--primary); }
    .intro-lead { font-size: 9.8pt; line-height: 1.55; color: var(--text); margin: 0 0 12px 0; }
    .section-label { font-size: 8.2pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); margin: 12px 0 8px 0; break-after: avoid; page-break-after: avoid; }

    .overview-grid { display: grid; grid-template-columns: 1.35fr 0.95fr 1.15fr; gap: 12px; margin-bottom: 12px; }
    .info-card { background: var(--card-bg); border: 1px solid var(--sand-border); border-radius: 10px; padding: 11px 14px; }
    .info-card-label { font-size: 7.2pt; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; }
    .info-card-value { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 11.8pt; font-weight: 700; color: var(--primary); margin-bottom: 2px; }
    .info-card-sub { font-size: 8.5pt; color: var(--muted); }

    .feature-card { display: flex; background: var(--card-bg); border: 1px solid var(--sand-border); border-radius: 12px; overflow: hidden; margin-bottom: 15px; break-inside: avoid; page-break-inside: avoid; }
    .feature-left { width: 24%; background: var(--primary); color: #F5EFE1; padding: 15px 12px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; border-right: 3px solid var(--gold-mid); }
    .badge-circle { width: 25px; height: 25px; border-radius: 50%; background: var(--gold-mid); color: var(--primary); font-size: 8pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
    .feature-left-cat { font-size: 7.8pt; letter-spacing: 2px; text-transform: uppercase; color: #F5EFE1; margin-bottom: 2px; }
    .feature-left-big { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 20pt; font-weight: 700; line-height: 1.05; color: var(--gold-light); margin: 2px 0; }
    .feature-left-unit { font-size: 7.2pt; letter-spacing: 2.2px; text-transform: uppercase; color: var(--gold-mid); margin-top: 2px; }
    .feature-body { width: 76%; padding: 15px 18px; display: flex; flex-direction: column; justify-content: center; }
    .feature-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .col-divider { border-left: 1px solid var(--sand-border); padding-left: 14px; }
    .field-label { font-size: 7.2pt; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; color: var(--accent); margin-bottom: 3px; }
    .field-title { font-size: 10.6pt; font-weight: 700; color: var(--primary); margin-bottom: 3px; }
    .field-desc { font-size: 8.8pt; color: var(--muted); line-height: 1.42; }
    .meal-tag { display: inline-block; margin-top: 6px; padding: 3.5px 9px; background: var(--sand-bg); border: 1px solid var(--sand-border); border-radius: 6px; font-size: 7.6pt; font-weight: 700; color: var(--primary); letter-spacing: 0.3px; white-space: nowrap; }

    .transport-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
    .transport-card { background: var(--card-bg); border: 1px solid var(--sand-border); border-radius: 10px; padding: 14px 15px; display: flex; flex-direction: column; justify-content: space-between; }
    .transport-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .step-pill { background: var(--primary); color: var(--gold-light); font-size: 7.5pt; font-weight: 700; padding: 3px 9px; border-radius: 12px; letter-spacing: 1px; text-transform: uppercase; }
    .transport-date { font-size: 8pt; font-weight: 600; color: var(--accent); }
    .transport-route { font-size: 10pt; font-weight: 700; color: var(--primary); margin-bottom: 5px; line-height: 1.35; }
    .transport-sub { font-size: 8.6pt; color: var(--muted); line-height: 1.42; }

    .included-card { background: var(--card-bg); border: 1px solid var(--sand-border); border-radius: 12px; padding: 16px 20px; margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
    .included-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin-top: 10px; }
    .included-item { display: flex; align-items: flex-start; gap: 8px; font-size: 9.2pt; color: var(--text); line-height: 1.42; }
    .check-mark { color: var(--accent); font-weight: 700; font-size: 10.5pt; line-height: 1.2; }

    .total-price-banner { background: var(--primary); border: 2px solid var(--gold-mid); border-radius: 12px; padding: 18px 24px; color: #F5EFE1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
    .total-banner-label { font-size: 8.2pt; letter-spacing: 2px; text-transform: uppercase; color: var(--gold-mid); margin-bottom: 4px; }
    .total-banner-title { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 15pt; font-weight: 700; color: #FFFFFF; margin-bottom: 3px; }
    .total-banner-sub { font-size: 8.8pt; color: var(--gold-light); }
    .total-banner-amount { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 24pt; font-weight: 700; color: var(--gold-light); text-align: right; white-space: nowrap; }

    .contact-card { background: var(--primary); border: 2px solid var(--gold-mid); border-radius: 12px; padding: 18px 24px; color: #F5EFE1; display: flex; align-items: center; justify-content: space-between; break-inside: avoid; page-break-inside: avoid; }
    .contact-left { width: 34%; text-align: center; border-right: 1px solid rgba(201, 162, 91, 0.35); padding-right: 18px; }
    .contact-logo { width: 82px; height: auto; margin: 0 auto 6px auto; display: block; border-radius: 10px; }
    .contact-brand { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 13pt; font-weight: 700; letter-spacing: 2px; color: #F5EFE1; }
    .contact-subbrand { font-size: 7pt; letter-spacing: 4px; color: var(--gold-mid); margin-top: 2px; }
    .contact-right { width: 66%; padding-left: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
    .c-label { font-size: 7pt; letter-spacing: 1.8px; text-transform: uppercase; color: var(--gold-mid); margin-bottom: 3px; }
    .c-val { font-size: 9.5pt; font-weight: 600; color: #FFFFFF; line-height: 1.4; }
  </style>
</head>
<body>

  <!-- PAGE 1: DEDICATED COVER / OPENER PAGE -->
  <div class="cover-page">
    <svg class="cover-svg-bg" viewBox="0 0 1240 1754" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="cover-lattice" width="155" height="155" patternUnits="userSpaceOnUse">
          <polygon points="77,55 99,77 77,99 55,77" fill="none" stroke="#163748" stroke-width="2"/>
          <polygon points="77,67 87,77 77,87 67,77" fill="none" stroke="#163748" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="1240" height="1754" fill="#0C2633"/>
      <rect width="1240" height="1754" fill="url(#cover-lattice)"/>
      <rect x="56" y="56" width="1128" height="1642" fill="none" stroke="#C9A25B" stroke-width="3"/>
      <rect x="68" y="68" width="1104" height="1618" fill="none" stroke="#C9A25B" stroke-width="1"/>
      <polygon points="56,45 67,56 56,67 45,56" fill="#C9A25B"/>
      <polygon points="1184,45 1195,56 1184,67 1173,56" fill="#C9A25B"/>
      <polygon points="56,1687 67,1698 56,1709 45,1698" fill="#C9A25B"/>
      <polygon points="1184,1687 1195,1698 1184,1709 1173,1698" fill="#C9A25B"/>
    </svg>

    <div style="margin-top: 14mm;">
      <img class="cover-logo" src="data:image/png;base64,${companyLogoB64}" alt="Al Ramlah Travels Logo">
      <div class="cover-brand">AL RAMLAH</div>
      <div class="cover-subbrand">T R A V E L S</div>
      <div class="cover-tagline">Where Purpose Meets Excellence</div>
    </div>

    <div>
      <div class="cover-title">UMRAH 2026</div>
      <div class="cover-subtitle">Bespoke Family Quotation &amp; Travel Plan</div>

      <div class="cover-client-label">Prepared Exclusively For</div>
      <div class="cover-client-name">${clientName}</div>
      <div class="cover-client-meta">${totalTravelers} Travelers (${paxBreakdown})  |  ${dateRange} (${input.totalNights} Nights)</div>

      <table class="cover-summary-table">
        <thead>
          <tr>
            <th>Airline</th>
            <th>Makkah (${input.makkahNights} Nights)</th>
            <th>Madinah (${input.madinahNights} Nights)</th>
            <th>Private Transport</th>
            <th>Total Package</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${airlineName}</td>
            <td>${makkahHotel}</td>
            <td>${madinahHotel}</td>
            <td>${vehicleName}</td>
            <td>${priceFormatted}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="margin-bottom: 8mm;">
      <div class="cover-footer">Hajj  •  Umrah  •  Flights  •  Hotels  •  Tours</div>
      <div class="cover-footer-url">www.alramlahtravels.com  |  03274029701 · 03190462638</div>
    </div>
  </div>

  <!-- PAGE 2 & 3: CARD-BASED QUOTATION FLOW -->
  <main class="document-flow">

    <div class="full-bleed-header">
      <div class="header-left">
        <img class="header-logo" src="data:image/png;base64,${companyLogoB64}" alt="Logo">
        <div>
          <div class="header-brand-title">AL RAMLAH</div>
          <div class="header-brand-sub">T R A V E L S</div>
        </div>
      </div>
      <div class="header-right">
        <div class="header-doc-title">UMRAH 2026</div>
        <div class="header-doc-sub">Family Quotation &amp; Itinerary</div>
      </div>
    </div>

    <h1>Your ${input.totalNights} Night Family Umrah Journey</h1>
    <p class="intro-lead">Your ${input.totalNights} night Umrah journey combines return flights on ${airlineName}, Umrah visas for all ${totalTravelers} travelers, ${input.makkahNights} nights in Makkah, ${input.madinahNights} nights in Madinah, and ground transfers in ${vehicleName}.</p>

    <div class="section-label">Client &amp; Traveler Summary</div>
    <div class="overview-grid">
      <div class="info-card">
        <div class="info-card-label">Client / Family Name</div>
        <div class="info-card-value">${clientName}</div>
        <div class="info-card-sub">Bespoke Umrah Quotation</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Total Duration</div>
        <div class="info-card-value">${input.totalNights} Nights</div>
        <div class="info-card-sub">${dateRange}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Total Travelers &amp; Visas</div>
        <div class="info-card-value">${totalTravelers} Travelers (${totalTravelers} Visas)</div>
        <div class="info-card-sub">${paxBreakdown}</div>
      </div>
    </div>

    <div class="section-label">Return Air Travel &amp; Flight Segments</div>
    <div class="feature-card">
      <div class="feature-left">
        <div class="badge-circle">01</div>
        <div class="feature-left-cat">AIRLINE</div>
        <div class="feature-left-big">${airlineName}</div>
        <div class="feature-left-unit">${totalTravelers} TICKETS</div>
      </div>
      <div class="feature-body">
        <div class="feature-grid-2">
          <div>
            <div class="field-label">Outbound Flight · ${sanitizeNoHyphensNoSar(input.outboundDateText)}</div>
            <div class="field-title">${sanitizeNoHyphensNoSar(input.outboundRouteTitle)}</div>
            <div class="field-desc">${sanitizeNoHyphensNoSar(input.outboundRouteDesc)}</div>
            <div class="meal-tag">${paxBreakdown}</div>
          </div>
          <div class="col-divider">
            <div class="field-label">Return Flight · ${sanitizeNoHyphensNoSar(input.returnDateText)}</div>
            <div class="field-title">${sanitizeNoHyphensNoSar(input.returnRouteTitle)}</div>
            <div class="field-desc">${sanitizeNoHyphensNoSar(input.returnRouteDesc)}</div>
            <div class="meal-tag">Umrah Visas Included for All ${totalTravelers} Travelers</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-label">Haramain Accommodation Plan (${input.totalNights} Nights Total)</div>

    <div class="feature-card">
      <div class="feature-left">
        <div class="badge-circle">01</div>
        <div class="feature-left-cat">MAKKAH</div>
        <div class="feature-left-big">${input.makkahNights}</div>
        <div class="feature-left-unit">NIGHTS</div>
      </div>
      <div class="feature-body">
        <div class="feature-grid-2">
          <div>
            <div class="field-label">Makkah Hotel Property</div>
            <div class="field-title">${makkahHotel}</div>
            <div class="field-desc">Distinguished Haramain hospitality selected for comfort and convenient Haram access in Makkah.</div>
            <div class="meal-tag">Included Meal Plan: ${sanitizeNoHyphensNoSar(input.makkahMealPlanLabel)}</div>
          </div>
          <div class="col-divider">
            <div class="field-label">Stay Schedule &amp; Room Allocation</div>
            <div class="field-title">${sanitizeNoHyphensNoSar(input.makkahDateRange)}</div>
            <div class="field-desc"><strong>Check In:</strong> ${sanitizeNoHyphensNoSar(input.makkahCheckIn)}<br><strong>Check Out:</strong> ${sanitizeNoHyphensNoSar(input.makkahCheckOut)}</div>
            <div class="meal-tag">Allocation: ${sanitizeNoHyphensNoSar(input.makkahAllocationLabel)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="feature-card" style="margin-bottom: 14px;">
      <div class="feature-left">
        <div class="badge-circle">02</div>
        <div class="feature-left-cat">MADINAH</div>
        <div class="feature-left-big">${input.madinahNights}</div>
        <div class="feature-left-unit">NIGHTS</div>
      </div>
      <div class="feature-body">
        <div class="feature-grid-2">
          <div>
            <div class="field-label">Madinah Hotel Property</div>
            <div class="field-title">${madinahHotel}</div>
            <div class="field-desc">Peaceful sanctuary steps away from Masjid Al Nabawi, offering convenient access for families.</div>
            <div class="meal-tag">Included Meal Plan: ${sanitizeNoHyphensNoSar(input.madinahMealPlanLabel)}</div>
          </div>
          <div class="col-divider">
            <div class="field-label">Stay Schedule &amp; Room Allocation</div>
            <div class="field-title">${sanitizeNoHyphensNoSar(input.madinahDateRange)}</div>
            <div class="field-desc"><strong>Check In:</strong> ${sanitizeNoHyphensNoSar(input.madinahCheckIn)}<br><strong>Check Out:</strong> ${sanitizeNoHyphensNoSar(input.madinahCheckOut)}</div>
            <div class="meal-tag">Allocation: ${sanitizeNoHyphensNoSar(input.madinahAllocationLabel)}</div>
          </div>
        </div>
      </div>
    </div>

    <div style="break-inside: avoid; page-break-inside: avoid;">
      <div class="section-label">Ground Transportation · ${vehicleName}</div>
      <p class="intro-lead" style="margin-bottom: 12px;">Dedicated transfers in <strong>${vehicleName}</strong> with full luggage capacity across all travel legs.</p>
      <div class="transport-grid">
        ${sectorsHtml}
      </div>
    </div>

    <div class="included-card">
      <div class="field-label" style="margin-bottom: 2px;">Everything Included in Your Family Umrah Package</div>
      <div class="included-grid">
        <div class="included-item">
          <span class="check-mark">✓</span>
          <span><strong>${airlineName} Return Air Tickets:</strong> Outbound ${sanitizeNoHyphensNoSar(input.outboundRouteTitle)} and return ${sanitizeNoHyphensNoSar(input.returnRouteTitle)} for ${paxBreakdown}.</span>
        </div>
        <div class="included-item">
          <span class="check-mark">✓</span>
          <span><strong>Complete Umrah Visa Processing:</strong> Official Umrah visas arranged for all ${totalTravelers} travelers.</span>
        </div>
        <div class="included-item">
          <span class="check-mark">✓</span>
          <span><strong>Makkah Accommodation (${input.makkahNights} Nights):</strong> ${makkahHotel} (${sanitizeNoHyphensNoSar(input.makkahMealPlanLabel)}).</span>
        </div>
        <div class="included-item">
          <span class="check-mark">✓</span>
          <span><strong>Madinah Accommodation (${input.madinahNights} Nights):</strong> ${madinahHotel} (${sanitizeNoHyphensNoSar(input.madinahMealPlanLabel)}).</span>
        </div>
        <div class="included-item">
          <span class="check-mark">✓</span>
          <span><strong>${vehicleName} Ground Transfers:</strong> Door to door ground transport across Jeddah, Makkah and Madinah.</span>
        </div>
      </div>
    </div>

    <div class="total-price-banner">
      <div>
        <div class="total-banner-label">Complete Family Package Price</div>
        <div class="total-banner-title">${clientName}</div>
        <div class="total-banner-sub">All inclusive for ${totalTravelers} Travelers (${paxBreakdown}) · ${input.totalNights} Nights · Flights, Visas, Hotels &amp; ${vehicleName}</div>
      </div>
      <div class="total-banner-amount">${priceFormatted}</div>
    </div>

    <div class="contact-card">
      <div class="contact-left">
        <img class="contact-logo" src="data:image/png;base64,${companyLogoB64}" alt="Al Ramlah Travels">
        <div class="contact-brand">AL RAMLAH</div>
        <div class="contact-subbrand">T R A V E L S</div>
      </div>
      <div class="contact-right">
        <div>
          <div class="c-label">Call / WhatsApp</div>
          <div class="c-val">03274029701<br>03190462638</div>
        </div>
        <div>
          <div class="c-label">Email &amp; Website</div>
          <div class="c-val">alramlahtravels@gmail.com<br>www.alramlahtravels.com</div>
        </div>
        <div style="grid-column: span 2;">
          <div class="c-label">Office Address</div>
          <div class="c-val">Office no 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt</div>
        </div>
      </div>
    </div>

  </main>

</body>
</html>`
}

export async function renderAndUploadLuxuryQuotationPdf(
  input: LuxuryQuotationPdfInput
): Promise<{ pdfUrl: string }> {
  const companyLogoB64 = await getCompanyLogoBase64()
  const html = buildLuxuryQuotationHtml(input, companyLogoB64)
  const { pdfBuffer } = await renderHtmlViaGotenberg({
    html,
    width: 1240,
    height: 1754,
    deviceScaleFactor: 2,
    capturePng: false,
    capturePdf: true,
  })

  const key = `quotations/${input.referenceNumber.toLowerCase()}_umrah_quotation.pdf`
  const uploaded = await uploadAssetToR2(key, pdfBuffer!, "application/pdf")
  return { pdfUrl: uploaded.url }
}
