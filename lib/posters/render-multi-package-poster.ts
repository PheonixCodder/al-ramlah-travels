import {
  getAirlineBadgeHtml,
  getCompanyLogoBase64,
  renderHtmlViaChromiumCdp,
} from "./chromium-cdp"
import { uploadAssetToR2 } from "../storage/r2"

export interface MultiPosterCardInput {
  num: string
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
  sharingPricePkr: number
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
}

export interface MultiPosterSheetInput {
  flyerCode: string
  sheetNumber: number
  daysTitle: string
  routePill: string
  airlineName: string
  airlineIataCode?: string | null
  airlineLogoDataUri?: string | null
  cards: MultiPosterCardInput[]
}

function renderCardHtml(c: MultiPosterCardInput, isCenteredLast = false): string {
  const wrapCls = isCenteredLast ? "pkg-card centered-card" : "pkg-card"
  const mkH = `${c.makkahHotelName}<br>${c.makkahDistanceLabel}`
  const mdH = `${c.madinahHotelName}<br>${c.madinahDistanceLabel}`
  const pSh = c.sharingPricePkr.toLocaleString()
  const pQd = c.quadPricePkr.toLocaleString()
  const pTr = c.triplePricePkr.toLocaleString()
  const pDb = c.doublePricePkr.toLocaleString()

  return `
    <div class="${wrapCls}">
      <div class="card-top">
        <div class="num-badge">${c.num}</div>
        <div class="flight-label">FLIGHT<br>SCHEDULE</div>
        <div class="plane-box">✈</div>
        <div class="flight-table">
          <div class="flight-row"><span>${c.outboundFlightNo}</span><span>${c.outboundDateLabel}</span><span>${c.outboundRoute}</span><span>${c.outboundDepTime}</span><span>${c.outboundArrTime}</span></div>
          <div class="flight-row"><span>${c.returnFlightNo}</span><span>${c.returnDateLabel}</span><span>${c.returnRoute}</span><span>${c.returnDepTime}</span><span>${c.returnArrTime}</span></div>
        </div>
      </div>
      <div class="card-mid">
        <div class="hotel-col">
          <div class="hotel-label">MAKKAH HOTEL <span class="nights-sub">(NIGHTS: ${c.makkahNights})</span></div>
          <div class="hotel-name">${mkH}</div>
        </div>
        <div class="hotel-divider"></div>
        <div class="hotel-col">
          <div class="hotel-label">MADINA HOTEL <span class="nights-sub">(NIGHTS: ${c.madinahNights})</span></div>
          <div class="hotel-name">${mdH}</div>
        </div>
      </div>
      <div class="card-bot">
        <div class="price-col"><div class="price-lbl">SHARING</div><div class="price-val">${pSh}</div></div>
        <div class="price-col"><div class="price-lbl">QUAD</div><div class="price-val">${pQd}</div></div>
        <div class="price-col"><div class="price-lbl">TRIPLE</div><div class="price-val">${pTr}</div></div>
        <div class="price-col"><div class="price-lbl">DOUBLE</div><div class="price-val">${pDb}</div></div>
      </div>
    </div>
  `
}

