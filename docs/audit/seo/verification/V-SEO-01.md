# Wave 7 Independent Adversarial SEO & GEO Verification — `V-SEO-01`

- **Verifier**: `v-seo-01` (Independent Zero-Trust Adversarial Verifier)
- **Target Branch / Commit**: `audit/production-hardening` (`HEAD` = `e95b9f1`)
- **Assigned Gate B Criteria**: `GB-01`, `GB-02`, `GB-04`, `GB-08`
- **Assigned Canonical Backlog Slice (`20` `SEO-ID`s)**: `SEO-001`–`SEO-014`, `SEO-021`–`SEO-023`, `SEO-026`–`SEO-028`
- **Governing Contracts**:
  - [`docs/specs/0025-public-site-seo-readiness.md`](file:///c:/dev/al-ramlah-travels/web/docs/specs/0025-public-site-seo-readiness.md) (§2–§6)
  - [`docs/audit/seo/02-seo-triage.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/02-seo-triage.md)
  - [`docs/audit/seo/03-seo-fix-log.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/03-seo-fix-log.md)
  - [`docs/audit/seo/post-fix/score_report.md`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/post-fix/score_report.md) & [`score_report.json`](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/post-fix/score_report.json)

---

## 1. Executive Verdict Summary

Independent source-level inspection at `HEAD e95b9f1` and live Vitest execution (`npx vitest run tests/seo/ tests/w6/f-seo-plat/ tests/w6/f-seo-trust/` -> **`6/6` files, `26/26` tests PASS**) confirm that **3 of 4 assigned Gate B criteria (`GB-02`, `GB-04`, `GB-08`) pass `100%` unconditionally**, and **`19 / 20` assigned canonical `SEO-ID`s are `VERIFIED-CLOSED`**.

Adversarial source inspection uncovered **1 genuine omission (`SEO-007` — `REOPENED`, `P1` per triage / low blast-radius surgical fix)** that `03-seo-fix-log.md:47` silently glossed over:

- **`SEO-007` (`REOPENED` — Missing `VERCEL_ENV !== "production"` Preview Disallow Guard & Bulk-Scraper Block in `app/robots.ts`)**:
  - **Contract Requirement**: `Spec 0025` §2.1 (`L39–40`), `02-seo-triage.md` (`SEO-007`, `L108–113`), and `S01-001`/`S01-003` explicitly require `app/robots.ts` to return `{ rules: [{ userAgent: "*", disallow: "/" }] }` (with no `sitemap`) when `process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production"`, and to disallow bulk scrapers (`CCBot`, `Bytespider`) in production, backed by a unit test mocking `VERCEL_ENV="preview"`.
  - **Live Code Reality (`app/robots.ts:1-37`)**: `robots()` contains **zero** `VERCEL_ENV` inspection (`0` occurrences across `app/`, `lib/`, `components/`). On a non-production Vercel Preview deployment (`VERCEL_ENV="preview"`), `/robots.txt` unconditionally emits `Allow: /` and `Sitemap: https://alramlahtravels.com/sitemap.xml`. Neither `tests/w6/f-seo-plat/discovery-proxy-and-seed.test.tsx:50-63` nor `tests/seo/gate-b-seo-invariants.test.ts:476-486` tests `VERCEL_ENV="preview"`, and `CCBot`/`Bytespider` are absent from `app/robots.ts`.
  - **Exact Surgical Fix for `@v-release`** (safe for `J23a` where `VERCEL_ENV` is unset):
    1. In `app/robots.ts:11`, guard `const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase(); if (vercelEnv && vercelEnv !== "production") { return { rules: [{ userAgent: "*", disallow: "/" }] } }` and add `{ userAgent: ["CCBot", "Bytespider"], disallow: "/" }` to production `rules`.
    2. Add a `VERCEL_ENV="preview"` assertion (restoring `process.env.VERCEL_ENV` in `finally`) in `tests/w6/f-seo-plat/discovery-proxy-and-seed.test.tsx`.

| Gate ID | Criterion | Verdict | Summary Evidence (`HEAD e95b9f1`) |
| :--- | :--- | :---: | :--- |
| **`GB-01`** | Discovery, Crawl & `noindex` Hygiene | **CONDITIONAL (`SEO-007` preview guard)** | Prod `/robots.txt`, `/sitemap.xml` (`revalidate = 3600`, 18 hubs + active `[slug]`s, `0` private URLs), `/llms.txt` (`0` `/admin`/`/voucher`), `proxy.ts` `X-Robots-Tag`, `app/admin/layout.tsx` `noindex`, `/voucher/[token]` HTTP `403` `forbidden()`, `www`->apex `308`/`301`, and `PublicFooter` (`0` `/admin`/`www.`) ALL verified; `app/robots.ts:11-36` lacks `VERCEL_ENV !== "production"` preview guard (`SEO-007`). |
| **`GB-02`** | Meta CTR (`50–60`c / `150–160`c), Canonicals & `1200×630` OG | **PASS** | `19/19` public route patterns measured strictly in `54–58`c (`<title>`) and `150–157`c (`description`); query-free `https://alramlahtravels.com` self-canonicals; `og:locale="en_PK"`, `twitter:card="summary_large_image"`; `1200×630` PNG `opengraph-image.tsx` (`0` `/logo.jpg` OG cards, `0` `localhost` leaks). |
| **`GB-04`** | Entity NAP Parity & Penalty-Free JSON-LD Schema | **PASS** | `100%` Askari 10 Lahore Cantt, Pakistan NAP + E.164 `tel:+923274029701` / `tel:+923190462638` + `سفريات الرملة` `<ArabicText lang="ar" dir="rtl">` parity across all 8 surfaces; `serializeJsonLd()` escapes `<`/`>`/`&`/`\u2028`/`\u2029`; `0` `AggregateRating`/`Review`, `0` `<=0` or volatile `Offer.price`, `0` Hajj `InStock`, `OD-10` license gate, and `1:1` DOM/`FAQPage` parity on `/` and `/faq`. |
| **`GB-08`** | CWV / RSC Budgets & Score Target (`>= 90.0 / 100`) | **PASS** | `HeroSlider` mounts strictly Slide `0` on SSR with `preload={idx === 0}` (`0` deprecated `priority` props across all public/layout/seo files); `MarketingSections` is a zero-JS Server Component; public/spoke surface is **`97.44%` RSC** (`11,331` RSC LOC vs `298` client island LOC, well above `>=80%`); empirical score **`90.2 / 100` (Grade `A`)**. |

---

## 2. Detailed Gate-by-Gate Forensic Evidence

### 2.1 `GB-01` — Discovery, Crawl & `noindex` Hygiene

1. **`app/robots.ts` (`L1-37`)**:
   - Production rules allow `"/"` and disallow `["/admin/", "/api/", "/voucher/", "/quote/"]` (`L4-9, 14-18`) for `*` and explicitly for AI citation/grounding agents (`OAI-SearchBot`, `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `Claude-SearchBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended` at `L20-32`), emitting `sitemap: "https://alramlahtravels.com/sitemap.xml"` and `host: "https://alramlahtravels.com"` (`L34-35`).
   - **Adversarial Finding (`SEO-007` Reopened)**: Missing `process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production"` preview index-block and `CCBot`/`Bytespider` scraper disallow (`Spec 0025:39-40`, `02-seo-triage.md:112`).
2. **`app/sitemap.ts` (`L1-307`)**:
   - Exports `revalidate = 3600` (`L7`) and deterministic `FALLBACK_LAST_MODIFIED = new Date("2026-11-15T00:00:00.000Z")` (`L9` — zero `new Date()` spam).
   - Emits all `18` static/city/guide hubs (`L186-295`) plus active `/umrah-packages/${encodeURIComponent(pkg.slug)}` spokes (`L98-104, 122-131, 297-304`) sharing the exact `groupPackages.isActive = true` visibility predicate used by `getPublicGroupPackageBySlug` (`lib/seo/public-queries.ts:282-286`).
   - Computes truthful multi-table freshness: `maxDate(pkgDate, depDate)` across `groupPackages.updatedAt` and `MAX(groupDepartures.updatedAt)` (`L105-130`), city-grouped `MAX(hotels.updatedAt)` for `makkah` and `madinah` (`L77-84, 133-134`), `MAX(hajjPackages.updatedAt)` (`L66-71`), `MAX(visaRates.updatedAt)` (`L72-76`), `MAX(ziyaratPlaces.updatedAt)` (`L86-90`), and `MAX(faqs.updatedAt)` (`L91-96`), wrapped in `try/catch` build-time static-hub fallback (`L162-174`). Contains `0` `/admin`, `/api`, `/voucher`, or `/quote` URLs.
3. **`public/llms.txt` (`L1-53`)**:
   - Valid `llms.txt` Markdown manifest (`# Al Ramlah Travels`, `سفريات الرملة`, verbatim Askari 10 Lahore Cantt NAP at `L7-15`, Haramain invariants at `L16-30`, and `18` canonical `https://alramlahtravels.com/...` links at `L31-53`). Verified `0` `/admin`, `/api`, `/voucher`, or `/quote` substrings.
4. **Dual-Layer `noindex` & HTTP `403` Locked Voucher**:
   - `proxy.ts:83-98`: Emits `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` on `/admin`, `/admin/*`, `/api`, `/api/*`, `/voucher`, `/voucher/*`, `/quote`, and `/quote/*` while leaving public routes header-free.
   - `app/admin/layout.tsx:9-22`: Server Component layout exporting `robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true }` (protecting statically prerendered `/admin/login`).
   - `app/(public)/voucher/[token]/page.tsx:26-38, 51-56` + `forbidden.tsx:6-59`: Sets `robots.index: false` (no `alternates.canonical`), calls Next.js `forbidden()` (`L55`, enabled by `experimental.authInterrupts: true` in `next.config.ts:196`) when `!resolved.allowed && resolved.httpStatus !== 404`, and renders `data-voucher-status="403"` in `forbidden.tsx:15`.
5. **Host & Legacy Admin Redirects**:
   - `next.config.ts:217-232`: Permanent (`308`) host redirect from `www.alramlahtravels.com` to `https://alramlahtravels.com/:path*` (`L217-227`) and `/admin/social` -> `/admin/campaigns?tab=social` (`permanent: true`, `L228-232`).
   - `nginx/nginx.conf:65-77`: Dedicated `server_name www.alramlahtravels.com;` block on ports `80` and `443 ssl` returning `301 https://alramlahtravels.com$request_uri;`.
   - `components/layout/public-footer.tsx:222-228, 253-389`: `0` `/admin` links and `0` `www.` links (`BRAND_WEBSITE_DOMAIN` = `"alramlahtravels.com"` linked internally via `<Link href="/">`).

---

### 2.2 `GB-02` — Meta CTR (`50–60`c / `150–160`c), Canonicals & `1200×630` OpenGraph

Direct character-length verification across all `19` public route patterns (`lib/seo/metadata.ts:176-246` sets `title: { absolute: resolvedTitle }` preventing double-suffixing from `app/layout.tsx:52`):

| # | Route Pattern | Source File:Line | Exact `<title>` (`Len`) | `<meta name="description">` `Len` | Canonical (`https://alramlahtravels.com...`) |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `/` | `app/(public)/page.tsx:50-55` | `Umrah Packages Pakistan & Hajj 2027 \| Al Ramlah Travels` (**`55c`**) | **`151c`** | `https://alramlahtravels.com` |
| 2 | `/umrah-packages` | `components/seo/umrah-pricing-helpers.ts:114-121` | `Group Umrah Packages 2026–2027 in PKR \| Al Ramlah Travels` (**`57c`**) | **`150c`** | `.../umrah-packages` |
| 3 | `/umrah-packages/[slug]` | `components/seo/umrah-pricing-helpers.ts:128-199` | Deterministic `buildUmrahPackageSlugMetadata()` (**`50–60c`** across all seeded DB slugs) | **`150–160c`** | `.../umrah-packages/{slug}` |
| 4 | `/umrah-packages/from-lahore` | `components/seo/umrah-pricing-helpers.ts:205-210` | `Umrah Packages from Lahore (LHE) 2027 \| Al Ramlah Travels` (**`57c`**) | **`150c`** | `.../umrah-packages/from-lahore` |
| 5 | `/umrah-packages/from-karachi` | `components/seo/umrah-pricing-helpers.ts:211-216` | `Umrah Packages from Karachi (KHI) 2027 \| Al Ramlah Travels` (**`58c`**) | **`151c`** | `.../umrah-packages/from-karachi` |
| 6 | `/umrah-packages/from-islamabad` | `components/seo/umrah-pricing-helpers.ts:217-222` | `Umrah Packages from Islamabad (ISB) \| Al Ramlah Travels` (**`55c`**) | **`151c`** | `.../umrah-packages/from-islamabad` |
| 7 | `/hajj-2027` | `components/seo/guides-hajj-data.ts:4-10` | `Hajj 2027 Packages Pakistan & Maktab \| Al Ramlah Travels` (**`56c`**) | **`151c`** | `.../hajj-2027` |
| 8 | `/umrah-visa` | `components/seo/guides-visa-data.ts:5-11` | `Saudi Umrah Visa Price Pakistan (PKR) \| Al Ramlah Travels` (**`57c`**) | **`153c`** | `.../umrah-visa` |
| 9 | `/hotels/makkah` | `components/seo/guides-hotels-data.ts:312-316` | `Makkah Hotels Near Masjid al-Haram \| Al Ramlah Travels` (**`54c`**) | **`155c`** | `.../hotels/makkah` |
| 10 | `/hotels/madinah` | `components/seo/guides-hotels-data.ts:439-443` | `Madinah Markaziyah Hotels Near Haram \| Al Ramlah Travels` (**`56c`**) | **`154c`** | `.../hotels/madinah` |
| 11 | `/ziyarat` | `components/seo/guides-ziyarat-data.ts:16-22` | `Makkah & Madinah Ziyarat Guide & Tours \| Al Ramlah Travels` (**`58c`**) | **`155c`** | `.../ziyarat` |
| 12 | `/ziyarat/makkah` | `components/seo/guides-ziyarat-data.ts:341-345` | `Sacred Makkah Ziyarat Places & Guide \| Al Ramlah Travels` (**`56c`**) | **`157c`** | `.../ziyarat/makkah` |
| 13 | `/ziyarat/madinah` | `components/seo/guides-ziyarat-data.ts:458-462` | `Sacred Madinah Ziyarat Places & Guide \| Al Ramlah Travels` (**`57c`**) | **`155c`** | `.../ziyarat/madinah` |
| 14 | `/about` | `app/(public)/about/page.tsx:25-30` | `About Our Askari 10 Lahore Cantt Desk \| Al Ramlah Travels` (**`57c`**) | **`154c`** | `.../about` |
| 15 | `/contact` | `app/(public)/contact/page.tsx:35-40` | `Contact Lahore Cantt Umrah Desk & Map \| Al Ramlah Travels` (**`57c`**) | **`153c`** | `.../contact` |
| 16 | `/faq` | `app/(public)/faq/page.tsx:20-25` | `Umrah, Saudi Visa & Hajj 2027 FAQs \| Al Ramlah Travels` (**`54c`**) | **`151c`** | `.../faq` |
| 17 | `/privacy` | `app/(public)/privacy/page.tsx:15-20` | `Privacy Policy & Pilgrim Data Safety \| Al Ramlah Travels` (**`56c`**) | **`153c`** | `.../privacy` |
| 18 | `/terms` | `app/(public)/terms/page.tsx:14-19` | `Terms of Service & Booking Conditions \| Al Ramlah Travels` (**`57c`**) | **`151c`** | `.../terms` |
| 19 | `/refund-policy` | `app/(public)/refund-policy/page.tsx:15-20` | `Booking Cancellation & Refund Policy \| Al Ramlah Travels` (**`56c`**) | **`152c`** | `.../refund-policy` |

- **OpenGraph, Twitter & `1200×630` Image Verification**:
  - `lib/seo/metadata.ts:13-37`: `getCanonicalSiteUrl()` rejects `localhost`, `127.0.0.1`, `.local`, `.ngrok-free.app`, `.trycloudflare.com`, and `http:`, normalizing `www.alramlahtravels.com` to `https://alramlahtravels.com` (`0` `localhost` leaks across `app/`, `lib/seo/`, `components/seo/`).
  - `lib/seo/metadata.ts:120-129, 196-221`: Strips `?` and `#` from canonicals, sets `openGraph.locale = "en_PK"`, `siteName = "Al Ramlah Travels"`, and `twitter.card = "summary_large_image"`.
  - `lib/seo/og-card.tsx:9-14, 28-246`, `app/opengraph-image.tsx:1-25`, and `app/(public)/umrah-packages/[slug]/opengraph-image.tsx:1-77`: Export `size = { width: 1200, height: 630 }` and `contentType = "image/png"` styled in `#0A3622` / `#C5A059` / `#FAF7F0`. Full-repo AST scan confirmed **`0` `openGraph` or `twitter` references to `680×610` `/logo.jpg`**.

---

### 2.3 `GB-04` — Entity NAP Parity & Penalty-Free JSON-LD Schema

1. **8-Surface Verbatim NAP, E.164 `tel:` & `<ArabicText>` Parity**:
   - **Canonical SSOT (`lib/constants/brand.ts:11-45` & `lib/company-info.ts:78-79, 116-187`)**:
     - Entity: `Al Ramlah Travels` · Arabic: `سفريات الرملة` wrapped in `<ArabicText>` (`components/public/arabic-text.tsx:19-25`: `lang="ar" dir="rtl"` + `unicodeBidi: "isolate"`).
     - Address: `Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan`.
     - Phones: `toTelHref()` -> `tel:+923274029701` & `tel:+923190462638`; `formatPkPhoneDisplay()` -> `+92 327 4029701` & `+92 319 0462638`.
     - Email / Origin: `alramlahtravels@gmail.com` · `https://alramlahtravels.com`.
   - **Verified Identical Across All 8 Surfaces**: `lib/constants/brand.ts:11-45`, `lib/company-info.ts:78-79,155-187`, `lib/seo/json-ld.ts:106-221`, `components/layout/public-header.tsx:101-158,218-224`, `components/layout/public-footer.tsx:121-233`, `app/(public)/about/page.tsx:81-87,122-161`, `app/(public)/contact/page.tsx:64-197` (+ `components/public/contact-section.tsx:139-258`), and `public/llms.txt:5-15`. *(Note: the phone format warning in `post-fix/score_report.json:32-38, 649-720` originates solely from unit test fixtures in `tests/w3/**` and JSDoc comments in `lib/phone.ts` — `0` conflicting numbers exist on any public route or component.)*
2. **XSS-Safe & Penalty-Free JSON-LD (`lib/seo/json-ld.ts:1-673`)**:
   - `serializeJsonLd()` (`L42-50`): Escapes `<` -> `\u003c`, `>` -> `\u003e`, `&` -> `\u0026`, `\u2028` -> `\u2028`, `\u2029` -> `\u2029`.
   - **Zero `AggregateRating` / `Review`**: `stripUndefinedDeep()` (`L26-29`) strips `aggregateRating` and `review` keys recursively at serialization time; `0` occurrences across all 19 rendered routes (`gate-b-seo-invariants.test.ts:669-671`).
   - **Zero `<= 0` or Volatile `Offer.price`**: `buildUmrahPackageJsonLd()` (`L372-408`) filters `tier.price > 0` before computing `AggregateOffer` (`OD-09b`); `buildHotelItemListJsonLd()` (`L574-617`) and `buildTouristAttractionListJsonLd()` (`L631-673`) emit `0` `Offer` or `price` fields (`OD-09c`).
   - **Zero `InStock` / `Product` on `/hajj-2027`**: `buildHajjServiceJsonLd()` (`L470-509`) emits `Service` + indicative pre-registration `OfferCatalog` (`OD-09e`).
   - **DB-Gated Licenses (`OD-10`)**: `buildTravelAgencyJsonLd()` (`L126-142, 219`), `PublicFooter` (`L132-141`), and `TrustEeatCredentials` (`L47-108`) omit `dtsLicense`, `moraLicense`, `iataCode`, and `ntnNumber` whenever `null`/empty in `agencySettings`.
   - **`1:1` Visible DOM / `FAQPage` Parity**: `/` (`app/(public)/page.tsx:359-360` + `components/public/faq-accordion-client.tsx:49` `keepMounted`) and `/faq` (`app/(public)/faq/page.tsx:34-35, 219-240` `<details open>`) generate `FAQPage` JSON-LD from the exact array rendered in SSR HTML.

---

### 2.4 `GB-08` — CWV / RSC Budgets & Empirical Score (`>= 90.0 / 100`)

1. **Single-Image Hero LCP & Next.js 16 `preload` Hygiene**:
   - `components/public/hero-slider.tsx:122-126, 175-206`: Uses `useSyncExternalStore` (`hasHydrated` = `false` on SSR) so `shouldMountSlide = idx === 0 || hasHydrated` (`L176`) mounts **strictly Slide `0`** in initial server HTML, with `preload={idx === 0}` (`L198`).
   - `components/layout/public-header.tsx:213, 298` & `public-footer.tsx:168`: Use `loading="eager"` on small emblems; `app/layout.tsx:32, 40` sets `preload: false` on secondary fonts (`JetBrains_Mono`, `Amiri`).
   - Full AST scan across `app/(public)/**` and `components/{public,layout,seo}/**` confirmed **`0` deprecated `priority` props** on `next/image`.
2. **RSC-First Architecture (`>= 80%` Budget)**:
   - `components/public/marketing-sections.tsx:1-606` has **no `"use client"` directive** (zero-JS Server Component), isolating interactive accordion state into the 58-line `components/public/faq-accordion-client.tsx` leaf island.
   - Across all `36` files in `app/(public)/**` (excluding transactional `voucher/`) and `components/seo/**`, **`34 / 36` files (`11,331 / 11,629` LOC = `97.44%`) are Server Components**, with only `2` leaf client islands (`umrah-package-booking-cta.tsx` `272` LOC + `utm-tracker.tsx` `26` LOC = `298` LOC, `2.56%`) — exceeding the `>= 80%` RSC budget by `+17.44` percentage points (`codebase_audit` in `score_report.json:106` also confirms `client_component_routes: 0` across all `40` `page.tsx` routes).
3. **Empirical Post-Fix Score (`docs/audit/seo/post-fix/score_report.json:1-31`)**:
   - **Overall Score**: **`90.2 / 100` (Grade `A`)**, exceeding the `>= 90.0 / 100` Gate B threshold (`+35.7` over the `54.5 / 100` Grade `D` Wave 5 baseline):
     - P1 Technical SEO & CWV: **`20.0 / 20`**
     - P2 Meta & CTR Optimization: **`15.0 / 15`**
     - P3 Hub-and-Spoke & `>=50%` Differentiation: **`13.0 / 15`**
     - P4 Entity NAP & JSON-LD Schema: **`12.0 / 15`**
     - P5 AI Search (GEO) Liftability: **`15.2 / 20`**
     - P6 Internal Linking & Zero Orphans: **`15.0 / 15`**

---

## 3. Canonical `SEO-ID` Closure Matrix (`SEO-001`–`SEO-014`, `SEO-021`–`SEO-023`, `SEO-026`–`SEO-028`)

| `SEO-ID` | Sev | Raw Findings | Status | Independent Source & Test Evidence (`HEAD e95b9f1`) |
| :--- | :-: | :--- | :---: | :--- |
| **`SEO-001`** | `P0` | `S09-001`..`003`, `S16-001`, `S16-002` | **`VERIFIED-CLOSED`** | `lib/seo/json-ld.ts:26-50` (`serializeJsonLd` escaping + `aggregateRating`/`review` strip), `L106-673` (`TravelAgency`, `WebSite`, `BreadcrumbList`, `FAQPage`, `TouristTrip` `price > 0`, `Service`, `ItemList` `0` volatile `Offer.price`, `OD-10` license gate); `tests/w6/f-seo-plat/json-ld-and-breadcrumbs.test.tsx` PASS. |
| **`SEO-002`** | `P0` | `S15-002` | **`VERIFIED-CLOSED`** | `lib/seo/public-queries.ts:46-77,414-505` + `components/seo/trust-home-overview.tsx:98-223` (`sanitizeHomePlannerCatalog` wired at `app/(public)/page.tsx:217-225`) strip all hotel/vehicle wholesale `*Sar` & `updatedByUserId` keys; `discovery-proxy-and-seed.test.tsx:255-266` PASS. |
| **`SEO-003`** | `P0` | `S14-001` | **`VERIFIED-CLOSED`** | `drizzle/0003_seo_lead_attribution.sql:1-16`, `db/schema/applications.ts:212-218,250-253`, `db/schema/cms.ts:132-138,150`, `lib/seo/utm.ts:1-402` (`alramlah_attribution_v1`, sanitizer, channel inference); `tests/w6/f-seo-plat/utm-attribution.test.ts` (`4/4` PASS). |
| **`SEO-004`** | `P0` | `S14-002`, `S14-003` | **`VERIFIED-CLOSED`** | `components/seo/utm-tracker.tsx:12-25` inside `<React.Suspense>` in `app/(public)/layout.tsx:17-19`; `strictAttributionSchema` in `lib/validations/{application,cms}.ts` & persisted in `app/actions/applications.ts:1091,1571,1812,2438`. |
| **`SEO-005`** | `P0` | `S05-002`, `S13-001`, `S13-002`, `S13-005` | **`VERIFIED-CLOSED`** | `components/layout/public-header.tsx:54-62` & `public-footer.tsx:70-99,222-228` render crawlable `<Link>` graph with `0` `/admin` and `0` `www.` links; `gate-b-seo-invariants.test.ts` `GB-06` PASS. |
| **`SEO-006`** | `P0` | `S05-004`, `S15-001` | **`VERIFIED-CLOSED`** | `components/planner/planner-context.tsx:543,1016,2789` (`parsePlannerUrlPrefill` + `<Suspense>` `<PlannerUrlHydrator />`) + `custom-journey-builder.tsx:30-64` (`next/dynamic` Steps 2–6). |
| **`SEO-007`** | `P1` | `S01-001`, `S01-003` | **`REOPENED`** | Prod allow/disallow & AI citation bot rules work (`app/robots.ts:11-36`), **but** `process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production"` preview index-block (`disallow: "/"`) and `CCBot`/`Bytespider` disallow required by `Spec 0025:39-40` & `02-seo-triage.md:108-113` are missing (`0` `VERCEL_ENV` checks in repo; untested for preview). |
| **`SEO-008`** | `P1` | `S01-002`, `S01-005` | **`VERIFIED-CLOSED`** | `app/sitemap.ts:7,49-175,177-307` (`revalidate = 3600`, 18 static/city/guide hubs + active `[slug]` spokes, multi-table `MAX(updatedAt)` freshness, DB fallback, `0` private URLs); `discovery-proxy-and-seed.test.tsx:64-90` PASS. |
| **`SEO-009`** | `P1` | `S02-001`..`003`, `S04-001`, `S04-005`, `S12-001` | **`VERIFIED-CLOSED`** | `lib/constants/brand.ts:33-34`, `lib/seo/metadata.ts:13-37,176-246`, `app/layout.tsx:43-86`, `next.config.ts:217-227` (`www` `308`), `nginx/nginx.conf:65-77` (`www` `301`); `metadata-and-nap.test.ts` PASS. |
| **`SEO-010`** | `P1` | `S04-004`, `S04-006` | **`VERIFIED-CLOSED`** | `lib/seo/og-card.tsx:9-246` (`1200×630` PNG), `app/opengraph-image.tsx:1-25`, `app/(public)/umrah-packages/[slug]/opengraph-image.tsx:1-77`; `0` `/logo.jpg` OG references. |
| **`SEO-011`** | `P1` | `S02-004`, `S02-005`, `S16-004` | **`VERIFIED-CLOSED`** | `proxy.ts:83-98` (`X-Robots-Tag`), `app/admin/layout.tsx:9-22` (`noindex`), `app/(public)/voucher/[token]/page.tsx:51-56` + `forbidden.tsx:15` (`forbidden()` HTTP `403` + `data-voucher-status="403"`), `next.config.ts:196,228-232` (`authInterrupts: true`, `/admin/social` `308`). |
| **`SEO-012`** | `P1` | `S03-003`, `S06-004`, `S08-005`, `S10-002`..`004`, `S12-002`, `S12-003`, `S16-006` | **`VERIFIED-CLOSED`** | `lib/company-info.ts:78-79,116-187,292-298`, `components/public/public-utils.ts:375-385` (`formatPkr`), `arabic-text.tsx:18-27`, `lib/seo/slugs.ts:191-230` (`marketing-ops.ts:1396`), `lib/seo/revalidate-public.ts:32-62` (`catalog.ts:233`, `marketing-ops.ts:1628,1714,1790,3502`). |
| **`SEO-013`** | `P1` | `S06-003`, `S07-004`, `S08-002`, `S08-004`, `S16-003` | **`VERIFIED-CLOSED`** | `db/seed.ts:32-57,100-207` + `discovery-proxy-and-seed.test.tsx:172-254` (rolling PKT departures across `pkg1`–`pkg4` & `LHE`/`KHI`/`ISB`, 4 Hajj Maktabs `A+`/`A`/`B`/`C`, `hotels.validUntil` `+400d`, Masjid Quba mosque photo, `12+` FAQs). |
| **`SEO-014`** | `P1` | `S09-005`, `S13-004` | **`VERIFIED-CLOSED`** | `components/layout/breadcrumbs.tsx:29-78` (`<PublicBreadcrumbs />` using `@base-ui/react` `render` prop at `L61`, `0` `asChild`, 1-indexed `BreadcrumbList` JSON-LD at `L47`); `json-ld-and-breadcrumbs.test.tsx` PASS. |
| **`SEO-021`** | `P1` | `S10-001`, `S10-005` | **`VERIFIED-CLOSED`** | `app/(public)/about/page.tsx:25-351`, `app/(public)/contact/page.tsx:35-344`, `components/seo/trust-eeat-credentials.tsx:21-192` (Askari 10 NAP, E.164 `tel:`, PKT schedule `<table>`, `OD-10` truthful license gate); `trust-spokes.test.ts` `(b4)` PASS. |
| **`SEO-022`** | `P1` | `S09-004`, `S11-002`, `S11-004`, `S11-005` | **`VERIFIED-CLOSED`** | `app/(public)/faq/page.tsx:20-284` + `components/seo/trust-faq-fanout-data.ts:8-368` (`20`+ categorized Q&As across all 6 AI fan-out dimensions, live `visa_rates` PKR interpolation, `1:1` `<details open>` DOM/`FAQPage` parity); `trust-spokes.test.ts` `(b3)` PASS. |
| **`SEO-023`** | `P1` | `S03-001`, `S03-002`, `S04-002`, `S05-003`, `S11-001`, `S11-003`, `S12-004`, `S13-003` | **`VERIFIED-CLOSED`** | `app/(public)/page.tsx:47-55,378-427`, `components/public/hero-slider.tsx:40,175-206,227-233` (stable `<h1>`, Slide `0` `preload`, lazy slides `1..N`, `0` `"15,000+"`), RSC `marketing-sections.tsx:169-606` + `faq-accordion-client.tsx:49` (`keepMounted`) + `trust-home-overview.tsx:312-428`. |
| **`SEO-026`** | `P1` | `S16-005` | **`VERIFIED-CLOSED`** | `tests/seo/gate-b-seo-invariants.test.ts` (`5/5` PASS), `tests/integration/seo-utm-attribution.integration.test.ts`, `tests/e2e/j23-seo-crawl-and-attribution.spec.ts`, `docs/audit/seo/post-fix/score_report.{json,md}` (`90.2/100` Grade `A`). |
| **`SEO-027`** | `P2` | `S01-004`, `S03-004` | **`VERIFIED-CLOSED`** | `public/llms.txt:1-53` (`0` `/admin`/`/voucher` URLs, verbatim Askari 10 NAP) + `app/layout.tsx:27-41` (`preload: false` on `JetBrains_Mono` & `Amiri`, `subsets: ["arabic"]`). |
| **`SEO-028`** | `P2` | `S04-003`, `S13-007`, `S14-007` | **`VERIFIED-CLOSED`** | `app/(public)/{privacy,terms,refund-policy}/page.tsx` (`56–57c` titles, `151–153c` descriptions, `<PublicBreadcrumbs />`, `WebPage` JSON-LD, `/privacy` §3 `alramlah_attribution_v1` at `privacy/page.tsx:306-326`, `<TrustLegalCrosslinks />`); `trust-spokes.test.ts` `(c)` PASS. |
