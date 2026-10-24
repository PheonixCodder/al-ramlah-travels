<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Al Ramlah Travels

## Stack

- **Language / Runtime**: TypeScript 5, Node 20+
- **Framework**: Next.js 16.3.4 (App Router), React 19.2.8
- **Database & ORM**: Neon Serverless PostgreSQL (`@neondatabase/serverless`), Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Authentication**: Better Auth (`better-auth`) with Drizzle PostgreSQL adapter (`super_admin` and `staff` roles)
- **Validation & UI**: Zod (`zod`), Tailwind CSS v4, Base UI (`@base-ui/react`), shadcn/ui (`base-nova` preset in `components/ui/`), Recharts 3.8, Lucide React
- **Package manager**: npm

## Build approach

**Tracer Bullet** (vertical slices where each feature is built end to end through PostgreSQL, Drizzle ORM, Server Actions, and UI).
**Workflow tier**: **Alpha** project default (`/architect` → `/develop` → `/check verify` → `/sync`), with Foundation 1 (`Stack & architecture`) and Foundation 3 (`Data model`) at **Beta** (`/architect` → `/develop` → `/check verify` → `/test` → `/sync`).

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

# Production build
npm run build

# Drizzle database commands (once wired in Foundation 1)
npx drizzle-kit generate
npx drizzle-kit migrate
npx drizzle-kit push
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md` (or `docs/specs/NNNN-title/index.md` + `rationale.md` for directory specs).
Living project scope lives in `docs/scope/scope.md`.

## Rules

- **Verify Next.js 16 APIs first**: Always check `node_modules/next/dist/docs/` before writing Next.js 16 routes, `proxy.ts` / middleware, caching, or dynamic `params` / `searchParams` (which are asynchronous Promises in Next.js 16).
- **Verify Drizzle ORM & Better Auth from local source repos**: Never guess ORM or Auth APIs. Always inspect the official reference clones in `services/drizzle-orm/` and `services/better-auth/` plus the installed `.agents/skills/better-auth-*` skills before writing database or auth code.
- **Single luxury theme only**: No dark mode or theme toggle (`next-themes` switching must not be exposed). Enforce a single luxury palette inspired by the Haramain and matched to `public/logo.jpg`: Deep Haramain Emerald, Warm Ivory / Alabaster Cream, and Metallic Haramain Gold.
- **Base UI (`@base-ui/react`) primitives**: `components/ui/*` uses `shadcn` (`base-nova` preset) built on `@base-ui/react`, not Radix UI. Use `render` prop composition instead of Radix's `asChild`.
- **Strict validation & type safety**: Validate every Server Action, Route Handler, and form payload with `zod`. Never use `any` or unvalidated `FormData`.
- **Business domain invariants**:
  - Visa duration tier (`short_term` $\le 30$ days vs `long_term` $> 30$ days) is auto-calculated on the server from KSA Arrival Date and KSA Departure Date; never expose a manual visa-tier selector to customers.
  - Only `Visa Only` mode displays an immediate fixed PKR total to the customer; whenever volatile services (`Flights`, `Hotels`, `Transport`, `Ziyarat`) are enabled, display the itemized Live Itinerary Summary Card (`"Live Rate — Confirmed upon submission"`) and pre-fill the calculated visa rate in the Admin Quote Worksheet.
  - Makkah has no airport; itineraries starting in Makkah lock Entry Airport to Jeddah (`JED`) with immediate ground transfer to Makkah.
  - Hotel beds and vehicle seat capacities count `Adults + Children`; `Infants (<2 yrs)` require a visa and infant air ticket but take 0 hotel beds and 0 vehicle seats. Total passport count includes `Adults + Children + Infants`.

## Reference repositories (`services/`)

- `services/skills/`: Official `jsmastery-pro/skills` context-driven development workflow reference.
- `services/drizzle-orm/`: Official `drizzle-team/drizzle-orm` source and documentation reference.
- `services/better-auth/`: Official `better-auth/better-auth` source and documentation reference.

## Agent skills

- [shadcn](.agents/skills/shadcn/): `shadcn/ui`, component conventions and `base-nova` preset rules for `components/ui/`
- [migrate-radix-to-base](.agents/skills/migrate-radix-to-base/): `shadcn/base-ui`, patterns for `@base-ui/react` (`render` prop instead of `asChild`)
- [better-auth-best-practices](.agents/skills/better-auth-best-practices/): `better-auth/skills`, server/client setup, Drizzle adapter, and session management
- [create-auth](.agents/skills/create-auth/): `better-auth/skills`, scaffolding Better Auth route handlers and auth UI in Next.js App Router
- [better-auth-security-best-practices](.agents/skills/better-auth-security-best-practices/): `better-auth/skills`, rate limiting, CSRF, trusted origins, cookie security, and IP tracking
- [email-and-password-best-practices](.agents/skills/email-and-password-best-practices/): `better-auth/skills`, credential authentication, password policies, and admin user flows
- [organization-best-practices](.agents/skills/organization-best-practices/): `better-auth/skills`, role-based access control (`super_admin` vs `staff`)
- [two-factor-authentication-best-practices](.agents/skills/two-factor-authentication-best-practices/): `better-auth/skills`, optional 2FA hardening for admin accounts

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
