# Wave 7 Independent Adversarial SEO & GEO Verification — `V-SEO-02`

- **Verifier**: `v-seo-02` (Independent Adversarial Verifier — Hub-and-Spoke `>=50%` Differentiation, AI Search GEO Liftability, Wholesale SAR Confidentiality, 9 Haramain Invariants, Zero-Orphan Internal Link Graph & End-to-End First-Touch UTM Attribution)
- **Repository / Working Directory**: `c:\dev\al-ramlah-travels\web`
- **Branch / `HEAD` Commit Verified**: `audit/production-hardening` (`e95b9f1`)
- **Audit Database Target**: Hermetic `.env.audit` (`127.0.0.1:54329/alramlah_audit` — `.env` untouched)
- **Assigned Gates**: **`GB-03`**, **`GB-05`**, **`GB-06`**, **`GB-07`**
- **Primary Assigned `SEO-ID`s**: **`SEO-015`..`SEO-020`**, **`SEO-024`**, **`SEO-025`**, **`SEO-029`..`SEO-031`** *(plus cross-gate supporting items `SEO-002`..`SEO-006`, `SEO-014`, `SEO-022`, `SEO-023`, `SEO-028`)*
- **Overall Gate Verdict**: **PASS (`11/11` primary `SEO-ID`s `VERIFIED-CLOSED`, `10/10` cross-gate supporting `SEO-ID`s `VERIFIED-CLOSED`, `0` `REOPENED`)**

---

## 1. Empirical Test Execution Summary

All assigned Vitest unit, SSR component, invariant, and real PostgreSQL integration suites were executed directly against live `HEAD` (`e95b9f1`) backed by `127.0.0.1:54329/alramlah_audit`:

| Command Executed | Test Files | Tests | Failed | Duration | Result |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `npx vitest run tests/seo/ tests/w6/f-seo-umrah/ tests/w6/f-seo-guides/ tests/w6/f-seo-shell/ tests/integration/seo-utm-attribution.integration.test.ts` | `5 / 5` | `18 / 18` | `0` | `40.27s` | **PASS** |
| `npx vitest run tests/w6/f-seo-plat/ tests/w6/f-seo-trust/` *(supporting cross-gate verification)* | `5 / 5` | `21 / 21` | `0` | `16.87s` | **PASS** |
| **Combined Empirical Total** | **`10 / 10`** | **`39 / 39`** | **`0`** | **`57.14s`** | **100% GREEN** |

Individual verified test files:
- `tests/seo/gate-b-seo-invariants.test.ts` (`5/5` passed)
- `tests/w6/f-seo-umrah/umrah-spokes.test.ts` (`3/3` passed)
- `tests/w6/f-seo-guides/guides-spokes.test.ts` (`4/4` passed)
- `tests/w6/f-seo-shell/shell-and-attribution.test.ts` (`4/4` passed)
- `tests/integration/seo-utm-attribution.integration.test.ts` (`2/2` passed against live `alramlah_audit` PostgreSQL)
- `tests/w6/f-seo-trust/trust-spokes.test.ts` (`6/6` passed)
- `tests/w6/f-seo-plat/{metadata-and-nap,discovery-proxy-and-seed,utm-attribution,json-ld-and-breadcrumbs}` (`15/15` passed)

---

## 2. Canonical `SEO-ID` Closure Table

### 2.1 Primary Assigned Scope (`SEO-015`..`SEO-020`, `SEO-024`, `SEO-025`, `SEO-029`..`SEO-031`)

