<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Al Ramlah Travels (`سفريات الرملة`)

## Stack

- **Language / Runtime**: TypeScript 5, Node 22+ LTS
- **Framework**: Next.js 16.4.6+ (App Router, `output: "standalone"`), React 19.2.8 (deployed on Vercel / Docker Standalone)
- **Database & ORM**: PostgreSQL 16 — dual-driver Drizzle ORM (`drizzle-orm`, `drizzle-kit`) over Neon Serverless (`@neondatabase/serverless`) in production and `node-postgres` (`pg.Pool`) for local Docker & CI (`48` tables, `47` enums, `17` SQL `CHECK` constraints, append-only `audit_logs` immutability trigger)
- **Authentication & Security**: Better Auth (`better-auth`) with disabled public sign-up (`403`), live DB `isActive` session revocation (`super_admin` and `staff` roles), PostgreSQL `rate_limit_buckets`, `v2:` HKDF-AES-256-GCM secret vault (`lib/security/vault.ts`), and PII-redacted structured logger (`lib/logger.ts`)
- **Validation & UI**: Zod (`zod`), Tailwind CSS v4 (locked light Haramain palette in [DESIGN.md](DESIGN.md)), Base UI (`@base-ui/react`), shadcn/ui (`base-nova` preset in `components/ui/`), Lenis (`lenis`), GSAP (`gsap`, `@gsap/react`), Motion (`motion`), `@dnd-kit/*` (Kanban Desk), `cmdk` (`Cmd+K`), Recharts 3.8, Lucide React
- **Multimodal AI, Email, Media & Durable Jobs**: Vercel AI SDK (`ai`, `@openrouter/ai-sdk-provider` with Zero-Data-Retention `data_collection: "deny"`, `@ai-sdk/google`), Resend (`resend`, `@react-email/components` — `OD-02`), Trigger.dev Cloud v4 (`@trigger.dev/sdk` — `8` `schemaTask`s + `6` PKT crons across `9` bounded queues), Cloudflare R2 (`@aws-sdk/client-s3` — public marketing prefixes vs private signed `/api/media/[...key]` PII prefixes per `OD-06`), `sharp` (`1080×1520` JPEG social normalizer), and Oracle Cloud PAYG Always Free ARM64 Gotenberg v8.17.0 (`lib/posters/gotenberg.ts`)
- **Native CRM, Social & SEO/GEO Engines**:
  - **WhatsApp CRM (`OD-01`)**: Official Meta WhatsApp Cloud API v21.0 (`lib/whatsapp/*`) + Ban-Safe Manual Assisted WA Group/Status Copy-Pack Queue (sunset server-side Baileys)
  - **Core 5 Social Scheduler (`OD-11`)**: Native `lib/social/*` OAuth & publishing across Instagram, Facebook Pages, YouTube, Google Business Profile v1 (`GBP_API_APPROVED`), and TikTok Content Posting v2 (`TIKTOK_DIRECT_POST_APPROVED`) with honest live-only analytics
  - **Public Hub-and-Spoke SEO/GEO & Attribution (`Spec 0025`)**: `19` indexable public route patterns (`app/(public)/**`), `app/robots.ts`, `app/sitemap.ts`, `public/llms.txt`, `1200×630` `next/og` cards, penalty-free JSON-LD (`lib/seo/json-ld.ts`), wholesale-SAR-stripped public DTOs (`lib/seo/public-queries.ts`), `<Suspense>` builder URL prefill, and 7-column first-touch UTM attribution
- **Package manager**: npm

## Build approach

**Tracer Bullet** (vertical slices where each feature is built end to end through PostgreSQL, Drizzle ORM, Server Actions, and UI).
**Workflow tier**: **Alpha** project default (`/architect` → `/develop` → `/check verify` → `/sync`), with core schema, security, omnichannel, and SEO slices at **Beta** (`/architect` → `/develop` → `/check verify` → `/test` → `/sync`).

## Context-Driven, Design-Driven & Spec-Driven Orchestration (CDD + SDD)

