# Scope: Al Ramlah Travels

A full stack Hajj and Umrah travel platform for Al Ramlah Travels that lets pilgrims configure custom journeys or book group packages online, and gives agency admins a live quoting CRM, dynamic inventory manager, and analytics portal.

**Build approach:** Tracer Bullet (vertical slices where each feature is built end to end through PostgreSQL, Drizzle ORM, Server Actions, and UI).
**Workflow:** Alpha (after develop, run check verify on the real running app). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

> [!IMPORTANT]
> **Production-Readiness Audit Ground-Truth Notice (Waves 0–2, Nov 2026):** Although Features `1`–`46` (Foundations & Slices `1`–`42`) were marked `done` during rapid vertical prototyping backed by mock-heavy unit tests (`0%` Server Action, API Route, real-migration, or browser E2E execution), an independent 28-report forensic audit (`docs/audit/00-ground-truth.md`, `01-feature-parity.md`, `w0-env-baseline.md`, and `findings/A00.md`–`A26.md`) proved that out of `126` claimed capabilities only `18` were `VERIFIED-WORKING`, while `31` were `IMPLEMENTED-UNVERIFIED`, `45` `PARTIAL`, `2` `STUB/FAKE`, `4` `MISSING`, and `26` `BROKEN` (`383` raw findings: `96 P0`, `179 P1`, `95 P2`, `13 P3` — including Critical `next@16.3.4` RCE CVEs, open public admin sign-up, `lookupApplicationStatus` empty-suffix bypass, unauthenticated `executeScheduledPostNowAction`, `42/43` migration drift, `2× db:seed` visa price corruption, zero `neon-http` transactions & group seat oversells, Gotenberg v8 `/screenshot` `404`s, `42.55 MB` quote HTML payloads, process-local Baileys split-brain, R2 `EROFS` fallbacks & public PII exposure, inverted `"STOP"` opt-outs, fake `"sent"`/`SHA-256` telemetry, and live-Neon-deleting tests). Historical checkmarks on Slices `1`–`42` are preserved as build history, while **Feature 47 (`Slice 43 · Spec 0024`)** tracks full end-to-end remediation to **Gate A (§9.4)**, strictly blocking **Feature 48 (`Slice 44 · Spec 0025 — SEO Readiness`)**.

## At a glance

| # | Feature | Phase | Status |
| --- | --------- | ------- | -------- |
| 1 | Stack & architecture | Foundation | done |
| 2 | Coding standards & tooling | Foundation | done |
| 3 | Data model | Foundation | done |
| 4 | Design system & UI foundation | Foundation | done |
| 5 | Core quote loop & admin sign in | Slice 1 | done |
| 6 | Custom journey builder modules | Slice 2 | done |
| 7 | Admin quoting worksheet & status tracker | Slice 3 | done |
| 8 | Dynamic inventory & catalog management | Slice 4 | done |
| 9 | Pre-built group packages & Hajj inquiries | Slice 5 | done |
| 10 | Public marketing sections, CMS & contact inbox | Slice 6 | done |
| 11 | Executive dashboard & smart insights | Slice 7 | done |
| 12 | Dynamic step by step journey wizard | Slice 8 | done |
| 13 | Real world rate matrices & dynamic catalog schema | Slice 9 | done |
| 14 | Dynamic custom journey builder & shadcn calendar segmentation | Slice 10 | done |
| 15 | Admin portal auth, dynamic catalog CRUD & staff management | Slice 11 | done |
| 16 | Admin quoting worksheet rate hints, seat accounting & voucher engine | Slice 12 | done |
| 17 | Conditional domain rules & cross module builder guards | Slice 13 | done |
| 18 | Frictionless custom journey builder UX & copy simplification | Slice 14 | done |
| 19 | Flights & Route step layout redesign & interactive cards | Slice 15 | done |
| 20 | Haramain Hotels step layout redesign & card hierarchy | Slice 16 | done |
| 21 | Ground Transport step layout redesign, fleet cards & mandatory itinerary legs | Slice 17 | done |
| 22 | Sacred Ziyarat step layout redesign, city grouping & scope state sync | Slice 18 | done |
| 23 | Review & Submit step layout redesign, itemized leg verification & formatted dates | Slice 19 | done |
| 24 | Deep removal of children count, full width pilgrims bar, bottom travel window & explicit airport route copy | Slice 20 | done |
| 25 | Makkah to Madinah to Jeddah route sequence | Slice 21 | done |
| 26 | Deep removal of dining & meal plans across database, backend, admin & public UI | Slice 22 | done |
| 27 | Restore children passenger count across database, domain, admin & public UI | Slice 23 | done |
| 28 | Production deployment readiness, security hardening & full stack bug fixes | Slice 24 | done |
| 29 | Official contact details, demo UI removal, database cleanup & Hajj 2027 package guide | Slice 25 | done |
| 30 | B2B supplier wrapping, 4K post studio, multi-channel distribution, 14-day outreach CRM & restored hotel meal plans | Slice 26 | done |
| 31 | Multimodal BYO-poster studio, presigned R2, sharp normalizer & Oracle Gotenberg | Slice 27 | done |
| 32 | Native wacrm WhatsApp Cloud API, encryption, HMAC webhooks, inbox & broadcasts | Slice 28 | done |
| 33 | Native Postiz Core 5 social providers & Trigger.dev Cloud durable workers | Slice 29 | done |
| 34 | 4-Hub Admin reorganization (/studio, /campaigns, /desk, /catalog) & Kanban desk | Slice 30 | done |
| 35 | Trigger.dev v4 hardening, queues, schedules & realtime React hooks | Slice 31 | done |
| 36 | WaCRM Phase 2: inbound media R2 pipeline, instant ART-... auto-responder bot, interactive messages & template sync | Slice 32 | done |
| 37 | Postiz Phase 2: multi-page OAuth selector, proactive token refresh, Reels/Stories upload, first-comment plug & analytics | Slice 33 | done |
| 38 | Durable AI quoting copilot & WhatsApp concierge agent | Slice 34 | done |
| 39 | Postiz Core 5 interactive platform post previewer & analytics dashboard | Slice 35 | done |
| 40 | WaCRM custom keyword auto-reply rules engine, greeting setup & quick-reply manager | Slice 36 | done |
| 41 | Trigger.dev v4 async webhook pipeline, realtime copilot telemetry, global idempotency & bridge cleanup | Slice 37 | done |
| 42 | WaCRM Phase 3: live realtime inbox, template builder, personalized broadcast wizard & guided intake flow | Slice 38 | done |
| 43 | Postiz Phase 3: visual calendar & time-slot queue, per-platform AI composer & provider hardening | Slice 39 | done |
| 44 | Native WhatsApp Linked-Device engine: QR/Pairing Code session, auto-sync real WhatsApp groups & chats, automated paced group/status posting & fake seed purge | Slice 40 | done |
| 45 | Multi-Number WhatsApp System: multi-session Linked Device switcher, per-number group/status & chat attribution, multi-line auto-posting & inbox line filter | Slice 41 | done |
| 46 | Production-Ready De-Clutter & Dynamic Data Overhaul: purge all demo seeds/presets, 100% dynamic WhatsApp phone linking, simplified Settings/Campaigns/Inbox UI & dynamic public/admin pages | Slice 42 | done |
| 47 | Spec 0024 — Production Readiness Audit & Hardening | Slice 43 | done |
| 48 | Spec 0025 — Public Site SEO, GEO & Attribution Readiness | Slice 44 | done |
| 49 | Unified CDD, Design System (`DESIGN.md` + `PRODUCT.md`) & Spec-Driven Engineering | Slice 45 | done |
| 50 | Spec 0026 — Home Page Editorial Redesign & Public Motion Architecture (`Lenis` + `GSAP` + `Motion`) | Slice 46 | done |
| 51 | Spec 0027 — Secondary public hubs, spokes & shell editorial alignment | Slice 47 | done |
| 52 | Spec 0028 · Admin 4 Hub Operate Surface and Shell Alignment | Slice 48 | done |
| 53 | Spec 0029 · Pilgrim Document Upload Portal and Staff Verification | Slice 49 | done |
| 54 | Spec 0030 · Hybrid Hero Video and Admin Media Uploader | Slice 50 | done |
| 55 | Spec 0031 · End-to-End Umrah Package Lifecycle & Storefront Redesign | Slice 51 | done |

## Foundations

### 1. Stack & architecture · done · Beta

Lock in the Next.js 16, Neon PostgreSQL, Drizzle ORM, Better Auth, Zod, and shadcn stack and verify the project boots and connects cleanly.
**Done when:** the stack decision is recorded in a spec, Drizzle and Better Auth are wired to Neon PostgreSQL, and the app builds cleanly.
spec [0001](docs/specs/0001-stack-and-architecture.md) · code in `lib/`, `db/`, `proxy.ts`

- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Build it: `/develop stack & architecture`
  - [x] Milestone 1: Dependencies and validated environment configuration (`package.json`, `lib/env.ts`)
  - [x] Milestone 2: Neon PostgreSQL connection and Drizzle ORM client wiring (`db/index.ts`, `drizzle.config.ts`, `db/schema/`)
  - [x] Milestone 3: Better Auth integration, route handlers, and proxy guard (`lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`, `proxy.ts`)
  - [x] Milestone 4: Route scaffolding, smoke verification, and production build check
- [x] Verify it: `/check verify stack & architecture` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))
- [x] Test it: `/test stack & architecture` ([domain-and-validation.test.ts](tests/domain-and-validation.test.ts))

### 2. Coding standards & tooling · done

Capture project conventions, reference repositories in `services/`, and installed agent skills into root `AGENTS.md` and `CLAUDE.md`.
**Done when:** root `AGENTS.md` reflects the real stack, commands, and skills, and typecheck and lint run clean.
code in `AGENTS.md`, `CLAUDE.md`, `eslint.config.mjs`

- [x] Capture conventions + tooling choices: `/audit`
- [x] Install the tooling: `/develop tooling`
- [x] Check it runs clean: `/check verify tooling` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))

### 3. Data model · done · Beta

Define the complete Drizzle PostgreSQL schema, relations, Zod schemas, and seed data for auth, settings, visas, hotels, vehicles, sectors, ziyarat places, airlines, departure cities, group packages, applications, quotes, CMS content, and messages.
**Done when:** all Drizzle tables and relations are pushed to Neon PostgreSQL and seeded with realistic Al Ramlah Travels data.
spec [0002](docs/specs/0002-data-model.md) · code in `db/schema/`, `db/seed.ts`, `lib/domain/`, `lib/validations/`

- [x] Design it (spec): `/architect data model`
- [x] Build it: `/develop data model`
  - [x] Core auth, settings, and reference catalog tables (visas, airlines, departure cities, hotels, vehicles, sectors, ziyarat)
  - [x] Commercial package, application lead, stay, segment, and quote worksheet tables
  - [x] CMS content and contact inbox tables with full Drizzle relations
  - [x] Pure domain calculation helpers for visas, room splits, date chaining, and vehicle capacity
  - [x] Comprehensive Zod validation schemas for public submissions and admin workflows
  - [x] Realistic Al Ramlah Travels seed script for all catalog, inventory, and CMS tables
- [x] Verify it: `/check verify data model` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))
- [x] Test it: `/test data model` ([domain-and-validation.test.ts](tests/domain-and-validation.test.ts))

### 4. Design system & UI foundation · done

Define the single luxury Haramain Emerald, Warm Ivory, and Metallic Gold theme matched to `public/logo.jpg` in `design.md` and `app/globals.css`, plus shared public and admin shell layouts.
**Done when:** `design.md` and `app/globals.css` define all brand tokens with accessible contrast, dark mode switching is removed, and the public header/footer and admin sidebar shells render cleanly.
spec [0003](docs/specs/0003-design-system-and-ui-foundation.md) · code in `app/globals.css`, `app/layout.tsx`, `components/layout/`

- [x] Design it (spec): `/architect design system & UI foundation`
- [x] Build it: `/develop design system & UI foundation`
  - [x] Tokens & single luxury theme in globals.css (no dark mode)
  - [x] Google Fonts typography hierarchy (Sans, Display, Mono, Arabic)
  - [x] Public shell layout (Utility strip, sticky header, footer, WhatsApp FAB)
  - [x] Admin portal shell layout (Deep emerald collapsible sidebar, topbar, status pills)
  - [x] Base UI render-prop primitives audit and foundational components
- [x] Verify it: `/check verify design system & UI foundation` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))

## Slice 1: Core quote loop & admin sign in

### 5. Core quote loop & admin sign in · done

Stand up the end to end walking skeleton: a pilgrim submits a journey request on the home page, it persists in Neon PostgreSQL with a generated reference code, and an admin signs in via Better Auth at `/admin/login` to view the request in `/admin/applications`.
**Done when:** a visitor can submit a real request and get a reference number, and an authenticated admin (`super_admin` or `staff`) can sign in and see that request in the admin list.
spec [0004](docs/specs/0004-core-quote-loop-and-admin-sign-in.md) · code in `app/admin/(auth)/login/`, `app/actions/applications.ts`, `app/admin/(dashboard)/applications/`

- [x] Design it (spec): `/architect core quote loop & admin sign in`
- [x] Build it: `/develop core quote loop & admin sign in`
  - [x] Milestone 1: Better Auth Admin Sign-In page, session handling, and demo credential helper (`app/admin/(auth)/login/page.tsx`, `lib/auth-client.ts`, `proxy.ts`)
  - [x] Milestone 2: Core public application submission Server Action, reference code generator, and transaction persistence (`app/actions/applications.ts`, `lib/validations/application.ts`, `lib/domain/visa-calc.ts`)
  - [x] Milestone 3: Admin applications list view with search, status filters, source filters, and 24h SLA overdue badge (`app/admin/(dashboard)/applications/page.tsx`)
  - [x] Milestone 4: End-to-end walking skeleton integration and smoke verification
- [x] Verify it: `/check verify core quote loop & admin sign in` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))

## Slice 2: Custom journey builder modules

### 6. Custom journey builder modules · done

Thicken the public Custom Journey Builder with all 5 toggleable service pillars (Visa, Flights, Hotels, Transport, Ziyarat), mode presets, arrival/departure date calculation for short and long term visas, city sequences with Jeddah/Madinah airport rules, shared vs private hotel room auto allocation with per hotel meal plans, segment by segment vehicle and pickup time selection, and Ziyarat vehicle inheritance.
**Done when:** a pilgrim can configure any combination of services (Complete Journey, Visa Only, Hotels Only, Transport Only, or Custom Mix), see exact Visa pricing in Visa Only mode or a live rate summary card when volatile services are included, and submit or send to WhatsApp.
spec [0005](docs/specs/0005-custom-journey-builder-modules.md) · code in `components/planner/`

- [x] Design it (spec): `/architect custom journey builder modules`
- [x] Build it: `/develop custom journey builder modules`
  - [x] Milestone 1: Planner state store, mode preset pills, 5 toggleable service pillars, always-on travel dates, and traveller counter with bed/seat vs passport badge
  - [x] Milestone 2: City sequence selector, Jeddah/Madinah airport enforcement, and automatic stay date-chaining engine
  - [x] Milestone 3: Flight route preferences module and Named Hotels catalog with star filters, private room auto-split allocator, and conditional per-hotel dining selectors
  - [x] Milestone 4: Segment-by-segment transport configuration, vehicle fleet capacity sizing, pickup time control, and Ziyarat site cards with vehicle inheritance
  - [x] Milestone 5: Sticky Live Itinerary Summary Card with dynamic live rate vs fixed visa price mode, lead capture modal, WhatsApp dispatch, and confirmation screen
- [x] Verify it: `/check verify custom journey builder modules` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))

## Slice 3: Admin quoting worksheet & status tracker

### 7. Admin quoting worksheet & status tracker · done

Build the single application detail and live quoting worksheet in `/admin/applications/[id]` where admins enter live flight, hotel, transport, and ziyarat rates alongside the pre filled visa cost, dispatch quotes via WhatsApp, email, or print voucher, update the 5 stage status (`Pending Quote`, `Quoted`, `Approved`, `Rejected`, `Cancelled`), and let pilgrims view their live status and itemized quote on the public Request Tracker.
**Done when:** an admin can price a pending request, mark it `Quoted` or `Approved` with payment status and internal notes, and the pilgrim can look up their reference number and phone on the home page to see their live status and itemized quote.
spec [0006](docs/specs/0006-admin-quoting-worksheet-and-status-tracker.md) · code in `app/admin/(dashboard)/applications/[id]/`, `app/actions/quotes.ts`, `components/public/status-tracker.tsx`

- [x] Design it (spec): `/architect admin quoting worksheet & status tracker`
- [x] Build it: `/develop admin quoting worksheet & status tracker`
  - [x] Milestone 1: Admin application detail view and Next.js 16 async params resolution (`app/admin/(dashboard)/applications/[id]/page.tsx`, `components/admin/applications/`)
  - [x] Milestone 2: Interactive Live Quoting Worksheet form and real-time grand total arithmetic (`components/admin/applications/quote-worksheet-form.tsx`, `lib/validations/quote.ts`, `app/actions/quotes.ts`)
  - [x] Milestone 3: 5-stage status pipeline controller, transition guards, and group departure seat sync (`app/actions/quotes.ts`)
  - [x] Milestone 4: Multi-channel quote dispatch (WhatsApp, Email, Printable Voucher) and Public Status Tracker (`components/admin/applications/quote-dispatch-bar.tsx`, `app/admin/(dashboard)/applications/[id]/voucher/page.tsx`, `components/public/status-tracker.tsx`)
