---
version: "1.0"
name: "Al Ramlah Travels — Sacred Haramain Luxury"
description: "A single-theme, light-locked Haramain pilgrimage design system anchored to public/logo.jpg — uniting Deep Haramain Emerald (#0A3622), Warm Ivory parchment (#FAF7F0), decorative Metallic Gold (#C5A059) and WCAG AA Burnished Gold text (#7A5C1E) with Playfair Display, Plus Jakarta Sans, tabular JetBrains Mono, and isolated RTL Amiri Arabic calligraphy across public pilgrim journeys, 4-hub admin workbenches, Gotenberg PDFs, and 4K social posters."

colors:
  primary: "#0A3622"
  primary-hover: "#0F4C31"
  on-primary: "#FFFFFF"
  gold: "#C5A059"
  gold-text: "#7A5C1E"
  gold-foreground: "#0A3622"
  gold-border: "#CBAD6D"
  accent: "#F1E3C7"
  accent-foreground: "#0A3622"
  background: "#FAF7F0"
  card: "#FFFFFF"
  secondary: "#F5EFE6"
  foreground: "#1A1D1A"
  muted-foreground: "#445146"
  border: "#E6DEC8"
  input-border: "#8D8575"
  destructive: "#B3000D"
  destructive-foreground: "#FAFAFA"
  sidebar: "#072417"
  sidebar-foreground: "#F5EFE6"
  sidebar-primary: "#C79E41"
  sidebar-accent: "#0A2B1B"
  sidebar-border: "#092012"
  status-pending: "#92400E"
  status-pending-bg: "#FEF3C7"
  status-pending-dot: "#F59E0B"
  status-quoted: "#0369A1"
  status-quoted-bg: "#E0F2FE"
  status-quoted-dot: "#0EA5E9"
  status-approved: "#065F46"
  status-approved-bg: "#D1FAE5"
  status-approved-dot: "#059669"
  status-rejected: "#991B1B"
  status-rejected-bg: "#FEE2E2"
  status-rejected-dot: "#DC2626"
  status-cancelled: "#334155"
  status-cancelled-bg: "#F1F5F9"
  status-cancelled-dot: "#64748B"
  chart-emerald: "#0A3622"
  chart-gold: "#C79E41"
  chart-sky: "#0088C6"
  chart-amber: "#D08600"
  chart-slate: "#445146"

typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  subhead:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0em"
  body-lg:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  body-sm:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  button:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0em"
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.02em"
  caption:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0em"
  mono-metric:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  mono-data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0em"
  arabic-sacred:
    fontFamily: "Amiri, Noto Naskh Arabic, Noto Nastaliq Urdu, serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.7
    letterSpacing: "0em"

rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  4xl: "26px"
  full: "9999px"

spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"

components:
  utility-strip:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption}"
    padding: "6px 16px"
  public-header:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    height: "72px"
  admin-sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.sidebar-foreground}"
    typography: "{typography.body-sm}"
    padding: "{spacing.sm}"
  admin-topbar:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    height: "56px"
    padding: "0 24px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  card-surface:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
  card-summary-sticky:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  input-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
  status-badge-pending:
    backgroundColor: "{colors.status-pending-bg}"
    textColor: "{colors.status-pending}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-badge-quoted:
    backgroundColor: "{colors.status-quoted-bg}"
    textColor: "{colors.status-quoted}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-badge-approved:
    backgroundColor: "{colors.status-approved-bg}"
    textColor: "{colors.status-approved}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-badge-rejected:
    backgroundColor: "{colors.status-rejected-bg}"
    textColor: "{colors.status-rejected}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-badge-cancelled:
    backgroundColor: "{colors.status-cancelled-bg}"
    textColor: "{colors.status-cancelled}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  wizard-stepper-pill-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  whatsapp-fab:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    size: "56px"
  public-footer:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    padding: "64px 32px"
---

# Design System: Al Ramlah Travels — Sacred Haramain Luxury

## Overview

**Creative North Star: "The Haramain Sanctuary"**

Al Ramlah Travels (`سفريات الرملة`) embodies **Sacred Haramain Luxury**: a calm architectural balance between the reverence of the Two Holy Mosques, warm alabaster courtyard light, and disciplined Pakistani hospitality. Rather than cold SaaS greys or flashy travel-portal clutter, every surface is anchored directly to the brand emblem (`public/logo.jpg`) — the Holy Kaaba draped in deep Kiswah, a golden minaret evoking Masjid an-Nabawi, a cradling crescent, and sculpted Arabic calligraphy (`الرملة`).

The platform enforces a **single locked light theme** across all public storefront routes, interactive journey builders, admin operational hubs, Gotenberg quotation PDFs, and 4K social posters. Warm Ivory (`{colors.background}`) serves as the architectural paper floor; Crisp Alabaster (`{colors.card}`) elevates interactive builder tiles, quoting worksheets, and itinerary tables; and Deep Haramain Emerald (`{colors.primary}`) anchors authority headers, primary actions, and dark-emerald sanctuary bands. Metallic Gold (`{colors.gold}`) provides restrained ornamental highlights, while Burnished Gold (`{colors.gold-text}`) guarantees WCAG 2.2 AA readability wherever gold carries text on light parchment.

