# AL RAMLAH TRAVELS — PRODUCTION-READINESS AUDIT & HARDENING SWARM

> Saved verbatim from owner kickoff request. All swarm coordinators, auditors, fixers, and verifiers must follow these rules strictly.

---

## 0. YOUR ROLE

You are part of an agent swarm auditing and hardening **Al Ramlah Travels** (`سفريات الرملة`): a Next.js 16 / React 19 / TypeScript / Drizzle / Neon Postgres / Better Auth / Trigger.dev v4 / Cloudflare R2 / Gotenberg platform for a Hajj & Umrah agency in Lahore, Pakistan (`c:\dev\al-ramlah-travels\web`). It has a public pilgrim site, a custom journey builder, group packages, a B2B flyer-wrapping "Studio", a social scheduler, a dual-engine WhatsApp CRM (Meta Cloud API + Baileys), an AI quoting copilot, a Kanban desk, and PDF/voucher generation.

**The owner's verdict: "the app is not that good."** Your job is to find out exactly why, prove it with evidence, and fix it — end to end — until the app is genuinely production-ready. Then, and only then, make it SEO-ready.

**Priority order (strict):**
1. **Phase A — Functionality, correctness, security, reliability, and production readiness of the whole app.**
2. **Phase B — SEO readiness of the whole public site.** Phase B does not start until the Phase A gate (§9) passes.

**Do not accept "it compiles" or "the tests pass" as evidence of working.** The existing 429 tests are mostly unit tests over mocks/in-memory fixtures. A feature is only "working" when you have exercised it end-to-end against a real (non-production) database and real/sandboxed integrations, and observed the correct result.

---

## 1. THE BRIEF IS A SET OF CLAIMS, NOT THE TRUTH

`c:\dev\al-ramlah-travels\web\docs\PLATFORM_MASTER_BRIEF.md` (the "Brief") contains marketing language ("zero-omission", "certified", "100% pass rates", "all 42 slices complete"). **Treat every statement in it as an unverified claim.** The code in `c:\dev\al-ramlah-travels\web` is the only source of truth.

The first deliverable is a **Ground Truth Report + Feature Parity Matrix** (§5) that classifies every capability in the Brief as one of:

`VERIFIED-WORKING` · `IMPLEMENTED-UNVERIFIED` · `PARTIAL` · `STUB/FAKE` · `MISSING` · `BROKEN`

Where the code contradicts the Brief, the code wins and the Brief discrepancy is logged as a finding.

---

## 2. NON-NEGOTIABLE RULES OF ENGAGEMENT

### 2.1 Safety (never violate)
1. **Never touch the production database, production R2 bucket, production Meta/WhatsApp numbers, production social accounts, or production Trigger.dev environment.** Notice `c:\dev\al-ramlah-travels\web\.env` may contain live Neon/R2/Meta/OpenRouter credentials — NEVER run destructive commands, seeds, migrations, or outbound calls against `.env`'s live endpoints, and NEVER print or echo secret values from `.env`! Use a local disposable Postgres container via Docker, local storage fallback or mock R2, mocked Graph/social APIs, and offline/dev runners.
2. **Never send a real WhatsApp message, email, social post, or broadcast to a real person.** All outbound I/O in tests must hit mocks, sandboxes, or local fake servers.
3. **Never print, log, commit, or paste secrets.** If you find a secret in git history or a file, report it as P0 (file path + line/commit hash ONLY, never echo the value).
4. **No destructive git operations** (no force-push, no history rewrite, no deleting branches you did not create). Work on branch `audit/production-hardening` and per-agent worktree/share branches in W3.
5. **No destructive DB operations** outside a disposable local Postgres container. Every schema change goes through a reviewed migration file, never `db:push` against anything that matters.
6. **Do not weaken security to make a test pass.** Do not add `any`, `@ts-ignore`, `eslint-disable`, `skip`, or `.only` to get green.