| `SEO-ID` | Gate(s) | Severity | Verdict | Live Source & Test Evidence at `HEAD` (`e95b9f1`) |
| :--- | :---: | :---: | :---: | :--- |
| **`SEO-015`** | `GB-03`, `GB-05`, `GB-06` | `P1` | **`VERIFIED-CLOSED`** | `app/(public)/umrah-packages/page.tsx:16–164` (`revalidate = 300`, `58`c title, `154`c description, `<PublicBreadcrumbs />`, `46`w answer-first summary, `<UmrahPackageComparisonTable />` semantic `<table>`, city gateway links); `app/(public)/umrah-packages/[slug]/page.tsx:19–299` (Next.js 16 `await params`, `generateStaticParams()`, `Product` + `AggregateOffer` + `FAQPage` JSON-LD, `OD-09b` `0`-tier `"On Request"` handling, `/?preset=complete_umrah#journey-builder` CTA); `app/(public)/umrah-packages/[slug]/opengraph-image.tsx:16–64` (`1200×630` PNG OG card with `await params`). Proven by `tests/w6/f-seo-umrah/umrah-spokes.test.ts` (`3/3`). |
| **`SEO-016`** | `GB-03`, `GB-05`, `GB-06` | `P1` | **`VERIFIED-CLOSED`** | `app/(public)/umrah-packages/from-[city]/page.tsx:13–92` (`dynamicParams = false`, `generateStaticParams()` locked to `lahore`, `karachi`, `islamabad`, `await params`, `notFound()` on invalid cities) **AND** runtime App Router segment forwarding in `app/(public)/umrah-packages/[slug]/page.tsx:38–41, 65–77, 100–116` (`resolveStrictGatewayCityRouteSlug` returning `notFound()` on `from-peshawar`, `from-multan`, `from-lhe`). `components/seo/umrah-city-gateway-data.ts` & `umrah-city-gateway-view.tsx` achieve **`93.36%`–`94.27%`** pairwise 4-gram Jaccard uniqueness (`>=50%` threshold) with IATA-filtered departures and `/?preset=complete_umrah&departureCity=LHE\|KHI\|ISB#journey-builder` CTAs. |
| **`SEO-017`** | `GB-03`, `GB-05`, `GB-06` | `P1` | **`VERIFIED-CLOSED`** | `app/(public)/hajj-2027/page.tsx:10–37` (`revalidate = 300`, `57`c title, `155`c description), `components/seo/guides-hajj-data.ts:8–228`, `components/seo/guides-hajj-view.tsx:19–338`: `54`w answer-first lead, Maktab `A+`/`A`/`B`/`C` comparison `<table>`, 6-document readiness `<ul>`, verbatim `HAJJ_2027_REGULATORY_DISCLAIMER` (`OD-09e`), `"Indicative 2027 Estimate"` badges, `Service` + `FAQPage` JSON-LD (`0` `InStock`/`Product` claims), and `<PublicBreadcrumbs />`. Proven by `tests/w6/f-seo-guides/guides-spokes.test.ts`. |
| **`SEO-018`** | `GB-03`, `GB-05`, `GB-06` | `P1` | **`VERIFIED-CLOSED`** | `app/(public)/umrah-visa/page.tsx:9–31` (`revalidate = 300`, `getPublicVisaRates()`), `components/seo/guides-visa-data.ts:24–250`, `components/seo/guides-visa-view.tsx:20–369`: `51`w answer-first summary, live standalone PKR `short_term` (`1–30`d) vs `long_term` (`31–90`d) `<table>`, mandatory KSA Arrival & Departure date rule (`OD-09c`), Nusuk Masar `"Live Rate — Confirmed upon submission"` disclosure, 5-step Saudi Visa Bio enrollment `<ol>`, vaccination/entry rules, 4-row diaspora eligibility matrix `<table>`, `Service` + `FAQPage` JSON-LD, and `/?preset=visa_only#journey-builder` CTA. |
| **`SEO-019`** | `GB-03`, `GB-05`, `GB-06` | `P1` | **`VERIFIED-CLOSED`** | `app/(public)/hotels/[city]/page.tsx:14–73` (`revalidate = 300`, `dynamicParams = false`, `generateStaticParams()` locked to `makkah` & `madinah`, `await params`, `notFound()` on `/hotels/jeddah`, `/hotels/mecca`, `/hotels/riyadh`, `/hotels/taif`). `components/seo/guides-hotels-data.ts` & `guides-hotels-view.tsx:31–348` achieve **`95.69%`** 4-gram Jaccard uniqueness (`makkah` vs `madinah`), render hotel distance/access/room-type `<table>`, strict `"Live Rate — Confirmed upon submission"` lock (`0` SAR/PKR figures in HTML or `ItemList`/`LodgingBusiness` JSON-LD), Makkah `JED` entry disclosure, Madinah Ladies Gate 25 & Nusuk Rawdah guidance, and per-hotel `?hotelId=<uuid>` deep links. |
| **`SEO-020`** | `GB-03`, `GB-05`, `GB-06` | `P1` | **`VERIFIED-CLOSED`** | `app/(public)/ziyarat/page.tsx:13–36` & `app/(public)/ziyarat/[city]/page.tsx:14–73` (`dynamicParams = false`, `generateStaticParams()` locked to `makkah` & `madinah`, `await params`, `notFound()` on `/ziyarat/taif`, `/ziyarat/jeddah`). `components/seo/guides-ziyarat-data.ts` & `guides-ziyarat-view.tsx` achieve **`97.28%`** 4-gram Jaccard uniqueness (`makkah` vs `madinah`), render unclamped landmark cards, Badr & Taif excursion `<table>`, 5-row fleet capacity `<table>` (`1–3` Sedan, `4–6` SUV, `7–12` Van, `13+` Coach, Haramain High-Speed Train `shared_only` intercity rail excluded from Ziyarat), `"Live Rate — Confirmed upon submission"`, `ItemList` (`TouristAttraction`) + `FAQPage` JSON-LD, and `?ziyaratCity=makkah_only\|madinah_only\|both` CTAs. |
| **`SEO-024`** | `GB-07` | `P1` | **`VERIFIED-CLOSED`** | `app/actions/cms.ts:688–690` delegates `submitContactMessage` directly to `submitPublicContactInquiryAction(rawInput)` (`app/actions/applications.ts:1873–1967`), guaranteeing uniform rate limiting (`contact-inquiry`, `6/15m`), silent `websiteUrl` honeypot filtering, E.164 phone normalization, and 7-column UTM attribution persistence. `revalidatePublicSeoPaths()` is wired across all mutations in `app/actions/cms.ts:84` (`512, 558, 577, 616, 655, 674`) and `app/actions/groups.ts:86` (`386, 471, 492, 546, 597, 623`) while preserving existing `groupPackages.slug` on edits (`groups.ts:413–415`). Proven by `tests/w6/f-seo-shell/shell-and-attribution.test.ts`. |
| **`SEO-025`** | `GB-05`, `GB-07` | `P1` | **`VERIFIED-CLOSED`** | `components/public/hajj-inquiry-section.tsx:431–442` checks `normalized.includes("A+")` before `"A"` so `coerceMaktabCode("A+") === "A+"`, and `lines 517–525` treat explicit `packages = []` as closed (`[]`) rather than resurrecting hardcoded fallback cards. `components/admin/applications/application-dossier.tsx:182–291` (fed by `app/admin/(dashboard)/applications/[id]/page.tsx:41–78, 212`) and `components/admin/catalog/messages-client.tsx:362–424` (fed by `app/admin/(dashboard)/catalog/page.tsx:102–105, 146`) render Acquisition Channel (`inferAcquisitionChannel`), `utmSource`/`utmMedium`, `utmCampaign`, `landingPage`, `utmTerm`, and `httpReferrer` badges. `app/actions/quotes.ts:2299–2360` appends all 7 attribution columns to `exportApplicationsCsvAction` wrapped in `sanitizeCsvCellInternal()` (`quotes.ts:192–210`). |
| **`SEO-029`** | `GB-06` | `P2` | **`VERIFIED-CLOSED`** | `app/not-found.tsx:9–127` exports `metadata` with `robots: { index: false, follow: true }` (zero canonical), wraps `PublicHeader` + `PublicFooter` + `WhatsAppFab` hydrated with `getCachedCompanyInfo()` (`primaryWhatsapp`, `officeCity`), and renders 6 commercial recovery `<Link>` cards (`/`, `/umrah-packages`, `/umrah-visa`, `/hajj-2027`, `/hotels/makkah`, `/contact`). |
| **`SEO-030`** | `GB-06`, `GB-07` | `P3` | **`VERIFIED-CLOSED`** | Off-homepage post-submission `"Track Application Status Live"` handlers in `group-booking-modal.tsx:491`, `hajj-inquiry-section.tsx:664`, `review-and-submit-step.tsx:522`, and `lead-capture-dialog.tsx:266` navigate to `/?trackRef=<ref>#track-status`; `app/actions/quotes.ts:2118–2119` builds `portalUrl` via `${getCanonicalSiteUrl().origin}/?trackRef=...#track-status`; `components/public/status-tracker.tsx:45–65, 221–223` hydrates `?trackRef=` inside `<Suspense fallback={null}>` while keeping pilgrim phone verification mandatory. `PublicHeader` (`public-header.tsx:103, 187`) sets `loading="eager"` on the `40×40` header logo and reserves fixed `w-[296px]` on the AST prayer pill (`CLS = 0`). `WhatsAppFab` (`whatsapp-fab.tsx:26–35`) appends `formatWhatsAppAttributionSuffix(readStoredAttribution())`. |
| **`SEO-031`** | `GB-06` | `P3` | **`VERIFIED-CLOSED`** | `components/layout/public-header.tsx:47–80` implements `isHeaderNavLinkActive(pathname, link)` matching hub and nested spoke routes (`/umrah-packages/*`, `/ziyarat/*`, `/hotels/*`), applying `aria-current="page"` and Haramain Gold active indicators across both desktop (`lines 125–155`) and mobile (`lines 253–280`) navigation drawers. |