**Key Characteristics:**
- **Single Light Theme Lock**: Enforced at CSS and layout root via `@custom-variant dark (&:where(.never-dark *));`, `color-scheme: light`, `forcedTheme="light"`, and `<html class="light">`.
- **Dual-Gold Contrast Split**: Ornamental gold (`{colors.gold}`) lives strictly on borders, stars, icons, and dark-emerald backdrops; text on ivory or white surfaces exclusively uses `{colors.gold-text}` (`>= 5.8:1`).
- **Four-Font Precision Voice**: `Playfair Display` for editorial headlines, `Plus Jakarta Sans` for UI clarity, `JetBrains Mono` (`tabular-nums`) for every PKR/SAR tariff and reference code, and `Amiri` for isolated RTL sacred Arabic script.
- **Two Tuned Surface Densities**: Generous `Persuade` / `Read` pacing on the public storefront and SEO spokes; crisp, high-density `Operate` workbenches across the 4-hub admin portal (`/admin/{studio,campaigns,desk,catalog,settings}`).

### Core Architectural Doctrines

**The Single Light Sanctuary Rule.** Dark mode switching and `dark:` utility overrides are strictly prohibited across the entire application. OS-level `prefers-color-scheme: dark` never inverts Warm Ivory or Deep Haramain Emerald surfaces.

**The Accessible Gold Rule.** Decorative Metallic Gold (`#C5A059` / `oklch(0.79 0.11 85)`) achieves `5.47:1` on Deep Haramain Emerald (`#0A3622`), making it safe for text on emerald headers and dark posters, but only `2.30:1` on Warm Ivory (`#FAF7F0`). On light ivory or white surfaces, text and small icons MUST use Burnished Gold Text (`--gold-text` `#7A5C1E` / `oklch(0.46 0.11 80)` — `5.81:1` on Warm Ivory, `6.22:1` on White).

**The Sacred Script Isolation Rule.** All Arabic religious invocations, Quranic phrases, Talbiyah, and Ziyarat Arabic titles MUST wrap in `<ArabicText>` (`lang="ar"`, `dir="rtl"`, `unicode-bidi: isolate`) so bidirectional layout and assistive screen readers render sacred text accurately.

**The Honest Tariff Rule.** Visual pricing badges display fixed PKR totals solely for deterministic offerings (`Visa Only` and positive-priced fixed-departure group packages). Volatile multi-pillar configurations render `"Live Rate — Confirmed upon submission"`, and `0`-priced Mode B tiers render `"On Request"`. Internal wholesale SAR columns never serialize to public surfaces.

---

## Colors

The palette derives straight from `web/app/globals.css` OKLCH definitions and `web/lib/constants/brand.ts`, calibrated for WCAG 2.2 AA text and UI component contrast (`>= 4.5:1` normal text, `>= 3.0:1` UI boundaries).

### Brand & Accent
- **Deep Haramain Emerald** (`{colors.primary}` — `#0A3622` / `--primary: oklch(0.26 0.08 155)`): Authoritative brand primary evoking the Green Dome of Madinah. Used for primary CTAs, top utility strips, footer bands, active stepper states, and quote summary highlights (`12.55:1` on Warm Ivory, `13.43:1` on White).
- **Sanctuary Emerald Hover** (`{colors.primary-hover}` — `#0F4C31`): Interactive hover fill on primary buttons and elevated planner controls.
- **Metallic Haramain Gold (Decorative)** (`{colors.gold}` — `#C5A059` / `--gold: oklch(0.79 0.11 85)`): Warm ornamental gold harmonized with Kiswah embroidery. Reserved strictly for hairlines, borders, star ratings, vector icons, and text/badges seated on Deep Haramain Emerald (`5.47:1` on `#0A3622`).
- **Burnished Gold Text (AA Text-Safe)** (`{colors.gold-text}` — `#7A5C1E` / `--gold-text: oklch(0.46 0.11 80)`): Calibrated dark burnished gold required for eyebrow pills, labels, Arabic brand subtitle in headers, and highlighted microcopy over Warm Ivory (`5.81:1`) or White (`6.22:1`; exact OKLCH conversion `>= 6.7:1`).
- **Gold Border & Foreground** (`{colors.gold-border}` — `#CBAD6D` / `--gold-border: oklch(0.76 0.09 85)` and `{colors.gold-foreground}` — `#0A3622` / `--gold-foreground: oklch(0.20 0.06 155)`): Hairline gold framing and high-contrast foreground text on gold pills.
- **Champagne Accent Wash** (`{colors.accent}` — `#F1E3C7` / `--accent: oklch(0.92 0.04 85)`): Soft warm highlight fill paired with `{colors.accent-foreground}` (`#0A3622`).

