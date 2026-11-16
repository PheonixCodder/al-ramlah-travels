# 04 — Wave 7 Independent Adversarial SEO, GEO & Attribution Verification Report (Gate B Sign-Off)

- **Lead Release Certifier**: `v-release` (consolidating independent adversarial domain verifiers `v-seo-01` & `v-seo-02` + surgical closure of `SEO-007` preview guard & `desk/page.tsx` projection + authoritative single-tenant Gate A + Gate B execution)
- **Branch Verified**: `audit/production-hardening`
- **Wave 6 Baseline Commit**: `e95b9f1` (`W6A → W6B → W6C`)
- **Verification Date**: `2026-11-16`
- **Hermetic Execution Environment**: `.env.audit` + disposable PostgreSQL `16.16` (`alramlah-audit-pg` on `127.0.0.1:54329` + isolated `alramlah_audit_migtest`) + 5 local contract-fake HTTP servers (`127.0.0.1:3998`) + Next.js `16.4.6` standalone build (`127.0.0.1:3123`). Zero reads or connections to `web/.env`, `*.neon.tech`, live Cloudflare R2, live Meta WhatsApp Cloud API, live Resend, or live OpenRouter/Gemini endpoints.
- **Final Gate B Verdict**: **`GO — GATE B CERTIFIED (8 / 8 CRITERIA PASS · 90.2 / 100 GRADE A · ZERO GATE A REGRESSIONS)`**

---

## 1. Executive Reconciliation & Gate B Tally

Wave 7 subjected the unified Phase B codebase (`Spec 0025` — `Wave 6A` `020a609` → `Wave 6B` `d576094` → `Wave 6C` `e95b9f1`) to two independent zero-trust adversarial verifiers (`v-seo-01` and `v-seo-02`), followed by `v-release`'s surgical closure of the single reopened item (`SEO-007` non-production `VERCEL_ENV` preview disallow & `CCBot`/`Bytespider` scraper block in `app/robots.ts`) plus the `P3` column projection polish in `app/admin/(dashboard)/desk/page.tsx`, and an authoritative full-stack Gate A + Gate B execution pass.

### 1.1 Master Phase B Finding & Backlog Reconciliation (`100.0%` Accounted For)

| Severity Tier | Raw Findings (`S01`–`S16`) | Orphaned Raw Findings | Canonical Backlog Items (`SEO-001`..`SEO-031`) | `VERIFIED-CLOSED` on Initial W7 Pass | `REOPENED` in W7 → Surgically Fixed & Verified (`v-release`) | **Final Open Count at Gate B** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`P0` (Stop-Ship)** | `8` | `0` | **`6`** | `6 / 6` | `0` | **`0`** |
| **`P1` (High)** | `45` | `0` | **`20`** | `19 / 20` | `1` (`SEO-007` `app/robots.ts` preview guard → **FIXED**) | **`0`** |
| **`P2` (Medium)** | `34` | `0` | **`4`** | `4 / 4` | `0` | **`0`** |
| **`P3` (Polish)** | `1` | `0` | **`1`** | `1 / 1` | `+1` (`desk/page.tsx` projection note → **FIXED**) | **`0`** |
| **TOTAL** | **`88`** | **`0`** | **`31`** | **`30 / 31`** | **`1` `SEO-ID` + `1` `P3` note → `100%` FIXED** | **`0` Open (`31 / 31` Certified)** |

### 1.2 Wave 7 Domain Verifier Summary (`V-SEO-01`, `V-SEO-02` & `v-release`)