### 2.2 Cross-Gate Supporting `SEO-ID`s Verified Under `GB-05`, `GB-06`, `GB-07`

| `SEO-ID` | Gate(s) | Verdict | Live Source Evidence |
| :--- | :---: | :---: | :--- |
| **`SEO-002`** | `GB-05` | **`VERIFIED-CLOSED`** | `lib/seo/public-queries.ts:159–495` (`toPublicHotelDto`, `getPublicVehiclesCatalog`, `getPublicVisaRates`, `toPublicGroupPackageDto`) & `components/seo/trust-home-overview.tsx:98–223` (`sanitizeHomePlannerCatalog`) strip wholesale SAR columns & `updatedByUserId`. |
| **`SEO-003`** | `GB-07` | **`VERIFIED-CLOSED`** | `drizzle/0003_seo_lead_attribution.sql:1–25`, `db/schema/applications.ts:227–233, 250–253`, `db/schema/cms.ts:116–128`, and `lib/seo/utm.ts:1–273`. |
| **`SEO-004`** | `GB-07` | **`VERIFIED-CLOSED`** | `components/seo/utm-tracker.tsx:1–36` mounted in `<Suspense fallback={null}>` inside `app/(public)/layout.tsx:17–19`; all 4 lead Server Actions in `app/actions/applications.ts` persist sanitized 7-column attribution. |
| **`SEO-005`** | `GB-06` | **`VERIFIED-CLOSED`** | `components/planner/planner-context.tsx:788–996, 1389–1526, 2788–2790`: `<Suspense>` `<PlannerUrlHydrator />` + `parsePlannerUrlPrefill` + `resolvePlannerPrefillState` overriding stale `sessionStorage["alramlah_planner_draft_v1"]`. |
| **`SEO-006`** | `GB-06` | **`VERIFIED-CLOSED`** | `components/layout/public-header.tsx:24–45` & `components/layout/public-footer.tsx:17–296` expose crawlable `<Link href="...">` navigation with `0` `/admin` links and `0` `www.` links. |
| **`SEO-014`** | `GB-06` | **`VERIFIED-CLOSED`** | `components/layout/breadcrumbs.tsx:1–95` renders `@base-ui/react` `render={<Link href={entry.href} />}` (`0` `asChild`) + synchronized `BreadcrumbList` JSON-LD across all 18 non-home subpages. |
| **`SEO-022`** | `GB-05` | **`VERIFIED-CLOSED`** | `app/(public)/faq/page.tsx:1–279` & `components/seo/trust-faq-fanout-data.ts:1–253` render 20 categorized Q&As across all 6 AI fan-out dimensions in server-open `<details open>` HTML with live `visa_rates` PKR interpolation and `1:1` `FAQPage` JSON-LD parity. |
| **`SEO-023`** | `GB-05`, `GB-06` | **`VERIFIED-CLOSED`** | `app/(public)/page.tsx`, `components/public/hero-slider.tsx:227` (single static `<h1>`, Slide 0 `preload`, `0` `"15,000+"` claim), `components/public/marketing-sections.tsx` (RSC, `0` `"use client"`), and `components/seo/trust-home-overview.tsx` (service matrix `<table>` + contextual hub/spoke `<Link>`s). |
| **`SEO-028`** | `GB-06`, `GB-07` | **`VERIFIED-CLOSED`** | `app/(public)/privacy/page.tsx:306–325` explicitly discloses `alramlah_attribution_v1` in §3 (`sessionStorage` table); `/privacy`, `/terms`, and `/refund-policy` include `<PublicBreadcrumbs />` and sibling cross-links. |