### Surface
- **Warm Ivory Canvas** (`{colors.background}` — `#FAF7F0` / `--background: oklch(0.975 0.012 85)`): Signature resting page floor reminiscent of courtyard marble and parchment across both public and admin workspaces.
- **Alabaster Card** (`{colors.card}` — `#FFFFFF` / `--card: oklch(1 0 0)`): Elevated surface for interactive wizard steps, group package cards, admin Kanban cards, tables, modals, and popovers.
- **Alabaster Parchment** (`{colors.secondary}` — `#F5EFE6` / `--secondary`, `--muted: oklch(0.95 0.018 80)`): Recessed surface for secondary buttons, summary callout boxes, inactive tab rails, and table headers.
- **Sand Gold Hairline & Input Stroke** (`{colors.border}` — `#E6DEC8` / `--border: oklch(0.84 0.022 85)` and `{colors.input-border}` — `#8D8575` / `--input: oklch(0.62 0.025 85)`): Delicate divider hairlines (`--border`) alongside `>= 3.42:1` calibrated control outlines (`--input`) satisfying WCAG 1.4.11 non-text contrast.
- **Deep Emerald Night (Admin Sidebar)** (`{colors.sidebar}` — `#072417` / `--sidebar: oklch(0.16 0.05 155)`): Deep nocturnal emerald rail anchoring the admin workspace (`--sidebar-foreground: oklch(0.95 0.01 85)`, `--sidebar-primary: oklch(0.72 0.12 85)`, `--sidebar-accent: oklch(0.22 0.06 155)`, `--sidebar-border: oklch(0.22 0.04 155)`).

### Text
- **Deep Slate Charcoal** (`{colors.foreground}` — `#1A1D1A` / `--foreground: oklch(0.18 0.015 155)`): Primary heading and body ink (`15.90:1` on Warm Ivory, exceeding WCAG AAA).
- **Warm Slate Taupe** (`{colors.muted-foreground}` — `#445146` / `--muted-foreground: oklch(0.42 0.025 150)`): Calibrated secondary metadata ink (`7.82:1` on Warm Ivory, `8.36:1` on White, and `>= 4.5:1` even at 80% opacity).
- **On-Emerald White** (`{colors.on-primary}` — `#FFFFFF` / `--primary-foreground: oklch(1 0 0)`): Crisp white ink over Deep Haramain Emerald (`12.55:1`).
- **Crimson Alert** (`{colors.destructive}` — `#B3000D` / `--destructive: oklch(0.48 0.20 27)`): Form validation errors, destructive confirmations, and overdue escalation (`6.72:1` on Warm Ivory).

### Pipeline & Semantic

The quoting and booking desk standardizes on five distinct semantic pipeline stages implemented in `components/layout/status-badge.tsx`:

| Stage | Key | Badge Text (`Hex`) | Badge Fill (`Hex`) | Indicator Dot | Min Contrast | Meaning |
|---|---|---|---|---|---|---|
| **Pending Quote** | `pending_quote` | `#92400E` | `#FEF3C7` | `#F59E0B` | `6.37:1` | Request logged; awaiting desk rates |
| **Quoted** | `quoted` | `#0369A1` | `#E0F2FE` | `#0EA5E9` | `5.17:1` | Itemized PKR quote dispatched |
| **Approved** | `approved` | `#065F46` | `#D1FAE5` | `#059669` | `6.78:1` | Confirmed; group seats atomically locked |
| **Rejected** | `rejected` | `#991B1B` | `#FEE2E2` | `#DC2626` | `6.80:1` | Declined (inventory or eligibility) |
| **Cancelled** | `cancelled` | `#334155` | `#F1F5F9` | `#64748B` | `9.45:1` | Withdrawn by pilgrim or expired |

- **SLA Overdue Escalation Badge**: Applications in `pending_quote` exceeding `slaOverdueHours` (default `2` hours in `status-badge.tsx`, configurable up to `24` hours in agency settings) trigger a crimson-tinted pill (`#FEE2E2` fill, `#991B1B` text, `#DC2626` dot with `motion-reduce:animate-none` pulse) reading `SLA Overdue (Nh+)`.
- **Recharts Data Visualization Tokens**: `--chart-1` Emerald (`oklch(0.26 0.08 155)`), `--chart-2` Gold (`oklch(0.72 0.12 85)`), `--chart-3` Sky Royal (`oklch(0.58 0.16 230)`), `--chart-4` Amber (`oklch(0.68 0.16 75)`), `--chart-5` Warm Slate (`oklch(0.42 0.025 150)`).

### Gradients & Geometric Patterns
- **Haramain Lattice Watermarks**: `.bg-haramain-pattern` (24×24px dual radial dot lattice at 8%–12% opacity for light ivory bands) and `.bg-haramain-dark-pattern` (28×28px gold dot lattice at 14% opacity over Deep Haramain Emerald footers and dark hero stages).
- **Metallic Gold Gradient Accents**: `.text-gold-gradient` (`135deg`, `#d4af37` -> `#f5e6c8` -> `#aa771c`), `.bg-gold-gradient` (`135deg`, `#c5a059` -> `#ecd9b0` -> `#8f6e2a`), and `.border-gold-gradient` reserved sparingly for luxury print/poster headers and hero accents where contrast permits.

**The Semantic Status Discipline Rule.** Never invent raw Tailwind utility colors (`bg-blue-600`, `text-gray-500`, `bg-green-500`) for application pipeline badges or legacy planner hints. Always route through `<StatusBadge>` or semantic CSS variables (`--primary`, `--gold-text`, `--muted-foreground`, `--destructive`).

