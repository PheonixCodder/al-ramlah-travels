import {
  getAirlineBadgeHtml,
  getCompanyLogoBase64,
  renderHtmlViaChromiumCdp,
} from "./chromium-cdp"
import { uploadAssetToR2 } from "../storage/r2"

export interface SinglePackageSpotlightInput {
  cardNumber: string
  postRefCode?: string
  postCode?: string
  daysTitle: string
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
  sharingPricePkr: number
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
}

export function buildSinglePackageSpotlightHtml(
  pkg: SinglePackageSpotlightInput,
  companyLogoB64: string
): string {
  const effectivePostRefCode = pkg.postRefCode || pkg.postCode || "ART-SPOT-01"
  const airlineHtml = getAirlineBadgeHtml(
    pkg.airlineName,
    pkg.airlineIataCode,
    pkg.airlineLogoDataUri
  )
  const routePillHtml = pkg.routePill.includes("|")
    ? pkg.routePill
        .split("|")
        .map((s) => s.trim())
        .join(" <span class='sep'>|</span> ")
    : pkg.routePill

  const rawInclusions = pkg.inclusions || pkg.giftedItems
  const defaultInclusions =
    rawInclusions && rawInclusions.length > 0
      ? rawInclusions.slice(0, 4)
      : [
          "Official Umrah Visa & Insurance",
          "Complete Ground Transport",
          "Gifted Taif & Makkah Ziyarat",
          "Gifted Madinah Ziyarat",
        ]

  const inclusionsHtml = defaultInclusions
    .map(
      (inc) =>
        `<div class="inc-pill"><span class="inc-check">✦</span><span>${inc}</span></div>`
    )
    .join("")

  const pSh = pkg.sharingPricePkr.toLocaleString()
  const pQd = pkg.quadPricePkr.toLocaleString()
  const pTr = pkg.triplePricePkr.toLocaleString()
  const pDb = pkg.doublePricePkr.toLocaleString()
  const baggage =
    pkg.baggageText ||
    (pkg.outboundBaggage && pkg.inboundBaggage
      ? `${pkg.outboundBaggage} OUT • ${pkg.inboundBaggage} IN`
      : "23KG OUTBOUND • 46KG RETURN")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: 1080px 1520px; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
    html, body { width: 1080px; height: 1520px; overflow: hidden; font-family: 'Inter', 'Noto Sans', sans-serif; background: #FDFBF6; color: #14232E; }
    .poster { position: relative; width: 1080px; height: 1520px; padding: 38px 44px 34px 44px; display: flex; flex-direction: column; justify-content: space-between; background: #FDFBF6; }
    .bg-svg { position: absolute; inset: 0; width: 1080px; height: 1520px; z-index: 0; pointer-events: none; }
    .poster > :not(.bg-svg) { position: relative; z-index: 1; }

    .top-bar { display: flex; justify-content: space-between; align-items: center; background: #0C2633; border: 2px solid #C9A25B; border-radius: 14px; padding: 14px 24px; box-shadow: 0 8px 20px rgba(12, 38, 51, 0.16); }
    .brand-left { display: flex; align-items: center; gap: 14px; }
    .brand-logo { width: 64px; height: auto; display: block; }
    .brand-name { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 24px; font-weight: 700; letter-spacing: 2.5px; color: #F5EFE1; line-height: 1.1; }
    .brand-sub { font-size: 10.5px; letter-spacing: 5.5px; color: #C9A25B; margin-top: 3px; font-weight: 600; }
    .brand-center { text-align: center; }
    .tagline-main { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-style: italic; font-size: 15px; color: #E2C58A; }
    .tagline-services { font-size: 10px; letter-spacing: 1.8px; color: #F5EFE1; text-transform: uppercase; margin-top: 4px; }
    .airline-badge { background: #FDFBF6; border: 2px solid #C9A25B; border-radius: 10px; padding: 6px 16px; display: flex; align-items: center; justify-content: center; min-width: 185px; height: 58px; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18); }
    .airline-badge svg { height: 44px; width: auto; display: block; }
    .airline-img { max-height: 44px; max-width: 170px; width: auto; height: auto; object-fit: contain; display: block; }

    .hero-block { text-align: center; margin: 10px 0 6px 0; }
    .meta-row { display: flex; justify-content: center; align-items: center; gap: 14px; margin-bottom: 6px; }
    .ref-badge { background: #F5EFE1; border: 1.5px solid #C9A25B; color: #0C2633; font-size: 13px; font-weight: 800; letter-spacing: 1.8px; padding: 5px 16px; border-radius: 999px; }
    .days-title { font-size: 36px; font-weight: 900; color: #9A7433; letter-spacing: 3px; line-height: 1.05; }
    .main-title { font-size: 64px; font-weight: 900; color: #0C2633; letter-spacing: 2.5px; line-height: 1.02; margin: 2px 0 12px 0; }
    .route-pill-row { display: flex; justify-content: center; align-items: center; gap: 16px; }
    .route-pill { display: inline-block; background: #0C2633; color: #F5EFE1; border: 2px solid #C9A25B; padding: 8px 36px; border-radius: 999px; font-size: 23px; font-weight: 800; letter-spacing: 3px; box-shadow: 0 4px 12px rgba(12, 38, 51, 0.14); }
    .route-pill .sep { color: #C9A25B; margin: 0 10px; }

    .starting-banner { background: linear-gradient(135deg, #0C2633 0%, #163B4D 100%); border: 2.5px solid #C9A25B; border-radius: 16px; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 24px rgba(12, 38, 51, 0.14); }
    .sb-left { display: flex; align-items: center; gap: 16px; }
    .pkg-num-circle { width: 58px; height: 58px; border-radius: 14px; background: #FDFBF6; border: 2px solid #C9A25B; color: #0C2633; font-size: 28px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
    .sb-titles { display: flex; flex-direction: column; }
    .sb-eyebrow { font-size: 13px; font-weight: 800; letter-spacing: 2.5px; color: #E2C58A; text-transform: uppercase; }
    .sb-headline { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 26px; font-weight: 700; color: #FFFFFF; margin-top: 2px; }
    .sb-right { text-align: right; }
    .sb-price-lbl { font-size: 12px; font-weight: 800; letter-spacing: 2px; color: #E2C58A; text-transform: uppercase; }
    .sb-price-val { font-size: 44px; font-weight: 900; color: #FFFFFF; font-variant-numeric: tabular-nums; letter-spacing: 0.5px; line-height: 1.05; }
    .sb-price-val small { font-size: 20px; color: #C9A25B; font-weight: 800; margin-right: 6px; }

    .section-card { background: #FFFFFF; border: 2px solid #DFD2B5; border-radius: 16px; padding: 20px 26px; box-shadow: 0 6px 18px rgba(12, 38, 51, 0.08); }
    .sec-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1.5px solid #EAE0C8; margin-bottom: 14px; }
    .sec-title-wrap { display: flex; align-items: center; gap: 12px; }
    .sec-icon { width: 38px; height: 38px; border-radius: 9px; background: #0C2633; border: 1.5px solid #C9A25B; color: #E2C58A; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .sec-title { font-size: 18px; font-weight: 900; color: #0C2633; letter-spacing: 1.5px; text-transform: uppercase; }
    .baggage-pill { background: #F5EFE1; border: 1.5px solid #C9A25B; color: #0C2633; font-size: 12px; font-weight: 800; letter-spacing: 1.2px; padding: 5px 14px; border-radius: 8px; }
    .flight-rows { display: flex; flex-direction: column; gap: 10px; }
    .flight-leg { display: grid; grid-template-columns: 130px 120px 130px 1fr 130px 130px; align-items: center; background: #FDFBF6; border: 1.5px solid #EAE0C8; border-radius: 12px; padding: 12px 18px; font-variant-numeric: tabular-nums; }
    .leg-tag { background: #0C2633; color: #E2C58A; font-size: 11.5px; font-weight: 800; letter-spacing: 1.2px; padding: 5px 10px; border-radius: 6px; text-align: center; width: fit-content; text-transform: uppercase; }
    .leg-fl { font-size: 20px; font-weight: 900; color: #0C2633; }
    .leg-dt { font-size: 18px; font-weight: 800; color: #9A7433; }
    .leg-rt { font-size: 20px; font-weight: 900; color: #14232E; letter-spacing: 1px; }
    .leg-tm { font-size: 17px; font-weight: 800; color: #14232E; text-align: right; }
    .leg-tm span { display: block; font-size: 10px; font-weight: 700; color: #5E6B73; letter-spacing: 1px; text-transform: uppercase; }

    .hotels-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .hotel-card { background: #FFFFFF; border: 2px solid #DFD2B5; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 18px rgba(12, 38, 51, 0.08); display: flex; flex-direction: column; justify-content: space-between; }
    .hc-top { background: #0C2633; border-bottom: 2px solid #C9A25B; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; }
    .hc-city { font-size: 17px; font-weight: 900; color: #E2C58A; letter-spacing: 2px; text-transform: uppercase; }
    .hc-nights { background: #C9A25B; color: #0C2633; font-size: 14px; font-weight: 900; padding: 4px 12px; border-radius: 999px; letter-spacing: 1px; }
    .hc-body { padding: 22px 22px; display: flex; flex-direction: column; gap: 12px; }
    .hc-name { font-size: 25px; font-weight: 900; color: #0C2633; line-height: 1.2; text-transform: uppercase; min-height: 60px; display: flex; align-items: center; }
    .hc-dist { display: inline-flex; align-items: center; gap: 8px; background: #F5EFE1; border: 1.5px solid #DFD2B5; color: #9A7433; font-size: 14px; font-weight: 800; padding: 7px 14px; border-radius: 8px; width: fit-content; letter-spacing: 0.6px; text-transform: uppercase; }

    .inc-card { background: #FFFFFF; border: 2px solid #DFD2B5; border-radius: 14px; padding: 14px 22px; box-shadow: 0 5px 15px rgba(12, 38, 51, 0.06); }
    .inc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .inc-pill { background: #FDFBF6; border: 1.5px solid #EAE0C8; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; color: #0C2633; line-height: 1.25; }
    .inc-check { color: #9A7433; font-size: 16px; font-weight: 900; flex-shrink: 0; }

    .price-matrix { background: #0C2633; border: 2.5px solid #C9A25B; border-radius: 16px; padding: 18px 16px; display: grid; grid-template-columns: repeat(4, 1fr); box-shadow: 0 10px 24px rgba(12, 38, 51, 0.16); }
    .pm-col { text-align: center; border-right: 1.5px solid rgba(201, 162, 91, 0.4); padding: 4px 10px; }
    .pm-col:last-child { border-right: none; }
    .pm-lbl { font-size: 14px; font-weight: 800; color: #E2C58A; letter-spacing: 2px; margin-bottom: 6px; text-transform: uppercase; }
    .pm-sub { font-size: 10.5px; font-weight: 600; color: #C9A25B; margin-bottom: 4px; letter-spacing: 0.8px; text-transform: uppercase; }
    .pm-val { font-size: 34px; font-weight: 900; color: #FFFFFF; font-variant-numeric: tabular-nums; letter-spacing: 0.3px; }

    .footer-bar { background: #0C2633; border: 2px solid #C9A25B; border-radius: 12px; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; color: #F5EFE1; box-shadow: 0 6px 16px rgba(12, 38, 51, 0.14); }
    .f-item { display: flex; flex-direction: column; gap: 2px; }
    .f-label { font-size: 9.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #C9A25B; }
    .f-val { font-size: 13.5px; font-weight: 700; color: #FFFFFF; }
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
      <div class="meta-row">
        <span class="days-title">${pkg.daysTitle}</span>
        <span class="ref-badge">POST REF: ${effectivePostRefCode}</span>
      </div>
      <div class="main-title">UMRAH PACKAGE</div>
      <div class="route-pill-row">
        <div class="route-pill">${routePillHtml}</div>
      </div>
    </div>

    <div class="starting-banner">
      <div class="sb-left">
        <div class="pkg-num-circle">${pkg.cardNumber}</div>
        <div class="sb-titles">
          <span class="sb-eyebrow">Featured Spotlight Package</span>
          <span class="sb-headline">All-Inclusive Flights, Visa, Hotels &amp; Transfers</span>
        </div>
      </div>
      <div class="sb-right">
        <div class="sb-price-lbl">Starting From (Sharing)</div>
        <div class="sb-price-val"><small>PKR</small>${pSh}</div>
      </div>
    </div>

    <div class="section-card">
      <div class="sec-header">
        <div class="sec-title-wrap">
          <div class="sec-icon">✈</div>
          <div class="sec-title">Confirmed Return Flight Schedule</div>
        </div>
        <div class="baggage-pill">${baggage}</div>
      </div>
      <div class="flight-rows">
        <div class="flight-leg">
          <span class="leg-tag">Outbound</span>
          <span class="leg-fl">${pkg.outboundFlightNo}</span>
          <span class="leg-dt">${pkg.outboundDateLabel}</span>
          <span class="leg-rt">${pkg.outboundRoute}</span>
          <div class="leg-tm"><span>Departure</span>${pkg.outboundDepTime}</div>
          <div class="leg-tm"><span>Arrival</span>${pkg.outboundArrTime}</div>
        </div>
        <div class="flight-leg">
          <span class="leg-tag">Return</span>
          <span class="leg-fl">${pkg.returnFlightNo}</span>
          <span class="leg-dt">${pkg.returnDateLabel}</span>
          <span class="leg-rt">${pkg.returnRoute}</span>
          <div class="leg-tm"><span>Departure</span>${pkg.returnDepTime}</div>
          <div class="leg-tm"><span>Arrival</span>${pkg.returnArrTime}</div>
        </div>
      </div>
    </div>

    <div class="hotels-grid">
      <div class="hotel-card">
        <div class="hc-top">
          <span class="hc-city">🕋 Makkah Hotel</span>
          <span class="hc-nights">${pkg.makkahNights} NIGHTS</span>
        </div>
        <div class="hc-body">
          <div class="hc-name">${pkg.makkahHotelName}</div>
          <div class="hc-dist">📍 ${pkg.makkahDistanceLabel}</div>
        </div>
      </div>
      <div class="hotel-card">
        <div class="hc-top">
          <span class="hc-city">🕌 Madinah Hotel</span>
          <span class="hc-nights">${pkg.madinahNights} NIGHTS</span>
        </div>
        <div class="hc-body">
          <div class="hc-name">${pkg.madinahHotelName}</div>
          <div class="hc-dist">📍 ${pkg.madinahDistanceLabel}</div>
        </div>
      </div>
    </div>

    <div class="inc-card">
      <div class="inc-grid">
        ${inclusionsHtml}
      </div>
    </div>

    <div class="price-matrix">
      <div class="pm-col">
        <div class="pm-lbl">Sharing</div>
        <div class="pm-sub">Per Person</div>
        <div class="pm-val">${pSh}</div>
      </div>
      <div class="pm-col">
        <div class="pm-lbl">Quad</div>
        <div class="pm-sub">4 Bed Room</div>
        <div class="pm-val">${pQd}</div>
      </div>
      <div class="pm-col">
        <div class="pm-lbl">Triple</div>
        <div class="pm-sub">3 Bed Room</div>
        <div class="pm-val">${pTr}</div>
      </div>
      <div class="pm-col">
        <div class="pm-lbl">Double</div>
        <div class="pm-sub">2 Bed Room</div>
        <div class="pm-val">${pDb}</div>
      </div>
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

export async function renderAndUploadSinglePackagePoster(
  pkg: SinglePackageSpotlightInput
): Promise<{ pngUrl: string; pdfUrl: string }> {
  const companyLogoB64 = await getCompanyLogoBase64()
  const html = buildSinglePackageSpotlightHtml(pkg, companyLogoB64)
  const { pngBuffer, pdfBuffer } = await renderHtmlViaChromiumCdp({
    html,
    width: 1080,
    height: 1520,
    deviceScaleFactor: 3,
    capturePng: true,
    capturePdf: true,
  })

  const effectiveRef = (pkg.postRefCode || pkg.postCode || "art-spot-01").toLowerCase()
  const baseKey = `posters/spotlights/${effectiveRef}`
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
