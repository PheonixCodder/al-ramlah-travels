# Scope: Al Ramlah Travels

A full stack Hajj and Umrah travel platform for Al Ramlah Travels that lets pilgrims configure custom journeys or book group packages online, and gives agency admins a live quoting CRM, dynamic inventory manager, and analytics portal.

**Build approach:** Tracer Bullet (vertical slices where each feature is built end to end through PostgreSQL, Drizzle ORM, Server Actions, and UI).
**Workflow:** Alpha (after develop, run check verify on the real running app). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
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
Define the single luxury Haramain Emerald, Warm Ivory, and Metallic Gold theme matched to `public/logo-icon.png` in `design.md` and `app/globals.css`, plus shared public and admin shell layouts.
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

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **Online card payment gateway**: collect online credit card or bank checkout payments directly on the website · needs a decision · GA
- **Pilgrim document upload portal**: self service passport scan and photo upload after quote approval · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
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