---

## Typography

### Font Families

Four purposefully paired Google Fonts load via `next/font/google` in `web/app/layout.tsx` (`display: "swap"`, exposing CSS variables `--font-display`, `--font-sans`, `--font-mono`, and `--font-arabic`):

1. **Playfair Display** (`--font-display`, weights `500`, `600`, `700`): High-contrast transitional editorial serif reserved for hero statements, page `<h1>`/`<h2>` anchors, quotation PDF titles, and sanctuary landmarks.
2. **Plus Jakarta Sans** (`--font-sans`, weights `400`, `500`, `600`, `700`): Clean geometric humanist sans carrying body prose, navigation, buttons, form controls, tables, and admin workbenches.
3. **JetBrains Mono** (`--font-mono`, weights `400`, `500`, `600`, `preload: false`): Precision monospace with mandatory `tabular-nums` (`font-variant-numeric: tabular-nums`) preventing horizontal layout jitter on prices, IDs, distances, and timers.
4. **Amiri** (`--font-arabic`, weights `400`, `700`, `subsets: ["arabic"]`, `preload: false`): Classical Naskh calligraphic typeface backed in CSS by `"Noto Naskh Arabic", "Noto Nastaliq Urdu", serif` for reverent Arabic and Urdu rendering across web and Gotenberg PDFs.

### Hierarchy

| Token | Family | Size | Weight | Line Height | Tracking & Use |
|---|---|---|---|---|---|
| `{typography.display}` | Playfair Display | `3rem` (`48px`) | `700` | `1.1` | `-0.025em` · Homepage & hub `<h1>` hero headlines |
| `{typography.headline}` | Playfair Display | `2.25rem` (`36px`) | `700` | `1.15` | `-0.02em` · Section `<h2>` headings across storefront & guides |
| `{typography.title}` | Playfair Display | `1.375rem` (`22px`) | `600` | `1.25` | `-0.01em` · Package card titles, modal headers, voucher headings |
| `{typography.subhead}` | Plus Jakarta Sans | `1.125rem` (`18px`) | `600` | `1.35` | `0em` · Builder step titles, admin card headers, FAQ questions |
| `{typography.body-lg}` | Plus Jakarta Sans | `1rem` (`16px`) | `400` | `1.6` | `0em` · Answer-first SEO lead paragraphs (`< 60` words) |
| `{typography.body}` | Plus Jakarta Sans | `0.9375rem` (`15px`) | `400` | `1.6` | `0em` · Default reading copy (`65ch–75ch` max line measure) |
| `{typography.body-sm}` | Plus Jakarta Sans | `0.875rem` (`14px`) | `400` | `1.5` | `0em` · Dense admin tables, form inputs, summary breakdowns |
| `{typography.button}` | Plus Jakarta Sans | `0.875rem` (`14px`) | `600` | `1.2` | `0em` · Primary, secondary, and outline action labels |
| `{typography.label}` | Plus Jakarta Sans | `0.75rem` (`12px`) | `600` | `1.3` | `0.02em` · Form labels, status badges, nav items, micro-tags |
| `{typography.caption}` | Plus Jakarta Sans | `0.75rem` (`12px`) | `400` | `1.4` | `0em` · Field descriptions, timestamps, SLA warnings, legal footnotes |
| `{typography.mono-metric}` | JetBrains Mono | `1.5rem` (`24px`) | `700` | `1.15` | `-0.02em` · PKR fixed visa totals, group price tiers, KPI readouts |
| `{typography.mono-data}` | JetBrains Mono | `0.8125rem` (`13px`) | `500` | `1.4` | `0em` · `ART-...` codes, E.164 phones, hotel meters, AST/PKT times |
| `{typography.arabic-sacred}` | Amiri | `1.25rem` (`20px`) | `700` | `1.7` | `0em` · Bismillah, Talbiyah, `سفريات الرملة`, Ziyarat Arabic titles |

### Tabular Numerals & Financial Precision
- **Mandatory `font-mono tabular-nums`**: Every PKR/SAR currency figure, application reference (`ART-YYYY-XXXX`), passport/bed/seat counter, Haram proximity distance (`50 m`, `350 m`), flight departure timestamp, phone hotline (`+92 327 4029701`), and SLA countdown timer MUST carry `font-mono tabular-nums`.
- **Right-Aligned Ledger Columns**: Admin quoting worksheets and payment tables right-align numeric amounts (`text-right font-mono tabular-nums`) so unit columns stack cleanly during live markup arithmetic.

### Sacred Arabic & Urdu RTL Isolation
- Every Arabic invocation or bilingual title MUST render inside `<ArabicText>` (`lang="ar"`, `dir="rtl"`, `unicode-bidi: isolate`, `.font-arabic`) — never bare raw Arabic strings inside LTR spans.
- Gotenberg quotation PDFs declare `.bidi-auto { unicode-bidi: plaintext; }` and `.arabic-brand` with explicit `'Noto Naskh Arabic', 'Noto Nastaliq Urdu'` fallbacks so mixed English/Arabic/Urdu pilgrim names or hotel lines never invert punctuation.

---

## Layout

