# 0025. Public Site SEO, Generative Engine Optimization (GEO) & Attribution Readiness (Phase B)

- **Status**: Complete — Gate B Certified (`2026-11-16` — `31/31` Canonical `SEO-ID`s & `88/88` Raw `S01`–`S16` Findings Verified Closed across `GB-01`..`GB-08`; `90.2 / 100` Grade `A` Empirical Score; `731/731` Unit/W3/W6/Integration Tests & `26/26` Playwright `J1`–`J23` E2E Green)
- **Slice**: Slice 44 (Feature #48)
- **Workflow Tier**: Beta (`/architect` → `/develop` → `/check verify` → `/test` → `/sync`)
- **Date**: 2026-11-15 (Gate B Certified: 2026-11-16)
- **Prerequisite Gate**: `Spec 0024` Gate A Certified (`HEAD 6c54d4c` on `audit/production-hardening`)
- **Companion Artifacts**:
  - Kickoff Charter & Owner Decisions: [`docs/audit/SWARM_PROMPT.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/SWARM_PROMPT.md), [`docs/audit/OWNER_DECISIONS.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/OWNER_DECISIONS.md)
  - Wave 5 Empirical Baseline (`54.5 / 100` — Grade `D`): [`docs/audit/seo/baseline/score_report.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/baseline/score_report.md), `codebase_audit.json`, `nap_audit.json`, `geo_liftability.json`, `internal_links.json`, `keyword_fanout.json`
  - Wave 5 Specialist Audit Reports (`16` reports): [`docs/audit/seo/findings/S01.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/findings/S01.md) .. [`S16.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/findings/S16.md)
  - Wave 5 Master Triage (`88` raw → `31` canonical `SEO-001`..`SEO-031`): [`docs/audit/seo/02-seo-triage.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/02-seo-triage.md)
  - Wave 6 Zero-Collision Ownership Map (`F-SEO-PLAT` → `4` Parallel `W6B` Fixers → `F-SEO-QA`): [`docs/audit/seo/02-seo-ownership.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/02-seo-ownership.md)
  - Wave 6 Remediation Log & Empirical Post-Fix Score (`90.2 / 100` — Grade `A`): [`docs/audit/seo/03-seo-fix-log.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/03-seo-fix-log.md), [`docs/audit/seo/post-fix/score_report.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/post-fix/score_report.md)
  - Wave 7 Independent Verification & Gate B Sign-Off: [`docs/audit/seo/verification/V-SEO-01.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/verification/V-SEO-01.md), [`docs/audit/seo/verification/V-SEO-02.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/verification/V-SEO-02.md), [`docs/audit/seo/04-seo-verification.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/04-seo-verification.md), [`docs/audit/SEO_READINESS.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/SEO_READINESS.md), [`docs/audit/FINAL_REPORT.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/FINAL_REPORT.md)

---

## 1. Context & Empirical Baseline (`Wave 5`)

With Phase A (`Spec 0024`) security, authz, pricing, concurrency, and transactional reliability hardened and Gate A certified (`6c54d4c`), **Al Ramlah Travels (`سفريات الرملة`)** is operationally safe — **but organically invisible** across Google Search, Lahore Local Pack, WhatsApp link previews, and AI answer engines (`ChatGPT Search`, `Perplexity`, `Claude Search`, `Google AI Overviews`).

Empirical Wave 5 scanning via `nextjs-business-seo-geo-auditor` and 16 specialist forensic audits (`S01`–`S16`) recorded a pre-Phase-B score of **`54.5 / 100` (Grade `D`)** and **`88` raw findings** (`8 P0`, `45 P1`, `34 P2`, `1 P3`, consolidated into **`31` canonical items `SEO-001`..`SEO-031`**):

1. **Single-Page `#fragment` Trap (`S05`, `S06`–`S08`, `S13`)**: Only `4` indexable public routes exist (`/`, `/privacy`, `/terms`, `/refund-policy`). All `7` commercial pilgrimage verticals (`Custom Umrah`, `Group Packages`, `City Gateways`, `Hajj 2027`, `Umrah Visa`, `Makkah/Madinah Hotels`, `Sacred Ziyarat`) are trapped on `/` behind `16` non-crawlable `/#hash` header/footer links, while `PublicFooter` actively leaks crawl budget via `<Link href="/admin">Staff Operations Portal</Link>`.
2. **Zero Crawl, Discovery, Canonical or Schema Infrastructure (`S01`, `S02`, `S04`, `S09`, `S16`)**: `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `app/opengraph-image.tsx`, `alternates.canonical`, `twitter` cards, and Schema.org JSON-LD (`0/29` routes) are all absent. `openGraph.images` points to a near-square `680×610` `public/logo.jpg`, `nginx.conf` + `PublicFooter` split authority across `www.` vs apex `alramlahtravels.com`, and `proxy.ts` omits `/voucher` & `/quote` from `X-Robots-Tag: noindex, nofollow`.
3. **CWV / RSC Skew & Wholesale SAR Leakage (`S03`, `S15`)**: `99.8%` of public/planner component LOC (`14,111 / 14,138` lines) is `"use client"`, `SELECT *` serializes internal wholesale SAR hotel/vehicle tariffs (`sharingPriceSar`, `roomPriceSar`, `defaultRateSar`) into `398.5 KB` of `/` HTML, and `HeroSlider` mounts all `100vw` slides concurrently using Next.js 16's deprecated `priority` prop.
4. **Zero Web Lead Attribution & Broken Spoke-to-Builder Prefill (`S14`, `S15`)**: `applications` and `contact_messages` store zero `utm_*`, `landing_page`, or `http_referrer` columns; `PlannerProvider` ignores URL query params (`?preset=visa_only`, `?departureCity=LHE`) and overwrites entry state from `sessionStorage`; and seeded `groupDepartures` / `hotels.validUntil` dates suffer calendar expiration cliffs.

---

## 2. Architecture & Technical Design

### 2.1 Canonical Origin, Crawl Governance & Dual-Layer `noindex` (`F-SEO-PLAT`)

- **Single Canonical Hostname (`https://alramlahtravels.com`)**:
  - Standardize `BRAND_WEBSITE_URL = "https://alramlahtravels.com"` (`lib/constants/brand.ts`) matching `lib/env.ts` and `Dockerfile`.
  - Configure permanent `308`/`301` redirect from `Host: www.alramlahtravels.com` to `https://alramlahtravels.com/:path*` in `next.config.ts` `redirects()` and `nginx/nginx.conf`.
  - `getCanonicalSiteUrl()` in `lib/seo/metadata.ts` resolves `env.NEXT_PUBLIC_APP_URL` safely, guaranteeing production builds never emit `http://localhost:3000`.
- **`app/robots.ts`**:
  - When `process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production"`, return `{ rules: [{ userAgent: "*", disallow: "/" }] }` (zero preview indexing).
  - In production: allow `"/"` and disallow `["/admin/", "/api/", "/voucher/", "/quote/", "/_next/"]` for `*` and explicitly for AI citation/search bots (`OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `Claude-SearchBot`, `Claude-User`, `Google-Extended`, `Applebot-Extended`); disallow bulk scrapers (`CCBot`, `Bytespider`); emit `sitemap: "https://alramlahtravels.com/sitemap.xml"` and `host: "https://alramlahtravels.com"`.
- **Dynamic `app/sitemap.ts` (`revalidate = 3600`)**:
  - Emits all `18` static/city/guide public hubs plus active `/umrah-packages/${pkg.slug}` spokes sharing the **exact** visibility predicate in `lib/seo/public-queries.ts` (`0` broken/soft-404 URLs).
  - Computes truthful `lastModified`: `max(groupPackages.updatedAt, max(groupDepartures.updatedAt))` per package, city-grouped `MAX(updatedAt)` on `hotels` (`makkah`, `madinah`) and `ziyaratPlaces` (`makkah`, `madinah`), `MAX(hajjPackages.updatedAt)` for `/hajj-2027`, and deterministic revision dates for legal pages (never `new Date()` spam). Falls back cleanly to static hub entries if DB is unreachable at build time.
- **`public/llms.txt`**:
  - Markdown briefing (`# Al Ramlah Travels (سفريات الرملة)`) indexing Askari 10 Lahore Cantt NAP, all canonical public hubs, and Haramain domain invariants (zero `/admin`, `/api`, or `/voucher` paths).
- **Dual-Layer `noindex` & HTTP `403` Capability Hardening**:
  - `proxy.ts`: emit `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` on `/admin/*`, `/api/*`, `/voucher/*`, and `/quote/*`.
  - `app/admin/layout.tsx`: Server Component layout setting `robots: { index: false, follow: false, nocache: true }` (protecting statically prerendered `/admin/login`).
  - `app/(public)/voucher/[token]/page.tsx` + `forbidden.tsx`: enable `experimental.authInterrupts: true` in `next.config.ts` and call `forbidden()` when `resolved.httpStatus === 403` so locked vouchers return genuine **HTTP `403 Forbidden`** instead of `200 OK`. Also add `/admin/social` → `/admin/campaigns?tab=social` (`permanent: true`) in `next.config.ts`.

### 2.2 Metadata Builder, `1200×630` OpenGraph Cards & JSON-LD Safety (`lib/seo/*`)

- **`buildPublicMetadata()` (`lib/seo/metadata.ts`)**:
  - Enforces self-referencing `alternates: { canonical: path }` (query-free, no trailing slash except `"/"`), `openGraph` (`title`, `description`, `url: path`, `siteName: "Al Ramlah Travels"`, `locale: "en_PK"`, `type`, `1200×630` image), `twitter` (`card: "summary_large_image"`, `title`, `description`, `images`), and `robots.googleBot` (`"max-image-preview": "large"`, `"max-snippet": -1`, `"max-video-preview": -1`).
  - Provides deterministic `clampSeoTitle()` (`50..60` chars) and `clampSeoDescription()` (`150..160` chars) helpers for dynamic `[slug]` pages.
- **Luxury Haramain `next/og` Cards (`lib/seo/og-card.tsx`, `app/opengraph-image.tsx`, `app/(public)/umrah-packages/[slug]/opengraph-image.tsx`)**:
  - Generates `1200×630` PNG cards in Deep Haramain Emerald (`#0A3622`), Metallic Gold (`#C5A059`), and Warm Ivory (`#FAF7F0`), replacing `680×610` `/logo.jpg` across all social link previews.
- **XSS-Safe JSON-LD Library (`lib/seo/json-ld.ts`) & Rich-Results Guardrails**:
  - `serializeJsonLd()` escapes `<`, `>`, `&`, `\u2028`, `\u2029` to Unicode hex sequences before `<script type="application/ld+json">` injection.
  - **Strict Penalty Prevention (`OD-08`–`OD-10`)**:
    1. **NEVER** emit `AggregateRating` or `Review` schema while verified review count is `0`.
    2. **NEVER** emit `Offer.price` on volatile services (`/hotels/*`, `/ziyarat/**`, custom builder) or `price <= 0` tiers (`OD-09b`); filter `price > 0` before computing `AggregateOffer` on `/umrah-packages/[slug]`.
    3. **NEVER** emit `InStock` commercial `Product` checkout schema on `/hajj-2027` (`OD-09e`); emit `Service` (`"Indicative 2027 Pre-Registration"`) + `FAQPage`.
    4. **NEVER** emit unverified license identifiers (`dtsLicense`, `moraLicense`, `iataCode`, `ntnNumber`) when `null` in `agencySettings` (`OD-10`).
    5. `FAQPage` JSON-LD must be generated from the **exact** Q&A array rendered visibly in RSC HTML (`1:1` DOM-to-Schema parity).

### 2.3 Wholesale-Confidential Public DTOs, NAP Sync & Rolling Seed (`lib/seo/public-queries.ts`, `db/seed.ts`)

- **`lib/seo/public-queries.ts`**:
  - Wraps `getCachedCompanyInfo()` in `React.cache()` with try/catch static fallback (`DEFAULT_COMPANY_INFO` synced to `, Pakistan` and `BRAND_SOCIAL_URLS`).
  - Explicitly omits internal wholesale SAR columns (`sharingPriceSar`, `roomPriceSar`, `quadPriceSar`, `triplePriceSar`, `doublePriceSar`, `breakfastPriceSarPerPax`, `lunchPriceSarPerPax`, `dinnerPriceSarPerPax`, `fullBoardPriceSarPerPax`, `defaultRateSar`, `ziyaratRateSar`, `updatedByUserId`) from all public hotel/vehicle DTOs (`S15-002`).
  - Centralizes `revalidatePublicSeoPaths()` (`lib/seo/revalidate-public.ts`) wired into `catalog.ts`, `marketing-ops.ts`, `groups.ts`, and `cms.ts`.
- **NAP, BiDi & Currency Formatting**:
  - `toTelHref()` emits strict E.164 `tel:+923274029701` / `tel:+923190462638`; `formatPkPhoneDisplay()` emits `+92 327 4029701`; Arabic brand name standardized everywhere to `سفريات الرملة` inside `<ArabicText />` (`dir="rtl" lang="ar"`); `formatPkr()` formats deterministic `PKR 295,000` strings without SSR/CSR locale hydration drift.
- **Rolling Horizon `db/seed.ts`**:
  - Replaces expiring calendar dates with rolling future PKT offsets (`today + 30d..180d`) across `pkg1`–`pkg4` covering `LHE`, `KHI`, and `ISB`, seeds `hajjPackages` (`Maktab A+`, `A`, `B`, `C`), sets `hotels.validUntil` to rolling `today + 400d`, deduplicates stock photos (fixing Masjid Quba's image), and seeds `12+` dynamic-safe FAQs (`2× db:seed` idempotent).

### 2.4 End-to-End First-Touch Attribution & Spoke-to-Builder Deep-Link Contract

- **Additive PostgreSQL Columns (`drizzle/0003_seo_lead_attribution.sql`)**:
  - Adds 7 nullable columns (`utm_source` `varchar(120)`, `utm_medium` `varchar(120)`, `utm_campaign` `varchar(160)`, `utm_content` `varchar(160)`, `utm_term` `varchar(160)`, `landing_page` `text`, `http_referrer` `text`) + B-tree indexes to both `applications` and `contact_messages`.
- **`<UtmTracker />` (`components/seo/utm-tracker.tsx` + `lib/seo/utm.ts`)**:
  - Mounted inside `<Suspense fallback={null}>` in `app/(public)/layout.tsx` (zero static/ISR bailout).
  - Locks first-touch `landingPage` (must start with `"/"`, rejecting `"//"`), external `httpReferrer` (`http:`/`https:` different hostname, stripped of credentials/hash, `<=512` chars), and `utm_*` (`<=120/160` chars, control-chars stripped) in `sessionStorage["alramlah_attribution_v1"]` (disclosed in `/privacy` §3).
  - Attached via `readStoredAttribution()` across all 5 client submit handlers (`ReviewAndSubmitStep`, `LeadCaptureDialog`, `GroupBookingModal`, `HajjInquirySection`, `ContactSection`), validated by `strictAttributionSchema`, persisted in all 4 Server Actions (`app/actions/applications.ts`, with `cms.ts` `submitContactMessage` delegating directly to `submitPublicContactInquiryAction`), surfaced in `ApplicationDossier` & `MessagesClient` (with inferred `AI Search` / `Organic Search` referrer badge), and exported formula-safely via `sanitizeCsvCellInternal()` in `exportApplicationsCsvAction`.
- **`<Suspense>` `PlannerProvider` URL Prefill Contract (`components/planner/planner-context.tsx`)**:
  - Validated query overrides applied **after** `sessionStorage` draft hydration so spoke CTAs always win over stale drafts:
    - `?preset=visa_only|hotels_only|flights_only|complete_umrah`
    - `?departureCity=LHE|KHI|ISB` (resolves `departureCities` UUID + `customerCity`)
    - `?citySequence=makkah_madinah|madinah_makkah|makkah_only` (enforces `JED` entry lock + `recomputeStays()` seamless date chaining)
    - `?hotelId=<uuid>` (validates active hotel, applies `calculatePrivateRoomSplits()` & `allowsPrivateRooms`/`allowsSharedRooms` guards)
    - `?ziyaratCity=both|makkah_only|madinah_only`
  - Off-homepage post-submit `"Track Application Status Live"` buttons navigate to `/?trackRef=ART-...#track-status` (`StatusTracker` pre-fills `referenceNumber` inside `<Suspense>` while keeping phone verification mandatory).

### 2.5 Core Web Vitals (LCP, INP, CLS) & RSC-First Surface

- **Hero LCP**: Replace deprecated Next.js 16 `priority` with `preload` on Slide `0` only in `HeroSlider`, mount slides `1..N` lazily after hydration (preventing concurrent `100vw` downloads), switch `PublicHeader` `40×40` logo from `priority` to `loading="eager"`, and set `preload: false` on secondary Google Fonts (`JetBrains_Mono`, `Amiri`).
- **RSC-First & Lazy Hydration**: Convert `MarketingSections` (`518` lines) to a zero-JS Server Component with a tiny `FaqAccordionClient` leaf island; build all `14` new hub/spoke routes as `>=80%` Server Components; dynamically import `GroupBookingModal` (single instance) and Wizard Steps 2–6.

---

## 3. Complete Public Route, Metadata (`50–60`c / `150–160`c), JSON-LD & Differentiation Matrix

> **Next.js 16 Async Params Rule**: Every dynamic `page.tsx`, `generateMetadata()`, and `opengraph-image.tsx` MUST type `params` as `Promise<{ ... }>` and `await params`. City and Haramain dynamic segments MUST export `export const dynamicParams = false`.

| # | Canonical Path | Owner | Rendered `<title>` (`50–60` chars) | `<meta name="description">` (`150–160` chars) | Primary `<h1>` | JSON-LD Types | Differentiation / Guardrail |
| :-: | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | `/` | `F-SEO-TRUST` | `Umrah Packages Pakistan & Hajj 2027 \| Al Ramlah Travels` (`55`c) | `Plan custom Umrah packages from Lahore, Karachi & Islamabad, Saudi Umrah visas, 5-star Haramain hotels, and Hajj 2027 tours with Al Ramlah Travels now.` (`151`c) | `Umrah Packages, Saudi Visas & Hajj 2027 Journeys from Pakistan` *(stable SSR)* | `TravelAgency`, `WebSite`, `FAQPage` | Root entity hub + interactive `CustomJourneyBuilder` + answer-first `<table>` |
| 2 | `/umrah-packages` | `F-SEO-UMRAH` | `Group Umrah Packages 2026–2027 in PKR \| Al Ramlah Travels` (`57`c) | `Compare fixed-departure Umrah packages from Pakistan with Sharing, Quad, Triple & Double PKR rates, steps-from-Haram hotels, and guided Ziyarat tours.` (`150`c) | `Fixed-Departure Group Umrah Packages from Pakistan (2026–2027)` | `CollectionPage`, `ItemList`, `BreadcrumbList` | Tier comparison `<table>`, `0`-tier = `"On Request"` (`OD-09b`) |
| 3 | `/umrah-packages/[slug]` | `F-SEO-UMRAH` | `clampSeoTitle("{Title} ({Days}D Umrah)")` (`50–60`c) | `clampSeoDescription("Book {Title} from Pakistan: {Days}-day Umrah group with verified Makkah & Madinah hotels, flights, Saudi visa & PKR tiers.")` (`150–160`c) | `{pkg.title}` | `TouristTrip` + `AggregateOffer` (`price > 0` only), `BreadcrumbList` | Per-slug `1200×630` OG image, `infantPricePkr` (`OD-09d`), `GroupBookingModal` |
| 4 | `/umrah-packages/from-lahore` | `F-SEO-UMRAH` | `Umrah Packages from Lahore (LHE) 2027 \| Al Ramlah Travels` (`57`c) | `Book direct & 1-stop Umrah packages from Allama Iqbal Airport Lahore (LHE) to Jeddah & Madinah with Askari 10 concierge support and fixed PKR batches.` (`150`c) | `Umrah Packages from Lahore (Allama Iqbal International Airport — LHE)` | `CollectionPage`, `FAQPage`, `BreadcrumbList` | `>=50%` unique: LHE Terminal/airline table, Askari 10 Cantt in-person desk, `LHE` batches |
| 5 | `/umrah-packages/from-karachi` | `F-SEO-UMRAH` | `Umrah Packages from Karachi (KHI) 2027 \| Al Ramlah Travels` (`58`c) | `Explore Umrah packages from Jinnah International Airport Karachi (KHI) with Saudia, PIA & Gulf carriers, Haramain courtyard hotels, and live PKR seats.` (`151`c) | `Umrah Packages from Karachi (Jinnah International Airport — KHI)` | `CollectionPage`, `FAQPage`, `BreadcrumbList` | `>=50%` unique: KHI shortest flight-time routing, courier/digital passport intake, `KHI` batches |
| 6 | `/umrah-packages/from-islamabad` | `F-SEO-UMRAH` | `Umrah Packages from Islamabad (ISB) \| Al Ramlah Travels` (`55`c) | `Depart from Islamabad International Airport (ISB) on curated family & executive Umrah packages with Madinah-first or Jeddah-entry routes & Saudi visas.` (`155`c) | `Umrah Packages from Islamabad & Rawalpindi (ISB Gateway)` | `CollectionPage`, `FAQPage`, `BreadcrumbList` | `>=50%` unique: Twin Cities/KP/AJK catchment, ISB direct Saudia/PIA schedules, `ISB` batches |
| 7 | `/hajj-2027` | `F-SEO-GUIDES` | `Hajj 2027 Packages Pakistan & Maktab \| Al Ramlah Travels` (`56`c) | `Pre-register indicative interest for Hajj 2027 from Pakistan & diaspora: compare Maktab A+, A, B & C tiers, Aziziya vs shifting stays & MoRA readiness.` (`151`c) | `Hajj 2027 Pre-Registration & Maktab Tier Guide from Pakistan` | `Service`, `FAQPage`, `BreadcrumbList` | `OD-09e` Indicative badges + `HAJJ_2027_REGULATORY_DISCLAIMER`, zero `InStock` checkout |
| 8 | `/umrah-visa` | `F-SEO-GUIDES` | `Saudi Umrah Visa Price Pakistan (PKR) \| Al Ramlah Travels` (`57`c) | `Check live Saudi Umrah visa rates in PKR for short-term (<=30 days) & long-term stays, Nusuk Masar hotel rules, Saudi Bio steps, and instant visa quotes.` (`153`c) | `Saudi Umrah Visa Rates in PKR, Nusuk Masar Rules & Requirements` | `Service`, `FAQPage`, `BreadcrumbList` | Live `visa_rates` `<=30d` vs `31–90d` PKR table + mandatory KSA Arrival/Departure rule (`OD-09c`) |
| 9 | `/hotels/makkah` | `F-SEO-GUIDES` | `Makkah Hotels Near Masjid al-Haram \| Al Ramlah Travels` (`54`c) | `Compare verified 3-star to 5-star Makkah Clock Tower, Ajyad & shuttle hotels with exact walking distances, Quad/Triple room splits, and custom Umrah plans.` (`155`c) | `Makkah Hotels — Clock Tower, Courtyard & Haram Shuttle Directory` | `ItemList` (`LodgingBusiness` without `Offer.price`), `BreadcrumbList` | `>=50%` unique: Clock Tower/Ajyad/Kudai zones, `JED` transfer rule, `"Live Rate"` lock |
| 10 | `/hotels/madinah` | `F-SEO-GUIDES` | `Madinah Markaziyah Hotels Near Haram \| Al Ramlah Travels` (`56`c) | `Browse Northern & Southern Markaziyah Madinah hotels steps from Masjid an-Nabawi & Ladies Gate 25 with family room configurations and custom Umrah quotes.` (`154`c) | `Madinah Markaziyah Hotels Near Masjid an-Nabawi & Ladies Gate 25` | `ItemList` (`LodgingBusiness` without `Offer.price`), `BreadcrumbList` | `>=50%` unique: Northern vs Southern Markaziyah, Gate 25 & Rawdah Nusuk guide, `"Live Rate"` lock |
| 11 | `/ziyarat` | `F-SEO-GUIDES` | `Makkah & Madinah Ziyarat Guide & Tours \| Al Ramlah Travels` (`58`c) | `Discover sacred Makkah, Madinah, Badr & Taif Ziyarat landmarks with historical context, private Sedan/GMC/Coaster fleet capacities, and guided itineraries.` (`155`c) | `Complete Haramain Ziyarat Guide — Makkah, Madinah, Badr & Taif` | `CollectionPage`, `ItemList`, `BreadcrumbList` | Fleet capacity bands (`1–3` Sedan..`13+` Bus; Train `shared_only`), `"Live Rate"` lock |
| 12 | `/ziyarat/makkah` | `F-SEO-GUIDES` | `Sacred Makkah Ziyarat Places & Guide \| Al Ramlah Travels` (`56`c) | `Explore Makkah Ziyarat landmarks including Jabal al-Noor, Ghar-e-Thawr, Mina, Arafat & Masjid Aisha with pilgrim visiting tips and private transport options.` (`157`c) | `Sacred Ziyarat Landmarks in Makkah al-Mukarramah & Taif` | `ItemList` (`TouristAttraction`), `BreadcrumbList` | `>=50%` unique: Makkah/Mashair/Taif sites, Ihram miqat notes (`Masjid Aisha` / `Qarn al-Manazil`) |
| 13 | `/ziyarat/madinah` | `F-SEO-GUIDES` | `Sacred Madinah Ziyarat Places & Guide \| Al Ramlah Travels` (`57`c) | `Visit Masjid Quba, Mount Uhud, Masjid Qiblatain, Seven Mosques & Jannat al-Baqi in Madinah with authentic historical notes and private family Ziyarat vans.` (`155`c) | `Sacred Ziyarat Landmarks in Madinah al-Munawwarah & Badr` | `ItemList` (`TouristAttraction`), `BreadcrumbList` | `>=50%` unique: Quba two-rak'ah Sunnah virtue, Uhud martyrs etiquette, Badr day-trip logistics |
| 14 | `/about` | `F-SEO-TRUST` | `About Al Ramlah Travels Lahore Office \| Al Ramlah Travels` (`57`c) | `Meet Al Ramlah Travels in Sector C, Askari 10, Lahore Cantt: dedicated Haramain pilgrimage specialists serving Pakistani families and global diaspora.` (`150`c) | `About Al Ramlah Travels — Haramain Pilgrimage Specialists in Lahore` | `AboutPage`, `TravelAgency`, `BreadcrumbList` | `OD-10` truthful regulatory rendering (no fabricated licenses or `"15,000+"` claims) |
| 15 | `/contact` | `F-SEO-TRUST` | `Contact Lahore Cantt Umrah Desk & Map \| Al Ramlah Travels` (`57`c) | `Visit Al Ramlah Travels at Office 38, Street 1, Sector C, Askari 10, Lahore Cantt or call +92 327 4029701 on WhatsApp for Umrah, visa & Hajj 2027 quotes.` (`153`c) | `Contact Our Askari 10, Lahore Cantt Pilgrimage Concierge Desk` | `ContactPage`, `TravelAgency`, `BreadcrumbList` | Verbatim Askari 10 NAP, E.164 `tel:` links, PKT hours, `<ContactSection />` |
| 16 | `/faq` | `F-SEO-TRUST` | `Umrah, Saudi Visa & Hajj 2027 FAQs \| Al Ramlah Travels` (`54`c) | `Get verified answers on Saudi Umrah visa rules, Jeddah-to-Makkah transfers, infant fares, overseas NICOP passports, wheelchair support & Nusuk permits.` (`151`c) | `Frequently Asked Questions — Umrah, Saudi Visas & Hajj 2027` | `FAQPage`, `BreadcrumbList` | 6-dimension AI fan-out answers + live `visa_rates` interpolation (`1:1` DOM/JSON-LD parity) |
| 17 | `/privacy` | `F-SEO-TRUST` | `Privacy Policy & Pilgrim Data Safety \| Al Ramlah Travels` (`56`c) | `Read how Al Ramlah Travels safeguards pilgrim personal data, passport scans, sessionStorage attribution keys, sub-processors, retention & DSAR rights.` (`150`c) | `Privacy Policy & Personal Data Protection Notice` | `WebPage`, `BreadcrumbList` | Discloses `alramlah_attribution_v1` in §3 storage table + sibling policy cross-links |
| 18 | `/terms` | `F-SEO-TRUST` | `Terms of Service & Booking Conditions \| Al Ramlah Travels` (`57`c) | `Review official Al Ramlah Travels booking terms governing Saudi Umrah visa processing, custom pilgrimage quotes, group seats & Hajj 2027 registrations.` (`151`c) | `Terms of Service & Pilgrimage Booking Conditions` | `WebPage`, `BreadcrumbList` | Upgraded `151`c description + self-canonical + `<PublicBreadcrumbs />` + cross-links |
| 19 | `/refund-policy` | `F-SEO-TRUST` | `Booking Cancellation & Refund Policy \| Al Ramlah Travels` (`56`c) | `Review our official cancellation schedule, non-refundable Saudi visa and airline fare rules, Ramadan/Hajj blackout terms, and PKR refund procedures now.` (`152`c) | `Cancellation, Amendment & PKR Refund Policy` | `WebPage`, `BreadcrumbList` | Upgraded `56`c title & `152`c description + `<PublicBreadcrumbs />` + cross-links |

*(Transactional `/voucher/[token]`, `/admin/**`, `/api/**`, and `app/not-found.tsx` emit `robots: { index: false, ... }` with zero `<link rel="canonical">`.)*

---

## 4. Haramain Business Invariants & Rich-Results Guardrails

Every Wave 6 implementation file and Wave 7 test MUST enforce all 9 platform invariants:

1. **Auto-Calculated Visa Duration Tier**: `short_term` (`<=30` inclusive KSA days) vs `long_term` (`31–90` days) is always server-calculated from mandatory KSA Arrival & Departure dates (`OD-09c`); never render a manual visa-tier dropdown.
2. **Volatile Services Lock**: Only `Visa Only` standalone tariffs (`/umrah-visa`) and fixed `groupPackages` room tiers (`price > 0`) show fixed PKR prices. Hotels, Flights, Transport, and Ziyarat ALWAYS display `"Live Rate — Confirmed upon submission"` with zero wholesale SAR/PKR figures in HTML, RSC props, or JSON-LD (`SEO-002`).
3. **Makkah Airport Rule**: Makkah has no airport; Makkah-first itineraries lock Entry Airport to Jeddah (`JED`) with ground/rail transfer disclosure (`OD-09c`).
4. **Passenger Bed/Seat Accounting**: `Adults + Children` count toward hotel beds and vehicle seats; `Infants (<2 yrs)` take `0` beds and `0` seats while requiring a visa and infant airfare (`infantPricePkr`, `OD-09d`). Group seat holds remain soft until Quoting Desk approval (`T-022`).
5. **Private Room Auto-Splitter**: Deep links (`?hotelId=`) invoke `calculatePrivateRoomSplits(bedAndSeatCount, hotel.availableRoomTypes)` (`Quad=4`, `Triple=3`, `Double=2`).
6. **Vehicle Fleet Capacity Bands**: `1–3` Sedan, `4–6` SUV, `7–12` Van/Minibus, `13+` Coach Bus; Haramain High-Speed Train is `shared_only` intercity rail and never a Ziyarat touring vehicle.
7. **Seamless Stay Chaining**: URL prefill mutations preserve `checkOut[i] === checkIn[i+1]` and `departureDate === lastStay.checkOutDate`.
8. **Margin Confidentiality & `0`-Tier `"On Request"` (`OD-09b`)**: Zero supplier/wholesale margins serialized publicly; any `<= 0` PKR tier on `groupPackages` or `multiHotelOptions` renders `"On Request"`, disables modal selection, and is excluded from JSON-LD `AggregateOffer`.
9. **Hajj 2027 Indicative Pre-Registration (`OD-09e`)**: `/hajj-2027` displays `HAJJ_2027_REGULATORY_DISCLAIMER` and `"Indicative 2027 Estimate"` badges on every Maktab card without online deposit checkout.

---

## 5. Build Plan (`Wave 6A` → `Wave 6B` → `Wave 6C` → `Wave 7`)

1. **Milestone 1 — Serialized Foundation (`Wave 6A` · `F-SEO-PLAT`)**:
   - Land `drizzle/0003_seo_lead_attribution.sql` (`applications` & `contact_messages` 7 attribution columns + indexes), rolling PKT `db/seed.ts` refresh, `lib/seo/{metadata,json-ld,og-card,utm,slugs,public-queries,revalidate-public}.ts`, `components/layout/breadcrumbs.tsx`, `lib/company-info.ts` + `brand.ts` + `public-utils.ts` + `arabic-text.tsx` NAP/E.164/`formatPkr` sync, `app/robots.ts`, `app/sitemap.ts`, `public/llms.txt`, `app/opengraph-image.tsx`, `app/layout.tsx`, `app/admin/layout.tsx`, `/voucher/[token]` `forbidden()` HTTP `403`, `proxy.ts` `X-Robots-Tag`, `next.config.ts` + `nginx.conf` `www`→apex redirects, and `catalog.ts`/`marketing-ops.ts` revalidation + slug hooks (`SEO-001`–`003`, `007`–`014`, `027`). Verify `tsc` + `vitest` green before forking Wave 6B.
2. **Milestone 2 — Parallel Commercial Spokes & Shell (`Wave 6B` · `4` Disjoint `workspace: "share"` Fixers)**:
   - **`F-SEO-UMRAH`**: `/umrah-packages`, `/umrah-packages/[slug]` (+ `[slug]/opengraph-image.tsx`), `/umrah-packages/from-[city]` (`lahore`, `karachi`, `islamabad` with `dynamicParams = false` & `>=50%` differentiation), and `components/seo/umrah-*` (`SEO-015`, `SEO-016`).
   - **`F-SEO-GUIDES`**: `/hajj-2027`, `/umrah-visa`, `/hotels/[city]` (`makkah`, `madinah`), `/ziyarat`, `/ziyarat/[city]` (`makkah`, `madinah`), and `components/seo/guides-*` (`SEO-017`–`SEO-020`).
   - **`F-SEO-TRUST`**: `/` (`app/(public)/page.tsx`, `HeroSlider` LCP/static `<h1>`, RSC `MarketingSections` + `FaqAccordionClient`), `/about`, `/contact`, `/faq`, `/privacy` (§3 `alramlah_attribution_v1`), `/terms`, `/refund-policy`, and `components/seo/trust-*` (`SEO-021`–`SEO-023`, `SEO-028`).
   - **`F-SEO-SHELL`**: `<UtmTracker />`, `app/(public)/layout.tsx`, `app/not-found.tsx`, crawlable `PublicHeader`/`PublicFooter`/`WhatsAppFab`, `<Suspense>` `PlannerProvider` URL prefill, all 4 public lead Server Actions + `cms.ts` delegation, off-home `/?trackRef=` continuity, and Admin Dossier / Messages / CSV attribution telemetry (`SEO-004`–`006`, `024`, `025`, `029`–`031`).
3. **Milestone 3 — Unified Gate B Test Harness & Score Capture (`Wave 6C` · `F-SEO-QA`)**:
   - Author `tests/seo/**`, `tests/integration/seo-utm-attribution.integration.test.ts`, Playwright `tests/e2e/j23-seo-crawl-and-attribution.spec.ts`, post-fix `nextjs_seo_geo_cli.py` score report (`>= 90/100`), and `docs/audit/seo/03-seo-fix-log.md` (`SEO-026`).
4. **Milestone 4 — Independent Gate B Verification & Release Sign-Off (`Wave 7`)**:
   - Independent verifiers prove `GB-01`..`GB-08` (`100%` `SEO-001`..`SEO-031` closed) and zero Gate A regression (`J1`–`J22` + `J23` green), producing `docs/audit/seo/04-seo-verification.md` and `docs/audit/SEO_READINESS.md`.

---

## 6. Gate B Acceptance Criteria (`GB-01` – `GB-08`)

Phase B (`Spec 0025`) is certified **SEO & GEO Production-Ready** if and only if all 8 criteria pass empirically:

| Gate ID | Acceptance Criterion | Required Empirical Proof |
| :--- | :--- | :--- |
| **`GB-01`** | **Discovery, Crawl & `noindex` Hygiene** | `/robots.txt` (`200`), `/sitemap.xml` (`200` valid XML), and `/llms.txt` (`200`) resolve cleanly; `sitemap.xml` includes `100%` of indexable hubs & active `/umrah-packages/[slug]` URLs (`200 OK`) and `0` `/admin`, `/api`, `/voucher`, `/quote`, or `404` URLs; `proxy.ts` emits `X-Robots-Tag: noindex, nofollow` on `/admin/*`, `/api/*`, `/voucher/*`, `/quote/*`; locked `/voucher/[token]` returns HTTP `403`; `PublicFooter` has `0` `/admin` or `www.` self-links. |
| **`GB-02`** | **Meta CTR (`50–60`c / `150–160`c), Canonicals & `1200×630` OG** | Every indexable public route (`#1`–`#19`) renders a unique `<title>` (`50–60` chars), `<meta name="description">` (`150–160` chars), self-referencing `<link rel="canonical" href="https://alramlahtravels.com/...">` (query-free), `og:locale="en_PK"`, `twitter:card="summary_large_image"`, and a `1200×630` OG image (`0` `/logo.jpg` OG cards; `0` `localhost` leaks). |
| **`GB-03`** | **Hub-and-Spoke Completeness & `>=50%` Differentiation** | All `19` route patterns (`/` + `18` hubs/spokes/dynamic `[slug]`) render `200 OK` with exactly one semantic `<h1>`, `dynamicParams = false` returns `404` on non-whitelisted city slugs (`from-peshawar`), and pairwise 4-gram Jaccard similarity across sibling city/guide spokes (`lahore`/`karachi`/`islamabad`, `makkah`/`madinah`) confirms `>= 50%` unique body content. |
| **`GB-04`** | **Entity NAP Parity & Penalty-Free JSON-LD Schema** | Verbatim Askari 10 Lahore Cantt NAP + E.164 `tel:+92...` links + `سفريات الرملة` Arabic brand match `100%` across `TravelAgency` JSON-LD, `PublicHeader`, `PublicFooter`, `/about`, `/contact`, and `/llms.txt`; all JSON-LD blocks parse cleanly with XSS escaping, `0` fabricated `AggregateRating`, `0` `<= 0` or volatile `Offer.price`, and `1:1` visible DOM parity on `FAQPage` & `BreadcrumbList`. |
| **`GB-05`** | **AI Search (GEO) Liftability & Haramain Invariants** | Answer-first summaries (`40–60`w), semantic `<table>` / `<ul>` blocks, and 6-dimension AI fan-out FAQs render in static server HTML; all 9 Haramain business invariants (`<=30d`/`>30d` visa rule, `"Live Rate"` volatile lock with `0` wholesale SAR leaks in RSC props, `JED` Makkah lock, infant `0`-bed/`0`-seat + `infantPricePkr`, `0`-tier `"On Request"`, `OD-09e` Hajj 2027 Indicative disclaimers, `OD-10` truthful licenses) pass automated assertions. |
| **`GB-06`** | **Zero-Orphan Internal Link Graph & Spoke-to-Builder Prefill** | `0` orphan public routes; every money hub/spoke has `>= 3` contextual inbound `<Link>` sources with descriptive anchor text + `<PublicBreadcrumbs />`; deep links (`?preset=visa_only`, `?departureCity=LHE`, `?hotelId=...`) override stale `sessionStorage` inside `<Suspense>` without breaking `/` ISR. |
| **`GB-07`** | **End-to-End First-Touch Attribution (`UtmTracker` → DB → Admin & CSV)** | Landing on `/umrah-packages/from-lahore?utm_source=google&utm_medium=cpc&utm_campaign=ramadan_2027`, navigating internally, and submitting any of the 4 lead forms persists all 7 attribution columns in PostgreSQL, displays Acquisition badges in Admin Application Dossier / Contact Messages, and exports formula-safe columns in Admin CSV. |
| **`GB-08`** | **CWV / RSC Budgets, Score Target (`>= 90/100`) & Zero Gate A Regression** | `HeroSlider` mounts a single initial LCP image with Next.js 16 `preload` (`0` deprecated `priority` props in public/layout components); new spoke pages are `>= 80%` RSC; `nextjs_seo_geo_cli.py score-report` achieves **`>= 90.0 / 100` (Grade `A`)**; and `npm run typecheck`, `npm run lint`, `npm run build`, full Vitest (`Gate A` + `tests/seo/**`), and Playwright `J1`–`J23` pass `100%` green. |