- [x] Verify it: `/check verify admin quoting worksheet & status tracker` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))

## Slice 4: Dynamic inventory & catalog management

### 8. Dynamic inventory & catalog management · done

Build the Admin Portal CRUD modules for managing Named Hotels (Makkah and Madinah, stars, distance, room types, meal plans), Vehicles & Transport Sectors (private vs shared, passenger capacities), Ziyarat Places (Makkah and Madinah sites), Airlines & Departure Cities, Visa Pricing (short term and long term rates), Agency Settings, and Admin Users.
**Done when:** admins can create, edit, toggle visibility, and delete hotels, vehicles, sectors, ziyarat sites, airlines, departure cities, visa rates, settings, and admin staff accounts, and changes immediately reflect in the public Custom Journey Builder.
code in `app/admin/(dashboard)/hotels/`, `transport/`, `ziyarat/`, `flights/`, `visa/`, `users/`, `settings/`, `app/actions/catalog.ts`

- [x] Build it: `/develop dynamic inventory & catalog management`
- [x] Verify it: `/check verify dynamic inventory & catalog management` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))

## Slice 5: Pre-built group packages & Hajj inquiries

### 9. Pre-built group packages & Hajj inquiries · done

Build the Admin CRUD for Pre-Built Group Packages and Departure Batches (fixed dates, seat capacity, Quad/Triple/Double prices) and wire the public Pre-Built Group Packages showcase, Group Booking modal (auto incrementing seats on approval), and the dedicated Hajj Consultation Inquiry form.
**Done when:** admins can manage group packages and departure batches, and pilgrims can book seats in a pre-built group package or submit a Hajj consultation callback request.
spec [0007](docs/specs/0007-group-packages-and-hajj-inquiries.md) · code in `app/admin/(dashboard)/groups/`, `components/public/group-packages-section.tsx`, `components/public/hajj-inquiry-section.tsx`, `app/actions/groups.ts`

- [x] Design it (spec): `/architect pre-built group packages & Hajj inquiries`
- [x] Build it: `/develop pre-built group packages & Hajj inquiries`
  - [x] Milestone 1: Admin Pre-Built Group Packages CRUD and inventory management (`app/admin/(dashboard)/groups/page.tsx`, `components/admin/catalog/groups-client.tsx`, `app/actions/groups.ts`)
  - [x] Milestone 2: Admin Departure Batches scheduler and real-time occupancy monitor (`components/admin/catalog/departure-batch-dialog.tsx`)
  - [x] Milestone 3: Public Pre-Built Group Packages showcase, batch filters, and seat-validated booking modal (`components/public/group-packages-section.tsx`, `components/public/group-booking-modal.tsx`, `app/actions/groups.ts`)
  - [x] Milestone 4: Public VIP Hajj Consultation inquiry section and multi-channel intake integration (`components/public/hajj-inquiry-section.tsx`)
- [x] Verify it: `/check verify pre-built group packages & Hajj inquiries` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))

## Slice 6: Public marketing sections, CMS & contact inbox

### 10. Public marketing sections, CMS & contact inbox · done

Complete the public landing page sections (Hero Slider, Why Pilgrims Choose Us bento grid, How It Works timeline, Trust Stats, Testimonials carousel, FAQ accordion, Consultant Contact Form) backed by the Admin Website Content CMS (`/admin/content`) and Contact Messages Inbox (`/admin/messages`).
**Done when:** hero slides, testimonials, and FAQs on the public site are driven by `/admin/content`, and contact form submissions appear in `/admin/messages`.
code in `app/admin/(dashboard)/content/`, `app/admin/(dashboard)/messages/`, `components/public/`, `app/actions/cms.ts`

- [x] Build it: `/develop public marketing sections, CMS & contact inbox`
- [x] Verify it: `/check verify public marketing sections, CMS & contact inbox` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))

## Slice 7: Executive dashboard & smart insights

### 11. Executive dashboard & smart insights · done

Build the `/admin` Executive Dashboard with time range filtering (`Last 7 days`, `Last 30 days`, `Last 90 days`, `Last 12 months`, `All time`), KPI cards (Approved Revenue, Quoted Pipeline, Applications, Awaiting Action with 24h SLA overdue warning, Approval Rate, Pilgrims Approved), live Smart Insights, Recharts visualizations, Recent Applications, Upcoming Groups occupancy, and CSV export.
**Done when:** `/admin` renders live database metrics, charts, smart insights, and CSV export filtered by the selected time window.
code in `app/admin/(dashboard)/page.tsx`, `components/admin/dashboard/`

- [x] Build it: `/develop executive dashboard & smart insights`
- [x] Verify it: `/check verify executive dashboard & smart insights` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))

## Slice 8: Dynamic step by step journey wizard

### 12. Dynamic step by step journey wizard · done

Restructure the Custom Journey Builder into an in-place dynamic step by step wizard alongside the sticky Live Itinerary Summary Card so only one active step renders at a time, dynamically adapting steps to the active preset mode and toggled service pillars while preserving all rich hotel, transport, and ziyarat cards untouched.
**Done when:** the left column of the Custom Journey Builder renders a clickable dynamic stepper bar, displays only the current active step (ranging from 2 steps in Visa Only mode to 6 steps in Complete Umrah mode), supports Previous and Next step navigation with smooth scroll to top, and integrates seamlessly with the sticky Live Itinerary Summary Card and final quote submission step.
spec [0005](docs/specs/0005-custom-journey-builder-modules.md) · code in `components/planner/`

- [x] Build it: `/develop dynamic step by step journey wizard`
  - [x] Milestone 1: Wizard step state, dynamic step array derivation by active pillars/mode, and clickable top stepper progress bar (`components/planner/planner-context.tsx`, `components/planner/wizard-stepper.tsx`)
  - [x] Milestone 2: Step-isolated rendering in `CustomJourneyBuilder` (keeping Hotel, Transport, and Ziyarat cards untouched), Final Review & Lead Capture step view, and Previous/Next navigation footer (`components/planner/custom-journey-builder.tsx`, `components/planner/review-and-submit-step.tsx`, `components/planner/live-summary-card.tsx`)
  - [x] Milestone 3: Two-way chained Makkah & Madinah Check-In / Check-Out actual date pickers + nights counters in Step 1 (`CitySequenceModule`) and Hotels Step (`HotelSelectionModule`) synced with KSA Arrival & Departure dates (`components/planner/planner-context.tsx`, `components/planner/city-sequence-module.tsx`, `components/planner/hotel-selection-module.tsx`)
- [x] Verify it: `/check verify dynamic step by step journey wizard` ([verify-full-platform.md](docs/reviews/verify-full-platform.md))

## Slice 9: Real world rate matrices & dynamic catalog schema

### 13. Real world rate matrices & dynamic catalog schema · done · Beta

Expand the PostgreSQL schema, domain calculation engine, Zod validators, and seed data for transport route by vehicle rate matrices, 3 sector shared bus pricing, missing sectors (`MED_JED`, Badr, Taif, Haramain station transfers), accurate vehicle capacities, hotel sharing and room rates with seasonal validity dates and location notes, visa rates with and without Masar duration brackets plus SAR to PKR exchange rate conversion, and 4 column group packages (`Sharing`, `Quad`, `Triple`, `Double`) with airline flight seat block details, multi hotel tier options, gifted inclusions, and infant pricing.
**Done when:** all new rate tables and columns are pushed to Neon PostgreSQL, seeded from the real rate sheets, validated by 2 to 3 character IATA rules, and covered by unit tests.
code in `db/schema/`, `db/seed.ts`, `lib/domain/quote-hints.ts`, `lib/validations/catalog.ts`

- [x] Build it: `/develop real world rate matrices & dynamic catalog schema`
- [x] Verify it: `/check verify real world rate matrices & dynamic catalog schema`
- [x] Test it: `/test real world rate matrices & dynamic catalog schema` ([domain-and-validation.test.ts](tests/domain-and-validation.test.ts))

## Slice 10: Dynamic custom journey builder & shadcn calendar segmentation

### 14. Dynamic custom journey builder & shadcn calendar segmentation · done

Overhaul the Custom Journey Builder and Public Status Tracker so every value is 100% database driven with zero hardcoded fallbacks, KSA arrival and departure dates are derived automatically from the Makkah and Madinah leg dates selected with the shadcn Calendar popover component, Sacred City Sequence and entry or exit airport messages adapt accurately to active pillars and both `JED` and `MED` inbound and outbound options, transport segments generate and toggle cleanly per leg with scheduled dates, and all builder and status tracker bugs are resolved.
**Done when:** pilgrims pick their stay dates with the shadcn Calendar component without redundant KSA arrival or departure inputs, all sequence messages and airport options (`JED` and `MED` on both entry and exit) are accurate across every preset mode, transport segments can be toggled individually with valid sector codes, and group bookings and 5 stage statuses render completely in the Status Tracker.
code in `components/planner/`, `components/public/`, `app/actions/applications.ts`

- [x] Build it: `/develop dynamic custom journey builder & shadcn calendar segmentation`
- [x] Verify it: `/check verify dynamic custom journey builder & shadcn calendar segmentation`

## Slice 11: Admin portal auth, dynamic catalog CRUD & staff management

### 15. Admin portal auth, dynamic catalog CRUD & staff management · done

Fix admin authentication and role guards (`signOut`, `requireAdmin`, `requireSuperAdmin`), wire `AdminTopbar` to live session identity and live SLA overdue counts with zero static text, create staff accounts with Better Auth password credentials, add foreign key delete protection, and expose full Admin CRUD for hotel rates, transport route matrices, visa Masar brackets, and 4 column group packages.
**Done when:** admins can sign out cleanly, staff accounts created in `/admin/users` can sign in with their password, every admin route enforces server side role guards, `AdminTopbar` displays real user and SLA data, deleting referenced catalog items never crashes, and all new rate fields are editable in the Admin Portal.
code in `components/layout/`, `components/admin/catalog/`, `app/admin/(dashboard)/`, `app/actions/catalog.ts`, `app/actions/groups.ts`

- [x] Build it: `/develop admin portal auth, dynamic catalog CRUD & staff management`
- [x] Verify it: `/check verify admin portal auth, dynamic catalog CRUD & staff management`

## Slice 12: Admin quoting worksheet rate hints, seat accounting & voucher engine

### 16. Admin quoting worksheet rate hints, seat accounting & voucher engine · done

Upgrade the Admin Quoting Worksheet to calculate and display live reference rate hints from the hotel, transport, and visa rate tables, fix group departure seat double counting and release seats on cancellation or rejection, sync WhatsApp and email quote dispatch with live worksheet inputs, fix the overdue filter tab deadlock, and render complete printable vouchers for both custom journeys and group bookings.
**Done when:** the quoting worksheet shows auto calculated catalog rate hints per service pillar, group seats increment once and release on cancellation, quote dispatch uses live values, and `/admin/applications/[id]/voucher` renders cleanly with no client directive errors.
code in `app/admin/(dashboard)/applications/`, `components/admin/applications/`, `app/actions/quotes.ts`

- [x] Build it: `/develop admin quoting worksheet rate hints, seat accounting & voucher engine`
- [x] Verify it: `/check verify admin quoting worksheet rate hints, seat accounting & voucher engine`

## Slice 13: Conditional domain rules & cross module builder guards

### 17. Conditional domain rules & cross module builder guards · done
Enforce all 13 conditional domain rules across the Custom Journey Builder: show single city sequences (`Makkah Only`, `Madinah Only`) only when Visa is off (`Hotels Only` mode), make hotel `Shared Bed Category` a single per bed sharing selection while keeping `Double`, `Triple`, and `Quad` strictly for Private Rooms filtered by hotel availability, filter airlines by direct or connecting route support, restrict `Shared Transport` to eligible airport and intercity sectors with immediate vehicle state synchronization, exclude Haramain Train from the global road vehicle selector while offering a one click `Hotel <-> Train Station` transfer toggle on rail segments, group `Transport Only` sectors with minimum leg and Ziyarat site guards, and make all top bar badges and airport labels adapt to active service pillars.
**Done when:** every option, badge, vehicle, airline, room category, and sequence in the Custom Journey Builder adapts strictly to the user's active pillars and previous selections with zero invalid combinations possible.
code in `components/planner/`, `lib/domain/room-splitter.ts`, `tests/domain-and-validation.test.ts`
- [x] Build it: `/develop conditional domain rules & cross module builder guards`
- [x] Verify it: `/check verify conditional domain rules & cross module builder guards`

## Slice 14: Frictionless custom journey builder UX & copy simplification

### 18. Frictionless custom journey builder UX & copy simplification · done

Redesign the Custom Journey Builder layout and copy so any pilgrim understands the interface in a single glance: add a `Flights Only` preset, fix truncated text in `Active Service Pillars` using a spacious vertical card layout, split `Travel Window` and `Pilgrims & Room Capacity` into separate cards while removing the Masar SAR badge and `Domain Rule` footnote, update the three route descriptions (`Land in Jeddah, Umrah in Makkah, then travel to Madinah`, etc.), place a read only `Entry Airport` and `Exit Airport` summary bar above `City Stay Dates & Duration Schedule` (derived automatically from the selected route), remove repetitive `KSA Arrival`, `Chained`, and `KSA Departure` badges, and eliminate parenthetical `word (word)` labels and developer jargon across all steps.
**Done when:** `Flights Only` is available in `Journey Mode Presets`, zero text is truncated in `Active Service Pillars`, `Travel Window` and `Pilgrims & Room Capacity` render as clean separate cards without developer footnotes or Masar SAR badges, `Entry Airport` and `Exit Airport` are read only and positioned above `City Stay Dates & Duration Schedule`, and all parenthetical labels and repetitive chaining badges are removed.
code in `components/planner/`, `db/schema/applications.ts`, `lib/validations/application.ts`, `tests/domain-and-validation.test.ts`
- [x] Build it: `/develop frictionless custom journey builder UX & copy simplification`
- [x] Verify it: `/check verify frictionless custom journey builder UX & copy simplification`

## Slice 15: Flights & Route step layout redesign & interactive cards

### 19. Flights & Route step layout redesign & interactive cards · done

Restructure the `Flights & Route` step (`components/planner/flight-preferences-module.tsx`) and top stepper pills (`components/planner/wizard-stepper.tsx`) to eliminate the cramped 4 column row where dropdowns truncate (`Islamabad / Raw`, `Any Airline / Bes`) and toggle buttons overflow (`1-Stop Connecti`): add a live Outbound and Return Flight route summary bar at the top, replace cramped dropdowns and buttons with a clean 2 column layout for `Flight Type` (`Direct Flight` vs `1-Stop Flight`) and `Cabin Class` (`Economy` vs `Business`) with uniform single line button heights, provide spacious interactive `Departure City` and `Preferred Airline` selection cards so zero text is ever cut off, and make top stepper pills wrap cleanly without clipping `5 Ziyarat` or `6 Review`.
**Done when:** the `Flights & Route` step displays a live Outbound and Return flight summary bar, `Flight Type` and `Cabin Class` render in a spacious 2 column grid with single line buttons of equal height, `Departure City` and `Preferred Airline` are selectable via clean cards or full width controls with zero text truncation, and all 6 wizard step pills are visible without horizontal clipping.
code in `components/planner/flight-preferences-module.tsx`, `components/planner/wizard-stepper.tsx`, `components/planner/planner-context.tsx`
- [x] Build it: `/develop flights & route step layout redesign & interactive cards`
- [x] Verify it: `/check verify flights & route step layout redesign & interactive cards`

## Slice 16: Haramain Hotels step layout redesign & card hierarchy

### 20. Haramain Hotels step layout redesign & card hierarchy · done

Restructure the `Haramain Hotels` step (`components/planner/hotel-selection-module.tsx`, `components/planner/hotel-card.tsx`, `components/planner/room-allocator.tsx`, `components/planner/meal-plan-selector.tsx`) into a clean stacked card hierarchy: remove the redundant `Configuring Stay X: Check-In Date / Check-Out Date / Nights` date picker bar (since stay dates and nights are already configured in Step 1), promote `Room Type` and `Dining & Meal Plan` from the bottom of the page into a prominent configuration card right below the Stay Selector tabs (with zero truncated descriptions), and redesign `HotelCard` from a cramped horizontal layout into a spacious vertical card so badges, star ratings, distances, and selection buttons never overlap or clip.
**Done when:** the redundant date and nights bar is removed from the Hotels step, `Room Type` and `Dining & Meal Plan` appear near the top right below the Stay Selector tabs with full non-truncated descriptions, and `HotelCard` renders in a clean vertical layout with zero overlapping badges or clipped text.
code in `components/planner/hotel-selection-module.tsx`, `components/planner/hotel-card.tsx`, `components/planner/room-allocator.tsx`, `components/planner/meal-plan-selector.tsx`
- [x] Build it: `/develop haramain hotels step layout redesign & card hierarchy`
- [x] Verify it: `/check verify haramain hotels step layout redesign & card hierarchy`

## Slice 17: Ground Transport step layout redesign, fleet cards & mandatory itinerary legs