### Spacing System
- **4px / 8px Spatial Rhythm**: `{spacing.xxs}` `4px` · `{spacing.xs}` `8px` · `{spacing.sm}` `12px` · `{spacing.md}` `16px` · `{spacing.lg}` `24px` · `{spacing.xl}` `32px` · `{spacing.2xl}` `48px` · `{spacing.3xl}` `64px`.
- **Card & Form Gaps**: Builder option cards and modal surfaces breathe at `16px`–`24px` internal padding (`p-4` to `p-6`); `<FieldGroup>` controls stack with `gap-4` or `gap-5`; major public marketing sections separate cleanly at `48px`–`80px` vertical rhythm (`py-10 sm:py-16`).

### Grid & Container
- **Capped Centered Measure**: Public sections center inside `max-w-7xl` (`1280px`) or `max-w-6xl` (`1152px`) with `px-4 sm:px-6 lg:px-8`; legal and reading articles constrain prose to comfortable `65ch–75ch` measures. At `1920px`, outer gutters expand while grids and line lengths stay capped.
- **Custom Journey Builder Split**: Uses a 12-column desktop grid (`lg:grid-cols-12 gap-6 sm:gap-8`): left 8 columns (`lg:col-span-8`) render the active wizard step (`WizardStepperHeader` + step modules + `WizardBottomNav`), while right 4 columns (`lg:col-span-4`) pin `<LiveSummaryCard>` at `sticky top-20`.
- **Fluid Grid Safeguards**: Image-bearing grids avoid overflow via `min-w-0` and `minmax(0, 1fr)`; pages prevent horizontal scrollbars (`scrollWidth <= innerWidth`) across every viewport from `320px` upward.

### Surface Modes: Public Storefront vs. 4-Hub Admin IA

#### 1. Public Storefront Shell (`web/app/(public)/layout.tsx` — `Persuade` / `Read`)
- **Top Emerald Utility Strip**: `#0A3622` bar displaying primary and secondary hotlines (`+92 327 4029701 · +92 319 0462638`), 24/7 WhatsApp concierge link, verified Lahore Cantt HQ address (`Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan`), a fixed-width `296px` zero-CLS offline Umm al-Qura Haramain prayer pill (`AST / UTC+3`), and a direct `Track Application` anchor (`/#track-status`).
- **Sticky Frosted Header**: `h-18` (`72px`) Warm Ivory glass (`bg-background/90 backdrop-blur-md border-b border-border/80`) pairing `public/logo.jpg` (`40×40px` crisp rounded emblem) and bilingual brand title (`Al Ramlah Travels` + `<ArabicText>سفريات الرملة</ArabicText>`) with primary links (`Umrah Packages`, `Umrah Visa`, `Hajj 2027`, `Makkah Hotels`, `Ziyarat`, `FAQ`, `Contact`), a `"Plan Your Journey"` CTA button, and a mobile slide-out `<Sheet>` below `xl`.
- **4-Column Emerald Footer**: Deep Haramain Emerald backdrop with `.bg-haramain-dark-pattern` lattice watermark, verified Askari 10 NAP & contact block, Umrah/Hajj and Hotel/Ziyarat hub columns, Agency Trust & Talbiyah column, dynamic DB-gated accreditation strip (rendering `DTS`, `MoRA / HGO`, `IATA`, `NTN` pills **only** when configured by `super_admin`, alongside `TLS Encrypted Pilgrim Dossiers`), and canonical legal links (`/privacy`, `/terms`, `/refund-policy`).
- **Floating WhatsApp Concierge FAB**: Fixed `bottom-6 right-6 z-50` `56×56px` circular action badge with gold border ring, hover concierge tooltip on desktop, online status ping (`motion-reduce` safe), and UTM-attributed `wa.me` payload.

#### 2. 4-Hub Admin Portal Shell (`web/app/admin/(dashboard)/layout.tsx` — High-Density `Operate`)
- **Deep Emerald Night Collapsible Sidebar (`admin-sidebar.tsx`)**: Anchored on `--sidebar` (`#072417`), consolidated into three operational groups across six primary destinations:
  1. **Command Overview**: **Executive Dashboard** (`/admin`) — pipeline KPIs, overdue counts, and operational metrics.
  2. **Daily Operational Hubs**:
     - **Package & Poster Studio** (`/admin/studio` — tabs `studio`, `vault`, `packages`): Multimodal BYO-poster & supplier flyer AI ingestion, commission rules, 4K/portrait poster rendering, and direct group package publishing.
     - **Campaigns & Outreach** (`/admin/campaigns` — tabs `social`, `whatsapp`, `outreach`): Core 5 social calendar & composer, ban-safe manual assisted WhatsApp Group/Status copy-pack queue & Cloud broadcasts, and 14-day VIP outreach CRM.
     - **Pilgrim Inbox & Quote Desk** (`/admin/desk` — tabs `pipeline` Kanban/table + `/admin/applications/[id]` quoting worksheet & payment ledger, `inbox` live Meta WhatsApp Cloud threads + auto-replies/templates + AI copilot, `web_messages` website inquiries) with live combined pending/unread count badge.
  3. **Inventory & Administration**:
     - **Catalog & Suppliers** (`/admin/catalog` — tabs `hotels`, `visa`, `transport`, `ziyarat`, `flights`, `hajj`, `suppliers`, `cms`, `messages`): Full rate matrices and CMS content.
     - **Connections & Settings** (`/admin/settings` — tabs `connections`, `whatsapp`, `infrastructure`, `agency`, `staff`, `health`): Social OAuth, Meta WABA setup, Gotenberg/R2 health, Askari 10 NAP & corporate IBAN verification gate, `super_admin` staff RBAC, and deep health checks.
  - Legacy direct routes (`/admin/applications`, `/admin/groups`, `/admin/hotels`, `/admin/messages`, etc.) resolve as clean server-side `redirect()` stubs into their unified hub tabs.
