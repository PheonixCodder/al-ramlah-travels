---
name: umrah-quotation-pdf
description: Generate a branded Al Ramlah Travels Umrah package quotation PDF using the exact 3-page luxury card-based Python generator script. Use whenever the user asks to create an Umrah quote, Umrah quotation PDF, or travel package quotation for a client, whether from an attached template PDF, an Excel costing sheet, or inline trip details (client name, travelers, airline, flight segments, Makkah and Madinah hotels, room and bed allocation, ground transport vehicle and sectors, and final package price).
---
# Umrah Quotation PDF

Generate an exact replica of the finalized 3-page Al Ramlah Travels Umrah quotation PDF by running the complete Python script below and substituting only the client-specific text values. Do not rewrite the CSS, do not invent a new layout, and do not use reportlab/fpdf/weasyprint. Always execute the exact Python script below via `execute_bash` so the resulting PDF is visually identical to the finalized template.

## When to Use

- The user asks to generate, update, or customize an Umrah quotation PDF for a client or family.
- The user attaches a previous Al Ramlah Travels Umrah quotation PDF (or Hajj brochure PDF) as a template and provides new client, flight, hotel, transport, or pricing details (either in chat or via an attached spreadsheet).

## Steps

1. **Verify Trip Details**:
   Gather the trip details from the prompt or attached spreadsheet/PDF. If any critical detail is missing or ambiguous, ask the user before guessing.

2. **Run the Complete Python Generator Script**:
   Write the complete Python script below to `artifacts/file_generation/ttl=63d/intermediate/generate_pdf.py` (updating ONLY the `TEMPLATE_PDF_PATH`, `OUTPUT_PDF_PATH`, and the trip text strings inside `HTML_CONTENT` while keeping 100% of the CSS and HTML tags untouched), and run it via `python3 artifacts/file_generation/ttl=63d/intermediate/generate_pdf.py`:

```python
#!/usr/bin/env python3
"""Complete end-to-end generator for the 3-page Al Ramlah Travels Umrah Quotation PDF."""

import base64
import glob
import mimetypes
import os
import re
import shutil
import tempfile
import time
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw
import pypdf
from selenium import webdriver
from selenium.webdriver.chrome import options as chrome_options

os.makedirs("artifacts/file_generation/ttl=63d/intermediate", exist_ok=True)
os.makedirs("artifacts/file_generation/ttl=63d/output", exist_ok=True)

# 1. Extract official Al Ramlah Travels logo from the attached template PDF
pdf_candidates = glob.glob("user_uploaded_files/**/*.pdf", recursive=True)
for pdf_path in pdf_candidates:
    reader = pypdf.PdfReader(pdf_path)
    for page in reader.pages:
        for img in page.images:
            cand_path = "artifacts/file_generation/ttl=63d/intermediate/cand_logo.png"
            with open(cand_path, "wb") as f:
                f.write(img.data)
            im = Image.open(cand_path)
            if im.mode == "RGBA" or im.size[0] < 800:
                im.save("artifacts/file_generation/ttl=63d/intermediate/logo.png")
                break
        if os.path.isfile("artifacts/file_generation/ttl=63d/intermediate/logo.png"):
            break

# 2. Generate the exact Al Ramlah Travels cover background (deep teal + diamond lattice + double gold frame)
W, H = 1240, 1754
bg_color = (12, 38, 51)       # #0C2633
pattern_color = (22, 55, 72)  # subtle teal diamond lattice
gold_color = (201, 162, 91)   # #C9A25B

img = Image.new("RGB", (W, H), bg_color)
draw = ImageDraw.Draw(img)

step = 155
for y in range(-step, H + step, step):
    for x in range(-step, W + step, step):
        for offset_x, offset_y in [(0, 0), (step // 2, step // 2)]:
            cx = x + offset_x
            cy = y + offset_y
            r = 22
            pts = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]
            draw.polygon(pts, outline=pattern_color, width=2)
            r2 = 10
            pts2 = [(cx, cy - r2), (cx + r2, cy), (cx, cy + r2), (cx - r2, cy)]
            draw.polygon(pts2, outline=pattern_color, width=1)
            for dx, dy in [(-18, -18), (18, -18), (-18, 18), (18, 18)]:
                px, py = cx + dx, cy + dy
                pr = 5
                draw.polygon([(px, py - pr), (px + pr, py), (px, py + pr), (px - pr, py)], outline=pattern_color, width=1)

m1, m2 = 56, 68
draw.rectangle([m1, m1, W - m1, H - m1], outline=gold_color, width=3)
draw.rectangle([m2, m2, W - m2, H - m2], outline=gold_color, width=1)
for cx, cy in [(m1, m1), (W - m1, m1), (m1, H - m1), (W - m1, H - m1)]:
    dr = 11
    draw.polygon([(cx, cy - dr), (cx + dr, cy), (cx, cy + dr), (cx - dr, cy)], fill=gold_color)

img.save("artifacts/file_generation/ttl=63d/intermediate/cover_bg.png", "PNG")

# 3. Exact 3-page HTML & CSS template (update ONLY the trip text strings inside HTML_CONTENT; DO NOT alter CSS or structure)
HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Al Ramlah Travels - Umrah 2026 Quotation (Mr. Barrister Adil Rafi Cheema)</title>
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
    @media screen {
      html, body { background: var(--bg); }
      body { max-width: 900px; margin: 0 auto; padding: 32px 40px; }
    }

    main.document-flow { width: 100%; margin: 0; padding: 0; }

    /* Dedicated Cover Page */
    .cover-page { position: relative; width: 100%; min-height: 297mm; padding: 22mm 22mm 18mm 22mm; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; color: #F5EFE1; page-break-after: always; break-after: page; overflow: hidden; }
    .cover-page .img-page-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
    .cover-page > :not(.img-page-bg) { position: relative; z-index: 1; width: 100%; }
    .cover-logo { width: 195px; height: auto; margin: 0 auto 14px auto; display: block; }
    .cover-brand { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 28pt; font-weight: 700; letter-spacing: 3px; color: #F5EFE1; margin: 0 0 6px 0; }
    .cover-subbrand { font-size: 11pt; letter-spacing: 7px; color: var(--gold-mid); margin: 0 0 12px 0; font-weight: 500; }
    .cover-tagline { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-style: italic; font-size: 11.5pt; color: var(--gold-light); margin: 0 0 22px 0; }
    .cover-title { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 32pt; font-weight: 700; letter-spacing: 2px; color: var(--gold-light); margin: 14px 0 8px 0; }
    .cover-subtitle { font-size: 11pt; letter-spacing: 5px; color: #F5EFE1; text-transform: uppercase; margin: 0 0 24px 0; }
    .cover-client-label { font-size: 9pt; letter-spacing: 3px; text-transform: uppercase; color: var(--gold-mid); margin: 18px 0 6px 0; }
    .cover-client-name { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 19pt; font-weight: 700; color: #FFFFFF; margin: 0 0 6px 0; }
    .cover-client-meta { font-size: 10.5pt; color: var(--gold-light); margin: 0 0 18px 0; }
    .cover-summary-table { width: 90%; margin: 12px auto 0 auto; border-collapse: collapse; }
    .cover-summary-table th { font-size: 8.5pt; letter-spacing: 1.5px; text-transform: uppercase; color: var(--gold-mid); border-bottom: 1px solid rgba(201, 162, 91, 0.45); padding: 8px 10px; text-align: center; }
    .cover-summary-table td { font-size: 10.5pt; font-weight: 600; color: #F5EFE1; border-bottom: 1px solid rgba(201, 162, 91, 0.25); padding: 10px 10px; text-align: center; }
    .cover-footer { font-size: 9.5pt; color: #F5EFE1; letter-spacing: 1px; }
    .cover-footer-url { font-size: 9.5pt; color: var(--gold-mid); margin-top: 6px; letter-spacing: 0.8px; }

    /* Top Brand Header Banner on Body Pages */
    .full-bleed-header { background: var(--primary); color: #F5EFE1; padding: 12px 18px; margin-bottom: 14px; border-bottom: 3px solid var(--gold-mid); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-logo { width: 42px; height: auto; display: block; }
    .header-brand-title { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 13pt; font-weight: 700; letter-spacing: 1.5px; color: #F5EFE1; margin: 0; }
    .header-brand-sub { font-size: 7pt; letter-spacing: 3.5px; color: var(--gold-mid); margin: 2px 0 0 0; }
    .header-right { text-align: right; }
    .header-doc-title { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 12.5pt; color: var(--gold-light); letter-spacing: 1px; margin: 0; }
    .header-doc-sub { font-size: 7.5pt; letter-spacing: 2px; color: #F5EFE1; text-transform: uppercase; margin: 2px 0 0 0; }

    /* Headings & Intro */
    h1 { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 17pt; line-height: 1.22; margin: 0 0 6px 0; color: var(--primary); }
    .intro-lead { font-size: 9.8pt; line-height: 1.55; color: var(--text); margin: 0 0 12px 0; }
    .section-label { font-size: 8.2pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); margin: 12px 0 8px 0; break-after: avoid; page-break-after: avoid; }

    /* Client & Traveler Overview Cards */
    .overview-grid { display: grid; grid-template-columns: 1.35fr 0.95fr 1.15fr; gap: 12px; margin-bottom: 12px; }
    .info-card { background: var(--card-bg); border: 1px solid var(--sand-border); border-radius: 10px; padding: 11px 14px; }
    .info-card-label { font-size: 7.2pt; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; }
    .info-card-value { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 11.8pt; font-weight: 700; color: var(--primary); margin-bottom: 2px; }
    .info-card-sub { font-size: 8.5pt; color: var(--muted); }

    /* Split Feature Cards (Matching Hajj 2027 Maktab Cards) */
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

    /* Private Transport 3-Step Cards */
    .transport-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
    .transport-card { background: var(--card-bg); border: 1px solid var(--sand-border); border-radius: 10px; padding: 14px 15px; display: flex; flex-direction: column; justify-content: space-between; }
    .transport-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .step-pill { background: var(--primary); color: var(--gold-light); font-size: 7.5pt; font-weight: 700; padding: 3px 9px; border-radius: 12px; letter-spacing: 1px; text-transform: uppercase; }
    .transport-date { font-size: 8pt; font-weight: 600; color: var(--accent); }
    .transport-route { font-size: 10pt; font-weight: 700; color: var(--primary); margin-bottom: 5px; line-height: 1.35; }
    .transport-sub { font-size: 8.6pt; color: var(--muted); line-height: 1.42; }

    /* Included in Package Card */
    .included-card { background: var(--card-bg); border: 1px solid var(--sand-border); border-radius: 12px; padding: 16px 20px; margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
    .included-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin-top: 10px; }
    .included-item { display: flex; align-items: flex-start; gap: 8px; font-size: 9.2pt; color: var(--text); line-height: 1.42; }
    .check-mark { color: var(--accent); font-weight: 700; font-size: 10.5pt; line-height: 1.2; }

    /* Final Total Package Banner Card */
    .total-price-banner { background: var(--primary); border: 2px solid var(--gold-mid); border-radius: 12px; padding: 18px 24px; color: #F5EFE1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
    .total-banner-label { font-size: 8.2pt; letter-spacing: 2px; text-transform: uppercase; color: var(--gold-mid); margin-bottom: 4px; }
    .total-banner-title { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 15pt; font-weight: 700; color: #FFFFFF; margin-bottom: 3px; }
    .total-banner-sub { font-size: 8.8pt; color: var(--gold-light); }
    .total-banner-amount { font-family: 'Caladea', 'Noto Serif', Georgia, serif; font-size: 24pt; font-weight: 700; color: var(--gold-light); text-align: right; white-space: nowrap; }

    /* Footer Contact Card (Matching Page 7 of Hajj 2027 PDF) */
    .contact-card { background: var(--primary); border: 2px solid var(--gold-mid); border-radius: 12px; padding: 18px 24px; color: #F5EFE1; display: flex; align-items: center; justify-content: space-between; break-inside: avoid; page-break-inside: avoid; }
    .contact-left { width: 34%; text-align: center; border-right: 1px solid rgba(201, 162, 91, 0.35); padding-right: 18px; }
    .contact-logo { width: 90px; height: auto; margin: 0 auto 6px auto; display: block; }
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
    <img class="img-page-bg" src="cover_bg.png" alt="">

    <div style="margin-top: 14mm;">
      <img class="cover-logo" src="logo.png" alt="Al Ramlah Travels Logo">
      <div class="cover-brand">AL RAMLAH</div>
      <div class="cover-subbrand">T R A V E L S</div>
      <div class="cover-tagline">Where Purpose Meets Excellence</div>
    </div>

    <div>
      <div class="cover-title">UMRAH 2026</div>
      <div class="cover-subtitle">Bespoke Family Quotation &amp; Travel Plan</div>

      <div class="cover-client-label">Prepared Exclusively For</div>
      <div class="cover-client-name">Mr. Barrister Adil Rafi Cheema &amp; Family</div>
      <div class="cover-client-meta">5 Travelers (2 Adults · 1 Child · 2 Infants)  |  19 Nov 2026 to 01 Dec 2026 (12 Nights)</div>

      <table class="cover-summary-table">
        <thead>
          <tr>
            <th>Airline</th>
            <th>Makkah (6 Nights)</th>
            <th>Madinah (6 Nights)</th>
            <th>Private Transport</th>
            <th>Total Package</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>PIA</td>
            <td>Hajar Tower Mövenpick</td>
            <td>Anwar Al Madinah Mövenpick</td>
            <td>Staria 7 Seater</td>
            <td>PKR 1,750,000</td>
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
        <img class="header-logo" src="logo.png" alt="Logo">
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

    <h1>Your 12 Night Family Umrah Journey</h1>
    <p class="intro-lead">Your 12 night Umrah journey combines return flights on Pakistan International Airlines (PIA), Umrah visas for all five family members, six nights in Makkah, six nights in Madinah, and private 7 seater ground transfers across every leg of the trip.</p>

    <div class="section-label">Client &amp; Traveler Summary</div>
    <div class="overview-grid">
      <div class="info-card">
        <div class="info-card-label">Client / Family Name</div>
        <div class="info-card-value">Mr. Barrister Adil Rafi Cheema</div>
        <div class="info-card-sub">Private Family Umrah Package</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Total Duration</div>
        <div class="info-card-value">12 Nights</div>
        <div class="info-card-sub">19 Nov 2026 to 01 Dec 2026</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Total Travelers &amp; Visas</div>
        <div class="info-card-value">5 Travelers (5 Visas)</div>
        <div class="info-card-sub">2 Adults · 1 Child · 2 Infants</div>
      </div>
    </div>

    <div class="section-label">Return Air Travel &amp; Flight Segments</div>
    <div class="feature-card">
      <div class="feature-left">
        <div class="badge-circle">01</div>
        <div class="feature-left-cat">AIRLINE</div>
        <div class="feature-left-big">PIA</div>
        <div class="feature-left-unit">5 TICKETS</div>
      </div>
      <div class="feature-body">
        <div class="feature-grid-2">
          <div>
            <div class="field-label">Outbound Flight · 19 Nov 2026</div>
            <div class="field-title">Lahore to Jeddah</div>
            <div class="field-desc">Departure from Allama Iqbal International Airport (Lahore) to King Abdulaziz International Airport (Jeddah).</div>
            <div class="meal-tag">2 Adults · 1 Child · 2 Infants</div>
          </div>
          <div class="col-divider">
            <div class="field-label">Return Flight · 01 Dec 2026</div>
            <div class="field-title">Madinah to Lahore</div>
            <div class="field-desc">Direct return flight from Prince Mohammad Bin Abdulaziz International Airport (Madinah) back to Lahore.</div>
            <div class="meal-tag">Umrah Visas Included for All 5 Travelers</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-label">Five Star Mövenpick Accommodation Plan (12 Nights Total)</div>

    <div class="feature-card">
      <div class="feature-left">
        <div class="badge-circle">01</div>
        <div class="feature-left-cat">MAKKAH</div>
        <div class="feature-left-big">6</div>
        <div class="feature-left-unit">NIGHTS</div>
      </div>
      <div class="feature-body">
        <div class="feature-grid-2">
          <div>
            <div class="field-label">Makkah Hotel Property</div>
            <div class="field-title">Hajar Tower Mövenpick</div>
            <div class="field-desc">Five star hospitality located directly on the Haram courtyard within the prestigious Abraj Al Bait complex.</div>
            <div class="meal-tag">Included Meal Plan: With Breakfast</div>
          </div>
          <div class="col-divider">
            <div class="field-label">Stay Schedule &amp; Room Allocation</div>
            <div class="field-title">19 Nov 2026 to 25 Nov 2026</div>
            <div class="field-desc"><strong>Check In:</strong> 19 November 2026<br><strong>Check Out:</strong> 25 November 2026</div>
            <div class="meal-tag">Allocation: 1 Room · 2 Beds · 6 Nights</div>
          </div>
        </div>
      </div>
    </div>

    <div class="feature-card" style="margin-bottom: 14px;">
      <div class="feature-left">
        <div class="badge-circle">02</div>
        <div class="feature-left-cat">MADINAH</div>
        <div class="feature-left-big">6</div>
        <div class="feature-left-unit">NIGHTS</div>
      </div>
      <div class="feature-body">
        <div class="feature-grid-2">
          <div>
            <div class="field-label">Madinah Hotel Property</div>
            <div class="field-title">Anwar Al Madinah Mövenpick</div>
            <div class="field-desc">Five star property steps away from Masjid Al Nabawi, offering convenient access for families.</div>
            <div class="meal-tag">Five Star Haramain Accommodation</div>
          </div>
          <div class="col-divider">
            <div class="field-label">Stay Schedule &amp; Room Allocation</div>
            <div class="field-title">25 Nov 2026 to 01 Dec 2026</div>
            <div class="field-desc"><strong>Check In:</strong> 25 November 2026<br><strong>Check Out:</strong> 01 December 2026</div>
            <div class="meal-tag">Allocation: 1 Room · 2 Beds · 6 Nights</div>
          </div>
        </div>
      </div>
    </div>

    <div style="break-inside: avoid; page-break-inside: avoid;">
    <div class="section-label">Private Ground Transportation · Hyundai Staria 7 Seater</div>
    <p class="intro-lead" style="margin-bottom: 12px;">Dedicated private family transfers in a spacious <strong>Hyundai Staria 7 Seater</strong> vehicle with full luggage capacity across all three travel legs.</p>

    <div class="transport-grid">
      <div class="transport-card">
        <div>
          <div class="transport-top">
            <span class="step-pill">Sector 01</span>
            <span class="transport-date">19 Nov 2026</span>
          </div>
          <div class="transport-route">Jeddah Airport to Makkah Hotel</div>
          <div class="transport-sub">Private arrival pickup at Jeddah Airport and direct transfer to Hajar Tower Mövenpick in Makkah.</div>
        </div>
        <div class="meal-tag" style="margin-top: 10px;">Hyundai Staria 7 Seater</div>
      </div>

      <div class="transport-card">
        <div>
          <div class="transport-top">
            <span class="step-pill">Sector 02</span>
            <span class="transport-date">25 Nov 2026</span>
          </div>
          <div class="transport-route">Makkah Hotel to Madinah Hotel</div>
          <div class="transport-sub">Comfortable private intercity journey from Hajar Tower Mövenpick to Anwar Al Madinah Mövenpick.</div>
        </div>
        <div class="meal-tag" style="margin-top: 10px;">Hyundai Staria 7 Seater</div>
      </div>

      <div class="transport-card">
        <div>
          <div class="transport-top">
            <span class="step-pill">Sector 03</span>
            <span class="transport-date">01 Dec 2026</span>
          </div>
          <div class="transport-route">Madinah Hotel to Madinah Airport</div>
          <div class="transport-sub">Timely departure transfer from Anwar Al Madinah Mövenpick to Madinah Airport for your flight to Lahore.</div>
        </div>
        <div class="meal-tag" style="margin-top: 10px;">Hyundai Staria 7 Seater</div>
      </div>
    </div>

    </div>

    <div class="included-card">
      <div class="field-label" style="margin-bottom: 2px;">Everything Included in Your Family Umrah Package</div>
      <div class="included-grid">
        <div class="included-item">
          <span class="check-mark">✓</span>
          <span><strong>PIA Return Air Tickets:</strong> Outbound Lahore to Jeddah (19 Nov) and return Madinah to Lahore (01 Dec) for 2 Adults, 1 Child and 2 Infants.</span>
        </div>
        <div class="included-item">
          <span class="check-mark">✓</span>
          <span><strong>Complete Umrah Visa Processing:</strong> Official Umrah visas arranged for all 5 family travelers.</span>
        </div>
        <div class="included-item">
          <span class="check-mark">✓</span>
          <span><strong>Makkah Accommodation (6 Nights):</strong> 1 Room at Hajar Tower Mövenpick (19 Nov to 25 Nov 2026) with breakfast included.</span>
        </div>
        <div class="included-item">
          <span class="check-mark">✓</span>
          <span><strong>Madinah Accommodation (6 Nights):</strong> 1 Room at Anwar Al Madinah Mövenpick (25 Nov to 01 Dec 2026).</span>
        </div>
        <div class="included-item">
          <span class="check-mark">✓</span>
          <span><strong>Private Staria 7 Seater Transfers:</strong> Exclusive door to door ground transport across Jeddah, Makkah and Madinah.</span>
        </div>
      </div>
    </div>

    <div class="total-price-banner">
      <div>
        <div class="total-banner-label">Complete Family Package Price</div>
        <div class="total-banner-title">Mr. Barrister Adil Rafi Cheema &amp; Family</div>
        <div class="total-banner-sub">All inclusive for 5 Travelers (2 Adults · 1 Child · 2 Infants) · 12 Nights · Flights, Visas, Hotels &amp; Private Staria</div>
      </div>
      <div class="total-banner-amount">PKR 1,750,000</div>
    </div>

    <div class="contact-card">
      <div class="contact-left">
        <img class="contact-logo" src="logo.png" alt="Al Ramlah Travels">
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
</html>
"""

# 4. Programmatic check: ensure zero hyphens joining words and zero SAR references in visible text
soup = BeautifulSoup(HTML_CONTENT, "html.parser")
for s in soup(["style", "script", "title"]):
    s.decompose()
visible_text = soup.get_text(" ")
hyphen_matches = re.findall(r"\b\w+-\w+\b", visible_text)
if hyphen_matches:
    raise ValueError(f"Found hyphenated words in visible text: {hyphen_matches}")
if "SAR" in visible_text:
    raise ValueError("Found SAR in visible text!")

html_file = "artifacts/file_generation/ttl=63d/intermediate/document.html"
with open(html_file, "w", encoding="utf-8") as f:
    f.write(HTML_CONTENT)

# 5. Inline local images (logo.png and cover_bg.png) as data URIs and compile to PDF via headless Chromium
def inline_images(html_str):
    for fname in ("cover_bg.png", "logo.png"):
        fpath = os.path.join("artifacts/file_generation/ttl=63d/intermediate", fname)
        if os.path.isfile(fpath):
            with open(fpath, "rb") as bf:
                b64 = base64.b64encode(bf.read()).decode("ascii")
            html_str = html_str.replace(f'src="{fname}"', f'src="data:image/png;base64,{b64}"')
    return html_str

html_inlined = inline_images(HTML_CONTENT)
out_pdf = "artifacts/file_generation/ttl=63d/output/Al_Ramlah_Travels_Umrah_Quotation.pdf"
user_data_dir = tempfile.mkdtemp(prefix="chromium_pdf_")
try:
    opts = chrome_options.Options()
    for arg in ("--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", f"--user-data-dir={user_data_dir}"):
        opts.add_argument(arg)
    driver = webdriver.Chrome(options=opts)
    driver.get("about:blank")
    frame_id = driver.execute_cdp_cmd("Page.getFrameTree", {})["frameTree"]["frame"]["id"]
    driver.execute_cdp_cmd("Page.setDocumentContent", {"frameId": frame_id, "html": html_inlined})
    time.sleep(2)
    res = driver.execute_cdp_cmd("Page.printToPDF", {
        "landscape": False, "displayHeaderFooter": False, "printBackground": True,
        "preferCSSPageSize": True, "marginTop": 0, "marginBottom": 0, "marginLeft": 0, "marginRight": 0
    })
    with open(out_pdf, "wb") as f:
        f.write(base64.b64decode(res["data"]))
    driver.quit()
finally:
    shutil.rmtree(user_data_dir, ignore_errors=True)
print("Saved final PDF:", out_pdf)
```

## Rules When Customizing Content

- **Never alter CSS or HTML tags**: Keep every `<style>` rule, class name, and card layout identical to the script above. Only replace the client name, traveler counts, dates, airline/flight segments, hotel names/descriptions/check-in/out/allocation text, transport vehicle/sector text, and final PKR price string.
- **No price breakdowns or SAR references**: Show only the single final package price on the cover and in the Page 3 `.total-price-banner`.
- **No hyphens joining words**: Never write `Five-Star`, `12-night`, `7-seater`, `Check-In`, `Check-Out`, or `door-to-door`; always use spaces (`Five Star`, `12 night`, `7 Seater`, `Check In`, `Check Out`, `door to door`).