### 2.2 Quality bar
- Every finding needs **evidence** (command output, failing test, request/response, screenshot, or `file:line`). No evidence → it's a hypothesis, label it so.
- Every fix needs a **test that fails before and passes after** (red → green), unless the fix is pure config/docs.
- Every wave ends with `npm run typecheck && npm run lint && npm test && npm run build` green (from `web/`).
- Prefer the smallest correct change. No drive-by refactors. No new dependencies without a written justification (size, maintenance, license, CVEs).
- Preserve the brand design system (`web/design.md`): single locked light theme, no dark mode, Base UI `render` prop (never Radix `asChild`), mono/tabular font for prices and reference IDs.

### 2.3 Business invariants are law
The 9 invariants in Brief §5.4 are business rules, not suggestions: server-calculated visa tier; "Live Rate — Confirmed upon submission" for volatile services; Makkah → JED / Madinah → MED; passenger accounting (infants take 0 beds / 0 seats); private room auto-splitter; vehicle capacity bands; seamless date chaining; Mode A/Mode B commission math; 14-day outreach cooldown with reply exemption. **You may find bugs in how they are implemented. You may not change what they mean without the owner's written approval** (§11).

### 2.4 Project lifecycle
Record Phase A as **Spec 0024 — Production Readiness Audit & Hardening** (`web/docs/specs/0024-production-readiness-audit-and-hardening.md`) and Phase B as **Spec 0025 — SEO Readiness**, updating `web/docs/scope/scope.md` honestly.

---

## 3. ARTIFACTS, FINDING FORMAT & SEVERITY

### 3.1 Communication contract
Every agent returns/posts a ≤ 40-line summary: scope covered, counts by severity, top 5 findings with IDs, anything it could not verify and why, and any cross-boundary requests. Full details live in files under `c:\dev\al-ramlah-travels\web\docs\audit\`.

### 3.2 Directory layout (`c:\dev\al-ramlah-travels\web\docs\audit\`)
```
web/docs/audit/
  SWARM_PROMPT.md
  00-ground-truth.md            # real inventory + baseline results
  01-feature-parity.md          # Brief claim -> status matrix
  02-ownership.md               # file ownership map for fix wave
  02-triage.md                  # deduped, ranked backlog
  findings/<AGENT-ID>.md        # one file per auditor (A00..A26, A02-authz-matrix.md)
  03-fix-log.md                 # every fix: finding IDs, commit, test added
  04-verification.md            # re-test evidence, reopened items
  PRODUCTION_READINESS.md       # Gate A checklist (§9.4) with evidence links
  runbooks/                     # ops runbooks (§A23)
  seo/                          # Phase B artifacts (findings/S01..S16.md)
  FINAL_REPORT.md