- **Executive Topbar (`admin-topbar.tsx`)**: Sticky `56px` Alabaster header (`bg-card border-b border-border`) housing sidebar toggle, route breadcrumb, `Search Post Ref / Price (⌘K)` trigger for the lazy-loaded `<CommandPalette>`, live SLA status pill (`All Quotes Within SLA` vs. pulsing `N Overdue Quote(s)`), notifications popover, and role-badged staff account menu.

---

## Elevation & Depth

Al Ramlah avoids harsh pure-black drop shadows. Depth comes primarily from **tonal separation** (`#FAF7F0` Warm Ivory floor -> `#FFFFFF` Alabaster Card -> `#0A3622` Deep Haramain Emerald hero/summary bands), crisp `1px` Sand Gold borders (`#E6DEC8` / `ring-1 ring-foreground/10`), and **emerald-tinted ambient shadows**:

| Level | Treatment | Use |
|---|---|---|
| **0 — Canvas Flat** | No shadow; separated by Warm Ivory vs. Alabaster fill or `1px` `{colors.border}` | Default page bands, reading guides, legal documents |
| **1 — Card Rest** | `0 1px 3px 0 rgba(10, 54, 34, 0.04), 0 1px 2px -1px rgba(10, 54, 34, 0.04)` (`shadow-xs` / `shadow-2xs`) | Hotel cards, transport segment cards, KPI tiles, Kanban cards |
| **2 — Interactive Lift** | `0 10px 25px -5px rgba(10, 54, 34, 0.08), 0 8px 10px -6px rgba(10, 54, 34, 0.04)` | Hovered package cards, sticky `LiveSummaryCard` (`shadow-lg shadow-[#0A3622]/5`) |
| **3 — Overlay & Sheet** | `0 20px 30px -10px rgba(10, 54, 34, 0.12)` + subtle backdrop scrim (`bg-black/10 backdrop-blur-xs`) | Dialogs, lead capture modals, mobile navigation drawer, WhatsApp FAB |

**The Soft Ambient Depth Rule.** Never stack heavy grey drop shadows or nest shadowed cards inside shadowed cards. Inner grouping inside a card uses tonal `#FAF7F0` background fills with `1px` `#E6DEC8` hairlines.

---

## Shapes

### Border Radius Scale
Driven by `--radius: 0.625rem` (`10px`) in `web/app/globals.css`:

| Token | CSS Formula | Pixel Value | Use |
|---|---|---|---|
| `{rounded.sm}` | `calc(var(--radius) * 0.6)` | `6px` | Micro tags, keyboard `<kbd>` badges, compact transit date chips |
| `{rounded.md}` | `calc(var(--radius) * 0.8)` | `8px` | Form inputs, selects, buttons, tabs, dropdown menu items |
| `{rounded.lg}` | `var(--radius)` | `10px` | Standard shadcn controls, dialog close rings, logo frames |
| `{rounded.xl}` | `calc(var(--radius) * 1.4)` | `14px` | Standard `Card`, planner segment/hotel cards, summary panels |
| `{rounded.2xl}` | `calc(var(--radius) * 1.8)` | `18px` | `LiveSummaryCard`, `WizardStepperHeader`, modal hero callouts |
| `{rounded.3xl}` | `calc(var(--radius) * 2.2)` | `22px` | SEO hub page mastheads, printable QR voucher frame, bento containers |
| `{rounded.4xl}` | `calc(var(--radius) * 2.6)` | `26px` | Pill-rounded `<Badge>` primitives |
| `{rounded.full}` | `9999px` | Pill / Circle | Step pills, status badges, prayer pill, circular WhatsApp FAB |

### Sacred Geometry & Print Framing
- Architectural watermarks apply 24px/28px dot-lattice patterns at subtle opacity across deep emerald bands without competing with typography.
- **3-Page A4 Luxury Quotation PDF (`render-quotation-pdf.ts`)**: `210mm × 297mm` Warm Ivory pages framed by a `1.5px` semi-transparent gold border (`inset: 8mm`) and a Deep Haramain Emerald gradient header (`3px solid #C5A059` bottom rule).
- **4K & Social Poster Studio (`render-single-package-poster.ts` / `render-multi-package-poster.ts` / `r2.ts`)**: Gotenberg renders vector-sharp `4K` (`3240×4560` portrait PDF/PNG) and `1080×1520` portrait spotlight HTML canvases; `sharp` normalizes uploaded/rendered posters to progressive MozJPEG `1080×1520` portrait (or `1080px`-height landscape) for social distribution.

---

