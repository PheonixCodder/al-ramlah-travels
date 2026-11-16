<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Al Ramlah Travels

## Stack

- **Language / Runtime**: TypeScript 5, Node 22+ LTS
- **Framework**: Next.js 16.4.6+ (App Router, `output: "standalone"`), React 19.2.8 (deployed on Vercel / Docker Standalone)
- **Database & ORM**: PostgreSQL 16 — dual-driver Drizzle ORM (`drizzle-orm`, `drizzle-kit`) over Neon Serverless (`@neondatabase/serverless`) in production and `node-postgres` (`pg.Pool`) for local Docker & CI (`48` tables, `47` enums, `17` SQL `CHECK` constraints, append-only `audit_logs` immutability trigger)
- **Authentication & Security**: Better Auth (`better-auth`) with disabled public sign-up (`403`), live DB `isActive` session revocation (`super_admin` and `staff` roles), PostgreSQL `rate_limit_buckets`, `v2:` HKDF-AES-256-GCM secret vault (`lib/security/vault.ts`), and PII-redacted structured logger (`lib/logger.ts`)
- **Validation & UI**: Zod (`zod`), Tailwind CSS v4 (locked light Haramain palette), Base UI (`@base-ui/react`), shadcn/ui (`base-nova` preset in `components/ui/`), `@dnd-kit/*` (Kanban Desk), `cmdk` (`Cmd+K` Post & Group Reverse-Lookup), Recharts 3.8, Lucide React
- **Multimodal AI, Email, Media & Durable Jobs**: Vercel AI SDK (`ai`, `@openrouter/ai-sdk-provider` with Zero-Data-Retention `data_collection: "deny"`, `@ai-sdk/google`), Resend (`resend`, `@react-email/components` — `OD-02`), Trigger.dev Cloud v4 (`@trigger.dev/sdk` — `8` `schemaTask`s + `5` PKT crons across `9` bounded queues), Cloudflare R2 (`@aws-sdk/client-s3` — public marketing prefixes vs private signed `/api/media/[...key]` PII prefixes per `OD-06`), `sharp` (`1080×1520` JPEG social normalizer), and Oracle Cloud PAYG Always Free ARM64 Gotenberg v8.17.0 (`lib/posters/gotenberg.ts`)
- **Native CRM, Social & SEO/GEO Engines**:
  - **WhatsApp CRM (`OD-01`)**: Official Meta WhatsApp Cloud API v21.0 (`lib/whatsapp/*` — `<150ms` `x-hub-signature-256` HMAC webhook + atomic outbox, 3-Priority Inbound Auto-Responder, Guided 3-Step Umrah Intake, global `"STOP"`/`"RUKO"` `do_not_contact`, `>24h` template gate) + Ban-Safe Manual Assisted WA Group/Status Copy-Pack Queue (sunset server-side `@whiskeysockets/baileys` sockets)
  - **Core 5 Social Scheduler (`OD-11`)**: Native `lib/social/*` OAuth & publishing across Instagram, Facebook Pages, YouTube, Google Business Profile v1 (`GBP_API_APPROVED`), and TikTok Content Posting v2 (`TIKTOK_DIRECT_POST_APPROVED`) with honest live-only analytics
  - **Public Hub-and-Spoke SEO/GEO & Attribution (`Spec 0025`)**: `19` indexable public route patterns (`app/(public)/**`), `app/robots.ts`, `app/sitemap.ts`, `public/llms.txt`, `1200×630` `next/og` cards, XSS-safe penalty-free JSON-LD (`lib/seo/json-ld.ts`), wholesale-SAR-stripped public DTOs (`lib/seo/public-queries.ts`), `<Suspense>` builder URL prefill, and 7-column first-touch UTM attribution (`<UtmTracker />` → `applications` & `contact_messages`)
- **Package manager**: npm

## Build approach

