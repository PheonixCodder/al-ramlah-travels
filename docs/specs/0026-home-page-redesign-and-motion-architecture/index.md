# 0026. Home Page Editorial Redesign and Public Motion Architecture

**Date**: 2026-11-20
**Status**: Accepted
**Tier**: Beta
**Scope**: [scope.md](../../scope/scope.md) Feature #50 (Slice 46)
**Decision Record & Verify Checklist**: [rationale.md](./rationale.md) · [verify.md](./verify.md)
**Constitutional Invariants**: `CONST-DOM-01`, `CONST-DOM-03`, `CONST-DOM-04`, `CONST-DOM-05`, `CONST-DOM-07`, `CONST-DOM-09`, `CONST-SEC-03`, `CONST-SEC-08`, `CONST-OMNI-04`, `CONST-SEO-01`, `CONST-SEO-02`, `CONST-SEO-03`, `CONST-SEO-04`, `CONST-SEO-05`, `CONST-UI-01`, `CONST-UI-02`, `CONST-UI-03`, `CONST-UI-04`, `CONST-UI-05`
**Owned Paths (Touch Boundary)**:
- **Orchestrator Only**: `web/package.json`, `web/package-lock.json`, `web/docs/scope/scope.md`, `AGENTS.md`, `web/AGENTS.md`, `web/docs/INDEX.md`, `.mcp.json`, `web/.mcp.json`, `.gemini/settings.json`, `.agents/plugins/al-ramlah-workspace/mcp_config.json`, `web/.agents/skills/{motion,gsap-*,lenis-smooth-scroll}/**`
- **Worker M1 (Motion Runtime & Public Shell)**: `web/components/motion/**`, `web/app/(public)/layout.tsx`, `web/app/globals.css`
- **Worker M2 (Hero & Group Packages)**: `web/components/public/hero-slider.tsx`, `web/components/public/group-packages-section.tsx`
- **Worker M3 (Hajj 2027 & Status Tracker)**: `web/components/public/hajj-inquiry-section.tsx`, `web/components/public/status-tracker.tsx`
- **Worker M4 (Marketing, Ziyarat, FAQ, Contact & Home Composition)**: `web/components/public/marketing-sections.tsx`, `web/components/public/marketing-client-islands.tsx`, `web/components/public/faq-accordion-client.tsx`, `web/components/seo/trust-home-overview.tsx`, `web/components/public/contact-section.tsx`, `web/app/(public)/page.tsx`
- **Worker M5 (Automated Verification)**: `web/tests/unit/home-motion-and-proportion.test.ts`
- **STRICT ZERO-TOUCH EXCLUSION**: `web/components/planner/**` and the `#journey-builder` `<CustomJourneyBuilder />` invocation in `web/app/(public)/page.tsx` (`0` bytes modified)
**UI Surface Mode**: Persuade (with Operate + Read sub-surfaces on Status Tracker, Hajj Pre-Registration, and FAQ)

---

## Summary

The current Home Page (`/`) stretches to `25,930 px` (`24` full `1080p` desktop screens across 11 PDF pages) because of stacked unequal group package walls, supplier flyer text collisions, a `3+1` orphaned Hajj Maktab grid, a 12-card Ziyarat wall, and duplicate Haramain rules tables. This slice introduces a unified public motion runtime (`lenis`, `gsap` + `@gsap/react`, `motion` + `framer-motion`) on `app/(public)/layout.tsx` and redesigns every section around the untouched `Design Your Custom Umrah Pilgrimage` (`#journey-builder`) centerpiece so the page lands around `10,500 px` to `13,000 px` (`~50%` leaner) with Sacred Haramain luxury craft, 60fps choreography, and zero SEO or accessibility regressions.

---

## Requirements & Acceptance Criteria (EARS)

**User stories**:
- As a **Pakistani or Diaspora Pilgrim**, I want a calm, well-proportioned Home Page with smooth scrolling and clear visual hierarchy around the Custom Journey Builder so that I can compare fixed departures, Hajj 2027 Maktabs, Ziyarat sanctuaries, and quote statuses without scrolling through 24 screens of repetitive boxes.
- As **Agency Leadership**, I want `Lenis`, `GSAP`, `Motion`, and `Framer Motion` integrated cleanly with official AI skills and Motion MCP governance while keeping `#journey-builder` (`web/components/planner/**`) 100% untouched.