export function buildMultiPackageSheetHtml(
  sheet: MultiPosterSheetInput,
  companyLogoB64: string
): string {
  const cards = sheet.cards
  const dense = cards.length > 6
  const cardsHtml = cards.map((c, i) =>
    renderCardHtml(c, i === cards.length - 1 && cards.length % 2 === 1)
  )
  const airlineHtml = getAirlineBadgeHtml(
    sheet.airlineName,
    sheet.airlineIataCode,
    sheet.airlineLogoDataUri
  )
  const routePillHtml = sheet.routePill.includes("|")
    ? sheet.routePill
        .split("|")
        .map((s) => s.trim())
        .join(" <span class='sep'>|</span> ")
    : sheet.routePill

  const posterPad = dense ? "28px 38px 26px 38px" : "38px 42px 34px 42px"
  const topBarPad = dense ? "10px 18px" : "12px 22px"
  const logoW = dense ? "52px" : "62px"
  const brandFs = dense ? "20px" : "23px"
  const heroMargin = dense ? "6px 0 6px 0" : "14px 0 10px 0"
  const daysFs = dense ? "28px" : "36px"
  const mainFs = dense ? "52px" : "66px"
  const mainMargin = dense ? "2px 0 8px 0" : "4px 0 12px 0"
  const pillPad = dense ? "5px 32px" : "8px 38px"
  const pillFs = dense ? "20px" : "24px"
  const gridGap = dense ? "15px 16px" : "24px 16px"
  const cardPad = dense ? "10px 13px" : "14px 16px"
  const topPadB = dense ? "6px" : "10px"
  const badgeSz = dense ? "32px" : "38px"
  const badgeFs = dense ? "15.5px" : "18px"
  const flLblFs = dense ? "9.5px" : "10.5px"
  const planeSz = dense ? "24px" : "28px"
  const planeFs = dense ? "13px" : "15px"
  const flRowFs = dense ? "10.2px" : "11px"
  const midPad = dense ? "9px 4px" : "14px 4px"
  const midMinH = dense ? "64px" : "88px"
  const hLblFs = dense ? "9.5px" : "10.5px"
  const hLblMb = dense ? "3px" : "5px"
  const nSubFs = dense ? "8.2px" : "9px"
  const hNameFs = dense ? "12.5px" : "14px"
  const botPad = dense ? "8px 5px" : "10px 6px"
  const pLblFs = dense ? "8.5px" : "9.5px"
  const pLblMb = dense ? "2px" : "4px"
  const pValFs = dense ? "18px" : "19.5px"
  const footerPad = dense ? "10px 22px" : "14px 24px"
  const fLblFs = dense ? "8.5px" : "9.5px"
  const fValFs = dense ? "12.5px" : "13.5px"

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: 1080px 1520px; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
    html, body { width: 1080px; height: 1520px; overflow: hidden; font-family: 'Inter', 'Noto Sans', sans-serif; background: #FDFBF6; color: #14232E; }
    .poster { position: relative; width: 1080px; height: 1520px; padding: ${posterPad}; display: flex; flex-direction: column; justify-content: space-between; background: #FDFBF6; }
    .bg-svg { position: absolute; inset: 0; width: 1080px; height: 1520px; z-index: 0; pointer-events: none; }
    .poster > :not(.bg-svg) { position: relative; z-index: 1; }
    .top-bar { display: flex; justify-content: space-between; align-items: center; background: #0C2633; border: 2px solid #C9A25B; border-radius: 12px; padding: ${topBarPad}; box-shadow: 0 6px 16px rgba(12, 38, 51, 0.14); }
    .brand-left { display: flex; align-items: center; gap: 12px; }
    .brand-logo { width: ${logoW}; height: auto; display: block; }
    .brand-name { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: ${brandFs}; font-weight: 700; letter-spacing: 2.5px; color: #F5EFE1; line-height: 1.1; }
    .brand-sub { font-size: 10px; letter-spacing: 5px; color: #C9A25B; margin-top: 3px; font-weight: 600; }
    .brand-center { text-align: center; }
    .tagline-main { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-style: italic; font-size: 14px; color: #E2C58A; }
    .tagline-services { font-size: 9.5px; letter-spacing: 1.5px; color: #F5EFE1; text-transform: uppercase; margin-top: 3px; }
    .airline-badge { background: #FDFBF6; border: 2px solid #C9A25B; border-radius: 10px; padding: 5px 14px; display: flex; align-items: center; justify-content: center; min-width: 175px; height: 54px; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18); }
    .airline-badge svg { height: 42px; width: auto; display: block; }
    .airline-img { max-height: 42px; max-width: 165px; width: auto; height: auto; object-fit: contain; display: block; }
    .hero-block { text-align: center; margin: ${heroMargin}; }
    .days-title { font-size: ${daysFs}; font-weight: 800; color: #9A7433; letter-spacing: 2px; line-height: 1.05; }
    .main-title { font-size: ${mainFs}; font-weight: 900; color: #0C2633; letter-spacing: 2.5px; line-height: 1.02; margin: ${mainMargin}; }
    .route-pill { display: inline-block; background: #0C2633; color: #F5EFE1; border: 2px solid #C9A25B; padding: ${pillPad}; border-radius: 999px; font-size: ${pillFs}; font-weight: 800; letter-spacing: 3px; box-shadow: 0 4px 10px rgba(12, 38, 51, 0.14); }
    .route-pill .sep { color: #C9A25B; margin: 0 8px; }
    .cards-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: ${gridGap}; margin: 4px 0; }
    .pkg-card { width: calc(50% - 8px); background: #FFFFFF; border: 1.5px solid #DFD2B5; border-radius: 12px; padding: ${cardPad}; box-shadow: 0 5px 15px rgba(12, 38, 51, 0.08); display: flex; flex-direction: column; justify-content: space-between; }
    .card-top { display: flex; align-items: center; gap: 8px; padding-bottom: ${topPadB}; border-bottom: 1.5px solid #EAE0C8; }
    .num-badge { background: #0C2633; color: #E2C58A; border: 1.5px solid #C9A25B; border-radius: 7px; min-width: ${badgeSz}; height: ${badgeSz}; display: flex; align-items: center; justify-content: center; font-size: ${badgeFs}; font-weight: 800; }
    .flight-label { font-size: ${flLblFs}; font-weight: 800; color: #0C2633; line-height: 1.12; letter-spacing: 0.3px; }
    .plane-box { width: ${planeSz}; height: ${planeSz}; border: 1.5px solid #C9A25B; background: #FDFBF6; color: #0C2633; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: ${planeFs}; flex-shrink: 0; }
    .flight-table { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .flight-row { display: grid; grid-template-columns: 1.15fr 1.15fr 1.35fr 0.9fr 0.9fr; font-size: ${flRowFs}; font-weight: 800; color: #14232E; font-variant-numeric: tabular-nums; letter-spacing: 0.1px; }
    .flight-row span { white-space: nowrap; }
    .card-mid { display: flex; align-items: stretch; padding: ${midPad}; min-height: ${midMinH}; }
    .hotel-col { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; }
    .hotel-divider { width: 1.5px; background: #DFD2B5; margin: 0 10px; }
    .hotel-label { font-size: ${hLblFs}; font-weight: 800; color: #9A7433; margin-bottom: ${hLblMb}; letter-spacing: 0.2px; }
    .nights-sub { font-size: ${nSubFs}; color: #5E6B73; font-weight: 700; }
    .hotel-name { font-size: ${hNameFs}; font-weight: 800; color: #0C2633; line-height: 1.2; text-transform: uppercase; }
    .card-bot { background: #0C2633; border-top: 2px solid #C9A25B; border-radius: 8px; padding: ${botPad}; display: grid; grid-template-columns: repeat(4, 1fr); }
    .price-col { text-align: center; border-right: 1px solid rgba(201, 162, 91, 0.38); padding: 0 3px; }
    .price-col:last-child { border-right: none; }
    .price-lbl { font-size: ${pLblFs}; font-weight: 700; color: #E2C58A; letter-spacing: 0.5px; margin-bottom: ${pLblMb}; }
    .price-val { font-size: ${pValFs}; font-weight: 800; color: #FFFFFF; font-variant-numeric: tabular-nums; letter-spacing: 0.1px; }
    .footer-bar { background: #0C2633; border: 2px solid #C9A25B; border-radius: 12px; padding: ${footerPad}; display: flex; justify-content: space-between; align-items: center; color: #F5EFE1; box-shadow: 0 6px 16px rgba(12, 38, 51, 0.14); }
    .f-item { display: flex; flex-direction: column; gap: 2px; }
    .f-label { font-size: ${fLblFs}; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #C9A25B; }
    .f-val { font-size: ${fValFs}; font-weight: 700; color: #FFFFFF; }
  </style>
</head>
<body>
  <div class="poster">
    <svg class="bg-svg" viewBox="0 0 1080 1520" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="islamic-lattice" width="120" height="120" patternUnits="userSpaceOnUse">
          <polygon points="0,-18 18,0 0,18 -18,0" fill="none" stroke="#F0E7D4" stroke-width="1.8"/>
          <polygon points="120,-18 138,0 120,18 102,0" fill="none" stroke="#F0E7D4" stroke-width="1.8"/>
          <polygon points="0,102 18,120 0,138 -18,120" fill="none" stroke="#F0E7D4" stroke-width="1.8"/>
          <polygon points="120,102 138,120 120,138 102,120" fill="none" stroke="#F0E7D4" stroke-width="1.8"/>
          <polygon points="60,42 78,60 60,78 42,60" fill="none" stroke="#F0E7D4" stroke-width="1.8"/>
          <polygon points="60,52 68,60 60,68 52,60" fill="none" stroke="#F0E7D4" stroke-width="1"/>
          <polygon points="46,42 50,46 46,50 42,46" fill="none" stroke="#F0E7D4" stroke-width="1"/>
          <polygon points="74,42 78,46 74,50 70,46" fill="none" stroke="#F0E7D4" stroke-width="1"/>
          <polygon points="46,70 50,74 46,78 42,74" fill="none" stroke="#F0E7D4" stroke-width="1"/>
          <polygon points="74,70 78,74 74,78 70,74" fill="none" stroke="#F0E7D4" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="1080" height="1520" fill="#FDFBF6"/>
      <rect width="1080" height="1520" fill="url(#islamic-lattice)"/>
      <rect x="16" y="16" width="1048" height="1488" fill="none" stroke="#C9A25B" stroke-width="2.2"/>
      <rect x="22" y="22" width="1036" height="1476" fill="none" stroke="#E3D8BF" stroke-width="1"/>
      <polygon points="16,8 24,16 16,24 8,16" fill="#C9A25B"/>
      <polygon points="1064,8 1072,16 1064,24 1056,16" fill="#C9A25B"/>
      <polygon points="16,1496 24,1504 16,1512 8,1504" fill="#C9A25B"/>
      <polygon points="1064,1496 1072,1504 1064,1512 1056,1504" fill="#C9A25B"/>
    </svg>

    <div>
      <div class="top-bar">
        <div class="brand-left">
          <img class="brand-logo" src="data:image/png;base64,${companyLogoB64}" alt="Al Ramlah Travels">
          <div>
            <div class="brand-name">AL RAMLAH</div>
            <div class="brand-sub">T R A V E L S</div>
          </div>
        </div>
        <div class="brand-center">
          <div class="tagline-main">Where Purpose Meets Excellence</div>
          <div class="tagline-services">Hajj • Umrah • Flights • Hotels • Tours</div>
        </div>
        <div class="airline-badge">
          ${airlineHtml}
        </div>
      </div>

      <div class="hero-block">
        <div class="days-title">${sheet.daysTitle}</div>
        <div class="main-title">UMRAH PACKAGES</div>
        <div class="route-pill">${routePillHtml}</div>
      </div>
    </div>

    <div class="cards-grid">
      ${cardsHtml.join("")}
    </div>

    <div class="footer-bar">
      <div class="f-item">
        <span class="f-label">Call / WhatsApp</span>
        <span class="f-val">03274029701 · 03190462638</span>
      </div>
      <div class="f-item" style="text-align: center;">
        <span class="f-label">Website</span>
        <span class="f-val">www.alramlahtravels.com</span>
      </div>
      <div class="f-item" style="text-align: right;">
        <span class="f-label">Office Address</span>
        <span class="f-val">Office no 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt</span>
      </div>
    </div>
  </div>
</body>
</html>`
}

export async function renderAndUploadMultiPackageSheet(
  sheet: MultiPosterSheetInput
): Promise<{ pngUrl: string; pdfUrl: string }> {
  const companyLogoB64 = await getCompanyLogoBase64()
  const html = buildMultiPackageSheetHtml(sheet, companyLogoB64)
  const { pngBuffer, pdfBuffer } = await renderHtmlViaChromiumCdp({
    html,
    width: 1080,
    height: 1520,
    deviceScaleFactor: 3,
    capturePng: true,
    capturePdf: true,
  })

  const baseKey = `posters/sheets/${sheet.flyerCode.toLowerCase()}_sheet_${sheet.sheetNumber}`
  const pngUpload = await uploadAssetToR2(
    `${baseKey}_4k.png`,
    pngBuffer!,
    "image/png"
  )
  const pdfUpload = await uploadAssetToR2(
    `${baseKey}_vector.pdf`,
    pdfBuffer!,
    "application/pdf"
  )

  return {
    pngUrl: pngUpload.url,
    pdfUrl: pdfUpload.url,
  }
}

export interface RenderMultiPackagePosterParams {
  postCode: string
  airlineName: string
  airlineLogoUrl?: string | null
  airlineIataCode?: string | null
  daysTitle: string
  routePill: string
  outboundBaggage?: string
  inboundBaggage?: string
  giftedItems?: string[]
  packages: Array<{
    number: string
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

function parsePriceNumber(val: string | number): number {
  if (typeof val === "number") return val
  return Number(String(val).replace(/[^0-9]/g, "")) || 0
}

export async function renderAndUploadMultiPackagePoster(
  params: RenderMultiPackagePosterParams
): Promise<{ pngUrl: string; pdfUrl: string }> {
  return renderAndUploadMultiPackageSheet({
    flyerCode: params.postCode,
    sheetNumber: 1,
    daysTitle: params.daysTitle,
    routePill: params.routePill,
    airlineName: params.airlineName,
    airlineIataCode: params.airlineIataCode,
    cards: params.packages.map((p) => ({
      num: p.number,
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
  })
}