---

## 3. Gate-by-Gate Adversarial Verification Evidence

### 3.1 `GB-03` — Hub-and-Spoke Completeness, Next.js 16 Async `params`, `dynamicParams = false` & `>=50%` 4-Gram Differentiation

1. **All 19 Canonical Public Route Patterns Verified at `HEAD`**:
   - Static & Hub routes (`14`): `/`, `/umrah-packages`, `/hajj-2027`, `/umrah-visa`, `/ziyarat`, `/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/refund-policy`, plus `/umrah-packages/from-[city]` (`lahore`, `karachi`, `islamabad`), `/hotels/[city]` (`makkah`, `madinah`), and `/ziyarat/[city]` (`makkah`, `madinah`), plus dynamic `[slug]` (`/umrah-packages/[slug]` + `[slug]/opengraph-image.tsx`).
2. **Next.js 16 Async `params` Compliance (`100%`)**:
   - Every dynamic route and `generateMetadata()` / `Image()` handler declares `params: Promise<{ ... }>` and `await params`:
     - `app/(public)/umrah-packages/[slug]/page.tsx:57, 63, 94, 98`
     - `app/(public)/umrah-packages/[slug]/opengraph-image.tsx:17, 21`
     - `app/(public)/umrah-packages/from-[city]/page.tsx:33, 39, 77, 81`
     - `app/(public)/hotels/[city]/page.tsx:24, 28, 56, 60`
     - `app/(public)/ziyarat/[city]/page.tsx:24, 28, 56, 60`
