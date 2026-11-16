# Wave 5 SEO & GEO Master Triage (`02-seo-triage.md`)

- **Lead Auditor & Triage Architect**: `s16-spec`
- **Target Branch / Baseline Commit**: `audit/production-hardening` (`6c54d4c`, Gate A certified)
- **Empirical Pre-Phase-B Baseline Score**: **`54.5 / 100` (Grade `D`)** — see [`baseline/score_report.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/baseline/score_report.md) & [`findings/S16.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/findings/S16.md)
- **Target Post-Wave-6 Score**: **`>= 90.0 / 100` (Grade `A`)** + `100%` Gate B (`GB-01`–`GB-08`) PASS
- **Specialist Reports Consolidated**: `16` (`S01.md`–`S16.md` in [`docs/audit/seo/findings/`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/findings/))
- **Raw Findings Deduplicated**: **`88` raw findings** (`8 P0`, `45 P1`, `34 P2`, `1 P3`) → **`31` canonical `SEO-001`..`SEO-031` items** (`6 P0`, `20 P1`, `4 P2`, `1 P3`)

---

## 1. Executive Summary & Quantitative Rollup

### 1.1 Empirical Baseline vs Gate B Target

| # | SEO / GEO Pillar (`nextjs-business-seo-geo-auditor`) | Weight | Pre-Wave-6 Baseline | Post-Wave-6 Target | Root Deficit Fixed in Wave 6 |
| :-: | :--- | :---: | :---: | :---: | :--- |
| 1 | Next.js Technical SEO & Core Web Vitals | `20` | `11.9 / 20` | `>= 19.0 / 20` | Missing `robots.ts`, `sitemap.ts`, `llms.txt`; `/voucher` `X-Robots-Tag` gap; `99.8%` client LOC skew & `HeroSlider` multi-slide LCP contention (`SEO-007`, `SEO-008`, `SEO-011`, `SEO-023`, `SEO-027`) |
| 2 | Meta & CTR Optimization (`50–60`c / `150–160`c / OG) | `15` | `7.4 / 15` | `>= 14.0 / 15` | `0` canonicals, `0` Twitter cards, `680×610` `/logo.jpg` OG image, `/` missing page metadata & static `<h1>`, `www` vs apex split (`SEO-009`, `SEO-010`, `SEO-023`, `SEO-028`) |
| 3 | Business Hub-and-Spoke & `>=50%` Differentiation | `15` | `13.0 / 15` *(false-high: `0` spokes)* | `>= 14.5 / 15` | All 7 commercial verticals trapped on `/#hash`; build 14 genuine hub/spoke routes + dynamic `[slug]` & restricted `lahore`/`karachi`/`islamabad` gateways (`SEO-015`–`SEO-022`) |
| 4 | Entity SEO, NAP Consistency & JSON-LD Schema | `15` | `6.0 / 15` | `>= 14.0 / 15` | `0` JSON-LD blocks, broken local `tel:03274029701` hrefs, `, Pakistan` & Arabic brand drift, `null` `sameAs` defaults, Rich-Results penalty guardrails (`SEO-001`, `SEO-012`, `SEO-014`, `SEO-021`) |
| 5 | AI Search Liftability, Human Substance & GEO | `20` | `10.2 / 20` | `>= 18.0 / 20` | `0` `<table>`/`<ul>` blocks on `/`, missing `/faq` hub, 5 shallow FAQs with hardcoded PKR visa drift, unanswered 6-dimension AI fan-out queries (`SEO-013`, `SEO-022`, `SEO-023`, `SEO-027`) |
| 6 | Internal Linking, Attribution & Funnel Continuity | `15` | `6.0 / 15` | `>= 14.0 / 15` | `16` `/#fragment` nav links, `/admin` link in public footer, `0` breadcrumbs, `0` UTM/landing/referrer columns, broken URL prefill into `CustomJourneyBuilder` (`SEO-003`–`SEO-006`, `SEO-024`, `SEO-025`, `SEO-029`–`SEO-031`) |
| — | **Total Weighted Score** | **`100`** | **`54.5 / 100` (`D`)** | **`>= 90.0 / 100` (`A`)** | **31 canonical items across `W6A` → `W6B` → `W6C`** |

### 1.2 Canonical Triage Distribution by Fixer & Sub-Wave

| Fixer ID | Sub-Wave | Execution Mode | `P0` | `P1` | `P2` | `P3` | Canonical Items (`SEO-ID`) | Raw Findings Covered |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`F-SEO-PLAT`** | **Wave 6A** | Serialized Foundation *(merges before W6B forks)* | `3` | `8` | `1` | `0` | `12` (`SEO-001`–`003`, `007`–`014`, `027`) | `36` |
| **`F-SEO-UMRAH`** | **Wave 6B** | Parallel (`workspace: "share"`) | `0` | `2` | `0` | `0` | `2` (`SEO-015`, `SEO-016`) | `5` |
| **`F-SEO-GUIDES`** | **Wave 6B** | Parallel (`workspace: "share"`) | `0` | `4` | `0` | `0` | `4` (`SEO-017`–`SEO-020`) | `5` |
| **`F-SEO-TRUST`** | **Wave 6B** | Parallel (`workspace: "share"`) | `0` | `3` | `1` | `0` | `4` (`SEO-021`–`SEO-023`, `SEO-028`) | `17` |
| **`F-SEO-SHELL`** | **Wave 6B** | Parallel (`workspace: "share"`) | `3` | `2` | `2` | `1` | `8` (`SEO-004`–`006`, `024`, `025`, `029`–`031`) | `24` |
| **`F-SEO-QA`** | **Wave 6C** | Serialized Post-Merge Verification | `0` | `1` | `0` | `0` | `1` (`SEO-026`) | `1` |
| **Total** | **`W6A–W6C`** | **Zero File Collisions** | **`6`** | **`20`** | **`4`** | **`1`** | **`31` Canonical Items** | **`88` / `88` (`100%`)** |

---

## 2. Binding Architectural & Domain Resolutions (Cross-Report Arbitrations)

1. **Canonical Hostname (`S02-002` vs `S15-007` / `brand.ts`) — Standardize on Apex `https://alramlahtravels.com`**:
   - `lib/env.ts:223`, `Dockerfile:21`, and `app/actions/quotes.ts:2118` already standardize on apex `https://alramlahtravels.com`, and zero Gate A tests assert `www.alramlahtravels.com`.
   - `F-SEO-PLAT` updates `BRAND_WEBSITE_URL = "https://alramlahtravels.com"` / `BRAND_WEBSITE_DOMAIN = "alramlahtravels.com"` in `lib/constants/brand.ts`, exposes `getCanonicalSiteUrl()` in `lib/seo/metadata.ts`, and adds permanent `308`/`301` host redirects from `www.alramlahtravels.com` to `https://alramlahtravels.com` in `next.config.ts` and `nginx/nginx.conf`.
