# PUBLIC SITE SEO, GEO & ATTRIBUTION READINESS CERTIFICATION — GATE B (`Spec 0025`)

- **Platform**: **Al Ramlah Travels (`سفريات الرملة`)** — Next.js `16.4.6` · React `19.2.8` · TypeScript `5` · Drizzle ORM + Neon Serverless PostgreSQL `16`
- **Canonical Origin**: `https://alramlahtravels.com` (`308`/`301` permanent redirect from `www.alramlahtravels.com`)
- **Branch Certified**: `audit/production-hardening`
- **Prerequisite Gate**: Gate A (`Spec 0024`) Certified (`8 / 8` Criteria Green — [PRODUCTION_READINESS.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/PRODUCTION_READINESS.md))
- **Empirical Score Trajectory**: **`54.5 / 100` (Grade `D` Baseline)** → **`90.2 / 100` (Grade `A` Certified, `+35.7` pts)**
- **Certification Date**: `2026-11-16`
- **Gate B Verdict**: **`PASS — CERTIFIED SEO, GEO & ATTRIBUTION PRODUCTION-READY (8 / 8 CRITERIA GREEN)`**
- **Companion Evidence Artifacts**:
  - Wave 7 Consolidated Verification Report: [04-seo-verification.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/04-seo-verification.md)
  - Independent Adversarial Verifier Reports: [V-SEO-01.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/verification/V-SEO-01.md) · [V-SEO-02.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/verification/V-SEO-02.md)
  - Empirical Post-Fix CLI Score Artifacts: [score_report.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/post-fix/score_report.md) · [score_report.json](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/post-fix/score_report.json)
  - Wave 6 Remediation Ledger: [03-seo-fix-log.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/03-seo-fix-log.md)
  - Master Deduplicated SEO Triage (`88` raw → `31` `SEO-ID`s): [02-seo-triage.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/seo/02-seo-triage.md)
  - Governing Specification: [0025-public-site-seo-readiness.md](file:///c:/dev/al-ramlah-travels/web/docs/specs/0025-public-site-seo-readiness.md)
  - Executive & Technical Final Report: [FINAL_REPORT.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/FINAL_REPORT.md)

---

## 1. Gate B Acceptance Criteria Sign-Off Checklist (`GB-01`–`GB-08`)

Per [0025-public-site-seo-readiness.md](file:///c:/dev/al-ramlah-travels/web/docs/specs/0025-public-site-seo-readiness.md#L164-L177) §6, every Gate B criterion has been independently verified against live source code, disposable PostgreSQL 16 (`127.0.0.1:54329`), and the production standalone Next.js `16.4.6` server (`127.0.0.1:3123`):

| Gate ID | Acceptance Criterion | Status | Reproducible Empirical Evidence |
| :---: | :--- | :---: | :--- |
| **`GB-01`** | **Discovery, Crawl & `noindex` Hygiene** (`/robots.txt`, `/sitemap.xml`, `/llms.txt` `200`; `VERCEL_ENV` preview block; `X-Robots-Tag` on `/admin`, `/api`, `/voucher`, `/quote`; HTTP `403` locked voucher; `0` `/admin` or `www.` footer links) | **`PASS`** | • `app/robots.ts`: blocks non-prod `VERCEL_ENV` previews (`disallow: "/"`), allows AI citation bots (`OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot`, `Google-Extended`), disallows `CCBot`/`Bytespider` & `/admin/`, `/api/`, `/voucher/`, `/quote/` (`SEO-007`).<br>• `app/sitemap.ts` (`revalidate = 3600`): emits all `18` hubs + active `/umrah-packages/[slug]` spokes (`100%` `200 OK` in `J23a`) with multi-table `MAX(updatedAt)` freshness & `0` private URLs.<br>• `public/llms.txt` (`200`), `proxy.ts` `X-Robots-Tag`, `app/admin/layout.tsx` `noindex`, `/voucher/[token]` `forbidden()` HTTP `403`, and `www`→apex `308`/`301` verified (`J23a`). |
| **`GB-02`** | **Meta CTR (`50–60`c / `150–160`c), Canonicals & `1200×630` OG** (`19/19` route patterns in `50–60`c / `150–160`c; query-free self-canonicals; `en_PK`; `1200×630` PNG OG cards; `0` `/logo.jpg` OG; `0` `localhost` leaks) | **`PASS`** | • All `19` indexable route patterns render unique `54–58`c `<title>` and `150–157`c `<meta name="description">` (`V-SEO-01.md` §2.2 & `J23b`–`J23d`).<br>• `getCanonicalSiteUrl()` enforces `https://alramlahtravels.com` (`0` `localhost` or query-string canonicals).<br>• `app/opengraph-image.tsx` & `umrah-packages/[slug]/opengraph-image.tsx` serve `1200×630` PNGs (`0` `/logo.jpg` social cards, `J23a`). |
| **`GB-03`** | **Hub-and-Spoke Completeness & `>=50%` Differentiation** (`19` route patterns `200 OK`, single `<h1>`, `dynamicParams = false` `404` on non-Tier-1 cities, `>=50%` 4-gram Jaccard uniqueness) | **`PASS`** | • `19/19` route patterns return `200 OK` with single semantic `<h1>` and Next.js 16 `await params` (`J23b`–`J23d`).<br>• `dynamicParams = false` + `[slug]` gateway guard return `404` on `/umrah-packages/from-peshawar`, `/hotels/jeddah`, `/ziyarat/taif` (`J23a`).<br>• Pairwise 4-gram Jaccard uniqueness (`1 - J_4`): **`93.36%`–`94.27%`** (`LHE`/`KHI`/`ISB`), **`95.69%`** (`hotels`), **`97.28%`** (`ziyarat`) — well above `>=50.0%` (`V-SEO-02.md` §3.1). |
| **`GB-04`** | **Entity NAP Parity & Penalty-Free JSON-LD Schema** (8-surface Askari 10 Lahore Cantt NAP + E.164 `tel:` + `<ArabicText>`; XSS-escaped JSON-LD; `0` `AggregateRating`; `0` `<=0`/volatile `Offer.price`; `1:1` FAQ/Breadcrumb parity) | **`PASS`** | • Identical Askari 10, Lahore Cantt, Pakistan address, `tel:+923274029701` / `tel:+923190462638`, and `<ArabicText lang="ar" dir="rtl">سفريات الرملة</ArabicText>` across all 8 surfaces.<br>• `serializeJsonLd()` escapes `<`/`>`/`&`/`\u2028`/`\u2029` and strips `aggregateRating`/`review`; `AggregateOffer` filters `price > 0`; `/hotels/*` & `/ziyarat/**` emit `0` `Offer.price`; `/hajj-2027` emits `Service` (`0` `InStock`); `/` & `/faq` hold `1:1` DOM/`FAQPage` parity (`V-SEO-01.md` §2.3). |
| **`GB-05`** | **AI Search (GEO) Liftability & Haramain Invariants** (`40–60`w leads, `<table>`/`<ul>` matrices, 6-dimension fan-out FAQs, `0` wholesale SAR leaks, all 9 Haramain invariants + `OD-10`) | **`PASS`** | • `44–54`w answer-first leads, semantic `<table>`/`<ul>` blocks (`0` `>200`w paragraphs), and `20` Q&As across all 6 AI fan-out dimensions with live `visa_rates` PKR interpolation.<br>• `lib/seo/public-queries.ts` & `sanitizeHomePlannerCatalog()` strip `100%` of wholesale `*Sar` & `updatedByUserId` fields.<br>• All 9 Haramain invariants + `OD-09b`/`09c`/`09d`/`09e` + `OD-10` verified (`V-SEO-02.md` §3.2). |
| **`GB-06`** | **Zero-Orphan Internal Link Graph & `<Suspense>` URL Prefill** (`0` orphans, `>=3` contextual inbound `<Link>`s, `@base-ui/react` `<PublicBreadcrumbs />`, `<Suspense>` URL prefill overriding `sessionStorage`) | **`PASS`** | • `post-fix/internal_links.json`: `0/40` orphan routes, `0` weak anchors, `>=3` distinct inbound `<Link>` sources per money page.<br>• `<PublicBreadcrumbs />` uses `@base-ui/react` `render` prop (`0` `asChild`) on all `18` subpages.<br>• `<Suspense><PlannerUrlHydrator /></Suspense>` overrides stale `sessionStorage` drafts on `?preset=`, `?departureCity=`, `?citySequence=`, `?hotelId=`, `?ziyaratCity=` (`J23e`). |
| **`GB-07`** | **End-to-End First-Touch Attribution (`UtmTracker` → DB → Admin & CSV)** (7 columns on `applications` & `contact_messages`, sanitized first-touch lock, Admin badges, formula-safe CSV) | **`PASS`** | • `drizzle/0003_seo_lead_attribution.sql` + `<Suspense><UtmTracker /></Suspense>` (`alramlah_attribution_v1`, disclosed in `/privacy` §3) + all 4 lead Server Actions + `WhatsAppFab` suffix.<br>• Live `J23e` proves first-touch Google CPC + `ramadan_2027` persists across internal navigation into PostgreSQL and renders `Paid Search: Google Ads`, `Google CPC`, and `Campaign: ramadan_2027` badges in Admin Dossier & Messages + `sanitizeCsvCellInternal()` CSV export. |
| **`GB-08`** | **CWV / RSC Budgets, Score (`>= 90.0 / 100`) & Zero Gate A Regression** (Slide `0` `preload`, `>=80%` RSC, `>=90/100` Grade `A`, `731/731` unit/integration & `26/26` `J1`–`J23` E2E green) | **`PASS`** | • `HeroSlider` mounts strictly Slide `0` on SSR with `preload={idx === 0}` (`0` deprecated `priority` props); public/spoke codebase is **`97.44%` RSC** (`11,331` RSC LOC vs `298` client island LOC).<br>• Empirical score: **`90.2 / 100` (Grade `A`)**.<br>• **`731 / 731`** unit/SEO/integration tests & **`26 / 26`** Playwright E2E specs (`J1`–`J23`) **`100%` PASS**. |

---

## 2. Post-Deploy SEO & Search Console Activation Checklist

Immediately upon DNS cutover to `https://alramlahtravels.com`, execute these 5 search-visibility steps:

1. **Google Search Console (`https://search.google.com/search-console`)**:
   - Verify domain property `alramlahtravels.com` via Cloudflare/registrar DNS TXT record.
   - Submit `https://alramlahtravels.com/sitemap.xml` under **Sitemaps** and request indexing for `/`, `/umrah-packages`, `/umrah-packages/from-lahore`, `/umrah-visa`, and `/hajj-2027`.
2. **Bing Webmaster Tools (powers ChatGPT Search & Copilot grounding)**:
   - Import the verified Google Search Console property into Bing Webmaster Tools (`https://www.bing.com/webmasters`) so `https://alramlahtravels.com/sitemap.xml` feeds `OAI-SearchBot` / Bing indexation immediately.
3. **Google Business Profile Alignment (`Askari 10, Lahore Cantt`)**:
   - Ensure the Askari 10 Google Business Profile listing uses exact canonical NAP (`Al Ramlah Travels`, `Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan`, `+92 327 4029701`) and website URL `https://alramlahtravels.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp_lahore`.
4. **Live Header & Rich-Results Smoke Check**:
   - Run `curl -I https://www.alramlahtravels.com/` (`308`/`301` → `https://alramlahtravels.com/`), `curl -I https://alramlahtravels.com/admin/login` (`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`), and validate `/` + `/umrah-packages` in Google Rich Results Test (`https://search.google.com/test/rich-results`).
5. **Social Link-Preview Smoke Check**:
   - Paste `https://alramlahtravels.com` and one active `/umrah-packages/[slug]` URL into WhatsApp and Meta Sharing Debugger to warm the `1200×630` Haramain Emerald/Gold OG card cache.

---

## 3. Gate B Sign-Off

**Certified by**: Wave 7 Independent Verification Swarm (`v-seo-01`, `v-seo-02`, and Lead Release Certifier `v-release`)  
**Status**: **GATE B PASSED (`8 / 8` Criteria Green · `90.2 / 100` Grade `A` · `31 / 31` `SEO-ID`s Closed) — CLEARED FOR PRODUCTION LAUNCH**
