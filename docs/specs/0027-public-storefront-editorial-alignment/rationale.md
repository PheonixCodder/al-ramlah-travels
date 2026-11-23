# Rationale: 0027 · Secondary Public Hubs, Spokes and Shell Editorial Alignment

_Decision record paired with [index.md](./index.md)._

## Context

Slice 44 (`Spec 0025`) built 18 secondary public hub, spoke, guide, trust, and legal routes alongside shared SEO views in `components/seo/*` and public shell chrome in `components/layout/*`. Those files shipped before Slice 45 formalized semantic CSS tokens in `DESIGN.md` and `app/globals.css` and before Slice 46 (`Spec 0026`) redesigned the Home Page (`/`) with editorial proportions, single eyebrow hierarchy, flyer safe package cards, keyboard focus rings, and Hallmark `ui:lint` (`sloplint.mjs`) enforcement.

As a result, pilgrims clicking from the redesigned Home Page into `/umrah-packages`, `/umrah-visa`, `/hajj-2027`, `/hotels/makkah`, `/ziyarat`, `/about`, `/faq`, or `/contact` encounter a noticeable visual seam: oversized multi badge headers, raw hex color classes (`bg-[#FAF7F0]`, `text-[#0A3622]`, `border-[#E6DEC8]`), `transition-all` utilities, unguarded transform transitions, tiny `11px` tracked uppercase pills, and missing `:focus-visible` outlines (`1,148` `FAIL` items when `npm run ui:lint` runs across `app/(public)` and `components/seo`). At the same time, those 18 routes carry strict search engine and compliance contracts (`GB-01` through `GB-06`, `tests/w6/**`, `OD-06`, `OD-09b`, `OD-09e`, `OD-10`) where breaking a single canonical tag, JSON-LD filter, inbound link count, or `>= 50%` 4-gram Jaccard uniqueness check would regress organic visibility.

## Options considered

### Option 1: In Place Semantic Token Migration + Shared `PublicPageHero` Server Component + Surface Aware Motion Sharded Across 4 Parallel UI Slices

Introduce one shared Server Component `PublicPageHero` (`Persuade` and `Read` variants) and shared domain label constants (`LIVE_RATE_CONFIRMATION_LABEL`), then upgrade the 14 secondary route files, `components/seo/*`, public shell (`PublicHeader`, `PublicFooter`, `PublicBreadcrumbs`, `WhatsAppFab`), and `GroupBookingModal` in place across four disjoint worker boundaries while keeping all route segments, `lib/seo/public-queries.ts` calls, and JSON-LD builders unchanged.

**Pros**:
- Eliminates `100%` of `ui:lint` `FAIL`s across the non voucher public storefront while keeping `components/planner/**`, `/voucher/[token]`, and `app/(public)/page.tsx` at zero diff.
- Preserves SSR performance (`revalidate = 3600` / `300`), `GB-01`..`GB-06` SEO invariants, and all existing `tests/w6/**` contracts with minimal regression surface.
- Cleanly parallelizes across four independent file groups (`M1` Shell/Hero/Modal, `M2` Umrah Hubs/Spokes, `M3` Sacred Guides/Destinations, `M4` Trust/Policy Spokes).

**Cons**:
- Requires careful surgical updates across ~30 `.tsx` files rather than a single global CSS override because hardcoded Tailwind hex classes and inline JSX copy live inside each view file.

### Option 2: Token Swap Only Without `PublicPageHero` or Editorial Layout Refinement

Run a mechanical search and replace of hex color literals, `transition-all`, and `:focus-visible` classes across the existing files while leaving all page headers, card densities, and table wrappers untouched.

**Pros**:
- Fastest diff to produce with lowest risk of touching JSX structure.

**Cons**:
- Leaves inconsistent hero spacing, competing double badges, and uneven card proportions across `/umrah-packages`, `/hajj-2027`, `/hotels/[city]`, and `/ziyarat`, failing to match the Slice 46 Home Page bar.

### Option 3: Convert Secondary Hub Pages into Rich Client Filter Apps

Rebuild `/umrah-packages`, `/hotels/[city]`, `/ziyarat`, and `/faq` as interactive client state views with client side tabs, filters, and animated card grids similar to a single page app.

**Pros**:
- Adds interactive client filtering directly on secondary hub pages.

**Cons**:
- Increases client JavaScript bundle weight on high intent SEO landing pages, risks hiding content from crawlers or breaking `1:1` `FAQPage` DOM parity (`GB-04`) and `>= 3` static `<Link>` graph rules (`GB-06`), and duplicates filtering already offered on `/`.

## Rationale

Option 1 directly solves the visual and `ui:lint` gap identified after Slice 46 without jeopardizing any `Spec 0025` SEO or `CONSTITUTION.md` invariant. Because all 14 secondary route files already fetch clean wholesale stripped DTOs from `lib/seo/public-queries.ts` and emit validated JSON-LD through `lib/seo/json-ld.ts`, keeping the data and metadata plumbing untouched while standardizing the visual layer around `PublicPageHero` and `app/globals.css` semantic tokens gives us maximum design cohesion at minimum operational risk. Exporting locked constitutional strings such as `LIVE_RATE_CONFIRMATION_LABEL` from `.ts` helpers satisfies both `sloplint` Gate `19` (no inline JSX dashes) and `tests/w6/**` exact text assertions.