```

### 3.3 Mandatory Finding Format
```markdown
### <AGENT>-<NNN> — <short title>
- Severity: P0 | P1 | P2 | P3
- Category: functional | security | data-integrity | reliability | performance | a11y | ux | config | infra | compliance | docs | seo
- Where: <file:line(s) / route / table / task / env var>
- Brief claim contradicted (if any): <§ and quote ≤ 15 words>
- Evidence: <repro steps + actual vs expected + command output / test / request-response>
- Impact (business terms): <what breaks for pilgrim / staff / owner / money / legal>
- Root cause: <why>
- Recommended fix: <concrete change>
- Test to add: <what red->green test proves it>
- Effort: S (<2h) | M (<1d) | L (>1d)
- Confidence: High | Medium | Low (hypothesis)
- Needs owner decision: yes/no
```

### 3.4 Severity Definitions
- **P0 — Stop-ship.** Security breach or PII/passport exposure; money misquoted (price below net cost, wrong total); data loss/corruption; admin takeover; prod outage on a core flow; messages sent to wrong/real people; legal exposure; secrets committed/leaked.
- **P1 — Core flow broken or highly likely to fail in production.** Lead can't be submitted, quote can't be generated/sent, webhook drops messages, double-booking of seats, integration silently non-functional in prod topology.
- **P2 — Degraded.** Wrong but recoverable behavior, poor error handling, notable UX/a11y failures, performance misses, missing observability.
- **P3 — Polish.** Cosmetic, copy, minor refactors.

---

## 4. TEST ENVIRONMENT (W0)

1. Record Node/npm versions. Note `web/Dockerfile` uses `node:20-alpine` (Node 20 reached EOL in April 2026 — verify and plan move to supported LTS Node 22/24).
2. Stand up a **disposable local Postgres container** via Docker (NEVER touch Neon DB in `.env`!). Apply migrations from scratch via `db:migrate` (not `db:push`) against the disposable local Postgres and compare with `db/schema/*` (`drizzle-kit` / schema introspection) to record every schema/migration drift! Run `db:seed` against the disposable local Postgres (twice, testing idempotency).
3. Provide `web/.env.audit` with **non-prod local/mock values only** (ensure `.gitignore` excludes `.env.audit`), and add a safety helper that refuses to run audit/integration scripts if `DATABASE_URL` points to `neon.tech` or non-local host unless explicitly overridden.
4. Prepare local fakes / test harnesses for external systems (Meta Graph API, Gotenberg container or mock, local storage, AI fixtures + fault injection, social API fixtures, Trigger inline + mocked SDK).
5. Check/prepare Playwright (`tests/e2e/`) and real-Postgres integration test (`tests/integration/`) scaffolding.
6. Capture baseline into `00-ground-truth.md`: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (+ bundle sizes), `npm audit --omit=dev`, dead-code/unused-deps scan, git history/working-tree secret check (redacting any values!), and Lighthouse/HTML baseline.

---

## 5. WAVE 0 — GROUND TRUTH (`00-ground-truth.md` & `01-feature-parity.md`)

1. **Inventory by reality, not by Brief**: actual counts of tables, enums, columns, indexes, FKs (+ `ON DELETE` behavior), route files, layouts, API route handlers, server-action modules and exported actions, trigger tasks and schedules, env vars read in code vs `lib/env.ts` vs `.env.example` vs Brief, npm dependencies actually imported vs declared, test files/suites/tests actually executed.
2. **Brief <-> code diff** (confirm or refute each with `file:line`):
   - Exact counts: 43 tables / 46 enums / 12 action modules / 14 legacy redirects / 21 test files / 429 tests — true or false?
   - `whatsapp_message_type` enum contains both lowercase and UPPERCASE values (`text` and `TEXT`, ...).
   - Legacy redirects pointing at tabs that may not exist: `/admin/users -> /admin/settings?tab=staff` vs `users`, `/admin/distribution -> /admin/campaigns?tab=social` vs `distribution`, plus default-tab behavior across `/admin/settings`, `/admin/campaigns`, `/admin/desk`, `/admin/studio`, `/admin/catalog`.
   - Masar visa brackets: Brief says 10 / 15 / 21 / 30 days; schema column is `withMasar28DaysSar`. Which is right and what does `visa-calc.ts` use?
   - Features described in Brief with potentially missing/partial surfaces: "Reactive Engagement Engine", "Smart Insights Banner (AI-curated vs static rules)", "Cross-Channel Analytics" sync schedule, SLA "flagging marker" on `applications`, public pilgrim voucher access (route is `/admin/applications/[id]/voucher`), online quote approval by pilgrim, payment recording (`paymentStatus` on quotes vs payments table), email delivery of quotes (any email SDK/provider at all vs `mailto:`?), password reset/email verification.
   - Password hashing: bcrypt vs Better Auth default scrypt.
   - "Atomic transaction" claims with `@neondatabase/serverless` `neon-http` driver (does `db.transaction()` work or fail on `neon-http`?).
   - Duplicate action exports (`submitGroupBookingApplication` vs `submitGroupBooking`, `submitHajjInquiryApplication` vs `submitHajjInquiry`).
3. **Feature Parity Matrix (`01-feature-parity.md`)**: one row per capability in Brief §1.2, §6.1–6.6, §7, §9.2–9.4, classified as `VERIFIED-WORKING` · `IMPLEMENTED-UNVERIFIED` · `PARTIAL` · `STUB/FAKE` · `MISSING` · `BROKEN` with `file:line` evidence and owner-decision flag.
4. **Production Topology Map**: where each runtime piece runs in prod (Vercel serverless vs Docker standalone VPS vs Trigger.dev Cloud workers vs Oracle ARM VM) and which pieces break across boundaries.

---

## 6. CROSS-CUTTING RISK HYPOTHESES (H1–H37)

- **H1**: `TRIGGER_SECRET_KEY` unset => tasks run inline (`dispatch.ts`). Blocked in `NODE_ENV=production`?
- **H2**: Gotenberg unreachable => local Chrome via CDP fallback (`chromium-cdp.ts`). Fails on Vercel; disabled in prod?
- **H3**: R2 unset => uploads written to `public/uploads/r2-local/`. Read-only on Vercel / public static leak on Docker; blocked in prod?
- **H4**: Baileys (`@whiskeysockets/baileys`) needs long-lived WebSocket; Vercel & Trigger.dev containers are ephemeral (`globalThis.__baileysLinkedDeviceSockets` empty in Trigger worker). Plus WhatsApp ToS/ban risk.
- **H5**: Inbox 4s polling x staff x serverless/Neon compute; visibility pause verified?
- **H6**: Trigger.dev Cloud worker env vars parity (`DATABASE_URL*`, `ENCRYPTION_KEY`, R2, Gotenberg, AI, Meta).
- **H7**: Vercel Hobby non-commercial restriction & timeout limits; Oracle Always Free idle reclamation / SPOF.
- **H8**: Optional integration env vars in `lib/env.ts` (`ENCRYPTION_KEY`, `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `GOTENBERG_API_KEY`) — fail-closed vs silent insecure/mock fallback? Config Health page?
- **H9**: `NEXT_PUBLIC_APP_URL` & `BETTER_AUTH_URL` defaulting to `http://localhost:3000` in prod.
- **H10**: `SKIP_ENV_VALIDATION=1` build bypass leaking into runtime.
- **H11**: Public `lookupApplicationStatus(reference, phone)` small keyspace `ART-YYYY-XXXX`, rate limiting, enumeration, PII leakage.
- **H12**: Every exported `"use server"` function is a public POST endpoint — verify all ~150+ actions for `requireAdmin()` / `requireSuperAdmin()`, plus `proxy.ts` coverage.
- **H13**: Unescaped user/flyer/WhatsApp/CMS strings interpolated into Chromium HTML templates (XSS + Chromium SSRF `file://` / `169.254.169.254`).
- **H14**: R2 bucket public vs private for quotation PDFs, mirrored WhatsApp pilgrim media (passports/IDs!), raw flyers; guessable keys.
- **H15**: Presign & local upload endpoints: MIME allow-list, size cap, key prefix, rate limit, magic-byte check, path traversal/overwrite.
- **H16**: Media mirror & URL fetchers: SSRF, size/time/redirect caps.
- **H17**: AES-256-GCM vault: missing/wrong key fallback (derived from `BETTER_AUTH_SECRET`?), legacy AES-256-CBC downgrade/oracle, key rotation & backup.
- **H18**: `whatsapp_linked_device_sessions` `qrDataUrl` / `pairingCode` stored in DB, cleared after connect? Role visibility?
- **H19**: Admin REGEX auto-reply rules => ReDoS on inbound stranger messages.
- **H20**: Prompt injection via flyers/WhatsApp into AI extraction & copilot; read-only tools, Zod output, server-enforced human approval, deterministic math recomputation.
- **H21**: Auth bootstrap, default/seed credentials, login rate limit, immediate session revocation when `isActive=false` or role demoted, password reset, cookies, `allowedOrigins`.
- **H22**: CSP & security headers (`proxy.ts` / `next.config.ts` / `nginx.conf`).
- **H23**: `bookedSeats` / `totalSeats` on `group_departures` — atomic SQL guard vs read-modify-write oversell race; seat release on cancel/reject; infants excluded; status transitions.
- **H24**: Money & numerics: integer/numeric precision, SAR/PKR rounding, server recomputation of totals, quote versioning, concurrent staff edits (optimistic locking).
- **H25**: Application status state machine: illegal transitions (`rejected -> approved`, etc.), RBAC, `audit_logs` table (missing?).
- **H26**: FK `ON DELETE` cascade/error when deleting catalog items (`hotels`, `vehicles`, `sectors`, `airlines`, `departure_cities`) referenced by historical applications/quotes.
- **H27**: Dates/timezones: PKT (UTC+5) vs KSA (UTC+3) vs UTC midnight boundaries.
- **H28**: Phone normalization (`03xx -> 923xx`) breaking international pilgrim numbers (+966, +44, +971, +1, `00` prefix) AND leading-zero `wa.me/03...` / `03...@s.whatsapp.net` bugs.
- **H29**: Reference-code collision handling under concurrency (`ART-YYYY-XXXX`, `ART-WA-...`, `ART-<SUP>-...`).
- **H30**: Webhook pipeline: raw body HMAC, `wamid` dedupe, status receipts updating messages + broadcast counters, message loss if Trigger dispatch fails after DB write or before HTTP 200, Meta retry storms.
- **H31**: WhatsApp 24h window enforcement across ALL send paths, STOP/opt-out handling, CSV broadcast consent, `do_not_contact` & 14-day cooldown enforced everywhere, bot-to-bot loops, duplicate intake dossiers.
- **H32**: Social providers: app review requirements, TikTok `SELF_ONLY`, IG container timeouts, idempotent publish on retry, first-comment failures, PKT slot collisions.
- **H33**: Cron `sla-overdue-quote-monitor` actual effect (where is overdue flag stored?) + overlap/idempotency of all 4 crons.
- **H34**: Accessibility contrast: Metallic Gold `#C5A059` on Warm Ivory `#FAF7F0` (~2.3:1 fails WCAG AA).
- **H35**: Seeded/fake testimonials, ratings, hotel distances, licence numbers, prayer times, disclaimers.
- **H36**: Test suite reality: mock-heavy unit tests, no real-Postgres integration, no Playwright E2E, no CI workflow, no coverage.
- **H37**: Missing prod fundamentals: `/api/health`, structured PII-redacted logging, error tracking, rate-limit store, `audit_logs`, CI, backup/restore drill, runbooks.

---

## 7. PHASE A AUDITOR ROSTER (W1, read-only on app source, write `web/docs/audit/findings/<ID>.md`)

- **A01**: Build, Dependencies & Repo Hygiene (`package.json`, `next.config.ts`, `Dockerfile`, `nginx.conf`, `.dockerignore`, `.gitignore`, `services/` AGPL boundary, Baileys RC pin, `npm audit`, secrets scan, Windows paths).
- **A02**: Auth, Authz & Sessions (`lib/auth*`, `proxy.ts`, `app/admin/(auth)/login`, staff lifecycle, session revocation, PLUS complete ~150-row `findings/A02-authz-matrix.md` across every page, API route, and Server Action).
- **A03**: Application Security OWASP (Zod bounds, mass assignment, XSS/`dangerouslySetInnerHTML`, Chromium HTML template injection/SSRF **H13**, R2/local uploads **H14–H16**, AES-GCM/CBC crypto **H17**, HMAC, headers/CSP, public form abuse).
- **A04**: Database, Schema & Data Integrity (`db/schema/*` vs `drizzle/*` migrations vs live local PG, CHECK/NOT NULL/FK `ON DELETE` **H26**, hot-query indexes + `EXPLAIN ANALYZE` on synthetic scale, `neon-http` transaction support, `whatsapp_message_type` duplicate case enum, JSONB read/write validation, PII inventory).
- **A05**: Domain Logic & Pricing Correctness (`lib/domain/*` — all 9 invariants, Masar 28 vs 30, room-splitter 1–40 pax, vehicle-capacity, date-chaining, Makkah->JED, Mode A/B math, quote-hints & server recomputation, property/table verification).
- **A06**: Public Journey Builder E2E (`components/planner/*`, `app/actions/applications.ts` — presets x pillars x sequences x pax, Visa-Only vs Live Rate UI, date picker, draft persistence, submit idempotency, international phones **H28**, empty/inactive catalog edge cases).
- **A07**: Group Packages & Seat Booking (`components/public/group-*`, `app/actions/groups.ts` — concurrent last-seat oversell race **H23**, infant seat exclusion, cancel seat release, past/closed departures, `wa.me` links).
- **A08**: Hajj Inquiry, Contact, Status Tracker & Public Abuse (`hajj-inquiry-section.tsx`, `contact-section.tsx`, `status-tracker.tsx` — `lookupApplicationStatus` brute-force/enumeration/PII **H11**, pilgrim quote approval & voucher reachability, `wa.me` leading zero, anti-spam).
- **A09**: Admin Dashboard, KPIs & Cmd+K Lookup (`app/admin/(dashboard)/page.tsx`, `components/admin/dashboard/*`, `command-lookup.ts` — SQL truth vs KPIs, double-counted quote versions in revenue, PKT bucketing, Smart Insights reality, `Cmd+K` conversion idempotency).
- **A10**: Applications Desk, Quote Worksheet, PDF, Email & Voucher (`desk-hub-client.tsx`, `applications/[id]/*`, `quotes.ts`, `render-quotation-pdf.ts` — Kanban keyboard/DnD/rollback, status state machine **H25**, quote versioning/concurrency, 3-page PDF layout/RTL/security, email existence check, voucher gating & pilgrim delivery, payment trail).
- **A11**: Poster & Supplier Studio (`studio-hub-client.tsx`, `marketing-ops.ts`, `extract-packages.ts`, `render-*-poster.ts` — upload limits, `sample_posts/` extraction accuracy, Mode A/B margin leakage, `ART-` code immutability/collisions, 1–10 card 4K/spotlight rendering, public package publish/unpublish).
- **A12**: AI Layer (`lib/ai/*`, `caption-copilot.ts`, `intent-classifier.ts`, `quoting-copilot.ts` — model ID validity, timeouts/retries/429, prompt injection corpus **H20**, read-only tools, deterministic math override, server-enforced human approval, PII in prompts).
- **A13**: Gotenberg, Rendering Infra, R2 & Media Pipeline (`gotenberg.ts`, `chromium-cdp.ts`, `scripts/oracle-gotenberg/*`, `lib/storage/r2.ts`, `media-mirror.ts` — fonts/Arabic/Urdu in container, CDP prod block **H2**, Caddy API-key/firewall hardening, R2 private vs public **H14**, local upload prod block **H3**).
- **A14**: WhatsApp Cloud API (`meta-api.ts`, `webhooks/whatsapp/route.ts`, `auto-responder.ts`, `intake-flow.ts`, `whatsapp-crm.ts` — HMAC, <150ms ack, Trigger-down message loss **H30**, status receipts, 4-priority bot + intake state machine, REGEX ReDoS **H19**, 24h window & DNC/STOP **H31**, CSV broadcasts & idempotency, Inbox 4s polling & race conditions).
- **A15**: Baileys Linked-Device Engine (`linked-device.ts`, `linked-device-auth-postgres.ts`, `whatsapp-linked-device.ts`, `send-whatsapp-group-campaign.task.ts` — multi-process `socketMap` empty in Trigger worker **H4**, serverless incompatibility, inbound message Trigger bypass, `03xx@s.whatsapp.net` JID bug, Signal key write amplification, ToS/ban risk & owner topology options).
- **A16**: Social Scheduler Core 5 (`lib/social/**`, `app/api/oauth/social/**`, `social-scheduler.ts` — OAuth state/PKCE/tunnel/multi-account, token refresh, IG/FB/TikTok/YT/GMB constraints & idempotency, unauthenticated `executeScheduledPostNowAction`, first-comment plug, PKT slots, Reactive Engagement & analytics sync reality, app review checklist).
- **A17**: Campaign Distribution & VIP Outreach CRM (`marketing-bridges.ts`, `marketing-ops.ts`, `campaigns-hub-client.tsx` — Meta Cloud API `@g.us`/`status@broadcast` bridge bug, 14-day cooldown math, inbound reply unlock, DNC/STOP enforcement across all channels, `outreach_logs` audit).
- **A18**: Trigger.dev v4 Tasks, Queues & Schedules (`trigger/*.ts`, `trigger.config.ts`, `trigger-realtime.ts` — inline prod block **H1**, worker env vars **H6**, queue limits, `AbortTaskRunError`, 4 crons overlap/idempotency & SLA monitor reality **H33**, public realtime token scoping).
- **A19**: CMS & Catalog Administration (`catalog.ts`, `cms.ts`, `catalog-hub-client.tsx` — all 16 CRUD entities, FK-safe deletes **H26**, `revalidatePath` freshness on public site, catalog <-> builder live coupling, XSS, RBAC).
- **A20**: Settings, Staff, Agency Info & Config Readiness (`settings/page.tsx`, `connections-settings-client.tsx`, `company-info.ts`, `lib/env.ts` — secret masking, dead `agency_settings` fields, lingering hardcoded phones, fail-closed env **H8–H10**, `/admin/settings?tab=health` design).
- **A21**: Frontend Quality, UX, Accessibility & Design System (`app/globals.css`, `design.md`, `components/**` — WCAG 2.2 AA, gold `#C5A059` on `#FAF7F0` contrast **H34**, zero `asChild`, zero dark mode, `font-mono tabular-nums`, keyboard/focus-trap, reduced-motion, 320px reflow, Urdu/Arabic RTL).
- **A22**: Performance & Scalability (RSC vs client bundle boundaries on `/`, bundle size per route, `force-dynamic` vs ISR/caching, DB N+1 queries, pooled vs direct Neon URL, serverless body/duration limits, webhook p95 latency & inbox polling load model).
- **A23**: Observability, Reliability & DevOps (`/api/health` absence, structured PII-redacted logging, `audit_logs` design, CI/CD GitHub Actions absence, backup/PITR drill, monthly cost model, ops runbooks inventory).
- **A24**: Test Strategy & QA Engineering (audit of existing 429 tests & mocks, coverage gaps, design of `tests/integration/`, `tests/e2e/` J1–J22, contract fixtures, authz regression runner).
- **A25**: Legal, Compliance & Content Truth (`/privacy` & `/terms` vs actual data/AI/WhatsApp/R2 flows, MoHU/licensing display, refund policy, WhatsApp broadcast consent, seeded/fake testimonials & numbers inventory **H35**).
- **A26**: Integration Chaos & Resilience (failure-injection matrix across {Gotenberg, Trigger, Neon, R2, AI, Meta, Social} x {down, 30s slow, 429, 500, malformed body, expired cred, partial success}).

---

## 8–12. JOURNEYS (J1–J22), TRIAGE/FIX/VERIFY (W2–W4), GATE A, PHASE B SEO (S01–S16, W5–W7, GATE B), OWNER DECISIONS (§11) & FINAL DELIVERABLES (§12)

1. **W2 Triage**: Dedupe `findings/*.md` into `02-triage.md` & `02-ownership.md` (exclusive file ownership per fixer; `F-PLAT` owns shared hot files `db/schema/*`, `lib/env.ts`, `proxy.ts`, `package.json`, `app/layout.tsx`, `lib/auth-guard.ts`). Escalate batched **Owner Decision Memo (§11)** before guessing on topology, email provider, payments, voucher delivery, tracker OTP, data retention, hosting plans, languages, invariant ambiguities, real vs seed data, and social app reviews.
2. **W3 Fix**: Parallel fixers in isolated workspaces (`workspace:"share"`), strict red->green tests, atomic commits citing finding IDs, updating `03-fix-log.md` and Spec `0024`.
3. **W4 Verify & Gate A**: Verifiers V01–V06 + fresh adversarial re-audit on P0/P1s -> `04-verification.md` & `PRODUCTION_READINESS.md`.
4. **Phase B SEO (Spec 0025, only after Gate A)**: S01–S16 SEO audit -> F-SEO-* fixers (`robots.ts`, `sitemap.ts`, programmatic routes `/umrah-packages/[slug]`, `/umrah-packages/from-[city]`, `/hajj-2027`, `/umrah-visa`, `/hotels/*`, `/ziyarat/*`, `/faq`, `/about`, `/contact`, `/refund-policy`, custom 404/500, truthful JSON-LD, dynamic OG images, CWV optimization, UTM attribution) -> S16 SEO QA & Gate B -> `FINAL_REPORT.md`.