**Tracer Bullet** (vertical slices where each feature is built end to end through PostgreSQL, Drizzle ORM, Server Actions, and UI).
**Workflow tier**: **Alpha** project default (`/architect` → `/develop` → `/check verify` → `/sync`), with Foundation 1 (`Stack & architecture`), Foundation 3 (`Data model`), Enterprise Slices 27–30, Slice 43 (`Spec 0024 — Production Readiness Audit & Hardening`, Gate A Certified), and Slice 44 (`Spec 0025 — Public Site SEO Readiness`, Gate B Certified `90.2/100` Grade `A`) at **Beta** (`/architect` → `/develop` → `/check verify` → `/test` → `/sync`).

## Subagent-driven orchestration workflow

This repository operates under a strict **Context-Driven & Subagent-Driven Architecture**:

1. **Orchestrator role (Main Agent)**:
   - The main thread acts strictly as the **Orchestrator**: managing `docs/scope/scope.md`, coordinating task boundaries, resolving user questions, reviewing subagent outputs, and preventing concurrent file collisions.
   - All deep analysis, `/architect` spec drafting, `/audit` scans, `/develop` implementation slices, `/check` verification/reviews, and `/test` suites are delegated to specialized subagents via `invoke_subagent`.
2. **Model tier assignment for subagents**:
   - **Deep & large architectural, analysis, and execution tasks** (`/architect` foundational/complex specs, `/develop` vertical feature slices, schema/auth engineering, `/check review`): Invoke subagents with `Model: "pro"`.
   - **Small to medium tasks** (focused codebase/reference scans, UI token/design system extraction, `/audit` gap checks, smaller isolated tasks): Invoke subagents with `Model: "flash"`.
3. **Parallelism & zero-conflict file ownership**:
   - Subagents may run in parallel **only** when their target output files are strictly disjoint.
   - Shared rollup files (`docs/scope/scope.md`, `AGENTS.md`, `package.json`) are updated either sequentially or by the Orchestrator after parallel subagents report back.
4. **End-to-end lifecycle (`jsmastery-pro/skills`)**:
   - `/scope` → Defines and tracks ordered vertical slices in `docs/scope/scope.md`.
   - `/architect` → Produces load-bearing specs in `docs/specs/NNNN-title.md` before code is written.
   - `/audit` → Bootstraps and gap-fills `AGENTS.md` and nested `<area>/AGENTS.md` context files.
   - `/develop` → Executes the approved spec's `## Build plan` milestone by milestone.
   - `/check verify` & `/check review` → Proves behavior against acceptance criteria in `docs/reviews/` & `docs/audit/`.
   - `/test` → Writes regression, real-PG integration, and Playwright E2E tests for completed slices.
   - `/sync` → Reconciles `AGENTS.md`, `docs/scope/scope.md`, and spec statuses after a slice ships.

## Commands

```bash
# Install dependencies
npm ci

# Run development server
npm run dev

# Production dependency CVE audit (0 critical/high)
npm audit --omit=dev --audit-level=high

# Route type generation & strict TypeScript checks (app + Playwright E2E)
npx next typegen && npm run typecheck && npx tsc --noEmit -p tests/e2e/tsconfig.json

# Lint (0 errors)
npm run lint

# Format
npm run format

# Hermetic unit, domain property, SEO & real-PG integration tests (731 tests against .env.audit)
npm test

# Full-stack Playwright E2E + @axe-core/playwright WCAG 2.2 AA (J1–J23, 26 specs)
npm run test:e2e

# Production standalone build
npm run build

# Trigger.dev Cloud durable worker dev & deploy
npm run trigger:dev
npm run trigger:deploy

# Drizzle database commands
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:backup
```

## Specs & Certifications

- Architectural specs (`0001`–`0025`): `docs/specs/`
- Living project scope (`Slices 1–44` complete): `docs/scope/scope.md`
- Gate A (`Spec 0024`), Gate B (`Spec 0025`), Final Release Report & Runbooks (`RB-01`–`RB-10`): `docs/audit/PRODUCTION_READINESS.md`, `docs/audit/SEO_READINESS.md`, `docs/audit/FINAL_REPORT.md`, and `docs/audit/runbooks/`