### 21. Ground Transport step layout redesign, fleet cards & mandatory itinerary legs · done

Restructure the `Ground Transport` step (`components/planner/transport-selection-module.tsx`, `components/planner/segment-card.tsx`, `components/planner/vehicle-capacity-pill.tsx`, `components/planner/planner-context.tsx`, `components/planner/wizard-stepper.tsx`) into a clean multi card hierarchy: remove the ability to uncheck or exclude individual route legs in itinerary mode so all required journey transfers stay active, replace the truncated vehicle dropdown with interactive Vehicle Fleet Cards showing seats, luggage capacity, and group fit at a glance, replace redundant per leg date pickers in itinerary mode with read only scheduled date badges derived from Step 1, and organize each transfer leg card into a spacious layout with zero text truncation or squished columns.
**Done when:** transfer legs cannot be unchecked or excluded in itinerary mode, pilgrims can pick their vehicle from interactive fleet cards without truncated dropdown text, redundant per leg date pickers are replaced by read only scheduled dates in itinerary mode, and all transfer leg controls and stepper labels render without clipping.
code in `components/planner/transport-selection-module.tsx`, `components/planner/segment-card.tsx`, `components/planner/vehicle-capacity-pill.tsx`, `components/planner/planner-context.tsx`, `components/planner/wizard-stepper.tsx`
- [x] Build it: `/develop ground transport step layout redesign, fleet cards & mandatory itinerary legs`
- [x] Verify it: `/check verify ground transport step layout redesign, fleet cards & mandatory itinerary legs`

## Slice 18: Sacred Ziyarat step layout redesign, city grouping & scope state sync

### 22. Sacred Ziyarat step layout redesign, city grouping & scope state sync · done

Restructure the `Sacred Ziyarat` step (`components/planner/ziyarat-selection-module.tsx`, `components/planner/planner-context.tsx`, `components/planner/live-summary-card.tsx`) into a clean multi card hierarchy: synchronize `selectedPlaceIds` whenever `ziyaratScope` changes so switching to `Makkah Only` or `Madinah Only` never leaves hidden out of scope sites counted in the summary card, replace tiny scope pills with 3 clear interactive scope selection cards (`Makkah & Madinah`, `Makkah Only`, `Madinah Only`), separate Makkah and Madinah sacred sites into dedicated city cards with per city `Select All` actions, and switch from a cramped 3 column grid with truncated descriptions to a spacious 2 column grid with full historical descriptions.
**Done when:** switching `ziyaratScope` automatically synchronizes `selectedPlaceIds` to match the active cities, Makkah and Madinah sacred sites render in separate grouped city cards with a spacious 2 column layout and zero truncated descriptions, and the Live Summary Card reflects the exact active site count.
code in `components/planner/ziyarat-selection-module.tsx`, `components/planner/planner-context.tsx`, `components/planner/live-summary-card.tsx`
- [x] Build it: `/develop sacred ziyarat step layout redesign, city grouping & scope state sync`
- [x] Verify it: `/check verify sacred ziyarat step layout redesign, city grouping & scope state sync`

## Slice 19: Review & Submit step layout redesign, itemized leg verification & formatted dates

### 23. Review & Submit step layout redesign, itemized leg verification & formatted dates · done

Restructure the `Review & Submit` step (`components/planner/review-and-submit-step.tsx`, `components/planner/live-summary-card.tsx`, `components/planner/lead-capture-dialog.tsx`) into a clean multi card hierarchy: replace raw ISO date strings (`2026-10-19`) and raw enum codes (`BOTH`, `MAKKAH_ONLY`, `private • room_only`) with human readable formatted dates (`19 Oct 2026`), room allocation labels, and meal plan titles, display the actual enabled Ground Transport legs (with vehicle, service mode, and pickup time) and selected Ziyarat landmarks per city, include `citySequence`, `entryAirport`, and `exitAirport` in the submission payload whenever `hasCityLegs` is true, and align the Lead Pilgrim Contact Form with the selected departure city.
**Done when:** all dates, room splits, meal plans, transport legs, and ziyarat scopes on the Review & Submit step render in clean human readable format with zero raw ISO dates or enum strings, enabled transport legs and ziyarat counts match the active configuration, and the submission payload includes all active route fields.
code in `components/planner/review-and-submit-step.tsx`, `components/planner/live-summary-card.tsx`, `components/planner/lead-capture-dialog.tsx`
- [x] Build it: `/develop review & submit step layout redesign, itemized leg verification & formatted dates`
- [x] Verify it: `/check verify review & submit step layout redesign, itemized leg verification & formatted dates`

## Slice 20: Deep removal of children count, full width pilgrims bar, bottom travel window & explicit airport route copy

### 24. Deep removal of children count, full width pilgrims bar, bottom travel window & explicit airport route copy · done

Rename `Custom Mix` to `Custom Package` in `Journey Mode Presets` and `Return Flights` to `Flights` in `Active Service Pillars`, remove `Children` (`childrenCount`) deeply from the PostgreSQL schema, domain models, Zod validators, Server Actions, seed script, admin portal, and public UI so only `Adults` and `Infants` exist, make `Pilgrims & Room Capacity` a full width 2 column card (`Adults` and `Infants`), move the derived `Travel Window` summary bar beneath `City Stay Dates & Duration Schedule` inside `Sacred City Sequence & Stay Schedule`, and update the route descriptions to explicitly state both the arrival airport and return flight airport to Pakistan.
**Done when:** `childrenCount` is removed from the database schema, Neon database, validators, actions, and all UI components, `Custom Package` and `Flights` labels are updated, `Pilgrims & Room Capacity` renders full width with `Adults` and `Infants`, `Travel Window` renders beneath `City Stay Dates & Duration Schedule` when city stays are active, and all route descriptions explicitly state the entry airport and return airport to Pakistan.
code in `db/schema/applications.ts`, `db/seed.ts`, `lib/validations/application.ts`, `app/actions/`, `components/planner/`, `components/public/`, `app/admin/`
- [x] Build it: `/develop deep removal of children count, full width pilgrims bar, bottom travel window & explicit airport route copy`
- [x] Verify it: `/check verify deep removal of children count, full width pilgrims bar, bottom travel window & explicit airport route copy`

## Slice 21: Makkah to Madinah to Jeddah route sequence

### 25. Makkah to Madinah to Jeddah route sequence · done

Add the `makkah_madinah_jeddah` (`Makkah → Madinah → Jeddah`) route sequence end to end across the PostgreSQL `city_sequence` enum, `chainItineraryDates` domain helper, Zod validators, Server Actions, Planner Context, public builder (`lg:grid-cols-3` so the 4th route wraps onto the second row), Status Tracker, and Admin Dossier: pilgrims land at Jeddah Airport, stay in Makkah Hotel (Stay 1), travel to Madinah Hotel (Stay 2), and go directly from Madinah Hotel to Jeddah Airport (`MED_JED`) for their return flight to Pakistan without a second Makkah hotel stay.
**Done when:** `makkah_madinah_jeddah` is added to the PostgreSQL enum and pushed to Neon, `CitySequenceModule` renders all 4 Umrah routes in the 3 column grid (`lg:grid-cols-3`), selecting `Makkah → Madinah → Jeddah` sets Entry Airport to `Jeddah Airport`, Exit Airport to `Jeddah Airport`, creates 2 hotel stays (`Makkah` and `Madinah`), and generates the 3 transport legs (`JED_MAK`, `MAK_MED`, `MED_JED`).
code in `db/schema/`, `lib/domain/date-chaining.ts`, `lib/validations/application.ts`, `components/planner/`, `components/public/`, `components/admin/`
- [x] Build it: `/develop makkah to madinah to jeddah route sequence`
- [x] Verify it: `/check verify makkah to madinah to jeddah route sequence`

## Slice 22: Deep removal of dining & meal plans across database, backend, admin & public UI

### 26. Deep removal of dining & meal plans across database, backend, admin & public UI · done

Completely remove all hotel dining and meal plan features across the PostgreSQL database (`offersDining`, `availableMealPlans`, `mealPlanPriceSar` on `hotels`; `mealPlan` on `application_hotel_stays`; `mealPlanEnum`), seed script, domain rate hint calculator, Zod validators, Server Actions, Public Custom Journey Builder (removing `meal-plan-selector.tsx` and updating `hotel-selection-module.tsx`, `hotel-card.tsx`, `planner-context.tsx`, `live-summary-card.tsx`, `review-and-submit-step.tsx`), Public Status Tracker, and Admin Portal (`hotels-client.tsx`, `application-dossier.tsx`, `voucher/page.tsx`).
**Done when:** all dining and meal plan columns and enums are dropped from Neon PostgreSQL and removed from Drizzle schema, seed data, validators, rate hints, server actions, public components, admin portal, and tests, with zero references remaining.
code in `db/schema/`, `db/seed.ts`, `lib/domain/quote-hints.ts`, `lib/validations/`, `app/actions/`, `components/planner/`, `components/public/`, `components/admin/`, `app/admin/`
- [x] Build it: `/develop deep removal of dining & meal plans across database, backend, admin & public UI`
- [x] Verify it: `/check verify deep removal of dining & meal plans across database, backend, admin & public UI`

## Slice 23: Restore children passenger count across database, domain, admin & public UI

### 27. Restore children passenger count across database, domain, admin & public UI · done

Restore the `Children` (`children` / `childrenCount`, ages 2 to 11 years) passenger counter across the Neon PostgreSQL `applications` schema, seed data, domain helpers, Zod validation contracts, Server Actions, Public Custom Journey Builder (`Pilgrims & Room Capacity` 3 column grid with `Adults`, `Children`, and `Infants`), Group Booking modal, Hajj Inquiry form, Status Tracker, Admin Applications Dossier, and Printable Voucher, where `bedAndSeatCount = adults + children` and `totalPassportCount = adults + children + infants`.
**Done when:** `children` is restored in the Neon PostgreSQL `applications` table, Drizzle schema, seed data, validators, server actions, and all public and admin components, with `Adults + Children` counting toward hotel beds and vehicle seats and `Adults + Children + Infants` counting toward total passports.
code in `db/schema/applications.ts`, `db/seed.ts`, `lib/validations/application.ts`, `app/actions/`, `components/planner/`, `components/public/`, `components/admin/`, `app/admin/`
- [x] Build it: `/develop restore children passenger count across database, domain, admin & public UI`
- [x] Verify it: `/check verify restore children passenger count across database, domain, admin & public UI`

## Slice 24: Production deployment readiness, security hardening & full stack bug fixes

### 28. Production deployment readiness, security hardening & full stack bug fixes · done · Beta

Resolve all 31 issues identified in the independent deployment readiness code review (`docs/reviews/review-deployment-readiness.md`) across infrastructure, Next.js 16 configuration, authentication, Neon PostgreSQL schema constraints, domain calculators, Public Custom Journey Builder, and Admin Portal CRUD & Quoting CRM.
**Done when:** all 31 issues in `docs/reviews/review-deployment-readiness.md` are fixed, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass with zero errors, and Docker / Nginx production artifacts (`Dockerfile`, `.dockerignore`, `.env.example`, `drizzle/` SQL migrations) are in place.
code in `tsconfig.json`, `next.config.ts`, `lib/`, `db/`, `app/`, `components/`, `nginx/`
- [x] Build it: `/develop production deployment readiness, security hardening & full stack bug fixes`
- [x] Verify it: `/check verify production deployment readiness, security hardening & full stack bug fixes`
- [x] Test it: `/test production deployment readiness, security hardening & full stack bug fixes`

## Slice 25: Official contact details, demo UI removal, database cleanup & Hajj 2027 package guide

### 29. Official contact details, demo UI removal, database cleanup & Hajj 2027 package guide · done

Remove all demo and test UI (`One-Click Demo Access` on `/admin/login` and `Quick Test Samples` on the Status Tracker), purge seeded sample applications (`ART-2026-8812`, `ART-2026-4521`, `ART-2026-1930`) and sample contact messages from Neon PostgreSQL and `db/seed.ts`, remove fake registration numbers (`#4082`, `IATA # 27-2-1234-5`, `NTN: 7824192-3`) in favor of official branding (`Hajj • Umrah • Flights • Hotels • Tours` and `Where Purpose Meets Excellence`), update all agency contact details (`03274029701`, `03190462638`, `alramlahtravels@gmail.com`, `House no 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt`) across the database, vouchers, and UI, and upgrade `#hajj-inquiry` with the complete Hajj 2027 Package Guide (Maktab A, B, C tabs, all 10 packages with Quad/Triple/Double PKR rates, Qurbani & Train additional charges, 6 required documents, and 3 step booking roadmap).
**Done when:** zero demo buttons, sample test pills, fake license numbers, or old phone/address strings remain in the database or codebase, the Admin CRM is clean of sample applications, and the Hajj 2027 Package Guide displays all 10 packages, requirements, and contact numbers from the official brochure.
code in `db/`, `lib/validations/catalog.ts`, `app/`, `components/`
- [x] Build it: `/develop official contact details, demo UI removal, database cleanup & Hajj 2027 package guide`
- [x] Verify it: `/check verify official contact details, demo UI removal, database cleanup & Hajj 2027 package guide`

## Slice 26: B2B supplier wrapping, 4K post studio, multi-channel distribution, 14-day outreach CRM & restored hotel meal plans

### 30. B2B supplier wrapping, 4K post studio, multi-channel distribution, 14-day outreach CRM & restored hotel meal plans · done · Beta

Build the unified B2B Supplier Package Wrapping, 4K Post Studio, Multi-Channel Distribution Matrix, and 14-Day Cooldown Personal Outreach CRM directly inside the Next.js 16 + Drizzle ORM Command Center (`/admin/supplier-flyers`, `/admin/post-lookup`, `/admin/distribution`, `/admin/outreach`), unpack and expand the 3 Agent Skills (`umrah-quotation-pdf`, `umrah-package-posters`, and new `umrah-single-package-poster`), integrate Cloudflare R2 object storage with local disk fallback (`lib/storage/r2.ts`) and Headless Chromium DevTools Protocol 4K rendering (`lib/posters/`), clone open-source marketing reference repositories (`services/postiz-app`, `services/wacrm`, `services/posthive`) with TypeScript service bridges, restore configurable Hotel Meal Plans (`Room Only`, `Breakfast`, `Half Board`, `Full Board`) across the database, Custom Journey Builder, and Admin Quote Worksheet, and add Zahoor Travels custom quotation attribution with 1-click 3-Page Luxury Quotation PDF generation.
**Done when:** all 3 skills are unpacked and documented, all new Drizzle tables (`suppliers`, `supplier_flyers`, `supplier_flyer_packages`, `post_assets`, `marketing_channels`, `daily_post_distributions`, `outreach_contacts`, `outreach_logs`) and restored hotel meal plan columns are pushed to Neon PostgreSQL and seeded with Ammaar, Upsky Travels, Zahoor Travels, 36 marketing channels, and 14-day outreach contacts, 4K Single-Package Spotlight Posters (`3240x4560`) and Multi-Package Sheets render via Headless Chromium, and `typecheck`, `lint`, `test`, and `build` pass with zero errors.
code in `db/schema/suppliers-and-marketing.ts`, `lib/storage/r2.ts`, `lib/domain/marketing-ops.ts`, `lib/posters/`, `lib/bridges/`, `app/actions/marketing-ops.ts`, `app/admin/(dashboard)/supplier-flyers/`, `post-lookup/`, `distribution/`, `outreach/`
- [x] Build it: `/develop B2B supplier wrapping, 4K post studio, multi-channel distribution, 14-day outreach CRM & restored hotel meal plans`
- [x] Verify it: `/check verify B2B supplier wrapping, 4K post studio, multi-channel distribution, 14-day outreach CRM & restored hotel meal plans`
- [x] Test it: `/test B2B supplier wrapping, 4K post studio, multi-channel distribution, 14-day outreach CRM & restored hotel meal plans` ([marketing-and-suppliers.test.ts](tests/marketing-and-suppliers.test.ts))

## Slice 27: Multimodal BYO-poster studio, presigned R2, sharp normalizer & Oracle Gotenberg

### 31. Multimodal BYO-poster studio, presigned R2, sharp normalizer & Oracle Gotenberg · done · Beta

Enable direct browser-to-Cloudflare R2 presigned uploads, `sharp` 1080x1520 JPEG social normalization for TikTok/Instagram compliance, Oracle Cloud Always Free Gotenberg rendering (`scripts/oracle-gotenberg/` + `lib/posters/gotenberg.ts`), and Vercel AI SDK multimodal package extraction (`OpenRouter` + `Gemini` + Zod `Output.object()`) supporting both finished 4K Gemini Ultra posters and raw supplier flyers/PDFs/text, plus accurate ISO batch date parsing on website publish.
**Done when:** spec `0008` is captured, presigned uploads + `sharp` normalizer + Gotenberg client + multimodal Zod extractor are built, and unit tests pass.
spec [0008](docs/specs/0008-multimodal-studio-r2-and-gotenberg.md) · code in `lib/storage/r2.ts`, `lib/posters/`, `lib/ai/extract-packages.ts`, `app/api/uploads/presign/route.ts`, `scripts/oracle-gotenberg/`
- [x] Design it (spec): `/architect multimodal BYO-poster studio, presigned R2, sharp normalizer & Oracle Gotenberg`
- [x] Build it: `/develop multimodal BYO-poster studio, presigned R2, sharp normalizer & Oracle Gotenberg`
- [x] Verify it: `/check verify multimodal BYO-poster studio, presigned R2, sharp normalizer & Oracle Gotenberg` ([verify-enterprise-multimodal-wacrm-postiz.md](docs/reviews/verify-enterprise-multimodal-wacrm-postiz.md))
- [x] Test it: `/test multimodal BYO-poster studio, presigned R2, sharp normalizer & Oracle Gotenberg` ([multimodal-and-gotenberg.test.ts](tests/multimodal-and-gotenberg.test.ts))

