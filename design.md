# Al Ramlah Travels — Design System & UI Architecture

This document is the canonical design system reference for **Al Ramlah Travels**. All UI subagents, engineers, and components built across the public booking platform and the admin management portal must strictly conform to the tokens, layouts, typography, and component patterns defined here.

---

## 1. Brand Philosophy & Identity

Al Ramlah Travels (`سفريات الرملة`) delivers premium, bespoke pilgrimage travel experiences for Hajj, Umrah, and Ziyarat. The visual identity embodies **Sacred Luxury**: a dignified blend of timeless Islamic heritage, the serenity of the Two Holy Mosques (Haramain), and the polish of modern luxury hospitality.

### Visual Anchor: `public/logo-icon.png`
The brand emblem depicts:
- The Holy Kaaba draped in the deep charcoal Kiswah with its illuminated gold band and door.
- A golden minaret evoking the Prophet's Mosque in Madinah and the Haram in Makkah.
- A golden crescent cradling the sanctuary.
- Flowing, sculpted Arabic calligraphy of `الرملة` in metallic gold.

Every color, elevation layer, and typographic choice throughout the application is directly harmonized with this emblem.

---

## 2. Color Palette & Theme Tokens

### Single Luxury Theme (Zero Dark Mode)
Al Ramlah Travels enforces a **single, locked luxury theme**. There is no dark mode toggle or `.dark` class switching. The application renders exclusively in the **Haramain Luxury Palette** across all viewports and user sessions.

### Primary Colors
- **Deep Haramain Emerald (`--primary`)**: Rich, authoritative emerald green evoking the sacred dome of Madinah and royal sanctuary architecture.
  - Hex: `#0A3622` (deep) / `#0F4C31` (base primary)
  - OKLCH: `oklch(0.26 0.08 155)`
  - Foreground: `#FFFFFF` (`oklch(1 0 0)`)
  - Usage: Primary CTAs, active navigation states, public hero banners, admin sidebar, selected card borders.

- **Metallic Haramain Gold / Champagne (`--accent`, `--gold`)**: Warm metallic gold harmonized with the Kiswah embroidery and emblem calligraphy.
  - Hex: `#C5A059` (base gold) / `#D4AF37` (bright gold) / `#8F6E2A` (deep border gold)
  - OKLCH: `oklch(0.72 0.12 85)`
  - Foreground: `#0A3622` (`oklch(0.26 0.08 155)`)
  - Usage: Accent pills, highlights, gold dividers, star ratings, CTA borders, luxury icons.

### Canvas & Surface Layers
- **Warm Ivory Canvas (`--background`)**: Soft, welcoming ivory reminiscent of fine Arabic parchment and alabaster courtyard marble.
  - Hex: `#FAF7F0`
  - OKLCH: `oklch(0.975 0.012 85)`
  - Usage: Main page background for both public site and admin portal canvas.

- **Alabaster Parchment (`--secondary` / `--muted`)**: Slightly deeper warm ivory tone for secondary surfaces, input backgrounds, and table headers.
  - Hex: `#F5EFE6`
  - OKLCH: `oklch(0.95 0.018 80)`
  - Usage: Inactive button tabs, input fills, dropdown hover states.

- **Crisp Card Surface (`--card`)**: Pure, elevated alabaster white for interactive planner modules, review worksheets, and data tables.
  - Hex: `#FFFFFF`
  - OKLCH: `oklch(1 0 0)`
  - Usage: Cards, modals, sheets, popovers, table bodies.

- **Sand Gold Hairline Border (`--border`)**: Delicate warm border that creates subtle definition without harsh contrast.
  - Hex: `#E6DEC8`
  - OKLCH: `oklch(0.90 0.02 85)`
  - Usage: Card outlines, divider lines, table cell borders.

### Text & Neutral Tokens
- **Deep Slate Charcoal (`--foreground`)**: Authoritative, legible, high-contrast dark charcoal.
  - Hex: `#1A1D1A`
  - OKLCH: `oklch(0.18 0.015 155)`
  - Contrast on `#FAF7F0`: $> 12:1$ (exceeds WCAG AAA).

- **Warm Slate Taupe (`--muted-foreground`)**: Neutral secondary text for descriptions, subheadings, and meta labels.
  - Hex: `#686E65`
  - OKLCH: `oklch(0.52 0.02 140)`
  - Contrast on `#FAF7F0`: $> 4.8:1$ (exceeds WCAG AA).

### Semantic Status Colors (5-Stage Application Pipeline)
The quoting and booking pipeline uses 5 standardized semantic statuses:

| Status | Hex | OKLCH | Background | Text | Description |
|---|---|---|---|---|---|
| **Pending Quote** | `#D97706` | `oklch(0.68 0.16 75)` | `#FEF3C7` | `#92400E` | Request submitted by pilgrim, awaiting admin rates |
| **Quoted** | `#0284C7` | `oklch(0.58 0.16 230)` | `#E0F2FE` | `#0369A1` | Admin sent itemized quote to pilgrim |
| **Approved** | `#059669` | `oklch(0.60 0.16 155)` | `#D1FAE5` | `#065F46` | Pilgrim accepted & deposit received |
| **Rejected** | `#DC2626` | `oklch(0.55 0.22 27)` | `#FEE2E2` | `#991B1B` | Request declined (no inventory, invalid passport) |
| **Cancelled** | `#64748B` | `oklch(0.55 0.03 240)` | `#F1F5F9` | `#334155` | Pilgrim withdrew application |

- **24h SLA Overdue Warning**: Applications remaining in `Pending Quote` longer than 24 hours display a pulsing alert dot (`#EF4444`, `animate-pulse`) alongside text: `1 overdue (24h+)`.

---

## 3. CSS Variables & Tailwind v4 `@theme inline`

```css
/* app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@theme inline {
  --font-display: var(--font-display);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-arabic: var(--font-arabic);

  --color-background: var(--background);
  --color-foreground: var(--foreground);

  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);

  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);

  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);

  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);

  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);

  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);

  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);

  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-gold: var(--gold);
  --color-gold-foreground: var(--gold-foreground);
  --color-gold-border: var(--gold-border);

  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  /* Warm Ivory canvas */
  --background: oklch(0.975 0.012 85);
  --foreground: oklch(0.18 0.015 155);

  /* Elevated Alabaster Card */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.18 0.015 155);

  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.18 0.015 155);

  /* Deep Haramain Emerald */
  --primary: oklch(0.26 0.08 155);
  --primary-foreground: oklch(1 0 0);

  /* Alabaster Parchment */
  --secondary: oklch(0.95 0.018 80);
  --secondary-foreground: oklch(0.26 0.08 155);

  --muted: oklch(0.95 0.018 80);
  --muted-foreground: oklch(0.52 0.02 140);

  /* Metallic Gold */
  --accent: oklch(0.92 0.04 85);
  --accent-foreground: oklch(0.26 0.08 155);

  --gold: oklch(0.72 0.12 85);
  --gold-foreground: oklch(0.20 0.06 155);
  --gold-border: oklch(0.80 0.08 85);

  --destructive: oklch(0.55 0.22 27);
  --destructive-foreground: oklch(0.98 0 0);

  --border: oklch(0.90 0.02 85);
  --input: oklch(0.90 0.02 85);
  --ring: oklch(0.26 0.08 155);

  /* Admin Sidebar: Deep Emerald Night */
  --sidebar: oklch(0.16 0.05 155);
  --sidebar-foreground: oklch(0.95 0.01 85);
  --sidebar-primary: oklch(0.72 0.12 85);
  --sidebar-primary-foreground: oklch(0.16 0.05 155);
  --sidebar-accent: oklch(0.22 0.06 155);
  --sidebar-accent-foreground: oklch(0.98 0 0);
  --sidebar-border: oklch(0.22 0.04 155);
  --sidebar-ring: oklch(0.72 0.12 85);

  /* Recharts Luxury Palette */
  --chart-1: oklch(0.26 0.08 155); /* Emerald */
  --chart-2: oklch(0.72 0.12 85);  /* Gold */
  --chart-3: oklch(0.58 0.16 230); /* Sky/Royal */
  --chart-4: oklch(0.68 0.16 75);  /* Amber */
  --chart-5: oklch(0.52 0.02 140); /* Slate */

  --radius: 0.625rem;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
  html {
    @apply font-sans;
  }
}
```

---

## 4. Typography Hierarchy

The typographic system utilizes 4 purposeful font families imported via `next/font/google`:

```typescript
// app/layout.tsx
import { Plus_Jakarta_Sans, Playfair_Display, JetBrains_Mono, Amiri } from "next/font/google"

export const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
})

export const fontDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
})

export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
})

export const fontArabic = Amiri({
  subsets: ["arabic"],
  variable: "--font-arabic",
  weight: ["400", "700"],
})
```

### Font Roles & Usage Rules

1. **Editorial Display (`font-display` / `Playfair Display`)**:
   - Used for primary hero headlines, section lead titles, and marketing callouts.
   - Example: *"Build your package & see the price instantly"*, *"Journeys for every intention & budget"*, *"Your invitation is waiting. Begin your journey today."*
   - Always paired with high contrast and relaxed tracking.