2. **Volatile Wholesale SAR Tariffs (`S08-001` vs `S15-002` — Haramain Invariant #2 & #8 Lock)**:
   - `hotels` (`sharingPriceSar`, `roomPriceSar`, `quadPriceSar`, `triplePriceSar`, `doublePriceSar`) and `vehicles` (`defaultRateSar`, `ziyaratRateSar`) store internal wholesale SAR benchmarks.
   - Public pages (`/`, `/hotels/makkah`, `/hotels/madinah`, `/ziyarat/**`, `/umrah-packages/from-[city]`) and JSON-LD builders **MUST NEVER** expose wholesale SAR columns or render fixed PKR hotel/transport rates. `F-SEO-PLAT` strips all internal SAR columns in `lib/seo/public-queries.ts`, and spoke cards/JSON-LD display `"Live Rate — Confirmed upon submission"`. Fixed PKR prices are permitted **only** on: (a) `/umrah-visa` standalone Without-Masar visa tiers, and (b) published `groupPackages` / `groupDepartures` fixed batch room tiers where `price > 0` (`price <= 0` renders `"On Request"` per `OD-09b`).
3. **AI Crawler Governance (`S01-003` Owner Resolution)**:
   - In `app/robots.ts`, explicitly **ALLOW** all AI search/citation and user-grounding agents (`OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `Claude-SearchBot`, `Claude-User`, `Google-Extended`, `Applebot-Extended`) on public routes while disallowing `["/admin/", "/api/", "/voucher/", "/quote/"]`. Separate bulk foundation-training scrapers (`GPTBot`, `ClaudeBot`, `CCBot`, `Bytespider`) into a toggleable rule group (`ALLOW_AI_TRAINING_BOTS`, defaulting to disallow `CCBot`/`Bytespider` and allow/restrict `GPTBot`/`ClaudeBot` cleanly on `/admin/`, `/api/`, `/voucher/`, `/quote/`).
4. **Doorway-Page Prevention on City Spokes (`S05-005`)**:
   - `/umrah-packages/from-[city]` sets `export const dynamicParams = false` and restricts `generateStaticParams()` strictly to the **3 gateway cities with active inventory and genuinely distinct airport/airline logistics**: `lahore` (`LHE`), `karachi` (`KHI`), and `islamabad` (`ISB`). Zero thin doorway routes may be generated for unseeded secondary cities (`PEW`, `MUX`, `SKT`, `LYP`, `UET`).
5. **Real On-Disk Action & Schema Disambiguation**:
   - `groupPackages.slug` and `hajjPackages.slug` **already exist** as `notNull().unique()` in `db/schema/packages.ts`. Only the 7 nullable attribution columns on `applications` and `contact_messages` require an additive migration (`drizzle/0003_seo_lead_attribution.sql`).
   - Public lead Server Actions live in `app/actions/applications.ts` (`submitCustomApplication`, `submitGroupBookingApplication`, `submitHajjInquiryApplication`, `submitPublicContactInquiryAction`), `app/actions/groups.ts`, and `app/actions/cms.ts` (`submitContactMessage` legacy wrapper) — there are no standalone `app/actions/hajj.ts` or `app/actions/contact.ts` files.

---

## 3. Master Canonical Triage Backlog (`SEO-001` – `SEO-031`)

### 3.1 `P0` — Gate B Release Blockers (`SEO-001` – `SEO-006`)

#### `SEO-001` — XSS-Safe JSON-LD Builder Library & Rich-Results Penalty Guardrails (`OD-08`, `OD-09`, `OD-10`)
- **Severity**: `P0` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S09-001`, `S09-002`, `S09-003`, `S16-001`, `S16-002`
- **Target Files**: `lib/seo/json-ld.ts` *(new)*
- **Concrete Fix**: Author `serializeJsonLd()` (escaping `<` → `\u003c`, `>` → `\u003e`, `&` → `\u0026`, `\u2028`, `\u2029`), `<JsonLd />` Server Component, and typed builders (`buildTravelAgencyJsonLd`, `buildWebSiteJsonLd`, `buildBreadcrumbJsonLd`, `buildFaqPageJsonLd`, `buildUmrahPackageJsonLd`, `buildHajjServiceJsonLd`, `buildHotelItemListJsonLd`, `buildTouristAttractionListJsonLd`). Enforce structural Rich-Results safety: **zero** `AggregateRating`/`Review` emission while verified review count is `0`; filter `price > 0` before computing `AggregateOffer` (`OD-09b`); omit `Offer.price` on volatile hotel/transport/ziyarat entities; represent `/hajj-2027` as indicative pre-registration `Service` without false `InStock` commercial checkout claims (`OD-09e`); omit unverified license `identifier` entries when `null` (`OD-10`).
- **Red→Green Test**: `tests/w6/f-seo-plat/json-ld.test.ts` verifying `</script><script>alert(1)` neutralization, schema validity, zero `AggregateRating`, and `0`-tier price exclusion.

#### `SEO-002` — Public Catalog DTO Projection & Internal Wholesale SAR Tariff Stripping
- **Severity**: `P0` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S15-002`
- **Target Files**: `lib/seo/public-queries.ts` *(new)*
- **Concrete Fix**: Centralize cached public server queries (`getPublicHotelsCatalog`, `getPublicVehiclesCatalog`, `getPublicZiyaratCatalog`, `getPublicGroupPackages`, `getPublicGroupPackageBySlug`, `getPublicHajjPackages`, `getPublicVisaRates`, `getPublicFaqs`) that explicitly omit internal wholesale SAR columns (`sharingPriceSar`, `roomPriceSar`, `quadPriceSar`, `triplePriceSar`, `doublePriceSar`, `breakfastPriceSarPerPax`, `lunchPriceSarPerPax`, `dinnerPriceSarPerPax`, `fullBoardPriceSarPerPax`, `defaultRateSar`, `ziyaratRateSar`, `updatedByUserId`) before returning data to RSC pages or client props.
- **Red→Green Test**: `tests/w6/f-seo-plat/public-queries-confidentiality.test.ts` asserting returned hotel/vehicle DTOs contain zero `*Sar` rate keys.

#### `SEO-003` — Additive 7-Column Web Attribution Schema, SQL Migration & Sanitizer (`lib/seo/utm.ts`)
- **Severity**: `P0` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S14-001`
- **Target Files**: `db/schema/applications.ts`, `db/schema/cms.ts`, `drizzle/0003_seo_lead_attribution.sql` *(new)*, `drizzle/meta/*`, `lib/seo/utm.ts` *(new)*
- **Concrete Fix**: Add nullable `utmSource` (`varchar(120)`), `utmMedium` (`varchar(120)`), `utmCampaign` (`varchar(160)`), `utmContent` (`varchar(160)`), `utmTerm` (`varchar(160)`), `landingPage` (`text`), and `httpReferrer` (`text`) + B-tree indexes (`idx_applications_utm_source_campaign`, `idx_contact_messages_utm_source`) to `applications` and `contactMessages` via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Author `lib/seo/utm.ts` exporting `UTM_STORAGE_KEY = "alramlah_attribution_v1"`, `strictAttributionSchema`, `sanitizeAttributionInput()` (rejecting non-`/` or `//` `landingPage`, stripping control chars & URL credentials, capping at `512` chars), `readStoredAttribution()`, `captureFirstTouchAttribution()`, `inferAcquisitionChannel()`, and `formatWhatsAppAttributionSuffix()`.
- **Red→Green Test**: `tests/w6/f-seo-plat/utm-schema-and-sanitizer.test.ts` testing control-char stripping, `javascript:` / `//evil.com` rejection, credential stripping on `httpReferrer`, and Drizzle column metadata.

#### `SEO-004` — Client First-Touch `<UtmTracker />` & End-to-End Attribution Wiring Across All 4 Public Lead Funnels
- **Severity**: `P0` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-SHELL`
- **Source Finding IDs**: `S14-002`, `S14-003`
- **Target Files**: `components/seo/utm-tracker.tsx` *(new)*, `app/(public)/layout.tsx`, `lib/validations/application.ts`, `lib/validations/cms.ts`, `app/actions/applications.ts`, `app/actions/groups.ts`, `components/planner/lead-capture-dialog.tsx`, `components/planner/review-and-submit-step.tsx`, `components/public/group-booking-modal.tsx`, `components/public/hajj-inquiry-section.tsx`, `components/public/contact-section.tsx`
- **Concrete Fix**: Mount `<Suspense fallback={null}><UtmTracker /></Suspense>` inside `app/(public)/layout.tsx` to lock first-touch `landingPage`, external `httpReferrer`, and `utm_*` into `sessionStorage["alramlah_attribution_v1"]` without de-optimizing ISR. Extend `strictCustomApplicationSchema`, `strictGroupBookingSchema`, `strictHajjInquirySchema`, and `strictPublicContactMessageSchema` with `attribution: strictAttributionSchema.optional()`, attach `readStoredAttribution()` in all 5 client submit handlers, and persist all 7 columns in `submitCustomApplication`, `submitGroupBookingApplication`, `submitHajjInquiryApplication`, and `submitPublicContactInquiryAction`.
- **Red→Green Test**: `tests/w6/f-seo-shell/utm-attribution-actions.test.ts` verifying first-touch lock across internal route transitions and sanitized persistence in all 4 Server Actions.

#### `SEO-005` — Crawlable Sitewide Navigation Graph (`PublicHeader`, `PublicFooter` & Homepage Contextual `<Link>` Edges)
- **Severity**: `P0` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-SHELL`
- **Source Finding IDs**: `S05-002`, `S13-001`, `S13-002`, `S13-005`
- **Target Files**: `components/layout/public-header.tsx`, `components/layout/public-footer.tsx`, `components/public/group-packages-section.tsx`, `components/public/hajj-inquiry-section.tsx`
- **Concrete Fix**: Replace `/#fragment` commercial links in `PublicHeader` and `PublicFooter` with crawlable App Router `<Link>` paths (`/umrah-packages`, `/umrah-packages/from-lahore`, `/umrah-packages/from-karachi`, `/umrah-packages/from-islamabad`, `/umrah-visa`, `/hajj-2027`, `/hotels/makkah`, `/hotels/madinah`, `/ziyarat`, `/faq`, `/about`, `/contact`), retaining `/#journey-builder` and `/#track-status` strictly for interactive homepage tools. Remove `<Link href="/admin">Staff Operations Portal</Link>` and replace external `www.alramlahtravels.com` `target="_blank"` anchor with `<Link href="/">alramlahtravels.com</Link>`. Add `<Link href="/umrah-packages/${pkg.slug}">` card links and city/hub links in `GroupPackagesSection` and `/hajj-2027` link in `HajjInquirySection`.
- **Red→Green Test**: `tests/w6/f-seo-shell/navigation-link-graph.test.tsx` asserting zero `/admin` or `www.` self-links in `PublicFooter`, crawlable hub links in header/footer, and `[slug]` `<Link>` anchors on homepage package cards.

#### `SEO-006` — `<Suspense>`-Safe `PlannerProvider` URL Deep-Link Prefill Winning Over Stale `sessionStorage`
- **Severity**: `P0` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-SHELL`
- **Source Finding IDs**: `S05-004`, `S15-001`
- **Target Files**: `components/planner/planner-context.tsx`, `components/planner/custom-journey-builder.tsx`
- **Concrete Fix**: Implement Zod-validated `<PlannerUrlHydrator />` wrapped in `<Suspense fallback={null}>` supporting `?preset=visa_only|hotels_only|flights_only|complete_umrah`, `?departureCity=LHE|KHI|ISB`, `?citySequence=makkah_madinah|madinah_makkah|makkah_only`, `?hotelId=<uuid>`, and `?ziyaratCity=both|makkah_only|madinah_only`. Apply URL overrides **after** `sessionStorage` draft restoration while enforcing `JED` entry lock on Makkah-first itineraries, `calculatePrivateRoomSplits()`, `recomputeStays()` seamless date chaining, and smooth scroll to `#journey-builder`. Also dynamically import Wizard Steps 2–6 and `LeadCaptureDialog` (`next/dynamic`) to cut initial client bundle hydration.
- **Red→Green Test**: `tests/w6/f-seo-shell/planner-url-prefill.test.tsx` proving URL params override stale `sessionStorage["alramlah_planner_draft_v1"]` while preserving `JED` lock and PKT dates.

---

### 3.2 `P1` — High-Priority SEO, GEO & Domain Integrity Items (`SEO-007` – `SEO-026`)

#### `SEO-007` — `app/robots.ts` Discovery, Preview Deployment Index-Block & Explicit AI Crawler Governance
- **Severity**: `P1` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S01-001`, `S01-003`
- **Target Files**: `app/robots.ts` *(new)*
- **Concrete Fix**: Implement `app/robots.ts` returning `disallow: "/"` when `VERCEL_ENV` is `"preview"`/`"development"` (non-production preview deployments). In production, allow `"/"` and disallow `["/admin/", "/api/", "/voucher/", "/quote/", "/_next/"]` for `*` and explicitly for AI citation/grounding bots (`OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `Claude-SearchBot`, `Claude-User`, `Google-Extended`, `Applebot-Extended`), disallow `CCBot`/`Bytespider` bulk scrapers, and emit `sitemap: "https://alramlahtravels.com/sitemap.xml"` + `host: "https://alramlahtravels.com"`.
- **Red→Green Test**: `tests/w6/f-seo-plat/robots.test.ts` testing production vs `VERCEL_ENV="preview"` rules and AI search bot allowlists.

#### `SEO-008` — Dynamic `app/sitemap.ts` with 1:1 Route Visibility Parity & Multi-Table `MAX(updatedAt)` Freshness
- **Severity**: `P1` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S01-002`, `S01-005`
- **Target Files**: `app/sitemap.ts` *(new)*, `lib/seo/public-queries.ts`
- **Concrete Fix**: Create `app/sitemap.ts` (`revalidate = 3600`) emitting all 18 static/city/guide public hubs plus active `/umrah-packages/${pkg.slug}` spokes using the exact same visibility predicate as `/umrah-packages/[slug]`. Compute `lastModified = max(groupPackages.updatedAt, max(groupDepartures.updatedAt))` for group packages, city-grouped `MAX(updatedAt)` for `/hotels/{makkah,madinah}` and `/ziyarat/{makkah,madinah}`, `MAX(hajjPackages.updatedAt)` for `/hajj-2027`, deterministic revision dates for static legal routes (never `new Date()` spam), and graceful static-hub fallback when DB is unreachable at build time. Exclude all `/admin/*`, `/api/*`, `/voucher/*`, and `/quote/*` routes.
- **Red→Green Test**: `tests/w6/f-seo-plat/sitemap.test.ts` asserting 1:1 slug parity, `groupDepartures.updatedAt` freshness propagation, and zero private/admin URLs.

#### `SEO-009` — Canonical Apex Host (`https://alramlahtravels.com`), Safe `metadataBase` & `buildPublicMetadata()` Helper
- **Severity**: `P1` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S02-001`, `S02-002`, `S02-003`, `S04-001`, `S04-005`, `S12-001`
- **Target Files**: `lib/seo/metadata.ts` *(new)*, `lib/constants/brand.ts`, `app/layout.tsx`, `next.config.ts`, `nginx/nginx.conf`
- **Concrete Fix**: Standardize `BRAND_WEBSITE_URL` to `https://alramlahtravels.com` in `lib/constants/brand.ts`; add permanent `308`/`301` redirect from `Host: www.alramlahtravels.com` to `https://alramlahtravels.com/:path*` in `next.config.ts` and `nginx/nginx.conf`. Implement `getCanonicalSiteUrl()` (backed by `env.NEXT_PUBLIC_APP_URL`, never leaking `http://localhost:3000` in production builds) and `buildPublicMetadata({ path, title, description, ogImage, ogType })` in `lib/seo/metadata.ts` enforcing self-referencing `alternates.canonical`, `openGraph` (`locale: "en_PK"`, `siteName: "Al Ramlah Travels"`, `1200×630` image), `twitter` (`card: "summary_large_image"`), and `robots.googleBot` (`max-image-preview: "large"`, `max-snippet: -1`, `max-video-preview: -1`). Update `app/layout.tsx` (`title.default` `55`c, `title.template: "%s | Al Ramlah Travels"`, `description` `154`c, remove obsolete `keywords`).
- **Red→Green Test**: `tests/w6/f-seo-plat/metadata-helper.test.ts` verifying `getCanonicalSiteUrl()`, canonical stripping of `?`/`#`, `50–60`c / `150–160`c root lengths, `en_PK` locale, Twitter card, and `www` redirect config.

#### `SEO-010` — Dynamic `1200×630` Luxury Haramain OpenGraph Card (`app/opengraph-image.tsx`)
- **Severity**: `P1` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S04-004`, `S04-006`
- **Target Files**: `app/opengraph-image.tsx` *(new)*, `lib/seo/og-card.tsx` *(new)*
- **Concrete Fix**: Build `renderLuxuryOgCard()` in `lib/seo/og-card.tsx` (`next/og` `ImageResponse`, `1200×630` PNG) styled in Deep Haramain Emerald (`#0A3622`), Metallic Gold (`#C5A059`), and Warm Ivory (`#FAF7F0`), and expose root `app/opengraph-image.tsx` (`size = { width: 1200, height: 630 }`, `contentType = "image/png"`), replacing `680×610` `/logo.jpg` across all `openGraph.images` and `twitter.images`.
- **Red→Green Test**: `tests/w6/f-seo-plat/opengraph-image.test.ts` asserting PNG `200 OK` response and `1200×630` metadata contract with zero `/logo.jpg` OG references.

#### `SEO-011` — Dual-Layer `noindex` Defense, Locked Voucher HTTP `403` (`forbidden()`) & `/admin/social` `308` Redirect
- **Severity**: `P1` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S02-004`, `S02-005`, `S16-004`
- **Target Files**: `proxy.ts`, `app/admin/layout.tsx` *(new)*, `app/(public)/voucher/[token]/page.tsx`, `app/(public)/voucher/[token]/forbidden.tsx` *(new)*, `next.config.ts`
- **Concrete Fix**: Expand `proxy.ts` to emit `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` on `/admin/*`, `/api/*`, `/voucher/*`, and `/quote/*`. Add `app/admin/layout.tsx` setting `robots: { index: false, follow: false, nocache: true }`. Enable `experimental.authInterrupts: true` and `/admin/social` → `/admin/campaigns?tab=social` (`permanent: true`) in `next.config.ts`, and invoke `forbidden()` in `app/(public)/voucher/[token]/page.tsx` with `forbidden.tsx` rendering the luxury locked-voucher UI at genuine **HTTP `403`**.
- **Red→Green Test**: `tests/w6/f-seo-plat/noindex-and-status.test.ts` asserting `X-Robots-Tag` on `/voucher/*` & `/quote/*`, `app/admin/layout.tsx` `robots.index === false`, `/admin/social` `308` redirect, and locked voucher `forbidden()` invocation.

#### `SEO-012` — Canonical NAP, E.164 `tel:` Links, Arabic Brand Sync, Deterministic `formatPkr()`, Cached `agencySettings` & Studio Slugs
- **Severity**: `P1` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S03-003`, `S06-004`, `S08-005`, `S10-002`, `S10-003`, `S10-004`, `S12-002`, `S12-003`, `S16-006`
- **Target Files**: `lib/company-info.ts`, `components/public/public-utils.ts`, `components/public/arabic-text.tsx`, `lib/seo/slugs.ts` *(new)*, `lib/seo/revalidate-public.ts` *(new)*, `app/actions/catalog.ts`, `app/actions/marketing-ops.ts`
- **Concrete Fix**: Sync `DEFAULT_OFFICE_ADDRESS` in `lib/company-info.ts` to include `, Pakistan`, populate `BRAND_SOCIAL_URLS` as non-null defaults when DB social links are empty, add `toTelHref()` (`tel:+923274029701` E.164) + `formatPkPhoneDisplay()` (`+92 327 4029701`), and wrap `getCachedCompanyInfo()` in `React.cache()` with try/catch fallback. Standardize `formatPkr()` (`PKR 295,000` deterministic `en-PK`/ASCII grouping preventing React `#418` hydration mismatches) in `public-utils.ts` and `dir="rtl"`/`scriptLang` isolation in `arabic-text.tsx`. Create `buildSemanticPackageSlug()` in `lib/seo/slugs.ts` (appending short suffix at end instead of `art-...` prefix in `marketing-ops.ts`) and `revalidatePublicSeoPaths()` in `lib/seo/revalidate-public.ts` wired into `app/actions/catalog.ts` and `marketing-ops.ts`.
- **Red→Green Test**: `tests/w6/f-seo-plat/nap-and-slugs.test.ts` asserting E.164 `tel:` conversion, exact `BRAND_OFFICE_ADDRESS` match, `BRAND_ARABIC_NAME` (`سفريات الرملة`), `formatPkr()`, and semantic Studio slug generation.

#### `SEO-013` — Idempotent `db/seed.ts` Rolling PKT Horizon Refresh (Departures, `Maktab C`, `hotels.validUntil`, Distinct Media & FAQs)
- **Severity**: `P1` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S06-003`, `S07-004`, `S08-002`, `S08-004`, `S16-003`
- **Target Files**: `db/seed.ts`
- **Concrete Fix**: Replace hardcoded past/cliff dates in `db/seed.ts` with deterministic rolling future PKT offsets (`today + 30d..180d` for `groupDepartures` across all 4 seeded packages `pkg1`–`pkg4` covering `LHE`, `KHI`, and `ISB` with open seats; rolling `validUntil` `today + 400d` on all 18 `hotels`). Seed active `hajjPackages` rows covering `Maktab A+`, `Maktab A`, `Maktab B`, and `Maktab C` with `HAJJ_2027_REGULATORY_DISCLAIMER`. Deduplicate stock URLs (fixing Masjid Quba's hotel-bedroom URL), expand seeded Ziyarat descriptions and FAQs (`12+` comprehensive Q&As without hardcoded stale visa PKR figures), and canonicalize social URLs in `agencySettings` seed — keeping `2× npm run db:seed` 100% idempotent.
- **Red→Green Test**: `tests/w6/f-seo-plat/seed-horizon.test.ts` verifying future PKT departure dates across `LHE`/`KHI`/`ISB`, `pkg3` departure coverage, `Maktab C` presence, and `hotels.validUntil > today`.

#### `SEO-014` — Shared `<PublicBreadcrumbs />` (`components/layout/breadcrumbs.tsx`) Synchronized 1:1 with `BreadcrumbList` JSON-LD
- **Severity**: `P1` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S09-005`, `S13-004`
- **Target Files**: `components/layout/breadcrumbs.tsx` *(new)*
- **Concrete Fix**: Create Server Component `<PublicBreadcrumbs items={...} />` wrapping `components/ui/breadcrumb.tsx` via Base UI `render={<Link href={item.href} />}` prop composition (never Radix `asChild`) and rendering `<JsonLd data={buildBreadcrumbJsonLd(items)} />` in lockstep so all Wave 6B spoke fixers (`F-SEO-UMRAH`, `F-SEO-GUIDES`, `F-SEO-TRUST`) can import `<PublicBreadcrumbs />` immediately with zero cross-branch coupling.
- **Red→Green Test**: `tests/w6/f-seo-plat/breadcrumbs.test.tsx` asserting `<nav aria-label="breadcrumb">`, `aria-current="page"`, and 1-indexed `BreadcrumbList` JSON-LD URLs.

#### `SEO-015` — Dedicated `/umrah-packages` Hub & Dynamic `/umrah-packages/[slug]` Spokes (+ Per-Package `1200×630` OG Image)
- **Severity**: `P1` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-UMRAH`
- **Source Finding IDs**: `S05-001`, `S06-001`, `S15-004`
- **Target Files**: `app/(public)/umrah-packages/page.tsx` *(new)*, `app/(public)/umrah-packages/[slug]/page.tsx` *(new)*, `app/(public)/umrah-packages/[slug]/opengraph-image.tsx` *(new)*, `components/seo/umrah-*.tsx` *(new)*
- **Concrete Fix**: Build RSC `/umrah-packages` catalog hub (semantic tier comparison `<table>`, gateway city links, live batch cards) and `/umrah-packages/[slug]` (`generateStaticParams` + Next.js 16 `await params`, `revalidate = 300`, `notFound()` on unknown/inactive slugs). Render answer-first summary, Sharing/Quad/Triple/Double + `infantPricePkr` (`OD-09d`) tariff table guarding `price <= 0` as `"On Request"` (`OD-09b`) across both base tiers and `multiHotelOptions`, Makkah/Madinah hotel distances, standalone `UmrahPackageBookingCta` client island mounting `GroupBookingModal`, `<PublicBreadcrumbs />`, `TouristTrip` + `AggregateOffer` JSON-LD (excluding `<= 0` prices), and dynamic `[slug]/opengraph-image.tsx` via `renderLuxuryOgCard()`.
- **Red→Green Test**: `tests/w6/f-seo-umrah/umrah-hub-and-slug.test.tsx` testing metadata (`50–60`c / `150–160`c), `TouristTrip` JSON-LD, `0`-tier `"On Request"` invariant, infant price display, and `404` on inactive slug.

#### `SEO-016` — High-Differentiation (`>=50%`) Pakistani Departure Gateway Spokes (`/umrah-packages/from-[city]`)
- **Severity**: `P1` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-UMRAH`
- **Source Finding IDs**: `S05-005`, `S06-002`
- **Target Files**: `app/(public)/umrah-packages/from-[city]/page.tsx` *(new)*, `components/seo/umrah-city-gateway-data.ts` *(new)*
- **Concrete Fix**: Implement `/umrah-packages/from-[city]` with `export const dynamicParams = false` and `generateStaticParams()` strictly locked to `[{ city: "lahore" }, { city: "karachi" }, { city: "islamabad" }]` (returning `404` for `from-peshawar`, `from-multan`, etc.). Author `>=50%` genuinely differentiated gateway content per city: airport terminal/check-in guidance (`Allama Iqbal Int'l LHE`, `Jinnah Int'l KHI`, `Islamabad Int'l ISB`), direct vs 1-stop airline routing tables (`Saudia`, `PIA`, `Airblue`, `SereneAir`, `Qatar`, `Emirates`) into `JED` (with Makkah ground transfer explanation) & `MED`, filtered live `groupDepartures` for that IATA code, city-specific FAQs (`FAQPage` JSON-LD), sibling city links, and `/?preset=complete_umrah&departureCity=LHE|KHI|ISB#journey-builder` CTA.
- **Red→Green Test**: `tests/w6/f-seo-umrah/umrah-city-spokes.test.tsx` asserting `dynamicParams === false`, `>=50%` token shingle differentiation across `lahore`/`karachi`/`islamabad`, and city-filtered batch rendering.

#### `SEO-017` — Dedicated `/hajj-2027` Pre-Registration Hub (`OD-09e` Indicative Tiers & Maktab Comparison)
- **Severity**: `P1` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-GUIDES`
- **Source Finding IDs**: `S07-001`, `S15-005`
- **Target Files**: `app/(public)/hajj-2027/page.tsx` *(new)*, `components/seo/guides-hajj-*.tsx` *(new)*
- **Concrete Fix**: Build RSC `/hajj-2027` (`revalidate = 300`) backed by `getPublicHajjPackages()`. Render answer-first Hajj 2027 overview, server-rendered Maktab `A+` / `A` / `B` / `C` comparison `<table>` (Mina camp zone, Jamaraat proximity, Aziziya vs Shifting vs Non-Shifting structure, indicative PKR estimate badges), 6-document readiness `<ul>` for Pakistani & overseas NICOP/dual-national pilgrims, prominent `HAJJ_2027_REGULATORY_DISCLAIMER` (`OD-09e`), `<HajjInquirySection packages={hajjPackages} />` (`"Pre-Register Indicative Interest"`), `<PublicBreadcrumbs />`, and `Service` + `FAQPage` JSON-LD (zero false `InStock` checkout claims).
- **Red→Green Test**: `tests/w6/f-seo-guides/hajj-2027.test.tsx` asserting `HAJJ_2027_REGULATORY_DISCLAIMER`, `"Indicative"` badges, Maktab `<table>`, and empty-DB safe fallback.

#### `SEO-018` — Dedicated `/umrah-visa` Authority, Live PKR Pricing & Nusuk Masar Guide
- **Severity**: `P1` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-GUIDES`
- **Source Finding IDs**: `S07-003`
- **Target Files**: `app/(public)/umrah-visa/page.tsx` *(new)*, `components/seo/guides-visa-*.tsx` *(new)*
- **Concrete Fix**: Build RSC `/umrah-visa` (`revalidate = 300`) powered by `getPublicVisaRates()`. Render live standalone Without-Masar PKR tariff `<table>` (`<=30` inclusive days `short_term` vs `31–90` days `long_term`), clear explanation of server-side KSA Arrival/Departure tier calculation (Invariant #1 — mandatory dates even on `Visa Only` per `OD-09c`), hotel-linked Nusuk Masar rules, Saudi Visa Bio app & meningitis/polio vaccination checklist for Pakistani MRP & diaspora passports, `/?preset=visa_only#journey-builder` primary CTA, `<PublicBreadcrumbs />`, and `Service` + `FAQPage` JSON-LD.
- **Red→Green Test**: `tests/w6/f-seo-guides/umrah-visa.test.tsx` asserting live `visa_rates` PKR rendering, mandatory KSA dates rule, and `/?preset=visa_only#journey-builder` CTA.

#### `SEO-019` — Haramain Hospitality Spokes (`/hotels/makkah`, `/hotels/madinah`) with Walking-Distance Tables & Volatile Rate Lock
- **Severity**: `P1` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-GUIDES`
- **Source Finding IDs**: `S08-001`
- **Target Files**: `app/(public)/hotels/[city]/page.tsx` *(new)*, `components/seo/guides-hotels-*.tsx` *(new)*
- **Concrete Fix**: Implement `/hotels/[city]` (`dynamicParams = false`, `generateStaticParams` for `makkah` and `madinah`, `revalidate = 300`) reading wholesale-stripped `getPublicHotelsCatalog(city)`. Render `>=50%` differentiated city guidance: Makkah (`0m` Clock Tower / Ajyad / Ibrahim Al Khalil / Kudai shuttle zones + `JED` entry transfer notice + wheelchair access gates) vs Madinah (Northern/Southern Markaziyah proximity to Ladies' Gate 25 & Riyadh ul Jannah Nusuk permit tips), semantic `<table>` comparing hotel stars, distance in meters, shuttle/walk status, and `availableRoomTypes` (`Quad`/`Triple`/`Double`/Sharing), strict `"Live Rate — Confirmed upon submission"` badges (zero SAR/PKR hotel numbers in JSX or `ItemList`/`LodgingBusiness` JSON-LD!), and per-hotel `/?preset=complete_umrah&citySequence=...&hotelId=<id>#journey-builder` deep links.
- **Red→Green Test**: `tests/w6/f-seo-guides/hotels-spokes.test.tsx` asserting zero SAR/PKR numeric prices in HTML/JSON-LD, `"Live Rate — Confirmed upon submission"` presence, and `>=50%` Makkah vs Madinah differentiation.

#### `SEO-020` — Sacred Ziyarat Hub & City Spokes (`/ziyarat`, `/ziyarat/makkah`, `/ziyarat/madinah`)
- **Severity**: `P1` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-GUIDES`
- **Source Finding IDs**: `S08-003`
- **Target Files**: `app/(public)/ziyarat/page.tsx` *(new)*, `app/(public)/ziyarat/[city]/page.tsx` *(new)*, `components/seo/guides-ziyarat-*.tsx` *(new)*
- **Concrete Fix**: Build `/ziyarat` overview hub plus `/ziyarat/makkah` and `/ziyarat/madinah` (`dynamicParams = false`, `revalidate = 300`) rendering unclamped historical/spiritual landmark profiles from `getPublicZiyaratCatalog()`, intercity Badr & Taif excursion advisories, private Ziyarat vehicle capacity `<table>` (`1–3` Sedan, `4–6` SUV GMC Yukon, `7–12` Staria/HiAce/Coaster, `13+` Coach Bus; clarifying Haramain High-Speed Train is point-to-point `shared_only` and never a Ziyarat touring vehicle per Invariant #6, with `"Live Rate — Confirmed upon submission"`), `ItemList`/`TouristAttraction` JSON-LD, `<PublicBreadcrumbs />`, and `/?preset=complete_umrah&ziyaratCity=...#journey-builder` CTAs.
- **Red→Green Test**: `tests/w6/f-seo-guides/ziyarat-spokes.test.tsx` verifying unclamped landmark descriptions, fleet capacity bands, zero fixed vehicle SAR/PKR rates, and valid `ItemList` JSON-LD.

#### `SEO-021` — Standalone `/about` (E-E-A-T Entity Hub) & `/contact` (Askari 10 Lahore Local NAP Hub)
- **Severity**: `P1` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-TRUST`
- **Source Finding IDs**: `S10-001`, `S10-005`
- **Target Files**: `app/(public)/about/page.tsx` *(new)*, `app/(public)/contact/page.tsx` *(new)*, `components/seo/trust-eeat-*.tsx` *(new)*
- **Concrete Fix**: Build `/about` (Al Ramlah Travels `سفريات الرملة` heritage, Askari 10 Lahore Cantt operations desk, KSA ground-handling model, 9 pilgrim protection commitments, and `OD-10` truthful licensing block rendering DTS/MoRA/IATA/NTN numbers dynamically when verified in `agencySettings` and omitting unverified claims) and `/contact` (exact canonical NAP `Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan`, E.164 `tel:` links, PKT working hours table, Airport Road / Cantt directions, `<ContactSection settings={companyInfo} />`, `<PublicBreadcrumbs />`, and `TravelAgency` JSON-LD).
- **Red→Green Test**: `tests/w6/f-seo-trust/about-and-contact.test.tsx` asserting exact Askari 10 NAP parity, E.164 `tel:` links, `OD-10` null-license safety, and `TravelAgency` JSON-LD.

#### `SEO-022` — Standalone `/faq` GEO Hub & 6-Dimension AI Fan-Out / Operational Advisory Content
- **Severity**: `P1` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-TRUST`
- **Source Finding IDs**: `S09-004`, `S11-002`, `S11-004`, `S11-005`
- **Target Files**: `app/(public)/faq/page.tsx` *(new)*, `components/seo/trust-faq-*.tsx` *(new)*
- **Concrete Fix**: Build RSC `/faq` (`revalidate = 300`) combining live `getPublicFaqs()` with structured 6-dimension AI fan-out & expert operational advisories (cost transparency, `<=30d` vs `>30d` KSA visa calculation, `JED` Makkah transfer logistics, infant `0`-bed/`0`-seat vs visa/ticket rules, UK/USA/Canada/UAE diaspora dual-passport & NICOP handling, elderly wheelchair/buggy & Nusuk Rawdah permit guidance) rendered in crawlable semantic HTML (`<details>/<summary>` or open RSC sections — never hidden behind unmounted client state) with **1:1 synchronized `FAQPage` JSON-LD** and live `visa_rates` interpolation so prose never contradicts DB tariffs.
- **Red→Green Test**: `tests/w6/f-seo-trust/faq-hub.test.tsx` asserting 1:1 question/answer parity between visible HTML and `FAQPage` JSON-LD and zero stale hardcoded PKR visa drift.

#### `SEO-023` — Homepage (`app/(public)/page.tsx`, `HeroSlider`, `MarketingSections`) SEO/GEO, RSC & LCP Overhaul
- **Severity**: `P1` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-TRUST`
- **Source Finding IDs**: `S03-001`, `S03-002`, `S04-002`, `S05-003`, `S11-001`, `S11-003`, `S12-004`, `S13-003`
- **Target Files**: `app/(public)/page.tsx`, `components/public/hero-slider.tsx`, `components/public/marketing-sections.tsx`, `components/public/faq-accordion-client.tsx` *(new)*, `components/seo/trust-home-overview.tsx` *(new)*
- **Concrete Fix**:
  1. In `app/(public)/page.tsx`: export explicit `metadata` via `buildPublicMetadata({ path: "/" })`, emit `TravelAgency` + `WebSite` + `FAQPage` JSON-LD, switch DB loaders to wholesale-stripped `lib/seo/public-queries.ts` DTOs (slashing RSC Flight payload), and render `MarketingSections` directly as a Server Component with fixed-height skeletons on remaining dynamic sections.
  2. In `components/public/hero-slider.tsx`: render a stable, non-rotating semantic `<h1>` containing `"Umrah Packages"`, `"Hajj 2027"`, and `"Pakistan"` (converting rotating slide headlines to `<p>`/`<h2>` display elements), replace deprecated Next.js 16 `priority` with `preload` on Slide `0` only while lazily mounting slides `1..N` after hydration, remove unverified `"15,000+"` badge (`OD-10`), and normalize `#custom-builder` → `/#journey-builder`.
  3. Convert `components/public/marketing-sections.tsx` into a zero-JS Server Component (isolating the FAQ `<Accordion>` into `faq-accordion-client.tsx`), add `id="faq" scroll-mt-20`, upgrade luxury-only headings with Pakistani/diaspora search intent keywords, add semantic service comparison `<table>` + `<ul>` answer-first blocks (`trust-home-overview.tsx`), and add contextual `<Link>` edges to `/umrah-packages`, `/umrah-packages/from-{lahore,karachi,islamabad}`, `/umrah-visa`, `/hajj-2027`, `/hotels/{makkah,madinah}`, `/ziyarat`, `/about`, and `/faq`.
- **Red→Green Test**: `tests/w6/f-seo-trust/homepage-seo-lcp.test.tsx` verifying `/` metadata, single stable `<h1>`, single initial `<img>` in `HeroSlider` without deprecated `priority`, zero `"use client"` on `MarketingSections`, `id="faq"`, semantic `<table>`/`<ul>`, and zero `"15,000+"` text.

#### `SEO-024` — Hardened `submitContactMessage` Delegation & Group/CMS Public Revalidation Wiring
- **Severity**: `P1` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-SHELL`
- **Source Finding IDs**: `S06-005`, `S14-004`
- **Target Files**: `app/actions/cms.ts`, `app/actions/groups.ts`
- **Concrete Fix**: Delegate `submitContactMessage` in `app/actions/cms.ts` directly to `submitPublicContactInquiryAction` (`app/actions/applications.ts`) so rate limiting, honeypot protection, E.164 phone normalization, and 7-column UTM attribution apply uniformly regardless of caller. Wire `revalidatePublicSeoPaths()` into `app/actions/groups.ts` (package/departure mutations + preserve existing `slug` on edits unless explicitly requested) and `app/actions/cms.ts` (FAQ/Hero/Testimonial mutations).
- **Red→Green Test**: `tests/w6/f-seo-shell/contact-and-groups-actions.test.ts` verifying `submitContactMessage` enforces honeypot + attribution parity and `groups.ts` invokes `revalidatePublicSeoPaths()`.

#### `SEO-025` — `HajjInquirySection` `Maktab A+` Preservation & Admin Attribution UI / Formula-Safe CSV Export
- **Severity**: `P1` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-SHELL`
- **Source Finding IDs**: `S07-002`, `S14-005`
- **Target Files**: `components/public/hajj-inquiry-section.tsx`, `components/admin/applications/application-dossier.tsx`, `app/admin/(dashboard)/applications/[id]/page.tsx`, `components/admin/catalog/messages-client.tsx`, `app/admin/(dashboard)/catalog/page.tsx`, `app/actions/quotes.ts`
- **Concrete Fix**: Fix `coerceMaktabCode()` in `hajj-inquiry-section.tsx` so `"A+"` is preserved distinctly from `"A"` (and treat explicit `packages = []` as closed rather than resurrecting hardcoded `HAJJ_PACKAGES`). Surface **"Acquisition & Attribution"** badges (`utmSource`, `utmMedium`, `utmCampaign`, `landingPage`, `httpReferrer` + inferred AI/Organic channel via `inferAcquisitionChannel()`) in `ApplicationDossier` and `MessagesClient`. Append the 7 attribution columns to `exportApplicationsCsvAction` in `app/actions/quotes.ts` wrapped in `sanitizeCsvCellInternal()`.
- **Red→Green Test**: `tests/w6/f-seo-shell/admin-attribution-and-maktab.test.tsx` verifying `"A+"` preservation, dossier attribution badges, and CSV formula-injection neutralization (`"=CMD..."` → `"'=CMD..."`).

#### `SEO-026` — 3-Layer Automated SEO, Schema, Differentiation & Attribution Gate B Test Suite
- **Severity**: `P1` | **Sub-Wave**: `Wave 6C` | **Owner**: `F-SEO-QA`
- **Source Finding IDs**: `S16-005`
- **Target Files**: `tests/seo/**` *(new)*, `tests/integration/seo-utm-attribution.integration.test.ts` *(new)*, `tests/e2e/j23-seo-crawl-and-attribution.spec.ts` *(new)*, `docs/audit/seo/03-seo-fix-log.md` *(new)*
- **Concrete Fix**: After Wave 6A and all 4 Wave 6B branches merge cleanly, implement the unified post-merge Gate B regression suite: (1) Vitest static/SSR route, `50–60`c / `150–160`c CTR, canonical, JSON-LD Rich-Results, wholesale-SAR confidentiality, and `>=50%` 4-gram Jaccard city/guide differentiation contracts (`tests/seo/**`), (2) Neon PostgreSQL integration round-trip test for 7-column attribution + CSV export (`tests/integration/seo-utm-attribution.integration.test.ts`), and (3) Playwright E2E `j23-seo-crawl-and-attribution.spec.ts` crawling `robots.txt` → `sitemap.xml` → `/llms.txt` → every indexable hub/spoke (`200`, `1 <h1>`, JSON-LD parse, `0` `/admin` footer links), `/voucher/invalid` (`404` + `X-Robots-Tag: noindex`), and full UTM landing → internal spoke-to-builder prefill → lead submission → Admin Dossier badge verification. Re-run `nextjs_seo_geo_cli.py` post-fix to record `>= 90/100` score.
- **Red→Green Test**: Full `npm test`, `npm run build`, and Playwright `j23` green in Gate B (`Wave 7`).

---

### 3.3 `P2` & `P3` — Polish, Legal Parity, Recovery & Accessibility Items (`SEO-027` – `SEO-031`)

#### `SEO-027` — `/llms.txt` AI Answer-Engine Manifest & Secondary Font Preload Trimming
- **Severity**: `P2` | **Sub-Wave**: `Wave 6A` | **Owner**: `F-SEO-PLAT`
- **Source Finding IDs**: `S01-004`, `S03-004`
- **Target Files**: `public/llms.txt` *(new)*, `app/layout.tsx`
- **Concrete Fix**: Author `public/llms.txt` following the `llms.txt` Markdown standard (`# Al Ramlah Travels (سفريات الرملة)`, Askari 10 Lahore Cantt NAP matching `TravelAgency` JSON-LD verbatim, canonical `https://alramlahtravels.com/...` commercial/guide/policy index, and authoritative Haramain domain rules — zero `/admin` or `/voucher` URLs). In `app/layout.tsx`, set `preload: false` on `JetBrains_Mono` and `Amiri` (and trim `Amiri` to `subsets: ["arabic"]`) so only `Plus_Jakarta_Sans` and `Playfair_Display` preload in `<head>`.
- **Red→Green Test**: `tests/w6/f-seo-plat/llms-and-fonts.test.ts` verifying `public/llms.txt` links/NAP and `preload: false` on secondary fonts.

#### `SEO-028` — Legal Spoke Metadata (`50–60`c / `150–160`c), Breadcrumbs, Cross-Links & `/privacy` §3 Storage Disclosure
- **Severity**: `P2` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-TRUST`
- **Source Finding IDs**: `S04-003`, `S13-007`, `S14-007`
- **Target Files**: `app/(public)/privacy/page.tsx`, `app/(public)/terms/page.tsx`, `app/(public)/refund-policy/page.tsx`, `components/seo/trust-legal-crosslinks.tsx` *(new)*
- **Concrete Fix**: Refactor `/privacy`, `/terms`, and `/refund-policy` to use `buildPublicMetadata()` with compliant `50–60` char titles and `150–160` char descriptions (eliminating root OG title/description bleed), replace duplicate mini `<header>` bars with `<PublicBreadcrumbs />`, mount `trust-legal-crosslinks.tsx` linking sibling policies + `/umrah-packages`, `/umrah-visa`, and `/contact`, use `getCachedCompanyInfo()`, and add `alramlah_attribution_v1` to `/privacy` §3's explicit `sessionStorage` disclosure table.
- **Red→Green Test**: `tests/w6/f-seo-trust/legal-pages-seo.test.tsx` asserting exact title/description lengths, `alramlah_attribution_v1` disclosure in `/privacy`, and sibling policy `<Link>` presence.

#### `SEO-029` — Root `app/not-found.tsx` `404` Metadata, Public Navigation Chrome & Dynamic WhatsApp Recovery
- **Severity**: `P2` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-SHELL`
- **Source Finding IDs**: `S02-006`, `S13-006`
- **Target Files**: `app/not-found.tsx`
- **Concrete Fix**: Export `metadata` (`title: "Page Not Found (404) | Al Ramlah Travels"`, `robots: { index: false, follow: true }`) in `app/not-found.tsx`, wrap in `PublicHeader` + `PublicFooter` using `getCachedCompanyInfo()`, replace deprecated `<Image priority>` with `loading="eager"`, read dynamic `primaryWhatsapp` instead of hardcoded digits, and render recovery `<Link>` cards to `/umrah-packages`, `/umrah-visa`, `/hajj-2027`, `/hotels/makkah`, and `/contact`.
- **Red→Green Test**: `tests/w6/f-seo-shell/not-found.test.tsx` verifying `404` `robots.index === false`, dynamic WhatsApp href, and commercial hub recovery links.

#### `SEO-030` — CLS Guards, Off-Homepage `/?trackRef=` Continuity, Quotation `portalUrl` & `wa.me` Attribution Context
- **Severity**: `P2` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-SHELL`
- **Source Finding IDs**: `S03-005`, `S14-006`, `S15-003`, `S15-006`, `S15-007`
- **Target Files**: `components/layout/public-header.tsx`, `components/layout/whatsapp-fab.tsx`, `components/public/group-packages-section.tsx`, `components/public/group-booking-modal.tsx`, `components/public/hajj-inquiry-section.tsx`, `components/public/status-tracker.tsx`, `components/planner/lead-capture-dialog.tsx`, `components/planner/review-and-submit-step.tsx`, `app/actions/applications.ts`, `app/actions/quotes.ts`
- **Concrete Fix**: Reserve fixed single-line width on `PublicHeader`'s AST prayer pill (`loading="eager"` on `40×40` logo instead of competing `priority` preload) and render a branded Haramain geometric fallback when `pkg.bannerUrl` is `null` in `GroupPackagesSection`. Update `handleTrackStatus` across all 4 lead funnels so off-homepage submissions navigate via `router.push('/?trackRef=ART-...#track-status')`, hydrate `?trackRef=` inside `<Suspense>` in `StatusTracker` (still requiring phone verification), use `getCanonicalSiteUrl()` + `?trackRef=` in `quotes.ts` `portalUrl`, and append concise `formatWhatsAppAttributionSuffix()` context to `WhatsAppFab` and post-submit `waMessage` links.
- **Red→Green Test**: `tests/w6/f-seo-shell/off-home-continuity.test.tsx` verifying off-home `router.push('/?trackRef=...')`, `StatusTracker` prefill, `quotes.ts` `portalUrl`, and `wa.me` attribution suffix.

#### `SEO-031` — `PublicHeader` Active-Route `aria-current="page"` Accessibility & Haramain Gold Indicator
- **Severity**: `P3` | **Sub-Wave**: `Wave 6B` | **Owner**: `F-SEO-SHELL`
- **Source Finding IDs**: `S13-008`
- **Target Files**: `components/layout/public-header.tsx`
- **Concrete Fix**: Use `usePathname()` in `PublicHeader` desktop and mobile drawer links to set `aria-current="page"` and subtle Haramain Gold active styling whenever `pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`))`.
- **Red→Green Test**: `tests/w6/f-seo-shell/header-active-link.test.tsx` mocking `usePathname("/umrah-packages/from-lahore")` and asserting `aria-current="page"` on `Umrah Packages`.

---

## 4. Complete Raw-to-Canonical Traceability Index (`88 / 88` Findings)

| Specialist | Raw Finding IDs (`Count`) | Mapped Canonical `SEO-ID`s |
| :--- | :--- | :--- |
| **`S01`** (`5`) | `S01-001`→`SEO-007`, `S01-002`→`SEO-008`, `S01-003`→`SEO-007`, `S01-004`→`SEO-027`, `S01-005`→`SEO-008` | `SEO-007`, `SEO-008`, `SEO-027` |
| **`S02`** (`6`) | `S02-001`→`SEO-009`, `S02-002`→`SEO-009`, `S02-003`→`SEO-009`, `S02-004`→`SEO-011`, `S02-005`→`SEO-011`, `S02-006`→`SEO-029` | `SEO-009`, `SEO-011`, `SEO-029` |
| **`S03`** (`5`) | `S03-001`→`SEO-023`, `S03-002`→`SEO-023`, `S03-003`→`SEO-012`, `S03-004`→`SEO-027`, `S03-005`→`SEO-030` | `SEO-012`, `SEO-023`, `SEO-027`, `SEO-030` |
| **`S04`** (`6`) | `S04-001`→`SEO-009`, `S04-002`→`SEO-023`, `S04-003`→`SEO-028`, `S04-004`→`SEO-010`, `S04-005`→`SEO-009`, `S04-006`→`SEO-010` | `SEO-009`, `SEO-010`, `SEO-023`, `SEO-028` |
| **`S05`** (`5`) | `S05-001`→`SEO-015`, `S05-002`→`SEO-005`, `S05-003`→`SEO-023`, `S05-004`→`SEO-006`, `S05-005`→`SEO-016` | `SEO-005`, `SEO-006`, `SEO-015`, `SEO-016`, `SEO-023` |
| **`S06`** (`5`) | `S06-001`→`SEO-015`, `S06-002`→`SEO-016`, `S06-003`→`SEO-013`, `S06-004`→`SEO-012`, `S06-005`→`SEO-024` | `SEO-012`, `SEO-013`, `SEO-015`, `SEO-016`, `SEO-024` |
| **`S07`** (`4`) | `S07-001`→`SEO-017`, `S07-002`→`SEO-025`, `S07-003`→`SEO-018`, `S07-004`→`SEO-013` | `SEO-013`, `SEO-017`, `SEO-018`, `SEO-025` |
| **`S08`** (`5`) | `S08-001`→`SEO-019`, `S08-002`→`SEO-013`, `S08-003`→`SEO-020`, `S08-004`→`SEO-013`, `S08-005`→`SEO-012` | `SEO-012`, `SEO-013`, `SEO-019`, `SEO-020` |
| **`S09`** (`5`) | `S09-001`→`SEO-001`, `S09-002`→`SEO-001`, `S09-003`→`SEO-001`, `S09-004`→`SEO-022`, `S09-005`→`SEO-014` | `SEO-001`, `SEO-014`, `SEO-022` |
| **`S10`** (`5`) | `S10-001`→`SEO-021`, `S10-002`→`SEO-012`, `S10-003`→`SEO-012`, `S10-004`→`SEO-012`, `S10-005`→`SEO-021` | `SEO-012`, `SEO-021` |
| **`S11`** (`5`) | `S11-001`→`SEO-023`, `S11-002`→`SEO-022`, `S11-003`→`SEO-023`, `S11-004`→`SEO-022`, `S11-005`→`SEO-022` | `SEO-022`, `SEO-023` |
| **`S12`** (`4`) | `S12-001`→`SEO-009`, `S12-002`→`SEO-012`, `S12-003`→`SEO-012`, `S12-004`→`SEO-023` | `SEO-009`, `SEO-012`, `SEO-023` |
| **`S13`** (`8`) | `S13-001`→`SEO-005`, `S13-002`→`SEO-005`, `S13-003`→`SEO-023`, `S13-004`→`SEO-014`, `S13-005`→`SEO-005`, `S13-006`→`SEO-029`, `S13-007`→`SEO-028`, `S13-008`→`SEO-031` | `SEO-005`, `SEO-014`, `SEO-023`, `SEO-028`, `SEO-029`, `SEO-031` |
| **`S14`** (`7`) | `S14-001`→`SEO-003`, `S14-002`→`SEO-004`, `S14-003`→`SEO-004`, `S14-004`→`SEO-024`, `S14-005`→`SEO-025`, `S14-006`→`SEO-030`, `S14-007`→`SEO-028` | `SEO-003`, `SEO-004`, `SEO-024`, `SEO-025`, `SEO-028`, `SEO-030` |
| **`S15`** (`7`) | `S15-001`→`SEO-006`, `S15-002`→`SEO-002`, `S15-003`→`SEO-030`, `S15-004`→`SEO-015`, `S15-005`→`SEO-017`, `S15-006`→`SEO-030`, `S15-007`→`SEO-030` | `SEO-002`, `SEO-006`, `SEO-015`, `SEO-017`, `SEO-030` |
| **`S16`** (`6`) | `S16-001`→`SEO-001`, `S16-002`→`SEO-001`, `S16-003`→`SEO-013`, `S16-004`→`SEO-011`, `S16-005`→`SEO-026`, `S16-006`→`SEO-012` | `SEO-001`, `SEO-011`, `SEO-012`, `SEO-013`, `SEO-026` |