3. **`dynamicParams = false` & Strict `404` Enforcement on Non-Whitelisted Slugs**:
   - `app/(public)/umrah-packages/from-[city]/page.tsx:16` (`export const dynamicParams = false`) AND `app/(public)/umrah-packages/[slug]/page.tsx:38–41, 65–77, 100–116` (intercepts App Router runtime `/umrah-packages/from-*` requests via `resolveStrictGatewayCityRouteSlug()`, pre-generating `from-lahore`, `from-karachi`, `from-islamabad` and calling `notFound()` for `from-peshawar`, `from-multan`, `from-lhe`, or unknown slugs).
   - `app/(public)/hotels/[city]/page.tsx:15` (`export const dynamicParams = false`, `generateStaticParams` = `makkah`, `madinah`; calls `notFound()` on `/hotels/jeddah`, `/hotels/mecca`, `/hotels/riyadh`, `/hotels/taif`).
   - `app/(public)/ziyarat/[city]/page.tsx:15` (`export const dynamicParams = false`, `generateStaticParams` = `makkah`, `madinah`; calls `notFound()` on `/ziyarat/taif`, `/ziyarat/jeddah`).
4. **Single Semantic `<h1>` Per Public Page (`19/19`)**:
   - Verified across all 19 rendered routes in `tests/seo/gate-b-seo-invariants.test.ts:138–228` (`h1Matches.length === 1`), including `HeroSlider` (`hero-slider.tsx:227` static `<h1>` while rotating slide titles render as `<h2>` on line `232`).
5. **Independently Computed Pairwise 4-Gram Jaccard Uniqueness (`1 - J_4`, Threshold `>= 50.0%`)**:

| Sibling Spoke Pair | Required Minimum | Measured `1 - J_4` Uniqueness | Status |
| :--- | :---: | :---: | :---: |
| `/umrah-packages/from-lahore` vs `/umrah-packages/from-karachi` | `50.00%` | **`93.36%`** | **PASS** |
| `/umrah-packages/from-lahore` vs `/umrah-packages/from-islamabad` | `50.00%` | **`94.19%`** | **PASS** |
| `/umrah-packages/from-karachi` vs `/umrah-packages/from-islamabad` | `50.00%` | **`94.27%`** | **PASS** |
| `/hotels/makkah` vs `/hotels/madinah` | `50.00%` | **`95.69%`** | **PASS** |
| `/ziyarat/makkah` vs `/ziyarat/madinah` | `50.00%` | **`97.28%`** | **PASS** |

---

### 3.2 `GB-05` — AI Search (GEO) Liftability, Wholesale SAR Confidentiality & All 9 Haramain Business Invariants

1. **AI Search (GEO) Answer-First Summaries, Tables/Lists & 6-Dimension Fan-Out FAQs**:
   - Answer-first lead paragraphs (`<65`w target): `/umrah-packages` (`46`w), `from-lahore` (`49`w), `from-karachi` (`47`w), `from-islamabad` (`44`w), `/umrah-visa` (`51`w), `/ziyarat` (`51`w), `/hajj-2027` (`54`w); `docs/audit/seo/post-fix/geo_liftability.json` confirms `total_paragraphs_over_200_words: 0`.
   - Semantic `<table>` & `<ul>`/`<ol>` blocks rendered in static server HTML across `/`, `/umrah-packages`, `/umrah-packages/from-*`, `/hajj-2027`, `/umrah-visa`, `/hotels/*`, `/ziyarat/**`, `/contact`, and `/privacy`.
   - `components/seo/trust-faq-fanout-data.ts` authors 20 Q&As across all 6 fan-out dimensions (`scope`, `cost_drivers`, `comparisons`, `edge_cases`, `scam_red_flags`, `verification`), interpolating live `getPublicVisaRates()` PKR tariffs (`buildFanoutFaqCategories(visaRates)`) and rendering in server-open `<details open>` elements on `/faq` with `1:1` `FAQPage` JSON-LD parity.