## Slice 28: Native wacrm WhatsApp Cloud API, encryption, HMAC webhooks, inbox & broadcasts

### 32. Native wacrm WhatsApp Cloud API, encryption, HMAC webhooks, inbox & broadcasts · done · Beta

Port `ArnasDon/wacrm` Official Meta WhatsApp Cloud API v21.0 engine natively into `web/` on Drizzle ORM + Neon PostgreSQL: AES-256-GCM token encryption, constant-time `x-hub-signature-256` HMAC webhook verification, inbound message & receipt ingestion, automatic 14-day outreach cooldown unlock on reply, `ART-...` Post Ref auto-detection, quick replies, 3-page PDF sending, and Meta template broadcasts.
**Done when:** spec `0009` is captured, `db/schema/whatsapp-crm.ts`, `lib/whatsapp/*`, `/api/webhooks/whatsapp`, and `app/actions/whatsapp-crm.ts` compile and pass security & detector tests.
spec [0009](docs/specs/0009-native-wacrm-whatsapp-cloud-crm.md) · code in `db/schema/whatsapp-crm.ts`, `lib/whatsapp/`, `app/api/webhooks/whatsapp/`, `app/actions/whatsapp-crm.ts`
- [x] Design it (spec): `/architect native wacrm WhatsApp Cloud API, encryption, HMAC webhooks, inbox & broadcasts`
- [x] Build it: `/develop native wacrm WhatsApp Cloud API, encryption, HMAC webhooks, inbox & broadcasts`
- [x] Verify it: `/check verify native wacrm WhatsApp Cloud API, encryption, HMAC webhooks, inbox & broadcasts` ([verify-enterprise-multimodal-wacrm-postiz.md](docs/reviews/verify-enterprise-multimodal-wacrm-postiz.md))
- [x] Test it: `/test native wacrm WhatsApp Cloud API, encryption, HMAC webhooks, inbox & broadcasts` ([whatsapp-security-and-detector.test.ts](tests/whatsapp-security-and-detector.test.ts))

## Slice 29: Native Postiz Core 5 social providers & Trigger.dev Cloud durable workers

### 33. Native Postiz Core 5 social providers & Trigger.dev Cloud durable workers · done · Beta

Port `postiz-app` Core 5 OAuth + publishing specifications (`instagram`, `facebook`, `tiktok`, `youtube`, `gmb` Google Business Profile) natively into `web/lib/social/` + Drizzle ORM, and wire `Trigger.dev Cloud` (`trigger.config.ts` & `trigger/*`) for background multimodal extraction, scheduled multi-channel publishing (with 2-step Spotlight -> Sheet delays), paced WhatsApp broadcasts, and Gotenberg PDF rendering.
**Done when:** spec `0010` is captured, `db/schema/social-scheduler.ts`, `lib/social/*`, OAuth routes, Server Actions, and Trigger.dev tasks compile cleanly and pass validation tests.
spec [0010](docs/specs/0010-native-postiz-social-and-trigger-cloud.md) · code in `db/schema/social-scheduler.ts`, `lib/social/`, `app/api/oauth/social/`, `app/actions/social-scheduler.ts`, `trigger.config.ts`, `trigger/`
- [x] Design it (spec): `/architect native Postiz Core 5 social providers & Trigger.dev Cloud durable workers`
- [x] Build it: `/develop native Postiz Core 5 social providers & Trigger.dev Cloud durable workers`
- [x] Verify it: `/check verify native Postiz Core 5 social providers & Trigger.dev Cloud durable workers` ([verify-enterprise-multimodal-wacrm-postiz.md](docs/reviews/verify-enterprise-multimodal-wacrm-postiz.md))
- [x] Test it: `/test native Postiz Core 5 social providers & Trigger.dev Cloud durable workers` ([social-providers-validation.test.ts](tests/social-providers-validation.test.ts))

## Slice 30: 4-Hub Admin reorganization (/studio, /campaigns, /desk, /catalog) & Kanban desk

### 34. 4-Hub Admin reorganization (/studio, /campaigns, /desk, /catalog) & Kanban desk · done · Beta

Consolidate the 15 scattered `/admin` pages into 4 unified daily hubs (`/admin/studio`, `/admin/campaigns`, `/admin/desk`, `/admin/catalog` + enhanced `/admin/settings` OAuth & WABA connections), add `@dnd-kit` Kanban pipeline for Applications, add a global `Cmd+K` Post Reverse-Lookup command palette in the Admin Topbar, and preserve clean redirects on legacy `/admin/*` URLs.
**Done when:** spec `0011` is captured, all 4 hubs, `Cmd+K` lookup, Kanban board, and redirects render cleanly in the single Haramain Emerald/Ivory/Gold luxury theme, and `typecheck`, `lint`, `test`, and `build` pass with zero errors.
spec [0011](docs/specs/0011-four-hub-admin-ia-and-kanban-desk.md) · code in `app/admin/(dashboard)/studio/`, `campaigns/`, `desk/`, `catalog/`, `settings/`, `components/admin/`, `components/layout/`
- [x] Design it (spec): `/architect 4-Hub Admin reorganization (/studio, /campaigns, /desk, /catalog) & Kanban desk`
- [x] Build it: `/develop 4-Hub Admin reorganization (/studio, /campaigns, /desk, /catalog) & Kanban desk`
- [x] Verify it: `/check verify 4-Hub Admin reorganization (/studio, /campaigns, /desk, /catalog) & Kanban desk` ([verify-enterprise-multimodal-wacrm-postiz.md](docs/reviews/verify-enterprise-multimodal-wacrm-postiz.md))
- [x] Test it: `/test 4-Hub Admin reorganization (/studio, /campaigns, /desk, /catalog) & Kanban desk` ([verify-enterprise-multimodal-wacrm-postiz.md](docs/reviews/verify-enterprise-multimodal-wacrm-postiz.md))

## Slice 31: Trigger.dev v4 hardening, queues, schedules & realtime React hooks

### 35. Trigger.dev v4 hardening, queues, schedules & realtime React hooks · done · Beta

Upgrade all durable workers in `trigger/*.task.ts` from raw `task()` to `schemaTask()` with Zod validation and `AbortTaskRunError` non-retryable error discrimination, introduce dedicated concurrency queues (`gotenbergQueue`, `whatsappBroadcastQueue`, `socialPublishQueue`), replace sequential `for...of` trigger loops with `batchTrigger` / `batchTriggerAndWait`, instrument runs with `metadata.set()` + `@trigger.dev/react-hooks` (`useRealtimeRun`) for live progress bars in `/admin/studio` and `/admin/campaigns` via scoped public tokens, and add declarative `schedules.task()` crons for proactive social token refresh and 24-hour SLA quote monitoring.
**Done when:** spec `0012` is captured, `trigger/queues.ts`, `trigger/schedules.task.ts`, `trigger/*.task.ts`, `app/actions/trigger-realtime.ts`, and realtime Studio/Campaign UI hooks compile cleanly and pass unit tests.
spec [0012](docs/specs/0012-trigger-v4-hardening-queues-and-realtime-hooks.md) · code in `trigger/`, `app/actions/trigger-realtime.ts`, `components/admin/studio/`, `components/admin/campaigns/`
- [x] Design it (spec): `/architect Trigger.dev v4 hardening, queues, schedules & realtime React hooks`
- [x] Build it: `/develop Trigger.dev v4 hardening, queues, schedules & realtime React hooks`
  - [x] Milestone 1: Shared concurrency queues, `AbortTaskRunError` discrimination, `metadata.set()` helpers & `schemaTask` hardening (`trigger/queues.ts`, `trigger/errors.ts`, `trigger/metadata.ts`, `trigger/*.task.ts`)
  - [x] Milestone 2: Declarative cron schedules (`proactive-social-token-refresh` & `sla-overdue-quote-monitor` in `trigger/schedules.task.ts`)
  - [x] Milestone 3: Scoped public token Server Actions & `batchTrigger` fan-out (`app/actions/trigger-realtime.ts`, `app/actions/social-scheduler.ts`)
  - [x] Milestone 4: Realtime React hooks (`useRealtimeRun`) in `/admin/studio` and `/admin/campaigns` (`components/admin/studio/*`, `components/admin/campaigns/*`)
- [x] Verify it: `/check verify Trigger.dev v4 hardening, queues, schedules & realtime React hooks` ([verify-phase2-trigger-wacrm-postiz-copilot.md](docs/reviews/verify-phase2-trigger-wacrm-postiz-copilot.md))
- [x] Test it: `/test Trigger.dev v4 hardening, queues, schedules & realtime React hooks` ([trigger-v4-and-schedules.test.ts](tests/trigger-v4-and-schedules.test.ts))

## Slice 32: WaCRM Phase 2: inbound media R2 pipeline, instant ART-... auto-responder bot, interactive messages & template sync

### 36. WaCRM Phase 2: inbound media R2 pipeline, instant ART-... auto-responder bot, interactive messages & template sync · done · Beta

Complete the `ArnasDon/wacrm` Phase 2 feature set in `lib/whatsapp/*` and `/api/webhooks/whatsapp`: automatically download inbound pilgrim media (`image`, `document`, `audio`, `video` via `GET /{media-id}`) into Cloudflare R2 for permanent viewing in `/admin/desk?tab=inbox`, add a 3-second `ART-...` auto-responder bot that replies with the matching package's hotel/rate breakdown + 3-page PDF + interactive quick-reply buttons, implement `markMessageAsRead` blue-tick receipts and emoji reactions, add interactive reply buttons (`<=3`) and list menus (`<=10`), and support Meta template creation/deletion plus `message_template_status_update` webhook sync.
**Done when:** spec `0013` is captured, inbound media mirrors to R2, `ART-...` auto-replies and interactive messages work end to end, and security/bot tests pass.
spec [0013](docs/specs/0013-wacrm-phase2-media-bot-interactive-and-templates.md) · code in `db/schema/whatsapp-crm.ts`, `lib/whatsapp/`, `trigger/mirror-whatsapp-media.task.ts`, `app/api/webhooks/whatsapp/`, `app/actions/whatsapp-crm.ts`, `components/admin/hubs/desk-hub-client.tsx`
- [x] Design it (spec): `/architect WaCRM Phase 2: inbound media R2 pipeline, instant ART-... auto-responder bot, interactive messages & template sync`
- [x] Build it: `/develop WaCRM Phase 2: inbound media R2 pipeline, instant ART-... auto-responder bot, interactive messages & template sync`
  - [x] Milestone 1: Schema extensions, validation contracts & Meta Graph API v21.0 Phase 2 client (`db/schema/whatsapp-crm.ts`, `lib/validations/whatsapp-crm.ts`, `lib/whatsapp/meta-api.ts`)
  - [x] Milestone 2: Inbound media R2 mirror pipeline & instant 3-second `ART-...` auto-responder bot (`lib/whatsapp/media-mirror.ts`, `trigger/mirror-whatsapp-media.task.ts`, `lib/whatsapp/auto-responder.ts`)
  - [x] Milestone 3: Webhook route upgrade & WhatsApp CRM Server Actions (`app/api/webhooks/whatsapp/route.ts`, `app/actions/whatsapp-crm.ts`)
  - [x] Milestone 4: `/admin/desk?tab=inbox` UI integration for media preview, interactive composer, blue ticks & bot toggle (`components/admin/hubs/desk-hub-client.tsx`)
- [x] Verify it: `/check verify WaCRM Phase 2: inbound media R2 pipeline, instant ART-... auto-responder bot, interactive messages & template sync` ([verify-phase2-trigger-wacrm-postiz-copilot.md](docs/reviews/verify-phase2-trigger-wacrm-postiz-copilot.md))
- [x] Test it: `/test WaCRM Phase 2: inbound media R2 pipeline, instant ART-... auto-responder bot, interactive messages & template sync` ([whatsapp-phase2-bot-and-media.test.ts](tests/whatsapp-phase2-bot-and-media.test.ts))

## Slice 33: Postiz Phase 2: multi-page OAuth selector, proactive token refresh, Reels/Stories upload, first-comment plug & analytics

### 37. Postiz Phase 2: multi-page OAuth selector, proactive token refresh, Reels/Stories upload, first-comment plug & analytics · done · Beta

Complete the `postiz-app` Phase 2 social publishing engine in `lib/social/*` and `/api/oauth/social/*`: replace hardcoded `pages[0]` / `locations[0]` selection with a Multi-Account/Page/Location Picker modal in `/admin/settings`, add proactive token refresh (`lib/social/token-refresh.ts`) before OAuth expiry, implement Facebook Reels/Stories 3-phase chunked upload and Instagram `resolveReleaseId` timeout recovery, add automatic First-Comment `ART-...` WhatsApp CTA plugs on Instagram/Facebook/YouTube, and add Core 5 post analytics sync (`lib/social/analytics.ts`) in `/admin/campaigns`.
**Done when:** spec `0014` is captured, multi-page OAuth selection, proactive refresh, Reels/Stories upload, First-Comment auto-plug, and analytics sync compile and pass unit tests.
spec [0014](docs/specs/0014-postiz-phase2-oauth-selector-reels-comments-analytics.md) · code in `db/schema/social-scheduler.ts`, `lib/social/`, `app/api/oauth/social/`, `app/actions/social-scheduler.ts`, `components/admin/hubs/campaigns-hub-client.tsx`, `components/admin/hubs/connections-settings-client.tsx`
- [x] Design it (spec): `/architect Postiz Phase 2: multi-page OAuth selector, proactive token refresh, Reels/Stories upload, first-comment plug & analytics`
- [x] Build it: `/develop Postiz Phase 2: multi-page OAuth selector, proactive token refresh, Reels/Stories upload, first-comment plug & analytics`
  - [x] Milestone 1: Drizzle schema extensions, validation schemas & core types (`db/schema/social-scheduler.ts`, `lib/social/types.ts`, `lib/validations/social-scheduler.ts`)
  - [x] Milestone 2: Multi-account OAuth discovery, Facebook 3-phase Reels/Stories, IG `resolveReleaseId` & First-Comment adapters (`lib/social/providers/*.ts`, `lib/social/first-comment.ts`)
  - [x] Milestone 3: Proactive token refresh engine, Core 5 analytics sync & OAuth/Scheduler Server Actions (`lib/social/token-refresh.ts`, `lib/social/analytics.ts`, `app/api/oauth/social/[provider]/callback/route.ts`, `app/actions/social-scheduler.ts`)
  - [x] Milestone 4: Admin Campaigns & Settings UI upgrades (`components/admin/hubs/connections-settings-client.tsx`, `components/admin/hubs/campaigns-hub-client.tsx`)
- [x] Verify it: `/check verify Postiz Phase 2: multi-page OAuth selector, proactive token refresh, Reels/Stories upload, first-comment plug & analytics` ([verify-phase2-trigger-wacrm-postiz-copilot.md](docs/reviews/verify-phase2-trigger-wacrm-postiz-copilot.md))
- [x] Test it: `/test Postiz Phase 2: multi-page OAuth selector, proactive token refresh, Reels/Stories upload, first-comment plug & analytics` ([social-phase2-reels-and-comments.test.ts](tests/social-phase2-reels-and-comments.test.ts))

## Slice 34: Durable AI quoting copilot & WhatsApp concierge agent

### 38. Durable AI quoting copilot & WhatsApp concierge agent · done · Beta

Build a durable AI Quoting Copilot & Concierge (`lib/ai/quoting-copilot.ts` + `trigger/quoting-copilot.task.ts`) powered by Vercel AI SDK (`OpenRouter` / `Gemini` + Zod `Output.object()`) and Drizzle ORM read-only tools (`lookupPostCodeTool`, `calculateCustomQuoteHintsTool`, `checkBatchAvailabilityTool`), providing one-click AI draft replies and itemized SAR/PKR quote worksheet pre-fill in `/admin/desk` and `/admin/applications/[id]` with strict human-in-the-loop staff approval.
**Done when:** spec `0015` is captured, `lib/ai/quoting-copilot.ts`, `trigger/quoting-copilot.task.ts`, Server Actions, and `/admin/desk` AI Copilot UI compile cleanly and pass unit tests.
spec [0015](docs/specs/0015-durable-ai-quoting-copilot-and-whatsapp-concierge.md) · code in `lib/ai/quoting-copilot.ts`, `trigger/quoting-copilot.task.ts`, `app/actions/quoting-copilot.ts`, `components/admin/hubs/desk-hub-client.tsx`, `components/admin/applications/quote-worksheet-form.tsx`
- [x] Design it (spec): `/architect Durable AI quoting copilot & WhatsApp concierge agent`
- [x] Build it: `/develop Durable AI quoting copilot & WhatsApp concierge agent`
  - [x] Milestone 1: Read-only Drizzle domain tools & structured AI Quoting Copilot engine (`lib/ai/quoting-copilot.ts`)
  - [x] Milestone 2: Durable Trigger.dev v4 task & authenticated Server Actions (`trigger/quoting-copilot.task.ts`, `app/actions/quoting-copilot.ts`)
  - [x] Milestone 3: Desk Inbox Concierge UI & Quote Worksheet pre-fill integration (`components/admin/hubs/desk-hub-client.tsx`, `components/admin/applications/quote-worksheet-form.tsx`)
  - [x] Milestone 4: Verification & unit test suite (`tests/ai-quoting-copilot.test.ts`)