**Acceptance criteria**:
- **AC-1 (Zero-Touch Custom Journey Builder Lock)**: When `/` renders or builds, `git diff web/components/planner` shall remain strictly empty (`0` modified lines) and `<div id="journey-builder">` wrapping `<CustomJourneyBuilder />` in `web/app/(public)/page.tsx` shall preserve its exact props, sticky `LiveSummaryCard` (`sticky top-20`), Base UI popovers/dialogs, and step `scrollIntoView` behavior.
- **AC-2 (Single-RAF Lenis + GSAP + Motion Public Provider)**: When any route under `app/(public)/layout.tsx` mounts with `prefers-reduced-motion: no-preference`, `<PublicMotionProvider>` shall run `<ReactLenis root options={{ autoRaf: false, anchors: { offset: -80 }, prevent }}>` driven exclusively by `gsap.ticker` (`ScrollTrigger.update` synced on `scroll`) alongside `<MotionConfig reducedMotion="user">`, while leaving `/admin/**` and `/voucher/**` on native browser scroll.
- **AC-3 (Automatic Portal & Nested Scroll Isolation)**: When a user scrolls inside any Base UI portal (`[data-base-ui-portal]`), modal/drawer (`[role="dialog"]`), select/combobox (`[role="listbox"]`, `[data-slot="select-content"]`, `[data-slot="command-list"]`), or overflow container (`overflow-y: auto | scroll` with `scrollHeight > clientHeight`), the Lenis `prevent` predicate shall yield immediately to native scrolling without requiring edits inside `web/components/planner/**`.
- **AC-4 (Reduced-Motion & SSR Visibility Safety)**: When `prefers-reduced-motion: reduce` is active OR JavaScript has not hydrated (`renderToStaticMarkup` / crawler SSR), Lenis smooth interpolation and GSAP scroll/entrance motion (`gsap.matchMedia()`) shall bypass spatial movement and `100%` of page copy and cards shall render at full visibility (`opacity: 1`, `sloplint` Gate `62` & `27` compliant).
- **AC-5 (Luminous Single-Eyebrow Hero & Authored Entrance)**: When `HeroSlider` renders on `/`, it shall display Slide `0` immediately for LCP (`preload` image, single semantic `<h1>`, single non-competing badge, readable Haramain courtyard photography without crushed black vignettes, interactive slide selector tabs, and refined 4-pillar concierge strip), pausing auto-advance on hover, focus, or reduced motion.
- **AC-6 (Editorial Horizontal Group Umrah Carousel & Flyer-Safe Header)**: When `GroupPackagesSection` renders on `/`, it shall present all open upcoming packages in the DOM inside an equal-height horizontal Embla/Motion carousel (`~820 px` section height) with `Motion` `layoutId` tier filter pills, `#gp-gateway-filter`, clean banner framing that prevents white title text colliding over text-heavy supplier flyers, a compact multi-hotel tier count badge instead of 4 nested sub-cards, and intact `/Book Package Seats/i` modal triggers (`J3` compatible).
- **AC-7 (Balanced 4-Column Hajj 2027 Showcase & 2-Column Split)**: When `HajjInquirySection` renders on `/`, it shall display Maktab tiers (`A+`, `A`, `B`, `C`) in a balanced 4-column desktop grid (`xl:grid-cols-4`, zero `3+1` orphan card) above a 2-column split pairing a `Motion`-tabbed Readiness Guide (`Inclusions` | `6 Documents` | `3-Step Process`) on the left with a compact `#hajj-reservation-card` form on the right, preserving `OD-09e` regulatory disclaimers and all `#h-*` / `#opt-*` inputs (`J4` compatible).
- **AC-8 (Crisp Horizontal Status Tracker & Animated Dossier Reveal)**: When `StatusTracker` (`#track-status`) renders at rest, it shall present a compact horizontal lookup bar (`#tracker-ref`, `#tracker-phone`, high-contrast Haramain Emerald CTA) and animate dossier/quote/voucher state expansion smoothly via `AnimatePresence` while preserving `alramlah:prefill-tracker` and `?trackRef=` (`J5` compatible).
- **AC-9 (Consolidated Lower Storefront Rhythm & Duplicate Table Removal)**: When the lower half of `/` renders, the duplicate Section `6B` rules table in `web/app/(public)/page.tsx` shall be removed and its spoke links merged cleanly into `TrustHomeOverview` / `MarketingSections`, featuring a compact Service & Rules Matrix, asymmetric Why Choose Us bento, a GSAP `ScrollTrigger` gold-line 4-Step Quoting Timeline, a `Motion`-tabbed Makkah/Madinah Ziyarat showcase (`6` curated cards visible per tab + `/ziyarat` CTA), a 2-column Editorial FAQ (`keepMounted` 1:1 JSON-LD parity), and a refined Askari 10 `ContactSection` (`#contact`).
- **AC-10 (Proportion Target & Full Gate Parity)**: When `/` renders at `1440×900` (and `1920×1080`), total resting document height shall drop by `>= 40%` from the `25,930 px` baseline (target `10,500 px`–`14,000 px`), maintaining `0` horizontal overflow at `320×640` and `375×812`, `0` `sloplint` `FAIL`s on touched files, `100%` Gate B SEO/GEO link & JSON-LD parity (`GB-01`–`GB-06`), `0` serious/critical Axe WCAG 2.2 AA violations, and `7/7` `npm run cdd:check` passes.