2. **Wholesale SAR Confidentiality (`SEO-002`)**:
   - `lib/seo/public-queries.ts` (`toPublicHotelDto` lines `159–188`, `getPublicVehiclesCatalog` lines `222–264`, `getPublicVisaRates` lines `269–302`, `toPublicGroupPackageDto` lines `366–401`) and `sanitizeHomePlannerCatalog()` (`components/seo/trust-home-overview.tsx:98–223`) strip **all** wholesale supplier SAR columns (`sharingPriceSar`, `roomPriceSar`, `quadPriceSar`, `triplePriceSar`, `doublePriceSar`, `breakfastPriceSarPerPax`, `lunchPriceSarPerPax`, `dinnerPriceSarPerPax`, `fullBoardPriceSarPerPax`, `defaultRateSar`, `ziyaratRateSar`, `sharedBusRateSarPerPax`, `terminalParkingFeeSar`) and `updatedByUserId`. *(Retail statutory Saudi visa tariff columns on `PlannerCatalogData.visaRates` are intentionally retained only for client-side `calculateVisaTierAndCost` preview math on `/`, while `/umrah-visa` and `/faq` strip all `*Sar` fields via `getPublicVisaRates()`.)*
   - Verified empirically by `tests/seo/gate-b-seo-invariants.test.ts:520–621`.
3. **All 9 Haramain Business Invariants + `OD-10` Verified in Live Code**:

| # | Invariant | Live Enforcement Evidence | Status |
| :---: | :--- | :--- | :---: |
| **1** | Auto-calculated `short_term` (`<=30`d) vs `long_term` (`31–90`d) visa tier & mandatory KSA dates (`OD-09c`) | `app/actions/applications.ts:632–676, 947–1025` computes inclusive KSA days server-side and requires valid KSA Arrival & Departure dates whenever `includeVisa` is true (`visa_only` included); zero manual visa-tier selector in UI. | **PASS** |
| **2** | Volatile services lock (`"Live Rate — Confirmed upon submission"`) | `components/planner/live-summary-card.tsx:348`, `guides-hotels-view.tsx`, and `guides-ziyarat-view.tsx` display `"Live Rate — Confirmed upon submission"` whenever Flights/Hotels/Transport/Ziyarat are active; `0` `Offer.price` emitted in hotel/ziyarat JSON-LD. | **PASS** |
| **3** | Makkah airport lock (`entryAirport === "JED"`) | Locked on client (`planner-context.tsx:776, 929, 1454`) and enforced on server (`applications.ts:1044–1046`: `effectiveEntryAirport = "JED"` when `citySequence === "makkah_madinah"`). | **PASS** |
| **4** | `Adults + Children` beds/seats vs Infant (`<2` yrs) `0` beds / `0` seats + `infantPricePkr` (`OD-09d`) + soft seat hold (`T-022`) | Enforced by DB `CHECK` constraint `chk_applications_traveller_invariants` (`db/schema/applications.ts:254–257`), `group-booking-modal.tsx:205–206, 267–269`, and `applications.ts:1531, 1557` (no `bookedSeats` increment on unapproved intake). | **PASS** |
| **5** | Private room auto-splitter on `?hotelId=` deep links | `planner-context.tsx:934–960` invokes `calculatePrivateRoomSplits(bedCount, matchedHotel.availableRoomTypes)` using `bedCount = adults + children` (`infants = 0` beds) and respects `allowsSharedRooms` / `allowsPrivateRooms`. | **PASS** |
| **6** | Vehicle fleet capacity bands & Haramain Train `shared_only` | `guides-ziyarat-data.ts:169–211` documents `1–3` Sedan, `4–6` SUV, `7–12` Van/Minibus, `13+` Coach, and Haramain High-Speed Train `shared_only` intercity rail; Ziyarat vehicle selectors filter out `isTrainVehicle` (`review-and-submit-step.tsx:132–138`, `live-summary-card.tsx:116`). | **PASS** |
| **7** | Seamless hotel stay chaining | `planner-context.tsx:722, 916–928` (`chainItineraryDates`) and server Zod `superRefine` (`applications.ts:687–707`) enforce `checkOut[i] === checkIn[i+1]` and `departureDate === lastStay.checkOutDate`. | **PASS** |
| **8** | `OD-09b` `0`-tier `"On Request"` + modal disable + JSON-LD exclusion | `umrah-pricing-helpers.ts:31–51`, `umrah-package-booking-cta.tsx:164–199`, `group-booking-modal.tsx:594–618, 674–683` (`disabled={isZeroTier}`), `lib/seo/json-ld.ts` (`positivePrices > 0` filter), and server guard `applications.ts:1525–1529` (`ratePerPersonPkr <= 0` rejected). | **PASS** |
| **9** | `OD-09e` Hajj 2027 Indicative pre-registration + `Maktab A+` + `OD-10` truthful licenses | `guides-hajj-data.ts:22` (`HAJJ_2027_REGULATORY_DISCLAIMER`), `guides-hajj-view.tsx` (`"Indicative 2027 Estimate"` badges, `Service` JSON-LD), `hajj-inquiry-section.tsx:431–442, 517–525` (`coerceMaktabCode("A+") === "A+"`, `packages = []` closed), `trust-eeat-credentials.tsx:47–50` & `public-footer.tsx:132–140` (`OD-10` null-license guard), `hero-slider.tsx` (`0` `"15,000+"` claim). | **PASS** |