- [x] Verify it: `/check verify Durable AI quoting copilot & WhatsApp concierge agent` ([verify-phase2-trigger-wacrm-postiz-copilot.md](docs/reviews/verify-phase2-trigger-wacrm-postiz-copilot.md))
- [x] Test it: `/test Durable AI quoting copilot & WhatsApp concierge agent` ([ai-quoting-copilot.test.ts](tests/ai-quoting-copilot.test.ts))

## Slice 35: Postiz Core 5 interactive platform post previewer & analytics dashboard

### 39. Postiz Core 5 interactive platform post previewer & analytics dashboard · done · Beta

Build the interactive Core 5 Platform Device Post Previewer (`components/admin/campaigns/social-platform-preview.tsx`) and Cross-Channel Analytics Dashboard in `/admin/campaigns?tab=social`, rendering realistic switchable device mockups for **Instagram** (`FEED` 4:5 carousel/card, `REEL` 9:16 vertical overlay, `STORY` 9:16 frame, plus pinned First-Comment `ART-...` preview), **Facebook Page** (`FEED`, `REEL`, `STORY` + First Comment), **TikTok** (9:16 mobile overlay with right-side engagement rail & scrolling caption), **YouTube Shorts** (9:16 Shorts player with Subscribe CTA & pinned comment), and **Google Business Profile** (Google Search local update card with `Book` / `Learn More` WhatsApp CTA button), plus a top-level Core 5 Analytics KPI summary & per-platform breakdown drawer.
**Done when:** spec `0016` is captured, the 5-platform interactive device previewer and analytics breakdown drawer are wired into `/admin/campaigns?tab=social`, and unit tests pass.
spec [0016](docs/specs/0016-postiz-core5-interactive-previewer-and-analytics-dashboard.md) · code in `lib/social/preview-formatter.ts`, `lib/social/analytics.ts`, `app/actions/social-scheduler.ts`, `components/admin/campaigns/social-platform-preview.tsx`, `components/admin/hubs/campaigns-hub-client.tsx`
- [x] Design it (spec): `/architect Postiz Core 5 interactive platform post previewer & analytics dashboard`
- [x] Build it: `/develop Postiz Core 5 interactive platform post previewer & analytics dashboard`
  - [x] Milestone 1: Pure Core 5 preview formatter & analytics rollup helpers (`lib/social/preview-formatter.ts`, `lib/social/analytics.ts`, `app/actions/social-scheduler.ts`)
  - [x] Milestone 2: Interactive Core 5 device post previewer & Campaign Hub analytics dashboard (`components/admin/campaigns/social-platform-preview.tsx`, `components/admin/hubs/campaigns-hub-client.tsx`)
  - [x] Milestone 3: Unit test suite & verification (`tests/social-preview-and-analytics.test.ts`)
- [x] Verify it: `/check verify Postiz Core 5 interactive platform post previewer & analytics dashboard` ([verify-phase2-trigger-wacrm-postiz-copilot.md](docs/reviews/verify-phase2-trigger-wacrm-postiz-copilot.md))
- [x] Test it: `/test Postiz Core 5 interactive platform post previewer & analytics dashboard` ([social-preview-and-analytics.test.ts](tests/social-preview-and-analytics.test.ts))

## Slice 36: WaCRM custom keyword auto-reply rules engine, greeting setup & quick-reply manager

### 40. WaCRM custom keyword auto-reply rules engine, greeting setup & quick-reply manager · done · Beta

Port the complete `ArnasDon/wacrm` Auto-Replies & Quick-Reply Management studio into `db/schema/whatsapp-crm.ts`, `lib/whatsapp/auto-responder.ts`, `app/actions/whatsapp-crm.ts`, and `/admin/desk?tab=inbox`: add custom keyword/intent auto-reply rules (`EXACT`, `CONTAINS`, `STARTS_WITH`, `REGEX` matching on keywords like `location`, `address`, `hajj`, `documents`, `bank` with text, document/image media, or interactive button responses and per-rule cooldowns), configurable Welcome / Out-of-Office Greeting messages, configurable `ART-...` bot cooldown minutes, and a full CRUD manager modal in `/admin/desk?tab=inbox` for both Auto-Reply Rules and `/shortcut` Quick Replies.
**Done when:** spec `0017` is captured, `whatsappAutoReplyRules` schema + keyword matcher + CRUD Server Actions + Auto-Replies Setup Studio UI in `/admin/desk?tab=inbox` compile cleanly and pass unit tests.
spec [0017](docs/specs/0017-wacrm-auto-reply-rules-greeting-and-quick-reply-manager.md) · code in `db/schema/whatsapp-crm.ts`, `lib/validations/whatsapp-crm.ts`, `lib/whatsapp/auto-responder.ts`, `app/api/webhooks/whatsapp/route.ts`, `app/actions/whatsapp-crm.ts`, `components/admin/desk/whatsapp-auto-reply-studio.tsx`, `components/admin/hubs/desk-hub-client.tsx`
- [x] Design it (spec): `/architect WaCRM custom keyword auto-reply rules engine, greeting setup & quick-reply manager`
- [x] Build it: `/develop WaCRM custom keyword auto-reply rules engine, greeting setup & quick-reply manager`
  - [x] Milestone 1: Drizzle schema extensions, validation contracts & unified 3-priority auto-responder engine (`db/schema/whatsapp-crm.ts`, `lib/validations/whatsapp-crm.ts`, `lib/whatsapp/auto-responder.ts`)
  - [x] Milestone 2: WhatsApp CRM Server Actions & default agency preset seeder (`app/actions/whatsapp-crm.ts`)
  - [x] Milestone 3: Auto-Replies & Quick-Replies Setup Studio UI & verification suite (`components/admin/desk/whatsapp-auto-reply-studio.tsx`, `components/admin/hubs/desk-hub-client.tsx`, `app/admin/(dashboard)/desk/page.tsx`, `tests/whatsapp-auto-reply-rules.test.ts`)
- [x] Verify it: `/check verify WaCRM custom keyword auto-reply rules engine, greeting setup & quick-reply manager` ([verify-phase2-trigger-wacrm-postiz-copilot.md](docs/reviews/verify-phase2-trigger-wacrm-postiz-copilot.md))
- [x] Test it: `/test WaCRM custom keyword auto-reply rules engine, greeting setup & quick-reply manager` ([whatsapp-auto-reply-rules.test.ts](tests/whatsapp-auto-reply-rules.test.ts))

## Slice 37: Trigger.dev v4 async webhook pipeline, realtime copilot telemetry, global idempotency & bridge cleanup

### 41. Trigger.dev v4 async webhook pipeline, realtime copilot telemetry, global idempotency & bridge cleanup · done · Beta

Offload inbound WhatsApp AI intent classification and 3-priority auto-responder execution from `/api/webhooks/whatsapp` into a durable `process-inbound-whatsapp` Trigger.dev v4 task (`<150ms` webhook acknowledgment), upgrade AI Quoting Copilot and Luxury PDF rendering from synchronous `runs.poll` blocking to non-blocking `{ runId, publicAccessToken }` + live `useRealtimeRun` stage progress bars in `/admin/desk` and `/admin/applications/[id]`, enforce `scope: "global"` idempotency keys on WhatsApp broadcasts, add tag-based active run rehydration on page reload, and replace legacy `marketing-bridges.ts` stubs in `marketing-ops.ts` with native scheduler/CRM dispatch.
**Done when:** spec `0018` is captured, `trigger/process-inbound-whatsapp.task.ts`, non-blocking realtime Copilot/PDF hooks, global broadcast idempotency, tag-based run rehydration, and native bridge routing compile cleanly and pass unit tests.
spec [0018](docs/specs/0018-trigger-v4-async-webhook-and-realtime-copilot.md) · code in `trigger/process-inbound-whatsapp.task.ts`, `trigger/dispatch.ts`, `app/api/webhooks/whatsapp/route.ts`, `app/actions/trigger-realtime.ts`, `app/actions/quoting-copilot.ts`, `components/admin/desk/copilot-realtime-run-banner.tsx`, `lib/bridges/marketing-bridges.ts`

- [x] Design it (spec): `/architect Trigger.dev v4 async webhook pipeline, realtime copilot telemetry, global idempotency & bridge cleanup`
- [x] Build it: `/develop Trigger.dev v4 async webhook pipeline, realtime copilot telemetry, global idempotency & bridge cleanup`
  - [x] Milestone 1: Durable `process-inbound-whatsapp` Trigger.dev v4 task & zero-timeout webhook decoupling (`trigger/process-inbound-whatsapp.task.ts`, `trigger/dispatch.ts`, `app/api/webhooks/whatsapp/route.ts`)
  - [x] Milestone 2: Global broadcast idempotency keys & tag-based active run rehydration (`app/actions/whatsapp-crm.ts`, `app/actions/trigger-realtime.ts`)
  - [x] Milestone 3: Non-blocking realtime Quoting Copilot & Luxury PDF telemetry (`app/actions/quoting-copilot.ts`, `app/actions/quotes.ts`, `components/admin/desk/copilot-realtime-run-banner.tsx`)
  - [x] Milestone 4: Native bridge routing cleanup & unit test suite (`lib/bridges/marketing-bridges.ts`, `app/actions/marketing-ops.ts`, `tests/trigger-v4-webhook-and-realtime-copilot.test.ts`)
- [x] Verify it: `/check verify Trigger.dev v4 async webhook pipeline, realtime copilot telemetry, global idempotency & bridge cleanup` ([verify-phase3-trigger-wacrm-postiz.md](docs/reviews/verify-phase3-trigger-wacrm-postiz.md))
- [x] Test it: `/test Trigger.dev v4 async webhook pipeline, realtime copilot telemetry, global idempotency & bridge cleanup` ([trigger-v4-webhook-and-realtime-copilot.test.ts](tests/trigger-v4-webhook-and-realtime-copilot.test.ts))

## Slice 38: WaCRM Phase 3: live realtime inbox, template builder, personalized broadcast wizard & guided intake flow

### 42. WaCRM Phase 3: live realtime inbox, template builder, personalized broadcast wizard & guided intake flow · done · Beta

Upgrade the native WaCRM implementation in `lib/whatsapp/*`, `db/schema/whatsapp-crm.ts`, `/admin/desk`, `/admin/campaigns`, and `/admin/settings`: add live auto-refresh / SSE inbox streaming so new inbound messages and blue-tick receipts appear without page reload, wire `isPinned`, `isArchived`, `assignedUserId` (agent assignment), and internal team notes in Desk Hub, wire `createWhatsAppTemplateAction` & `deleteWhatsAppTemplateAction` into a full Meta Template Builder modal in `/admin/settings`, upgrade Broadcast creation with `{{1}}` variable mapping, header media URL, CSV contact import, and a Broadcast Recipient Drilldown + 1-click "Retry Failed Recipients", and add a multi-step Guided Umrah Intake Flow state machine that auto-creates leads in the Applications Kanban Desk.
**Done when:** spec `0019` is captured, live inbox sync, pin/archive/assignment/notes, template builder modal, personalized broadcast variable mapping + retry drawer, and guided intake flow compile cleanly and pass unit tests.
spec [0019](docs/specs/0019-wacrm-phase3-realtime-inbox-templates-broadcasts-and-flows.md) · code in `db/schema/whatsapp-crm.ts`, `lib/whatsapp/intake-flow.ts`, `lib/whatsapp/template-variables.ts`, `app/actions/whatsapp-crm.ts`, `components/admin/campaigns/whatsapp-broadcast-drawer.tsx`, `components/admin/hubs/desk-hub-client.tsx`, `components/admin/hubs/connections-settings-client.tsx`, `components/admin/hubs/campaigns-hub-client.tsx`

- [x] Design it (spec): `/architect WaCRM Phase 3: live realtime inbox, template builder, personalized broadcast wizard & guided intake flow`
- [x] Build it: `/develop WaCRM Phase 3: live realtime inbox, template builder, personalized broadcast wizard & guided intake flow`
  - [x] Milestone 1: Schema extensions, conversation management & guided Umrah intake flow engine (`db/schema/whatsapp-crm.ts`, `lib/validations/whatsapp-crm.ts`, `lib/whatsapp/intake-flow.ts`, `lib/whatsapp/template-variables.ts`)
  - [x] Milestone 2: Server Actions for conversation management, template variables, CSV broadcasts & failed recipient retry (`app/actions/whatsapp-crm.ts`, `trigger/send-whatsapp-broadcast.task.ts`)
  - [x] Milestone 3: Live auto-refreshing Desk Inbox UI, pin/archive/assign/notes controls & Meta Template Builder modal (`components/admin/hubs/desk-hub-client.tsx`, `components/admin/hubs/connections-settings-client.tsx`)
  - [x] Milestone 4: Personalized Broadcast Wizard, Recipient Drilldown & Retry UI + unit tests (`components/admin/hubs/campaigns-hub-client.tsx`, `tests/whatsapp-phase3-flows-and-broadcasts.test.ts`)
- [x] Verify it: `/check verify WaCRM Phase 3: live realtime inbox, template builder, personalized broadcast wizard & guided intake flow` ([verify-phase3-trigger-wacrm-postiz.md](docs/reviews/verify-phase3-trigger-wacrm-postiz.md))
- [x] Test it: `/test WaCRM Phase 3: live realtime inbox, template builder, personalized broadcast wizard & guided intake flow` ([whatsapp-phase3-flows-and-broadcasts.test.ts](tests/whatsapp-phase3-flows-and-broadcasts.test.ts))

## Slice 39: Postiz Phase 3: visual calendar & time-slot queue, per-platform AI composer & provider hardening

### 43. Postiz Phase 3: visual calendar & time-slot queue, per-platform AI composer & provider hardening · done · Beta

Upgrade the native Postiz social scheduler in `lib/social/*`, `db/schema/social-scheduler.ts`, and `/admin/campaigns?tab=social`: fix Instagram video carousel child container readiness polling and TikTok real `publicaly_available_post_id` URL resolution, add direct R2 drag-and-drop file upload and an R2 Studio Media Library picker directly inside the Social Composer, add per-platform caption override tabs (`Instagram`, `Facebook`, `TikTok`, `YouTube`, `GMB`) plus a 1-click AI Caption & Hashtag Copilot powered by Vercel AI SDK, and build a Visual Week/Month Calendar & Configurable PKT Time-Slot Queue (`Add to Next Free Slot`) plus Reactive Engagement Auto-Plugs.
**Done when:** spec `0020` is captured, IG/TikTok provider fixes, R2 composer dropzone + media picker, per-platform caption overrides + AI Copilot, visual calendar + time-slot queue, and engagement auto-plugs compile cleanly and pass unit tests.
spec [0020](docs/specs/0020-postiz-phase3-calendar-slots-ai-composer-and-providers.md) · code in `db/schema/social-scheduler.ts`, `lib/social/`, `app/actions/social-scheduler.ts`, `components/admin/campaigns/`, `components/admin/hubs/campaigns-hub-client.tsx`

- [x] Design it (spec): `/architect Postiz Phase 3: visual calendar & time-slot queue, per-platform AI composer & provider hardening`
- [x] Build it: `/develop Postiz Phase 3: visual calendar & time-slot queue, per-platform AI composer & provider hardening`
  - [x] Milestone 1: Schema extensions, provider hardening (IG video carousel polling & TikTok publish status) & time-slot queue calculator (`db/schema/social-scheduler.ts`, `lib/validations/social-scheduler.ts`, `lib/social/providers/instagram.ts`, `lib/social/providers/tiktok.ts`, `lib/social/time-slots.ts`)
  - [x] Milestone 2: AI Social Caption & Hashtag Copilot, reactive engagement auto-plug & R2 Media Library Server Actions (`lib/social/caption-copilot.ts`, `lib/social/analytics.ts`, `trigger/publish-social-post.task.ts`, `app/actions/social-scheduler.ts`)
  - [x] Milestone 3: Upgraded Multi-Platform Composer (R2 dropzone, Studio Media Picker, per-platform caption tabs & AI Copilot) (`components/admin/hubs/campaigns-hub-client.tsx`)
  - [x] Milestone 4: Visual Week/Month Social Calendar View & unit test suite (`components/admin/campaigns/social-calendar-view.tsx`, `tests/social-phase3-calendar-copilot-and-providers.test.ts`)
- [x] Verify it: `/check verify Postiz Phase 3: visual calendar & time-slot queue, per-platform AI composer & provider hardening` ([verify-phase3-trigger-wacrm-postiz.md](docs/reviews/verify-phase3-trigger-wacrm-postiz.md))
- [x] Test it: `/test Postiz Phase 3: visual calendar & time-slot queue, per-platform AI composer & provider hardening` ([social-phase3-calendar-copilot-and-providers.test.ts](tests/social-phase3-calendar-copilot-and-providers.test.ts))