---

## Decision & Implementation Skills

**Chosen option**: Option 1 — **Single-RAF Hybrid Architecture (`Lenis` + `GSAP` Ticker/ScrollTrigger + `Motion`/`Framer Motion` UI State) Scoped to `app/(public)`** (full trade-off analysis in [rationale.md](./rationale.md)).

`Lenis` provides lightweight inertial page scrolling driven by GSAP's single `requestAnimationFrame` ticker so `ScrollTrigger` scrub timelines never jitter, while `motion/react` (`v14.14+`, paired with `framer-motion` at matching version) handles declarative React component transitions (`layoutId` pills, `AnimatePresence` tabs, dossier expansion) under `<MotionConfig reducedMotion="user">`.

**Implementation skills**:
- **Workflow & Governance**: `architect` (`web/.agents/skills/architect/SKILL.md`) · `develop` (`web/.agents/skills/develop/SKILL.md`) · `check` (`web/.agents/skills/check/SKILL.md`) · `test` (`web/.agents/skills/test/SKILL.md`) · `sync` (`web/.agents/skills/sync/SKILL.md`)
- **Motion, GSAP & Lenis**: `motion` (`web/.agents/skills/motion/SKILL.md`) · `gsap-react` (`web/.agents/skills/gsap-react/SKILL.md`) · `gsap-scrolltrigger` (`web/.agents/skills/gsap-scrolltrigger/SKILL.md`) · `gsap-timeline` (`web/.agents/skills/gsap-timeline/SKILL.md`) · `gsap-core` (`web/.agents/skills/gsap-core/SKILL.md`) · `gsap-performance` (`web/.agents/skills/gsap-performance/SKILL.md`) · `lenis-smooth-scroll` (`web/.agents/skills/lenis-smooth-scroll/SKILL.md`)
- **UI, Primitives & SEO**: `impeccable` (`web/.agents/skills/impeccable/SKILL.md`) · `hallmark` (`web/.agents/skills/hallmark/SKILL.md`) · `shadcn` (`web/.agents/skills/shadcn/SKILL.md`) · `nextjs-business-seo-geo-auditor` (`web/.agents/skills/nextjs-business-seo-geo-auditor/SKILL.md`)

---

## Feature Design & Value Sourcing

### Data Model & Migration Sketch
No schema changes required (`48` PostgreSQL tables and `0000`–`0003` Drizzle migrations remain unchanged).

### State Transitions
No backend state machine changes. Client UI state additions are strictly ephemeral view states:
1. `GroupPackagesSection`: active tier filter pill (`all | vip | gold | silver | bronze | economy`), gateway filter (`all | LHE | KHI | ISB | ...`), and Embla carousel slide index (`prev`/`next` buttons + drag).
2. `HajjInquirySection`: active Maktab filter/selection (`selectedPkgId`) + active Readiness tab (`inclusions | documents | process`).
3. `MarketingSections` (Ziyarat): active sanctuary tab (`all | makkah | madinah`, defaulting to `6` featured landmarks with instant tab switch to Makkah or Madinah).

### API Surface (Server Actions & Route Handlers)
No Server Action or Route Handler signatures change. Existing public actions remain wired identically:

| Endpoint / Action | Method | Auth Guard | Zod Schema | Key Inputs | Key Outputs | Key Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `submitGroupBookingApplication` | Server Action | Public + Honeypot + Rate Limit | `groupBookingSchema` | `packageId`, `departureId`, `adults`, `children`, `infants`, `customer*`, UTM | `{ success, referenceNumber }` | `422` validation / seat capacity |
| `submitHajjInquiryApplication` | Server Action | Public + Honeypot + Rate Limit | `hajjInquirySchema` | `hajjPackageId`, `roomType`, `customer*`, `adults`, add-ons, UTM | `{ success, referenceNumber }` | `422` validation |
| `lookupApplicationStatus` | Server Action | Public + `5/15m` IP & `12/15m` Ref Rate Limit (`CONST-SEC-08`) | `statusLookupSchema` | `referenceNumber`, `phone` | Redacted dossier + quote DTO | Generic anti-enumeration error |
| `respondToApplicationQuoteAction` | Server Action | Public capability match (`ref` + E.164 phone) | `quoteResponseSchema` | `referenceNumber`, `phone`, `decision`, `revisionNotes` | `{ success, status }` | `403` / `422` |
| `submitPublicContactInquiryAction` | Server Action | Public + Honeypot + Rate Limit | `contactMessageSchema` | `name`, `phone`, `email`, `subject`, `message`, UTM | `{ success }` | `422` validation |

### Value Sourcing

| Action / Surface | Value Produced / Displayed | Authoritative Source |
| :--- | :--- | :--- |
| `HeroSlider` (`hero-slider.tsx`) | Primary `<h1>` (`HOME_HERO_PRIMARY_H1`), slide titles (`<h2>`), CTAs, images, and 4 concierge pillars (`LHE · KHI · ISB`, `<=24h SLA`, `0–50m Courtyard`, `Askari 10 HQ`) | `getPublicHeroSlides()` (`lib/seo/public-queries.ts`) + locked constants in `lib/constants/brand.ts` |
| `CustomJourneyBuilder` (`#journey-builder`) | All 5-pillar wizard steps, visa math, hotel/transport/ziyarat cards, `LiveSummaryCard` | `sanitizeHomePlannerCatalog()` in `app/(public)/page.tsx` (**untouched**) |
| `GroupPackagesSection` (`group-packages-section.tsx`) | Package title, slug link, tier, duration, Makkah/Madinah hotel names & `distanceMeters`, flight specs, `seatsRemaining`, 4-column PKR tiers (`Sharing`/`Quad`/`Triple`/`Double`), `infantPricePkr`, multi-hotel tier count badge | `getPublicGroupPackages()` filtered to open/filling_fast upcoming departures (`seatsRemaining > 0`) in `app/(public)/page.tsx` (`CONST-DOM-03`, `CONST-SEO-03`) |
| `HajjInquirySection` (`hajj-inquiry-section.tsx`) | 4 Maktab cards (`A+`, `A`, `B`, `C`), `indicativeQuadPkr`/`Triple`/`Double`, `HAJJ_2027_REGULATORY_DISCLAIMER`, optional Qurbani/Train add-on estimates, 6 readiness docs, 3-step pre-registration guide | `getPublicHajjPackages()` (`lib/seo/public-queries.ts`) + `HAJJ_2027_REGULATORY_DISCLAIMER` (`components/seo/guides-hajj-data.ts`, `CONST-DOM-09`) |
| `StatusTracker` (`status-tracker.tsx`) | Application status pipeline, redacted quote breakdown, voucher unlock state | `lookupApplicationStatus()` (`app/actions/applications.ts`, `CONST-DOM-08`, `CONST-SEC-08`) |
| `TrustHomeOverview` & `MarketingSections` | 9-vertical Haramain service matrix, 4 core booking rules, contextual hub/spoke `<Link>` directory (`>=3` inbound links per hub/spoke for `GB-06`), 4-step quoting timeline, Ziyarat preview cards (`<ArabicText>`), DB-verified testimonials, 1:1 `resolveHomeFaqs()` accordion | `getPublicZiyaratCatalog()`, `getPublicTestimonials()`, `getPublicFaqs()` (`lib/seo/public-queries.ts`) + `resolveHomeFaqs()` shared 1:1 with `buildFaqPageJsonLd()` (`CONST-SEO-04`) |
| `ContactSection` (`contact-section.tsx`) | Askari 10 Lahore Cantt address, `+92 327 4029701` / `+92 319 0462638`, `alramlahtravels@gmail.com`, working hours | `getCachedCompanyInfo()` (`lib/company-info.ts`, `CONST-OMNI-04`) |