---

### 3.3 `GB-06` — Zero-Orphan Internal Link Graph & `<Suspense>` Spoke-to-Builder URL Prefill

1. **Zero Orphan Public Routes & `>= 3` Contextual Inbound `<Link>`s**:
   - `docs/audit/seo/post-fix/internal_links.json` confirms `total_routes: 40`, `orphan_contextual_routes: []` (`0` orphans), and `weak_anchor_texts: []` (`0` generic `"click here"` / `"read more"` / `"learn more"` anchors).
   - `tests/seo/gate-b-seo-invariants.test.ts:987–1013` renders all 19 public routes and verifies every static and spoke route has **`>= 3` distinct inbound `<Link>` page sources**.
2. **`<PublicBreadcrumbs />` & Shell Link Hygiene**:
   - `components/layout/breadcrumbs.tsx` uses `@base-ui/react` `render={<Link href={entry.href} />}` (`0` Radix `asChild`) and emits 1:1 `BreadcrumbList` JSON-LD across all 18 non-homepage indexable routes (`gate-b-seo-invariants.test.ts:264–285`).
   - `components/layout/public-footer.tsx` contains **`0` `/admin` links** and **`0` `www.` links** (`BRAND_WEBSITE_DOMAIN = "alramlahtravels.com"` linked via `<Link href="/">` on lines `187–192`).
3. **`<Suspense>` `<PlannerUrlHydrator />` Override Over Stale `sessionStorage`**:
   - `components/planner/planner-context.tsx:2788–2790` mounts `<Suspense fallback={null}><PlannerUrlHydrator /></Suspense>` inside `PlannerProvider` so `/` keeps `revalidate = 300` ISR without dynamic bail-out.
   - Hydration order (`planner-context.tsx:1389–1526`): `sessionStorage["alramlah_planner_draft_v1"]` is restored first (`lines 1396–1477`), and `applySearchStringPrefill()` runs immediately after (`lines 1502–1526`) via `resolvePlannerPrefillState()`, guaranteeing `?preset=`, `?departureCity=`, `?citySequence=`, `?hotelId=`, and `?ziyaratCity=` deterministically override stale drafts while preserving all Haramain invariants. Proven by `tests/w6/f-seo-shell/shell-and-attribution.test.ts:191–275`.

---

### 3.4 `GB-07` — End-to-End First-Touch Attribution (`UtmTracker` → DB → Admin UI & Formula-Safe CSV)

1. **Database Migration & Drizzle Schema (`drizzle/0003_seo_lead_attribution.sql`)**:
   - Adds `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` (`varchar(150)`), `landing_page`, `http_referrer` (`varchar(512)`) + `idx_applications_utm_source_campaign` and `idx_contact_messages_utm_source` with `IF NOT EXISTS` idempotency, mirrored in `db/schema/applications.ts:227–233, 250–253` and `db/schema/cms.ts:116–128`.
