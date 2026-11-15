import { db } from "@/db"
import { getCompanyInfo, type CompanyInfo } from "@/lib/company-info"
import { escapeAttr, escapeHtml } from "@/lib/security/html-escape"
import { optimizePosterForSocialToR2, uploadAssetToR2 } from "../storage/r2"
import {
  getAirlineBadgeHtml,
  getCompanyLogoDataUri,
} from "./chromium-cdp"
import { renderBatchViaGotenberg, renderHtmlViaGotenberg } from "./gotenberg"

export const MAX_CARDS_PER_POSTER_SHEET = 10
export const MAX_CARDS_PER_MULTI_POSTER_SHEET = MAX_CARDS_PER_POSTER_SHEET

export interface MultiPosterCardInput {
  num?: string
  cardNumber?: string
  postRefCode?: string | null
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
  sharingPricePkr?: number
  quadPricePkr?: number
  triplePricePkr?: number
  doublePricePkr?: number
  retailSharingPkr?: number
  retailQuadPkr?: number
  retailTriplePkr?: number
  retailDoublePkr?: number
}

export type MultiPackageCardRenderItem = MultiPosterCardInput

export interface MultiPosterSheetInput {
  flyerCode: string
  sheetNumber?: number
  totalSheets?: number
  daysTitle: string
  routePill: string
  airlineName: string
  airlineIataCode?: string | null
  airlineLogoDataUri?: string | null
  airlineLogoUrl?: string | null
  outboundBaggage?: string | null
  inboundBaggage?: string | null
  giftedInclusions?: string[]
  cards?: MultiPosterCardInput[]
  packages?: MultiPosterCardInput[]
  companyInfo?: CompanyInfo
}

export type MultiPackageSheetInput = MultiPosterSheetInput

export interface RenderMultiPackagePosterParams {
  postCode: string
  airlineName: string
  airlineLogoUrl?: string | null
  airlineIataCode?: string | null
  daysTitle: string
  routePill: string
  outboundBaggage?: string | null
  inboundBaggage?: string | null
  giftedItems?: string[]
  sheetNumber?: number
  totalSheets?: number
  companyInfo?: CompanyInfo
  packages: Array<{
    number: string
    postRefCode?: string | null
    outFlight: string
    outDate: string
    outRoute: string
    outDep: string
    outArr: string
    retFlight: string
    retDate: string
    retRoute: string
    retDep: string
    retArr: string
    makkahNights: string
    makkahHotel: string
    makkahDist: string
    madinahNights: string
    madinahHotel: string
    madinahDist: string
    sharingPrice: string | number
    quadPrice: string | number
    triplePrice: string | number
    doublePrice: string | number
  }>
}

export interface RenderedPosterSheetAsset {
  sheetNumber: number
  totalSheets: number
  cardCount: number
  pngUrl: string
  pdfUrl: string
  socialJpegUrl?: string
}

/**
 * Splits an arbitrary list of flyer package cards into multi-sheet chunks of at most
 * `MAX_CARDS_PER_POSTER_SHEET` (`10`) cards per sheet with `0` dropped cards (`T-062`).
 */
export function paginateCardsIntoSheets<T>(
  cards: readonly T[],
  maxPerSheet: number = MAX_CARDS_PER_POSTER_SHEET
): T[][] {
  const safeMax = Math.max(1, Math.floor(maxPerSheet))
  if (cards.length === 0) return []
  const sheets: T[][] = []
  for (let i = 0; i < cards.length; i += safeMax) {
    sheets.push(cards.slice(i, i + safeMax))
  }
  return sheets
}