### Security, AuthZ, Zod & SAR-Redaction Check
- **AuthN / AuthZ**: Public storefront read queries remain read-only; all 5 interactive mutations continue to enforce server-side Zod validation, honeypot checks, and PostgreSQL rate limits (`CONST-SEC-03`, `CONST-SEC-08`).
- **Input & XSS/SSRF Hygiene**: `JsonLd` blocks on `/` (`TravelAgency`, `WebSite`, `FAQPage`) continue to serialize exclusively via `serializeJsonLd()` (`CONST-SEO-04`). No new `dangerouslySetInnerHTML` or external script tags introduced.
- **Wholesale Cost & PII Redaction**: `getPublic*` DTOs and `sanitizeHomePlannerCatalog()` remain untouched in data shape, guaranteeing `0` `FORBIDDEN_WHOLESALE_SAR_KEYS` in RSC payloads (`CONST-SEO-03`, `GB-05`).

### UI & Design Direction
- **Surface Mode**: `Persuade` primary (`Read` on Service Matrix & FAQ; `Operate` on Status Tracker & Hajj Pre-Registration) locked to [`DESIGN.md`](../../../DESIGN.md) and [`PRODUCT.md`](../../../PRODUCT.md).
- **Theme & Token Discipline**:
  - Single locked light Haramain theme (`#FAF7F0` Warm Ivory canvas, `#FFFFFF` Alabaster cards, `#0A3622` Deep Haramain Emerald authority bands, `#E6DEC8` Sand Gold hairlines).
  - Decorative `#C5A059` (`--gold`) strictly on borders, icons, and dark `#0A3622` surfaces; all gold text on light backgrounds uses `#7A5C1E` (`--gold-text`, `>= 5.81:1` WCAG AA, `CONST-UI-02`).
  - `@base-ui/react` `render` prop composition everywhere (`0` Radix `asChild`, `CONST-UI-04`), `<ArabicText lang="ar" dir="rtl">` on every sacred Arabic string (`CONST-UI-03`), and `font-mono tabular-nums` on every PKR figure, meter distance, phone, batch code, and step number (`CONST-UI-05`).
- **Four-Library Motion Thesis & Anti-Slop Floor**:
  1. **Packages Installed (`web/package.json`)**: `lenis`, `gsap`, `@gsap/react`, `motion` (with `framer-motion` resolved at exact matching `14.14.0` version).
  2. **Focal Sequence (`HeroSlider`)**: Crisp `useGSAP` entrance (`opacity`/`y` subtle settle on text + gentle `1.04 -> 1.0` scale settle on active slide photo) with warm emerald-tinted editorial gradient (`from-[#072417]/82 via-[#0A3622]/48 to-transparent` instead of murky black-on-black) and interactive bottom slide index tabs.
  3. **Scroll-Linked Continuity (`MarketingSections` 4-Step Timeline & Ziyarat)**: One authored `ScrollTrigger` timeline drawing a metallic gold progress hairline across steps `01`–`04` as the pilgrim scrolls (`sloplint` `F8` single scroll-choreography budget honored), plus subtle GPU `transform` depth on Ziyarat imagery.
  4. **Tactile State Feedback (`Motion` / `Framer Motion`)**: Shared `layoutId` active pill indicators on Group Package tier filters, Hajj Readiness tabs, and Ziyarat city filters (`cubic-bezier(0.16, 1, 0.3, 1)`, zero bouncy overshoot per `sloplint` `12`), plus `AnimatePresence` height/opacity reveal on `StatusTracker`.
  5. **Strict `sloplint` Compliance**: Zero `transition-all` (`10a`), zero layout property animations (`width`/`height`/`top`/`left`), zero SSR `opacity: 0` hiding (`62`), zero `overflow-x: hidden` on `html`/`body` (`34` — uses `overflow-x: clip`), zero competing double uppercase eyebrows (`54`/`67`), and zero heavy `backdrop-blur-xl` dark-glass slop (`29`).

