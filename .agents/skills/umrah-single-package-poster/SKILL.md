---
name: umrah-single-package-poster
description: Generate Ultra-HD 4K (3240x4560 px) Al Ramlah Travels Single-Package Spotlight ("Attention Grabber") Umrah poster images (PNGs) and an infinite-resolution Vector PDF using the exact HTML/CSS/SVG Python generator script. Use whenever the user asks to create a dedicated single-package Umrah poster, spotlight post, WhatsApp status/group lead image, or social media post for individual packages from a supplier flyer.
---
# Umrah Single-Package Spotlight Poster

Generate pixel-perfect, Ultra-HD (`3240 x 4560 px` at `deviceScaleFactor: 3`) Al Ramlah Travels **Single-Package Spotlight Posters** ("Attention Grabbers") and a combined infinite-resolution Vector PDF by running the complete Python script below.

## When to Use

- The user wants to create a clutter-free, scroll-stopping dedicated poster for **one single Umrah package** (or a batch of individual 1-package spotlight posters, one per card) to grab customer attention on WhatsApp Groups, WhatsApp Status, Instagram, Facebook, or TikTok before sharing the full multi-package sheet.
- Each spotlight poster features:
  1. **Top Brand Header**: Official Al Ramlah Travels logo & tagline on the left, Airline logo badge on the right.
  2. **Hero Spotlight Header**: Duration (`15 DAYS`, `21 DAYS`), `UMRAH PACKAGE`, Route Pill (`LHE - JED | JED - LHE`), **Traceable Post Reference Code Badge** (`REF: ART-AM-21D-01`), and a prominent **"STARTING FROM PKR ..."** gold-framed hero callout.
  3. **Full-Width Flight Schedule Card**: Outbound & Return flight numbers, dates, routes, departure/arrival times, and baggage allowance.
  4. **Spacious Makkah & Madinah Hotel Cards**: Big hotel names, Night badges (`NIGHTS: 08` / `NIGHTS: 06`), and walking/shuttle distance pills (`550M WALK` / `1500M SHUTTLE SERVICE`).
  5. **Inclusions & Gifted Ziyarat Strip**: Highlights Visa, Insurance, Transport, and Gifted Ziyarat (`Gifted Taif Ziyarat`, `Gifted Makkah & Madinah Ziyarat`).
  6. **Massive 4-Tier Price Bar**: `SHARING`, `QUAD`, `TRIPLE`, and `DOUBLE` prices in huge, mobile-legible typography above the official Al Ramlah footer bar.

## Steps

1. **Locate the Attached Company Logo & Airline Logo Files on Disk**:
   Identify:
   - `COMPANY_LOGO_PATH`: Official Al Ramlah Travels logo image (`public/logo.jpg` or `public/logo-icon.png` or attached file).
   - `AIRLINE_LOGO_PATH`: Airline logo image (Saudia, PIA, Airblue, etc.) or leave `None` to use the built-in vector airline badge.

2. **Populate `PACKAGES` in the Generator Script**:
   For each single package to render, populate a dictionary in `PACKAGES` with:
   - `filename`: Output PNG filename (e.g. `"Al_Ramlah_Spotlight_ART_AM_21D_01_UltraHD.png"`)
   - `ref_code`: Unique traceable reference code (e.g. `"ART-AM-21D-01"`)
   - `days_title`: `"15 DAYS"` or `"21 DAYS"`
   - `route_pill`: `"LHE - JED <span class='sep'>|</span> JED - LHE"`
   - `baggage`: `"OUTBOUND 20KG+7KG · INBOUND 30KG+7KG"` (or `"23KG OUTBOUND · 46KG RETURN"`)
   - `f1`: Outbound tuple `("PA 470", "14-NOV", "LHE → JED", "23:00", "03:15")`
   - `f2`: Return tuple `("PA 471", "04-DEC", "JED → LHE", "04:30", "11:15")`
   - `mk_n`: Makkah nights string (`"12"`)
   - `mk_h`: Makkah hotel name (`"HOTEL NUMBER ONE 3"`)
   - `mk_dist`: Makkah distance/access badge (`"1500M · SHUTTLE SERVICE"`)
   - `md_n`: Madinah nights string (`"08"`)
   - `md_h`: Madinah hotel name (`"RETAJ AL MADINA"`)
   - `md_dist`: Madinah distance/access badge (`"1200M · SHUTTLE SERVICE"`)
   - `inclusions`: List of 4 inclusion/gift strings (e.g. `["Umrah Visa & Insurance", "Full Ground Transport", "Gifted Taif & Makkah Ziyarat", "Gifted Madinah Ziyarat"]`)
   - `p`: 4-price tuple `("269,899", "274,599", "282,399", "297,999")`

