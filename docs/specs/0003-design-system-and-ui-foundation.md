# 0003. Design system & UI foundation

**Date**: 2026-10-17
**Status**: Proposed

## Summary

This specification establishes the luxury design system and user interface foundation for Al Ramlah Travels. It unifies the application around a single sacred luxury aesthetic inspired by the Haramain and directly matched to the brand emblem, combining deep emerald green, metallic gold, warm ivory canvas, and crisp alabaster cards. Dark mode switching is eliminated to guarantee a singular, prestigious brand experience across both the public booking platform and the dense administrative operations portal.

## Context

Al Ramlah Travels caters to high-intent pilgrims and families embarking on sacred journeys (Umrah and Hajj) from Pakistan and overseas. A generic software template or stark corporate dashboard undermines the emotional gravity, sanctity, and trust required for spiritual travel. The visual identity must evoke reverent luxury, precision, and tranquility, harmonized with the brand emblem depicting the Holy Kaaba, golden minaret, golden crescent, and gold calligraphy.

Reference benchmarks reveal two complementary strengths that must be merged:
1. **Al-Safa conversion clarity**: high-converting interactive planner cards, sticky live itinerary summary card, clear travel parameters (nights in Makkah/Madinah, hotel distances, room sharing, passenger counter), and a dense, data-rich executive admin portal with clear status pills and 24h service level agreement warnings.
2. **Haramain Safar sacred elegance**: warm ivory canvas, deep emerald green headers, metallic gold borders and accents, Islamic geometric watermarks, and Arabic calligraphy flourishes.

Previous defaults relied on generic neutral grayscale tokens and unconfigured dark mode toggling. Next.js 16 App Router and shadcn base-nova with Base UI (`@base-ui/react`) require explicit design tokens, typography rules, layout shells, and component composition patterns (`render` prop instead of Radix `asChild`). Establishing this foundation now ensures that all subsequent feature slices (Custom Journey Builder, Admin Quoting Worksheet, Dynamic Inventory, Group Packages, Marketing CMS, and Executive Dashboard) share an identical visual language, component contract, and zero-flash layout structure.

## Requirements

**User stories**:
- As a pilgrim, I want an aesthetically serene, legible, and culturally respectful journey builder with live itemized pricing feedback so that I feel immediate confidence and spiritual peace planning my sacred pilgrimage.
- As an agency administrator, I want an organized, high-density dashboard with clear status indicators and 24h SLA overdue warnings so that I can manage high-volume quote worksheets without eye fatigue or confusion.
- As a frontend engineer, I want a single authoritative design token system, Base UI render-prop patterns, and shared public/admin shell layouts so that I can construct UI slices rapidly without guessing colors, margins, or component APIs.

**Acceptance criteria**:
- **AC-1**: Single luxury theme tokens (Deep Haramain Emerald, Metallic Gold, Warm Ivory canvas, Crisp Alabaster card surface, Sand hairline borders) are defined in CSS variables and Tailwind v4 `@theme inline` with WCAG 2.1 AA/AAA contrast compliance across all text and interactive states.
- **AC-2**: Dark mode switching is explicitly eliminated from the application; the HTML root and layout render a single permanent luxury theme without hydration mismatch or theme toggle artifacts.
- **AC-3**: A four-tier typography hierarchy is established: Editorial Display (`Playfair Display` or `Cormorant Garamond`), UI/Body Sans (`Plus Jakarta Sans`), Monospace/Tabular (`JetBrains Mono` with `tabular-nums`), and Sacred Arabic Calligraphy (`Amiri` or `Noto Naskh Arabic`).
- **AC-4**: A semantic status palette is defined for the 5-stage application lifecycle (`Pending Quote` amber, `Quoted` royal blue, `Approved` emerald green, `Rejected` crimson, `Cancelled` neutral slate) and a pulsing 24-hour SLA overdue alert badge.
- **AC-5**: The Public Shell architecture (`app/(public)/layout.tsx`) renders a top utility strip (WhatsApp hotline, 24/7 pilgrim support, office locations, quick status jump), a sticky warm-ivory glassmorphic header (brand logo, bilingual wordmark, navigation links, primary CTA button), a rich multi-column footer with Haramain geometric watermark, trust badges, and a floating WhatsApp concierge button.
- **AC-6**: The Admin Portal Shell architecture (`app/admin/(dashboard)/layout.tsx`) renders a deep emerald collapsible sidebar (`components/ui/sidebar.tsx`) structured into 4 logical groups (Overview & CRM, Packages & Pricing, Dynamic Inventory, Administration), along with an executive topbar featuring global search (`Ctrl+K`), pending notification counter, and user profile session badge.
- **AC-7**: All shadcn component wrappers and consumers strictly adhere to Base UI (`@base-ui/react`) composition rules, utilizing the `render` prop (e.g., `<DialogTrigger render={<Button />} />`) and `nativeButton={false}` for anchor/span render targets, with zero legacy Radix `asChild` usage.
- **AC-8**: Component styling rules enforce semantic tokens (`bg-primary`, `text-muted-foreground`), `gap-*` flex layouts instead of `space-x-*`/`space-y-*`, `size-*` square dimensions, and full Card anatomical composition (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).