### Configuration Required
- `None` — no new environment variables or runtime secrets required (`https://mcp.motion.dev` is a public documentation MCP server requiring no API key).

---

## Build Plan

- [x] **Task 1 (Orchestrator — Package Dependencies)**: Install `lenis`, `gsap`, `@gsap/react`, `motion`, and `framer-motion` in `web/package.json` and verify clean React 19 peer resolution and `npm audit --omit=dev --audit-level=high` (`0` high/critical CVEs) — satisfies **AC-2**, **AC-10**
- [x] **Task 2 (Worker M1 — Motion/Lenis/GSAP Runtime & Public Layout)**: Build `web/components/motion/gsap-registry.ts` (idempotent client `gsap.registerPlugin(ScrollTrigger, useGSAP)`), `web/components/motion/public-motion-provider.tsx` (`<ReactLenis root options={{ autoRaf: false, anchors: { offset: -80 }, prevent }}>` synced to `gsap.ticker` + `<MotionConfig reducedMotion="user">` + reduced-motion media listener), and reusable SSR-safe `web/components/motion/haramain-reveal.tsx`; wire into `web/app/(public)/layout.tsx` and add minimal Lenis root CSS rules in `web/app/globals.css` — satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**
- [x] **Task 3 (Worker M2 — Luminous Hero Slider & Editorial Group Umrah Carousel)**: Redesign `web/components/public/hero-slider.tsx` (luminous emerald courtyard scrim, single non-competing badge + `<h1>`, interactive slide switcher tabs, `useGSAP` focal entrance with `prefers-reduced-motion: reduce` guard, refined 4-pillar trust strip) and `web/components/public/group-packages-section.tsx` (Embla horizontal carousel keeping all packages mounted in DOM, `Motion` `layoutId` tier pills, `#gp-gateway-filter`, clean flyer-safe card header that prevents white text colliding over poster graphics, multi-hotel tier count badge, uniform card height `~820 px` section footprint, intact `/Book Package Seats/i` modal flow) — satisfies **AC-4**, **AC-5**, **AC-6**, **AC-10**
- [x] **Task 4 (Worker M3 — Balanced 4-Column Hajj 2027 Showcase & Crisp Status Tracker)**: Redesign `web/components/public/hajj-inquiry-section.tsx` (`xl:grid-cols-4` Maktab row eliminating the `3+1` orphan card, clean Deep Haramain Emerald tonal surfaces without `backdrop-blur-2xl` slop, 2-column split with `Motion` `layoutId` Readiness Tabs on left and compact `#hajj-reservation-card` preserving all `#h-*`/`#opt-*` IDs and `OD-09e` disclaimer on right) and `web/components/public/status-tracker.tsx` (authoritative 2-column inline lookup bar with crisp Emerald CTA + `AnimatePresence` dossier expansion) — satisfies **AC-4**, **AC-7**, **AC-8**, **AC-10**
- [x] **Task 5 (Worker M4 — Consolidated Lower Storefront, GSAP Timeline, Tabbed Ziyarat, Editorial FAQ & Concierge Contact)**: Remove the duplicate Section `6B` rules table in `web/app/(public)/page.tsx` (keeping `#journey-builder` lines byte-identical!) and merge its spoke directory cleanly into `web/components/seo/trust-home-overview.tsx` (preserving `>= 3` contextual inbound links per hub/spoke for `GB-06`); upgrade `web/components/public/marketing-sections.tsx` + `faq-accordion-client.tsx` (asymmetric Why Choose Us bento, GSAP `ScrollTrigger` gold-line 4-Step Quoting Timeline, `Motion`-tabbed Makkah/Madinah Ziyarat 6-card showcase + `/ziyarat` link, 2-column `keepMounted` Editorial FAQ) and polish `web/components/public/contact-section.tsx` — satisfies **AC-1**, **AC-9**, **AC-10**
- [x] **Task 6 (Worker M5 & Orchestrator — Verification, `sloplint`, E2E & CDD Sync)**: Add `web/tests/unit/home-motion-and-proportion.test.ts` verifying SSR visibility, `0` planner diff, Lenis `prevent` portal isolation, and DOM/link contracts; run `npm run ui:lint`, `typecheck`, `lint`, `npm test` (`.env.audit`), `npm run build`, Playwright `j01-j05` + `j23` (verifying `>= 40%` height reduction from `25,930 px` and `0` Axe violations), and `/sync` + `npm run cdd:check` — satisfies **AC-1** through **AC-10**