1. **Orchestrator & Subagents**:
   - The main thread acts strictly as the **Orchestrator** managing [docs/scope/scope.md](docs/scope/scope.md), disjoint `Owned Paths` boundaries, and shared rollup files (`AGENTS.md`, `package.json`, `docs/scope/scope.md`).
   - Delegate deep architecture, vertical feature slices, schema/auth work, and code reviews to `Model: "pro"` subagents; delegate focused scans, token checks, and isolated small tasks to `Model: "flash"` subagents.
2. **Lifecycle & Quality Gates**:
   - Read [docs/CONSTITUTION.md](docs/CONSTITUTION.md) (`CONST-*` invariants), [docs/INDEX.md](docs/INDEX.md) (Capability Atlas), [PRODUCT.md](PRODUCT.md), and [DESIGN.md](DESIGN.md) before designing or coding.
   - `/scope` → [docs/scope/scope.md](docs/scope/scope.md) · `/architect` → [docs/specs/_TEMPLATE.md](docs/specs/_TEMPLATE.md) (`AC-N` EARS criteria + `Owned Paths` + `Value Sourcing`) · `/impeccable shape` & `/hallmark` → UI planning locked to [DESIGN.md](DESIGN.md) · `/develop` → milestone build (`satisfies AC-N`) · `npm run ui:lint` & `/impeccable critique` / `polish` → anti-slop UI sweep · `/check verify` & `/check review` → [docs/reviews/](docs/reviews/) · `/test` → [test-preferences.json](test-preferences.json) (`covers: AC-N`) · `/sync` & `npm run cdd:check` → [scripts/verify-cdd.mjs](scripts/verify-cdd.mjs).

## Commands

```bash
npm ci                                                                              # Install dependencies
npm run dev                                                                         # Development server
npm run cdd:check                                                                   # Deterministic 7-gate CDD/SDD & link/design/scope verifier
npm run ui:lint -- app/(public)                                                     # Hallmark static anti-slop UI gate (sloplint.mjs)
npm audit --omit=dev --audit-level=high                                             # Production CVE audit (0 critical/high)
npx next typegen && npm run typecheck && npx tsc --noEmit -p tests/e2e/tsconfig.json # Strict TS checks
npm run lint && npm run format                                                      # ESLint (0 errors) & Prettier
npm test                                                                            # Hermetic unit, property, SEO & PG suite (.env.audit)
npm run test:e2e                                                                    # Playwright E2E + Axe WCAG 2.2 AA (J1–J23)
npm run build                                                                       # Production standalone build
npm run trigger:dev && npm run trigger:deploy                                       # Trigger.dev v4 worker dev & deploy
npm run db:generate && npm run db:migrate && npm run db:seed && npm run db:backup   # Drizzle DB lifecycle
```

## Specs, Design & Governance Artifacts

- **Constitution & Invariants (`CONST-*`, `OD-01`–`OD-11`)**: [docs/CONSTITUTION.md](docs/CONSTITUTION.md)
- **Capability-to-Code-to-Test Atlas**: [docs/INDEX.md](docs/INDEX.md)
- **Product & Visual System Truth**: [PRODUCT.md](PRODUCT.md) & [DESIGN.md](DESIGN.md)
- **Living Scope, Spec Template & Test Config**: [docs/scope/scope.md](docs/scope/scope.md), [docs/specs/_TEMPLATE.md](docs/specs/_TEMPLATE.md), [test-preferences.json](test-preferences.json)
- **Certifications & Runbooks (`RB-01`–`RB-10`)**: [docs/audit/PRODUCTION_READINESS.md](docs/audit/PRODUCTION_READINESS.md), [docs/audit/SEO_READINESS.md](docs/audit/SEO_READINESS.md), [docs/audit/FINAL_REPORT.md](docs/audit/FINAL_REPORT.md), [docs/audit/runbooks/](docs/audit/runbooks/)

## Core Rules (Summary — Full Registry in `docs/CONSTITUTION.md`)