## Rules

- **Verify Next.js 16 APIs first**: Always check `node_modules/next/dist/docs/` before writing Next.js 16 routes, `proxy.ts`, caching, `next/image` (`preload` instead of deprecated `priority`), or dynamic `params` / `searchParams` (which are asynchronous Promises in Next.js 16).
- **Verify Drizzle ORM & Better Auth from local source repos**: Never guess ORM or Auth APIs. Always inspect the official reference clones in `../services/drizzle-orm/` and `../services/better-auth/` plus the installed `../.agents/skills/better-auth-*` skills before writing database or auth code.
- **Hermetic test & audit DB safety**: Never point `npm test`, `npm run test:e2e`, or audit scripts at live `.env` (`neon.tech`). Always target `.env.audit` (`127.0.0.1:54329/alramlah_audit`).
- **Single luxury theme & WCAG 2.2 AA lock**: No dark mode or theme toggle (`@custom-variant dark (&:where(.never-dark *));`, `color-scheme: light`, `forcedTheme="light"`). Enforce Deep Haramain Emerald (`#0A3622`), Warm Ivory (`#FAF7F0`), Metallic Haramain Gold (`#C5A059` decorative / `--gold-text` `#7A5C1E` `>=4.5:1` text), `tabular-nums`, and `<ArabicText lang="ar" dir="rtl">` on all sacred Arabic script.
- **Base UI (`@base-ui/react`) primitives**: `components/ui/*` uses `shadcn` (`base-nova` preset) built on `@base-ui/react`, not Radix UI. Always use `render` prop composition instead of Radix's `asChild`.
- **4-Hub Admin IA**: Administrative workflows live in `/admin` (Overview), `/admin/studio` (Multimodal BYO-Poster & Supplier Studio), `/admin/campaigns` (Core 5 Social Scheduler, Ban-Safe Manual Assisted WA Group/Status Queue, Meta Broadcasts & 14-Day Outreach), `/admin/desk` (Live WhatsApp Cloud Inbox + `@dnd-kit` Applications Kanban + Payment Ledger), `/admin/catalog` (Rates, Hajj 2027, Inventory & CMS), and `/admin/settings` (WABA, Social OAuth, Gotenberg, Staff & `?tab=health` Readiness). Legacy `/admin/*` paths remain clean server-side `redirect()` stubs.
- **Public SEO, GEO & Rich-Results Guardrails (`Spec 0025`)**:
  - Canonical origin is strictly apex `https://alramlahtravels.com` (`308`/`301` from `www.`); every indexable public route uses `buildPublicMetadata()` (`50–60`c `<title>`, `150–160`c description, query-free self-canonical, `1200×630` OG image) and `revalidatePublicSeoPaths()` on catalog/group/CMS mutations.
  - Never serialize internal wholesale SAR columns (`sharingPriceSar`, `roomPriceSar`, `quadPriceSar`, `defaultRateSar`, `ziyaratRateSar`) into public RSC props or JSON-LD; never emit `AggregateRating` when verified review count is `0`, `<= 0` or volatile `Offer.price`, Hajj `InStock` checkout schema (`OD-09e`), or unverified license numbers (`OD-10`).
  - Preserve `<Suspense>` around `<UtmTracker />` and `<PlannerUrlHydrator />` so public routes never bail out of static/ISR rendering.