## Components

Every UI primitive in `web/components/ui/` runs on **shadcn/ui `base-nova` over `@base-ui/react`** (`components.json`: `"style": "base-nova"`, `"iconLibrary": "lucide"`, `"rtl": false`).

### Base UI Composition Rules
- **Strict `render` Prop (NO Radix `asChild`)**: Triggers (`DialogTrigger`, `SheetTrigger`, `DropdownMenuTrigger`, `Button`) compose children via Base UI's `render` prop, passing `nativeButton={false}` whenever wrapping a `<Link>` or non-button element (`Button` infers `nativeButton={false}` automatically when `render` is supplied, and explicit `nativeButton={false}` keeps intent unambiguous).
- **Declarative Button Icons**: Icons inside `<Button>` carry `data-icon="inline-start"` or `data-icon="inline-end"` instead of manual margin classes (`mr-2` / `w-4 h-4`).
- **Semantic Card & Field Anatomy**: Cards compose `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardDescription>`, `<CardAction>`, `<CardContent>`, `<CardFooter>`; forms compose `<FieldGroup>`, `<Field>`, `<FieldLabel>`, `<FieldDescription>`, and `<FieldError>` rather than bare `div`s with `space-y-*`.

### Buttons
- **Primary (`default`)**: `#0A3622` fill, `#FFFFFF` text, `8px`–`10px` radius (`rounded-lg` in `button.tsx` / `rounded-xl` on major planner CTAs), subtle gold border on hero/header CTAs, hover `bg-primary/80` or `#0F4C31`, `:focus-visible` `3px` ring (`ring-ring/50`).
- **Secondary**: `#F5EFE6` parchment fill with `#0A3622` text, subtle hover mix (`color-mix(in oklch, var(--secondary), var(--foreground) 5%)`).
- **Outline / Ghost / Destructive**: Transparent or ivory fill with `border-border` outline; subtle `bg-muted` hover on ghost; soft crimson tint (`bg-destructive/10 text-destructive`) on destructive actions.

### Cards & Interactive Builder Tiles
- **Default Card (`Card`)**: Pure `#FFFFFF` Alabaster background, `14px` radius (`rounded-xl`), `1px` `ring-foreground/10` or `#E6DEC8` border, `16px` `--card-spacing`.
- **Interactive Planner Option Card**: Rests on `#FFFFFF` with `#E6DEC8` hairline; hovers to `#C5A059` border; active/selected switches to `2px` Deep Haramain Emerald border, light emerald tint, and emerald check indicator.
- **Sticky Live Itinerary Summary Card (`live-summary-card.tsx`)**: `rounded-2xl` Alabaster card framed with `#C5A059/50` border, `#FAF7F0` parameter recap pill box, itemized service rows, and dual-mode pricing panel (`PKR` tabular total for `Visa Only` vs. Deep Haramain Emerald `"Live Rate — Confirmed upon submission"` pill for volatile services).
- **Transport Segment Card (`segment-card.tsx`)**: Displays `Leg N` emerald badge, Private/Shared/Private-Only mode toggle, transit date & distance pills, Haramain High-Speed Rail station connection callout, and conditional historical **Via Badr Detour** upgrade banner.

### Inputs & Forms
- **Control Anatomy**: `border-input` (`>= 3.42:1` contrast on ivory/white), transparent/white interior, `rounded-lg` (`10px`), `px-2.5 py-1`, `:focus-visible` emerald ring (`ring-3 ring-ring/50`), and `aria-invalid` crimson validation outline + `<FieldError role="alert">`.

### Navigation, Badges & Print Surfaces
- **Status Badges (`<StatusBadge>` + `<TabularPrice>`)**: Pill badges (`rounded-full`) combining semantic background/text pairs, a `6px` status dot, and conditional `SLA Overdue (Nh+)` alert.
- **Public Prayer Pill**: Fixed `296px` pill in the top utility strip displaying offline Umm al-Qura next Salah in English + `<ArabicText>` + `font-mono tabular-nums` Makkah/Madinah AST clock with zero CLS hydration jumps.
- **Signed QR Confirmation Voucher (`/voucher/[token]`)**: `rounded-3xl` printable article (`print:rounded-none print:border print:shadow-none`) crowned by a deep emerald gradient header, `4px` gold rule, centered `<ArabicText>` Bismillah, Warm Ivory QR verification card (`#0A3622` QR modules on `#FAF7F0`), and `print:hidden` action bar.

---

## Do's and Don'ts

### Do
- **Do** route all colors and fonts through `globals.css` semantic tokens (`bg-primary`, `bg-background`, `text-foreground`, `text-muted-foreground`, `text-gold-text`, `border-border`, `border-input`, `font-display`, `font-sans`, `font-mono`, `font-arabic`), migrating legacy hardcoded hex classes (`#686E65`, `#0A3622`) whenever touching planner components.
- **Do** use Burnished Gold (`--gold-text` / `#7A5C1E`) for gold-toned text or small labels on `#FAF7F0` or `#FFFFFF`, reserving `#C5A059` strictly for borders, large icons, and text on `#0A3622`.
- **Do** format every currency amount, `ART-...` code, hotel meter count, phone number, date, and SLA timer in `font-mono tabular-nums`.
- **Do** wrap every Arabic phrase in `<ArabicText>` (`lang="ar"`, `dir="rtl"`, `unicode-bidi: isolate`).
- **Do** use Base UI `render` prop composition (with `nativeButton={false}` on non-button elements), `data-icon` button attributes, semantic `<FieldGroup>` / `<Field>` forms, and `flex gap-*` layout stacks.
- **Do** enforce `:focus-visible` rings, `prefers-reduced-motion: reduce` fallbacks, capped `max-w-7xl` containers, and `overflow-x: clip` / zero horizontal overflow across `320px`–`1920px`.