## Route and Test Contract Inventory

### Route Groups Covered (`14` `page.tsx` files -> `18` indexable URLs)

1. **Orchestrator Pre-Fanout + Worker M1 (Shell, Hero Primitive & Modal)**:
   - Orchestrator pre-fanout: `lib/constants/brand.ts` (`LIVE_RATE_CONFIRMATION_LABEL`) + `components/public/public-page-hero.tsx` (`PublicPageHeroProps`)
   - Worker M1: `components/layout/public-header.tsx`, `public-footer.tsx`, `breadcrumbs.tsx`, `whatsapp-fab.tsx`, `components/public/group-booking-modal.tsx`
2. **Worker M2 (Umrah Hubs & Spokes)**:
   - `app/(public)/umrah-packages/page.tsx` (`/umrah-packages`)
   - `app/(public)/umrah-packages/from-[city]/page.tsx` (`/umrah-packages/from-lahore`, `/umrah-packages/from-karachi`, `/umrah-packages/from-islamabad`)
   - `app/(public)/umrah-packages/[slug]/page.tsx` (`/umrah-packages/[slug]`)
   - `components/seo/umrah-{city-gateway-view,city-gateway-data,departures-schedule,package-booking-cta,package-comparison-table,pricing-helpers}.{ts,tsx}`
3. **Worker M3 (Sacred Guides & Destination Spokes)**:
   - `app/(public)/umrah-visa/page.tsx` (`/umrah-visa`)
   - `app/(public)/hajj-2027/page.tsx` (`/hajj-2027`)
   - `app/(public)/hotels/[city]/page.tsx` (`/hotels/makkah`, `/hotels/madinah`)
   - `app/(public)/ziyarat/page.tsx` (`/ziyarat`)
   - `app/(public)/ziyarat/[city]/page.tsx` (`/ziyarat/makkah`, `/ziyarat/madinah`)
   - `components/seo/guides-{visa,hajj,hotels,ziyarat}-{view,data}.{ts,tsx}`
4. **Worker M4 (Trust, Support & Policy Spokes)**:
   - `app/(public)/about/page.tsx` (`/about`)
   - `app/(public)/faq/page.tsx` (`/faq`)
   - `app/(public)/contact/page.tsx` (`/contact`)
   - `app/(public)/terms/page.tsx` (`/terms`)
   - `app/(public)/privacy/page.tsx` (`/privacy`)
   - `app/(public)/refund-policy/page.tsx` (`/refund-policy`)
   - `components/seo/trust-{eeat-credentials,legal-crosslinks}.tsx` (`trust-faq-fanout-data.ts` locked untouched)

### Locked Test Assertions in `tests/seo/**`, `tests/w6/**` & `tests/w3/f-pub/**`

- **Single `<h1>` & Metadata Bounds**: `1` `<h1>` per page, `50` to `60` char `<title>`, `150` to `160` char `<meta name="description">`, `dynamicParams = false` on `from-[city]`, `hotels/[city]`, and `ziyarat/[city]`.
- **JSON-LD & Pricing**: `0` `AggregateRating`/`Review`; `0` wholesale SAR keys; `0` `InStock` or `"Product"` on `/hajj-2027`; `0` `Offer` or `price` in hotel/Ziyarat JSON-LD; `"On Request"` + `disabled` for `<= 0` group tiers; `"0 bed · 0 seat"` infant rule; `"Live Rate — Confirmed upon submission"` visible on `/umrah-visa`, `/hotels/*`, and `/ziyarat*`.
- **Copy Differentiation & Link Graph**: `>= 60%` (`0.50` Gate B floor) 4-gram Jaccard uniqueness across city, hotel, and Ziyarat spokes; `1:1` `FAQPage` parity (`18` to `24` Q&As across `6` `<details open>` categories on `/faq`); `>= 3` inbound `<Link>`s per hub/spoke; `0` `/admin`, `www.`, or bare `#...` links in `PublicHeader`/`PublicFooter`.
- **Interactive Form & Legal Tokens**: `#gb-*` IDs + `"Book Package Seats"` + `"Confirm Group Reservation"` in `GroupBookingModal`; `#h-*` IDs in `/hajj-2027`; `#c-*` IDs + hours `<table>` on `/contact`; `"In-Person Credential Inspection at Our Lahore Cantt Office"` when licenses are null; all `OD-06` storage keys (`alramlah_attribution_v1`, `alramlah_planner_draft_v1`), retention windows (`60 Days Post-Return`, `24 Months`, `6 Years`), and `STOP`/`UNSUBSCRIBE` opt out terms on `/privacy`, `/terms`, and `/refund-policy`.