| Verifier | Report | Domain & Specialist Audits Re-Verified | Gates Owned | Independent Empirical Proof Executed | Initial W7 Findings | Final Verdict |
| :---: | :--- | :--- | :---: | :--- | :--- | :---: |
| **`v-seo-01`** | [V-SEO-01.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/verification/V-SEO-01.md) | Technical SEO, Discovery (`robots.ts`, `sitemap.ts`, `llms.txt`), Dual `noindex` & `403` Voucher, Meta CTR (`50–60`c / `150–160`c), `1200×630` OG, NAP & Penalty-Free JSON-LD, CWV / RSC (`97.44%` RSC) & Score (`90.2/100`) | `GB-01`, `GB-02`, `GB-04`, `GB-08` | Source AST scan across all `19` route patterns & `40` `page.tsx` files; `26/26` Vitest (`tests/seo/`, `f-seo-plat`, `f-seo-trust`); verified `90.2/100` Grade `A` CLI score | `1` item reopened: **`SEO-007`** (`VERCEL_ENV` preview disallow + `CCBot`/`Bytespider` in `app/robots.ts` — **FIXED by `v-release`**) | **PASS — GO** |
| **`v-seo-02`** | [V-SEO-02.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/verification/V-SEO-02.md) | 19-Route Hub-and-Spoke Completeness, `dynamicParams = false`, `93.36%`–`97.28%` 4-Gram Jaccard Uniqueness, GEO Liftability, Wholesale SAR Confidentiality, 9 Haramain Invariants, Zero-Orphan Link Graph & First-Touch UTM Attribution | `GB-03`, `GB-05`, `GB-06`, `GB-07` | Pairwise 4-gram Jaccard verification; `39/39` Vitest + real-PG `seo-utm-attribution.integration.test.ts` (`10/10` files PASS) | `0` reopened (`1` `P3` info note on `desk/page.tsx:306` secondary projection — **FIXED by `v-release`**) | **PASS — GO** |
| **`v-release`** | `04-seo-verification.md` & `SEO_READINESS.md` | Surgical Closure (`SEO-007` + `desk/page.tsx`) + Authoritative Single-Tenant Full-Stack Gate A + Gate B Suite (`audit`, `typegen`, `typecheck`, `lint`, `npm test`, `npm run build`, `npm run test:e2e`) | **`GA-01`..`GA-08`** & **`GB-01`..`GB-08`** | **`0` high/crit CVEs**; **`0` TS/ESLint errors**; **`731 / 731` unit/W3/W6/SEO/integration tests**; **`56 / 56` static build units + clean `.nft.json`**; **`26 / 26` Playwright E2E specs (`J1`–`J23`) + `0` Axe violations** | Closed `SEO-007` + `desk/page.tsx`; **`0` open `P0`/`P1`/`P2`/`P3`** | **GATE B CERTIFIED** |

---

## 2. Wave 7 Surfaced Items → Surgical Closure (`v-release`)