- **Verify Next.js 16, Drizzle & Better Auth first**: Check `node_modules/next/dist/docs/`, [../services/drizzle-orm/](../services/drizzle-orm/), and [../services/better-auth/](../services/better-auth/) before writing routes, `proxy.ts`, caching, `next/image` (`preload`), async `params`/`searchParams`, ORM queries, or auth code.
- **Hermetic DB safety (`CONST-SEC-08`)**: Never point `npm test`, `npm run test:e2e`, or scripts at live `.env` (`neon.tech`); always target `.env.audit` (`127.0.0.1:54329/alramlah_audit`).
- **Single luxury light theme, Base UI & WCAG 2.2 AA (`CONST-UI-01`..`05`)**: No dark mode; Deep Haramain Emerald `#0A3622`, Warm Ivory `#FAF7F0`, decorative gold `#C5A059` vs text-safe `--gold-text` `#7A5C1E` (`>=4.5:1`), `tabular-nums`, `<ArabicText lang="ar" dir="rtl">`, and `@base-ui/react` `render` prop (never Radix `asChild`).
- **Strict AuthZ, Zod & Redaction (`CONST-SEC-02`..`04`)**: Validate every Server Action and Route Handler with `zod` and `requireAdmin()` / `requireSuperAdmin()`, redacting wholesale costs for `staff` (`T-061`). Zero `any`, `@ts-ignore`, `@ts-expect-error`, or `eslint-disable`.
- **Public SEO/GEO & Domain Laws (`CONST-SEO-01`..`05`, `CONST-DOM-01`..`09`)**: Apex `https://alramlahtravels.com`, zero wholesale SAR serialization in public RSC/JSON-LD, `<Suspense>` around `<UtmTracker />` & `<PlannerUrlHydrator />`, server-derived visa tiers (`<=30d` vs `31–90d`), `"Live Rate"` vs `Visa Only`/Group fixed PKR, Makkah → `JED` entry lock, `Adults + Children` bed/seat math (`Infants` = `0` beds/`0` seats + `infantPricePkr`), `SELECT ... FOR UPDATE` seat holds on `approved`, and `/voucher/[token]` gated on `approved` + verified payment.

## Reference repositories ([../services/](../services/))

- [../services/wacrm/](../services/wacrm/), [../services/postiz-app/](../services/postiz-app/), [../services/trigger.dev/](../services/trigger.dev/), [../services/gotenberg/](../services/gotenberg/): Omnichannel WA Cloud API, Core 5 Social, Trigger.dev v4, and Gotenberg v8 references.
- [../services/vercel-ai/](../services/vercel-ai/), [../services/openrouter-ai-sdk-provider/](../services/openrouter-ai-sdk-provider/), [../services/google-js-genai/](../services/google-js-genai/), [../services/react-email/](../services/react-email/), [../services/drizzle-orm/](../services/drizzle-orm/), [../services/better-auth/](../services/better-auth/): Core AI, email, ORM, and auth SDK clones.
- [../services/hallmark/](../services/hallmark/), [../services/impeccable/](../services/impeccable/), [../services/awesome-design-md/](../services/awesome-design-md/): UI anti-slop gates (`sloplint.mjs`), 24-command design system (`PRODUCT.md` + `DESIGN.md`), and Stitch `DESIGN.md` exemplars.
- [../services/jsmastery-skills/](../services/jsmastery-skills/), [../services/awesome-spec-driven-development/](../services/awesome-spec-driven-development/): Canonical v2.0.0 CDD/SDD lifecycle skills and spec-driven engineering patterns.
- [../services/gsap/](../services/gsap/), [../services/gsap-react/](../services/gsap-react/), [../services/gsap-skills/](../services/gsap-skills/), [../services/motion/](../services/motion/), [../services/motion-ai-kit/](../services/motion-ai-kit/), [../services/lenis/](../services/lenis/): Upstream GSAP, Motion, and Lenis source and skill references.

## Agent skills (`.agents/skills/`)