3. **Run the Complete Python Generator Script Verbatim**:

```python
#!/usr/bin/env python3
"""Complete Ultra-HD (3240x4560 px) + Infinite-Resolution Vector PDF Generator for Al Ramlah Travels Single-Package Spotlight Posters."""

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

COMPANY_LOGO_PATH = "user_uploaded_files/ttl=63d/user_uploaded/REPLACE_WITH_COMPANY_LOGO_FILENAME.png"
if not os.path.isfile(COMPANY_LOGO_PATH):
    raise FileNotFoundError(f"Company logo not found at {COMPANY_LOGO_PATH}")

im_comp = Image.open(COMPANY_LOGO_PATH).convert("RGBA")
buf_comp = io.BytesIO()
im_comp.save(buf_comp, format="PNG")
company_logo_b64 = base64.b64encode(buf_comp.getvalue()).decode("ascii")

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

PACKAGES = [
    {
        "filename": "Al_Ramlah_Spotlight_ART_AM_21D_01_UltraHD.png",
        "num": "01",
        "ref_code": "ART-AM-21D-01",
        "days_title": "21 DAYS",
        "route_pill": "LHE - JED <span class='sep'>|</span> JED - LHE",
        "baggage": "OUTBOUND 20KG+07KG  •  INBOUND 30KG+07KG",
        "f1": ("PA 470", "14-NOV", "LHE → JED", "23:00", "03:15"),
        "f2": ("PA 471", "04-DEC", "JED → LHE", "04:30", "11:15"),
        "mk_n": "12",
        "mk_h": "HOTEL NUMBER ONE 3",
        "mk_dist": "1500M · SHUTTLE SERVICE",
        "md_n": "08",
        "md_h": "RETAJ AL MADINA",
        "md_dist": "1200M · SHUTTLE SERVICE",
        "inclusions": [
            "Official Umrah Visa & Insurance",
            "Complete Ground Transport Included",
            "Gifted Taif & Makkah Ziyarat",
            "Gifted Madinah Ziyarat",
        ],
        "p": ("269,899", "274,599", "282,399", "297,999"),
    }
]

def build_spotlight_html(pkg):
    f1_no, f1_dt, f1_rt, f1_t1, f1_t2 = pkg["f1"]
    f2_no, f2_dt, f2_rt, f2_t1, f2_t2 = pkg["f2"]
    p_sh, p_qd, p_tr, p_db = pkg["p"]
    airline_html = f'<img class="airline-img" src="data:image/png;base64,{airline_logo_b64}" alt="Airline">' if airline_logo_b64 else SAUDIA_SVG_LOGO
    inclusions_html = "".join(
        f'<div class="inc-pill"><span class="inc-check">✦</span><span>{inc}</span></div>'
        for inc in pkg.get("inclusions", [])
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    @page {{ size: 1080px 1520px; margin: 0; }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }}
    html, body {{ width: 1080px; height: 1520px; overflow: hidden; font-family: 'Inter', 'Noto Sans', sans-serif; background: #FDFBF6; color: #14232E; }}
    .poster {{ position: relative; width: 1080px; height: 1520px; padding: 38px 44px 34px 44px; display: flex; flex-direction: column; justify-content: space-between; background: #FDFBF6; }}
    .bg-svg {{ position: absolute; inset: 0; width: 1080px; height: 1520px; z-index: 0; pointer-events: none; }}
    .poster > :not(.bg-svg) {{ position: relative; z-index: 1; }}

    /* Top Brand Bar */
    .top-bar {{ display: flex; justify-content: space-between; align-items: center; background: #0C2633; border: 2px solid #C9A25B; border-radius: 14px; padding: 14px 24px; box-shadow: 0 8px 20px rgba(12, 38, 51, 0.16); }}
    .brand-left {{ display: flex; align-items: center; gap: 14px; }}
    .brand-logo {{ width: 64px; height: auto; display: block; }}
    .brand-name {{ font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 24px; font-weight: 700; letter-spacing: 2.5px; color: #F5EFE1; line-height: 1.1; }}
    .brand-sub {{ font-size: 10.5px; letter-spacing: 5.5px; color: #C9A25B; margin-top: 3px; font-weight: 600; }}
    .brand-center {{ text-align: center; }}
    .tagline-main {{ font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-style: italic; font-size: 15px; color: #E2C58A; }}
    .tagline-services {{ font-size: 10px; letter-spacing: 1.8px; color: #F5EFE1; text-transform: uppercase; margin-top: 4px; }}
    .airline-badge {{ background: #FDFBF6; border: 2px solid #C9A25B; border-radius: 10px; padding: 6px 16px; display: flex; align-items: center; justify-content: center; min-width: 185px; height: 58px; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18); }}
    .airline-badge svg {{ height: 44px; width: auto; display: block; }}
    .airline-img {{ max-height: 44px; max-width: 170px; width: auto; height: auto; object-fit: contain; display: block; }}

    /* Hero Spotlight Block */
    .hero-block {{ text-align: center; margin: 10px 0 6px 0; }}
    .meta-row {{ display: flex; justify-content: center; align-items: center; gap: 14px; margin-bottom: 6px; }}
    .ref-badge {{ background: #F5EFE1; border: 1.5px solid #C9A25B; color: #0C2633; font-size: 13px; font-weight: 800; letter-spacing: 1.8px; padding: 5px 16px; border-radius: 999px; }}
    .days-title {{ font-size: 36px; font-weight: 900; color: #9A7433; letter-spacing: 3px; line-height: 1.05; }}
    .main-title {{ font-size: 64px; font-weight: 900; color: #0C2633; letter-spacing: 2.5px; line-height: 1.02; margin: 2px 0 12px 0; }}
    .route-pill-row {{ display: flex; justify-content: center; align-items: center; gap: 16px; }}
    .route-pill {{ display: inline-block; background: #0C2633; color: #F5EFE1; border: 2px solid #C9A25B; padding: 8px 36px; border-radius: 999px; font-size: 23px; font-weight: 800; letter-spacing: 3px; box-shadow: 0 4px 12px rgba(12, 38, 51, 0.14); }}
    .route-pill .sep {{ color: #C9A25B; margin: 0 10px; }}

    /* Hero Starting Price Banner */
    .starting-banner {{ background: linear-gradient(135deg, #0C2633 0%, #163B4D 100%); border: 2.5px solid #C9A25B; border-radius: 16px; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 24px rgba(12, 38, 51, 0.14); }}
    .sb-left {{ display: flex; align-items: center; gap: 16px; }}
    .pkg-num-circle {{ width: 58px; height: 58px; border-radius: 14px; background: #FDFBF6; border: 2px solid #C9A25B; color: #0C2633; font-size: 28px; font-weight: 900; display: flex; align-items: center; justify-content: center; }}
    .sb-titles {{ display: flex; flex-direction: column; }}
    .sb-eyebrow {{ font-size: 13px; font-weight: 800; letter-spacing: 2.5px; color: #E2C58A; text-transform: uppercase; }}
    .sb-headline {{ font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 26px; font-weight: 700; color: #FFFFFF; margin-top: 2px; }}
    .sb-right {{ text-align: right; }}
    .sb-price-lbl {{ font-size: 12px; font-weight: 800; letter-spacing: 2px; color: #E2C58A; text-transform: uppercase; }}
    .sb-price-val {{ font-size: 44px; font-weight: 900; color: #FFFFFF; font-variant-numeric: tabular-nums; letter-spacing: 0.5px; line-height: 1.05; }}
    .sb-price-val small {{ font-size: 20px; color: #C9A25B; font-weight: 800; margin-right: 6px; }}

    /* Flight Schedule Card */
    .section-card {{ background: #FFFFFF; border: 2px solid #DFD2B5; border-radius: 16px; padding: 20px 26px; box-shadow: 0 6px 18px rgba(12, 38, 51, 0.08); }}
    .sec-header {{ display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1.5px solid #EAE0C8; margin-bottom: 14px; }}
    .sec-title-wrap {{ display: flex; align-items: center; gap: 12px; }}
    .sec-icon {{ width: 38px; height: 38px; border-radius: 9px; background: #0C2633; border: 1.5px solid #C9A25B; color: #E2C58A; display: flex; align-items: center; justify-content: center; font-size: 20px; }}
    .sec-title {{ font-size: 18px; font-weight: 900; color: #0C2633; letter-spacing: 1.5px; text-transform: uppercase; }}
    .baggage-pill {{ background: #F5EFE1; border: 1.5px solid #C9A25B; color: #0C2633; font-size: 12px; font-weight: 800; letter-spacing: 1.2px; padding: 5px 14px; border-radius: 8px; }}
    .flight-rows {{ display: flex; flex-direction: column; gap: 10px; }}
    .flight-leg {{ display: grid; grid-template-columns: 130px 120px 130px 1fr 130px 130px; align-items: center; background: #FDFBF6; border: 1.5px solid #EAE0C8; border-radius: 12px; padding: 12px 18px; font-variant-numeric: tabular-nums; }}
    .leg-tag {{ background: #0C2633; color: #E2C58A; font-size: 11.5px; font-weight: 800; letter-spacing: 1.2px; padding: 5px 10px; border-radius: 6px; text-align: center; width: fit-content; text-transform: uppercase; }}
    .leg-fl {{ font-size: 20px; font-weight: 900; color: #0C2633; }}
    .leg-dt {{ font-size: 18px; font-weight: 800; color: #9A7433; }}
    .leg-rt {{ font-size: 20px; font-weight: 900; color: #14232E; letter-spacing: 1px; }}
    .leg-tm {{ font-size: 17px; font-weight: 800; color: #14232E; text-align: right; }}
    .leg-tm span {{ display: block; font-size: 10px; font-weight: 700; color: #5E6B73; letter-spacing: 1px; text-transform: uppercase; }}

    /* Hotels Grid (Makkah & Madinah) */
    .hotels-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
    .hotel-card {{ background: #FFFFFF; border: 2px solid #DFD2B5; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 18px rgba(12, 38, 51, 0.08); display: flex; flex-direction: column; justify-content: space-between; }}
    .hc-top {{ background: #0C2633; border-bottom: 2px solid #C9A25B; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; }}
    .hc-city {{ font-size: 17px; font-weight: 900; color: #E2C58A; letter-spacing: 2px; text-transform: uppercase; }}
    .hc-nights {{ background: #C9A25B; color: #0C2633; font-size: 14px; font-weight: 900; padding: 4px 12px; border-radius: 999px; letter-spacing: 1px; }}
    .hc-body {{ padding: 22px 22px; display: flex; flex-direction: column; gap: 12px; }}
    .hc-name {{ font-size: 25px; font-weight: 900; color: #0C2633; line-height: 1.2; text-transform: uppercase; min-height: 60px; display: flex; align-items: center; }}
    .hc-dist {{ display: inline-flex; align-items: center; gap: 8px; background: #F5EFE1; border: 1.5px solid #DFD2B5; color: #9A7433; font-size: 14px; font-weight: 800; padding: 7px 14px; border-radius: 8px; width: fit-content; letter-spacing: 0.6px; text-transform: uppercase; }}

    /* Inclusions Strip */
    .inc-card {{ background: #FFFFFF; border: 2px solid #DFD2B5; border-radius: 14px; padding: 14px 22px; box-shadow: 0 5px 15px rgba(12, 38, 51, 0.06); }}
    .inc-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }}
    .inc-pill {{ background: #FDFBF6; border: 1.5px solid #EAE0C8; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; color: #0C2633; line-height: 1.25; }}
    .inc-check {{ color: #9A7433; font-size: 16px; font-weight: 900; flex-shrink: 0; }}

    /* 4-Tier Price Matrix Bar */
    .price-matrix {{ background: #0C2633; border: 2.5px solid #C9A25B; border-radius: 16px; padding: 18px 16px; display: grid; grid-template-columns: repeat(4, 1fr); box-shadow: 0 10px 24px rgba(12, 38, 51, 0.16); }}
    .pm-col {{ text-align: center; border-right: 1.5px solid rgba(201, 162, 91, 0.4); padding: 4px 10px; }}
    .pm-col:last-child {{ border-right: none; }}
    .pm-lbl {{ font-size: 14px; font-weight: 800; color: #E2C58A; letter-spacing: 2px; margin-bottom: 6px; text-transform: uppercase; }}
    .pm-sub {{ font-size: 10.5px; font-weight: 600; color: #C9A25B; margin-bottom: 4px; letter-spacing: 0.8px; text-transform: uppercase; }}
    .pm-val {{ font-size: 34px; font-weight: 900; color: #FFFFFF; font-variant-numeric: tabular-nums; letter-spacing: 0.3px; }}

    /* Footer Bar */
    .footer-bar {{ background: #0C2633; border: 2px solid #C9A25B; border-radius: 12px; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; color: #F5EFE1; box-shadow: 0 6px 16px rgba(12, 38, 51, 0.14); }}
    .f-item {{ display: flex; flex-direction: column; gap: 2px; }}
    .f-label {{ font-size: 9.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #C9A25B; }}
    .f-val {{ font-size: 13.5px; font-weight: 700; color: #FFFFFF; }}
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
      <div class="meta-row">
        <span class="days-title">{pkg["days_title"]}</span>
        <span class="ref-badge">POST REF: {pkg["ref_code"]}</span>
      </div>
      <div class="main-title">UMRAH PACKAGE</div>
      <div class="route-pill-row">
        <div class="route-pill">{pkg["route_pill"]}</div>
      </div>
    </div>

    <div class="starting-banner">
      <div class="sb-left">
        <div class="pkg-num-circle">{pkg["num"]}</div>
        <div class="sb-titles">
          <span class="sb-eyebrow">Featured Spotlight Package</span>
          <span class="sb-headline">All-Inclusive Flights, Visa, Hotels &amp; Transfers</span>
        </div>
      </div>
      <div class="sb-right">
        <div class="sb-price-lbl">Starting From (Sharing)</div>
        <div class="sb-price-val"><small>PKR</small>{p_sh}</div>
      </div>
    </div>

    <div class="section-card">
      <div class="sec-header">
        <div class="sec-title-wrap">
          <div class="sec-icon">✈</div>
          <div class="sec-title">Confirmed Return Flight Schedule</div>
        </div>
        <div class="baggage-pill">{pkg.get("baggage", "23KG OUTBOUND • 46KG RETURN")}</div>
      </div>
      <div class="flight-rows">
        <div class="flight-leg">
          <span class="leg-tag">Outbound</span>
          <span class="leg-fl">{f1_no}</span>
          <span class="leg-dt">{f1_dt}</span>
          <span class="leg-rt">{f1_rt}</span>
          <div class="leg-tm"><span>Departure</span>{f1_t1}</div>
          <div class="leg-tm"><span>Arrival</span>{f1_t2}</div>
        </div>
        <div class="flight-leg">
          <span class="leg-tag">Return</span>
          <span class="leg-fl">{f2_no}</span>
          <span class="leg-dt">{f2_dt}</span>
          <span class="leg-rt">{f2_rt}</span>
          <div class="leg-tm"><span>Departure</span>{f2_t1}</div>
          <div class="leg-tm"><span>Arrival</span>{f2_t2}</div>
        </div>
      </div>
    </div>

    <div class="hotels-grid">
      <div class="hotel-card">
        <div class="hc-top">
          <span class="hc-city">🕋 Makkah Hotel</span>
          <span class="hc-nights">{pkg["mk_n"]} NIGHTS</span>
        </div>
        <div class="hc-body">
          <div class="hc-name">{pkg["mk_h"]}</div>
          <div class="hc-dist">📍 {pkg["mk_dist"]}</div>
        </div>
      </div>
      <div class="hotel-card">
        <div class="hc-top">
          <span class="hc-city">🕌 Madinah Hotel</span>
          <span class="hc-nights">{pkg["md_n"]} NIGHTS</span>
        </div>
        <div class="hc-body">
          <div class="hc-name">{pkg["md_h"]}</div>
          <div class="hc-dist">📍 {pkg["md_dist"]}</div>
        </div>
      </div>
    </div>

    <div class="inc-card">
      <div class="inc-grid">
        {inclusions_html}
      </div>
    </div>

    <div class="price-matrix">
      <div class="pm-col">
        <div class="pm-lbl">Sharing</div>
        <div class="pm-sub">Per Person</div>
        <div class="pm-val">{p_sh}</div>
      </div>
      <div class="pm-col">
        <div class="pm-lbl">Quad</div>
        <div class="pm-sub">4 Bed Room</div>
        <div class="pm-val">{p_qd}</div>
      </div>
      <div class="pm-col">
        <div class="pm-lbl">Triple</div>
        <div class="pm-sub">3 Bed Room</div>
        <div class="pm-val">{p_tr}</div>
      </div>
      <div class="pm-col">
        <div class="pm-lbl">Double</div>
        <div class="pm-sub">2 Bed Room</div>
        <div class="pm-val">{p_db}</div>
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
</html>
"""

user_data_dir = tempfile.mkdtemp(prefix="chromium_spotlight_4k_")
pdf_writer = pypdf.PdfWriter()
try:
    opts = chrome_options.Options()
    for arg in ("--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={user_data_dir}"):
        opts.add_argument(arg)
    driver = webdriver.Chrome(options=opts)
    driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
        "width": 1080, "height": 1520, "deviceScaleFactor": 3, "mobile": False,
    })
    for idx, pkg in enumerate(PACKAGES, start=1):
        html_str = build_spotlight_html(pkg)
        driver.get("about:blank")
        frame_id = driver.execute_cdp_cmd("Page.getFrameTree", {})["frameTree"]["frame"]["id"]
        driver.execute_cdp_cmd("Page.setDocumentContent", {"frameId": frame_id, "html": html_str})
        time.sleep(0.6)
        shot = driver.execute_cdp_cmd("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        out_png = os.path.join("artifacts/file_generation/ttl=63d/output", pkg["filename"])
        with open(out_png, "wb") as f:
            f.write(base64.b64decode(shot["data"]))
        pdf_res = driver.execute_cdp_cmd("Page.printToPDF", {
            "landscape": False, "displayHeaderFooter": False, "printBackground": True,
            "preferCSSPageSize": True, "marginTop": 0, "marginBottom": 0, "marginLeft": 0, "marginRight": 0
        })
        tmp_pdf = f"artifacts/file_generation/ttl=63d/intermediate/spotlight_{idx}.pdf"
        with open(tmp_pdf, "wb") as pf:
            pf.write(base64.b64decode(pdf_res["data"]))
        pdf_writer.append(tmp_pdf)
    driver.quit()
finally:
    shutil.rmtree(user_data_dir, ignore_errors=True)

combined_pdf = "artifacts/file_generation/ttl=63d/output/Al_Ramlah_Umrah_Spotlight_Posters_Vector.pdf"
with open(combined_pdf, "wb") as f:
    pdf_writer.write(f)
```