## Options considered

### Option 1: Standard shadcn dual-theme (light and dark) with default neutral palette
Retain standard slate/neutral grayscale tokens and provide a user-facing dark mode toggle via `next-themes`.

**Pros**:
- Off-the-shelf defaults requiring minimal token customization.
- Familiar developer ergonomics for generic SaaS applications.

**Cons**:
- Fails the brand identity requirement: completely lacks the spiritual, sacred character of the Haramain and does not harmonize with `public/logo-icon.png`.
- Doubles testing surface across two themes for every feature slice while diluting the prestige of the travel agency.
- Violates the strict project instruction forbidding dark mode toggles.

### Option 2: Pure bespoke CSS stylesheets without design token abstractions
Author custom CSS classes and stylesheets per component without mapping tokens to Tailwind v4 theme variables or shadcn primitives.

**Pros**:
- Full pixel-level control without conforming to framework schemas.

**Cons**:
- Severe maintenance overhead, high likelihood of color drift, and broken integration with shadcn CLI components (`base-nova` preset).
- Incompatible with automated subagent UI development across subsequent slices.

### Option 3 (Chosen): Single locked Haramain Luxury theme with Base UI `base-nova` tokens and dedicated Public/Admin shells
Define a comprehensive, single-theme token system in `app/globals.css` and `design.md`, remove dark mode switching, configure Next.js fonts, implement Base UI render-prop patterns, and construct dedicated layout shells for public visitors and agency administrators.

**Pros**:
- Flawlessly captures the luxury, dignity, and sacred heritage of Al Ramlah Travels directly matched to `public/logo-icon.png`.
- Establishes a permanent, unbreakable design contract for all subsequent feature slices (Builder, Quotes, Inventory, CMS, Dashboard).
- Base UI integration ensures full compatibility with React 19, Next.js 16, and modern accessible headless primitives.
- High-converting, tested layout patterns from Al-Safa and Haramain Safar are systematized.

**Cons**:
- Requires deliberate color pairing and contrast verification for all custom semantic tokens.

## Decision

**Chosen option**: Option 3: Single locked Haramain Luxury theme with Base UI `base-nova` tokens and dedicated Public/Admin shells.

Al Ramlah Travels is locked to a single luxury palette inspired by the Holy Kaaba and the Haramain, using Base UI primitives and Tailwind CSS v4 `@theme inline` variables.