- **SDD & CDD Workflow (`jsmastery-pro/skills`)**: [scope](.agents/skills/scope/), [architect](.agents/skills/architect/), [audit](.agents/skills/audit/), [develop](.agents/skills/develop/), [check](.agents/skills/check/), [test](.agents/skills/test/), [debug](.agents/skills/debug/), [document](.agents/skills/document/), [sync](.agents/skills/sync/)
- **UI, Design Craft & Primitives**: [impeccable](.agents/skills/impeccable/), [hallmark](.agents/skills/hallmark/), [shadcn](.agents/skills/shadcn/), [migrate-radix-to-base](.agents/skills/migrate-radix-to-base/)
- **Motion, GSAP & Smooth Scroll**: [motion](.agents/skills/motion/), [gsap-core](.agents/skills/gsap-core/), [gsap-react](.agents/skills/gsap-react/), [gsap-scrolltrigger](.agents/skills/gsap-scrolltrigger/), [gsap-timeline](.agents/skills/gsap-timeline/), [gsap-performance](.agents/skills/gsap-performance/), [lenis-smooth-scroll](.agents/skills/lenis-smooth-scroll/) · MCP servers: `motion` (connected)
- **Authentication (`better-auth`)**: [better-auth-best-practices](.agents/skills/better-auth-best-practices/), [better-auth-security-best-practices](.agents/skills/better-auth-security-best-practices/), [create-auth](.agents/skills/create-auth/), [email-and-password-best-practices](.agents/skills/email-and-password-best-practices/), [organization-best-practices](.agents/skills/organization-best-practices/), [two-factor-authentication-best-practices](.agents/skills/two-factor-authentication-best-practices/)
- **Durable Jobs (`trigger.dev`)**: [trigger-getting-started](.agents/skills/trigger-getting-started/), [trigger-authoring-tasks](.agents/skills/trigger-authoring-tasks/), [trigger-realtime-and-frontend](.agents/skills/trigger-realtime-and-frontend/), [trigger-cost-savings](.agents/skills/trigger-cost-savings/), [trigger-authoring-chat-agent](.agents/skills/trigger-authoring-chat-agent/), [trigger-chat-agent-advanced](.agents/skills/trigger-chat-agent-advanced/)
- **Haramain Print & Poster Studio**: [umrah-package-posters](.agents/skills/umrah-package-posters/), [umrah-single-package-poster](.agents/skills/umrah-single-package-poster/), [umrah-quotation-pdf](.agents/skills/umrah-quotation-pdf/)

## Context files

- [app/(public)/AGENTS.md](app/(public)/AGENTS.md): Public 19-route Hub-and-Spoke storefront, `Spec 0025` SEO/GEO, JSON-LD & UTM attribution
- [app/admin/AGENTS.md](app/admin/AGENTS.md): 4-Hub Admin IA (`/studio`, `/campaigns`, `/desk`, `/catalog`, `/settings`), RBAC & wholesale redaction
- [components/AGENTS.md](components/AGENTS.md): `@base-ui/react` (`base-nova`), Haramain light tokens, `<ArabicText>` & Custom Journey Builder UI guards
- [db/AGENTS.md](db/AGENTS.md): Dual-driver PostgreSQL 16 + Drizzle schema (`48` tables), `FOR UPDATE` locks, `2×` seed & `.env.audit` safety
- [lib/whatsapp/AGENTS.md](lib/whatsapp/AGENTS.md): Meta WhatsApp Cloud API v21.0, HMAC/outbox, `v2:` vault, Intake & `OD-01` Assisted Queue
- [lib/social/AGENTS.md](lib/social/AGENTS.md): Core 5 Social OAuth, PKCE/HKDF state, `OD-11` vendor audit gates & live-only analytics
- [trigger/AGENTS.md](trigger/AGENTS.md): Trigger.dev Cloud v4 `schemaTask`s, `9` bounded queues, `6` PKT crons & realtime hooks

_Synchronized after Slice 47 (Secondary Public Hubs, Spokes and Shell Editorial Alignment)._
