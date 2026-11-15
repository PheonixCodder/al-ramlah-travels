import { db } from "@/db"
import { getCompanyInfo, type CompanyInfo } from "@/lib/company-info"
import { escapeAttr, escapeHtml } from "@/lib/security/html-escape"
import { optimizePosterForSocialToR2, uploadAssetToR2 } from "../storage/r2"
import {
  getAirlineBadgeHtml,
  getCompanyLogoDataUri,
} from "./chromium-cdp"
import { renderHtmlViaGotenberg } from "./gotenberg"

export interface SinglePackageSpotlightInput {
  cardNumber?: string
  postRefCode?: string
  postCode?: string
  daysTitle?: string
  durationDays?: number
  routePill: string
  airlineName: string
  airlineIataCode?: string | null
  airlineLogoDataUri?: string | null
  airlineLogoUrl?: string | null
  baggageText?: string | null
  outboundBaggage?: string | null
  inboundBaggage?: string | null
  outboundFlightNo: string
  outboundDateLabel: string
  outboundRoute: string
  outboundDepTime: string
  outboundArrTime: string
  returnFlightNo: string
  returnDateLabel: string
  returnRoute: string
  returnDepTime: string
  returnArrTime: string
  makkahNights: string
  makkahHotelName: string
  makkahDistanceLabel: string
  madinahNights: string
  madinahHotelName: string
  madinahDistanceLabel: string
  mealPlanLabel?: string | null
  inclusions?: string[]
  giftedItems?: string[]
  giftedInclusions?: string[]
  sharingPricePkr?: number
  quadPricePkr?: number
  triplePricePkr?: number
  doublePricePkr?: number
  retailSharingPkr?: number
  retailQuadPkr?: number
  retailTriplePkr?: number
  retailDoublePkr?: number
  companyInfo?: CompanyInfo
}

function formatPkr(val: number | undefined): string {
  if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
    return "On Request"
  }
  return Math.round(val).toLocaleString("en-PK")
}

function normalizeDistance(raw: string): string {
  return raw.trim().replace(/^\(([^()]+)\)$/, "$1").trim()
}

function formatNightsBadge(rawNights: string): string {
  const cleaned = rawNights.trim().toUpperCase()
  const numericOnly = /^(\d+)\s*N(?:IGHTS?)?$/.exec(cleaned)
  if (numericOnly) {
    return `${escapeHtml(numericOnly[1]!)} NIGHTS`
  }
  if (cleaned.includes("NIGHT")) {
    return escapeHtml(cleaned)
  }
  return `${escapeHtml(cleaned)} NIGHTS`
}

function sanitizeHttpsOrDataLogoUrl(
  rawUrl: string | null | undefined
): string | null {
  if (!rawUrl) return null
  const trimmed = rawUrl.trim()
  if (trimmed.startsWith("data:image/")) return trimmed
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === "https:") return parsed.toString()
  } catch {
    return null
  }
  return null
}

function normalizeLogoSrc(logoOverride?: string): string {
  if (!logoOverride) return ""
  const trimmed = logoOverride.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("https://")) {
    return trimmed
  }
  return `data:image/png;base64,${trimmed}`
}

async function resolveLiveCompanyInfo(override?: CompanyInfo): Promise<CompanyInfo> {
  if (override) return override
  try {
    const row = await db.query.agencySettings.findFirst()
    return getCompanyInfo(row)
  } catch {
    return getCompanyInfo(null)
  }
}

/**
 * Builds the luxury Al Ramlah Single-Package Spotlight Poster HTML.
 * Wraps EVERY interpolated field in `escapeHtml()` / `escapeAttr()` (`T-025`),
 * injects strict CSP `<meta>`, formats `0`-tiers as `"On Request"` (`OD-09b`),
 * omits unstated baggage instead of fabricating `"23KG OUTBOUND"` (`T-087`),
 * and pulls dynamic agency branding from `getCompanyInfo()` (`T-087`).
 */