**Implementation skills**: `shadcn` (`c:\dev\al-ramlah-travels\.agents\skills\shadcn\`), `migrate-radix-to-base` (`c:\dev\al-ramlah-travels\.agents\skills\migrate-radix-to-base\`).

## Rationale

A pilgrimage to Makkah and Madinah is often a once-in-a-lifetime spiritual milestone. The visual medium through which a pilgrim configures their sacred journey must reflect reverent luxury, transparency, and dependability. By locking the design system to a single cohesive aesthetic harmonized with `public/logo-icon.png` (Deep Haramain Emerald, Metallic Gold, Warm Ivory, Alabaster White), we eliminate visual inconsistency and create an unmistakable identity.

On the operational side, agency staff spend hours reviewing complex hotel, airline, and visa pricing. The Al-Safa reference demonstrates that an ivory canvas paired with crisp card surfaces, a deep emerald sidebar, bold tabular typography for currency, and clear semantic status pills maximizes scanning efficiency and eliminates administrative errors. Adopting Base UI with shadcn `base-nova` gives us headless accessibility, native React 19 compatibility, and robust render-prop composition.

## Feature design

### Data model sketch

The design system operates at the presentation and layout layer. Its runtime schema comprises layout configuration, theme tokens, and navigation schemas:

```typescript
// Navigation Item Schema
export interface NavItem {
  title: string
  href: string
  icon?: LucideIcon
  badge?: string | number
  badgeVariant?: "default" | "secondary" | "warning" | "destructive" | "gold"
  external?: boolean
  roles?: ("super_admin" | "staff")[]
}

// Admin Navigation Group Schema
export interface NavGroup {
  groupLabel: string
  items: NavItem[]
}

// Pipeline Status Token Definition
export type ApplicationStatus = "pending_quote" | "quoted" | "approved" | "rejected" | "cancelled"

export interface StatusStyle {
  label: string
  badgeVariant: "amber" | "sky" | "emerald" | "crimson" | "slate"
  dotClass: string
  bgClass: string
  textClass: string
  borderClass: string
}
```

### State transitions

The visual presentation of quote requests maps directly to the 5-stage application pipeline:

```
[Pending Quote] ──(Admin enters rates & saves)──> [Quoted] ──(Pilgrim accepts & pays)──> [Approved]
       │                                             │
       ├──────────(Rejected by admin/pilgrim)────────┴──> [Rejected]
       │                                             │
       └──────────(Cancelled by customer)────────────┴──> [Cancelled]
```

Visual state mapping:
- **`Pending Quote`**: Warm Amber border & pill (`#D97706` / bg `#FEF3C7` / text `#92400E`). If creation timestamp $>24$ hours ago, prepend pulsing red SLA overdue dot (`animate-pulse text-red-600`).
- **`Quoted`**: Royal Sky Blue border & pill (`#0284C7` / bg `#E0F2FE` / text `#0369A1`).
- **`Approved`**: Sacred Emerald Green border & pill (`#059669` / bg `#D1FAE5` / text `#065F46`).
- **`Rejected`**: Crimson Red border & pill (`#DC2626` / bg `#FEE2E2` / text `#991B1B`).
- **`Cancelled`**: Neutral Slate border & pill (`#64748B` / bg `#F1F5F9` / text `#334155`).

### API surface & Component architecture

| Component / Layout | File Path | Key Inputs / Props | Output / Surface | Auth | Key Errors / Behavior |
|---|---|---|---|---|---|
| Root Layout | `app/layout.tsx` | `children: ReactNode` | Global fonts, TooltipProvider, No ThemeProvider | Public | Suppress hydration warnings |
| Public Shell Layout | `app/(public)/layout.tsx` | `children: ReactNode` | Top Utility Strip, Sticky Header, Main Container, Footer, WhatsApp FAB | Public | SSR cached header links |
| Admin Shell Layout | `app/admin/(dashboard)/layout.tsx` | `children: ReactNode` | Collapsible Emerald Sidebar, Header with Search & Notifications, Dashboard Area | Session (`super_admin` \| `staff`) | 401 redirect to `/admin/login` |
| Public Header | `components/layout/public-header.tsx` | `activePath?: string` | Bilingual Logo, Nav Links, Plan Journey CTA | Public | Mobile hamburger sheet fallback |
| Public Footer | `components/layout/public-footer.tsx` | None | Columns: Brand, Packages, Links, Contact, IATA & License badges | Public | Static rendering |
| Admin Sidebar | `components/layout/admin-sidebar.tsx` | `currentPath: string`, `pendingCount: number` | Collapsible navigation across 4 groups | Session | Role filter on `/admin/users` |
| Status Badge | `components/ui/status-badge.tsx` | `status: ApplicationStatus`, `createdAt?: Date` | Visual status pill with dot and SLA overdue indicator | Both | Fallback to neutral slate |
| Tabular Number | `components/ui/tabular-price.tsx` | `amount: number`, `currency?: "PKR"` | Tabular formatted currency `PKR 1,250,000` | Both | Handles 0 or undefined cleanly |

### Value sourcing

| Action / Surface | Value produced / displayed | Source |
|---|---|---|
| Admin Sidebar | Pending Quotes Count Badge | Live count query: `applications` table where `status = 'pending_quote'` |
| Admin Header | Unread Contact Messages Count | Live count query: `contact_messages` table where `is_read = false` |
| Admin Header | Staff Name & Avatar Initials | Better Auth active session object (`session.user.name`) |
| Admin Header | Role Badge (`Super Admin` vs `Staff`) | Better Auth active session user role (`session.user.role`) |
| Public Utility Strip | Hotline & WhatsApp Number | Decided constant: `+92 300 1234567` (driven by Agency Settings in Slice 4) |
| Public Utility Strip | License & Accreditation Numbers | Decided constant: `Govt. Licensed Umrah Operator — License # 4082` |
| Public Footer | Copyright Year | Current server year (`new Date().getFullYear()`) |
| Price Displays | Currency Format (`PKR NNN,NNN`) | Utility function `formatPKR(val)` with `en-PK` locale formatting |

### Key invariants

1. **Zero Dark Mode**: No dark mode class or CSS override will be applied; the application operates solely in the luxury Haramain palette.
2. **Accessible Contrast (WCAG 2.1 AA)**: All text on Primary Emerald backgrounds (`#0A3622` / `#0F4C31`) must be crisp white (`#FFFFFF`) or metallic gold (`#F5E6C8`); all body text on Warm Ivory canvas (`#FAF7F0`) must use Deep Slate Charcoal (`#1A1D1A`) with contrast ratio $> 7:1$.
3. **Base UI Composition**: Every interactive overlay trigger (`DialogTrigger`, `SheetTrigger`, `PopoverTrigger`, `TooltipTrigger`) MUST use `render={<Component />}` rather than Radix `asChild`.
4. **Number Legibility**: Every financial amount in PKR, distance in meters, and application reference code must use `tabular-nums` and `font-mono` for perfect horizontal alignment in tables and summary cards.
5. **Mobile Viewport Stability**: Public header and admin sidebar must collapse cleanly on viewports $<1024\text{px}$ without horizontal scroll overflow.

### Security model

- **Public Shell (`app/(public)`)**: Open access to all visitors. No sensitive data exposed.
- **Admin Shell (`app/admin/(dashboard)`)**: Guarded by Better Auth server session verification. Non-authenticated visitors redirected to `/admin/login`.
- **Role Hierarchy**:
  - `super_admin`: Sees all 4 navigation groups, including `Staff & Roles` (`/admin/users`).
  - `staff`: Sees Overview & CRM, Packages & Pricing, Dynamic Inventory, and Website Content CMS. `Staff & Roles` is hidden from the sidebar.

### Configuration required

No new external environment variables or third-party API keys are required for the design system and UI foundation. Google Fonts are imported via `next/font/google` in `app/layout.tsx`.

### Critical test scenarios

- **Happy path**: Visitor opens home page, views public utility strip, sticky header with brand logo, and navigates links without layout shift; admin signs in, views deep emerald sidebar, sees pending application count badge, and toggles sidebar collapse cleanly. Verifies **AC-1**, **AC-5**, **AC-6**.
- **Failure case / Edge case**: Browser with OS dark mode preference set opens the site; no flash of black background or inverted colors occurs, and all elements render in the warm ivory and emerald luxury palette. Verifies **AC-2**.
- **Component contract**: Base UI trigger composition rendered in dialog or dropdown compiles and triggers open/close states without React console warnings regarding `asChild` or missing children. Verifies **AC-7**.
- **Status & SLA alert**: Application in `pending_quote` created 26 hours ago renders with the amber status badge plus a pulsing red dot indicating overdue SLA. Verifies **AC-4**.

## Build plan

1. Define the complete Haramain Luxury design token palette, CSS variables, and typography rules in `c:\dev\al-ramlah-travels\design.md`, satisfies **AC-1**, **AC-3**, **AC-4**.
2. Replace `app/globals.css` theme variables with the single luxury palette (Deep Haramain Emerald, Metallic Gold, Warm Ivory, Alabaster White, Sand hairline borders, semantic status colors) and remove dark mode selectors, satisfies **AC-1**, **AC-2**, **AC-4**.
3. Configure `next/font/google` in `app/layout.tsx` for `Plus Jakarta Sans`, `Playfair Display`, `JetBrains Mono`, and `Amiri`, and remove legacy `ThemeProvider`, satisfies **AC-2**, **AC-3**.
4. Build the Public Shell architecture in `app/(public)/layout.tsx` with top utility strip, sticky glassmorphic header, rich footer with trust badges, and floating WhatsApp concierge action, satisfies **AC-5**, **AC-8**.
5. Build the Admin Portal Shell architecture in `app/admin/(dashboard)/layout.tsx` with deep emerald collapsible sidebar (`components/ui/sidebar.tsx`), 4 navigation groups, topbar with global search and notification badges, satisfies **AC-6**, **AC-8**.
6. Audit and configure shadcn Base UI primitives with `render` prop composition standards and provide foundational UI components (`StatusBadge`, `TabularPrice`), satisfies **AC-7**, **AC-8**.

## Consequences

**Positive**:
- Unmistakable spiritual elegance and prestige that elevates Al Ramlah Travels above generic competitors.
- Clear, unambiguous design and component rules for all future feature subagents, preventing UI drift.
- Accessible, high-contrast layouts tailored specifically for high-conversion journey planning and dense administrative quote operations.
- Native React 19 and Next.js 16 compatibility using modern Base UI headless primitives.

**Negative / tradeoffs**:
- Removal of dark mode may disappoint users who prefer dark backgrounds for late-night viewing, but aligns strictly with luxury travel and religious agency brand standards.
- Custom typography imports require initial font asset caching by the browser (mitigated by Next.js font optimization).

**Neutral**:
- Requires ongoing discipline when adding new shadcn components to ensure they conform to Base UI `render` prop rules rather than Radix `asChild`.

## Follow-up

- [ ] Verify that Google Fonts (`Playfair Display`, `Plus Jakarta Sans`, `JetBrains Mono`, `Amiri`) build and cache cleanly in Next.js 16 production build.
- [ ] Connect the dynamic pending count badge in the admin sidebar to the live Neon PostgreSQL database once Feature 5 (`Core quote loop`) ships.

## References

**Project sources**:
- `c:\dev\al-ramlah-travels\AGENTS.md`: Project stack, Next.js 16 rules, single luxury theme policy, and subagent orchestration rules.
- `c:\dev\al-ramlah-travels\docs\scope\scope.md`: Living scope, Feature 4 requirements and deliverables.
- `c:\dev\al-ramlah-travels\public\logo-icon.png`: Visual gold standard for brand colors and iconography.
- `c:\dev\al-ramlah-travels\.agents\skills\shadcn\`: Component styling and composition rules.
- `c:\dev\al-ramlah-travels\.agents\skills\migrate-radix-to-base\`: Base UI `render` prop and wrapper migration standards.

**Practices & standards**:
- Web Content Accessibility Guidelines (WCAG) 2.1: AA/AAA contrast ratios for luxury warm palettes.
- Base UI Headless Architecture (`@base-ui/react`): Render-prop pattern and accessible overlay primitives.
- Al-Safa & Haramain Safar visual design analysis: Reference layouts for Umrah planner cards and executive CRM dashboards.
