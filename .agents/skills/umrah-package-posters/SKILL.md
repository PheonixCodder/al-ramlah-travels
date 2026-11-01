---
name: umrah-package-posters
description: Generate Ultra-HD 4K (3240x4560 px) Al Ramlah Travels Umrah Package multi-card poster images (PNGs) and an infinite-resolution Vector PDF using the exact HTML/CSS/SVG Python generator script. Use whenever the user asks to create Umrah package posters, package sheets, or social media/WhatsApp package graphics from attached reference package images, an airline logo image, and the attached Al Ramlah Travels company logo image.
---
# Umrah Package Posters

Generate pixel-perfect, Ultra-HD (`3240 x 4560 px` at `deviceScaleFactor: 3`) Al Ramlah Travels Umrah Package posters and a combined infinite-resolution Vector PDF by running the complete Python script below.

## When to Use

- The user wants to convert one or more Umrah package sheets/images into the branded Al Ramlah Travels poster format.
- The user provides 4 sets of attachments when invoking this skill:
  1. **Attachment 1**: A previously generated Al Ramlah Travels package poster image (as the layout/style reference).
  2. **Attachment 2**: One or more source package images containing the flight schedules, Makkah/Madinah hotels, nights, distances, and room prices (`SHARING`, `QUAD`, `TRIPLE`, `DOUBLE`) plus any requested edits.
  3. **Attachment 3**: The airline logo image (such as Saudia, PIA, Airblue, Flynas, Emirates, etc.) to place inside the top-right `.airline-badge`.
  4. **Attachment 4**: The official **Al Ramlah Travels logo image** (`COMPANY_LOGO_PATH`) to place inside the top-left `.brand-left` header block.

## Steps

1. **Locate the Attached Company Logo & Airline Logo Files on Disk**:
   Run a quick bash/Python check on `user_uploaded_files/ttl=63d/user_uploaded/` (inspecting image dimensions/modes or viewing them with `view_file` if needed) to identify:
   - `COMPANY_LOGO_PATH`: Path to the 4th attachment (the official Al Ramlah Travels logo image, typically a `482x423` RGBA PNG or similar square emblem with the Kaaba, minaret, and Arabic calligraphy).
   - `AIRLINE_LOGO_PATH`: Path to the 3rd attachment (the airline logo image for the top-right badge).

2. **Read All Package Details & Requested Changes from the Attached Source Package Images**:
   Carefully transcribe every card from the user's source package image(s) (Attachment 2), applying any price, date, flight, or hotel modifications requested by the user:
   - Card number (`01`, `02`, etc.)
   - Outbound & inbound flight rows (`Flight No`, `Date`, `Route`, `Dep Time`, `Arr Time`)
   - Makkah hotel nights (`mk_n`) and hotel name + distance (`mk_h`)
   - Madina hotel nights (`md_n`) and hotel name + distance (`md_h`)
   - The 4 room prices (`SHARING`, `QUAD`, `TRIPLE`, `DOUBLE`)
   - Top title (`15 DAYS`, `21 DAYS`, etc.) and route pill (`LHE - JED | JED - LHE`, `ISB - JED | MED - ISB`, etc.)
   - Set `is_dense: False` for sheets with 1 to 6 cards (up to 3 rows) and `is_dense: True` for sheets with 7 to 10 cards (4 to 5 rows).

3. **Run the Complete Python Generator Script Verbatim**:
   Write the complete Python script below to `artifacts/file_generation/ttl=63d/intermediate/render_umrah_posters.py` (updating ONLY `COMPANY_LOGO_PATH`, `AIRLINE_LOGO_PATH`, and the `SHEETS` list with the transcribed cards), execute it via `execute_bash`, visually verify with `view_file`, and present both the Ultra-HD PNGs and the combined Vector PDF via `google:show_file`:

```python
#!/usr/bin/env python3
"""Complete Ultra-HD (3240x4560 px) + Infinite-Resolution Vector PDF Generator for Al Ramlah Travels Package Posters."""

import base64
import io
import os
import shutil
import tempfile
import time
from PIL import Image
import pypdf
from selenium import webdriver
from selenium.webdriver.chrome import options as chrome_options

os.makedirs("artifacts/file_generation/ttl=63d/intermediate", exist_ok=True)
os.makedirs("artifacts/file_generation/ttl=63d/output", exist_ok=True)

# 1. Set COMPANY_LOGO_PATH to the 4th attachment (Official Al Ramlah Travels Logo image)
COMPANY_LOGO_PATH = "user_uploaded_files/ttl=63d/user_uploaded/REPLACE_WITH_COMPANY_LOGO_FILENAME.png"
if not os.path.isfile(COMPANY_LOGO_PATH):
    raise FileNotFoundError(f"Company logo not found at {COMPANY_LOGO_PATH}. Check user_uploaded_files/ttl=63d/user_uploaded/")

im_comp = Image.open(COMPANY_LOGO_PATH).convert("RGBA")
buf_comp = io.BytesIO()
im_comp.save(buf_comp, format="PNG")
company_logo_b64 = base64.b64encode(buf_comp.getvalue()).decode("ascii")

# 2. Set AIRLINE_LOGO_PATH to the 3rd attachment (Airline Logo image for the top-right badge)
AIRLINE_LOGO_PATH = "user_uploaded_files/ttl=63d/user_uploaded/REPLACE_WITH_AIRLINE_LOGO_FILENAME.png"
airline_logo_b64 = None
if AIRLINE_LOGO_PATH and os.path.isfile(AIRLINE_LOGO_PATH):
    im_air = Image.open(AIRLINE_LOGO_PATH).convert("RGBA")
    buf_air = io.BytesIO()
    im_air.save(buf_air, format="PNG")
    airline_logo_b64 = base64.b64encode(buf_air.getvalue()).decode("ascii")

SAUDIA_SVG_LOGO = """
<svg viewBox="0 0 280 78" width="235" height="65" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(8, 4)">
    <path d="M45 44 C24 44, 8 33, 0 18 C14 25, 29 28, 45 28 C61 28, 76 25, 90 18 C82 33, 66 44, 45 44 Z" fill="#006C35"/>
    <path d="M45 54 C26 54, 12 46, 3 34 C16 40, 30 43, 45 43 C60 43, 74 40, 87 34 C78 46, 64 54, 45 54 Z" fill="#189B52"/>
    <polygon points="45,46 33,66 45,61 57,66" fill="#006C35"/>
    <circle cx="45" cy="18" r="14" fill="#006C35"/>
    <path d="M45 19 L45 9 M45 11 C40 9, 36 11, 34 14 M45 11 C50 9, 54 11, 56 14 M45 14 C41 13, 38 15, 36 18 M45 14 C49 13, 52 15, 54 18" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M36 25 L54 17 M54 25 L36 17" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
  </g>
  <text x="112" y="50" font-family="'Inter', 'Noto Sans', sans-serif" font-size="38" font-weight="800" font-style="italic" fill="#006C35" letter-spacing="-0.5">Saudia</text>
</svg>
"""

# 3. Populate SHEETS with the package cards from the user's attached package images
SHEETS = [
    {
        "filename": "Al_Ramlah_Umrah_Packages_Sheet_1_UltraHD.png",
        "days_title": "15 DAYS",
        "route_pill": "LHE - JED <span class='sep'>|</span> JED - LHE",
        "is_dense": False,  # False for 1-6 cards (up to 3 rows); True for 7-10 cards (4-5 rows)
        "cards": [
            {"num": "01", "f1": ("SV 733", "13-NOV", "LHE JED", "18:10", "21:50"), "f2": ("SV 732", "28-NOV", "JED LHE", "09:50", "16:30"), "mk_n": "08", "mk_h": "MATHER AL JEWAR<br>OR SIMILAR (550M)", "md_n": "06", "md_h": "ROU KHAIR OR<br>SIMILAR (400M)", "p": ("307,700", "312,300", "333,900", "377,300")},
        ],
    },
]

def render_card_html(c, is_centered_last=False):
    f1_no, f1_dt, f1_rt, f1_t1, f1_t2 = c["f1"]
    f2_no, f2_dt, f2_rt, f2_t1, f2_t2 = c["f2"]
    p_sh, p_qd, p_tr, p_db = c["p"]
    wrap_cls = "pkg-card centered-card" if is_centered_last else "pkg-card"
    return f"""
    <div class="{wrap_cls}">
      <div class="card-top">
        <div class="num-badge">{c["num"]}</div>
        <div class="flight-label">FLIGHT<br>SCHEDULE</div>
        <div class="plane-box">✈</div>
        <div class="flight-table">
          <div class="flight-row"><span>{f1_no}</span><span>{f1_dt}</span><span>{f1_rt}</span><span>{f1_t1}</span><span>{f1_t2}</span></div>
          <div class="flight-row"><span>{f2_no}</span><span>{f2_dt}</span><span>{f2_rt}</span><span>{f2_t1}</span><span>{f2_t2}</span></div>
        </div>
      </div>
      <div class="card-mid">
        <div class="hotel-col">
          <div class="hotel-label">MAKKAH HOTEL <span class="nights-sub">(NIGHTS: {c["mk_n"]})</span></div>
          <div class="hotel-name">{c["mk_h"]}</div>
        </div>
        <div class="hotel-divider"></div>
        <div class="hotel-col">
          <div class="hotel-label">MADINA HOTEL <span class="nights-sub">(NIGHTS: {c["md_n"]})</span></div>
          <div class="hotel-name">{c["md_h"]}</div>
        </div>
      </div>
      <div class="card-bot">
        <div class="price-col"><div class="price-lbl">SHARING</div><div class="price-val">{p_sh}</div></div>
        <div class="price-col"><div class="price-lbl">QUAD</div><div class="price-val">{p_qd}</div></div>
        <div class="price-col"><div class="price-lbl">TRIPLE</div><div class="price-val">{p_tr}</div></div>
        <div class="price-col"><div class="price-lbl">DOUBLE</div><div class="price-val">{p_db}</div></div>
      </div>
    </div>
    """

def build_sheet_html(sheet):
    dense = sheet["is_dense"]
    cards = sheet["cards"]
    cards_html = [render_card_html(c, is_centered_last=(i == len(cards) - 1 and len(cards) % 2 == 1)) for i, c in enumerate(cards)]
    airline_html = f'<img class="airline-img" src="data:image/png;base64,{airline_logo_b64}" alt="Airline">' if airline_logo_b64 else SAUDIA_SVG_LOGO
    route_pill_html = sheet.get("route_pill", "LHE - JED <span class='sep'>|</span> JED - LHE")

    poster_pad = "28px 38px 26px 38px" if dense else "38px 42px 34px 42px"
    top_bar_pad = "10px 18px" if dense else "12px 22px"
    logo_w = "52px" if dense else "62px"
    brand_fs = "20px" if dense else "23px"
    hero_margin = "6px 0 6px 0" if dense else "14px 0 10px 0"
    days_fs = "28px" if dense else "36px"
    main_fs = "52px" if dense else "66px"
    main_margin = "2px 0 8px 0" if dense else "4px 0 12px 0"
    pill_pad = "5px 32px" if dense else "8px 38px"
    pill_fs = "20px" if dense else "24px"
    grid_gap = "15px 16px" if dense else "24px 16px"
    card_pad = "10px 13px" if dense else "14px 16px"
    top_pad_b = "6px" if dense else "10px"
    badge_sz = "32px" if dense else "38px"
    badge_fs = "15.5px" if dense else "18px"
    fl_lbl_fs = "9.5px" if dense else "10.5px"
    plane_sz = "24px" if dense else "28px"
    plane_fs = "13px" if dense else "15px"
    fl_row_fs = "10.2px" if dense else "11px"
    mid_pad = "9px 4px" if dense else "14px 4px"
    mid_min_h = "64px" if dense else "88px"
    h_lbl_fs = "9.5px" if dense else "10.5px"
    h_lbl_mb = "3px" if dense else "5px"
    n_sub_fs = "8.2px" if dense else "9px"
    h_name_fs = "12.5px" if dense else "14px"
    bot_pad = "8px 5px" if dense else "10px 6px"
    p_lbl_fs = "8.5px" if dense else "9.5px"
    p_lbl_mb = "2px" if dense else "4px"
    p_val_fs = "18px" if dense else "19.5px"
    footer_pad = "10px 22px" if dense else "14px 24px"
    f_lbl_fs = "8.5px" if dense else "9.5px"
    f_val_fs = "12.5px" if dense else "13.5px"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    @page {{ size: 1080px 1520px; margin: 0; }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }}
    html, body {{ width: 1080px; height: 1520px; overflow: hidden; font-family: 'Inter', 'Noto Sans', sans-serif; background: #FDFBF6; color: #14232E; }}
    .poster {{ position: relative; width: 1080px; height: 1520px; padding: {poster_pad}; display: flex; flex-direction: column; justify-content: space-between; background: #FDFBF6; }}
    .bg-svg {{ position: absolute; inset: 0; width: 1080px; height: 1520px; z-index: 0; pointer-events: none; }}
    .poster > :not(.bg-svg) {{ position: relative; z-index: 1; }}
    .top-bar {{ display: flex; justify-content: space-between; align-items: center; background: #0C2633; border: 2px solid #C9A25B; border-radius: 12px; padding: {top_bar_pad}; box-shadow: 0 6px 16px rgba(12, 38, 51, 0.14); }}
    .brand-left {{ display: flex; align-items: center; gap: 12px; }}
    .brand-logo {{ width: {logo_w}; height: auto; display: block; }}
    .brand-name {{ font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: {brand_fs}; font-weight: 700; letter-spacing: 2.5px; color: #F5EFE1; line-height: 1.1; }}
    .brand-sub {{ font-size: 10px; letter-spacing: 5px; color: #C9A25B; margin-top: 3px; font-weight: 600; }}
    .brand-center {{ text-align: center; }}
    .tagline-main {{ font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-style: italic; font-size: 14px; color: #E2C58A; }}
    .tagline-services {{ font-size: 9.5px; letter-spacing: 1.5px; color: #F5EFE1; text-transform: uppercase; margin-top: 3px; }}
    .airline-badge {{ background: #FDFBF6; border: 2px solid #C9A25B; border-radius: 10px; padding: 5px 14px; display: flex; align-items: center; justify-content: center; min-width: 175px; height: 54px; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18); }}
    .airline-badge svg {{ height: 42px; width: auto; display: block; }}
    .airline-img {{ max-height: 42px; max-width: 165px; width: auto; height: auto; object-fit: contain; display: block; }}
    .hero-block {{ text-align: center; margin: {hero_margin}; }}
    .days-title {{ font-size: {days_fs}; font-weight: 800; color: #9A7433; letter-spacing: 2px; line-height: 1.05; }}
    .main-title {{ font-size: {main_fs}; font-weight: 900; color: #0C2633; letter-spacing: 2.5px; line-height: 1.02; margin: {main_margin}; }}
    .route-pill {{ display: inline-block; background: #0C2633; color: #F5EFE1; border: 2px solid #C9A25B; padding: {pill_pad}; border-radius: 999px; font-size: {pill_fs}; font-weight: 800; letter-spacing: 3px; box-shadow: 0 4px 10px rgba(12, 38, 51, 0.14); }}
    .route-pill .sep {{ color: #C9A25B; margin: 0 8px; }}
    .cards-grid {{ display: flex; flex-wrap: wrap; justify-content: center; gap: {grid_gap}; margin: 4px 0; }}
    .pkg-card {{ width: calc(50% - 8px); background: #FFFFFF; border: 1.5px solid #DFD2B5; border-radius: 12px; padding: {card_pad}; box-shadow: 0 5px 15px rgba(12, 38, 51, 0.08); display: flex; flex-direction: column; justify-content: space-between; }}
    .card-top {{ display: flex; align-items: center; gap: 8px; padding-bottom: {top_pad_b}; border-bottom: 1.5px solid #EAE0C8; }}
    .num-badge {{ background: #0C2633; color: #E2C58A; border: 1.5px solid #C9A25B; border-radius: 7px; min-width: {badge_sz}; height: {badge_sz}; display: flex; align-items: center; justify-content: center; font-size: {badge_fs}; font-weight: 800; }}
    .flight-label {{ font-size: {fl_lbl_fs}; font-weight: 800; color: #0C2633; line-height: 1.12; letter-spacing: 0.3px; }}
    .plane-box {{ width: {plane_sz}; height: {plane_sz}; border: 1.5px solid #C9A25B; background: #FDFBF6; color: #0C2633; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: {plane_fs}; flex-shrink: 0; }}
    .flight-table {{ flex: 1; display: flex; flex-direction: column; gap: 2px; }}
    .flight-row {{ display: grid; grid-template-columns: 1.15fr 1.15fr 1.35fr 0.9fr 0.9fr; font-size: {fl_row_fs}; font-weight: 800; color: #14232E; font-variant-numeric: tabular-nums; letter-spacing: 0.1px; }}
    .flight-row span {{ white-space: nowrap; }}
    .card-mid {{ display: flex; align-items: stretch; padding: {mid_pad}; min-height: {mid_min_h}; }}
    .hotel-col {{ flex: 1; display: flex; flex-direction: column; justify-content: flex-start; }}
    .hotel-divider {{ width: 1.5px; background: #DFD2B5; margin: 0 10px; }}
    .hotel-label {{ font-size: {h_lbl_fs}; font-weight: 800; color: #9A7433; margin-bottom: {h_lbl_mb}; letter-spacing: 0.2px; }}
    .nights-sub {{ font-size: {n_sub_fs}; color: #5E6B73; font-weight: 700; }}
    .hotel-name {{ font-size: {h_name_fs}; font-weight: 800; color: #0C2633; line-height: 1.2; text-transform: uppercase; }}
    .card-bot {{ background: #0C2633; border-top: 2px solid #C9A25B; border-radius: 8px; padding: {bot_pad}; display: grid; grid-template-columns: repeat(4, 1fr); }}
    .price-col {{ text-align: center; border-right: 1px solid rgba(201, 162, 91, 0.38); padding: 0 3px; }}
    .price-col:last-child {{ border-right: none; }}
    .price-lbl {{ font-size: {p_lbl_fs}; font-weight: 700; color: #E2C58A; letter-spacing: 0.5px; margin-bottom: {p_lbl_mb}; }}
    .price-val {{ font-size: {p_val_fs}; font-weight: 800; color: #FFFFFF; font-variant-numeric: tabular-nums; letter-spacing: 0.1px; }}
    .footer-bar {{ background: #0C2633; border: 2px solid #C9A25B; border-radius: 12px; padding: {footer_pad}; display: flex; justify-content: space-between; align-items: center; color: #F5EFE1; box-shadow: 0 6px 16px rgba(12, 38, 51, 0.14); }}
    .f-item {{ display: flex; flex-direction: column; gap: 2px; }}
    .f-label {{ font-size: {f_lbl_fs}; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #C9A25B; }}
    .f-val {{ font-size: {f_val_fs}; font-weight: 700; color: #FFFFFF; }}
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
          <img class="brand-logo" src="data:image/png;base64,{company_logo_b64}" alt="Al Ramlah Travels">
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
          {airline_html}
        </div>
      </div>

      <div class="hero-block">
        <div class="days-title">{sheet["days_title"]}</div>
        <div class="main-title">UMRAH PACKAGES</div>
        <div class="route-pill">{route_pill_html}</div>
      </div>
    </div>

    <div class="cards-grid">
      {"".join(cards_html)}
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
</html>
"""

user_data_dir = tempfile.mkdtemp(prefix="chromium_4k_")
pdf_writer = pypdf.PdfWriter()
try:
    opts = chrome_options.Options()
    for arg in ("--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={user_data_dir}"):
        opts.add_argument(arg)
    driver = webdriver.Chrome(options=opts)
    driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
        "width": 1080, "height": 1520, "deviceScaleFactor": 3, "mobile": False,
    })
    for idx, sheet in enumerate(SHEETS, start=1):
        html_str = build_sheet_html(sheet)
        driver.get("about:blank")
        frame_id = driver.execute_cdp_cmd("Page.getFrameTree", {})["frameTree"]["frame"]["id"]
        driver.execute_cdp_cmd("Page.setDocumentContent", {"frameId": frame_id, "html": html_str})
        time.sleep(0.6)
        shot = driver.execute_cdp_cmd("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        out_png = os.path.join("artifacts/file_generation/ttl=63d/output", sheet["filename"])
        with open(out_png, "wb") as f:
            f.write(base64.b64decode(shot["data"]))
        pdf_res = driver.execute_cdp_cmd("Page.printToPDF", {
            "landscape": False, "displayHeaderFooter": False, "printBackground": True,
            "preferCSSPageSize": True, "marginTop": 0, "marginBottom": 0, "marginLeft": 0, "marginRight": 0
        })
        tmp_pdf = f"artifacts/file_generation/ttl=63d/intermediate/sheet_{idx}.pdf"
        with open(tmp_pdf, "wb") as pf:
            pf.write(base64.b64decode(pdf_res["data"]))
        pdf_writer.append(tmp_pdf)
    driver.quit()
finally:
    shutil.rmtree(user_data_dir, ignore_errors=True)

combined_pdf = "artifacts/file_generation/ttl=63d/output/Al_Ramlah_Umrah_Packages_Posters_Vector.pdf"
with open(combined_pdf, "wb") as f:
    pdf_writer.write(f)
```