## Slice 40: Native WhatsApp Linked-Device engine: QR/Pairing Code session, auto-sync real WhatsApp groups & chats, automated paced group/status posting & fake seed purge

### 44. Native WhatsApp Linked-Device engine: QR/Pairing Code session, auto-sync real WhatsApp groups & chats, automated paced group/status posting & fake seed purge · done · Beta

Build a native WhatsApp Web Multi-Device Linked-Device engine (`lib/whatsapp/linked-device.ts` powered by `@whiskeysockets/baileys` + PostgreSQL-backed encrypted auth state in `db/schema/whatsapp-crm.ts`) alongside the Official Meta Cloud API: purge all 36 fake seeded `marketing_channels` rows from Neon PostgreSQL and `db/seed.ts`, allow admins to link their actual WhatsApp phone number via live **QR Code** or **8-Digit Phone Pairing Code** in `/admin/settings?tab=whatsapp` and `/admin/campaigns?tab=whatsapp`, automatically fetch and sync all real WhatsApp Groups (`@g.us`, group subject, participant count, admin status) and WhatsApp Status (`status@broadcast`) into `marketing_channels`, sync real 1-on-1 and group chats into `/admin/desk?tab=inbox` (with direct reply support outside 24h without requiring Meta templates when linked), and add a durable Trigger.dev task (`trigger/send-whatsapp-group-campaign.task.ts`) with human-like randomized pacing (`45s–90s` jitter + `"composing"` typing presence) to auto-post flyers and captions to selected WhatsApp Groups and Status completely hands-free.
**Done when:** spec `0021` is captured, the 36 fake seeded channels are purged from Neon and `db/seed.ts`, QR/Pairing Code linking + real group auto-discovery + automated paced group/status dispatch + live chat sync compile cleanly and pass unit tests.
spec [0021](docs/specs/0021-native-whatsapp-linked-device-groups-status-and-chat-sync.md) · code in `lib/whatsapp/linked-device.ts`, `lib/whatsapp/linked-device-auth-postgres.ts`, `trigger/send-whatsapp-group-campaign.task.ts`, `app/actions/whatsapp-linked-device.ts`, `components/admin/whatsapp/whatsapp-linked-device-card.tsx`, `components/admin/hubs/campaigns-hub-client.tsx`

- [x] Design it (spec): `/architect Native WhatsApp Linked-Device engine: QR/Pairing Code session, auto-sync real WhatsApp groups & chats, automated paced group/status posting & fake seed purge`
- [x] Build it: `/develop Native WhatsApp Linked-Device engine: QR/Pairing Code session, auto-sync real WhatsApp groups & chats, automated paced group/status posting & fake seed purge`
  - [x] Milestone 1: Fake seed purge (`marketing_channels` in Neon + `db/seed.ts`), dependencies (`@whiskeysockets/baileys`, `qrcode`) & PostgreSQL-backed linked-device auth schema (`db/schema/whatsapp-crm.ts`, `next.config.ts`)
  - [x] Milestone 2: Native Baileys Linked-Device engine (`lib/whatsapp/linked-device.ts`) & auto-discovery of real WhatsApp groups & chats
  - [x] Milestone 3: Durable Trigger.dev paced group & status campaign task & Server Actions (`trigger/send-whatsapp-group-campaign.task.ts`, `app/actions/whatsapp-linked-device.ts`, `app/actions/whatsapp-crm.ts`)
  - [x] Milestone 4: Live QR / Pairing Code UI in `/admin/settings` & `/admin/campaigns?tab=whatsapp` + automated 1-click group auto-poster & unit tests (`components/admin/whatsapp/whatsapp-linked-device-card.tsx`, `components/admin/hubs/campaigns-hub-client.tsx`, `components/admin/hubs/desk-hub-client.tsx`, `tests/whatsapp-linked-device-and-groups.test.ts`)
- [x] Verify it: `/check verify Native WhatsApp Linked-Device engine: QR/Pairing Code session, auto-sync real WhatsApp groups & chats, automated paced group/status posting & fake seed purge` ([whatsapp-linked-device-and-groups.test.ts](tests/whatsapp-linked-device-and-groups.test.ts))
- [x] Test it: `/test Native WhatsApp Linked-Device engine: QR/Pairing Code session, auto-sync real WhatsApp groups & chats, automated paced group/status posting & fake seed purge` ([whatsapp-linked-device-and-groups.test.ts](tests/whatsapp-linked-device-and-groups.test.ts))

## Slice 41: Multi-Number WhatsApp System: multi-session Linked Device switcher, per-number group/status & chat attribution, multi-line auto-posting & inbox line filter

### 45. Multi-Number WhatsApp System: multi-session Linked Device switcher, per-number group/status & chat attribution, multi-line auto-posting & inbox line filter · done · Beta

Upgrade the hybrid WhatsApp architecture across `/admin/campaigns`, `/admin/desk`, and `/admin/settings` to support connecting and operating multiple WhatsApp phone numbers simultaneously across both the **Linked-Device Engine (`@whiskeysockets/baileys`)** and **Official Meta Cloud API (`whatsapp_accounts`)**:
1. **Multi-Session Linked-Device Manager UI (`WhatsappLinkedDeviceCard`)**: Add a multi-line tab bar / slot switcher supporting pre-configured Primary (`default`, e.g. `0321-4629700`) and Secondary (`secondary`, e.g. `0319-8463538`) lines plus a **`+ Add WhatsApp Number`** modal to create custom labeled slots (`sessionKey` + `label`), rename/delete slots, link each phone independently via QR Code or 8-Digit Pairing Code, and run **"Sync All Connected Lines"** in 1 click.
2. **Per-Number Group, Status & Chat Attribution (`lib/whatsapp/linked-device.ts`)**: Give each linked device its own distinct WhatsApp Status row (`status@broadcast:<sessionKey>`) in `marketing_channels`, attribute synced `@g.us` groups to their linked phone (`senderWhatsappNumber`), create/link a distinct `whatsappAccounts` row per Linked-Device phone (`phoneNumberId = "linked-" + sessionKey`) so 1-on-1 chats in `/admin/desk?tab=inbox` never collide across numbers, and automatically route outbound replies and group/status posts through the exact `sessionKey` socket that owns that chat or group.
3. **Multi-Number Campaigns & Broadcast Controls (`/admin/campaigns`)**: Add a **Phone Line Filter** bar (`All Connected Lines`, `Line 1: 0321...`, `Line 2: 0319...`) and per-card sender number badge in Tab 2 (WhatsApp Groups & Status Queue), add a **Sender Line Routing Selector** (`Auto-Route via Group's Synced Line` or force a specific connected line) in the Auto-Post Execution Bar, and add a **Sender WABA Phone Number Selector** in the Tab 3 Official Meta Broadcast Drawer (`whatsapp-broadcast-drawer.tsx`).
4. **Multi-Number Shared Team Inbox Filter & Line Badges (`/admin/desk?tab=inbox`)**: Add a **Phone Line Switcher** (`All Numbers`, plus each active Meta Cloud API and Linked-Device phone line) in the Pilgrim Conversations sidebar, display a clear **Phone Line Badge** (`📱 0321-4629700 Linked` vs `☁️ +92 319 0462638 Meta API`) on every conversation card and chat header, and route replies through that conversation's specific phone number.
**Done when:** spec `0022` is captured, multi-number Linked-Device switcher + per-line group/status/chat attribution + Campaigns line filter/routing + Desk Inbox line filter/badges compile cleanly and pass automated tests.
spec [0022](docs/specs/0022-multi-number-whatsapp-system-ui-and-routing.md) · code in `lib/whatsapp/linked-device.ts`, `lib/validations/whatsapp-linked-device.ts`, `app/actions/whatsapp-linked-device.ts`, `components/admin/whatsapp/whatsapp-linked-device-card.tsx`, `components/admin/hubs/campaigns-hub-client.tsx`, `components/admin/hubs/desk-hub-client.tsx`

- [x] Design it (spec): `/architect Multi-Number WhatsApp System: multi-session Linked Device switcher, per-number group/status & chat attribution, multi-line auto-posting & inbox line filter`
- [x] Build it: `/develop Multi-Number WhatsApp System: multi-session Linked Device switcher, per-number group/status & chat attribution, multi-line auto-posting & inbox line filter`
  - [x] Milestone 1: Multi-Session Linked-Device engine, per-line Status/Group attribution, per-line `whatsappAccounts` mapping & Server Actions (`lib/whatsapp/linked-device.ts`, `lib/validations/whatsapp-linked-device.ts`, `app/actions/whatsapp-linked-device.ts`, `trigger/send-whatsapp-group-campaign.task.ts`)
  - [x] Milestone 2: Multi-Number Linked-Device Switcher UI (`components/admin/whatsapp/whatsapp-linked-device-card.tsx`) with `+ Add WhatsApp Number`, per-slot QR/Pairing Code, slot deletion & `Sync All Connected Lines`
  - [x] Milestone 3: Multi-Number Campaigns Hub (Tab 2 Phone Line Filter, per-card phone badge, Sender Line Routing selector & Tab 3 Broadcast WABA Number selector) (`components/admin/hubs/campaigns-hub-client.tsx`, `components/admin/campaigns/whatsapp-broadcast-drawer.tsx`)
  - [x] Milestone 4: Multi-Number Desk Shared Inbox (Phone Line Filter pills, conversation card & header line badges, per-line outbound reply routing) & automated test suite (`components/admin/hubs/desk-hub-client.tsx`, `app/admin/(dashboard)/desk/page.tsx`, `app/actions/whatsapp-crm.ts`, `tests/whatsapp-multi-number-system.test.ts`)
- [x] Verify it: `/check verify Multi-Number WhatsApp System: multi-session Linked Device switcher, per-number group/status & chat attribution, multi-line auto-posting & inbox line filter` ([whatsapp-multi-number-system.test.ts](tests/whatsapp-multi-number-system.test.ts))
- [x] Test it: `/test Multi-Number WhatsApp System: multi-session Linked Device switcher, per-number group/status & chat attribution, multi-line auto-posting & inbox line filter` ([whatsapp-multi-number-system.test.ts](tests/whatsapp-multi-number-system.test.ts))

## Slice 42: Production-Ready De-Clutter & Dynamic Data Overhaul: purge all demo seeds/presets, 100% dynamic WhatsApp phone linking, simplified Settings/Campaigns/Inbox UI & dynamic public/admin pages

### 46. Production-Ready De-Clutter & Dynamic Data Overhaul: purge all demo seeds/presets, 100% dynamic WhatsApp phone linking, simplified Settings/Campaigns/Inbox UI & dynamic public/admin pages · done · Beta

Eliminate all demo/mock database rows, hardcoded phone numbers, preset loaders, developer jargon banners, and UI filter clutter across `web/app/admin/(dashboard)/*` and `web/app/*`:
1. **Live Database & `db/seed.ts` Demo Purge**: Purge all fake seeded applications (`Barrister Adil...`), fake outreach contacts (`Brig. Tariq...`), fake suppliers (`Ammaar`, `Upsky`, `Zahoor`), fake flyers/post assets, fake `whatsapp_accounts` (`linked-default`, `linked-secondary`, demo `Al Ramlah Primary`), unlinked `whatsapp_linked_device_sessions`, and fake `whatsapp_auto_reply_rules` / `whatsapp_quick_replies` from Neon PostgreSQL and `db/seed.ts`.
2. **100% Dynamic WhatsApp Phone Linking & De-Cluttered Settings/Campaigns/Inbox**:
   - Remove `DEFAULT_LINKED_DEVICE_SLOTS` and hardcoded phone numbers (`0321-4629700`, `0319-8463538`) from `lib/whatsapp/linked-device.ts` and UI components; start with 0 phones when unlinked and dynamically read phone numbers & names from WhatsApp upon QR/Pairing Code connection.
   - Filter `platformType === "LINKED_DEVICE"` out of Meta Cloud API WABA Settings in `/admin/settings?tab=whatsapp`, remove the `"Purge 36 Mock Channels"` button and `"Meta Error #1690130"` wall-of-text card, and streamline Settings into two clean sections (Connected WhatsApp Phones vs. Official Meta Cloud API).
   - Remove the duplicated giant `<WhatsappLinkedDeviceCard />` and `"36 placeholder groups purged"` banner from `/admin/campaigns?tab=whatsapp`, replacing it with a compact dynamic **Connected Phone Status Bar** (`Connect in Settings` / `Sync Groups`) and 100% dynamic Sender Line options.
   - Simplify `/admin/desk?tab=inbox` from 5 stacked filter rows (18 buttons) to **1 search bar + 1 clean status row** (`All`, `Unread`, `Pinned`, `Archived`) + a dynamic **Phone Line dropdown** when connected.
   - Make `triggerQuotingCopilotAction` execute `runQuotingCopilot` directly inline so **AI Quoting Copilot** returns estimates immediately instead of hanging at `25%`, remove hardcoded preset loaders & simulator clutter from `whatsapp-auto-reply-studio.tsx`, remove `Test Sample Sheet/Single` demo buttons from `studio-hub-client.tsx`, and strip internal tool jargon (`WaCRM`, `Postiz`, `Gotenberg`, `Trigger.dev v4 Realtime`, `HUB 1–4`) from all Admin screens.
3. **Dynamic Public Pages & Centralized `lib/company-info.ts`**: Create `lib/company-info.ts` (`getCompanyInfo(settings)`), make `/privacy` and `/terms` query `agency_settings` dynamically, fix the `planner-context.tsx` visa rate fallback (`68000`), and wire dynamic agency contact props across all public components.
**Done when:** spec `0023` is captured, all demo DB rows are purged, Admin and Public pages are 100% dynamic and decluttered, and `npm run typecheck` + tests pass.
spec [0023](docs/specs/0023-production-declutter-and-dynamic-overhaul.md) · code in `lib/whatsapp/linked-device.ts`, `lib/company-info.ts`, `components/admin/whatsapp/whatsapp-linked-device-card.tsx`, `components/admin/hubs/connections-settings-client.tsx`, `components/admin/hubs/campaigns-hub-client.tsx`, `components/admin/hubs/desk-hub-client.tsx`

- [x] Design it (spec): `/architect Production-Ready De-Clutter & Dynamic Data Overhaul: purge all demo seeds/presets, 100% dynamic WhatsApp phone linking, simplified Settings/Campaigns/Inbox UI & dynamic public/admin pages`
- [x] Build it: `/develop Production-Ready De-Clutter & Dynamic Data Overhaul: purge all demo seeds/presets, 100% dynamic WhatsApp phone linking, simplified Settings/Campaigns/Inbox UI & dynamic public/admin pages`
  - [x] Milestone 1: Live Neon DB & `db/seed.ts` demo purge + 100% dynamic `lib/whatsapp/linked-device.ts` & inline `app/actions/quoting-copilot.ts`
  - [x] Milestone 2: De-cluttered Admin Portal (`/admin/settings`, `/admin/campaigns`, `/admin/desk`, `/admin/studio`, `/admin`) & updated unit tests
  - [x] Milestone 3: Centralized `lib/company-info.ts` & 100% dynamic Public Pages (`/`, `/privacy`, `/terms`, `hajj-inquiry-section.tsx`, `contact-section.tsx`, `public-header.tsx`, `public-footer.tsx`, `planner-context.tsx`)
- [x] Verify it: `/check verify Production-Ready De-Clutter & Dynamic Data Overhaul: purge all demo seeds/presets, 100% dynamic WhatsApp phone linking, simplified Settings/Campaigns/Inbox UI & dynamic public/admin pages` ([whatsapp-multi-number-system.test.ts](tests/whatsapp-multi-number-system.test.ts))
- [x] Test it: `/test Production-Ready De-Clutter & Dynamic Data Overhaul: purge all demo seeds/presets, 100% dynamic WhatsApp phone linking, simplified Settings/Campaigns/Inbox UI & dynamic public/admin pages` ([whatsapp-multi-number-system.test.ts](tests/whatsapp-multi-number-system.test.ts))

## Slice 43: Spec 0024 — Production Readiness Audit & Hardening

### 47. Slice 43 · Spec 0024 — Production Readiness Audit & Hardening · Beta · done

Remediate all `P0` (`96`) and `P1` (`179`) production-readiness gaps uncovered across the 28-report Wave 0–1 forensic audit (`docs/audit/00-ground-truth.md`, `01-feature-parity.md`, `02-triage.md`, `OWNER_DECISIONS.md`) through the conflict-free 12-Fixer Wave 3 build plan (`docs/audit/02-ownership.md`: `W3A → W3B → W3C`) and certify 100% of Gate A (§9.4) criteria across real disposable PostgreSQL 16, local HTTP contract fakes, and Playwright `J1`–`J22` browser journeys.
**Done when:** `100%` of `P0`/`P1` findings in `docs/audit/02-triage.md` are resolved with red→green tests logged in `docs/audit/03-fix-log.md`, `npm audit --omit=dev` has `0` Critical/High CVEs, fresh `db:migrate` + `2× db:seed` pass with zero schema drift, the 158-action AuthZ auto-runner and all 22 Playwright E2E journeys (`J1`–`J22`) pass on Desktop & Mobile, `.github/workflows/ci.yml` and `docs/audit/runbooks/RB-01..10.md` are in place, and Wave 4 (`V01`–`V06`) signs off `docs/audit/PRODUCTION_READINESS.md` (Gate A).
spec [0024](docs/specs/0024-production-readiness-audit-and-hardening.md) · audit & ownership in `docs/audit/`