2. **UI & Body Sans (`font-sans` / `Plus Jakarta Sans`)**:
   - Used for all standard body copy, interactive buttons, form input fields, tooltips, tabs, and administrative navigation.
   - Clean, highly legible geometric sans with generous x-height.

3. **Tabular Monospace (`font-mono` / `JetBrains Mono` with `tabular-nums`)**:
   - **MANDATORY** for all prices (`PKR 1,250,000`), reference IDs (`ART-2026-B5C7`), hotel distances (`350 m`), dates, and countdown SLA timers.
   - Prevents column jitter during dynamic live price recalculations.

4. **Sacred Arabic Calligraphy (`font-arabic` / `Amiri`)**:
   - Used for Quranic verses, Bismillah, Talbiyah (*Labbayka Allāhumma Labbayk*), and Arabic names of historical Ziyarat landmarks (Jabal al-Nour, Ghar Hira, Masjid Quba).

---

## 5. Spacing, Elevation & Geometric Accents

### Border Radius Scale
- `rounded-sm`: 6px (micro badges, inline tags)
- `rounded-md`: 8px (form inputs, buttons, dropdown items)
- `rounded-lg`: 10px (default card elements, dialogs)
- `rounded-xl`: 14px (planner option tiles, package summary cards)
- `rounded-2xl`: 18px (hero containers, interactive builder wrapper)
- `rounded-3xl`: 22px (marketing bento grid cards)

### Elevation & Soft Shadows
To maintain a high-end editorial feel, avoid harsh black shadows. Use soft, ambient warm-tinted shadows:
- **Card Rest**: `box-shadow: 0 1px 3px 0 rgba(10, 54, 34, 0.04), 0 1px 2px -1px rgba(10, 54, 34, 0.04);`
- **Card Hover**: `box-shadow: 0 10px 25px -5px rgba(10, 54, 34, 0.08), 0 8px 10px -6px rgba(10, 54, 34, 0.04);`
- **Elevated Sticky Summary / Dialog**: `box-shadow: 0 20px 30px -10px rgba(10, 54, 34, 0.12);`

### Islamic Geometric Accents
Subtle Islamic geometric watermarks (8-point star / arabesque lattice) are applied at 4%–6% opacity on deep emerald banners and the admin sidebar to reinforce sacred heritage without visual clutter.

---

## 6. Base UI (`@base-ui/react`) & shadcn Component Rules

This repository uses shadcn's `base-nova` preset built on `@base-ui/react`.

### 1. The `render` Prop Composition Rule (NO Radix `asChild`)
Radix's legacy `asChild` prop is strictly forbidden. Base UI uses the `render` prop:

```tsx
// ❌ WRONG (Radix legacy)
<DialogTrigger asChild>
  <Button variant="outline">Open Quote</Button>
</DialogTrigger>

// ✅ CORRECT (Base UI)
<DialogTrigger render={<Button variant="outline" />}>
  Open Quote
</DialogTrigger>
```

When rendering an anchor tag (`<a>`) or non-button element as a trigger, pass `nativeButton={false}`:

```tsx
// ✅ CORRECT (Base UI anchor trigger)
<Button render={<Link href="/admin/applications" />} nativeButton={false}>
  View Applications
</Button>
```

### 2. Form Layouts with `FieldGroup` + `Field`
Never use raw `div` with `space-y-*` for forms:

```tsx
// ✅ CORRECT form structure
<FieldGroup className="flex flex-col gap-4">
  <Field>
    <FieldLabel htmlFor="phone">WhatsApp Mobile Number</FieldLabel>
    <Input id="phone" placeholder="0300 1234567" />
    <FieldDescription>We will send your confirmed itinerary here.</FieldDescription>
  </Field>
</FieldGroup>
```

### 3. Button Icons
Buttons use the `data-icon` attribute instead of manual sizing classes:

```tsx
// ❌ WRONG
<Button><Plane className="w-4 h-4 mr-2" /> Book Flight</Button>

// ✅ CORRECT
<Button>
  <Plane data-icon="inline-start" />
  Book Flight
</Button>
```

### 4. Layout Rules
- **No `space-x-*` or `space-y-*`**: Always use `flex flex-col gap-*` or `flex items-center gap-*`.
- **Square dimensions**: Use `size-10` rather than `w-10 h-10`.
- **Text truncation**: Use `truncate` rather than manual overflow classes.
- **Card composition**: Always use the full semantic anatomy (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).

---

## 7. Shell Architecture Specifications