1. **`SEO-007` (`REOPENED` `P1` in `V-SEO-01.md` §1 → `FIXED & VERIFIED`)**:
   - **Gap Surfaced by `v-seo-01`**: [app/robots.ts](file:///c:/dev/al-ramlah-travels/web/app/robots.ts) enforced production allow/disallow and AI citation bot rules, but omitted the `process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production"` preview index-block (`{ rules: [{ userAgent: "*", disallow: "/" }] }`) and `CCBot`/`Bytespider` bulk-scraper disallow specified in `Spec 0025` §2.1 (`L39–40`) and `02-seo-triage.md` (`SEO-007`).
   - **Surgical Fix & Red→Green Proof**: Added `VERCEL_ENV !== "production"` preview index-block, `Perplexity-User`/`Claude-User` explicit citation bot allow rules, and `{ userAgent: ["CCBot", "Bytespider"], disallow: "/" }` in [app/robots.ts](file:///c:/dev/al-ramlah-travels/web/app/robots.ts), backed by unit assertions in [discovery-proxy-and-seed.test.tsx](file:///c:/dev/al-ramlah-travels/web/tests/w6/f-seo-plat/discovery-proxy-and-seed.test.tsx) and live crawl verification in Playwright `J23a`.
2. **`V-SEO-02` `P3` Info Note (`desk/page.tsx` Secondary Projection → `FIXED & VERIFIED`)**:
   - **Note Surfaced by `v-seo-02`**: While canonical `/admin/catalog?tab=messages` selected all `contactMessages` columns, the secondary embedded `web_messages` tab in [app/admin/(dashboard)/desk/page.tsx](file:///c:/dev/al-ramlah-travels/web/app/admin/(dashboard)/desk/page.tsx) used a narrow `.select(...)` omitting the 7 attribution fields.
   - **Surgical Polish**: Added `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, `landingPage`, and `httpReferrer` to `desk/page.tsx`'s `contactMessages` projection so attribution badges render identically in both Admin views.

---

## 3. Quantitative 6-Pillar Score Trajectory (`Wave 5` → `Wave 7`)

Empirically measured via `nextjs-business-seo-geo-auditor` (`scripts/nextjs_seo_geo_cli.py`) in [post-fix/score_report.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/post-fix/score_report.md) and [post-fix/score_report.json](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/post-fix/score_report.json):

| # | Weighted Pillar (`nextjs_seo_geo_cli.py`) | Max | Wave 5 Baseline (`bbe28b8`) | Wave 7 Certified | Delta | Key Architectural Upgrades |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| **1** | **Next.js Technical SEO, Crawlability & CWV** | `20` | `11.9` | **`20.0`** | **`+8.1`** | `app/robots.ts` (`VERCEL_ENV` + AI bots), `app/sitemap.ts` (`revalidate = 3600`), `public/llms.txt`, `0/40` client `page.tsx` (`97.44%` public RSC), Slide `0` `preload`, `X-Robots-Tag` + `403` `forbidden()`. |
| **2** | **Meta Tags, URLs & CTR Optimization (`50–60`c / `150–160`c)** | `15` | `7.4` | **`15.0`** | **`+7.6`** | `buildPublicMetadata()` (`54–58`c titles, `150–157`c descriptions across all `19` patterns), query-free apex `https://alramlahtravels.com` canonicals, `1200×630` `next/og` PNG cards. |
| **3** | **Business Hub-and-Spoke & `>=50%` Differentiation** | `15` | `13.0` *(0 spokes)* | **`13.0`** | `0.0` *(19 real patterns)* | Expanded from `4` pages to `19` route patterns (`LHE`/`KHI`/`ISB` gateways, Makkah/Madinah hotels & Ziyarat, Hajj 2027, Visa, FAQ, About, Contact) with **`93.36%`–`97.28%`** 4-gram Jaccard uniqueness & `dynamicParams = false`. |
| **4** | **Entity SEO, NAP Consistency & JSON-LD Schema** | `15` | `6.0` | **`12.0`** | **`+6.0`** | 8-surface Askari 10 Lahore Cantt, Pakistan NAP + E.164 `tel:` + `<ArabicText>`, XSS-safe `serializeJsonLd()`, `0` `AggregateRating`, `0` volatile `Offer.price`, `0` Hajj `InStock`, `1:1` DOM/`FAQPage` parity. |
| **5** | **AI Search (GEO) Liftability, Substance & Authority** | `20` | `10.2` | **`15.2`** | **`+5.0`** | `44–54`w answer-first leads, semantic `<table>`/`<ul>` matrices (`0` `>200`w paragraphs), 20 Q&As across all 6 AI fan-out dimensions with live `visa_rates` PKR interpolation, wholesale SAR stripped. |
| **6** | **Internal Linking, Zero Orphans & Attribution Continuity** | `15` | `6.0` | **`15.0`** | **`+9.0`** | `0/40` orphan routes, `>=3` contextual inbound `<Link>`s per hub/spoke, `@base-ui/react` `<PublicBreadcrumbs />`, `<Suspense>` URL prefill, 7-column first-touch UTM capture → PG → Admin & CSV. |
| — | **OVERALL EMPIRICAL SCORE** | **`100`** | **`54.5 / 100` (`D`)** | **`90.2 / 100` (`A`)** | **`+35.7`** | **Exceeds `>= 90.0 / 100` Grade `A` Gate B Target** |

---

## 4. Authoritative Full-Stack Gate A + Gate B Verification Suite (`v-release`)

Executed sequentially in `c:\dev\al-ramlah-travels\web` under `.env.audit` (`127.0.0.1:54329/alramlah_audit`):

| # | Release Gate Command | Exit Code | Authoritative Result |
| :---: | :--- | :---: | :--- |
| **1** | `npm audit --omit=dev --audit-level=high` | **`0`** | **`0` Critical, `0` High** vulnerabilities in production dependencies (`next@16.4.6`). |
| **2** | `npx next typegen && npm run typecheck && npx tsc --noEmit -p tests/e2e/tsconfig.json` | **`0`** | **`0` TypeScript errors** across all `54` App Router routes/redirects, `12` Server Action modules, `8` Trigger tasks, unit/SEO/integration suites, and Playwright `J1`–`J23` specs. |
| **3** | `npm run lint` | **`0`** | **`0` ESLint errors** (`0` `any`, `0` `@ts-ignore`, `0` `@ts-expect-error`, `0` `eslint-disable`, `0` `.skip`/`.only`, `0` `asChild`, `0` Axe exclusions). |
| **4** | `npm test` (`tests/setup/run-all-tests.mjs`) | **`0`** | **`731 / 731` automated tests passed (`100%`, `0` failed, `0` skipped)**: `669` Node runner tests (`98` files) + `62` Vitest tests (`17` files covering `tests/unit/`, `tests/seo/`, `tests/w6/**`, and real-PG `tests/integration/`). |
| **5** | `npm run build` + `.next/server/**/*.nft.json` leak audit | **`0`** | Next.js `16.4.6` standalone build generated **`56 / 56` static/SSG worker units** + `.next/standalone/server.js`; `.nft.json` trace scan confirmed **`0` `.env*` leaks and `0` `public/uploads` leaks**. |
| **6** | `npm run test:e2e` (`npx playwright test`) | **`0`** | **`26 / 26` Playwright E2E specs (`J1`–`J23` across `4` spec files) passed (`100%`, `0` failed, `0` skipped)** with **`0` critical/serious unexcluded `@axe-core/playwright` WCAG 2.2 AA violations** across all public & admin surfaces; post-run port check on `3123` & `3998`: **`0` listeners**. |

### 4.1 `J23` Live Crawl, WCAG 2.2 AA & First-Touch Attribution E2E Breakdown (`5/5` Specs in `j23-seo-crawl-and-attribution.spec.ts`)

| Spec | End-to-End Live Browser & HTTP Assertions Verified Against Standalone Next.js `16.4.6` + Real PG | Status |
| :---: | :--- | :---: |
| **`J23a`** | `GET /robots.txt` (`200`, AI search bots allowed, `/admin/` & `/voucher/` disallowed), `GET /llms.txt` (`200`, Askari 10 NAP, `0` `/admin`/`/voucher`), `GET /opengraph-image` & `/umrah-packages/[slug]/opengraph-image` (`200` valid PNG magic bytes `89 50 4E 47`), `GET /sitemap.xml` (`200` XML, `100%` of `<loc>` URLs resolve `200 OK`, `0` private URLs), `GET /umrah-packages/from-peshawar` (`404` doorway guard), locked `/voucher/[token]` (`403` + `X-Robots-Tag: noindex`), and `/admin/login` (`X-Robots-Tag: noindex, nofollow`). | **PASS** |
| **`J23b`** | Live Chromium crawl of `/` + 5 Umrah commercial routes (`/umrah-packages`, `[slug]`, `from-lahore`, `from-karachi`, `from-islamabad`): `200 OK`, single `<h1>`, `50–60`c `document.title`, `150–160`c meta description, exact `https://alramlahtravels.com` self-canonical, `og:locale="en_PK"`, `twitter:card="summary_large_image"`, valid JSON-LD (`0` `AggregateRating`), `0` footer `/admin` links, and `0` Axe WCAG 2.2 AA violations. | **PASS** |
| **`J23c`** | Live Chromium crawl of 7 Guide/Directory hubs & spokes (`/hajj-2027`, `/umrah-visa`, `/hotels/makkah`, `/hotels/madinah`, `/ziyarat`, `/ziyarat/makkah`, `/ziyarat/madinah`): `200 OK`, single `<h1>`, `50–60`c title, `150–160`c description, self-canonical, valid JSON-LD, and `0` Axe WCAG 2.2 AA violations. | **PASS** |
| **`J23d`** | Live Chromium crawl of 6 Trust & Legal spokes (`/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/refund-policy`): `200 OK`, single `<h1>`, `50–60`c title, `150–160`c description, self-canonical, valid JSON-LD, and `0` Axe WCAG 2.2 AA violations. | **PASS** |
| **`J23e`** | Lands on `/umrah-packages/from-lahore?utm_source=google&utm_medium=cpc&utm_campaign=ramadan_2027&utm_content=hero_cta&utm_term=umrah+from+lahore` with external `google.com` referrer → clicks `/?departureCity=LHE#journey-builder` → verifies `#lead-city` prefilled to `"Lahore"` and `sessionStorage["alramlah_attribution_v1"]` preserved across internal navigation → submits Custom Builder (`applications`) AND `/contact` (`contact_messages`) → proves all `7` DB columns persisted in PostgreSQL → logs into Admin Dossier & `/admin/catalog?tab=messages` and verifies `Paid Search: Google Ads`, `Google CPC`, and `Campaign: ramadan_2027` badges + `0` Axe violations. | **PASS** |

---

## 5. Complete `31 / 31` Canonical `SEO-ID` Verification Matrix (`SEO-001`–`SEO-031`)

| `SEO-ID` | Sev | Raw Findings (`88`) | Fixer(s) | Verifier(s) | Automated Test & E2E Proof | Final Status |
| :--- | :-: | :--- | :---: | :---: | :--- | :---: |
| **`SEO-001`** | `P0` | `S09-001`..`003`, `S16-001`, `S16-002` | `f-seo-plat` | `v-seo-01`, `v-release` | `json-ld-and-breadcrumbs.test.tsx`, `gate-b-seo-invariants.test.ts`, `J23b`–`J23d` | `VERIFIED-CLOSED` |
| **`SEO-002`** | `P0` | `S15-002` | `f-seo-plat` | `v-seo-01`, `v-seo-02` | `discovery-proxy-and-seed.test.tsx`, `gate-b-seo-invariants.test.ts` | `VERIFIED-CLOSED` |
| **`SEO-003`** | `P0` | `S14-001` | `f-seo-plat` | `v-seo-01`, `v-seo-02` | `utm-attribution.test.ts`, `seo-utm-attribution.integration.test.ts` | `VERIFIED-CLOSED` |
| **`SEO-004`** | `P0` | `S14-002`, `S14-003` | `f-seo-shell` | `v-seo-01`, `v-seo-02` | `shell-and-attribution.test.ts`, `seo-utm-attribution.integration.test.ts`, `J23e` | `VERIFIED-CLOSED` |
| **`SEO-005`** | `P0` | `S05-002`, `S13-001`, `S13-002`, `S13-005` | `f-seo-shell` | `v-seo-01`, `v-seo-02` | `shell-and-attribution.test.ts`, `gate-b-seo-invariants.test.ts`, `J23b`–`J23d` | `VERIFIED-CLOSED` |
| **`SEO-006`** | `P0` | `S05-004`, `S15-001` | `f-seo-shell` | `v-seo-01`, `v-seo-02` | `shell-and-attribution.test.ts`, `J23e` | `VERIFIED-CLOSED` |
| **`SEO-007`** | `P1` | `S01-001`, `S01-003` | `f-seo-plat` / `v-release` | `v-seo-01`, `v-release` | `discovery-proxy-and-seed.test.tsx` (`VERCEL_ENV="preview"` + `CCBot`/`Bytespider`), `J23a` | **`REOPENED -> FIXED & VERIFIED`** |
| **`SEO-008`** | `P1` | `S01-002`, `S01-005` | `f-seo-plat` | `v-seo-01`, `v-release` | `discovery-proxy-and-seed.test.tsx`, `J23a` | `VERIFIED-CLOSED` |
| **`SEO-009`** | `P1` | `S02-001`..`003`, `S04-001`, `S04-005`, `S12-001` | `f-seo-plat` | `v-seo-01`, `v-release` | `metadata-and-nap.test.ts`, `gate-b-seo-invariants.test.ts`, `J23b`–`J23d` | `VERIFIED-CLOSED` |
| **`SEO-010`** | `P1` | `S04-004`, `S04-006` | `f-seo-plat` | `v-seo-01`, `v-release` | `discovery-proxy-and-seed.test.tsx`, `J23a` | `VERIFIED-CLOSED` |
| **`SEO-011`** | `P1` | `S02-004`, `S02-005`, `S16-004` | `f-seo-plat` | `v-seo-01`, `v-release` | `discovery-proxy-and-seed.test.tsx`, `J9`, `J23a` | `VERIFIED-CLOSED` |
| **`SEO-012`** | `P1` | `S03-003`, `S06-004`, `S08-005`, `S10-002`..`004`, `S12-002`, `S12-003`, `S16-006` | `f-seo-plat` | `v-seo-01`, `v-release` | `metadata-and-nap.test.ts`, `gate-b-seo-invariants.test.ts` | `VERIFIED-CLOSED` |
| **`SEO-013`** | `P1` | `S06-003`, `S07-004`, `S08-002`, `S08-004`, `S16-003` | `f-seo-plat` | `v-seo-01`, `v-release` | `discovery-proxy-and-seed.test.tsx`, `db-migrations-and-seed.test.ts` | `VERIFIED-CLOSED` |
| **`SEO-014`** | `P1` | `S09-005`, `S13-004` | `f-seo-plat` | `v-seo-01`, `v-seo-02` | `json-ld-and-breadcrumbs.test.tsx`, `gate-b-seo-invariants.test.ts` | `VERIFIED-CLOSED` |
| **`SEO-015`** | `P1` | `S05-001`, `S06-001`, `S15-004` | `f-seo-umrah` | `v-seo-02`, `v-release` | `umrah-spokes.test.ts`, `gate-b-seo-invariants.test.ts`, `J23a`, `J23b` | `VERIFIED-CLOSED` |
| **`SEO-016`** | `P1` | `S05-005`, `S06-002` | `f-seo-umrah` | `v-seo-02`, `v-release` | `umrah-spokes.test.ts`, `gate-b-seo-invariants.test.ts`, `J23a`, `J23b` | `VERIFIED-CLOSED` |
| **`SEO-017`** | `P1` | `S07-001`, `S15-005` | `f-seo-guides` | `v-seo-02`, `v-release` | `guides-spokes.test.ts`, `gate-b-seo-invariants.test.ts`, `J23c` | `VERIFIED-CLOSED` |
| **`SEO-018`** | `P1` | `S07-003` | `f-seo-guides` | `v-seo-02`, `v-release` | `guides-spokes.test.ts`, `gate-b-seo-invariants.test.ts`, `J23c` | `VERIFIED-CLOSED` |
| **`SEO-019`** | `P1` | `S08-001` | `f-seo-guides` | `v-seo-02`, `v-release` | `guides-spokes.test.ts`, `gate-b-seo-invariants.test.ts`, `J23c` | `VERIFIED-CLOSED` |
| **`SEO-020`** | `P1` | `S08-003` | `f-seo-guides` | `v-seo-02`, `v-release` | `guides-spokes.test.ts`, `gate-b-seo-invariants.test.ts`, `J23c` | `VERIFIED-CLOSED` |
| **`SEO-021`** | `P1` | `S10-001`, `S10-005` | `f-seo-trust` | `v-seo-01`, `v-release` | `trust-spokes.test.ts`, `J23d` | `VERIFIED-CLOSED` |
| **`SEO-022`** | `P1` | `S09-004`, `S11-002`, `S11-004`, `S11-005` | `f-seo-trust` | `v-seo-01`, `v-seo-02` | `trust-spokes.test.ts`, `gate-b-seo-invariants.test.ts`, `J23d` | `VERIFIED-CLOSED` |
| **`SEO-023`** | `P1` | `S03-001`, `S03-002`, `S04-002`, `S05-003`, `S11-001`, `S11-003`, `S12-004`, `S13-003` | `f-seo-trust` | `v-seo-01`, `v-seo-02` | `trust-spokes.test.ts`, `gate-b-seo-invariants.test.ts`, `J23b` | `VERIFIED-CLOSED` |
| **`SEO-024`** | `P1` | `S06-005`, `S14-004` | `f-seo-shell` | `v-seo-02`, `v-release` | `shell-and-attribution.test.ts`, `seo-utm-attribution.integration.test.ts`, `J23e` | `VERIFIED-CLOSED` |
| **`SEO-025`** | `P1` | `S07-002`, `S14-005` | `f-seo-shell` / `v-release` | `v-seo-02`, `v-release` | `shell-and-attribution.test.ts`, `seo-utm-attribution.integration.test.ts`, `J23e` | `VERIFIED-CLOSED` |
| **`SEO-026`** | `P1` | `S16-005` | `f-seo-qa` | `v-seo-01`, `v-release` | `gate-b-seo-invariants.test.ts`, `seo-utm-attribution.integration.test.ts`, `J23`, `score_report.json` (`90.2/100`) | `VERIFIED-CLOSED` |
| **`SEO-027`** | `P2` | `S01-004`, `S03-004` | `f-seo-plat` | `v-seo-01`, `v-release` | `discovery-proxy-and-seed.test.tsx`, `J23a` | `VERIFIED-CLOSED` |
| **`SEO-028`** | `P2` | `S04-003`, `S13-007`, `S14-007` | `f-seo-trust` | `v-seo-01`, `v-seo-02` | `trust-spokes.test.ts`, `gate-b-seo-invariants.test.ts`, `J23d` | `VERIFIED-CLOSED` |
| **`SEO-029`** | `P2` | `S02-006`, `S13-006` | `f-seo-shell` | `v-seo-02`, `v-release` | `shell-and-attribution.test.ts`, `gate-b-seo-invariants.test.ts` | `VERIFIED-CLOSED` |
| **`SEO-030`** | `P2` | `S03-005`, `S14-006`, `S15-003`, `S15-006`, `S15-007` | `f-seo-shell` | `v-seo-02`, `v-release` | `shell-and-attribution.test.ts` | `VERIFIED-CLOSED` |
| **`SEO-031`** | `P3` | `S13-008` | `f-seo-shell` | `v-seo-02`, `v-release` | `shell-and-attribution.test.ts` | `VERIFIED-CLOSED` |