- [x] Design it (spec): `/architect Production Readiness Audit & Hardening`
- [x] Build it: `/develop Production Readiness Audit & Hardening`
  - [x] Milestone 1 (`W3A` — `F-PLAT`): Serialized platform foundation — `next@16.4.6+` CVE upgrade, `Dockerfile` `node:22-alpine` + `HEALTHCHECK`, fail-closed `lib/env.ts`, CSP/security headers, dual HTTP + transactional `Pool` `db/index.ts`, reconciled `drizzle/` migrations + `2×` idempotent `db/seed.ts`, `disableSignUp` + live `isActive` RBAC revocation, DB `rate_limit_buckets`, immutable `audit_logs`, zero-PII `lib/logger.ts`, `/api/health`, and locked light-mode WCAG tokens
  - [x] Milestone 2 (`W3B` Core — `F-DOM`, `F-INFRA`, `F-PUB`, `F-DESK`): 9 business invariants, unified E.164/JID phone SSoT, committed client PDF purge & `logo-icon.png` compression, public/private R2 split + `/api/media/*` proxy, Gotenberg v8 `/screenshot/html` fix & CDP prod block, Journey Builder/Group seat race/Hajj/Status Tracker hardening, SQL Dashboard KPIs, Quote state machine, escaped `<1 MB` Quotation PDF, gated Voucher & `Cmd+K` fixes
  - [x] Milestone 3 (`W3B` Omnichannel & Admin — `F-STUDIO`, `F-WA`, `F-SOCIAL`, `F-JOBS`, `F-ADMIN`, `F-UX`): Escaped 4K poster HTML & Mode A/B margin integrity, deterministic AI Copilot math + ZDR, retry-safe WA webhook + global `"STOP"`/`do_not_contact` + 24h window + `OD-01` Baileys topology, Core 5 OAuth/Page-token refresh/IG container poll/GBP v1 + zero fake analytics, Trigger v4 prod guard + `rethrowAsTaskError` + SLA cron fix, FK-safe Catalog/CMS `revalidatePath` + `/admin/settings?tab=health` + fixed legacy redirects, and WCAG 2.2 AA Admin Shell
  - [x] Milestone 4 (`W3C` — `F-QA`): `vitest.config.ts` (`assertAuditSafeEnvironment` + `disableNetConnect`), 5 strict contract fakes (`tests/fakes/*`), real-PG `tests/integration/*` (158-action AuthZ auto-runner + concurrency + migrations), Playwright `tests/e2e/j01..j22.spec.ts`, `.github/workflows/ci.yml`, and 10 ops runbooks (`docs/audit/runbooks/RB-01..10.md`)
- [x] Verify it: `/check verify Production Readiness Audit & Hardening` (`docs/audit/04-verification.md` & `docs/audit/PRODUCTION_READINESS.md`)
- [x] Test it: `/test Production Readiness Audit & Hardening` (`tests/unit/`, `tests/integration/`, `tests/e2e/`)

## Slice 44: Spec 0025 — Public Site SEO, GEO & Attribution Readiness

### 48. Slice 44 · Spec 0025 — Public Site SEO Readiness · Beta · done

Execute Phase B (`SWARM_PROMPT.md` §10: Auditors `S01`–`S16` → Fixers `F-SEO-*` → Gate B) **strictly after Slice 43 (`Spec 0024`) passes Gate A**: remediate all `31` canonical items (`SEO-001`–`SEO-031`, consolidated from `88` raw findings across `S01.md`–`S16.md`, baseline score `54.5/100` Grade `D`) to achieve `>= 90/100` (Grade `A`) and `100%` Gate B (`GB-01`–`GB-08`) certification across `app/robots.ts`, `app/sitemap.ts`, `public/llms.txt`, `app/opengraph-image.tsx`, 19 indexable public route patterns (`/`, `/umrah-packages`, `/umrah-packages/[slug]`, `/umrah-packages/from-{lahore,karachi,islamabad}`, `/hajj-2027`, `/umrah-visa`, `/hotels/{makkah,madinah}`, `/ziyarat`, `/ziyarat/{makkah,madinah}`, `/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/refund-policy`), penalty-free JSON-LD (`TravelAgency`, `WebSite`, `TouristTrip`/`Offer`, `FAQPage`, `BreadcrumbList`), wholesale-SAR-confidential DTOs, `<Suspense>` URL prefill, and 7-column first-touch UTM attribution.
**Done when:** `100%` of `SEO-001`–`SEO-031` items in `docs/audit/seo/02-seo-triage.md` are resolved and logged in `docs/audit/seo/03-seo-fix-log.md`, `nextjs_seo_geo_cli.py score-report` reaches `>= 90.0 / 100`, all Phase B routes/metadata/schemas/attribution ship with zero Gate A regressions (`J1`–`J23` green), and Wave 7 signs off Gate B (`GB-01`–`GB-08`).
spec [0025](docs/specs/0025-public-site-seo-readiness.md) · code in `lib/seo/`, `app/(public)/`, `components/seo/` · audit & verification in `docs/audit/seo/` & `docs/audit/SEO_READINESS.md`

- [x] Design it (spec): `/architect Public Site SEO Readiness` (`docs/audit/seo/baseline/*`, `S01`–`S16`, `02-seo-triage.md`, `02-seo-ownership.md`, `docs/specs/0025-public-site-seo-readiness.md`)
- [x] Build it: `/develop Public Site SEO Readiness`
  - [x] Milestone 1 (`Wave 6A` — `F-SEO-PLAT` serialized foundation): `drizzle/0003_seo_lead_attribution.sql` (7 attribution columns on `applications` & `contact_messages`), rolling PKT `db/seed.ts` refresh, `lib/seo/{metadata,json-ld,og-card,utm,slugs,public-queries,revalidate-public}.ts` (wholesale SAR stripped DTOs), `components/layout/breadcrumbs.tsx`, canonical apex `https://alramlahtravels.com` + E.164 NAP/`formatPkr` sync, `app/robots.ts`, `app/sitemap.ts`, `public/llms.txt`, `app/opengraph-image.tsx`, `app/admin/layout.tsx`, `/voucher/[token]` `forbidden()` `403`, and `proxy.ts` `X-Robots-Tag` (`SEO-001`–`003`, `007`–`014`, `027`)
  - [x] Milestone 2 (`Wave 6B` — `4` parallel disjoint `workspace: "share"` fixers): `F-SEO-UMRAH` (`/umrah-packages`, `[slug]` + OG card, `from-{lahore,karachi,islamabad}` `>=50%` gateways), `F-SEO-GUIDES` (`/hajj-2027` `OD-09e`, `/umrah-visa`, `/hotels/{makkah,madinah}`, `/ziyarat/**`), `F-SEO-TRUST` (`/` metadata/LCP/RSC, `/about`, `/contact`, `/faq` AI fan-out, `/privacy` §3 + legal upgrades), and `F-SEO-SHELL` (`<UtmTracker />`, crawlable `PublicHeader`/`PublicFooter`, `<Suspense>` `PlannerProvider` URL prefill, 4 lead Server Actions + `cms.ts` delegation, Admin Dossier/Messages/CSV attribution badges) (`SEO-004`–`006`, `015`–`025`, `028`–`031`)
  - [x] Milestone 3 (`Wave 6C` — `F-SEO-QA` serialized harness): Unified `tests/seo/**` CTR/canonical/JSON-LD/Jaccard differentiation suite, real-PG `tests/integration/seo-utm-attribution.integration.test.ts`, Playwright `tests/e2e/j23-seo-crawl-and-attribution.spec.ts`, post-fix `>= 90/100` CLI score report (`90.2/100` Grade `A`), and `docs/audit/seo/03-seo-fix-log.md` (`SEO-026`)
- [x] Verify it: `/check verify Public Site SEO Readiness` (`Wave 7` Gate B `GB-01`–`GB-08` sign-off in `docs/audit/seo/04-seo-verification.md` & `docs/audit/SEO_READINESS.md`)
- [x] Test it: `/test Public Site SEO Readiness` (`tests/seo/`, `tests/integration/seo-utm-attribution.integration.test.ts`, `tests/e2e/j23-seo-crawl-and-attribution.spec.ts`)

## Slice 45: Unified CDD, Design System & Spec-Driven Engineering

### 49. Slice 45 · Unified CDD, Design System (`DESIGN.md` + `PRODUCT.md`) & Spec-Driven Engineering · done

Establish the full multi-harness Context-Driven Development (CDD), Design-Driven Development (`hallmark` + `impeccable` + `awesome-design-md`), and Spec-Driven Development (`jsmastery-skills` + `awesome-spec-driven-development`) foundation across the workspace and `web/`.
**Done when:** all 5 reference repos are cloned into `services/`, all 28 skills are canonically installed in `web/.agents/skills/` and mounted via `.agents/skills.json`, multi-harness MCP configs resolve cleanly, `DESIGN.md` (Stitch YAML + 8 sections) & `PRODUCT.md` are synced to `app/globals.css`, 7 nested `<area>/AGENTS.md` files are live, and `npm run cdd:check` (`scripts/verify-cdd.mjs`) exits `0` across all 7 governance gates.
code in `AGENTS.md`, `DESIGN.md`, `PRODUCT.md`, `.agents/skills/`, `docs/CONSTITUTION.md`, `docs/INDEX.md`, `scripts/verify-cdd.mjs`

- [x] Capture conventions + tooling choices: `/audit`
- [x] Build it: `/develop Unified CDD & SDD System`
  - [x] Milestone 1: Clone `hallmark`, `impeccable`, `awesome-design-md`, `jsmastery-skills`, and `awesome-spec-driven-development` into `services/`; install all 28 canonical skills in `web/.agents/skills/` mounted via `.agents/skills.json`; fix multi-harness `trigger` MCP config (`.mcp.json`, `web/.mcp.json`, `.gemini/settings.json`, `.agents/plugins/al-ramlah-workspace/`)
  - [x] Milestone 2: Upgrade `web/DESIGN.md` (Stitch YAML frontmatter + 8 canonical sections synced to `app/globals.css` & 4-Hub Admin IA) and author `web/PRODUCT.md` (`impeccable:product-schema 1`) + workspace-root mirrors
  - [x] Milestone 3: Author 7 progressive nested `<area>/AGENTS.md` (+ `CLAUDE.md`) files (`app/(public)`, `app/admin`, `components`, `db`, `lib/whatsapp`, `lib/social`, `trigger`) and reconcile root + `web/AGENTS.md`
  - [x] Milestone 4: Author `docs/CONSTITUTION.md`, `docs/INDEX.md`, `docs/specs/_TEMPLATE.md`, `test-preferences.json`, and deterministic governance verifier `scripts/verify-cdd.mjs` (`npm run cdd:check`)
- [x] Check it runs clean: `/check verify Unified CDD & SDD System` (`npm run cdd:check`)

## Slice 46: Spec 0026 — Home Page Editorial Redesign & Public Motion Architecture

### 50. Slice 46 · Spec 0026 — Home Page Editorial Redesign & Public Motion Architecture · Beta · done

Integrate `lenis` (`lenis/react`), `gsap` + `@gsap/react` (`ScrollTrigger`, `useGSAP`, `gsap.matchMedia`), and `motion` + `framer-motion` under a single-RAF public storefront provider (`app/(public)/layout.tsx`), mount official Motion/GSAP/Lenis agent skills + `https://mcp.motion.dev`, and right-size all Home Page (`/`) sections around the strictly untouched `Design Your Custom Umrah Pilgrimage` (`#journey-builder` / `components/planner/**`) centerpiece (`~25,930 px` → `~12,000 px`).
**Done when:** `components/planner/**` has `0` modified lines, `Lenis` + `GSAP` + `Motion` run smoothly at 60fps with Base UI portal scroll isolation and `prefers-reduced-motion: reduce` + SSR visibility safety (`sloplint` Gate `62`), Group Umrah uses an equal-height horizontal carousel free of flyer text collisions, Hajj 2027 uses a 4-column Maktab row + 2-column tabbed readiness/form split, duplicate Section `6B` rules table is consolidated without losing `GB-06` SEO link parity, and `npm run ui:lint`, `npm test` (`.env.audit`), Playwright `J1`–`J5` & `J23`, and `npm run cdd:check` all pass.
spec [0026](docs/specs/0026-home-page-redesign-and-motion-architecture/index.md) · code in `components/motion/`, `app/(public)/`, `components/public/`, `components/seo/`

- [x] Design it (spec): `/architect Home Page Editorial Redesign & Public Motion Architecture` ([0026](docs/specs/0026-home-page-redesign-and-motion-architecture/index.md))
- [x] Build it: `/develop Home Page Editorial Redesign & Public Motion Architecture`
  - [x] Milestone 1 (`M1` Runtime & Shell): Install `lenis`, `gsap`, `@gsap/react`, `motion`, `framer-motion`; build `components/motion/*` (`gsap-registry.ts`, `public-motion-provider.tsx` with `gsap.ticker` single-RAF + Base UI `prevent` guard, `haramain-reveal.tsx`) and wire `app/(public)/layout.tsx` + `app/globals.css`
  - [x] Milestone 2 (`M2` Hero & Group Packages): Luminous single-eyebrow `HeroSlider` (`useGSAP` entrance + interactive slide tabs) and equal-height horizontal Embla `GroupPackagesSection` (`Motion` `layoutId` pills, flyer-safe banners, compact hotel-tier badge, intact modal booking)
  - [x] Milestone 3 (`M3` Hajj 2027 & Status Tracker): 4-column `HajjInquirySection` Maktab row + 2-column `Motion`-tabbed Readiness & `#hajj-reservation-card` split (`OD-09e`), plus inline horizontal `StatusTracker` bar with `AnimatePresence` dossier reveal
  - [x] Milestone 4 (`M4` Lower Storefront & Page Composition): Remove duplicate Section `6B` rules table in `app/(public)/page.tsx` (keeping `#journey-builder` untouched), merge spoke links into `TrustHomeOverview`, and upgrade `MarketingSections` (GSAP 4-Step Timeline, Makkah/Madinah tabbed Ziyarat 6-card showcase, 2-col `keepMounted` FAQ) + `ContactSection`
- [x] Verify it: `/check verify Home Page Editorial Redesign & Public Motion Architecture` ([verify.md](docs/specs/0026-home-page-redesign-and-motion-architecture/verify.md))
- [x] Test it: `/test Home Page Editorial Redesign & Public Motion Architecture` (`tests/unit/home-motion-and-proportion.test.ts`, `tests/unit/home-public-sections.test.ts`, `tests/seo/gate-b-seo-invariants.test.ts`, `tests/e2e/j01-j05-public-pilgrim.spec.ts`, `tests/e2e/j23-seo-crawl-and-attribution.spec.ts`)

## Slice 47: Secondary Public Hubs, Spokes & Shell Editorial Alignment

### 51. Slice 47 · Secondary Public Hubs, Spokes & Shell Editorial Alignment · Beta · done

Bring all 14 remaining public hub, guide, trust, and policy pages (`/umrah-packages`, `/umrah-packages/from-[city]`, `/umrah-packages/[slug]`, `/umrah-visa`, `/hajj-2027`, `/hotels/[city]`, `/ziyarat`, `/ziyarat/[city]`, `/about`, `/faq`, `/contact`, `/terms`, `/privacy`, `/refund-policy`) plus shared public header, footer, and SEO comparison blocks up to the Home Page editorial layout, semantic token, focus ring, and reduced motion bar while keeping `components/planner/**` and `/voucher/[token]` untouched.
**Done when:** every non voucher public page and shared shell or SEO block uses semantic Haramain design tokens with zero `ui:lint` failures across `app/(public)` (excluding `/voucher`), `components/public`, and `components/seo`, preserves `100%` of public SEO metadata, structured data, wholesale SAR redaction, and inbound link invariants, keeps `components/planner/**` and `/voucher/[token]` untouched, and passes accessibility and automated checks.
spec [0027](docs/specs/0027-public-storefront-editorial-alignment/index.md) · code in `lib/constants/brand.ts`, `components/public/`, `components/layout/`, `components/seo/`, `app/(public)/`

