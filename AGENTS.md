<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Al Ramlah Travels

## Stack

- **Language / Runtime**: TypeScript 5, Node 20+
- **Framework**: Next.js 16.3.4 (App Router), React 19.2.8 (deployed on Vercel)
- **Database & ORM**: Neon Serverless PostgreSQL (`@neondatabase/serverless`), Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Authentication**: Better Auth (`better-auth`) with Drizzle PostgreSQL adapter (`super_admin` and `staff` roles)
- **Validation & UI**: Zod (`zod`), Tailwind CSS v4, Base UI (`@base-ui/react`), shadcn/ui (`base-nova` preset in `components/ui/`), `@dnd-kit/*` (Kanban Desk), `cmdk` (`Cmd+K` Post Reverse-Lookup), Recharts 3.8, Lucide React
- **Multimodal AI, Media & Durable Jobs**: Vercel AI SDK (`ai`, `@openrouter/ai-sdk-provider`, `@ai-sdk/google`), Trigger.dev Cloud v4 (`@trigger.dev/sdk`), Cloudflare R2 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`), `sharp` (`1080×1520` JPEG social normalizer), and Oracle Cloud Always Free Gotenberg (`lib/posters/gotenberg.ts`)
- **Native CRM & Social Engines**: Native TypeScript ports of `wacrm` (`lib/whatsapp/*` — Meta WhatsApp Cloud API v21.0, AES-256-GCM token encryption, `x-hub-signature-256` HMAC webhooks) and `postiz-app` (`lib/social/*` — Core 5 OAuth & publishing: Instagram, Facebook Pages, TikTok, YouTube, Google Business Profile)
- **Package manager**: npm

## Build approach

**Tracer Bullet** (vertical slices where each feature is built end to end through PostgreSQL, Drizzle ORM, Server Actions, and UI).
**Workflow tier**: **Alpha** project default (`/architect` → `/develop` → `/check verify` → `/sync`), with Foundation 1 (`Stack & architecture`), Foundation 3 (`Data model`), and Enterprise Slices 27–30 at **Beta** (`/architect` → `/develop` → `/check verify` → `/test` → `/sync`).

## Subagent-driven orchestration workflow

This repository operates under a strict **Context-Driven & Subagent-Driven Architecture**:

1. **Orchestrator role (Main Agent)**:
   - The main thread acts strictly as the **Orchestrator**: managing `docs/scope/scope.md`, coordinating task boundaries, resolving user questions, reviewing subagent outputs, and preventing concurrent file collisions.
   - All deep analysis, `/architect` spec drafting, `/audit` scans, `/develop` implementation slices, `/check` verification/reviews, and `/test` suites are delegated to specialized subagents via `invoke_subagent`.
2. **Model tier assignment for subagents**:
   - **Deep & large architectural, analysis, and execution tasks** (`/architect` foundational/complex specs, `/develop` vertical feature slices, schema/auth engineering, `/check review`): Invoke subagents with `Model: "pro"` (Claude Sonnet 5.5 medium thinking / Pro tier reasoning).
   - **Small to medium tasks** (focused codebase/reference scans, UI token/design system extraction, `/audit` gap checks, smaller isolated tasks): Invoke subagents with `Model: "flash"` (Gemini 3.8 Flash high thinking / Flash tier reasoning).
3. **Parallelism & zero-conflict file ownership**:
   - Subagents may run in parallel **only** when their target output files are strictly disjoint (for example, Subagent A writes `docs/specs/0001-stack-and-architecture.md`, Subagent B writes `docs/specs/0002-data-model.md`, Subagent C writes `docs/specs/0003-design-system.md` and `design.md`).
   - Shared rollup files (`docs/scope/scope.md`, `AGENTS.md`, `package.json`) are updated either sequentially or by the Orchestrator after parallel subagents report back.
4. **End-to-end lifecycle (`jsmastery-pro/skills`)**:
   - `/scope` → Defines and tracks ordered vertical slices in `docs/scope/scope.md`.
   - `/architect` → Produces load-bearing specs in `docs/specs/NNNN-title.md` before code is written.
   - `/audit` → Bootstraps and gap-fills `AGENTS.md` and nested `<area>/AGENTS.md` context files.
   - `/develop` → Executes the approved spec's `## Build plan` milestone by milestone.
   - `/check verify` & `/check review` → Proves behavior against acceptance criteria in `docs/reviews/`.
   - `/test` → Writes regression and unit/integration tests for completed slices.
   - `/sync` → Reconciles `AGENTS.md`, `docs/scope/scope.md`, and spec statuses after a slice ships.

## Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Typecheck
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Automated unit & integration tests
npm test

# Production build
npm run build

# Trigger.dev Cloud durable worker dev & deploy
npm run trigger:dev
npm run trigger:deploy

# Drizzle database commands
npx drizzle-kit generate
npx drizzle-kit migrate
npx drizzle-kit push
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md` (or `docs/specs/NNNN-title/index.md` + `rationale.md` for directory specs).
Living project scope lives in `docs/scope/scope.md`.

## Rules

- **Verify Next.js 16 APIs first**: Always check `node_modules/next/dist/docs/` before writing Next.js 16 routes, `proxy.ts` / middleware, caching, or dynamic `params` / `searchParams` (which are asynchronous Promises in Next.js 16).
- **Verify Drizzle ORM & Better Auth from local source repos**: Never guess ORM or Auth APIs. Always inspect the official reference clones in `../services/drizzle-orm/` and `../services/better-auth/` plus the installed `.agents/skills/better-auth-*` skills before writing database or auth code.
- **Single luxury theme only**: No dark mode or theme toggle (`next-themes` switching must not be exposed). Enforce a single luxury palette inspired by the Haramain and matched to `public/logo.jpg`: Deep Haramain Emerald, Warm Ivory / Alabaster Cream, and Metallic Haramain Gold.
- **Base UI (`@base-ui/react`) primitives**: `components/ui/*` uses `shadcn` (`base-nova` preset) built on `@base-ui/react`, not Radix UI. Use `render` prop composition instead of Radix's `asChild`.
- **4-Hub Admin IA**: Administrative workflows live in `/admin` (Overview), `/admin/studio` (Multimodal BYO-Poster & Supplier Studio), `/admin/campaigns` (Core 5 Social Scheduler, Safe WA Group/Status Queue, Meta Broadcasts & 14-Day Outreach), `/admin/desk` (Live WhatsApp Cloud Inbox + `@dnd-kit` Applications Kanban), `/admin/catalog` (Rates, Inventory & CMS), and `/admin/settings` (WABA, Social OAuth, Gotenberg & Staff). Legacy `/admin/*` paths remain clean server-side `redirect()` stubs.
- **Strict validation & type safety**: Validate every Server Action, Route Handler, and form payload with `zod`. Never use `any` or unvalidated `FormData`.
- **Business domain invariants**:
  - Visa duration tier (`short_term` $\le 30$ days vs `long_term` $> 30$ days) is auto-calculated on the server from KSA Arrival Date and KSA Departure Date; never expose a manual visa-tier selector to customers.
  - Only `Visa Only` mode displays an immediate fixed PKR total to the customer; whenever volatile services (`Flights`, `Hotels`, `Transport`, `Ziyarat`) are enabled, display the itemized Live Itinerary Summary Card (`"Live Rate — Confirmed upon submission"`) and pre-fill the calculated visa rate in the Admin Quote Worksheet.
  - Makkah has no airport; itineraries starting in Makkah lock Entry Airport to Jeddah (`JED`) with immediate ground transfer to Makkah.
  - Hotel beds and vehicle seat capacities count `Adults + Children`; `Infants (<2 yrs)` require a visa and infant air ticket but take 0 hotel beds and 0 vehicle seats. Total passport count includes `Adults + Children + Infants`.

## Reference repositories (`../services/`)

- `../services/wacrm/`: Official `ArnasDon/wacrm` Meta WhatsApp Cloud API reference (ported natively into `lib/whatsapp/` and `db/schema/whatsapp-crm.ts`).
- `../services/postiz-app/`: Official `gitroomhq/postiz-app` social scheduling reference (Core 5 providers ported natively into `lib/social/` and `db/schema/social-scheduler.ts`).
- `../services/trigger.dev/`: Official `triggerdotdev/trigger.dev` durable background task SDK reference (`trigger.config.ts`, `trigger/`).
- `../services/gotenberg/`: Official `gotenberg/gotenberg` Chromium PDF/screenshot reference (`lib/posters/gotenberg.ts`, `../scripts/oracle-gotenberg/`).
- `../services/vercel-ai/`, `../services/openrouter-ai-sdk-provider/`, `../services/google-js-genai/`: Multimodal structured extraction references (`lib/ai/extract-packages.ts`).
- `../services/drizzle-orm/`: Official `drizzle-team/drizzle-orm` source and documentation reference.
- `../services/better-auth/`: Official `better-auth/better-auth` source and documentation reference.
- `../services/react-email/`: Official `resend/react-email` transactional email reference.

## Agent skills

- [shadcn](.agents/skills/shadcn/): `shadcn/ui`, component conventions and `base-nova` preset rules for `components/ui/`
- [migrate-radix-to-base](.agents/skills/migrate-radix-to-base/): `shadcn/base-ui`, patterns for `@base-ui/react` (`render` prop instead of `asChild`)
- [better-auth-best-practices](.agents/skills/better-auth-best-practices/): `better-auth/skills`, server/client setup, Drizzle adapter, and session management
- [create-auth](.agents/skills/create-auth/): `better-auth/skills`, scaffolding Better Auth route handlers and auth UI in Next.js App Router
- [better-auth-security-best-practices](.agents/skills/better-auth-security-best-practices/): `better-auth/skills`, rate limiting, CSRF, trusted origins, cookie security, and IP tracking
- [email-and-password-best-practices](.agents/skills/email-and-password-best-practices/): `better-auth/skills`, credential authentication, password policies, and admin user flows
- [organization-best-practices](.agents/skills/organization-best-practices/): `better-auth/skills`, role-based access control (`super_admin` vs `staff`)
- [two-factor-authentication-best-practices](.agents/skills/two-factor-authentication-best-practices/): `better-auth/skills`, optional 2FA hardening for admin accounts
- [trigger-getting-started](.agents/skills/trigger-getting-started/): `triggerdotdev/skills`, bootstrapping Trigger.dev v4 config, CLI auth, and dev server
- [trigger-authoring-tasks](.agents/skills/trigger-authoring-tasks/): `triggerdotdev/skills`, authoring `task()`, `schemaTask()`, retries, `wait.until()` / `wait.for()`, queues, idempotency, and cron schedules in `trigger/`
- [trigger-realtime-and-frontend](.agents/skills/trigger-realtime-and-frontend/): `triggerdotdev/skills`, subscribing to runs with `@trigger.dev/react-hooks` (`useRealtimeRun`, `useRealtimeStream`) and public tokens
- [trigger-cost-savings](.agents/skills/trigger-cost-savings/): `triggerdotdev/skills`, optimizing task concurrency, waits, machines, and inspecting runs via Trigger.dev MCP
- [trigger-authoring-chat-agent](.agents/skills/trigger-authoring-chat-agent/): `triggerdotdev/skills`, durable AI chat agents via `@trigger.dev/sdk/ai`
- [trigger-chat-agent-advanced](.agents/skills/trigger-chat-agent-advanced/): `triggerdotdev/skills`, advanced durable sessions, sub-agents, human-in-the-loop, and context compaction

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