2. **First-Touch Capture & Sanitization (`lib/seo/utm.ts` & `components/seo/utm-tracker.tsx`)**:
   - `<Suspense fallback={null}><UtmTracker /></Suspense>` in `app/(public)/layout.tsx:17–19` invokes `captureFirstTouchAttribution()` into `sessionStorage["alramlah_attribution_v1"]` (disclosed in `/privacy` §3, `app/(public)/privacy/page.tsx:306–325`).
   - First-touch lock (`utm.ts:199–226`): preserves initial `landingPage` and external `httpReferrer` across internal SPA hops, overwriting UTM parameters only when a subsequent URL explicitly carries fresh `utm_*` params.
   - Hardened sanitization (`utm.ts:62–145`): strips ASCII control chars (`\u0000-\u001F`, `\u007F`), caps `utm_*` at `150` chars, requires `landingPage` to start with a single `/` (rejecting `//evil.example` protocol-relative open redirects and stripping `#fragment`), and restricts `httpReferrer` to external `http:`/`https:` origins with credentials (`username`/`password`) and `#hash` stripped (`<=512` chars).
3. **All 5 Client Entry Points & All 4 Public Lead Server Actions + WhatsApp Suffix**:
   - Client forms attaching `readStoredAttribution()`: `review-and-submit-step.tsx:354`, `lead-capture-dialog.tsx:121`, `group-booking-modal.tsx:346`, `hajj-inquiry-section.tsx:588`, and `contact-section.tsx:86`.
   - Server Actions validating via `strictAttributionSchema` and persisting all 7 columns: `submitCustomApplication` (`applications.ts:1126–1132`), `submitGroupBookingApplication` (`applications.ts:1577–1583`), `submitHajjInquiryApplication` (`applications.ts:1798–1804`), and `submitPublicContactInquiryAction` (`applications.ts:1938–1944`), plus delegated `submitContactMessage` (`cms.ts:688–690`) and `submitGroupBooking` / `submitHajjInquiry` (`groups.ts:662–668`).
   - WhatsApp attribution continuity: `components/layout/whatsapp-fab.tsx:26–35` and server-built `waMessage` strings (`applications.ts:1256, 1628, 1842`) append `formatWhatsAppAttributionSuffix()`.
4. **Admin Attribution Telemetry & Formula-Safe CSV Export**:
   - `ApplicationDossier` (`application-dossier.tsx:182–291`, loaded by `app/admin/(dashboard)/applications/[id]/page.tsx:41–78`) and `MessagesClient` (`messages-client.tsx:362–424`, loaded by `app/admin/(dashboard)/catalog/page.tsx:102–105` and `/admin/messages` redirect) render Acquisition Channel (`inferAcquisitionChannel` detecting Paid, Organic Search, AI Answer Engines `chatgpt.com`/`perplexity.ai`/`claude.ai`/`gemini.google.com`, Social, Referral, Direct) + UTM/landing/referrer badges.
   - `exportApplicationsCsvAction` (`app/actions/quotes.ts:2299–2360`) exports `UTM Source`, `UTM Medium`, `UTM Campaign`, `UTM Content`, `UTM Term`, `Landing Page`, and `HTTP Referrer`, neutralizing spreadsheet formula payloads (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`) via leading `'` in `sanitizeCsvCellInternal()` (`quotes.ts:192–210`).
   - Real PostgreSQL round-trip + CSV formula-injection neutralization (`"=CMD|' /C calc'!A0"` → `"\"'=CMD|' /C calc'!A0\""`) empirically proven in `tests/integration/seo-utm-attribution.integration.test.ts` (`2/2` passed).

---

## 4. Non-Blocking Observations (`P3` Polish — Zero Gate Impact)

- **Secondary `/admin/desk?tab=web_messages` Column Projection (`P3` Info)**: Canonical Contact Inquiries view `/admin/catalog?tab=messages` (and `/admin/messages` redirect) selects all `contactMessages` columns (`app/admin/(dashboard)/catalog/page.tsx:102–105`) and displays all 7 attribution badges in `<MessagesClient />` (`SEO-025` target files `100%` satisfied). The secondary embedded `web_messages` tab inside `app/admin/(dashboard)/desk/page.tsx:306–318` uses an explicit narrow `.select({ id, name, ... })` projection omitting the 7 optional attribution columns, so `<MessagesClient />` safely omits badges on that secondary tab unless those columns are added to `desk/page.tsx`'s projection in a future polish pass.

---

## 5. Final Sign-Off (`v-seo-02`)

Gates **`GB-03`**, **`GB-05`**, **`GB-06`**, and **`GB-07`** and all assigned `SEO-ID`s (**`SEO-015`..`SEO-020`**, **`SEO-024`**, **`SEO-025`**, **`SEO-029`..`SEO-031`**) are **empirically verified and `VERIFIED-CLOSED`** at `HEAD` = `e95b9f1`.