- [x] Design it (spec): `/architect Secondary Public Hubs, Spokes & Shell Editorial Alignment` ([0027](docs/specs/0027-public-storefront-editorial-alignment/index.md))
- [x] Build it: `/develop Secondary Public Hubs, Spokes & Shell Editorial Alignment`
  - [x] Milestone 1 (`M1` Shared Hero, Shell & Modal): Land `LIVE_RATE_CONFIRMATION_LABEL` in `lib/constants/brand.ts` and `PublicPageHero` in `components/public/public-page-hero.tsx`, then align `public-header.tsx`, `public-footer.tsx`, `breadcrumbs.tsx`, `whatsapp-fab.tsx`, and `group-booking-modal.tsx` (`AC-1`..`AC-3`, `AC-7`, `AC-8`)
  - [x] Milestone 2 (`M2` Umrah Hubs, City Gateways & Package Detail): Align `/umrah-packages`, `/umrah-packages/from-[city]`, `/umrah-packages/[slug]`, and `components/seo/umrah-*` (`AC-1`, `AC-2`, `AC-4`, `AC-7`..`AC-9`)
  - [x] Milestone 3 (`M3` Sacred Guides & Destination Spokes): Align `/umrah-visa`, `/hajj-2027`, `/hotels/[city]`, `/ziyarat`, `/ziyarat/[city]`, and `components/seo/guides-*` (`AC-1`, `AC-2`, `AC-5`, `AC-7`..`AC-9`)
  - [x] Milestone 4 (`M4` Trust, Support & Policy Spokes): Align `/about`, `/faq`, `/contact`, `/terms`, `/privacy`, `/refund-policy`, `trust-eeat-credentials.tsx`, and `trust-legal-crosslinks.tsx` (`AC-1`, `AC-2`, `AC-6`..`AC-9`)
- [x] Verify it: `/check verify Secondary Public Hubs, Spokes & Shell Editorial Alignment` ([verify.md](docs/specs/0027-public-storefront-editorial-alignment/verify.md) · [2026-11-21-main.md](docs/reviews/2026-11-21-main.md))
- [x] Test it: `/test Secondary Public Hubs, Spokes & Shell Editorial Alignment` ([public-storefront-alignment.test.ts](tests/unit/public-storefront-alignment.test.ts))

## Slice 48: Admin 4 Hub Operate Surface and Shell Alignment

### 52. Slice 48 · Admin 4 Hub Operate Surface and Shell Alignment · Beta · done

Bring the Admin `Operate` surface (`/admin`, `/admin/studio`, `/admin/campaigns`, `/admin/desk`, `/admin/catalog`, `/admin/settings`, `/admin/login`), shared admin shell (`admin-sidebar.tsx`, `admin-topbar.tsx`, `command-palette.tsx`), and admin feature views up to the semantic Haramain design system, keyboard focus floor, and clean React hook rules.
**Done when:** every admin route, shell component, and admin hub view uses semantic Haramain light tokens with zero `ui:lint` failures across `app/admin` and `components/admin` plus `components/layout/{admin-sidebar,admin-topbar,command-palette}.tsx`, clears React hook `setState` effect warnings on touched admin components, preserves all role guards, wholesale cost redaction for staff, Kanban drag interactions, and existing admin test contracts, and passes accessibility and automated checks.
spec [0028](docs/specs/0028-admin-operate-surface-alignment/index.md) · code in `app/globals.css`, `lib/constants/admin-labels.ts`, `app/admin/`, `components/admin/`, `components/layout/`

- [x] Design it (spec): `/architect Admin 4 Hub Operate Surface and Shell Alignment` ([0028](docs/specs/0028-admin-operate-surface-alignment/index.md))
- [x] Build it: `/develop Admin 4 Hub Operate Surface and Shell Alignment`
  - [x] Milestone 1 (`M1` Status Tokens, Labels, Shell, Overview & Dossiers): Land `--status-*` / `--color-status-*` tokens in `app/globals.css` and `lib/constants/admin-labels.ts`, then align `admin-sidebar.tsx`, `admin-topbar.tsx`, `command-palette.tsx`, `status-badge.tsx`, `/admin/login`, `/admin`, and non voucher `applications/*` (`AC-1`..`AC-4`, `AC-8`..`AC-10`)
  - [x] Milestone 2 (`M2` Desk Hub, Kanban Board & WhatsApp Modals): Align `/admin/desk`, `desk-hub-client.tsx`, `applications-kanban-board.tsx`, `copilot-realtime-run-banner.tsx`, `meta-template-builder-modal.tsx`, `whatsapp-auto-reply-studio.tsx`, and `whatsapp-linked-device-card.tsx` (`AC-1`, `AC-5`, `AC-8`..`AC-10`)
  - [x] Milestone 3 (`M3` Campaigns Hub, Social Calendar, Previewer & Broadcasts): Align `/admin/campaigns`, `campaigns-hub-client.tsx`, and `components/admin/campaigns/*` (`AC-1`, `AC-6`, `AC-8`..`AC-10`)
  - [x] Milestone 4 (`M4` Studio, Marketing Ops, Catalog & Settings Hubs): Align `/admin/studio`, `/admin/catalog`, `/admin/settings`, `studio-hub-client.tsx`, `catalog-hub-client.tsx`, `connections-settings-client.tsx`, `studio-realtime-run-banner.tsx`, `components/admin/marketing/*`, `components/admin/catalog/*`, and `components/admin/settings/*` (`AC-1`, `AC-2`, `AC-7`..`AC-10`)
- [x] Verify it: `/check verify Admin 4 Hub Operate Surface and Shell Alignment` ([verify.md](docs/specs/0028-admin-operate-surface-alignment/verify.md) · [2026-11-22-main.md](docs/reviews/2026-11-22-main.md))
- [x] Test it: `/test Admin 4 Hub Operate Surface and Shell Alignment` ([admin-operate-alignment.test.ts](tests/unit/admin-operate-alignment.test.ts) · [j06-j12-admin-desk-quote-studio.spec.ts](tests/e2e/j06-j12-admin-desk-quote-studio.spec.ts))

## Slice 49: Pilgrim Document Upload Portal and Staff Verification

### 53. Slice 49 · Pilgrim Document Upload Portal and Staff Verification · GA · done

Give pilgrims with an approved and deposit verified booking a self service checklist to upload passport bio pages, national ID scans, and visa photos for every adult, child, and infant on the journey, and let staff approve or request a clearer reupload inside the application dossier.
**Done when:** the portal unlocks only when a booking is approved with verified deposit or full payment, pilgrims can open it from a dedicated capability link or from `/#track-status` without creating an account password, every traveller passport slot enforces private storage with short lived signed previews, `noindex` headers, and 60 day post return retention, and consultants can approve or request reuploads per document in `/admin/applications/[id]` with accessible mobile and desktop states.
spec [0029](docs/specs/0029-pilgrim-document-upload-portal/index.md) · code in `db/schema/applications.ts`, `drizzle/0004_pilgrim_document_portal.sql`, `lib/domain/pilgrim-documents.ts`, `lib/validations/pilgrim-documents.ts`, `app/actions/pilgrim-documents.ts`, `app/api/documents/[token]/`, `app/(public)/documents/[token]/`, `components/public/pilgrim-document-portal.tsx`, `components/admin/applications/pilgrim-documents-review-panel.tsx`

- [x] Design it (spec): `/architect Pilgrim Document Upload Portal and Staff Verification` ([0029](docs/specs/0029-pilgrim-document-upload-portal/index.md))
- [x] Build it: `/develop Pilgrim Document Upload Portal and Staff Verification`
  - [x] Milestone 1 (`M1` Schema, Migration `0004`, Domain Rules & Storage Verifier): Add `application_travellers`, `application_documents`, and `documentPortalToken*` columns, domain/Zod helpers, and `512` byte R2 header verifier (`AC-1`..`AC-6`, `AC-9`)
  - [x] Milestone 2 (`M2` Actions, Mailer, Presign & Local Upload Routes, Crawl & Retention): Build `pilgrim-documents.ts` actions, `presign` + `local-upload` routes, `robots.ts` / `proxy.ts` `noindex` guards, 4 way token minting, and `60` day post return purge (`AC-1`..`AC-9`)
  - [x] Milestone 3 (`M3` Public `/documents/[token]` Portal & Status Tracker CTA): Build `/documents/[token]` (`page.tsx`, `forbidden.tsx`, phone session gate, traveller checklist) and `/#track-status` launch button (`AC-1`..`AC-6`, `AC-8`, `AC-10`)
  - [x] Milestone 4 (`M4` Admin Dossier Verification Panel & Dispatch Controls): Build `pilgrim-documents-review-panel.tsx` and wire dossier review, nudges, passenger count edits, and `super_admin` override/rotation controls (`AC-3`, `AC-4`, `AC-6`..`AC-8`, `AC-10`)
- [x] Verify it: `/check verify Pilgrim Document Upload Portal and Staff Verification` ([verify.md](docs/specs/0029-pilgrim-document-upload-portal/verify.md))
- [x] Test it: `/test Pilgrim Document Upload Portal and Staff Verification` ([pilgrim-documents-domain.test.ts](tests/unit/pilgrim-documents-domain.test.ts) · [pilgrim-documents-portal.integration.test.ts](tests/integration/pilgrim-documents-portal.integration.test.ts) · [j24-pilgrim-document-portal.spec.ts](tests/e2e/j24-pilgrim-document-portal.spec.ts))
- [x] Review it (fresh model): `/check review Pilgrim Document Upload Portal and Staff Verification` ([2026-11-22-slice-49.md](docs/reviews/2026-11-22-slice-49.md))
- [x] Document it: `/document Pilgrim Document Upload Portal and Staff Verification` (PR `feat/slices-45-49-ui-and-document-portal`)

## Slice 50: Hybrid Hero Video and Admin Media Uploader

### 54. Slice 50 · Hybrid Hero Video and Admin Media Uploader · Beta · done

Let agency admins upload a mandatory poster image and an optional silent background video directly on each homepage hero slide inside the content catalog, and blend video slides seamlessly with photo slides on the storefront hero without slowing down first frame paint on mobile networks.
**Done when:** admins can upload, preview, reorder, or clear slide images and background videos directly from the content catalog, video slides paint their poster image immediately before crossfading into silent playback, the slider advances cleanly across mixed video and photo slides while pausing off screen clips, reduced motion and data saver modes stay on the poster image, and an accessible pause toggle is available.
spec [0030](docs/specs/0030-hybrid-hero-video-and-uploader/index.md) · code in `db/schema/cms.ts`, `drizzle/0005_hero_slides_video_url.sql`, `lib/storage/`, `app/api/uploads/`, `app/uploads/r2-local/`, `app/actions/cms.ts`, `components/admin/catalog/`, `components/public/hero-slider.tsx`

- [x] Design it (spec): `/architect Hybrid Hero Video and Admin Media Uploader` ([0030](docs/specs/0030-hybrid-hero-video-and-uploader/index.md))
- [x] Build it: `/develop Hybrid Hero Video and Admin Media Uploader`
  - [x] Milestone 1 (`M1` Schema, Migration `0005`, R2 Local Root, Upload RBAC & Commit Cleanup): Add nullable `hero_slides.video_url` + `CHECK` constraint, route local fallback to `os.tmpdir()`, enforce `super_admin` `25 MB` folder guards + streamed `/uploads/r2-local/[...key]`, and add `512` byte magic byte verification + unreferenced R2 cleanup (`AC-1`..`AC-4`)
  - [x] Milestone 2 (`M2` Admin Catalog `HeroSlideDialog` Uploader & Role Aware CMS): Gate all `4` `ContentClient` sub tabs with `canManageCms`, add `Video + Poster` / `Photo Slide` badges, and upgrade `HeroSlideDialog` with drag and drop poster + `MP4` uploaders, live progress, inline preview, `Remove Video`, and uncommitted draft cleanup (`AC-4`, `AC-5`, `AC-9`)
  - [x] Milestone 3 (`M3` Public Hybrid `HeroSlider` Video + Poster Engine): Wire `videoUrl` into `/` (keeping `#journey-builder` untouched) and add post hydration muted `<video>` crossfade, `onEnded` / `20s` cap / `7.5s` stall timing, `useSyncExternalStore` reduced motion & `saveData` fallback, off screen `.pause()`, and `44x44px` `Pause` / `Play` toggle (`AC-6`..`AC-9`)
  - [x] Milestone 4 (`M4` Unit, Hermetic Integration & Playwright `J25` Suite): Lock SSR, timing, `AbortError` vs `onError`, RBAC `403`, `512` byte polyglot `422`, `0` ref R2 delete guards, and `J25` upload to playback + Axe WCAG 2.2 AA (`AC-1`..`AC-9`)
- [x] Verify it: skipped local Docker DB steps per owner direction; static, unit, and live storefront probes passed ([verify.md](docs/specs/0030-hybrid-hero-video-and-uploader/verify.md))
- [x] Test it: `/test Hybrid Hero Video and Admin Media Uploader` ([hero-slider-hybrid-video.test.tsx](tests/unit/hero-slider-hybrid-video.test.tsx) · [hero-slides-media-upload.integration.test.ts](tests/integration/hero-slides-media-upload.integration.test.ts) · [j25-hybrid-hero-video.spec.ts](tests/e2e/j25-hybrid-hero-video.spec.ts))

## Slice 51: End-to-End Umrah Package Lifecycle & Storefront Redesign

### 55. Slice 51 · End-to-End Umrah Package Lifecycle & Storefront Redesign · Beta · done

Separate public website package cover photography from internal 4K marketing posters, turn `/admin/studio` into a Package-First `Operate` workbench with a 3-step Slide-Over Package + Multi-City Batch Builder, and redesign `/umrah-packages`, `/umrah-packages/from-[city]`, `/umrah-packages/[slug]`, and Homepage `#packages` with an interactive Visual Explorer and a Live Sticky Family Calculator.
**Done when:** `group_packages` isolates `cover_image_url` from `internal_poster_url` (`0%` poster serialization on public pages), `/admin/studio` defaults to a scannable package/batch workbench with 1-click batch cloning and atomic multi-batch creation, `/umrah-packages` and `/from-[city]` render interactive visual cards with live occupancy price switching and matrix toggle, `/umrah-packages/[slug]` provides inline family reservation without double-modal friction, and all `ui:lint`, SEO, hermetic unit/integration, Playwright E2E (`J26`), and `cdd:check` gates pass.
spec [0031](docs/specs/0031-umrah-package-lifecycle-and-storefront-redesign/index.md) · code in `db/schema/packages.ts`, `drizzle/0006_group_package_media_split.sql`, `app/actions/groups.ts`, `app/actions/marketing-ops.ts`, `lib/seo/public-queries.ts`, `app/admin/(dashboard)/studio/`, `components/admin/studio/`, `app/(public)/umrah-packages/`, `components/public/`, `components/seo/`

- [x] Design it (spec): `/architect End-to-End Umrah Package Lifecycle & Storefront Redesign` ([0031](docs/specs/0031-umrah-package-lifecycle-and-storefront-redesign/index.md))
- [x] Build it: `/develop End-to-End Umrah Package Lifecycle & Storefront Redesign`
  - [x] Milestone 1 (`M1` Schema `0006`, Media Split & Atomic Group Actions): Add `cover_image_url` + `internal_poster_url`, migration `0006`, `upsertGroupPackageWithBatches`, `cloneGroupDepartureBatch`, Studio poster isolation, and `resolvePublicPackageVisuals()` (`AC-1`, `AC-2`, `AC-9`)
  - [x] Milestone 2 (`M2` Admin `/admin/studio` Package-First Workbench & 3-Step Slide-Over): Build `package-workbench-client.tsx` and `package-builder-sheet.tsx` and align `studio/page.tsx` + `studio-hub-client.tsx` (`AC-3`, `AC-4`, `AC-10`)
  - [x] Milestone 3 (`M3` Shared `UmrahPackageCard`, `UmrahPackagesExplorer`, Hub, City Spokes & Home Sync): Build `umrah-package-card.tsx` and `umrah-packages-explorer.tsx` and wire `/umrah-packages`, `/from-[city]`, and `/` `GroupPackagesSection` (`AC-5`, `AC-6`, `AC-9`, `AC-10`)
  - [x] Milestone 4 (`M4` `/umrah-packages/[slug]` Sanctuary Showcase, Timeline & Live Sticky Family Calculator): Upgrade `[slug]/page.tsx`, `umrah-departures-schedule.tsx`, and `umrah-package-booking-cta.tsx` (`AC-7`, `AC-8`, `AC-9`, `AC-10`)
- [x] Verify it: `/check verify End-to-End Umrah Package Lifecycle & Storefront Redesign` ([verify.md](docs/specs/0031-umrah-package-lifecycle-and-storefront-redesign/verify.md) · [2026-11-27-slice-51.md](docs/reviews/2026-11-27-slice-51.md))
- [x] Test it: `/test End-to-End Umrah Package Lifecycle & Storefront Redesign` ([umrah-lifecycle-and-explorer.test.tsx](tests/unit/umrah-lifecycle-and-explorer.test.tsx) · [group-package-lifecycle.integration.test.ts](tests/integration/group-package-lifecycle.integration.test.ts) · [j26-umrah-lifecycle-and-storefront.spec.ts](tests/e2e/j26-umrah-lifecycle-and-storefront.spec.ts))

## Deferred

Out of scope for the current build pass, kept so the plan stays honest.

- **Online card payment gateway**: collect online credit card or bank checkout payments directly on the website · needs a decision · GA
- **Passport MRZ text pre fill**: optional OCR pre fill of passport numbers and expiry dates on the pilgrim document checklist (from spec 0029) · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
| --- | --- | --- |
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow-up enrolled |
| `in-progress` (building) | `/develop` | milestone sub-boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre-workflow) and `dropped` (de-scoped, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag = inherits it.
- **Workflow tier tag** beside a heading (e.g. `· GA`, `· Prototype`) sets that one feature's rigor above or below the project default; no tag inherits the default. It decides the feature's check boxes and each skill's next suggestion.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing (trust develop's own build time self check); **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