function parsePriceNumber(val: string | number | undefined): number {
  if (typeof val === "number") {
    return Number.isFinite(val) ? Math.max(0, Math.round(val)) : 0
  }
  if (!val) return 0
  const trimmed = String(val).trim()
  if (/on\s*request/i.test(trimmed)) return 0
  return Number(trimmed.replace(/[^0-9]/g, "")) || 0
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

function convertParamsToSheetInput(
  input: MultiPosterSheetInput | RenderMultiPackagePosterParams
): MultiPosterSheetInput {
  if ("flyerCode" in input) {
    return input
  }
  return {
    flyerCode: input.postCode,
    sheetNumber: input.sheetNumber ?? 1,
    totalSheets: input.totalSheets ?? 1,
    daysTitle: input.daysTitle,
    routePill: input.routePill,
    airlineName: input.airlineName,
    airlineIataCode: input.airlineIataCode,
    airlineLogoUrl: input.airlineLogoUrl,
    outboundBaggage: input.outboundBaggage ?? null,
    inboundBaggage: input.inboundBaggage ?? null,
    giftedInclusions: input.giftedItems,
    companyInfo: input.companyInfo,
    cards: input.packages.map((p) => ({
      num: p.number,
      cardNumber: p.number,
      postRefCode: p.postRefCode ?? null,
      outboundFlightNo: p.outFlight,
      outboundDateLabel: p.outDate,
      outboundRoute: p.outRoute,
      outboundDepTime: p.outDep,
      outboundArrTime: p.outArr,
      returnFlightNo: p.retFlight,
      returnDateLabel: p.retDate,
      returnRoute: p.retRoute,
      returnDepTime: p.retDep,
      returnArrTime: p.retArr,
      makkahNights: p.makkahNights,
      makkahHotelName: p.makkahHotel,
      makkahDistanceLabel: p.makkahDist,
      madinahNights: p.madinahNights,
      madinahHotelName: p.madinahHotel,
      madinahDistanceLabel: p.madinahDist,
      sharingPricePkr: parsePriceNumber(p.sharingPrice),
      quadPricePkr: parsePriceNumber(p.quadPrice),
      triplePricePkr: parsePriceNumber(p.triplePrice),
      doublePricePkr: parsePriceNumber(p.doublePrice),
    })),
  }
}

/**
 * Builds the luxury Al Ramlah Multi-Package Sheet HTML for a single sheet (`<= 10` cards).
 * Wraps EVERY interpolated flyer/package field in `escapeHtml()` / `escapeAttr()` (`T-025`),
 * injects strict CSP `<meta>` blocking script execution, formats `0`-tiers as `"On Request"` (`OD-09b`),
 * omits unstated baggage (`T-087`), and uses `getCompanyInfo()` branding (`T-087`).
 */
export function buildMultiPackageSheetHtml(
  rawInput: MultiPosterSheetInput | RenderMultiPackagePosterParams,
  companyLogoB64?: string
): string {
  const sheet = convertParamsToSheetInput(rawInput)
  const sourceCards = sheet.cards ?? sheet.packages ?? []
  const cards = sourceCards.slice(0, MAX_CARDS_PER_POSTER_SHEET)
  const isDense = cards.length > 6
  const logoSrc = normalizeLogoSrc(companyLogoB64)
  const company = sheet.companyInfo ?? getCompanyInfo(null)
  const sheetNumber = Math.max(1, Math.floor(sheet.sheetNumber ?? 1))
  const totalSheets = Math.max(sheetNumber, Math.floor(sheet.totalSheets ?? 1))

  const routeParts = sheet.routePill.split("|").map((s) => s.trim())
  const leftRoute = escapeHtml(routeParts[0] || "LHE - JED")
  const rightRoute = escapeHtml(routeParts[1] || "JED - LHE")

  const safeAirlineDataOrHttps = sanitizeHttpsOrDataLogoUrl(
    sheet.airlineLogoDataUri ?? sheet.airlineLogoUrl
  )
  const airlineBadgeHtml = safeAirlineDataOrHttps
    ? `<img src="${escapeAttr(safeAirlineDataOrHttps)}" alt="${escapeAttr(sheet.airlineName)}" style="max-height:54px;max-width:190px;object-fit:contain;" />`
    : getAirlineBadgeHtml(sheet.airlineName, sheet.airlineIataCode, null)

  const inclusions =
    sheet.giftedInclusions && sheet.giftedInclusions.length > 0
      ? sheet.giftedInclusions
      : ["Visa", "Insurance", "Hotel", "Return Ticket", "Transport"]
  const inclusionsText = inclusions.map((item) => escapeHtml(item)).join(" &bull; ")

  const baggageSegments = [
    sheet.outboundBaggage?.trim()
      ? `OUTBOUND: ${escapeHtml(sheet.outboundBaggage.trim())}`
      : "",
    sheet.inboundBaggage?.trim()
      ? `INBOUND: ${escapeHtml(sheet.inboundBaggage.trim())}`
      : "",
  ].filter(Boolean)

  const cardsHtml = cards
    .map((c, idx) => {
      const cardNum = escapeHtml(
        c.num || c.cardNumber || String(idx + 1).padStart(2, "0")
      )
      const postRefHtml = c.postRefCode
        ? `<div class="card-ref">${escapeHtml(c.postRefCode)}</div>`
        : ""
      const makDist = normalizeDistance(c.makkahDistanceLabel)
      const madDist = normalizeDistance(c.madinahDistanceLabel)

      const shVal = c.sharingPricePkr ?? c.retailSharingPkr ?? 0
      const qdVal = c.quadPricePkr ?? c.retailQuadPkr ?? 0
      const trVal = c.triplePricePkr ?? c.retailTriplePkr ?? 0
      const dbVal = c.doublePricePkr ?? c.retailDoublePkr ?? 0

      return `
      <div class="pkg-card${cards.length % 2 === 1 && idx === cards.length - 1 ? " centered-card" : ""}">
        <div class="card-top">
          <div class="num-wrap">
            <div class="num-badge">${cardNum}</div>
            ${postRefHtml}
          </div>
          <div class="flight-table">
            <div class="flight-row">
              <span class="f-no">${escapeHtml(c.outboundFlightNo)}</span>
              <span class="f-dt">${escapeHtml(c.outboundDateLabel)}</span>
              <span class="f-rt">${escapeHtml(c.outboundRoute)}</span>
              <span class="f-tm">${escapeHtml(c.outboundDepTime)} - ${escapeHtml(c.outboundArrTime)}</span>
            </div>
            <div class="flight-row ret">
              <span class="f-no">${escapeHtml(c.returnFlightNo)}</span>
              <span class="f-dt">${escapeHtml(c.returnDateLabel)}</span>
              <span class="f-rt">${escapeHtml(c.returnRoute)}</span>
              <span class="f-tm">${escapeHtml(c.returnDepTime)} - ${escapeHtml(c.returnArrTime)}</span>
            </div>
          </div>
        </div>
        <div class="card-mid">
          <div class="hotel-col">
            <div class="hotel-label">MAKKAH (${escapeHtml(c.makkahNights)})</div>
            <div class="hotel-name">${escapeHtml(c.makkahHotelName)}</div>
            <div class="hotel-dist">${escapeHtml(makDist)}</div>
          </div>
          <div class="hotel-divider"></div>
          <div class="hotel-col">
            <div class="hotel-label">MADINAH (${escapeHtml(c.madinahNights)})</div>
            <div class="hotel-name">${escapeHtml(c.madinahHotelName)}</div>
            <div class="hotel-dist">${escapeHtml(madDist)}</div>
          </div>
        </div>
        <div class="card-bot">
          <div class="price-col"><div class="price-lbl">SHARING</div><div class="price-val">${escapeHtml(formatPkr(shVal))}</div></div>
          <div class="price-col"><div class="price-lbl">QUAD</div><div class="price-val">${escapeHtml(formatPkr(qdVal))}</div></div>
          <div class="price-col"><div class="price-lbl">TRIPLE</div><div class="price-val">${escapeHtml(formatPkr(trVal))}</div></div>
          <div class="price-col"><div class="price-lbl">DOUBLE</div><div class="price-val">${escapeHtml(formatPkr(dbVal))}</div></div>
        </div>
      </div>`
    })
    .join("\n")

  const sheetBadgeLabel =
    totalSheets > 1
      ? `Sheet ${sheetNumber}/${totalSheets} &bull; ${escapeHtml(sheet.flyerCode)}`
      : `Ref: ${escapeHtml(sheet.flyerCode)}`

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
      background: #06281E;
      color: #FDFBF6;
    }
    .canvas {
      width: 1080px;
      height: 1520px;
      padding: 28px 34px 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background:
        radial-gradient(circle at 50% 8%, rgba(201, 162, 77, 0.22) 0%, transparent 48%),
        linear-gradient(180deg, #093628 0%, #052017 65%, #03150F 100%);
      border: 3px solid rgba(201, 162, 77, 0.55);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 14px;
      border-bottom: 1.5px solid rgba(201, 162, 77, 0.4);
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .logo-box {
      width: 68px; height: 68px; border-radius: 14px;
      background: #FDFBF6; padding: 5px;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #C9A24D;
    }
    .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .brand-title { font-size: 24px; font-weight: 800; color: #F5E6B8; letter-spacing: 0.6px; text-transform: uppercase; }
    .brand-sub { font-size: 11px; color: #D8CFC0; letter-spacing: 1.4px; text-transform: uppercase; margin-top: 2px; }
    .center-pill { text-align: center; }
    .days-badge {
      display: inline-block; padding: 6px 20px; border-radius: 999px;
      background: linear-gradient(90deg, #B88B2E, #E5C469, #B88B2E);
      color: #041B13; font-weight: 800; font-size: 18px; letter-spacing: 1px;
    }
    .route-pill { margin-top: 6px; font-size: 12px; font-weight: 700; color: #F5E6B8; letter-spacing: 0.8px; }
    .sheet-meta { text-align: right; }
    .airline-wrap {
      background: #FDFBF6; border-radius: 12px; padding: 6px 14px;
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 52px; border: 1.5px solid #C9A24D;
    }
    .sheet-tag { margin-top: 5px; font-size: 11px; font-weight: 700; color: #E5C469; letter-spacing: 0.5px; }
    .inclusions-strip {
      margin: 10px 0; padding: 7px 16px; border-radius: 10px;
      background: rgba(253, 251, 246, 0.08);
      border: 1px solid rgba(201, 162, 77, 0.35);
      display: flex; align-items: center; justify-content: space-between;
      font-size: 11.5px; font-weight: 600; color: #F7EFE0;
    }
    .baggage-tag { color: #E5C469; font-weight: 700; font-size: 11px; }
    .cards-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${isDense ? "9px 12px" : "12px 14px"};
      align-content: center;
    }
    .pkg-card {
      background: #FDFBF6;
      color: #0F291E;
      border-radius: 12px;
      padding: ${isDense ? "8px 11px" : "11px 13px"};
      border: 1.5px solid #D8C390;
      display: flex;
      flex-direction: column;
      gap: ${isDense ? "6px" : "8px"};
    }
    .pkg-card.centered-card {
      grid-column: 1 / -1;
      max-width: 500px;
      width: 100%;
      justify-self: center;
    }
    .card-top { display: flex; align-items: center; gap: 9px; }
    .num-wrap { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 38px; }
    .num-badge {
      width: 32px; height: 32px; border-radius: 8px;
      background: #083325; color: #F5E6B8;
      font-weight: 800; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
    }
    .card-ref { font-size: 8px; font-weight: 700; color: #6B5728; white-space: nowrap; }
    .flight-table { flex: 1; display: flex; flex-direction: column; gap: 3px; font-size: ${isDense ? "10px" : "10.5px"}; }
    .flight-row {
      display: grid; grid-template-columns: 58px 54px 68px 1fr;
      gap: 4px; align-items: center; font-weight: 700; color: #0B2E21;
    }
    .flight-row.ret { color: #375247; font-weight: 600; }
    .card-mid {
      display: grid; grid-template-columns: 1fr 1px 1fr; gap: 8px;
      padding: 5px 0; border-top: 1px dashed #DFD4BA; border-bottom: 1px dashed #DFD4BA;
    }
    .hotel-divider { background: #DFD4BA; }
    .hotel-label { font-size: 9px; font-weight: 800; color: #8A6A24; letter-spacing: 0.4px; }
    .hotel-name { font-size: ${isDense ? "11px" : "12px"}; font-weight: 800; color: #09291D; line-height: 1.2; }
    .hotel-dist { font-size: 9.5px; font-weight: 600; color: #4A6358; }
    .card-bot { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
    .price-col {
      background: #F4EFE3; border-radius: 7px; padding: 4px 5px; text-align: center;
      border: 1px solid #E2D6BC;
    }
    .price-lbl { font-size: 8.5px; font-weight: 800; color: #7C5E1E; }
    .price-val { font-size: ${isDense ? "11px" : "12px"}; font-weight: 800; color: #072A1E; }
    .footer-bar {
      margin-top: 10px; padding-top: 10px;
      border-top: 1.5px solid rgba(201, 162, 77, 0.4);
      display: flex; align-items: center; justify-content: space-between;
      font-size: 11px; color: #EAE1CE;
    }
    .f-label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #D4B059; font-weight: 700; }
    .f-val { font-weight: 700; color: #FDFBF6; }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="header">
      <div class="brand">
        ${
          logoSrc
            ? `<div class="logo-box"><img src="${escapeAttr(logoSrc)}" alt="${escapeAttr(company.agencyName)}" /></div>`
            : `<div class="logo-box"><span style="font-weight:900;color:#083325;font-size:20px;">ART</span></div>`
        }
        <div>
          <div class="brand-title">${escapeHtml(company.agencyName)}</div>
          <div class="brand-sub">${escapeHtml(company.tagline)}</div>
        </div>
      </div>
      <div class="center-pill">
        <div class="days-badge">${escapeHtml(sheet.daysTitle)} UMRAH</div>
        <div class="route-pill">${leftRoute} &bull; ${rightRoute}</div>
      </div>
      <div class="sheet-meta">
        <div class="airline-wrap">${airlineBadgeHtml}</div>
        <div class="sheet-tag">${sheetBadgeLabel}</div>
      </div>
    </div>

    <div class="inclusions-strip">
      <span>INCLUDED: ${inclusionsText}</span>
      ${
        baggageSegments.length > 0
          ? `<span class="baggage-tag">${baggageSegments.join(" &bull; ")}</span>`
          : ""
      }
    </div>

    <div class="cards-grid">
      ${cardsHtml}
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

/**
 * Backward-compatible alias (`T-062`).
 */
export const renderMultiPackagePosterHtml = buildMultiPackageSheetHtml

/**
 * Builds paginated multi-sheet HTML documents (`<= 10` cards per sheet, `0` dropped cards)
 * for supplier flyers of any card count (`T-062`).
 */
export function buildPaginatedMultiPackageSheetsHtml(
  rawInput: MultiPosterSheetInput | RenderMultiPackagePosterParams,
  companyLogoB64?: string
): Array<{
  sheetNumber: number
  totalSheets: number
  cardCount: number
  html: string
}> {
  const normalized = convertParamsToSheetInput(rawInput)
  const allCards = normalized.cards ?? normalized.packages ?? []
  const chunks = paginateCardsIntoSheets(allCards, MAX_CARDS_PER_POSTER_SHEET)
  if (chunks.length === 0) {
    return [
      {
        sheetNumber: 1,
        totalSheets: 1,
        cardCount: 0,
        html: buildMultiPackageSheetHtml(
          { ...normalized, cards: [], sheetNumber: 1, totalSheets: 1 },
          companyLogoB64
        ),
      },
    ]
  }

  const totalSheets = chunks.length
  return chunks.map((chunk, idx) => {
    const sheetNumber = idx + 1
    const sheetFlyerCode =
      totalSheets > 1 && sheetNumber > 1 && !normalized.flyerCode.endsWith(`-S${sheetNumber}`)
        ? `${normalized.flyerCode}-S${sheetNumber}`
        : normalized.flyerCode
    return {
      sheetNumber,
      totalSheets,
      cardCount: chunk.length,
      html: buildMultiPackageSheetHtml(
        {
          ...normalized,
          flyerCode: sheetFlyerCode,
          cards: chunk,
          sheetNumber,
          totalSheets,
        },
        companyLogoB64
      ),
    }
  })
}

export async function renderAndUploadMultiPackageSheet(
  sheet: MultiPosterSheetInput
): Promise<{ pngUrl: string; pdfUrl: string; socialJpegUrl?: string }> {
  const [companyLogoDataUri, companyInfo] = await Promise.all([
    getCompanyLogoDataUri(),
    resolveLiveCompanyInfo(sheet.companyInfo),
  ])

  const sheetNum = Math.max(1, Math.floor(sheet.sheetNumber ?? 1))
  const html = buildMultiPackageSheetHtml(
    {
      ...sheet,
      sheetNumber: sheetNum,
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
    throw new Error("Gotenberg did not return PNG and PDF buffers for multi-package sheet")
  }

  const safeSlug = sheet.flyerCode.toLowerCase().replace(/[^a-z0-9-_]/g, "-")
  const baseKey = `posters/sheets/${safeSlug}_sheet_${sheetNum}`
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

/**
 * Renders ALL paginated multi-package sheets (`<= 10` cards per sheet, `0` dropped cards)
 * via Gotenberg into PNG + print PDF + `1080x1520` social JPEG (`T-062`, `T-087`),
 * returning backward-compatible primary `{ pngUrl, pdfUrl, socialJpegUrl }` plus `sheets[]`.
 */
export async function renderAndUploadMultiPackagePoster(
  params: RenderMultiPackagePosterParams | MultiPosterSheetInput
): Promise<{
  pngUrl: string
  pdfUrl: string
  socialJpegUrl?: string
  sheets: RenderedPosterSheetAsset[]
}> {
  const normalized = convertParamsToSheetInput(params)
  const companyInfo = await resolveLiveCompanyInfo(normalized.companyInfo)
  const allCards = normalized.cards ?? normalized.packages ?? []
  const chunks = paginateCardsIntoSheets(allCards, MAX_CARDS_PER_POSTER_SHEET)
  const effectiveChunks = chunks.length > 0 ? chunks : [[]]
  const totalSheets = effectiveChunks.length

  const renderedSheets = await renderBatchViaGotenberg(
    effectiveChunks,
    async (chunk, idx) => {
      const sheetNumber = idx + 1
      const rendered = await renderAndUploadMultiPackageSheet({
        ...normalized,
        companyInfo,
        cards: chunk,
        sheetNumber,
        totalSheets,
      })
      return {
        sheetNumber,
        totalSheets,
        cardCount: chunk.length,
        pngUrl: rendered.pngUrl,
        pdfUrl: rendered.pdfUrl,
        socialJpegUrl: rendered.socialJpegUrl,
      }
    }
  )

  const primary = renderedSheets[0]!
  return {
    pngUrl: primary.pngUrl,
    pdfUrl: primary.pdfUrl,
    socialJpegUrl: primary.socialJpegUrl,
    sheets: renderedSheets,
  }
}

export const renderAndUploadPaginatedMultiPackagePosters =
  renderAndUploadMultiPackagePoster
