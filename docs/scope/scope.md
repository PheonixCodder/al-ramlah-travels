# Scope: Al Ramlah Travels

A full stack Hajj and Umrah travel platform for Al Ramlah Travels that lets pilgrims configure custom journeys or book group packages online, and gives agency admins a live quoting CRM, dynamic inventory manager, and analytics portal.

**Build approach:** Tracer Bullet (vertical slices where each feature is built end to end through PostgreSQL, Drizzle ORM, Server Actions, and UI).
**Workflow:** Alpha (after develop, run check verify on the real running app). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

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

## Deferred

Out of scope for the current build pass, kept so the plan stays honest.

- **Online card payment gateway**: collect online credit card or bank checkout payments directly on the website · needs a decision · GA
- **Pilgrim document upload portal**: self service passport scan and photo upload after quote approval · needs a decision

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