---

## Verification & Traceability Matrix

| Criterion | Constitutional Rule | Automated Test / E2E Path (`covers: AC-N`) | Verification Gate |
| :--- | :--- | :--- | :--- |
| **AC-1** | `CONST-DOM-01..06`, `CONST-UI-04` | `web/tests/unit/home-motion-and-proportion.test.ts`, `web/tests/e2e/j01-j05-public-pilgrim.spec.ts` (`J1`, `J2`) | `git diff components/planner` empty + `npm test` + `test:e2e` |
| **AC-2**, **AC-3** | `CONST-UI-01`, `CONST-UI-04`, `CONST-UI-05` | `web/tests/unit/home-motion-and-proportion.test.ts`, `web/tests/e2e/j01-j05-public-pilgrim.spec.ts` | `npm test` + `test:e2e` |
| **AC-4**, **AC-5** | `CONST-UI-02`, `CONST-UI-03`, `CONST-UI-05`, `CONST-SEO-02` | `web/tests/w3/f-pub/a11y-arabic-and-motion.test.ts`, `web/tests/seo/gate-b-seo-invariants.test.ts` | `npm test` + `npm run ui:lint` |
| **AC-6** | `CONST-DOM-03`, `CONST-DOM-07`, `CONST-SEO-03` | `web/tests/e2e/j01-j05-public-pilgrim.spec.ts` (`J3`), `web/tests/w3/f-pub/group-booking-integrity.test.ts` | `npm test` + `test:e2e` |
| **AC-7**, **AC-8** | `CONST-DOM-08`, `CONST-DOM-09`, `CONST-SEC-08` | `web/tests/e2e/j01-j05-public-pilgrim.spec.ts` (`J4`, `J5`) | `npm test` + `test:e2e` |
| **AC-9**, **AC-10** | `CONST-SEO-01..05`, `CONST-OMNI-04`, `CONST-UI-01..05` | `web/tests/seo/gate-b-seo-invariants.test.ts` (`GB-01..06`), `web/tests/e2e/j23-seo-crawl-and-attribution.spec.ts` | `npm test` + `test:e2e` + `npm run cdd:check` |

**Critical Test Scenarios**:
- **Happy Path**: Pilgrim scrolls smoothly across `/` (`10,682 px` total height at `1920×1080`), configures a Visa-Only or Full Volatile journey inside the untouched `#journey-builder` (`J1`/`J2`), books an open batch from the horizontal Group Umrah carousel (`J3`), submits a Hajj 2027 pre-registration from the 2-column split (`J4`), and verifies a quoted `ART-...` dossier in `StatusTracker` (`J5`), covers **AC-1**, **AC-2**, **AC-6**, **AC-7**, **AC-8**, **AC-10**.
- **Failure / Portal Scroll & Reduced Motion**: Opening a Base UI calendar popover or `GroupBookingModal` scrolls inner lists natively via `prevent` without scrolling the background document; enabling `prefers-reduced-motion: reduce` disables Lenis inertia and GSAP spatial tweens while keeping every element visible and interactive, covers **AC-3**, **AC-4**.
- **SEO / SAR Redaction / A11y**: `renderToStaticMarkup(await HomePage())` renders single `<h1>`, `0` wholesale SAR keys, `1:1` `FAQPage` DOM parity, `>= 3` contextual inbound links per commercial hub/spoke (`GB-06`), `0` horizontal overflow at `320×640`, and `0` serious/critical Axe WCAG 2.2 AA violations, covers **AC-4**, **AC-5**, **AC-9**, **AC-10**.

**Release Gates Required**:
- `npx next typegen && npm run typecheck && npx tsc --noEmit -p tests/e2e/tsconfig.json`
- `npm run lint` (`0` errors)
- `npm run ui:lint` on modified public components (`0` `FAIL`)
- `npm test` (hermetic `.env.audit` on `127.0.0.1:54329`)
- `npm run build` + Playwright `j01-j05` & `j23` E2E + Axe WCAG 2.2 AA
- `npm run cdd:check` (`node scripts/verify-cdd.mjs`)