export function buildSinglePackageSpotlightHtml(
  pkg: SinglePackageSpotlightInput,
  companyLogoB64?: string
): string {
  const effectivePostRefCode = escapeHtml(
    pkg.postRefCode || pkg.postCode || "ART-SPOT-01"
  )
  const logoSrc = normalizeLogoSrc(companyLogoB64)
  const company = pkg.companyInfo ?? getCompanyInfo(null)

  const daysHeading = pkg.daysTitle?.trim()
    ? escapeHtml(pkg.daysTitle.trim())
    : `${Math.max(1, Math.round(pkg.durationDays || 15))} DAYS`

  const safeAirlineLogo = sanitizeHttpsOrDataLogoUrl(
    pkg.airlineLogoDataUri ?? pkg.airlineLogoUrl
  )
  const airlineHtml = safeAirlineLogo
    ? `<img src="${escapeAttr(safeAirlineLogo)}" alt="${escapeAttr(pkg.airlineName)}" style="max-height:58px;max-width:200px;object-fit:contain;" />`
    : getAirlineBadgeHtml(pkg.airlineName, pkg.airlineIataCode, null)

  const routePillHtml = pkg.routePill.includes("|")
    ? pkg.routePill
        .split("|")
        .map((s) => escapeHtml(s.trim()))
        .join(" <span class='sep'>|</span> ")
    : escapeHtml(pkg.routePill)

  const rawInclusions =
    pkg.inclusions ?? pkg.giftedItems ?? pkg.giftedInclusions
  const effectiveInclusions =
    rawInclusions && rawInclusions.length > 0
      ? rawInclusions.slice(0, 6)
      : [
          "Official Umrah Visa & Insurance",
          "Complete Ground Transport",
          "Haramain Hotel Reservations",
          "24/7 Concierge Assistance",
        ]

  const inclusionsHtml = effectiveInclusions
    .map(
      (inc) =>
        `<div class="inc-pill"><span class="inc-check">&#10022;</span><span>${escapeHtml(inc)}</span></div>`
    )
    .join("")

  const shVal = pkg.sharingPricePkr ?? pkg.retailSharingPkr ?? 0
  const qdVal = pkg.quadPricePkr ?? pkg.retailQuadPkr ?? 0
  const trVal = pkg.triplePricePkr ?? pkg.retailTriplePkr ?? 0
  const dbVal = pkg.doublePricePkr ?? pkg.retailDoublePkr ?? 0

  const baggageParts = pkg.baggageText?.trim()
    ? [escapeHtml(pkg.baggageText.trim())]
    : [
        pkg.outboundBaggage?.trim()
          ? `OUTBOUND: ${escapeHtml(pkg.outboundBaggage.trim())}`
          : "",
        pkg.inboundBaggage?.trim()
          ? `RETURN: ${escapeHtml(pkg.inboundBaggage.trim())}`
          : "",
      ].filter(Boolean)

  const makDist = normalizeDistance(pkg.makkahDistanceLabel)
  const madDist = normalizeDistance(pkg.madinahDistanceLabel)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src data: https://fonts.gstatic.com;" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 1080px 1520px; margin: 0; }
    html, body {
      width: 1080px;
      height: 1520px;
      overflow: hidden;
      font-family: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif;
      background: #052219;
      color: #FDFBF6;
    }
    .canvas {
      width: 1080px;
      height: 1520px;
      padding: 40px 44px 34px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background:
        radial-gradient(circle at 50% 10%, rgba(201, 162, 77, 0.25) 0%, transparent 52%),
        linear-gradient(180deg, #093527 0%, #051F16 64%, #03130E 100%);
      border: 3px solid rgba(201, 162, 77, 0.6);
    }
    .top-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 18px; border-bottom: 1.5px solid rgba(201, 162, 77, 0.42);
    }
    .brand { display: flex; align-items: center; gap: 16px; }
    .logo-box {
      width: 74px; height: 74px; border-radius: 16px;
      background: #FDFBF6; padding: 6px;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #C9A24D;
    }
    .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .brand-name { font-size: 26px; font-weight: 800; color: #F5E6B8; text-transform: uppercase; letter-spacing: 0.7px; }
    .brand-tag { font-size: 12px; color: #D8CFC0; letter-spacing: 1.4px; text-transform: uppercase; margin-top: 3px; }
    .airline-pill {
      background: #FDFBF6; border-radius: 14px; padding: 8px 18px;
      border: 1.5px solid #C9A24D; min-height: 58px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .hero { text-align: center; padding: 14px 0; }
    .ref-pill {
      display: inline-block; padding: 5px 16px; border-radius: 999px;
      background: rgba(201, 162, 77, 0.16); border: 1px solid rgba(201, 162, 77, 0.55);
      color: #F5E6B8; font-size: 12px; font-weight: 700; letter-spacing: 1px;
    }
    .hero-title {
      margin-top: 10px; font-size: 44px; font-weight: 800;
      color: #FDFBF6; letter-spacing: 1px; text-transform: uppercase;
    }
    .route-pill {
      margin-top: 8px; display: inline-block; padding: 7px 24px; border-radius: 999px;
      background: linear-gradient(90deg, #B88B2E, #E5C469, #B88B2E);
      color: #052017; font-weight: 800; font-size: 15px; letter-spacing: 0.8px;
    }
    .flight-card {
      background: #FDFBF6; color: #0B2A1E; border-radius: 16px;
      padding: 18px 22px; border: 2px solid #D8C390;
    }
    .sec-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .sec-title { font-size: 14px; font-weight: 800; color: #7C5E1E; text-transform: uppercase; letter-spacing: 0.8px; }
    .baggage-pill {
      background: #083325; color: #F5E6B8; border-radius: 999px;
      padding: 4px 14px; font-size: 11px; font-weight: 700;
    }
    .flight-rows { display: flex; flex-direction: column; gap: 10px; }
    .flight-leg {
      display: grid; grid-template-columns: 92px 96px 104px 130px 1fr 1fr;
      align-items: center; gap: 10px; padding: 10px 14px;
      background: #F5F0E4; border-radius: 10px; font-weight: 700; font-size: 14px;
    }
    .leg-tag {
      background: #083325; color: #F5E6B8; border-radius: 6px;
      padding: 4px 8px; font-size: 11px; text-align: center; text-transform: uppercase;
    }
    .leg-tm span { display: block; font-size: 9.5px; color: #6B7872; text-transform: uppercase; }
    .hotels-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .hotel-card {
      background: #FDFBF6; color: #0B2A1E; border-radius: 16px;
      padding: 18px 20px; border: 2px solid #D8C390;
    }
    .hc-top {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 10px; border-bottom: 1px dashed #D8C9AA;
    }
    .hc-city { font-size: 13px; font-weight: 800; color: #7C5E1E; text-transform: uppercase; }
    .hc-nights {
      background: #083325; color: #F5E6B8; padding: 4px 12px;
      border-radius: 999px; font-size: 11.5px; font-weight: 800;
    }
    .hc-name { margin-top: 12px; font-size: 20px; font-weight: 800; color: #07261B; line-height: 1.25; }
    .hc-dist { margin-top: 6px; font-size: 13px; font-weight: 700; color: #3D5B4E; }
    .inc-card {
      background: rgba(253, 251, 246, 0.08);
      border: 1px solid rgba(201, 162, 77, 0.4);
      border-radius: 14px; padding: 14px 18px;
    }
    .inc-grid { display: flex; flex-wrap: wrap; gap: 10px 18px; justify-content: center; }
    .inc-pill { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: #F7EFE0; }
    .inc-check { color: #E5C469; }
    .price-matrix { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .pm-col {
      background: #FDFBF6; color: #08291D; border-radius: 14px;
      padding: 14px 12px; text-align: center; border: 2px solid #D8C390;
    }
    .pm-lbl { font-size: 13px; font-weight: 800; color: #7C5E1E; text-transform: uppercase; }
    .pm-sub { font-size: 10.5px; font-weight: 600; color: #5D7068; margin-top: 2px; }
    .pm-val { margin-top: 8px; font-size: 22px; font-weight: 800; color: #06251A; }
    .footer-bar {
      padding-top: 14px; border-top: 1.5px solid rgba(201, 162, 77, 0.42);
      display: flex; align-items: center; justify-content: space-between;
      font-size: 12px;
    }
    .f-label { display: block; font-size: 9.5px; text-transform: uppercase; letter-spacing: 1px; color: #D4B059; font-weight: 700; }
    .f-val { font-weight: 700; color: #FDFBF6; }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="top-bar">
      <div class="brand">
        ${
          logoSrc
            ? `<div class="logo-box"><img src="${escapeAttr(logoSrc)}" alt="${escapeAttr(company.agencyName)}" /></div>`
            : `<div class="logo-box"><span style="font-weight:900;color:#083325;font-size:22px;">ART</span></div>`
        }
        <div>
          <div class="brand-name">${escapeHtml(company.agencyName)}</div>
          <div class="brand-tag">${escapeHtml(company.tagline)}</div>
        </div>
      </div>
      <div class="airline-pill">${airlineHtml}</div>
    </div>

    <div class="hero">
      <div class="ref-pill">POST REF: ${effectivePostRefCode}${pkg.cardNumber ? ` &bull; CARD #${escapeHtml(pkg.cardNumber)}` : ""}</div>
      <div class="hero-title">${daysHeading} UMRAH PACKAGE</div>
      <div class="route-pill">${routePillHtml}</div>
    </div>

    <div class="flight-card">
      <div class="sec-head">
        <div class="sec-title">Confirmed Flight Schedule</div>
        ${
          baggageParts.length > 0
            ? `<div class="baggage-pill">${baggageParts.join(" &bull; ")}</div>`
            : ""
        }
      </div>
      <div class="flight-rows">
        <div class="flight-leg">
          <span class="leg-tag">Outbound</span>
          <span>${escapeHtml(pkg.outboundFlightNo)}</span>
          <span>${escapeHtml(pkg.outboundDateLabel)}</span>
          <span>${escapeHtml(pkg.outboundRoute)}</span>
          <div class="leg-tm"><span>Departure</span>${escapeHtml(pkg.outboundDepTime)}</div>
          <div class="leg-tm"><span>Arrival</span>${escapeHtml(pkg.outboundArrTime)}</div>
        </div>
        <div class="flight-leg">
          <span class="leg-tag">Return</span>
          <span>${escapeHtml(pkg.returnFlightNo)}</span>
          <span>${escapeHtml(pkg.returnDateLabel)}</span>
          <span>${escapeHtml(pkg.returnRoute)}</span>
          <div class="leg-tm"><span>Departure</span>${escapeHtml(pkg.returnDepTime)}</div>
          <div class="leg-tm"><span>Arrival</span>${escapeHtml(pkg.returnArrTime)}</div>
        </div>
      </div>
    </div>

    <div class="hotels-grid">
      <div class="hotel-card">
        <div class="hc-top">
          <span class="hc-city">Makkah Hotel</span>
          <span class="hc-nights">${formatNightsBadge(pkg.makkahNights)}</span>
        </div>
        <div class="hc-name">${escapeHtml(pkg.makkahHotelName)}</div>
        <div class="hc-dist">${escapeHtml(makDist)}${pkg.mealPlanLabel ? ` &bull; ${escapeHtml(pkg.mealPlanLabel)}` : ""}</div>
      </div>
      <div class="hotel-card">
        <div class="hc-top">
          <span class="hc-city">Madinah Hotel</span>
          <span class="hc-nights">${formatNightsBadge(pkg.madinahNights)}</span>
        </div>
        <div class="hc-name">${escapeHtml(pkg.madinahHotelName)}</div>
        <div class="hc-dist">${escapeHtml(madDist)}${pkg.mealPlanLabel ? ` &bull; ${escapeHtml(pkg.mealPlanLabel)}` : ""}</div>
      </div>
    </div>

    <div class="inc-card">
      <div class="inc-grid">${inclusionsHtml}</div>
    </div>

    <div class="price-matrix">
      <div class="pm-col">
        <div class="pm-lbl">Sharing</div>
        <div class="pm-sub">Per Person</div>
        <div class="pm-val">${escapeHtml(formatPkr(shVal))}</div>
      </div>
      <div class="pm-col">
        <div class="pm-lbl">Quad</div>
        <div class="pm-sub">4 Bed Room</div>
        <div class="pm-val">${escapeHtml(formatPkr(qdVal))}</div>
      </div>
      <div class="pm-col">
        <div class="pm-lbl">Triple</div>
        <div class="pm-sub">3 Bed Room</div>
        <div class="pm-val">${escapeHtml(formatPkr(trVal))}</div>
      </div>
      <div class="pm-col">
        <div class="pm-lbl">Double</div>
        <div class="pm-sub">2 Bed Room</div>
        <div class="pm-val">${escapeHtml(formatPkr(dbVal))}</div>
      </div>
    </div>

    <div class="footer-bar">
      <div>
        <span class="f-label">Call / WhatsApp</span>
        <span class="f-val">${escapeHtml(company.hotlineDisplay)}</span>
      </div>
      <div style="text-align:right;">
        <span class="f-label">Office Address</span>
        <span class="f-val">${escapeHtml(company.officeAddress)}</span>
      </div>
    </div>
  </div>
</body>
</html>`
}

export const buildSinglePackagePosterHtml = buildSinglePackageSpotlightHtml
export const renderSinglePackagePosterHtml = buildSinglePackageSpotlightHtml

export async function renderAndUploadSinglePackagePoster(
  pkg: SinglePackageSpotlightInput
): Promise<{ pngUrl: string; pdfUrl: string; socialJpegUrl?: string }> {
  const [companyLogoDataUri, companyInfo] = await Promise.all([
    getCompanyLogoDataUri(),
    resolveLiveCompanyInfo(pkg.companyInfo),
  ])

  const html = buildSinglePackageSpotlightHtml(
    {
      ...pkg,
      companyInfo,
    },
    companyLogoDataUri
  )

  const { pngBuffer, pdfBuffer } = await renderHtmlViaGotenberg({
    html,
    width: 1080,
    height: 1520,
    deviceScaleFactor: 2,
    capturePng: true,
    capturePdf: true,
  })

  if (!pngBuffer || !pdfBuffer) {
    throw new Error("Gotenberg did not return PNG and PDF buffers for single spotlight poster")
  }

  const effectiveRef = (pkg.postRefCode || pkg.postCode || "art-spot-01")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
  const baseKey = `posters/spotlights/${effectiveRef}`

  const [pngUpload, pdfUpload] = await Promise.all([
    uploadAssetToR2(`${baseKey}_4k.png`, pngBuffer, "image/png"),
    uploadAssetToR2(`${baseKey}_vector.pdf`, pdfBuffer, "application/pdf"),
  ])

  let socialJpegUrl: string | undefined
  try {
    const socialRes = await optimizePosterForSocialToR2(pngBuffer, baseKey)
    socialJpegUrl = socialRes.socialJpegUrl
  } catch {
    // Non-fatal fallback if sharp optimization fails on synthetic buffer
  }

  return {
    pngUrl: pngUpload.url,
    pdfUrl: pdfUpload.url,
    socialJpegUrl,
  }
}