### 7.1 Public Shell (`app/(public)/layout.tsx`)

The public layout wraps all pilgrim-facing views (Home, Custom Journey Builder, Group Packages, Ziyarat, Request Tracker, Contact).

```
┌────────────────────────────────────────────────────────────────────────┐
│ TOP UTILITY STRIP                                                      │
│ 📞 +92 300 1234567 | 💬 24/7 Pilgrim Concierge | 📍 Karachi | Track    │
├────────────────────────────────────────────────────────────────────────┤
│ STICKY HEADER (Glassmorphic Warm Ivory)                                │
│ [Logo] Al Ramlah Travels    Custom Builder  Packages  Ziyarat  Track   │
│                             [ Plan Your Journey CTA ]                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ MAIN CONTENT (Children)                                                │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ RICH MULTI-COLUMN FOOTER                                               │
│ [Emblem + Vision]   [Packages]   [Services]   [Legal & Licenses]       │
│ IATA Accredited · Ministry of Hajj & Umrah Licensed Operator # 4082   │
└────────────────────────────────────────────────────────────────────────┘
  [ Floating WhatsApp Concierge Button (bottom-6 right-6) ]
```

1. **Top Utility Strip**:
   - Emerald background (`#0A3622`), white and gold micro-copy (`text-xs font-medium`).
   - Phone hotline, WhatsApp link, physical agency headquarters, and a direct `"Track Request"` anchor.
   - Government regulatory accreditation badge (`License # 4082`).

2. **Sticky Header**:
   - Frosted warm-ivory backdrop blur (`bg-background/90 backdrop-blur-md border-b border-border`).
   - Brand logo (`public/logo-icon.png`, 44px height) paired with bold luxury typography.
   - Desktop navigation items with smooth hover underline in metallic gold.
   - Primary action: `"Plan Your Journey"` button (`bg-primary text-primary-foreground hover:bg-primary/90`).
   - Mobile sheet navigation on screens $<1024\text{px}$.

3. **Footer**:
   - Deep emerald backdrop with subtle Islamic geometric watermark.
   - 4-column layout: About Al Ramlah, Curated Packages, Pilgrim Services, Contact & Office Hours.
   - Trust and accreditation row (IATA, Ministry of Hajj & Umrah, Pakistan Tourism Development Corporation).
   - Copyright and license declaration.

4. **Floating WhatsApp Concierge**:
   - Fixed at `bottom-6 right-6 z-50`.
   - Emerald green circular badge with WhatsApp icon, subtle gold ring, and pulsating online indicator.

---

### 7.2 Admin Portal Shell (`app/admin/(dashboard)/layout.tsx`)

The admin portal provides an executive, distraction-free environment for quote calculations, application approvals, inventory cataloging, and business intelligence.

```
┌─────────────────┬──────────────────────────────────────────────────────┐
│ SIDEBAR         │ TOPBAR (Search Ctrl+K, Notifications, User Profile) │
│ [Logo]          ├──────────────────────────────────────────────────────┤
│ ADMIN PORTAL    │ BREADCRUMB / PAGE TITLE                              │
│                 ├──────────────────────────────────────────────────────┤
│ OVERVIEW & CRM  │                                                      │
│ • Dashboard     │ MAIN WORKSPACE CONTENT (Children)                    │
│ • Applications  │                                                      │
│ • Messages      │                                                      │
│                 │                                                      │
│ PACKAGES        │                                                      │
│ • Group Packages│                                                      │
│ • Visa Pricing  │                                                      │
│                 │                                                      │
│ INVENTORY       │                                                      │
│ • Hotels        │                                                      │
│ • Transport     │                                                      │
│ • Ziyarat       │                                                      │
│ • Airlines      │                                                      │
│                 │                                                      │
│ ADMINISTRATION  │                                                      │
│ • Content CMS   │                                                      │
│ • Staff & Roles │                                                      │
│ • Settings      │                                                      │
│                 │                                                      │
│ [View Site]     │                                                      │
│ [Logout]        │                                                      │
└─────────────────┴──────────────────────────────────────────────────────┘
```

