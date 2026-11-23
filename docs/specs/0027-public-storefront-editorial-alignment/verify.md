# Verify: Secondary Public Hubs, Spokes and Shell Editorial Alignment · spec 0027 · updated 2026-11-21

_Steps derived from spec 0027 acceptance criteria and Value Sourcing table. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Inspect `PublicHeader`, `PublicFooter`, `PublicBreadcrumbs`, and `WhatsAppFab` across `/umrah-packages`, `/umrah-visa`, `/hajj-2027`, and `/faq` → gold active `MotionPillIndicator` underlines the active nav link (`HEADER_NAV_LINKS`), `AST` prayer pill (`computeHaramainPrayerTimes()`) and Askari 10 contact details (`getCachedCompanyInfo()`) render cleanly, null licenses stay hidden (`OD-10`), and `WhatsAppFab` preserves current path + stored UTM suffix (`readStoredAttribution()`) → AC-3
- [x] Visit `/umrah-packages`, `/umrah-packages/from-lahore`, `/umrah-packages/from-karachi`, `/umrah-packages/from-islamabad`, and an active `/umrah-packages/[slug]`, plus `/umrah-packages/unknown-slug` and `/umrah-packages/from-peshawar` → `PublicPageHero` (`persuade-emerald` / `persuade-ivory`) renders single `<h1>` (`getUmrahCityPrimaryHeading`) and `BreadcrumbList` last in JSON LD, `<= 0` tiers show `"On Request"` (`formatTierPriceOrOnRequest`), infant rule shows `"0 bed"` and `"0 seat"`, empty catalog shows calm `/#journey-builder` fallback, and invalid slugs return `404` → AC-2, AC-4, AC-9
- [x] Open `GroupBookingModal` (`Book Package Seats`) on an active group package → active future batches (`getTodayPktIso()`), `multiHotelOptions`, `"On Request"` disabled zero tiers, `#gb-*` inputs, and `Adults + Children` seat math render with semantic tokens and keyboard focus rings (`J3` E2E + `public-storefront-alignment.test.ts`) → AC-3
- [x] Visit `/umrah-visa`, `/hajj-2027`, `/hotels/makkah`, `/hotels/madinah`, `/ziyarat`, and `/ziyarat/makkah` → `/hajj-2027` renders `persuade-emerald` `PublicPageHero`, 4 column Maktab row (`getPublicHajjPackages()` / `FALLBACK_INDICATIVE_HAJJ_PACKAGES`), `HAJJ_2027_REGULATORY_DISCLAIMER`, below the fold `<HaramainSectionReveal>`, and `0` `InStock`/`Product`; `/umrah-visa`, `/hotels/*`, and `/ziyarat*` render calm `read` `PublicPageHero` (`0` scroll reveals) with `{LIVE_RATE_CONFIRMATION_LABEL}` and `0` `Offer`/`price` in hotel/Ziyarat JSON LD → AC-2, AC-5, AC-7, AC-9
- [x] Visit `/about`, `/faq`, `/contact`, `/terms`, `/privacy`, and `/refund-policy` → all 6 render static `read` `PublicPageHero` (`0` scroll reveals), `/faq` renders `18` to `24` `<details open><summary>` Q&As matching `FAQPage` JSON LD `1:1` (`buildMergedPilgrimageFaqs` + `getPublicVisaRates()`), `/contact` renders PKT hours `<table>` + `<ContactSection />`, `/about` renders honest `TrustEeatCredentials`, and `/privacy`, `/terms`, `/refund-policy` preserve all `OD-06` storage/retention/opt out disclosures → AC-2, AC-6, AC-7, AC-9
- [x] Check `375x812` and `320x640` mobile viewports and run Axe WCAG 2.2 AA across representative secondary routes → `0 px` horizontal overflow and `0` serious or critical violations → AC-10

## Commands

- [x] `git -C web diff --exit-code HEAD -- components/planner "app/(public)/voucher" components/public/voucher-loader.ts components/public/voucher-print-button.tsx components/seo/trust-faq-fanout-data.ts` → exit `0` (`0` bytes changed) → AC-1
- [x] `cd web && npx vitest run tests/unit/public-storefront-alignment.test.ts` → `11/11` checks pass including programmatic `sloplint` `0 FAIL` across the entire `AC-8` path list → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10
- [x] `cd web && npx vitest run tests/seo/gate-b-seo-invariants.test.ts tests/w6/f-seo-umrah tests/w6/f-seo-guides tests/w6/f-seo-trust` → `18/18` SEO, JSON LD, Jaccard `>= 60%`, and link graph tests pass → AC-4, AC-5, AC-6, AC-9
- [x] `cd web && npx next typegen && npm run typecheck && npx tsc --noEmit -p tests/e2e/tsconfig.json && npm run lint && npm run cdd:check` → `0` TypeScript/ESLint errors and `7/7` CDD & SDD gates pass → AC-10

## Acceptance-criteria coverage

- AC-1 covered by Commands steps 1, 2 · AC-2 covered by UI steps 2, 4, 5 and Commands step 2 · AC-3 covered by UI steps 1, 3 and Commands step 2 · AC-4 covered by UI step 2 and Commands step 3 · AC-5 covered by UI step 4 and Commands step 3 · AC-6 covered by UI step 5 and Commands step 3 · AC-7 covered by UI steps 4, 5 and Commands step 2 · AC-8 covered by Commands step 2 · AC-9 covered by UI steps 2, 4, 5 and Commands step 3 · AC-10 covered by UI step 6 and Commands step 4
