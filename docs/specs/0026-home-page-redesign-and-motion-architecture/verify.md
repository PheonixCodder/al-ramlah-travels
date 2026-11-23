# Verify: Home Page Editorial Redesign and Public Motion Architecture · spec 0026 · updated 2026-11-20

_Steps derived from spec 0026 acceptance criteria and Value Sourcing table. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Visit `/` at `1440x900` or `1920x1080` and interact with `#journey-builder` (choose Visa Only or Full Umrah, open a hotel or calendar popover, inspect sticky `LiveSummaryCard` on the right) → builder works identically with `0` modified lines in `components/planner/` and catalog sourced from `sanitizeHomePlannerCatalog()` → AC-1
- [x] Scroll `/` with normal motion settings, then open `/admin/login` and `/voucher/invalid` → `html.lenis` smooth scroll runs on `/` synced to `gsap.ticker`, while `/admin` and `/voucher` remain on native browser scroll → AC-2
- [x] Open the `Book Package Seats` modal on a Group Umrah card or open a Base UI select/popover inside `#journey-builder` and wheel scroll inside the overlay → inner list scrolls natively via `shouldPreventLenisScroll` without moving the background document → AC-3
- [x] Enable OS `prefers-reduced-motion: reduce` (or disable JavaScript) and reload `/` → `html.lenis` is absent, GSAP spatial transforms are skipped, and `100%` of copy and cards render at `opacity: 1` → AC-4
- [x] Inspect `HeroSlider` at top of `/` → Slide `0` renders immediately with `preload`, single `<h1>` (`HOME_HERO_PRIMARY_H1`), luminous Haramain courtyard photo, clickable slide selector tabs (`01`..`03`) that pause rotation on hover or focus, and 4 concierge pillars sourced from `getPublicHeroSlides()` + `lib/constants/brand.ts` → AC-5
- [x] Filter `GroupPackagesSection` by tier pill (`All`, `VIP`, `Gold`, `Economy`) and `#gp-gateway-filter`, drag or arrow through the horizontal carousel, inspect flyer banners and multi hotel tier count badge, and click `Book Package Seats` → shared `Motion` pill slides cleanly, white text never collides with poster flyers, 4 PKR columns (`Sharing`/`Quad`/`Triple`/`Double`) + `infantPricePkr` match `getPublicGroupPackages()`, and modal opens → AC-6
- [x] Inspect `HajjInquirySection` (`#hajj-2027`) at desktop width → all 4 Maktab cards (`A+`, `A`, `B`, `C`) sit in a 4 column row with `indicativeQuadPkr` estimates from `getPublicHajjPackages()`; switch `Inclusions`, `6 Documents`, and `3-Step Process` tabs on the left and check `#hajj-reservation-card` on the right → `HAJJ_2027_REGULATORY_DISCLAIMER` (`OD-09e`) and all `#h-*` / `#opt-*` inputs are present → AC-7
- [x] Enter or prefill a reference and phone in `StatusTracker` (`#track-status`, `#tracker-ref`, `#tracker-phone`) → compact horizontal bar expands smoothly via `AnimatePresence` with redacted dossier data from `lookupApplicationStatus()` → AC-8
- [x] Scroll through `TrustHomeOverview`, `MarketingSections`, `FaqAccordionClient`, and `ContactSection` (`#contact`) → duplicate Section `6B` table is gone, consolidated rules matrix preserves spoke directory links (`GB-06`), gold `ScrollTrigger` line progresses across the 4 quoting steps, `Makkah` / `Madinah` tabs switch the 6 card Ziyarat showcase (`getPublicZiyaratCatalog()`), 2 column `keepMounted` FAQ matches `buildFaqPageJsonLd()` 1:1 (`resolveHomeFaqs()`), and Askari 10 Lahore Cantt contact details match `getCachedCompanyInfo()` → AC-9
- [x] Measure `/` document height at `1920x1080` (`<= 14,000 px`, `>= 40%` reduction from `25,930 px`) and check `375x812` and `320x640` viewports → `0 px` horizontal overflow and `0` serious or critical Axe WCAG 2.2 AA violations → AC-10

## Commands

- [x] `git -C web diff --exit-code -- components/planner` → exit `0` (`0` bytes changed) → AC-1
- [x] `cd web && npm run ui:lint -- components/motion components/public components/seo app/(public)` → `0 FAIL` → AC-4, AC-10
- [x] `cd web && npx next typegen && npm run typecheck && npx tsc --noEmit -p tests/e2e/tsconfig.json && npm run lint` → `0` TypeScript and ESLint errors → AC-2, AC-10
- [x] `cd web && npx vitest run tests/unit/home-motion-and-proportion.test.ts tests/seo/gate-b-seo-invariants.test.ts tests/w3/f-pub/a11y-arabic-and-motion.test.ts` → `12/12` tests pass (`GB-01`..`GB-06`, SSR `opacity: 1`, `shouldPreventLenisScroll` portal guard) → AC-1, AC-2, AC-3, AC-4, AC-5, AC-9, AC-10
- [x] `cd web && npm run test:e2e -- tests/e2e/j01-j05-public-pilgrim.spec.ts tests/e2e/j23-seo-crawl-and-attribution.spec.ts` (requires local Docker `.env.audit` PostgreSQL on `127.0.0.1:54329`) → `J1`..`J5` and `J23` pass end to end → AC-1, AC-6, AC-7, AC-8, AC-10
- [x] `cd web && npm run cdd:check` → `7/7` CDD & SDD governance gates pass → AC-10

## Acceptance-criteria coverage

- AC-1 covered by UI step 1 and Commands steps 1, 4, 5 · AC-2 covered by UI step 2 and Commands steps 3, 4 · AC-3 covered by UI step 3 and Commands step 4 · AC-4 covered by UI step 4 and Commands steps 2, 4 · AC-5 covered by UI step 5 and Commands step 4 · AC-6 covered by UI step 6 and Commands step 5 · AC-7 covered by UI step 7 and Commands step 5 · AC-8 covered by UI step 8 and Commands step 5 · AC-9 covered by UI step 9 and Commands step 4 · AC-10 covered by UI step 10 and Commands steps 2, 3, 4, 5, 6