### Don't
- **Don't** add a dark mode toggle, write `dark:` Tailwind classes, or allow OS dark-mode colors to invert light surfaces.
- **Don't** use Radix `asChild`, `space-x-*` / `space-y-*` utilities, or raw `bg-blue-*` / `bg-green-*` status pills outside `<StatusBadge>`.
- **Don't** render `transition: all`, animate layout geometry (`width`, `height`, `top`, `left`), use `100vw` width traps, or style a single italic word inside a roman display heading.
- **Don't** use purple-to-blue gradients, emojis as UI icons, stacked cards-inside-cards, decorative status dots lacking real state, or unrequested `font-mono` body prose.
- **Don't** fabricate regulatory license numbers (`DTS`, `MoRA`, `IATA`, `NTN`), unverified IBANs, testimonials, review scores, or instant checkout prices on volatile/Hajj surfaces, and **don't** expose manual visa-duration selectors to pilgrims.

---

## Responsive Behavior

| Viewport Tier | Breakpoint | Public Storefront & Builder | 4-Hub Admin Portal |
|---|---|---|---|
| **Small Mobile** | `320px`–`639px` | Single-column stacks, mobile `<Sheet>` drawer, full-width step pills (`grid-cols-2`), prayer pill moves inside drawer, zero horizontal overflow (`320×640`, `375×812`) | Collapsible off-canvas sidebar (`SidebarTrigger`), compact `Search` button, scrollable Kanban columns / table wrapper |
| **Tablet** | `640px`–`1023px` (`sm`/`md`) | 2-up package/hotel cards, horizontal `WizardStepperHeader` (`grid-cols-3` / `sm:grid-cols-4`), visible `296px` prayer pill at `md:` | Topbar breadcrumbs + compact SLA pill (`(2h+)`), split-pane tabs in `/admin/desk` & `/admin/studio` |
| **Desktop** | `1024px`–`1439px` (`lg`/`xl`) | Full 12-column builder split (`8` wizard + `4` sticky `LiveSummaryCard`), horizontal `xl:flex` primary nav, 4-column footer | Persistent collapsible emerald sidebar (`icon` mode), full SLA label, multi-column `@dnd-kit` Kanban board |
| **Wide** | `1440px`–`1920px` (`2xl`+) | `max-w-7xl` / `max-w-6xl` capped measure centered on Warm Ivory; HQ address badge visible in utility strip at `2xl:`; outer margins grow cleanly | Fixed-width sidebar + capped/balanced workspace panels without stretched reading measures |

### Pilgrim Touch & Accessibility Guardrails
- Interactive buttons, primary CTAs, drawer nav links, and form fields target comfortable `44×44px` minimum touch areas (`min-h-11` / `h-11` on mobile touch targets, `min-h-6` on compact utility links where spacing prevents crowding).
- `HeroSlider` lazily hydrates slides `1..N` after SSR so Slide `0` paints immediately for LCP, and auto-rotation pauses whenever `prefers-reduced-motion: reduce`, keyboard focus, or pointer hover is active.

---

## Iteration & Quality Gates

Before handing back any UI, route, or stylesheet change in `web/`, run the verified verification pipeline (targeting `.env.audit` when running DB-backed checks — never live `.env`):

1. **CDD Specification Sync**: Ensure surface behavior matches `PRODUCT.md` and visual tokens match `DESIGN.md` and `web/app/globals.css`. Run `npm run cdd:check` from `web/`.
2. **Hallmark Mechanical Anti-Slop Floor**: Run `npm run ui:lint -- <modified-files>` (wraps `.agents/skills/hallmark/scripts/sloplint.mjs`) — resolve all `FAIL` findings and resolve or document every `REFLEX` finding on new surfaces.
3. **Impeccable Design & Accessibility Audits**: Run Impeccable design-token, contrast, and pattern checks (`detect` / `audit` / `polish`) on edited UI components; confirm zero hardcoded uncalibrated colors, zero missing reduced-motion fallbacks, and clean RTL `<ArabicText>` isolation.
4. **TypeScript, ESLint & Standalone Build**: Run `npx next typegen && npm run typecheck && npm run lint && npm run build` inside `web/` (`0` errors, `0` `@ts-ignore`/`any`/`asChild`).
5. **Playwright E2E & `@axe-core/playwright` WCAG 2.2 AA**: Run `npm run test:e2e` against `.env.audit` (`J1`–`J23` covering `1440×900`, `375×812`, `320×640`, OS dark-mode light-theme lock, and `0` serious/critical Axe WCAG 2.2 AA violations).