- **Strict validation & type safety**: Validate every Server Action, Route Handler, and form payload with `zod` and `requireAdmin()` / `requireSuperAdmin()`. Never use `any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, or unvalidated `FormData`.
- **Business domain invariants**:
  - Visa duration tier (`short_term` $\le 30$ days vs `long_term` $31\text{–}90$ days) is auto-calculated on the server from mandatory KSA Arrival and Departure dates (`OD-09c`); never expose a manual visa-tier selector to customers.
  - Only `Visa Only` mode and fixed `groupPackages` (`price > 0`) display immediate fixed PKR rates; volatile services (`Flights`, `Hotels`, `Transport`, `Ziyarat`) display `"Live Rate — Confirmed upon submission"`, and `0`-priced Mode B tiers render `"On Request"` (`OD-09b`).
  - Makkah has no airport; itineraries starting in Makkah lock Entry Airport to Jeddah (`JED`) with immediate ground transfer to Makkah.
  - Hotel beds and vehicle seat capacities count `Adults + Children`; `Infants (<2 yrs)` require a visa and infant airfare (`infantPricePkr`, `OD-09d`) but take `0` hotel beds and `0` vehicle seats. Group seat holds deduct `bookedSeats` atomically via `SELECT ... FOR UPDATE` upon `approved` status (`T-022`), and signed QR `/voucher/[token]` unlocks strictly on `approved` + verified deposit/full payment (`OD-03`, `OD-04`).

## Reference repositories (`../services/`)

- `../services/wacrm/`: Official `ArnasDon/wacrm` Meta WhatsApp Cloud API reference (ported natively into `lib/whatsapp/`, `db/schema/whatsapp-crm.ts`, and `trigger/process-inbound-whatsapp.task.ts` — `v2:` HKDF-AES-256-GCM vault, constant-time HMAC webhook + retry-safe outbox, private R2 media mirroring, 3-Priority Auto-Responder, Guided 3-Step Umrah Intake, global `"STOP"`/`"RUKO"` `do_not_contact`, 4s read-only Desk poll, `>24h` window enforcement, RFC-4180 CSV broadcasts, and `OD-01` Ban-Safe Manual Assisted WA Group/Status Queue).
- `../services/postiz-app/`: Official `gitroomhq/postiz-app` social scheduling reference (Core 5 providers `instagram`, `facebook`, `tiktok`, `youtube`, `gmb` ported natively into `lib/social/` and `db/schema/social-scheduler.ts` — HKDF CSRF `state` + PKCE OAuth, `PENDING_SELECTION` staging, Meta Page-token refresh preservation, IG Reel/Story container polling, GBP v1 & TikTok `OD-11` audit gates, PKT peak time-slot engine, AI Caption Copilot, and live-only analytics).
- `../services/trigger.dev/`: Official `triggerdotdev/trigger.dev` v4 SDK reference (`trigger.config.ts`, `trigger/` — fail-closed prod `dispatch.ts`, `rethrowAsTaskError` / `AbortTaskRunError` across all `8` `schemaTask`s, `9` bounded queues, global idempotency keys, `useRealtimeRun` telemetry, and `5` Neon-safe PKT crons including `OD-06` PII retention purge).
- `../services/gotenberg/`: Official `gotenberg/gotenberg` v8 Chromium PDF/screenshot reference (`lib/posters/gotenberg.ts`, `../scripts/oracle-gotenberg/` — escaped `<65 KB` HTML payloads, `--chromium-disable-javascript=true`, SSRF deny-list, and Arabic/Urdu font stack).
- `../services/vercel-ai/`, `../services/openrouter-ai-sdk-provider/`, `../services/google-js-genai/`: Multimodal flyer extraction & deterministic PII-scrubbed ZDR AI Quoting Copilot (`lib/ai/extract-packages.ts`, `lib/ai/quoting-copilot.ts`).
- `../services/drizzle-orm/`: Official `drizzle-team/drizzle-orm` source and documentation reference.
- `../services/better-auth/`: Official `better-auth/better-auth` source and documentation reference.
- `../services/react-email/`: Official `resend/react-email` transactional email reference (`lib/security/mailer.ts`).

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

_Synchronized after Spec 0024 (Gate A) & Spec 0025 (Gate B) production release certification._