1. **Deep Emerald Collapsible Sidebar (`components/ui/sidebar.tsx`)**:
   - Background: Darkest Emerald Night (`#072417` / `oklch(0.16 0.05 155)`).
   - Metallic gold emblem and title: `Al Ramlah Travels — ADMIN PORTAL`.
   - **Group 1: Overview & CRM**:
     - `Executive Dashboard` (`/admin`)
     - `Applications & Quotes` (`/admin/applications`) with live amber count badge for pending quotes.
     - `Contact Inbox` (`/admin/messages`) with unread message badge.
   - **Group 2: Packages & Pricing**:
     - `Group Packages` (`/admin/groups`)
     - `Visa Pricing` (`/admin/visa`)
   - **Group 3: Dynamic Inventory**:
     - `Hotels Catalog` (`/admin/hotels`)
     - `Transport & Vehicles` (`/admin/transport`)
     - `Ziyarat Places` (`/admin/ziyarat`)
     - `Airlines & Departure Cities` (`/admin/flights`)
   - **Group 4: Administration**:
     - `Website Content CMS` (`/admin/content`)
     - `Staff & Roles` (`/admin/users`) — conditionally rendered only for `super_admin`.
     - `Agency Settings` (`/admin/settings`)
   - Bottom utility links: `View Website` (opens public site in new tab) and `Logout`.

2. **Executive Topbar**:
   - Clean alabaster white background with gold hairline border.
   - Global search input with keyboard shortcut badge (`Ctrl+K` / `⌘K`) to instantly find applications by pilgrim name, reference code, CNIC, or mobile number.
   - Notification bell button with active badge indicator.
   - User profile dropdown showing staff name, avatar initials, and role badge (`Super Admin` vs `Staff`).

---

## 8. High-Converting Interactive UI Patterns

### 8.1 Custom Journey Builder: Interactive Option Cards
Cards representing packages, room sharing (Quad, Triple, Double), vehicle types, and meal plans share an interactive token state:
- **Default / Unselected**: White card, subtle border (`#E6DEC8`), muted gray/taupe icon, gray price subtitle.
- **Hover**: Subtle lift (`translate-y-[-2px]`), border color transitions to soft gold (`#C5A059`).
- **Selected**: Emerald border (`2px solid #0F4C31`), soft emerald/gold glow, emerald checkmark badge at top-right corner, bold title.

### 8.2 Sticky Live Itinerary Summary Card
Positioned alongside the builder steps on desktop viewports (`sticky top-24`):
- **Deep Emerald Luxury Theme**: Deep emerald backdrop (`#0A3622`), white headings, and metallic gold accents.
- **Dual-Mode Price Display**:
  - **Mode A (Visa Only)**: Displays calculated fixed price in prominent tabular numbers: `PKR 85,000` with subtext: *"Guaranteed immediate rate including insurance"*.
  - **Mode B (Volatile Services Enabled)**: Displays itemized breakdown (Package Base, Hotel Nights, Transport, Ziyarat) and bold estimated headline:
    ```
    ESTIMATED TOTAL
    PKR 1,126,400
    "Live Rate — Confirmed upon submission"
    ```
- **Primary Action**: Full-width gold/emerald gradient button: `Apply for this Journey` or `Get details on WhatsApp`.
- **Trust Reassurance**: Micro-copy footer: *"Our team approves requests within 24 hours. Final price is confirmed at approval."*

### 8.3 Dense Admin Quoting Worksheet & Data Tables
Inspired by the Al-Safa executive operational layout:
- **Status Pills**: 5 standardized status styles with colored dot indicator.
- **Tabular Alignment**: All amounts formatted as `PKR NNN,NNN` in `font-mono tabular-nums text-right`.
- **Quick Action Bar**: Top-right row actions on application detail: `Call`, `WhatsApp`, `Email`, `Print Voucher`, `Approve`, `Reject`, `Under Review`, `Cancel`.
- **Internal Notes Box**: Dedicated admin-only collapsible note area for quoting margins, supplier contacts, and special pilgrim accommodations.

---

## 9. Do's and Don'ts for UI Builders

### Do
- **DO** use the single luxury palette tokens (`bg-primary`, `text-primary`, `border-border`, `bg-background`).
- **DO** use `tabular-nums` and `font-mono` for all prices, reference codes, and distance metrics.
- **DO** use Base UI `render` prop composition for all triggers and dialogs.
- **DO** use `data-icon="inline-start"` or `data-icon="inline-end"` for icons inside buttons.
- **DO** test contrast ratios on primary emerald and warm ivory backgrounds.

### Don't
- **DON'T** expose a dark mode toggle or write `dark:` class overrides.
- **DON'T** use raw Tailwind colors (e.g. `bg-blue-600`, `text-gray-500`, `bg-green-500`) for status indicators; use the standardized status classes or Badge tokens.
- **DON'T** use Radix's `asChild` prop.
- **DON'T** use `space-x-*` or `space-y-*`; use `flex` with `gap-*`.
- **DON'T** display manual visa tier selectors (short-term vs long-term) to customers; it must always be auto-derived from arrival and departure dates.
