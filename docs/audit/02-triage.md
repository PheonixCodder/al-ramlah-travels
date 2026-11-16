# 02 — Master Deduplicated Production-Readiness Backlog (`T-001`..`T-097`)

**Author**: `w2-triage` (Wave 2 Master Backlog Deduplicator & §11 Owner Decision Author)  
**Workspace**: `c:\dev\al-ramlah-travels\web` (`audit/production-hardening`)  
**Inputs Consolidated**: `w0-env-baseline.md` (`W0-001`..`W0-007`) + all 27 Wave 1 Auditor Reports (`A00.md`..`A26.md` + `A02-authz-matrix.md`) + `00-ground-truth.md` + `01-feature-parity.md` + `02-ownership.md`  
**Traceability Guarantee**: **383 / 383 (100.0%)** raw findings mapped 1-to-1 into **97** crisp, single-owner Canonical Backlog Items (**0** missed raw IDs, **0** cross-fixer file collisions).

---

## 1. Executive Severity & Gate Rollup

| Severity Tier | Raw Findings (`W0` + `A00`–`A26`) | Canonical Backlog Items (`T-ID`s) | Deduplication Ratio | `UNBLOCKED` (Ready Immediately) | `NEEDS_DECISION` (`OD-01`–`OD-11`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **P0** | 96 | **40** | 2.40× | 23 | 17 |
| **P1** | 179 | **38** | 4.71× | 16 | 22 |
| **P2** | 95 | **15** | 6.33× | 8 | 7 |
| **P3** | 13 | **4** | 3.25× | 4 | 0 |
| **TOTAL** | **383** | **97** | **3.95×** | **51** | **46** |

### 1.1 Workload & Ownership Distribution Across the 12 Wave 3 Fixers

| Sub-Wave | Fixer Owner | Canonical Items | Raw Findings Absorbed | `P0` | `P1` | `P2` | `P3` | `UNBLOCKED` | `NEEDS_DECISION` | Assigned `T-ID`s |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `W3A` | **`F-PLAT`** | **19** | 83 | 9 | 7 | 2 | 1 | 14 | 5 | `T-001`, `T-002`, `T-003`, `T-004`, `T-005`, `T-006`, `T-007`, `T-008`, `T-009`, `T-041`, `T-042`, `T-043`, `T-044`, `T-045`, `T-046`, `T-047`, `T-079`, `T-080`, `T-094` |
| `W3B` | **`F-DOM`** | **7** | 23 | 3 | 3 | 1 | 0 | 3 | 4 | `T-010`, `T-011`, `T-012`, `T-048`, `T-049`, `T-050`, `T-081` |
| `W3B` | **`F-INFRA`** | **6** | 22 | 3 | 2 | 1 | 0 | 2 | 4 | `T-013`, `T-014`, `T-015`, `T-051`, `T-052`, `T-082` |
| `W3B` | **`F-PUB`** | **14** | 51 | 5 | 5 | 3 | 1 | 5 | 9 | `T-016`, `T-017`, `T-018`, `T-019`, `T-020`, `T-053`, `T-054`, `T-055`, `T-056`, `T-057`, `T-083`, `T-084`, `T-085`, `T-095` |
| `W3B` | **`F-DESK`** | **9** | 34 | 4 | 4 | 1 | 0 | 4 | 5 | `T-021`, `T-022`, `T-023`, `T-024`, `T-058`, `T-059`, `T-060`, `T-061`, `T-086` |
| `W3B` | **`F-STUDIO`** | **8** | 30 | 4 | 3 | 1 | 0 | 4 | 4 | `T-025`, `T-026`, `T-027`, `T-028`, `T-062`, `T-063`, `T-064`, `T-087` |
| `W3B` | **`F-WA`** | **9** | 51 | 4 | 4 | 1 | 0 | 5 | 4 | `T-029`, `T-030`, `T-031`, `T-032`, `T-065`, `T-066`, `T-067`, `T-068`, `T-088` |
| `W3B` | **`F-SOCIAL`** | **8** | 30 | 4 | 3 | 1 | 0 | 2 | 6 | `T-033`, `T-034`, `T-035`, `T-036`, `T-069`, `T-070`, `T-071`, `T-089` |
| `W3B` | **`F-JOBS`** | **5** | 20 | 1 | 3 | 1 | 0 | 3 | 2 | `T-037`, `T-072`, `T-073`, `T-074`, `T-090` |
| `W3B` | **`F-ADMIN`** | **5** | 19 | 1 | 3 | 1 | 0 | 3 | 2 | `T-038`, `T-075`, `T-076`, `T-077`, `T-091` |
| `W3B` | **`F-UX`** | **2** | 3 | 0 | 0 | 1 | 1 | 2 | 0 | `T-092`, `T-096` |
| `W3C` | **`F-QA`** | **5** | 17 | 2 | 1 | 1 | 1 | 4 | 1 | `T-039`, `T-040`, `T-078`, `T-093`, `T-097` |
| **ALL** | **12 Fixers** | **97** | **383** | **40** | **38** | **15** | **4** | **51** | **46** | `T-001`..`T-097` |

### 1.2 Owner Decision Gate Summary (`OWNER_DECISIONS.md`)

All **46** gated items carry a concrete **Recommended Default** in [OWNER_DECISIONS.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/OWNER_DECISIONS.md). If the Owner replies **"APPROVED ALL DEFAULTS"**, all 46 gated items unlock immediately alongside the 51 already-unblocked items.

| Decision ID | Decision Topic | Gated Count | Gated `T-ID`s |
| :--- | :--- | :---: | :--- |
| **`OD-01`** | Baileys Linked-Device Topology & Safe WA Group/Status Queue | **2** | `T-032`, `T-073` |
| **`OD-02`** | Transactional Email Provider & Admin Password-Reset Transport | **2** | `T-043`, `T-059` |
| **`OD-03`** | Pilgrim Payments Scope & Append-Only Receipt Ledger | **1** | `T-042` |
| **`OD-04`** | Online Pilgrim Quote Acceptance & Public Signed Voucher Unlock Rule | **2** | `T-017`, `T-023` |
| **`OD-05`** | Public Status Tracker (`/#track-status`) Authentication Strength | **1** | `T-016` |
| **`OD-06`** | Passport/CNIC PII Storage, Private R2 Signed URLs, Retention TTLs & AI ZDR | **5** | `T-014`, `T-020`, `T-028`, `T-052`, `T-080` |
| **`OD-07`** | Production Hosting Tier, Cron Cadence, Oracle VM & `super_admin` RBAC Policy | **7** | `T-045`, `T-051`, `T-060`, `T-068`, `T-071`, `T-074`, `T-075` |
| **`OD-08`** | Supported Public Languages (`en` + `<ArabicText>` vs Full `/ur` RTL) & Prayer Times | **1** | `T-085` |
| **`OD-09`** | Haramain Business-Invariant Clarifications (Masar 30d, Mode B `0`-Tier, Seats, Infants, Hajj 2027) | **11** | `T-010`, `T-011`, `T-012`, `T-019`, `T-022`, `T-048`, `T-055`, `T-058`, `T-062`, `T-063`, `T-083` |
| **`OD-10`** | Verified Lahore HQ Address, Phones, Meezan IBAN, Pakistan Licenses & Seeded Content Purge | **10** | `T-007`, `T-013`, `T-031`, `T-056`, `T-067`, `T-077`, `T-084`, `T-087`, `T-089`, `T-093` |
| **`OD-11`** | Core 5 Social App-Review Scope, Google Business Profile v1 Migration & Reactive Auto-Plugs | **4** | `T-035`, `T-036`, `T-069`, `T-070` |

---

## 2. Ranked Canonical Backlog (`P0 → P1 → P2 → P3`)

> **Wave 3 Execution Rule**: Each fixer edits **only** the `Target Files` owned by its Fixer ID in `02-ownership.md` and writes red→green unit/regression tests under `tests/w3/<fixer-id>/*.test.ts` (`F-QA` owns `tests/unit|integration|e2e/**` & legacy `tests/*.test.ts` in `W3C`).

### 2.1 `P0` — Critical Release Blockers (Data Loss, Auth Bypass, RCE/SSRF/XSS, Financial/PII Exposure)

#### T-001 — [P0] Upgrade Next.js 16.3.4 to patched 16.x release & strip CLI/dev bloat from production dependencies
- **T-ID**: `T-001`
- **Severity**: `P0`
- **Title**: Upgrade Next.js 16.3.4 to patched 16.x release & strip CLI/dev bloat from production dependencies
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `package.json`, `package-lock.json`
- **Source Finding IDs** (2): `A01-001`, `W0-006`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Upgrade `next` and `eslint-config-next` to the latest patched `16.4.x+` release remediating critical RCE/SSRF/cache-poisoning advisories; move `shadcn`, `drizzle-kit`, and CLI build-only packages to `devDependencies`; move runtime `dotenv` to `dependencies` or remove direct prod imports; and verify `npm audit --omit=dev --audit-level=high` exits `0`.
- **Red->Green Test**: `tests/w3/f-plat/deps-and-security-config.test.ts` — asserts `package.json` `next` version satisfies patched semver, `shadcn` is absent from `dependencies`, and `npm audit --omit=dev --audit-level=high` reports 0 high/critical vulnerabilities.

#### T-002 — [P0] Lock `next.config.ts` image proxy allowlist, dev-tunnel origins, and `@vercel/nft` `.env`/`uploads` bundle exclusions
- **T-ID**: `T-002`
- **Severity**: `P0`
- **Title**: Lock `next.config.ts` image proxy allowlist, dev-tunnel origins, and `@vercel/nft` `.env`/`uploads` bundle exclusions
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `next.config.ts`
- **Source Finding IDs** (4): `A01-002`, `A01-003`, `A03-005`, `A03-006`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Replace `images.remotePatterns` wildcard `hostname: "**"` with explicit HTTPS hosts (`*.r2.dev`, custom R2 CDN domain, `lh3.googleusercontent.com`); gate `.trycloudflare.com` / `.ngrok-free.app` `serverActions.allowedOrigins` strictly behind `NODE_ENV === "development"`; and add `outputFileTracingExcludes` so `.env*` and `public/uploads/**` (`24.6 MB`) are never traced into serverless bundles.
- **Red->Green Test**: `tests/w3/f-plat/deps-and-security-config.test.ts` — asserts `next.config.ts` under `NODE_ENV=production` rejects wildcard image hosts and tunnel origins, and verifies `outputFileTracingExcludes` blocks `.env` and `public/uploads/**`.

#### T-003 — [P0] Harden `lib/env.ts` to fail closed in production, block `SKIP_ENV_VALIDATION`, and unify AI/URL env keys
- **T-ID**: `T-003`
- **Severity**: `P0`
- **Title**: Harden `lib/env.ts` to fail closed in production, block `SKIP_ENV_VALIDATION`, and unify AI/URL env keys
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `lib/env.ts`, `.env.example`
- **Source Finding IDs** (4): `A20-003`, `A01-009`, `A12-004`, `A20-004`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Throw hard startup errors when `NODE_ENV === "production"` and `SKIP_ENV_VALIDATION` is truthy, when `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` default to `localhost`, or when `BETTER_AUTH_SECRET` / `ENCRYPTION_KEY` match `.env.example` placeholders or `<32` bytes; reconcile `GOOGLE_GENERATIVE_AI_API_KEY` + `GEMINI_API_KEY` alias in `lib/env.ts` SSoT.
- **Red->Green Test**: `tests/w3/f-plat/env-validation.test.ts` — asserts `parseEnv()` throws under `NODE_ENV=production` on `SKIP_ENV_VALIDATION=1`, `http://localhost:3000`, or placeholder secrets, and resolves unified AI keys.

#### T-004 — [P0] Disable unauthenticated `/api/auth/sign-up/email` self-registration & enforce strict Better Auth cookies/CSRF/active-user guards
- **T-ID**: `T-004`
- **Severity**: `P0`
- **Title**: Disable unauthenticated `/api/auth/sign-up/email` self-registration & enforce strict Better Auth cookies/CSRF/active-user guards
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `lib/auth.ts`, `lib/auth-client.ts`, `lib/auth-guard.ts`, `app/api/auth/[...all]/route.ts`
- **Source Finding IDs** (2): `A02-001`, `A02-007`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Set `emailAndPassword: { enabled: true, disableSignUp: true }` in `lib/auth.ts` (and block `POST /api/auth/sign-up/*` at route layer with `403`), enforce `__Secure-` cookies and prod-only `trustedOrigins`, remove `http://localhost:3000` fallback from `lib/auth-client.ts`, and update `requireAdmin()` / `requireSuperAdmin()` in `lib/auth-guard.ts` (wrapped in `react.cache()`) to verify live `user.isActive === true` in DB.
- **Red->Green Test**: `tests/w3/f-plat/auth-lockdown.test.ts` — proves anonymous `POST /api/auth/sign-up/email` returns `403` without creating a `user` row, and `requireAdmin()` rejects deactivated sessions immediately.

#### T-005 — [P0] Replace stateless `neon-http` with transactional `Pool` (`withTransaction`) + local TCP `pg` driver support
- **T-ID**: `T-005`
- **Severity**: `P0`
- **Title**: Replace stateless `neon-http` with transactional `Pool` (`withTransaction`) + local TCP `pg` driver support
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `db/index.ts`, `drizzle.config.ts`, `package.json`
- **Source Finding IDs** (5): `A00-006`, `A04-004`, `A26-001`, `A22-007`, `W0-004`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Export `db` + `withTransaction(fn)` in `db/index.ts` backed by `@neondatabase/serverless` WebSocket `Pool` (`drizzle-orm/neon-serverless`) for `*.neon.tech` URLs and `pg.Pool` (`drizzle-orm/node-postgres`) for local/CI TCP PostgreSQL (`127.0.0.1`), wiring `DATABASE_URL_UNPOOLED` in `drizzle.config.ts` so `db.transaction()` and `SELECT ... FOR UPDATE` work identically in local Docker, CI, and Neon prod.
- **Red->Green Test**: `tests/w3/f-plat/db-transactions.test.ts` — runs a multi-table insert inside `withTransaction()` that throws mid-flight and asserts 100% rollback plus working `FOR UPDATE` row locks.

#### T-006 — [P0] Reconcile Drizzle SQL migrations (`drizzle/`) for all 43+ tables, `whatsapp_linked_device_sessions`, and `marketing_channels` unique index
- **T-ID**: `T-006`
- **Severity**: `P0`
- **Title**: Reconcile Drizzle SQL migrations (`drizzle/`) for all 43+ tables, `whatsapp_linked_device_sessions`, and `marketing_channels` unique index
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `db/schema/whatsapp-crm.ts`, `db/schema/suppliers-and-marketing.ts`, `drizzle/meta/_journal.json`
- **Source Finding IDs** (4): `A04-001`, `A04-002`, `A15-003`, `W0-002`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Generate and reconcile forward SQL migration in `drizzle/` creating `whatsapp_linked_device_status` enum, `whatsapp_linked_device_sessions` table, and unified `idx_marketing_channels_external_handle` unique index `(channel_type, external_identifier)` matching `ON CONFLICT` clauses across app and sync scripts, ensuring `npx drizzle-kit migrate` succeeds from an empty database.
- **Red->Green Test**: `tests/w3/f-plat/schema-migration-parity.test.ts` — verifies journaled SQL migrations define all schema tables, enums, and `idx_marketing_channels_external_handle` with zero drift.

#### T-007 — [P0] Fix `db/seed.ts` 90-day visa overwrite & hardcoded `Admin@123456` passwords; guard destructive `scripts/*.ts` & add `db-backup.ts`
- **T-ID**: `T-007`
- **Severity**: `P0`
- **Title**: Fix `db/seed.ts` 90-day visa overwrite & hardcoded `Admin@123456` passwords; guard destructive `scripts/*.ts` & add `db-backup.ts`
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `db/seed.ts`, `scripts/purge-all-demo-data.ts`, `scripts/db-package-cleanup.ts`, `scripts/db-backup.ts`
- **Source Finding IDs** (6): `A02-004`, `A04-003`, `A04-006`, `W0-001`, `W0-007`, `A23-009`
- **Gate Status**: `NEEDS_DECISION: OD-10`
- **Concrete Fix Summary**: Fix copy-paste bug in `db/seed.ts` where `long_term` `.onConflictDoUpdate` referenced `shortTermRate` values (`PKR 43,500` overwriting 90-day `PKR 68,000`); require `ADMIN_BOOTSTRAP_PASSWORD` env var on initial bootstrap (never seeding `Admin@123456`/`Staff@123456` or re-activating/overwriting existing staff accounts); seed verified `OD-10` agency defaults; block `scripts/purge-all-demo-data.ts` & `db-package-cleanup.ts` on prod hosts without `--confirm-env=<host>`; and add automated `scripts/db-backup.ts`.
- **Red->Green Test**: `tests/w3/f-plat/seed-idempotency-and-guards.test.ts` — runs `seed()` twice and asserts `long_term` visa rate stays distinct from `short_term`, deactivated users stay deactivated, weak default passwords are rejected, and purge scripts abort on `.neon.tech` without explicit flag.

#### T-008 — [P0] Build shared `lib/security/` primitives (`html-escape`, `ssrf-guard`, `fetch-with-timeout` + safe JSON, and versioned `v2:` AES-256-GCM HKDF `vault`)
- **T-ID**: `T-008`
- **Severity**: `P0`
- **Title**: Build shared `lib/security/` primitives (`html-escape`, `ssrf-guard`, `fetch-with-timeout` + safe JSON, and versioned `v2:` AES-256-GCM HKDF `vault`)
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `lib/security/html-escape.ts`, `lib/security/ssrf-guard.ts`, `lib/security/fetch-with-timeout.ts`, `lib/security/vault.ts`
- **Source Finding IDs** (5): `A26-002`, `A03-007`, `A20-006`, `A23-008`, `A26-007`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Implement `escapeHtml` / `escapeAttr` in `lib/security/html-escape.ts`; `assertSafeExternalUrl` in `lib/security/ssrf-guard.ts` (blocking local paths, `file:`, `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254.169.254`, IPv6 ULA/loopback after DNS resolution); `fetchWithTimeout` + `parseJsonResponse` (enforcing `AbortSignal.timeout`, `res.ok` + `Content-Type` checks before `.json()`, and `Retry-After` parsing); and `lib/security/vault.ts` (`v2:<kid>:<iv>:<tag>:<ct>` AES-256-GCM with HKDF-SHA256 key derivation, keyring rotation `ENCRYPTION_KEY_PREVIOUS`, and removal of unauthenticated AES-CBC encryption).
- **Red->Green Test**: `tests/w3/f-plat/security-primitives.test.ts` — unit-tests HTML escaping, SSRF private-IP/DNS-rebind rejection, hung-socket timeout + HTML-error-page JSON guard, and `v2:` vault encrypt/decrypt/key-rotation + tamper rejection.

#### T-009 — [P0] Create immutable `audit_logs` table, PostgreSQL `enforceRateLimit` store, and PII-redacting `lib/logger.ts`
- **T-ID**: `T-009`
- **Severity**: `P0`
- **Title**: Create immutable `audit_logs` table, PostgreSQL `enforceRateLimit` store, and PII-redacting `lib/logger.ts`
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `db/schema/audit-logs.ts`, `db/schema/auth.ts`, `db/schema/index.ts`, `lib/audit-log.ts`, `lib/rate-limit.ts`, `lib/logger.ts`
- **Source Finding IDs** (5): `A23-001`, `A23-002`, `A23-003`, `A02-008`, `A00-022`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Add append-only `audit_logs` table (`actorId`, `actorRole`, `action`, `entityType`, `entityId`, `beforeJson`, `afterJson`, `ipHash`, `createdAt`) + `recordAuditLog()`; add PostgreSQL `rate_limit` bucket table + `enforceRateLimit()` with trusted proxy IP extraction (`CF-Connecting-IP` / `X-Forwarded-For` rightmost trusted hop) wired into Better Auth database storage so `no-trusted-ip` never locks out all admins globally; and add structured `lib/logger.ts` redacting phone numbers, WhatsApp JIDs, pairing codes, tokens, and SQL bind parameters.
- **Red->Green Test**: `tests/w3/f-plat/audit-ratelimit-logger.test.ts` — verifies `logger` redacts `+923001234567`, `s.whatsapp.net` JIDs, pairing codes, and bearer tokens; `enforceRateLimit` blocks N+1th attempt per IP; and `recordAuditLog` persists immutable entries.

#### T-010 — [P0] Unify `lib/domain/visa-calc.ts` Masar SAR (`<=10d/15d/21d/30d`) vs fixed PKR Visa-Only pricing & inclusive KSA day math
- **T-ID**: `T-010`
- **Severity**: `P0`
- **Title**: Unify `lib/domain/visa-calc.ts` Masar SAR (`<=10d/15d/21d/30d`) vs fixed PKR Visa-Only pricing & inclusive KSA day math
- **Fixer Owner**: `F-DOM`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/domain/visa-calc.ts`, `lib/validations/catalog.ts`
- **Source Finding IDs** (3): `A00-005`, `A05-003`, `A05-009`
- **Gate Status**: `NEEDS_DECISION: OD-09`
- **Concrete Fix Summary**: Resolve inclusive calendar-day vs stay-night off-by-one and the `28d` vs `30d` short-term ceiling gap in `lib/domain/visa-calc.ts`: keep `Visa Only` on fixed admin PKR rates (`short_term <= 30d`, `long_term > 30d`), activate Masar SAR brackets (`<=10d`, `<=15d`, `<=21d`, `<=30d`) converted via live `agency_settings.sarToPkrRate` when `includeHotels=true`, and expose clear tier metadata to both Planner and Quoting Copilot.
- **Red->Green Test**: `tests/w3/f-dom/visa-masar-calc.test.ts` — tests boundary stays (`10d`, `14n/15d`, `21d`, `28d`, `29d`, `30d`, `31d`, `90d`) across `Visa Only` and `Visa + Hotels` modes with deterministic SAR->PKR conversion.

#### T-011 — [P0] Fix Mode B (`net_plus_markup`) `0`-tier `PKR 25,000` mispricing & enforce permanent `do_not_contact` in 14-day PKT cooldown
- **T-ID**: `T-011`
- **Severity**: `P0`
- **Title**: Fix Mode B (`net_plus_markup`) `0`-tier `PKR 25,000` mispricing & enforce permanent `do_not_contact` in 14-day PKT cooldown
- **Fixer Owner**: `F-DOM`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/domain/marketing-ops.ts`
- **Source Finding IDs** (2): `A05-001`, `A05-004`
- **Gate Status**: `NEEDS_DECISION: OD-09`
- **Concrete Fix Summary**: Update Mode B markup helper in `lib/domain/marketing-ops.ts` so `0` / `null` unpriced supplier room tiers stay `0` (`Unpriced / N/A`) instead of adding `commissionPkr` onto `0`; update `calculateOutreachCooldown` so `doNotContact === true` permanently returns `{ canContact: false, reason: "do_not_contact" }` regardless of inbound replies or elapsed days.
- **Red->Green Test**: `tests/w3/f-dom/marketing-ops-domain.test.ts` — asserts Mode B `[320000, 0, 0, 0] + 25000` yields `[345000, 0, 0, 0]` (never `25000`) and `doNotContact: true` never unlocks after inbound messages.

#### T-012 — [P0] Enforce cross-field KSA date/stay/pillar/passenger bounds & `ART-WA-...` tracker regex in `lib/validations/application.ts`
- **T-ID**: `T-012`
- **Severity**: `P0`
- **Title**: Enforce cross-field KSA date/stay/pillar/passenger bounds & `ART-WA-...` tracker regex in `lib/validations/application.ts`
- **Fixer Owner**: `F-DOM`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/validations/application.ts`
- **Source Finding IDs** (8): `A05-005`, `A03-011`, `A05-012`, `A06-005`, `A06-006`, `A06-008`, `A08-005`, `A07-011`
- **Gate Status**: `NEEDS_DECISION: OD-09`
- **Concrete Fix Summary**: Add `.superRefine()` invariants to `lib/validations/application.ts`: require valid ISO calendar dates (`departure >= arrival`, `<= 90` days, required KSA dates on `Visa Only`), contiguous hotel stays matching KSA window when `includeHotels=true`, `>=1` enabled service pillar, realistic passenger caps (`adults: 1..30`, `children: 0..20`, `infants <= adults`), string/array max lengths, international E.164 phone acceptance (rejecting `"-------"` hyphen-only strings), and `statusLookupSchema` support for both `ART-YYYYMMDD-...` and `ART-WA-YYYYMMDD-...`.
- **Red->Green Test**: `tests/w3/f-dom/application-validations.test.ts` — rejects inverted dates, Feb 31, 0-pillar payloads, `"-------"` phones, >30 adults, and accepts international `+44`/`+1` numbers plus `ART-WA-...` status lookups.

#### T-013 — [P0] Purge committed `[REDACTED CLIENT FAMILY]` quotation PDF & local R2 samples; compress `10.64 MB` `logo-icon.png`
- **T-ID**: `T-013`
- **Severity**: `P0`
- **Title**: Purge committed `[REDACTED CLIENT FAMILY]` quotation PDF & local R2 samples; compress `10.64 MB` `logo-icon.png`
- **Fixer Owner**: `F-INFRA`
- **Sub-Wave**: `W3B`
- **Target Files**: `public/logo-icon.png`, `public/logo.jpg`, `public/tiktok-app-icon-1024.png`, `public/uploads/`
- **Source Finding IDs** (4): `A01-004`, `A22-001`, `A25-004`, `A22-012`
- **Gate Status**: `NEEDS_DECISION: OD-10`
- **Concrete Fix Summary**: Delete committed real client quotation PDF (`public/uploads/sample-posts/*-quotation.pdf`), raw wholesale supplier sheets, and tracked `public/uploads/r2-local/**` artifacts; resize/compress `public/logo-icon.png` (`10.64 MB` -> `<40 KB`) and `public/logo.jpg` (`667 KB` -> `<80 KB`) so Gotenberg embedded-logo HTML payloads shrink from `42.55 MB` to `<200 KB` (eliminating `OOM` / timeouts); and flag `git filter-repo` history scrub instructions for owner execution.
- **Red->Green Test**: `tests/w3/f-infra/public-assets-hygiene.test.ts` — asserts zero `.pdf` or raw sample files exist under `public/uploads/` and `public/logo-icon.png` + `public/logo.jpg` are each `<100 KB`.

#### T-014 — [P0] Remove prod `r2-local` disk fallback & Wrangler token scraping; split private PII R2 keys with signed media proxy & video presign support
- **T-ID**: `T-014`
- **Severity**: `P0`
- **Title**: Remove prod `r2-local` disk fallback & Wrangler token scraping; split private PII R2 keys with signed media proxy & video presign support
- **Fixer Owner**: `F-INFRA`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/storage/r2.ts`, `app/api/uploads/local/route.ts`, `app/api/uploads/presign/route.ts`, `app/api/media/[...key]/route.ts`
- **Source Finding IDs** (7): `A00-003`, `A03-002`, `A03-003`, `A13-002`, `A13-003`, `A25-001`, `A26-004`
- **Gate Status**: `NEEDS_DECISION: OD-06`
- **Concrete Fix Summary**: Remove host `~/.wrangler` OAuth token scraping and `public/uploads/r2-local` writes in production from `lib/storage/r2.ts` (failing closed when R2 env vars are absent); return `404` in production on `/api/uploads/local` and enforce `requireAdmin()`, strict MIME magic-byte/extension map, UUID keys, and size caps in dev; add `video/mp4` & `video/quicktime` + `ContentLength` enforcement to `/api/uploads/presign`; route private PII prefixes (`passports/`, `whatsapp-media/`, `quotes/`, `receipts/`) through authenticated/HMAC-signed `/api/media/[...key]` (`5–15m` presigned R2 GET URLs, `Cache-Control: private, no-store`).
- **Red->Green Test**: `tests/w3/f-infra/r2-and-uploads-security.test.ts` — verifies prod R2 fails closed without writing to `public/`, `/api/uploads/local` blocks unauthenticated/HTML uploads, `/api/uploads/presign` accepts bounded MP4s, and private keys require auth/valid signature.

#### T-015 — [P0] Fix Gotenberg v8 screenshot URL (`404`), enforce fetch timeouts, and block `--no-sandbox` local Chrome fallback in production
- **T-ID**: `T-015`
- **Severity**: `P0`
- **Title**: Fix Gotenberg v8 screenshot URL (`404`), enforce fetch timeouts, and block `--no-sandbox` local Chrome fallback in production
- **Fixer Owner**: `F-INFRA`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/posters/gotenberg.ts`, `lib/posters/chromium-cdp.ts`
- **Source Finding IDs** (3): `A13-001`, `A00-009`, `A13-004`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Fix `lib/posters/gotenberg.ts` screenshot path to `/forms/chromium/screenshot/html` (v8 standard), attach `AbortSignal.timeout(30_000)` + `Gotenberg-Trace` correlation ID, propagate non-2xx errors instead of swallowing them, and disable `lib/posters/chromium-cdp.ts` (`--no-sandbox`) in production (`NODE_ENV === "production"` unless `ALLOW_LOCAL_CDP_DEV=1`) while bounding any dev CDP session promises and temp profiles.
- **Red->Green Test**: `tests/w3/f-infra/gotenberg-client.test.ts` — verifies `/forms/chromium/screenshot/html` endpoint, `AbortSignal` timeout propagation, HTTP 500 error surfacing, and hard block on `chromium-cdp` when `NODE_ENV=production`.

#### T-016 — [P0] Eliminate `lookupApplicationStatus` empty-phone auth bypass (`endsWith("")`), add 48-bit CSPRNG references & PostgreSQL rate limiting
- **T-ID**: `T-016`
- **Severity**: `P0`
- **Title**: Eliminate `lookupApplicationStatus` empty-phone auth bypass (`endsWith("")`), add 48-bit CSPRNG references & PostgreSQL rate limiting
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/applications.ts`, `components/public/status-tracker.tsx`
- **Source Finding IDs** (3): `A02-003`, `A08-001`, `A04-010`
- **Gate Status**: `NEEDS_DECISION: OD-05`
- **Concrete Fix Summary**: Replace `Math.random()` 20-bit reference generation in `app/actions/applications.ts` with `crypto.randomBytes(6)` CSPRNG (`ART-YYYYMMDD-<8-char-base32>`); enforce `enforceRateLimit("status-tracker", ip)` (`5` attempts / `15m`); query `eq(applications.referenceNumber, normalizedRef)` (using B-tree unique index instead of `ILIKE`); require both stored and input normalized phone digits to have `>=9` national digits with constant-time exact match (never `endsWith("")`); return uniform generic failure messages; and strip internal staff/supplier fields from public DTOs.
- **Red->Green Test**: `tests/w3/f-pub/status-tracker-auth.test.ts` — proves `""`, `"-------"`, and short suffixes return generic denial, empty-phone DB rows fail closed, 6th rapid lookup hits rate limit, and internal notes are absent from returned payload.

#### T-017 — [P0] Add online Pilgrim Quote Acceptance on `/#track-status` & capability-signed public `/voucher/[token]` with QR code
- **T-ID**: `T-017`
- **Severity**: `P0`
- **Title**: Add online Pilgrim Quote Acceptance on `/#track-status` & capability-signed public `/voucher/[token]` with QR code
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/applications.ts`, `components/public/status-tracker.tsx`, `app/(public)/voucher/[token]/page.tsx`
- **Source Finding IDs** (2): `A08-002`, `A00-011`
- **Gate Status**: `NEEDS_DECISION: OD-04`
- **Concrete Fix Summary**: Add `respondToApplicationQuoteAction` (`accept` / `request_revision` with phone + reference/token verification and `audit_logs` entry) wired to interactive buttons on `<StatusTracker />` when `status === "quoted"`; create public `app/(public)/voucher/[token]/page.tsx` verified by HMAC/DB capability token + QR verification badge, rendering ONLY when `status === "approved"` and payment gate (`OD-04`) is satisfied.
- **Red->Green Test**: `tests/w3/f-pub/quote-acceptance-and-voucher.test.ts` — tests pilgrim quote acceptance transition (`quoted -> approved` / `revision_requested`) and asserts `/voucher/[token]` returns `403/404` when unpaid, unapproved, or tampered.

#### T-018 — [P0] Fix Visa-Only `PKR 0` quote bypass & `hasCityLegs` flight/airport wipe in `submitCustomUmrahApplication` & `PlannerContext`
- **T-ID**: `T-018`
- **Severity**: `P0`
- **Title**: Fix Visa-Only `PKR 0` quote bypass & `hasCityLegs` flight/airport wipe in `submitCustomUmrahApplication` & `PlannerContext`
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/applications.ts`, `components/planner/planner-context.tsx`, `components/planner/city-sequence-module.tsx`
- **Source Finding IDs** (2): `A06-001`, `A06-002`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Wrap `submitCustomUmrahApplication` inside `withTransaction()`; fail closed if active `visa_rates` row is missing (never persisting `PKR 0` official Visa-Only quotes); compute Masar SAR visa tier server-side when `includeHotels=true`; and unify `hasCityLegs` across `PlannerContext` and `submitCustomUmrahApplication` so selected departure airport, airline, Makkah-first `JED` entry lock, and flight preferences are never overwritten to `null` when Hotels/Transport toggles vary.
- **Red->Green Test**: `tests/w3/f-pub/custom-builder-persistence.test.ts` — verifies Visa-Only rejects missing rate tables instead of quoting `PKR 0`, Makkah-first locks entry airport to `JED`, and Flights+Visa without Hotels persists selected `departureCityId` & `preferredAirlineId`.

#### T-019 — [P0] Block cross-package `groupDepartureId` price spoofing & align `booked_seats` reservation lifecycle in `submitGroupBookingApplication`
- **T-ID**: `T-019`
- **Severity**: `P0`
- **Title**: Block cross-package `groupDepartureId` price spoofing & align `booked_seats` reservation lifecycle in `submitGroupBookingApplication`
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/applications.ts`, `components/public/group-booking-modal.tsx`, `components/public/group-packages-section.tsx`
- **Source Finding IDs** (2): `A07-001`, `A07-002`
- **Gate Status**: `NEEDS_DECISION: OD-09`
- **Concrete Fix Summary**: Validate `and(eq(groupDepartures.id, groupDepartureId), eq(groupDepartures.groupPackageId, groupPackageId))` inside `withTransaction()` so callers cannot pair a cheap departure batch with a luxury 5-star package; verify `status === "open"`, `departureDate >= todayPKT`, and `totalSeats - bookedSeats >= (adults + children)` at submission while deferring hard `booked_seats` deduction to admin `approved` confirmation (`OD-09d`).
- **Red->Green Test**: `tests/w3/f-pub/group-booking-integrity.test.ts` — proves mismatched `(groupPackageId, groupDepartureId)` and sold-out/past departures are rejected, and infants (`<2 yrs`) consume `0` vehicle/departure seats.

#### T-020 — [P0] Truthfully disclose AI sub-processors (ZDR), private R2 storage, cookies, retention TTLs & DSAR workflow on `/privacy`
- **T-ID**: `T-020`
- **Severity**: `P0`
- **Title**: Truthfully disclose AI sub-processors (ZDR), private R2 storage, cookies, retention TTLs & DSAR workflow on `/privacy`
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/(public)/privacy/page.tsx`
- **Source Finding IDs** (1): `A25-002`
- **Gate Status**: `NEEDS_DECISION: OD-06`
- **Concrete Fix Summary**: Rewrite `/privacy` (`app/(public)/privacy/page.tsx`) to accurately disclose sanitized AI processing (Google Gemini / OpenRouter with Zero-Data-Retention `data_collection: "deny"`), private Cloudflare R2 signed document storage, `social_oauth_state_*` / Better Auth cookies, concrete retention TTLs (`OD-06`), Meta Cloud API messaging & `STOP` opt-out mechanics, and a working DSAR deletion/access request channel.
- **Red->Green Test**: `tests/w3/f-pub/legal-pages-compliance.test.ts` — renders `/privacy` and asserts sub-processor table, retention schedule, cookie list, and verified Lahore contact details are present with zero false local-only storage claims.

#### T-021 — [P0] Escape 100% of pilgrim & itinerary fields in `lib/posters/render-quotation-pdf.ts` to block Gotenberg XSS/SSRF
- **T-ID**: `T-021`
- **Severity**: `P0`
- **Title**: Escape 100% of pilgrim & itinerary fields in `lib/posters/render-quotation-pdf.ts` to block Gotenberg XSS/SSRF
- **Fixer Owner**: `F-DESK`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/posters/render-quotation-pdf.ts`
- **Source Finding IDs** (2): `A03-001`, `A10-001`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Wrap every dynamic string interpolated into `render-quotation-pdf.ts` (`customerName`, `customerEmail`, `specialRequests`, hotel names, airline names, room labels, custom notes, reference numbers) in `escapeHtml()` / `escapeAttr()` from `lib/security/html-escape.ts`, validate all embedded image URLs to local data URIs or allowlisted HTTPS R2 assets, and inject strict inline `<meta http-equiv="Content-Security-Policy">`.
- **Red->Green Test**: `tests/w3/f-desk/quotation-pdf-security.test.ts` — passes `<script>fetch('http://169.254.169.254')</script>` and `<img src=x onerror=...>` in pilgrim name/notes and asserts rendered HTML contains zero unescaped `<script>` or event attributes.

#### T-022 — [P0] Stop Quote Worksheet from zeroing `group_booking` totals & wrap status machine + `booked_seats` updates + `audit_logs` in `withTransaction()`
- **T-ID**: `T-022`
- **Severity**: `P0`
- **Title**: Stop Quote Worksheet from zeroing `group_booking` totals & wrap status machine + `booked_seats` updates + `audit_logs` in `withTransaction()`
- **Fixer Owner**: `F-DESK`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/quotes.ts`, `components/admin/applications/quote-worksheet-form.tsx`
- **Source Finding IDs** (4): `A04-005`, `A07-004`, `A10-002`, `A10-004`
- **Gate Status**: `NEEDS_DECISION: OD-09`
- **Concrete Fix Summary**: Initialize `QuoteWorksheetForm` line items from persisted `group_booking` package/tier totals so opening or saving a group quote never overwrites `grandTotalPkr` to `0`; enforce explicit allowed status transitions in `app/actions/quotes.ts` inside `withTransaction()` with `SELECT ... FOR UPDATE` on `group_departures` so `approved` atomically increments `booked_seats` (preventing negative remaining seats) and `cancelled`/`rejected` releases held seats exactly once, recording every mutation in `audit_logs`.
- **Red->Green Test**: `tests/w3/f-desk/quote-worksheet-and-seats.test.ts` — verifies saving a `group_booking` quote preserves package total, concurrent approvals cannot exceed `totalSeats`, and cancelling an approved booking restores `booked_seats` once with an `audit_logs` record.

#### T-023 — [P0] Gate `/admin/applications/[id]/voucher` on `approved` + verified payment status so unpaid/rejected leads never stamp `PAID & CONFIRMED`
- **T-ID**: `T-023`
- **Severity**: `P0`
- **Title**: Gate `/admin/applications/[id]/voucher` on `approved` + verified payment status so unpaid/rejected leads never stamp `PAID & CONFIRMED`
- **Fixer Owner**: `F-DESK`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/admin/(dashboard)/applications/[id]/voucher/page.tsx`, `app/actions/quotes.ts`
- **Source Finding IDs** (1): `A10-003`
- **Gate Status**: `NEEDS_DECISION: OD-04`
- **Concrete Fix Summary**: Block voucher rendering and public voucher-token issuance in `app/admin/(dashboard)/applications/[id]/voucher/page.tsx` & `app/actions/quotes.ts` whenever `application.status !== "approved"` or `quote.paymentStatus === "unpaid"` (or stricter `paid_in_full` per `OD-04`), displaying exact payment badge (`DEPOSIT VERIFIED — BALANCE DUE` vs `PAID IN FULL`) derived from verified `application_payments` ledger rows.
- **Red->Green Test**: `tests/w3/f-desk/voucher-gating.test.ts` — asserts unpaid, `pending_quote`, `rejected`, and `cancelled` applications cannot render a confirmed travel voucher or mint a public voucher link.

#### T-024 — [P0] Preserve `children` & `infants` in `Cmd+K` 1-Click Quote Conversion and block expired/unpublished packages
- **T-ID**: `T-024`
- **Severity**: `P0`
- **Title**: Preserve `children` & `infants` in `Cmd+K` 1-Click Quote Conversion and block expired/unpublished packages
- **Fixer Owner**: `F-DESK`
- **Sub-Wave**: `W3B`
- **Target Files**: `components/layout/command-palette.tsx`, `app/actions/command-lookup.ts`
- **Source Finding IDs** (1): `A09-001`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Pass `adults`, `children`, and `infants` passenger counts from `CommandPalette` into 1-Click Quote Conversion (computing beds as `adults + children` and total visas/passports as `adults + children + infants`), and disable/reject conversion on expired, archived, or unpublished Studio/Group packages.
- **Red->Green Test**: `tests/w3/f-desk/command-palette-lookup.test.ts` — converts a family of `2 adults + 2 children + 1 infant` via `Cmd+K` lookup action and asserts all 3 passenger counts persist accurately while expired packages throw validation error.

#### T-025 — [P0] Eliminate local file read (`fs.readFile`) & SSRF in `extract-packages.ts` and HTML-escape Studio poster renderers
- **T-ID**: `T-025`
- **Severity**: `P0`
- **Title**: Eliminate local file read (`fs.readFile`) & SSRF in `extract-packages.ts` and HTML-escape Studio poster renderers
- **Fixer Owner**: `F-STUDIO`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/ai/extract-packages.ts`, `app/actions/marketing-ops.ts`, `lib/posters/render-multi-package-poster.ts`, `lib/posters/render-single-package-poster.ts`
- **Source Finding IDs** (2): `A03-004`, `A11-004`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Delete arbitrary disk path reads (`fs.readFile`) from `loadMediaBytes` in `lib/ai/extract-packages.ts` & `app/actions/marketing-ops.ts`, restricting remote media fetches strictly through `assertSafeExternalUrl()` (R2 HTTPS host allowlist + `20 MB` byte cap + `AbortSignal.timeout`), and wrap every interpolated flyer/package field in `render-multi-package-poster.ts` and `render-single-package-poster.ts` in `escapeHtml()`.
- **Red->Green Test**: `tests/w3/f-studio/studio-ssrf-and-xss.test.ts` — asserts `loadMediaBytes("/etc/passwd")` and `http://169.254.169.254/...` throw security errors, and poster HTML escapes `<script>`/`<img onerror>` in supplier hotel/airline strings.

#### T-026 — [P0] Mount Mode B (`net_plus_markup`) in Studio Hub, fix Mode A retail cost mapping, block raw flyer leaks on `/`, fix `ART-...` collisions & active-booking FK wipe
- **T-ID**: `T-026`
- **Severity**: `P0`
- **Title**: Mount Mode B (`net_plus_markup`) in Studio Hub, fix Mode A retail cost mapping, block raw flyer leaks on `/`, fix `ART-...` collisions & active-booking FK wipe
- **Fixer Owner**: `F-STUDIO`
- **Sub-Wave**: `W3B`
- **Target Files**: `components/admin/hubs/studio-hub-client.tsx`, `app/actions/marketing-ops.ts`
- **Source Finding IDs** (5): `A05-002`, `A07-003`, `A11-001`, `A11-002`, `A11-003`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Wire Mode B (`net_plus_markup` per-tier/flat markup editor) into `StudioHubClient`; fix `gemini_ultra_poster` Mode A ingestion so extracted retail prices populate retail PKR columns without zeroing margin; never copy raw supplier flyer URLs into public `group_packages.bannerUrl` (require rendered Al Ramlah wrapped poster); generate `ART-<SUP>-<DUR>D-<SEQ>-<SUFFIX>` codes inside `withTransaction()` with `23505` retry; and block `deleteSupplierFlyerAction` (`RESTRICT` / soft-archive) when active `applications` reference its `groupPackageId` / `groupDepartureId`.
- **Red->Green Test**: `tests/w3/f-studio/studio-modes-and-sync.test.ts` — verifies Mode A retail vs Mode B markup persistence, multi-sheet batch `ART-...` uniqueness, zero raw supplier flyer URLs on synced public packages, and soft-archive protection when bookings exist.

#### T-027 — [P0] Enforce `do_not_contact` and transactional 14-day PKT cooldown across VIP Outreach & Studio distribution actions
- **T-ID**: `T-027`
- **Severity**: `P0`
- **Title**: Enforce `do_not_contact` and transactional 14-day PKT cooldown across VIP Outreach & Studio distribution actions
- **Fixer Owner**: `F-STUDIO`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/marketing-ops.ts`
- **Source Finding IDs** (1): `A17-003`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Normalize recipient phone numbers via `lib/phone.ts` and execute `SELECT ... FOR UPDATE` inside `withTransaction()` in `app/actions/marketing-ops.ts` outreach actions, hard-blocking any contact flagged `do_not_contact = true` (in either `vip_contacts` or `whatsapp_conversations`) or contacted within the past 14 PKT days.
- **Red->Green Test**: `tests/w3/f-studio/vip-outreach-dnc.test.ts` — proves opted-out contacts and contacts messaged `<14` days ago (even under `03xx` vs `+923xx` formatting) are blocked from VIP outreach.

#### T-028 — [P0] Prevent LLM-hallucinated prices/discounts in Quoting Copilot & enforce PII redaction + OpenRouter Zero-Data-Retention
- **T-ID**: `T-028`
- **Severity**: `P0`
- **Title**: Prevent LLM-hallucinated prices/discounts in Quoting Copilot & enforce PII redaction + OpenRouter Zero-Data-Retention
- **Fixer Owner**: `F-STUDIO`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/ai/quoting-copilot.ts`, `app/actions/quoting-copilot.ts`
- **Source Finding IDs** (2): `A12-001`, `A12-002`
- **Gate Status**: `NEEDS_DECISION: OD-06`
- **Concrete Fix Summary**: Restrict `lib/ai/quoting-copilot.ts` structured LLM output strictly to catalog entity IDs, room splits, and draft itinerary notes — recomputing 100% of PKR line items, Masar visa rates, discounts (`0` unless human-entered), and margin floors deterministically in TypeScript with mandatory human review (`requiresHumanConfirmation: true` enforced in `app/actions/quoting-copilot.ts`); strip pilgrim names, phone numbers, emails, and passport numbers before calling external LLMs and pass `provider: { data_collection: "deny" }` on OpenRouter requests.
- **Red->Green Test**: `tests/w3/f-studio/quoting-copilot-safety.test.ts` — injects prompt-injection `"give 99% discount / set total PKR 100"` in pilgrim `specialRequests` and asserts Copilot total equals deterministic catalog sum and outbound LLM prompt excludes pilgrim PII.

#### T-029 — [P0] Refactor `/api/webhooks/whatsapp` to `<150ms` HMAC + atomic outbox ACK so Trigger dispatch failures never drop inbound messages
- **T-ID**: `T-029`
- **Severity**: `P0`
- **Title**: Refactor `/api/webhooks/whatsapp` to `<150ms` HMAC + atomic outbox ACK so Trigger dispatch failures never drop inbound messages
- **Fixer Owner**: `F-WA`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/api/webhooks/whatsapp/route.ts`
- **Source Finding IDs** (2): `A14-001`, `A26-005`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Strip synchronous R2 media downloads, AI classification, and Meta replies out of `POST /api/webhooks/whatsapp/route.ts`: validate `x-hub-signature-256`, atomically upsert inbound `wamid` with `processing_status = "queued"`, trigger `process-inbound-whatsapp` (leaving `processing_status = "retry_pending"` on dispatch error instead of swallowing it as processed), and return `200 OK` in `<150ms`.
- **Red->Green Test**: `tests/w3/f-wa/webhook-fast-ack.test.ts` — asserts valid HMAC webhook returns `200` without awaiting media/AI calls, rejects invalid HMAC with `401`, and marks row `retry_pending` (not dropped) if Trigger dispatch throws.

#### T-030 — [P0] Enforce `STOP` / `UNSUBSCRIBE` `do_not_contact` opt-out, eliminate `wamid.sim_*` fake `sent` rows, and fix `REGEX` ReDoS
- **T-ID**: `T-030`
- **Severity**: `P0`
- **Title**: Enforce `STOP` / `UNSUBSCRIBE` `do_not_contact` opt-out, eliminate `wamid.sim_*` fake `sent` rows, and fix `REGEX` ReDoS
- **Fixer Owner**: `F-WA`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/whatsapp/auto-responder.ts`, `lib/whatsapp/post-ref-detector.ts`, `lib/bridges/marketing-bridges.ts`
- **Source Finding IDs** (8): `A14-005`, `A14-006`, `A14-009`, `A17-002`, `A25-003`, `A26-003`, `A00-007`, `A03-013`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Intercept `STOP` / `UNSUBSCRIBE` / `OPT OUT` / `RUKO` before cooldown-unlock or bot rules in `lib/whatsapp/auto-responder.ts` & `post-ref-detector.ts` to atomically set `do_not_contact = true` on `whatsapp_conversations` + matching `vip_contacts` and send one confirmation ack; delete all `wamid.sim_*` / `wamid.bridge_*` fake success fallbacks in `auto-responder.ts` and `lib/bridges/marketing-bridges.ts` so Meta API/decryption failures record `status = "failed"`; scope keyword rules strictly to `whatsappAccountId` and bound/reject nested-quantifier `REGEX` patterns to prevent ReDoS.
- **Red->Green Test**: `tests/w3/f-wa/stop-optout-and-honest-status.test.ts` — proves inbound `"STOP"` sets `do_not_contact=true` without unlocking 14d cooldown, Meta `500`/`401` marks message `failed` (zero `wamid.sim_*`), and evil `(a+)+$` regex is rejected safely in `<10ms`.

#### T-031 — [P0] Block `@g.us`/`status@broadcast` on Meta Cloud API, fix Send-Then-DB duplicate sends, and purge fake `+92 300 8451122` / `Rawalpindi` / unverified IBAN
- **T-ID**: `T-031`
- **Severity**: `P0`
- **Title**: Block `@g.us`/`status@broadcast` on Meta Cloud API, fix Send-Then-DB duplicate sends, and purge fake `+92 300 8451122` / `Rawalpindi` / unverified IBAN
- **Fixer Owner**: `F-WA`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/bridges/marketing-bridges.ts`, `lib/whatsapp/auto-responder.ts`, `lib/whatsapp/meta-api.ts`, `app/actions/whatsapp-crm.ts`
- **Source Finding IDs** (3): `A17-001`, `A20-002`, `A26-006`
- **Gate Status**: `NEEDS_DECISION: OD-10`
- **Concrete Fix Summary**: Reject `@g.us` and `status@broadcast` targets in `dispatchViaWhatsAppBridge` (Meta Cloud API supports 1:1 E.164 recipients only); pre-insert outbound `whatsapp_messages` in `status = "sending"` with idempotency key BEFORE calling Meta Graph API so DB/network faults cannot trigger duplicate sends; and replace hardcoded fake helpline `+92 300 8451122`, `Rawalpindi` city, and hardcoded Meezan IBAN in `lib/whatsapp/auto-responder.ts` with verified `agency_settings` values (`OD-10`).
- **Red->Green Test**: `tests/w3/f-wa/bridge-and-brand-truth.test.ts` — asserts `@g.us` is rejected by Meta Cloud bridge, outbound send pre-records `sending` row idempotently, and auto-responder contains zero references to `300 8451122`, `Rawalpindi`, or unverified IBANs.

#### T-032 — [P0] Remove `purgeFakeMarketingChannelsAction` social-channel wipe & implement `OD-01` Linked-Device topology (Sunset to Manual Queue vs Sidecar)
- **T-ID**: `T-032`
- **Severity**: `P0`
- **Title**: Remove `purgeFakeMarketingChannelsAction` social-channel wipe & implement `OD-01` Linked-Device topology (Sunset to Manual Queue vs Sidecar)
- **Fixer Owner**: `F-WA`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/whatsapp-linked-device.ts`, `lib/whatsapp/linked-device.ts`, `lib/whatsapp/linked-device-auth-postgres.ts`, `components/admin/whatsapp/whatsapp-linked-device-card.tsx`
- **Source Finding IDs** (14): `A00-002`, `A00-004`, `A15-001`, `A15-004`, `A15-005`, `A15-002`, `A15-006`, `A15-008`, `A15-009`, `A15-010`, `A15-011`, `A25-005`, `A15-013`, `A17-012`
- **Gate Status**: `NEEDS_DECISION: OD-01`
- **Concrete Fix Summary**: Immediately scope/remove `purgeFakeMarketingChannelsAction` (`requireSuperAdmin()`, never deleting Core 5 social `marketing_channels` or zeroing real counters) and ensure `deleteLinkedDeviceSessionAction` clears auth keys cleanly; then execute `OD-01`: under Recommended Default **Option A**, sunset serverless-incompatible Baileys `socketMap` in favor of 100% ban-safe Manual Assisted WA Group/Status Share Queue + Official Meta Cloud API v21.0; or under Options B/C, isolate Baileys in a single-replica sidecar with per-key Signal storage, `515` pairing restart, `@lid` resolution, `statusJidList`, Trigger inbound parity, anti-ban jitter, and `super_admin` gating.
- **Red->Green Test**: `tests/w3/f-wa/linked-device-and-channels.test.ts` — proves channel cleanup preserves Instagram/Facebook/TikTok/YouTube/GMB channels, requires `super_admin`, and enforces the selected `OD-01` transport contract without process-local serverless socket leaks.

#### T-033 — [P0] Enforce `requireAdmin()` / `requireSuperAdmin()` across `executeScheduledPostNowAction` & all `social-scheduler.ts` Server Actions
- **T-ID**: `T-033`
- **Severity**: `P0`
- **Title**: Enforce `requireAdmin()` / `requireSuperAdmin()` across `executeScheduledPostNowAction` & all `social-scheduler.ts` Server Actions
- **Fixer Owner**: `F-SOCIAL`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/social-scheduler.ts`
- **Source Finding IDs** (3): `A00-001`, `A02-002`, `A16-001`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Add mandatory `await requireAdmin()` at the entry of `executeScheduledPostNowAction` and audit every exported Server Action in `app/actions/social-scheduler.ts` (enforcing `requireSuperAdmin()` on OAuth account connect/disconnect/delete and `recordAuditLog()` on live publish actions).
- **Red->Green Test**: `tests/w3/f-social/social-scheduler-authz.test.ts` — invokes `executeScheduledPostNowAction` and account-disconnect actions without session / as `staff` and asserts `Unauthorized` / `Forbidden` before any DB or provider call.

#### T-034 — [P0] Eliminate `fs.readFile` path traversal, SSRF, and video RAM OOM across all Core 5 social providers
- **T-ID**: `T-034`
- **Severity**: `P0`
- **Title**: Eliminate `fs.readFile` path traversal, SSRF, and video RAM OOM across all Core 5 social providers
- **Fixer Owner**: `F-SOCIAL`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/social/providers/facebook.ts`, `lib/social/providers/instagram.ts`, `lib/social/providers/tiktok.ts`, `lib/social/providers/youtube.ts`, `lib/social/providers/gmb.ts`
- **Source Finding IDs** (1): `A16-002`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Remove local filesystem `fs.readFile` fallbacks from all 5 providers in `lib/social/providers/*.ts`; validate every media URL via `assertSafeExternalUrl()` (R2 HTTPS allowlist only); enforce `fetchWithTimeout` + `Content-Length` bounds and chunked/streamed video transfer on YouTube, TikTok, and Facebook Reels so multi-MB videos cannot OOM the worker.
- **Red->Green Test**: `tests/w3/f-social/provider-media-security.test.ts` — asserts local `/etc/hosts` paths and `http://127.0.0.1` media URLs are rejected across all 5 providers before network I/O.

#### T-035 — [P0] Fix Meta Page-Token overwrite bug, poll Instagram single-Reel/carousel containers, and migrate Google Business Profile off dead `v4` endpoints
- **T-ID**: `T-035`
- **Severity**: `P0`
- **Title**: Fix Meta Page-Token overwrite bug, poll Instagram single-Reel/carousel containers, and migrate Google Business Profile off dead `v4` endpoints
- **Fixer Owner**: `F-SOCIAL`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/social/token-refresh.ts`, `lib/social/providers/instagram.ts`, `lib/social/providers/gmb.ts`
- **Source Finding IDs** (4): `A16-003`, `A16-004`, `A16-005`, `A16-010`
- **Gate Status**: `NEEDS_DECISION: OD-11`
- **Concrete Fix Summary**: Fix `lib/social/token-refresh.ts` so long-lived Meta Page Access Tokens are re-derived via `/me/accounts` (never overwritten with a User token, and never stamping 1-hour tokens as 60-day tokens); poll `pollInstagramContainerFinished` on single `REEL`/`STORY`/video containers and carousel parent containers before `/media_publish` (using `graph.facebook.com/v21.0+` consistently); and migrate `lib/social/providers/gmb.ts` off sunset `mybusiness.googleapis.com/v4` (`HTTP 404`) to current GBP v1 / verified API endpoints gated cleanly when GBP Basic Access (`OD-11`) is pending.
- **Red->Green Test**: `tests/w3/f-social/meta-ig-gmb-providers.test.ts` — verifies Meta refresh preserves Page Access Token, IG Reel waits for `FINISHED` status before publish, and GMB client never calls dead `mybusiness.googleapis.com/v4/accounts/.../insights`.

#### T-036 — [P0] Delete SHA-256 deterministic fake metrics in `lib/social/analytics.ts` & gate Reactive Engagement Auto-Plugs on real live metrics
- **T-ID**: `T-036`
- **Severity**: `P0`
- **Title**: Delete SHA-256 deterministic fake metrics in `lib/social/analytics.ts` & gate Reactive Engagement Auto-Plugs on real live metrics
- **Fixer Owner**: `F-SOCIAL`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/social/analytics.ts`, `app/actions/social-scheduler.ts`
- **Source Finding IDs** (3): `A16-007`, `A00-008`, `A00-017`
- **Gate Status**: `NEEDS_DECISION: OD-11`
- **Concrete Fix Summary**: Delete all SHA-256 hash-based mock metric generators in `lib/social/analytics.ts` so unfetched/unsupported platform metrics return `null` (`syncStatus: "unavailable"`) instead of fabricated views/likes/reach; restrict Reactive Engagement Auto-Plugs to fire ONLY on verified live provider metrics with atomic DB idempotency (`autoPlugFiredAt`) per `OD-11`.
- **Red->Green Test**: `tests/w3/f-social/honest-analytics.test.ts` — proves `syncPostAnalytics` returns explicit `unavailable` (never deterministic fake integers) when provider API is unconfigured or errors, and never triggers auto-plugs on mock numbers.

#### T-037 — [P0] Disable production inline Trigger fallback, fix `throwIfNonRetryable` error swallowing, and lock `wait.until` vs sweeper double-publish race
- **T-ID**: `T-037`
- **Severity**: `P0`
- **Title**: Disable production inline Trigger fallback, fix `throwIfNonRetryable` error swallowing, and lock `wait.until` vs sweeper double-publish race
- **Fixer Owner**: `F-JOBS`
- **Sub-Wave**: `W3B`
- **Target Files**: `trigger/dispatch.ts`, `trigger/errors.ts`, `trigger/publish-social-post.task.ts`, `trigger/extract-packages.task.ts`, `trigger/quoting-copilot.task.ts`, `trigger/render-gotenberg-asset.task.ts`, `trigger/send-whatsapp-broadcast.task.ts`, `trigger/process-inbound-whatsapp.task.ts`
- **Source Finding IDs** (4): `A16-006`, `A18-001`, `A18-002`, `A26-008`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Block `trigger/dispatch.ts` from executing heavy 60–300s tasks inline inside production Next.js lambdas when `TRIGGER_SECRET_KEY` is missing/unreachable; fix `rethrowAsTaskError` in `trigger/errors.ts` so `400/401/403/422` throw `AbortTaskRunError` while `429/5xx`/timeouts rethrow for Trigger exponential backoff + `Retry-After`; and add atomic `UPDATE scheduled_posts SET status = 'publishing' WHERE id = $1 AND status = 'scheduled' RETURNING *` claim locking in `publish-social-post.task.ts` so `wait.until` and the sweeper cron can never double-publish.
- **Red->Green Test**: `tests/w3/f-jobs/dispatch-retries-and-claim-lock.test.ts` — asserts prod `dispatch` fails closed instead of running inline, `429` rethrows for retry while `401` raises `AbortTaskRunError`, and concurrent `publish-social-post` invocations publish at most once.

#### T-038 — [P0] Strip encrypted tokens, OAuth `metadata`, and `webhookVerifyToken` from `/admin/settings` RSC serialization
- **T-ID**: `T-038`
- **Severity**: `P0`
- **Title**: Strip encrypted tokens, OAuth `metadata`, and `webhookVerifyToken` from `/admin/settings` RSC serialization
- **Fixer Owner**: `F-ADMIN`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/admin/(dashboard)/settings/page.tsx`, `components/admin/hubs/connections-settings-client.tsx`
- **Source Finding IDs** (2): `A20-001`, `A20-015`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Project strict safe DTOs in `app/admin/(dashboard)/settings/page.tsx` before passing props to `<ConnectionsSettingsClient />`: never serialize `accessTokenEncrypted`, `refreshTokenEncrypted`, raw `socialIntegrations.metadata`, or plaintext `webhookVerifyToken` into Flight RSC HTML payloads (expose boolean `hasToken` / masked last-4 indicators only).
- **Red->Green Test**: `tests/w3/f-admin/settings-secret-redaction.test.ts` — inspects mapped DTOs for `/admin/settings` and asserts zero token ciphertexts, raw OAuth metadata tokens, or plaintext webhook secrets appear in client props.

#### T-039 — [P0] Block `npm test` from mutating live Neon production DB & configure hermetic `vitest.config.ts` + network-egress lock
- **T-ID**: `T-039`
- **Severity**: `P0`
- **Title**: Block `npm test` from mutating live Neon production DB & configure hermetic `vitest.config.ts` + network-egress lock
- **Fixer Owner**: `F-QA`
- **Sub-Wave**: `W3C`
- **Target Files**: `vitest.config.ts`, `tests/test-env.ts`, `tests/setup/hermetic-env.ts`, `tests/whatsapp-linked-device-and-groups.test.ts`, `tests/whatsapp-multi-number-system.test.ts`
- **Source Finding IDs** (3): `A24-001`, `A24-002`, `W0-003`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Add `vitest.config.ts` with `setupFiles: ["./tests/setup/hermetic-env.ts"]` that aborts immediately if `DATABASE_URL` points to `*.neon.tech` or lacks explicit `test` database marker, disables real external HTTP egress during unit tests, removes live DB deletes/inserts from `whatsapp-multi-number-system.test.ts` & `whatsapp-linked-device-and-groups.test.ts`, and enforces coverage thresholds.
- **Red->Green Test**: `tests/unit/hermetic-guard.test.ts` — proves `assertAuditSafeEnvironment()` throws immediately on any `*.neon.tech` connection string and blocks outbound live internet `fetch()` calls.

#### T-040 — [P0] Add GitHub Actions CI pipeline (`.github/workflows/ci.yml`) with Postgres service container, migration/seed × 2 gate, audit, test & build
- **T-ID**: `T-040`
- **Severity**: `P0`
- **Title**: Add GitHub Actions CI pipeline (`.github/workflows/ci.yml`) with Postgres service container, migration/seed × 2 gate, audit, test & build
- **Fixer Owner**: `F-QA`
- **Sub-Wave**: `W3C`
- **Target Files**: `../.github/workflows/ci.yml`, `tests/integration/db-migrations-and-seed.test.ts`
- **Source Finding IDs** (2): `A23-004`, `A24-008`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Create `../.github/workflows/ci.yml` running on every push and pull request with a disposable `postgres:16-alpine` service container: runs `npm ci`, `npm audit --omit=dev --audit-level=high`, `npx drizzle-kit migrate`, `seed() × 2` idempotency + FK/concurrency integration tests (`tests/integration/db-migrations-and-seed.test.ts`), `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and Playwright smoke specs.
- **Red->Green Test**: `tests/integration/db-migrations-and-seed.test.ts` — runs all SQL migrations on an empty test schema, executes `seed()` twice back-to-back, and verifies row counts, `long_term` visa rate integrity, and FK constraints.

### 2.2 `P1` — High-Priority Production Defects (Broken Flows, RBAC Gaps, Reliability & Compliance)

#### T-041 — [P1] Harden 43-table FK `ON DELETE` rules, composite Desk/Overview indexes, `(application_id, version)` unique constraint, and `BIGINT` money safety
- **T-ID**: `T-041`
- **Severity**: `P1`
- **Title**: Harden 43-table FK `ON DELETE` rules, composite Desk/Overview indexes, `(application_id, version)` unique constraint, and `BIGINT` money safety
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `db/schema/applications.ts`, `db/schema/catalog.ts`, `db/schema/packages.ts`, `db/schema/settings.ts`, `db/schema/social-scheduler.ts`, `db/schema/whatsapp-crm.ts`, `drizzle/`
- **Source Finding IDs** (7): `A00-016`, `A04-008`, `A04-009`, `A04-011`, `A04-012`, `A04-013`, `A19-002`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Audit all 60 foreign keys across `db/schema/*.ts`: replace destructive `ON DELETE CASCADE` on catalog/WhatsApp history with `RESTRICT` (or `SET NULL` where optional) and add explicit `ON DELETE` clauses on the 17 bare `NO ACTION` FKs; add composite index `(whatsapp_account_id, is_archived, is_pinned DESC, last_message_at DESC)` on `whatsapp_conversations`, `UNIQUE (application_id, version)` on `application_quotes`, and `(status, created_at DESC)` on `applications`; and widen high-value cumulative PKR/minor-unit columns or guard `INT4` bounds with SQL `CHECK` constraints.
- **Red->Green Test**: `tests/w3/f-plat/schema-fk-and-indexes.test.ts` — inspects Drizzle table metadata and generated SQL for composite Desk index, `(application_id, version)` unique constraint, and safe `ON DELETE RESTRICT` rules.

#### T-042 — [P1] Add append-only `application_payments` ledger table, `deposit_required_pkr`, `sla_escalated_at`, and SQL `CHECK` constraints
- **T-ID**: `T-042`
- **Severity**: `P1`
- **Title**: Add append-only `application_payments` ledger table, `deposit_required_pkr`, `sla_escalated_at`, and SQL `CHECK` constraints
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `db/schema/applications.ts`, `db/schema/index.ts`, `drizzle/`
- **Source Finding IDs** (2): `A04-007`, `A10-009`
- **Gate Status**: `NEEDS_DECISION: OD-03`
- **Concrete Fix Summary**: Create `application_payments` ledger table (`id`, `application_id`, `quote_id`, `amount_pkr`, `payment_method`, `bank_reference`, `receipt_r2_key`, `recorded_by_id`, `verified_at`, `notes`, `created_at`), add `deposit_required_pkr` to `application_quotes` and `sla_escalated_at` + structured `hajj_inquiry_json` to `applications`, and add SQL `CHECK` constraints blocking negative prices, `booked_seats > total_seats`, and `departure_date < arrival_date`.
- **Red->Green Test**: `tests/w3/f-plat/payments-ledger-schema.test.ts` — verifies `application_payments` columns/FKs and asserts SQL `CHECK` constraints reject negative `amount_pkr` and `booked_seats > total_seats`.

#### T-043 — [P1] Wire transactional email provider (`lib/security/mailer.ts`) & Better Auth password-reset + temp-password rotation flow
- **T-ID**: `T-043`
- **Severity**: `P1`
- **Title**: Wire transactional email provider (`lib/security/mailer.ts`) & Better Auth password-reset + temp-password rotation flow
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `lib/security/mailer.ts`, `lib/auth.ts`, `db/schema/auth.ts`, `app/admin/(auth)/login/page.tsx`
- **Source Finding IDs** (2): `A00-012`, `A02-009`
- **Gate Status**: `NEEDS_DECISION: OD-02`
- **Concrete Fix Summary**: Implement `lib/security/mailer.ts` supporting the selected `OD-02` transactional email transport (Recommended Default: Resend + `@react-email` on `@alramlahtravels.com`, with clean fallback when WhatsApp-only Option D is chosen); wire `sendResetPassword` in `lib/auth.ts`, add Forgot-Password / Change-Password UI and `mustChangePassword` enforcement on `/admin/login`.
- **Red->Green Test**: `tests/w3/f-plat/password-reset-and-mailer.test.ts` — tests password-reset token generation/delivery via mock mailer and verifies `mustChangePassword=true` forces rotation before dashboard access.

#### T-044 — [P1] Enforce CSP/HSTS/`X-Frame-Options` in `proxy.ts`, eliminate `pnpm-lock.yaml` drift, and fix `38m` `next build` / `tsconfig.json` stall
- **T-ID**: `T-044`
- **Severity**: `P1`
- **Title**: Enforce CSP/HSTS/`X-Frame-Options` in `proxy.ts`, eliminate `pnpm-lock.yaml` drift, and fix `38m` `next build` / `tsconfig.json` stall
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `proxy.ts`, `tsconfig.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- **Source Finding IDs** (5): `A00-014`, `A01-005`, `A01-008`, `A03-010`, `A22-009`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Inject strict HTTP security headers (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`) in `proxy.ts`; delete stale `pnpm-lock.yaml` & `pnpm-workspace.yaml`; and exclude `../services/**`, `.trigger/**`, `public/uploads/**`, and `tests/**` from Next build typecheck scan in `tsconfig.json` so `npm run build` finishes cleanly in `<3` minutes.
- **Red->Green Test**: `tests/w3/f-plat/proxy-headers-and-build.test.ts` — asserts `proxy()` attaches CSP, HSTS, `X-Frame-Options`, and `nosniff` headers and verifies `pnpm-lock.yaml` is removed.

#### T-045 — [P1] Upgrade `Dockerfile` to `node:22-alpine`, harden `nginx.conf` TLS/headers, add `/api/health` + `instrumentation.ts`, and align tier limits
- **T-ID**: `T-045`
- **Severity**: `P1`
- **Title**: Upgrade `Dockerfile` to `node:22-alpine`, harden `nginx.conf` TLS/headers, add `/api/health` + `instrumentation.ts`, and align tier limits
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `Dockerfile`, `.dockerignore`, `nginx/nginx.conf`, `app/api/health/route.ts`, `instrumentation.ts`, `next.config.ts`
- **Source Finding IDs** (7): `A01-006`, `A01-007`, `A22-002`, `A23-005`, `A23-007`, `A23-012`, `W0-005`
- **Gate Status**: `NEEDS_DECISION: OD-07`
- **Concrete Fix Summary**: Upgrade `Dockerfile` from EOL `node:20-alpine` to `node:22-alpine` with non-root user, runtime `NEXT_PUBLIC_*` build-arg validation, and `HEALTHCHECK` against `/api/health`; harden `nginx/nginx.conf` (`HTTPS` redirect, preserve upstream `$http_x_forwarded_proto`, upstream keepalive, `client_max_body_size 25m`); add `app/api/health/route.ts` probing Postgres + R2 config + Gotenberg status; add `instrumentation.ts` (`onRequestError` structured logging); and align `serverActions.bodySizeLimit` / route `maxDuration` to the chosen `OD-07` hosting tier.
- **Red->Green Test**: `tests/w3/f-plat/health-and-infra-config.test.ts` — calls `GET /api/health` (`200` healthy / `503` degraded without leaking secrets) and asserts `Dockerfile` uses `node:22-alpine` + `HEALTHCHECK`.

#### T-046 — [P1] Lock Tailwind v4 single luxury light theme (`dark:*` neutralizer), fix WCAG 2.2 AA contrast tokens, and add root `error.tsx` / `global-error.tsx` / `not-found.tsx`
- **T-ID**: `T-046`
- **Severity**: `P1`
- **Title**: Lock Tailwind v4 single luxury light theme (`dark:*` neutralizer), fix WCAG 2.2 AA contrast tokens, and add root `error.tsx` / `global-error.tsx` / `not-found.tsx`
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `app/globals.css`, `app/layout.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `proxy.ts`
- **Source Finding IDs** (6): `A21-001`, `A21-002`, `A21-003`, `A00-023`, `A21-005`, `A26-011`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Add `@custom-variant dark (&:where(.never-dark *));` and `color-scheme: light;` in `app/globals.css` so OS dark mode never flips the luxury Haramain palette; darken `--muted-foreground`, gold text tokens (`>= 4.5:1` AA on ivory/white), and `--input` form borders (`>= 3.0:1` AA) plus global `.font-mono { font-variant-numeric: tabular-nums; }` and `@media (prefers-reduced-motion: reduce)`; add branded Haramain `app/error.tsx`, `app/global-error.tsx`, and `app/not-found.tsx` + `X-Robots-Tag: noindex` on `/admin` & `/api` in `proxy.ts` (public SEO `robots`/`sitemap` tracked in post-Gate-A `Spec 0025`).
- **Red->Green Test**: `tests/w3/f-plat/theme-wcag-and-boundaries.test.ts` — verifies relative luminance contrast ratios (`>=4.5:1` text, `>=3.0:1` `--input` border), `@custom-variant dark` lock in `globals.css`, and existence of root error/not-found boundaries.

#### T-047 — [P1] Declare `pino`, remove unused `cn`/`react-is`, fix `proxy.ts` `?session_expired` forced-logout GET gadget, and scrub Windows paths from `.mcp.json`
- **T-ID**: `T-047`
- **Severity**: `P1`
- **Title**: Declare `pino`, remove unused `cn`/`react-is`, fix `proxy.ts` `?session_expired` forced-logout GET gadget, and scrub Windows paths from `.mcp.json`
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `package.json`, `lib/utils.ts`, `proxy.ts`, `.mcp.json`
- **Source Finding IDs** (6): `A23-006`, `A00-021`, `A01-010`, `A01-011`, `A02-011`, `A15-012`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Declare `pino` explicitly in `package.json`, pin `@whiskeysockets/baileys` exact version (if retained), remove unused `"cn"` / `"react-is"` packages (`A00-021`, `A01-010`, `A15-012`, `A23-006`); stop `proxy.ts` from deleting live session cookies on arbitrary cross-site `GET /admin/login?session_expired=1` navigations unless the session is actually invalid (`A02-011`); and replace hardcoded `C:\nvm4w\...` / `c:\dev\...` paths in `.mcp.json` with portable `npx` invocations (`A01-011`).
- **Red->Green Test**: `tests/w3/f-plat/proxy-session-and-deps.test.ts` — verifies `GET /admin/login?session_expired=1` does not clear a valid session cookie and `.mcp.json` contains zero `C:\` machine paths.

#### T-048 — [P1] Restrict `calculatePrivateRoomSplits` to `allowedRoomTypes` & enforce `>10` pax / luggage bands in `vehicle-capacity.ts`
- **T-ID**: `T-048`
- **Severity**: `P1`
- **Title**: Restrict `calculatePrivateRoomSplits` to `allowedRoomTypes` & enforce `>10` pax / luggage bands in `vehicle-capacity.ts`
- **Fixer Owner**: `F-DOM`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/domain/room-splitter.ts`, `lib/domain/vehicle-capacity.ts`
- **Source Finding IDs** (2): `A05-006`, `A05-008`
- **Gate Status**: `NEEDS_DECISION: OD-09`
- **Concrete Fix Summary**: Rewrite `calculatePrivateRoomSplits` in `lib/domain/room-splitter.ts` using bounded DP/backtracking strictly over `hotel.allowedRoomTypes` (returning an explicit split warning when capacity is impossible rather than disallowed room types); update `lib/domain/vehicle-capacity.ts` to enforce Brief §5.4 passenger bands (`Adults + Children`, `0` infant seats), multi-vehicle / Coaster upgrades for `>10` pax, and luggage capacity checks (`1` large suitcase per seat).
- **Red->Green Test**: `tests/w3/f-dom/rooms-and-vehicles.test.ts` — exhaustively tests `1..20` pax across restricted `allowedRoomTypes` subsets (0 disallowed rooms) and verifies `1..25` pax + infant + luggage vehicle recommendations.

#### T-049 — [P1] Consolidate 5 divergent phone formatters into `lib/phone.ts` & `lib/whatsapp/phone-utils.ts` with international E.164 & JID fidelity
- **T-ID**: `T-049`
- **Severity**: `P1`
- **Title**: Consolidate 5 divergent phone formatters into `lib/phone.ts` & `lib/whatsapp/phone-utils.ts` with international E.164 & JID fidelity
- **Fixer Owner**: `F-DOM`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/phone.ts`, `lib/whatsapp/phone-utils.ts`, `lib/validations/whatsapp-linked-device.ts`
- **Source Finding IDs** (2): `A05-011`, `A15-007`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Unify `lib/phone.ts` and `lib/whatsapp/phone-utils.ts` around a single E.164 parser: convert local Pakistani `03XXXXXXXXX` / `3XXXXXXXXX` to `+923XXXXXXXXX` (`923XXXXXXXXX@s.whatsapp.net` — never `03xx@s.whatsapp.net`), preserve international `+44`, `+1`, `+966`, `+971` prefixes intact (stripping trunk `(0)` safely), and export `toWaMeUrl(phone)` + `phonesMatchStrict(a, b)`.
- **Red->Green Test**: `tests/w3/f-dom/phone-ssot.test.ts` — tests PK (`0327-4029701`), UK (`+44 (0) 7911 123456`), US (`+1 (555) 234-5678`), KSA (`+966 50 123 4567`), `wa.me` URLs, and `@s.whatsapp.net` JIDs.

#### T-050 — [P1] Harden `quote.ts`, `cms.ts`, and `catalog.ts` Zod schemas against below-net-cost quotes, `javascript:` URIs, and unbounded strings
- **T-ID**: `T-050`
- **Severity**: `P1`
- **Title**: Harden `quote.ts`, `cms.ts`, and `catalog.ts` Zod schemas against below-net-cost quotes, `javascript:` URIs, and unbounded strings
- **Fixer Owner**: `F-DOM`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/validations/quote.ts`, `lib/validations/cms.ts`, `lib/validations/catalog.ts`, `lib/constants/brand.ts`
- **Source Finding IDs** (4): `A19-003`, `A03-012`, `A19-010`, `A00-025`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Add cross-field validation in `lib/validations/quote.ts` (`discountPkr <= subtotalPkr`, explicit `allowBelowNetCost` super-admin override flag, strict `paymentStatus` enum); block `javascript:` / `data:` / `vbscript:` URIs on `imageUrl`, `bannerUrl`, and `ctaHref` in `lib/validations/cms.ts` & `catalog.ts` while enforcing numeric/date range bounds; and centralize default brand fallback constants in `lib/constants/brand.ts`.
- **Red->Green Test**: `tests/w3/f-dom/quote-cms-catalog-validations.test.ts` — asserts `javascript:alert(1)` hero links, negative catalog prices, `validUntil < validFrom`, and `discountPkr > subtotal` fail schema parsing.

#### T-051 — [P1] Harden `../scripts/oracle-gotenberg/` (`--chromium-disable-javascript`, private-IP deny-list, Arabic/Urdu/brand fonts, pinned image & OCI keepalive)
- **T-ID**: `T-051`
- **Severity**: `P1`
- **Title**: Harden `../scripts/oracle-gotenberg/` (`--chromium-disable-javascript`, private-IP deny-list, Arabic/Urdu/brand fonts, pinned image & OCI keepalive)
- **Fixer Owner**: `F-INFRA`
- **Sub-Wave**: `W3B`
- **Target Files**: `../scripts/oracle-gotenberg/docker-compose.yml`, `../scripts/oracle-gotenberg/Caddyfile`, `../scripts/oracle-gotenberg/setup-oracle-arm.sh`
- **Source Finding IDs** (3): `A13-005`, `A13-006`, `A23-011`
- **Gate Status**: `NEEDS_DECISION: OD-07`
- **Concrete Fix Summary**: Pin `gotenberg/gotenberg:8.x` image version in `../scripts/oracle-gotenberg/docker-compose.yml`, pass `--chromium-disable-javascript=true`, `--chromium-allow-list=^data:|^https://`, `--chromium-deny-list` blocking `169.254.169.254`/RFC1918/localhost, set Docker Compose `mem_limit`/`cpus` (non-Swarm keys), install `fonts-noto-core`, `fonts-noto-cjk`, `fonts-hosny-amiri` / Noto Naskh Arabic & Nastaliq Urdu + Inter, harden Caddy token check without echoing secrets, and document Oracle PAYG Always Free upgrade (`$0` ARM64 without idle reclamation per `OD-07`).
- **Red->Green Test**: `tests/w3/f-infra/oracle-gotenberg-config.test.ts` — parses `docker-compose.yml` & `Caddyfile` and asserts pinned image tag, `--chromium-disable-javascript=true`, metadata IP deny-list, and Arabic/Urdu font packages.

#### T-052 — [P1] Export `deleteR2Objects` cleanup helper, multipart-abort/lifecycle rules, and official `S3Client` timeout config in `lib/storage/r2.ts`
- **T-ID**: `T-052`
- **Severity**: `P1`
- **Title**: Export `deleteR2Objects` cleanup helper, multipart-abort/lifecycle rules, and official `S3Client` timeout config in `lib/storage/r2.ts`
- **Fixer Owner**: `F-INFRA`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/storage/r2.ts`
- **Source Finding IDs** (4): `A13-009`, `A23-010`, `A11-012`, `A13-010`
- **Gate Status**: `NEEDS_DECISION: OD-06`
- **Concrete Fix Summary**: Replace hand-rolled SigV4 buffer-copying uploader in `lib/storage/r2.ts` with official `@aws-sdk/client-s3` `PutObjectCommand` / `DeleteObjectsCommand` configured with `NodeHttpHandler` connection/socket timeouts, immutable versioned keys (preventing silent cache-stale overwrites), and `deleteR2Objects(keys)` for flyer/post deletion and `OD-06` PII retention purges.
- **Red->Green Test**: `tests/w3/f-infra/r2-lifecycle-and-delete.test.ts` — verifies `uploadAssetToR2` & `deleteR2Objects` use `S3Client` with bounded timeouts and distinct versioned keys.

#### T-053 — [P1] Hide volatile PKR rates on public Hotel/Room cards (Invariant #2), fix pillar/date desync, and add submit idempotency in Custom Builder
- **T-ID**: `T-053`
- **Severity**: `P1`
- **Title**: Hide volatile PKR rates on public Hotel/Room cards (Invariant #2), fix pillar/date desync, and add submit idempotency in Custom Builder
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `components/planner/hotel-card.tsx`, `components/planner/room-allocator.tsx`, `components/planner/planner-context.tsx`, `components/planner/review-and-submit-step.tsx`, `components/planner/live-summary-card.tsx`, `app/actions/applications.ts`
- **Source Finding IDs** (3): `A06-003`, `A06-004`, `A06-007`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Remove raw `baseRatePerNightPkr` price tags from public `HotelCard` & `RoomAllocator` so volatile itineraries strictly display `"Live Rate — Confirmed upon submission"` per Business Invariant #2; synchronize `ksaArrivalDate`/`ksaDepartureDate` whenever presets or service pillars toggle in `PlannerContext`; and generate a per-draft `clientSubmissionId` idempotency key + disabled in-flight button lock in `ReviewAndSubmitStep` & `LeadCaptureDialog` to prevent double-click duplicate dossiers.
- **Red->Green Test**: `tests/w3/f-pub/planner-invariants-and-idempotency.test.ts` — asserts public hotel cards render zero PKR night rates, toggling pillars keeps KSA dates synced to hotel stays, and duplicate submissions with the same `clientSubmissionId` return the existing `ART-...` reference.

#### T-054 — [P1] Surface `GroupBookingModal` Server Action errors, filter expired/`sold_out` packages on `/`, and wire selectable `multiHotelOptions` tiers
- **T-ID**: `T-054`
- **Severity**: `P1`
- **Title**: Surface `GroupBookingModal` Server Action errors, filter expired/`sold_out` packages on `/`, and wire selectable `multiHotelOptions` tiers
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/(public)/page.tsx`, `components/public/group-packages-section.tsx`, `components/public/group-booking-modal.tsx`, `app/actions/applications.ts`
- **Source Finding IDs** (4): `A07-005`, `A07-006`, `A07-007`, `A19-008`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Check `if (!result.success)` in `GroupBookingModal` to display inline `role="alert"` error banners instead of silently failing; filter `app/(public)/page.tsx` & `GroupPackagesSection` to only active packages with `>=1` future `open` departure (`departureDate >= todayPKT`); and add interactive hotel-tier radio selection in `GroupBookingModal` when `multiHotelOptions` exists so pilgrims can actually book the advertised `"From PKR ..."` tier.
- **Red->Green Test**: `tests/w3/f-pub/group-modal-and-filtering.test.ts` — verifies `GroupBookingModal` renders server error strings on `{ success: false }`, hides past/closed departures, and submits chosen `multiHotelOption` pricing.

#### T-055 — [P1] Persist structured Hajj 2027 package/Maktab/indicative pricing, fix broken `wa.me/03...` links, and add rate-limit + honeypot anti-spam
- **T-ID**: `T-055`
- **Severity**: `P1`
- **Title**: Persist structured Hajj 2027 package/Maktab/indicative pricing, fix broken `wa.me/03...` links, and add rate-limit + honeypot anti-spam
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/applications.ts`, `components/public/hajj-inquiry-section.tsx`, `components/public/contact-section.tsx`, `components/layout/public-header.tsx`, `components/layout/public-footer.tsx`, `components/layout/whatsapp-fab.tsx`
- **Source Finding IDs** (3): `A08-003`, `A08-004`, `A08-007`
- **Gate Status**: `NEEDS_DECISION: OD-09`
- **Concrete Fix Summary**: Persist selected Hajj 2027 package slug, Maktab category, indicative price band (labeled as non-binding MoRA pre-registration estimate per `OD-09e`), and pilgrim city/country in `submitHajjInquiryApplication`; replace every raw `wa.me/${phone}` concatenation across `ContactSection`, `StatusTracker`, `PublicHeader`, `PublicFooter`, and `WhatsAppFab` with `toWaMeUrl()` (`923...` E.164 digits); and enforce `enforceRateLimit()` + hidden honeypot field across all public submission actions.
- **Red->Green Test**: `tests/w3/f-pub/hajj-wame-and-antispam.test.ts` — asserts Hajj package & Maktab persist on the created dossier, `03274029701` renders `https://wa.me/923274029701`, and honeypot-filled or burst spam requests are rejected.

#### T-056 — [P1] Add `/refund-policy`, harden `/terms`, display verified DTS/MoRA/IATA/NTN licenses in Footer, and hide fabricated fallback testimonials
- **T-ID**: `T-056`
- **Severity**: `P1`
- **Title**: Add `/refund-policy`, harden `/terms`, display verified DTS/MoRA/IATA/NTN licenses in Footer, and hide fabricated fallback testimonials
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/(public)/terms/page.tsx`, `app/(public)/refund-policy/page.tsx`, `components/layout/public-footer.tsx`, `components/public/marketing-sections.tsx`
- **Source Finding IDs** (3): `A25-006`, `A25-007`, `A25-009`
- **Gate Status**: `NEEDS_DECISION: OD-10`
- **Concrete Fix Summary**: Create `app/(public)/refund-policy/page.tsx` and update `app/(public)/terms/page.tsx` with KSA visa/airline non-refundable rules, cancellation schedule, and Pakistani governing law (Lahore jurisdiction); display verified agency license badges (DTS, MoRA/HGO, IATA, NTN from `agency_settings` per `OD-10`) in `PublicFooter`; and remove hardcoded `DEFAULT_TESTIMONIALS` fallback in `MarketingSections` so reviews render ONLY when verified DB testimonials exist.
- **Red->Green Test**: `tests/w3/f-pub/terms-refund-and-testimonials.test.ts` — verifies `/refund-policy` renders cancellation schedule, `MarketingSections` hides review carousel when `testimonials=[]`, and `PublicFooter` renders configured license badges cleanly.

#### T-057 — [P1] Enable ISR caching on `/`, `/privacy`, `/terms`, code-split `1.06 MB` public JS bundle, and fix broken cross-page `#hash` header/footer links
- **T-ID**: `T-057`
- **Severity**: `P1`
- **Title**: Enable ISR caching on `/`, `/privacy`, `/terms`, code-split `1.06 MB` public JS bundle, and fix broken cross-page `#hash` header/footer links
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/(public)/layout.tsx`, `app/(public)/page.tsx`, `components/layout/public-header.tsx`, `components/layout/public-footer.tsx`
- **Source Finding IDs** (3): `A21-004`, `A22-005`, `A22-008`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Remove `export const dynamic = "force-dynamic"` from `app/(public)/page.tsx`, `/privacy`, and `/terms` in favor of `revalidate = 300` + targeted column projections + `next/dynamic` lazy chunks for below-the-fold modals/Hajj/Status sections; prefix section anchors in `PublicHeader` and `PublicFooter` with `/#packages`, `/#planner`, `/#hajj`, `/#track-status`, `/#contact` so navigating from `/privacy`, `/terms`, or `/refund-policy` works seamlessly.
- **Red->Green Test**: `tests/w3/f-pub/public-caching-and-links.test.ts` — asserts `app/(public)/page.tsx` exports `revalidate` (not `force-dynamic`) and all `PublicHeader`/`PublicFooter` section links use root-relative `/#...` hrefs.

#### T-058 — [P1] Use unguessable versioned R2 keys for Quotation PDFs, render all multi-stay hotel legs & booked-only inclusions, and pull live `agency_settings`
- **T-ID**: `T-058`
- **Severity**: `P1`
- **Title**: Use unguessable versioned R2 keys for Quotation PDFs, render all multi-stay hotel legs & booked-only inclusions, and pull live `agency_settings`
- **Fixer Owner**: `F-DESK`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/posters/render-quotation-pdf.ts`, `app/actions/quotes.ts`
- **Source Finding IDs** (3): `A10-005`, `A10-007`, `A20-009`
- **Gate Status**: `NEEDS_DECISION: OD-09`
- **Concrete Fix Summary**: Upload generated 3-Page Quotation PDFs to private R2 keys `quotes/${applicationId}/v${version}-${randomHex}.pdf` served via signed `/api/media/...` URLs (preventing PII enumeration & stale CDN caching on revised quotes); render all `hotelStays` legs in chronological sequence and list ONLY pillars actually enabled on the quote (`includeFlights`, `includeHotels`, `includeTransport`, `includeZiyarat`); and source agency address, phones, email, and license numbers from `getCompanyInfo()` (`agency_settings`).
- **Red->Green Test**: `tests/w3/f-desk/quotation-pdf-fidelity.test.ts` — renders a 3-stay Makkah->Madinah->Makkah Visa+Hotel quote (no Flights) and asserts all 3 hotel stays appear, Flights inclusion is omitted, R2 key includes version+nonce, and `agency_settings` contact info is used.

#### T-059 — [P1] Preserve append-only `application_quotes` revision history with optimistic locking, wire Email/24h-WA dispatch in `QuoteDispatchBar`, and fix Kanban/Worksheet traps
- **T-ID**: `T-059`
- **Severity**: `P1`
- **Title**: Preserve append-only `application_quotes` revision history with optimistic locking, wire Email/24h-WA dispatch in `QuoteDispatchBar`, and fix Kanban/Worksheet traps
- **Fixer Owner**: `F-DESK`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/quotes.ts`, `components/admin/applications/quote-worksheet-form.tsx`, `components/admin/applications/quote-dispatch-bar.tsx`, `components/admin/hubs/applications-kanban-board.tsx`
- **Source Finding IDs** (5): `A05-010`, `A10-006`, `A10-008`, `A10-010`, `A10-011`
- **Gate Status**: `NEEDS_DECISION: OD-02`
- **Concrete Fix Summary**: Insert new `version = prevVersion + 1` rows in `saveApplicationQuote` with `expectedVersion` optimistic concurrency check and net-cost floor guard (`A05-010`, `A10-006`); fix `QuoteWorksheetForm` default `supplierId = null` (eliminating silent first-supplier hijack) and numeric input UX (`A10-011`); wire `QuoteDispatchBar` to send real quotation emails via `lib/security/mailer.ts` (`OD-02`) and check Meta 24h window before WhatsApp PDF send (`A10-008`); and unify Kanban `new`/`pending_quote` columns while keeping `cancelled` distinct from `rejected` (`A10-010`).
- **Red->Green Test**: `tests/w3/f-desk/quote-revisions-and-kanban.test.ts` — proves saving two revisions creates `version=1` and `version=2` rows, stale `expectedVersion` rejects concurrent overwrite, `supplierId` defaults to `null`, and Kanban drag to `cancelled` persists `cancelled`.

#### T-060 — [P1] Replace `/admin` & `/admin/applications` full-table scans with SQL aggregations/pagination, fix collected-revenue KPIs, and sanitize/gate CSV export
- **T-ID**: `T-060`
- **Severity**: `P1`
- **Title**: Replace `/admin` & `/admin/applications` full-table scans with SQL aggregations/pagination, fix collected-revenue KPIs, and sanitize/gate CSV export
- **Fixer Owner**: `F-DESK`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/admin/(dashboard)/page.tsx`, `app/admin/(dashboard)/applications/page.tsx`, `components/admin/dashboard/export-csv-button.tsx`, `components/admin/dashboard/executive-kpi-cards.tsx`
- **Source Finding IDs** (5): `A09-002`, `A09-003`, `A09-006`, `A10-012`, `A22-006`
- **Gate Status**: `NEEDS_DECISION: OD-07`
- **Concrete Fix Summary**: Rewrite `/admin` Overview (`app/admin/(dashboard)/page.tsx`) to use SQL `COUNT`/`SUM` queries bounded by PKT date range instead of loading every application row into Node RAM; separate `Collected Revenue` (verified payments) from `Quoted Pipeline` (`A09-003`); paginate `/admin/applications` with preserved SLA/status URL filters (`A10-012`); gate CSV export behind `super_admin` (`OD-07`) + `audit_logs`, and neutralize spreadsheet formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) in `ExportCsvButton` (`A09-002`).
- **Red->Green Test**: `tests/w3/f-desk/overview-kpis-and-csv.test.ts` — verifies `escapeCsvCell("=CMD|' /C calc'!A0")` prefixes `'=CMD...`, unpaid quotes are excluded from Collected Revenue KPI, and non-`super_admin` CSV export is blocked.

#### T-061 — [P1] Move `Cmd+K` package lookup to indexed SQL search beyond 200 rows & fix `isForeignKeyError` (`DrizzleQueryError.cause`) + seat bounds in `groups.ts`
- **T-ID**: `T-061`
- **Severity**: `P1`
- **Title**: Move `Cmd+K` package lookup to indexed SQL search beyond 200 rows & fix `isForeignKeyError` (`DrizzleQueryError.cause`) + seat bounds in `groups.ts`
- **Fixer Owner**: `F-DESK`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/command-lookup.ts`, `app/actions/groups.ts`
- **Source Finding IDs** (3): `A07-008`, `A07-009`, `A09-005`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Update `searchPostPackagesCommandAction` (`app/actions/command-lookup.ts`) to push `ILIKE` / exact `postCode` filters into SQL so packages older than the latest 200 rows remain searchable; unwrap `(err as { cause?: { code?: string } })?.cause?.code === "23503"` in `app/actions/groups.ts` `isForeignKeyError` so deleting booked group packages cleanly soft-deactivates instead of crashing; and reject `totalSeats < bookedSeats` in `upsertGroupDeparture`.
- **Red->Green Test**: `tests/w3/f-desk/groups-fk-and-lookup.test.ts` — verifies wrapped `DrizzleQueryError` (`cause.code = "23503"`) triggers soft-deactivation in `deleteGroupPackage`, `totalSeats < bookedSeats` is rejected, and `searchPostPackagesCommandAction` queries SQL directly.

#### T-062 — [P1] Sync Studio card edits to live `group_packages` (airline/hotel FKs), paginate `>10`-card multi-package posters, rasterize vector PDFs, and validate `convertPostLookupToApplication`
- **T-ID**: `T-062`
- **Severity**: `P1`
- **Title**: Sync Studio card edits to live `group_packages` (airline/hotel FKs), paginate `>10`-card multi-package posters, rasterize vector PDFs, and validate `convertPostLookupToApplication`
- **Fixer Owner**: `F-STUDIO`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/marketing-ops.ts`, `components/admin/hubs/studio-hub-client.tsx`, `lib/posters/render-multi-package-poster.ts`
- **Source Finding IDs** (5): `A09-004`, `A11-005`, `A11-007`, `A11-008`, `A11-009`
- **Gate Status**: `NEEDS_DECISION: OD-09`
- **Concrete Fix Summary**: Propagate Studio card updates (`quad/triple/double` prices, dates, matched `airlineId` & Makkah/Madinah `hotelId` FKs) transactionally to linked `group_packages` & `group_departures` and scheduled social drafts (`A11-005`, `A11-009`); paginate `>10`-card supplier sheets into multi-sheet `Sheet 1/N` posters instead of `.slice(0, 10)` silent truncation (`A11-007`, `OD-09b`); render vector PDF flyers via Gotenberg/PDF preview instead of broken `<img src="*.pdf">` (`A11-008`); and add Zod validation + idempotency to `convertPostLookupToApplication` (`A09-004`).
- **Red->Green Test**: `tests/w3/f-studio/poster-pagination-and-sync.test.ts` — asserts a 17-card batch produces 2 paginated poster sheets (`10 + 7`, 0 dropped cards), card price edits update `group_departures`, and `NaN` inputs to `convertPostLookupToApplication` fail Zod validation.

#### T-063 — [P1] Replace dead `gemini-3.8-*` / `claude-3.5-sonnet` slugs, add `AbortSignal.timeout` + token caps, preserve matrix flights/infant airfare, and require human review before catalog sync
- **T-ID**: `T-063`
- **Severity**: `P1`
- **Title**: Replace dead `gemini-3.8-*` / `claude-3.5-sonnet` slugs, add `AbortSignal.timeout` + token caps, preserve matrix flights/infant airfare, and require human review before catalog sync
- **Fixer Owner**: `F-STUDIO`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/ai/models.ts`, `lib/ai/extract-packages.ts`, `lib/ai/quoting-copilot.ts`, `app/actions/marketing-ops.ts`
- **Source Finding IDs** (6): `A05-007`, `A11-006`, `A12-003`, `A12-005`, `A12-006`, `A12-008`
- **Gate Status**: `NEEDS_DECISION: OD-09`
- **Concrete Fix Summary**: Centralize valid production model IDs (`gemini-2.5-flash`, `gemini-2.5-pro`, current OpenRouter fallbacks) in `lib/ai/models.ts` (`A12-003`); attach `AbortSignal.timeout(45_000)` + `maxOutputTokens` on every AI SDK call (`A12-005`); expand flyer extraction schema to preserve flight leg schedules, open-jaw gateways, and child/infant pricing (`A11-006`) while including infant airfare in `quoting-copilot.ts` (`A05-007`, `OD-09d`); stage B2B flyer extractions in `draft` review state before public catalog persistence (`A12-006`); and remove dead `createQuotingCopilotTools` (`A12-008`).
- **Red->Green Test**: `tests/w3/f-studio/ai-models-and-extraction.test.ts` — verifies zero `gemini-3.8` or retired model slugs exist, `AbortSignal` is passed to all `generateObject`/`generateText` calls, infant airfare is added when `infants > 0` & `includeFlights=true`, and extracted flyers stage as `draft`.

#### T-064 — [P1] Eliminate 14-day VIP Outreach TOCTOU double-send race & duplicate unnormalized phone entries in `marketing-ops.ts`
- **T-ID**: `T-064`
- **Severity**: `P1`
- **Title**: Eliminate 14-day VIP Outreach TOCTOU double-send race & duplicate unnormalized phone entries in `marketing-ops.ts`
- **Fixer Owner**: `F-STUDIO`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/marketing-ops.ts`
- **Source Finding IDs** (1): `A17-007`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Canonicalize `vip_contacts.whatsappNumber` via `lib/phone.ts` on upsert and acquire a row-level `FOR UPDATE` lock checking `lastOutreachAt` inside `withTransaction()` before dispatching outreach messages so double-clicks or parallel tabs cannot send duplicate VIP pitches.
- **Red->Green Test**: `tests/w3/f-studio/vip-outreach-race.test.ts` — fires two concurrent outreach mutations for the same VIP phone (`03001234567` and `+923001234567`) and asserts exactly one send succeeds while the second hits the 14-day lock.

#### T-065 — [P1] Enforce atomic `wamid`/conversation upserts, monotonic status ticks (`sent->delivered->read`), strict verify tokens, and honest R2 media-mirror errors
- **T-ID**: `T-065`
- **Severity**: `P1`
- **Title**: Enforce atomic `wamid`/conversation upserts, monotonic status ticks (`sent->delivered->read`), strict verify tokens, and honest R2 media-mirror errors
- **Fixer Owner**: `F-WA`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/api/webhooks/whatsapp/route.ts`, `lib/whatsapp/media-mirror.ts`, `lib/whatsapp/linked-device.ts`
- **Source Finding IDs** (6): `A03-008`, `A13-008`, `A14-002`, `A14-003`, `A14-004`, `A22-004`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Use atomic PostgreSQL `ON CONFLICT` upserts for `whatsapp_conversations` unread increments and `whatsapp_messages.wamid` (`A14-002`); guard message status updates with monotonic rank checks (`failed/sent < delivered < read`) and buffer early status receipts (`A14-003`); remove hardcoded `linked_device_default_token` / fallback verify tokens and reject unknown `phone_number_id` webhooks (`A03-008`, `A14-004`); and make `mirrorInboundWhatsAppMediaToR2` return explicit failure metadata instead of fake URLs while running strictly in the async Trigger worker (`A13-008`, `A22-004`).
- **Red->Green Test**: `tests/w3/f-wa/webhook-monotonic-and-mirror.test.ts` — proves out-of-order `delivered` after `read` does not regress message status, unknown `phone_number_id` or default verify token is rejected, and failed R2 media mirror records `media_status="failed"`.

#### T-066 — [P1] Fix Guided Umrah Intake free-text/Hajj traps, bot-to-bot loops, double-tap duplicate `ART-WA-...` dossiers, and intent-classifier prompt injection
- **T-ID**: `T-066`
- **Severity**: `P1`
- **Title**: Fix Guided Umrah Intake free-text/Hajj traps, bot-to-bot loops, double-tap duplicate `ART-WA-...` dossiers, and intent-classifier prompt injection
- **Fixer Owner**: `F-WA`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/whatsapp/intake-flow.ts`, `lib/whatsapp/intent-classifier.ts`
- **Source Finding IDs** (3): `A12-007`, `A14-007`, `A14-008`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Allow `cancel` / `human` / `hajj` escape hatches out of `lib/whatsapp/intake-flow.ts` and cap consecutive invalid-input reprompts (`max 2` before handoff to human consultant) to prevent bot-to-bot loops (`A14-007`); lock the conversation state row (`SELECT ... FOR UPDATE`) at `AWAITING_HOTEL_TIER` completion so rapid double-taps create exactly ONE `ART-WA-...` dossier (`A14-008`); and isolate untrusted inbound pilgrim text inside XML delimiters with strict enum validation in `lib/whatsapp/intent-classifier.ts` (`A12-007`).
- **Red->Green Test**: `tests/w3/f-wa/intake-flow-and-classifier.test.ts` — simulates concurrent `AWAITING_HOTEL_TIER` replies (asserting 1 dossier created), verifies `"hajj inquiry"` exits Umrah intake cleanly, and tests multi-line role-spoofing payloads against `intent-classifier`.

#### T-067 — [P1] Enforce Meta 24h service window, fix Template Builder media/`{{1}}` samples, fix Broadcast retry counter & vault double-encryption, and gate unverified IBAN
- **T-ID**: `T-067`
- **Severity**: `P1`
- **Title**: Enforce Meta 24h service window, fix Template Builder media/`{{1}}` samples, fix Broadcast retry counter & vault double-encryption, and gate unverified IBAN
- **Fixer Owner**: `F-WA`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/whatsapp-crm.ts`, `lib/whatsapp/encryption.ts`, `lib/whatsapp/meta-api.ts`, `lib/whatsapp/auto-responder.ts`, `components/admin/desk/meta-template-builder-modal.tsx`
- **Source Finding IDs** (7): `A14-010`, `A14-011`, `A14-012`, `A17-006`, `A20-007`, `A25-010`, `A26-009`
- **Gate Status**: `NEEDS_DECISION: OD-10`
- **Concrete Fix Summary**: Check `lastInboundAt > now - 24h` across `app/actions/whatsapp-crm.ts` before freeform text/PDF/reaction/outreach sends (requiring approved `UTILITY`/`MARKETING` templates outside 24h `A14-010`); include `IMAGE`/`DOCUMENT` header handles & `example.body_text` samples in `MetaTemplateBuilderModal` (`A14-011`); recompute broadcast `failedCount`/`sentCount` from recipient row aggregates on 1-click retry with per-recipient idempotency (`A14-012`); delegate `lib/whatsapp/encryption.ts` to `lib/security/vault.ts` and skip re-encrypting masked/unchanged credentials (`A20-007`); mark `whatsapp_accounts` `NEEDS_REAUTH` on Meta `190`/`401` errors (`A26-009`); fix `google_business` mapping in `marketing-bridges.ts` (`A17-006`); and suppress bank IBAN auto-replies unless `agency_settings.ibanVerified === true` (`A25-010`, `OD-10`).
- **Red->Green Test**: `tests/w3/f-wa/window-templates-and-broadcast-retry.test.ts` — asserts freeform send `>24h` after last inbound returns `WINDOW_CLOSED_TEMPLATE_REQUIRED`, broadcast retry keeps `sent + failed <= totalRecipients`, and partial WABA settings save preserves existing encrypted token.

#### T-068 — [P1] Wire real staff consultants in `/admin/desk`, load newest 50 messages, make adaptive polling read-only + visibility-paused, and align `?tab=` deep links
- **T-ID**: `T-068`
- **Severity**: `P1`
- **Title**: Wire real staff consultants in `/admin/desk`, load newest 50 messages, make adaptive polling read-only + visibility-paused, and align `?tab=` deep links
- **Fixer Owner**: `F-WA`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/admin/(dashboard)/desk/page.tsx`, `components/admin/hubs/desk-hub-client.tsx`, `app/actions/whatsapp-crm.ts`
- **Source Finding IDs** (5): `A00-013`, `A00-015`, `A14-014`, `A14-015`, `A22-003`
- **Gate Status**: `NEEDS_DECISION: OD-07`
- **Concrete Fix Summary**: Query active `user` staff accounts in `app/admin/(dashboard)/desk/page.tsx` and pass them into `DeskHubClient` (deleting hardcoded fake consultant UUIDs that crash `assigned_staff_id` FK `A00-013`); fetch `ORDER BY created_at DESC LIMIT 50` (reversed in memory) so long threads show the newest messages (`A14-015`); remove DB writes from read poll ticks and pause polling when tab is hidden so Neon can scale to zero (`A22-003`, `OD-07`); preserve `coexistenceMode` / `"Personal (Bot Muted)"` metadata during poll merges (`A14-014`); and support `?tab=inbox|kanban|pipeline|auto-replies|templates` aliases (`A00-015`).
- **Red->Green Test**: `tests/w3/f-wa/desk-inbox-and-polling.test.ts` — verifies consultant assignment validates real `user.id`, 100-message thread SSR returns messages `51..100`, and poll merge preserves `botMuted` state without executing SQL `UPDATE`.

#### T-069 — [P1] Harden `/api/oauth/social/[provider]` auth/state/redirect checks, migrate `lib/social/crypto.ts` to `vault.ts`, and stop multi-page candidate overwrite
- **T-ID**: `T-069`
- **Severity**: `P1`
- **Title**: Harden `/api/oauth/social/[provider]` auth/state/redirect checks, migrate `lib/social/crypto.ts` to `vault.ts`, and stop multi-page candidate overwrite
- **Fixer Owner**: `F-SOCIAL`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/api/oauth/social/[provider]/route.ts`, `app/api/oauth/social/[provider]/callback/route.ts`, `lib/social/crypto.ts`, `app/actions/social-scheduler.ts`
- **Source Finding IDs** (3): `A03-009`, `A16-008`, `A16-009`
- **Gate Status**: `NEEDS_DECISION: OD-11`
- **Concrete Fix Summary**: Enforce `await requireSuperAdmin()` at the very top of both `/api/oauth/social/[provider]` and `/callback` BEFORE reading `?code` or issuing any redirect (`A03-009`); require `NEXT_PUBLIC_APP_URL` without `localhost:3000` prod leaks and verify `state` HMAC with `crypto.timingSafeEqual` (`A16-008`); delegate `lib/social/crypto.ts` to `lib/security/vault.ts`; and store OAuth page/location candidates in short-lived encrypted pending state so connecting a second Facebook Page or IG account never overwrites an existing `ACTIVE` integration (`A16-009`).
- **Red->Green Test**: `tests/w3/f-social/oauth-callback-security.test.ts` — proves unauthenticated `/callback?code=...` returns `401/403` with zero cross-origin redirect, invalid `state` fails constant-time check, and connecting Page B leaves Page A `ACTIVE`.

#### T-070 — [P1] Complete TikTok Audit UX/polling, Facebook scopes/metrics & multi-phase cleanup, YouTube quota guard, EXIF Sharp normalizer, and Spotlight/blob composer fixes
- **T-ID**: `T-070`
- **Severity**: `P1`
- **Title**: Complete TikTok Audit UX/polling, Facebook scopes/metrics & multi-phase cleanup, YouTube quota guard, EXIF Sharp normalizer, and Spotlight/blob composer fixes
- **Fixer Owner**: `F-SOCIAL`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/social/providers/tiktok.ts`, `lib/social/providers/facebook.ts`, `lib/social/providers/youtube.ts`, `lib/social/normalize-media.ts`, `app/actions/social-scheduler.ts`, `components/admin/hubs/campaigns-hub-client.tsx`
- **Source Finding IDs** (7): `A13-007`, `A16-011`, `A16-012`, `A16-013`, `A16-014`, `A17-010`, `A26-010`
- **Gate Status**: `NEEDS_DECISION: OD-11`
- **Concrete Fix Summary**: Add TikTok `user.info.profile`/`video.list` scopes, `publish_id` status polling, and TikTok Audit UX controls (creator info fetch, privacy selector, commercial toggle — gated behind `TIKTOK_DIRECT_POST_APPROVED` per `OD-11` `A16-011`); update Facebook Graph scopes (`pages_manage_engagement`, `read_insights`), current Insights metric names, and partial-upload cleanup (`A16-012`, `A26-010`); track YouTube daily unit budget & upload metadata (`A16-013`); wire `sharp().rotate()` EXIF-preserving `normalize-media.ts` (`A13-007`); preserve Spotlight child media, GMB CTA fields, and retry lineage in `social-scheduler.ts` (`A16-014`); and block `blob:` URLs from saving when R2 upload fails in `CampaignsHubClient` (`A17-010`).
- **Red->Green Test**: `tests/w3/f-social/providers-and-composer-fidelity.test.ts` — tests TikTok `publish_id` polling, EXIF orientation preservation in `normalizeImageForSocialBuffer`, Spotlight distinct child media URL retention, and rejection of `blob:` URLs in `createScheduledPost`.

#### T-071 — [P1] Scope Broadcast templates per WABA account, show honest WA Group `Failed` badges, gate `staff` broadcast controls, and bound `/admin/campaigns` SSR queries
- **T-ID**: `T-071`
- **Severity**: `P1`
- **Title**: Scope Broadcast templates per WABA account, show honest WA Group `Failed` badges, gate `staff` broadcast controls, and bound `/admin/campaigns` SSR queries
- **Fixer Owner**: `F-SOCIAL`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/admin/(dashboard)/campaigns/page.tsx`, `components/admin/hubs/campaigns-hub-client.tsx`, `components/admin/campaigns/whatsapp-broadcast-drawer.tsx`
- **Source Finding IDs** (4): `A17-005`, `A17-008`, `A17-009`, `A17-011`
- **Gate Status**: `NEEDS_DECISION: OD-07`
- **Concrete Fix Summary**: Filter Meta templates and broadcast queue strictly by selected `whatsappAccountId` in `CampaignsHubClient` (`A17-008`); render failed WhatsApp group/status dispatches with red `Failed` status badges and exclude them from shared counters (`A17-005`); hide/disable bulk Meta Broadcast launch & OAuth controls for non-`super_admin` staff (`A17-009`, `OD-07`); and add `LIMIT`/pagination + SQL summary counts to `/admin/campaigns` SSR (`A17-011`).
- **Red->Green Test**: `tests/w3/f-social/campaigns-hub-guards.test.ts` — verifies template list filters by `whatsappAccountId`, failed WA group shares never increment `sharedCount`, and `/admin/campaigns` SSR queries enforce bounded `LIMIT`s.

#### T-072 — [P1] Bundle `public/logo*` + env checks in `trigger.config.ts`, add AI/WA concurrency queues, fix 30d idempotency key poisoning, and restore `CopilotRealtimeRunBanner` output
- **T-ID**: `T-072`
- **Severity**: `P1`
- **Title**: Bundle `public/logo*` + env checks in `trigger.config.ts`, add AI/WA concurrency queues, fix 30d idempotency key poisoning, and restore `CopilotRealtimeRunBanner` output
- **Fixer Owner**: `F-JOBS`
- **Sub-Wave**: `W3B`
- **Target Files**: `trigger.config.ts`, `trigger/queues.ts`, `trigger/dispatch.ts`, `components/admin/desk/copilot-realtime-run-banner.tsx`
- **Source Finding IDs** (5): `A18-003`, `A18-004`, `A18-005`, `A18-006`, `A18-009`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Configure `additionalFiles: ["public/logo*"]` and startup required-env verification in `trigger.config.ts` (`A18-003`, `A18-004`); attach bounded `queue` definitions (`aiExtractionQueue`, `quotingCopilotQueue`, per-conversation `inboundWhatsappQueue`) to all unqueued tasks (`A18-005`); include `scheduledFor` / `contentHash` / `retryAttempt` in `idempotencyKeys.create()` so rescheduling a post, re-rendering an edited poster, or retrying a broadcast is never poisoned for 30 days (`A18-006`); and remove `skipColumns: ["payload", "output"]` from `CopilotRealtimeRunBanner` so Cloud Copilot proposals hydrate immediately in the UI (`A18-009`).
- **Red->Green Test**: `tests/w3/f-jobs/queues-idempotency-and-banner.test.ts` — asserts rescheduling a post generates a distinct idempotency key, all `schemaTask`s declare explicit `queue`s, and `CopilotRealtimeRunBanner` subscribes without `skipColumns: ["output"]`.

#### T-073 — [P1] Align `trigger/send-whatsapp-group-campaign.task.ts` with `OD-01` Linked-Device topology (retire cloud socket task vs sidecar RPC)
- **T-ID**: `T-073`
- **Severity**: `P1`
- **Title**: Align `trigger/send-whatsapp-group-campaign.task.ts` with `OD-01` Linked-Device topology (retire cloud socket task vs sidecar RPC)
- **Fixer Owner**: `F-JOBS`
- **Sub-Wave**: `W3B`
- **Target Files**: `trigger/send-whatsapp-group-campaign.task.ts`
- **Source Finding IDs** (1): `A17-004`
- **Gate Status**: `NEEDS_DECISION: OD-01`
- **Concrete Fix Summary**: Stop `send-whatsapp-group-campaign.task.ts` from attempting in-process Baileys WebSocket connections inside ephemeral Trigger.dev Cloud containers (where `socketMap` is always empty): under Recommended Default **Option A**, mark queued WA Group/Status shares `manual_ready` for the 1-click Ban-Safe Manual Assisted Share Queue; or under Options B/C, dispatch via authenticated sidecar HTTP RPC with anti-ban jitter.
- **Red->Green Test**: `tests/w3/f-jobs/wa-group-campaign-task.test.ts` — verifies `send-whatsapp-group-campaign` never instantiates a local Baileys socket inside Trigger Cloud and transitions rows cleanly per `OD-01`.

#### T-074 — [P1] Align `schedules.task.ts` cron cadences with hosting plan, fix `sla-overdue-quote-monitor` web-lead blindspot & `specialRequests` pollution, unify token refresh, and add PII retention purge cron
- **T-ID**: `T-074`
- **Severity**: `P1`
- **Title**: Align `schedules.task.ts` cron cadences with hosting plan, fix `sla-overdue-quote-monitor` web-lead blindspot & `specialRequests` pollution, unify token refresh, and add PII retention purge cron
- **Fixer Owner**: `F-JOBS`
- **Sub-Wave**: `W3B`
- **Target Files**: `trigger/schedules.task.ts`
- **Source Finding IDs** (6): `A00-010`, `A18-007`, `A18-008`, `A18-010`, `A25-008`, `A08-011`
- **Gate Status**: `NEEDS_DECISION: OD-07`
- **Concrete Fix Summary**: Adjust `trigger/schedules.task.ts` cron expressions to match the selected `OD-07` plan & Neon scale-to-zero window (`A18-007`); fix `sla-overdue-quote-monitor` to select ALL `new` + `pending_quote` web and WhatsApp leads older than `agency_settings.slaOverdueHours` and stamp `applications.slaEscalatedAt` instead of appending internal text into pilgrim-visible `specialRequests` (`A00-010`, `A08-011`, `A18-008`); delegate `proactive-social-token-refresh` to the fixed `lib/social/token-refresh.ts` engine (`A18-010`); and add nightly `pii-and-media-retention-purge` scheduled task enforcing `OD-06` TTLs (`A25-008`).
- **Red->Green Test**: `tests/w3/f-jobs/schedules-sla-and-retention.test.ts` — proves `sla-overdue-quote-monitor` escalates overdue web leads via `slaEscalatedAt` with zero mutation to `specialRequests`, and retention cron purges expired PII media keys.

#### T-075 — [P1] Enforce `requireSuperAdmin()` across Settings/Catalog/Staff mutations, stop `createStaffUser` session clobbering, and revoke active sessions on staff deactivation/demotion
- **T-ID**: `T-075`
- **Severity**: `P1`
- **Title**: Enforce `requireSuperAdmin()` across Settings/Catalog/Staff mutations, stop `createStaffUser` session clobbering, and revoke active sessions on staff deactivation/demotion
- **Fixer Owner**: `F-ADMIN`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/admin/(dashboard)/settings/page.tsx`, `app/actions/catalog.ts`, `app/actions/cms.ts`, `components/admin/catalog/users-client.tsx`
- **Source Finding IDs** (5): `A02-005`, `A02-006`, `A19-004`, `A20-005`, `A20-008`
- **Gate Status**: `NEEDS_DECISION: OD-07`
- **Concrete Fix Summary**: Gate `/admin/settings` mutations, staff user management, and master pricing/rate/CMS mutations behind `await requireSuperAdmin()` + `recordAuditLog()` per `OD-07` (`A02-005`, `A19-004`, `A20-005`); refactor `createStaffUser` in `app/actions/catalog.ts` to create credentials via server-side DB/admin adapter without setting `Set-Cookie` on the caller's response (fixing session clobbering `A02-006`); and execute `DELETE FROM session WHERE user_id = $1` inside `withTransaction()` whenever a user is deactivated or demoted (`A20-008`).
- **Red->Green Test**: `tests/w3/f-admin/rbac-and-staff-sessions.test.ts` — proves `staff` role receives `Forbidden` on settings/rate/user mutations, `createStaffUser` preserves the calling `super_admin` session, and deactivating a staff user deletes all their `session` rows.

#### T-076 — [P1] Fix `isForeignKeyError` (`DrizzleQueryError.cause`) across 8 catalog deletes, safeParse `submitContactMessage`, fix `revalidatePath` & `/admin/messages` redirect, and unlock Visa Rates UI
- **T-ID**: `T-076`
- **Severity**: `P1`
- **Title**: Fix `isForeignKeyError` (`DrizzleQueryError.cause`) across 8 catalog deletes, safeParse `submitContactMessage`, fix `revalidatePath` & `/admin/messages` redirect, and unlock Visa Rates UI
- **Fixer Owner**: `F-ADMIN`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/catalog.ts`, `app/actions/cms.ts`, `app/admin/(dashboard)/messages/page.tsx`, `components/admin/catalog/visa-client.tsx`
- **Source Finding IDs** (5): `A08-006`, `A08-008`, `A19-001`, `A19-006`, `A19-007`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Unwrap `DrizzleQueryError.cause` (`code === "23503"`) in `app/actions/catalog.ts` `isForeignKeyError` so deleting referenced airlines, hotels, cities, sectors, vehicles, or ziyarat items soft-deactivates (`isActive = false`) instead of throwing `500` (`A19-001`); replace uncaught `.parse()` in `submitContactMessage` (`app/actions/cms.ts`) with `.safeParse()` + rate-limit (`A08-006`); fix `app/admin/(dashboard)/messages/page.tsx` redirect to `/admin/catalog?tab=messages` (`A08-008`); add empty-state create button, `maxDays` display, and `sarToPkrRate` editor in `VisaClient` (`A19-006`); and revalidate `/`, `/admin/catalog`, and `/admin/settings` across all mutations (`A19-007`).
- **Red->Green Test**: `tests/w3/f-admin/catalog-softdelete-and-cms.test.ts` — verifies `deleteHotel` with FK violation (`cause.code="23503"`) sets `isActive=false`, invalid contact message returns `{ success: false }` without throwing, and `/admin/messages` redirects to `/admin/catalog?tab=messages`.

#### T-077 — [P1] Add admin CRUD for Hajj 2027 packages, Gallery, Ziyarat & Agency Licenses/IBAN, and align `lib/company-info.ts` to verified Lahore HQ
- **T-ID**: `T-077`
- **Severity**: `P1`
- **Title**: Add admin CRUD for Hajj 2027 packages, Gallery, Ziyarat & Agency Licenses/IBAN, and align `lib/company-info.ts` to verified Lahore HQ
- **Fixer Owner**: `F-ADMIN`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/company-info.ts`, `app/admin/(dashboard)/catalog/page.tsx`, `components/admin/hubs/catalog-hub-client.tsx`, `components/admin/settings/agency-settings-form.tsx`, `app/actions/catalog.ts`, `app/actions/cms.ts`
- **Source Finding IDs** (1): `A19-005`
- **Gate Status**: `NEEDS_DECISION: OD-10`
- **Concrete Fix Summary**: Expose full admin CRUD in `/admin/catalog` & `/admin/settings` for Hajj 2027 packages (`OD-09e`), Gallery items, Ziyarat master items, and `agency_settings` regulatory fields (`dtsLicense`, `moraLicense`, `iataCode`, `ntn`, `iban`, `ibanVerified`), and update `DEFAULT_COMPANY_INFO` in `lib/company-info.ts` to the single verified Askari 10 Lahore headquarters and official phone numbers (`OD-10`) without breaking existing exported `CompanyInfo` properties.
- **Red->Green Test**: `tests/w3/f-admin/company-info-and-crud.test.ts` — verifies `DEFAULT_COMPANY_INFO` reflects verified Lahore HQ + E.164 `buildWhatsappUrl`, and tests Hajj/Gallery/License CRUD actions.

#### T-078 — [P1] Add 158-Server-Action + 10-Route-Handler integration coverage, Playwright E2E journeys, and repair 11 bug-codifying legacy test files
- **T-ID**: `T-078`
- **Severity**: `P1`
- **Title**: Add 158-Server-Action + 10-Route-Handler integration coverage, Playwright E2E journeys, and repair 11 bug-codifying legacy test files
- **Fixer Owner**: `F-QA`
- **Sub-Wave**: `W3C`
- **Target Files**: `playwright.config.ts`, `tests/e2e/critical-journeys.spec.ts`, `tests/integration/server-actions-authz.test.ts`, `tests/whatsapp-multi-number-system.test.ts`, `tests/trigger-v4-webhook-and-realtime-copilot.test.ts`, `tests/multimodal-and-gotenberg.test.ts`, `tests/whatsapp-phase2-bot-and-media.test.ts`
- **Source Finding IDs** (5): `A24-003`, `A24-004`, `A24-005`, `A24-006`, `A24-009`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Build automated AuthZ + Zod integration harness (`tests/integration/server-actions-authz.test.ts`) exercising all exported Server Actions & Route Handlers (`A24-003`); add `playwright.config.ts` + E2E specs covering Custom Journey Builder, Group Booking, Status Tracker + Quote Acceptance + Voucher, Admin Login, Quote Worksheet, and Desk Inbox (`A24-009`); replace the 11 legacy test assertions that codified `wamid.sim_*` / `404` / Page-token bugs with real contract fakes (`A24-004`, `A24-005`); and sync accurate per-file test counts in `docs/PLATFORM_MASTER_BRIEF.md` (`A24-006`).
- **Red->Green Test**: `tests/integration/server-actions-authz.test.ts` & `tests/e2e/critical-journeys.spec.ts` — executes full Vitest + Playwright suite with 0 skipped security gates and 0 `wamid.sim_*` mock backdoors.

### 2.3 `P2` — Medium-Priority Hardening (UX Resilience, Timezone/A11y Fidelity, Query/Bundle Optimization)

#### T-079 — [P2] Normalize duplicate-case `whatsapp_message_type` enum, validate critical `jsonb` columns, and drop 11 redundant duplicate single-column indexes
- **T-ID**: `T-079`
- **Severity**: `P2`
- **Title**: Normalize duplicate-case `whatsapp_message_type` enum, validate critical `jsonb` columns, and drop 11 redundant duplicate single-column indexes
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `db/schema/whatsapp-crm.ts`, `db/schema/applications.ts`, `db/schema/auth.ts`, `db/schema/social-scheduler.ts`, `db/schema/suppliers-and-marketing.ts`, `drizzle/`
- **Source Finding IDs** (5): `A00-019`, `A00-020`, `A04-014`, `A04-015`, `A04-017`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Canonicalize `whatsapp_message_type` writes/reads to lowercase values and clean up orphaned enums (`A00-019`, `A04-014`); add runtime Zod parse helpers for high-risk `jsonb` columns (`hotelStays`, `multiHotelOptions`, `socialIntegrations.metadata` `A04-015`); drop the 11 redundant single-column indexes already covered by `UNIQUE` constraints or leading composite index columns (`A04-017`); and reconcile Drizzle snapshot metadata (`A00-020`).
- **Red->Green Test**: `tests/w3/f-plat/schema-hygiene.test.ts` — asserts duplicate single-column indexes are removed and `jsonb` helper schemas safely parse/fallback malformed payloads.

#### T-080 — [P2] Add PII retention columns/scrubbing on `whatsapp_messages.raw_payload` & add regulatory license/IBAN columns on `agency_settings`
- **T-ID**: `T-080`
- **Severity**: `P2`
- **Title**: Add PII retention columns/scrubbing on `whatsapp_messages.raw_payload` & add regulatory license/IBAN columns on `agency_settings`
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `db/schema/settings.ts`, `db/schema/whatsapp-crm.ts`, `db/schema/auth.ts`, `drizzle/`
- **Source Finding IDs** (2): `A04-016`, `A20-013`
- **Gate Status**: `NEEDS_DECISION: OD-06`
- **Concrete Fix Summary**: Add `dts_license`, `mora_license`, `iata_code`, `ntn_number`, `official_iban`, `iban_verified`, and `legal_entity_name` columns to `agency_settings` (`A20-013`, `OD-10`), and add retention timestamps / redacted payload storage rules on `whatsapp_messages.raw_payload`, `whatsapp_linked_device_sessions`, and expired `session`/`verification` rows (`A04-016`, `OD-06`).
- **Red->Green Test**: `tests/w3/f-plat/pii-and-agency-columns.test.ts` — verifies `agency_settings` exposes regulatory & verified-IBAN columns and raw payload scrubber strips PII fields.

#### T-081 — [P2] Guard `calculateOutreachCooldown` against `RangeError` on invalid dates & align 14-day / daily cap math to `Asia/Karachi` (PKT)
- **T-ID**: `T-081`
- **Severity**: `P2`
- **Title**: Guard `calculateOutreachCooldown` against `RangeError` on invalid dates & align 14-day / daily cap math to `Asia/Karachi` (PKT)
- **Fixer Owner**: `F-DOM`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/domain/marketing-ops.ts`
- **Source Finding IDs** (2): `A05-013`, `A17-013`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Validate `Number.isNaN(parsedDate.getTime())` inside `calculateOutreachCooldown` in `lib/domain/marketing-ops.ts` (returning safe fallback instead of throwing `RangeError: Invalid time value`) and compute calendar-day boundaries in `Asia/Karachi` (`UTC+05:00`) rather than server UTC.
- **Red->Green Test**: `tests/w3/f-dom/cooldown-pkt-and-nan-guard.test.ts` — passes malformed date strings (`"invalid"`, `""`) without throwing and verifies `23:30 UTC` (`04:30 PKT`) vs `19:30 UTC` (`00:30 PKT+1`) day-boundary math.

#### T-082 — [P2] Deduplicate Gotenberg HTML preparation & parallelize/bound multi-format poster rendering in `lib/posters/gotenberg.ts`
- **T-ID**: `T-082`
- **Severity**: `P2`
- **Title**: Deduplicate Gotenberg HTML preparation & parallelize/bound multi-format poster rendering in `lib/posters/gotenberg.ts`
- **Fixer Owner**: `F-INFRA`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/posters/gotenberg.ts`
- **Source Finding IDs** (1): `A13-011`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Refactor `renderHtmlViaGotenberg` in `lib/posters/gotenberg.ts` to reuse pre-built HTML/asset buffers and eliminate redundant sequential Chromium passes where single-pass or bounded concurrent calls suffice, cutting poster render latency and RAM footprint in half.
- **Red->Green Test**: `tests/w3/f-infra/gotenberg-perf.test.ts` — asserts `renderHtmlViaGotenberg` builds shared asset data URIs once and respects explicit format options without redundant requests.

#### T-083 — [P2] Preserve single-city `makkah_only`/`madinah_only` with Visa, fix `SegmentCard` past dates/rail removal, persist `sessionStorage` drafts, and highlight Step-6 field errors
- **T-ID**: `T-083`
- **Severity**: `P2`
- **Title**: Preserve single-city `makkah_only`/`madinah_only` with Visa, fix `SegmentCard` past dates/rail removal, persist `sessionStorage` drafts, and highlight Step-6 field errors
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `components/planner/city-sequence-module.tsx`, `components/planner/planner-context.tsx`, `components/planner/segment-card.tsx`, `components/planner/review-and-submit-step.tsx`
- **Source Finding IDs** (7): `A05-014`, `A06-009`, `A06-010`, `A06-011`, `A06-012`, `A06-013`, `A06-014`
- **Gate Status**: `NEEDS_DECISION: OD-09`
- **Concrete Fix Summary**: Keep `makkah_only` and `madinah_only` selectable when `includeVisa=true` (`A05-014`, `OD-09a`); add PKT `minDate` & timezone-safe `YYYY-MM-DD` formatting in `SegmentCard` (`A06-009`); persist non-PII itinerary state in `sessionStorage` and preserve Step-6 contact fields across step navigation (`A06-010`); clean up orphaned `MAK_TRN`/`MED_TRN` rail station legs when switching off Haramain Train (`A06-011`); reset stale `privateRoomAllocation` on hotel switch & warn when Makkah-first `includeTransport=false` (`A06-012`, `OD-09c`); align shared transport `pickupTime` persistence (`A06-013`); and return per-field Zod `fieldErrors` on Step 6 (`A06-014`).
- **Red->Green Test**: `tests/w3/f-pub/planner-ux-polish.test.ts` — verifies `makkah_only` stays active with Visa ON, switching rail->private car clears station transfer legs, and Step-6 renders field-level `aria-invalid` errors.

#### T-084 — [P2] Support international diaspora in Hajj 2027 inquiry, load DB-backed Hajj packages, wire `agencyWhatsapp` & unused CMS props, and align Lahore legal entity strings
- **T-ID**: `T-084`
- **Severity**: `P2`
- **Title**: Support international diaspora in Hajj 2027 inquiry, load DB-backed Hajj packages, wire `agencyWhatsapp` & unused CMS props, and align Lahore legal entity strings
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/(public)/page.tsx`, `app/(public)/privacy/page.tsx`, `app/(public)/terms/page.tsx`, `components/public/hajj-inquiry-section.tsx`, `components/public/group-packages-section.tsx`, `components/public/marketing-sections.tsx`, `components/public/contact-section.tsx`
- **Source Finding IDs** (9): `A07-010`, `A08-009`, `A08-010`, `A19-009`, `A20-010`, `A20-012`, `A25-011`, `A25-012`, `A25-013`
- **Gate Status**: `NEEDS_DECISION: OD-10`
- **Concrete Fix Summary**: Hydrate `HajjInquirySection` from DB catalog rows (`OD-09e`) without overflowing `specialRequests` (`A08-009`) and support overseas Pakistanis (`UK/US/GCC/EU` country + free-text city instead of Pakistan-only city lock `A08-010`); pass `agencyWhatsapp` into `<GroupPackagesSection />` and format all `wa.me` links via `toWaMeUrl()` (`A07-010`, `A20-012`); wire `validFrom`/`validUntil`, `isFeatured`, social URLs, and `mapsEmbedUrl` (`A19-009`, `A20-010`); reconcile `Al Ramlah Travels` legal name, Askari 10 Lahore address, Hajj hotel distance labels, and cookie/vault disclosures across public pages (`A25-011`, `A25-012`, `A25-013`, `OD-10`).
- **Red->Green Test**: `tests/w3/f-pub/diaspora-and-brand-consistency.test.ts` — submits a UK diaspora Hajj inquiry (`London, United Kingdom`), verifies `<GroupPackagesSection />` uses `https://wa.me/92...`, and asserts zero `Rawalpindi` or `DHA Phase 5` strings appear on public pages.

#### T-085 — [P2] Add `lang="ar" dir="rtl"` on sacred Arabic text, optional Haramain prayer-time header badge (`OD-08`), `prefers-reduced-motion`, `tabular-nums`, and form ARIA polish
- **T-ID**: `T-085`
- **Severity**: `P2`
- **Title**: Add `lang="ar" dir="rtl"` on sacred Arabic text, optional Haramain prayer-time header badge (`OD-08`), `prefers-reduced-motion`, `tabular-nums`, and form ARIA polish
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `components/layout/public-header.tsx`, `components/public/hero-slider.tsx`, `components/public/group-booking-modal.tsx`, `components/public/contact-section.tsx`
- **Source Finding IDs** (4): `A21-006`, `A21-008`, `A21-010`, `A21-011`
- **Gate Status**: `NEEDS_DECISION: OD-08`
- **Concrete Fix Summary**: Wrap all decorative sacred Arabic phrases (`بِسْمِ ٱللَّٰهِ...`, `لَبَّيْكَ...`) in `<span lang="ar" dir="rtl">` with proper Arabic font fallback per `OD-08` (`A21-006`) + optional Makkah/Madinah prayer-time badge in `PublicHeader`; pause `HeroSlider` auto-rotation when `prefers-reduced-motion: reduce` or keyboard focus is inside (`A21-010`); apply `tabular-nums` to PKR price counters (`A21-011`); and add `aria-invalid`, `aria-describedby`, and `role="alert"` across public forms (`A21-008`).
- **Red->Green Test**: `tests/w3/f-pub/a11y-arabic-and-motion.test.ts` — asserts every Arabic script node carries `lang="ar"` + `dir="rtl"`, `HeroSlider` respects `prefers-reduced-motion`, and invalid form fields expose `aria-invalid="true"`.

#### T-086 — [P2] Align `/admin` analytics to `Asia/Karachi` PKT, guard `0`-seat `NaN%`, upgrade `SmartInsightsBanner` + Revenue/Source charts, fix Kanban keyboard a11y, and add RTL PDF fonts + QR voucher
- **T-ID**: `T-086`
- **Severity**: `P2`
- **Title**: Align `/admin` analytics to `Asia/Karachi` PKT, guard `0`-seat `NaN%`, upgrade `SmartInsightsBanner` + Revenue/Source charts, fix Kanban keyboard a11y, and add RTL PDF fonts + QR voucher
- **Fixer Owner**: `F-DESK`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/admin/(dashboard)/page.tsx`, `app/admin/(dashboard)/applications/[id]/voucher/page.tsx`, `components/admin/dashboard/group-occupancy-card.tsx`, `components/admin/dashboard/smart-insights-banner.tsx`, `components/admin/dashboard/dashboard-charts.tsx`, `components/admin/hubs/applications-kanban-board.tsx`, `lib/posters/render-quotation-pdf.ts`, `app/actions/groups.ts`
- **Source Finding IDs** (10): `A00-018`, `A07-012`, `A09-007`, `A09-008`, `A09-009`, `A09-010`, `A10-013`, `A10-014`, `A10-015`, `A20-011`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Bucket `/admin` Overview date filters & CSV timestamps in `Asia/Karachi` (`A09-007`); guard `totalSeats === 0` against `NaN%`/`Infinity%` (`A09-008`); wire `agency_settings.slaOverdueHours`, `sarToPkrRate`, and expiring social OAuth token warnings into `SmartInsightsBanner` (`A00-018`, `A09-009`, `A20-011`); add Monthly Revenue Trajectory & Lead Source Breakdown charts in `DashboardCharts` (`A09-010`); separate drag handle from child links/buttons in `ApplicationsKanbanBoard` for WCAG keyboard navigation (`A10-014`); add QR verification SVG + back-link fix on `/admin/applications/[id]/voucher` (`A10-013`); add `dir="auto"` + Noto Arabic/Urdu font stack in `render-quotation-pdf.ts` (`A10-015`); and revalidate `/` + `/admin/catalog` in `app/actions/groups.ts` (`A07-012`).
- **Red->Green Test**: `tests/w3/f-desk/dashboard-pkt-and-kanban-a11y.test.ts` — asserts `0`-seat occupancy renders `0%` (never `NaN%`), expiring social tokens surface in `SmartInsightsBanner`, Kanban drag handle does not wrap child `<a href>` links, and `groups.ts` revalidates `/admin/catalog`.

#### T-087 — [P2] Reject invalid `Nov 31` flyer dates & fabricated baggage, wire `agency_settings` + compressed logo into Studio posters, preserve `socialJpegUrl`, add spend caps, and batch N+1 SQL loops
- **T-ID**: `T-087`
- **Severity**: `P2`
- **Title**: Reject invalid `Nov 31` flyer dates & fabricated baggage, wire `agency_settings` + compressed logo into Studio posters, preserve `socialJpegUrl`, add spend caps, and batch N+1 SQL loops
- **Fixer Owner**: `F-STUDIO`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/ai/extract-packages.ts`, `lib/ai/quoting-copilot.ts`, `lib/posters/render-multi-package-poster.ts`, `lib/posters/render-single-package-poster.ts`, `app/actions/marketing-ops.ts`
- **Source Finding IDs** (8): `A11-010`, `A11-011`, `A11-013`, `A11-014`, `A12-010`, `A12-011`, `A22-011`, `A23-013`
- **Gate Status**: `NEEDS_DECISION: OD-10`
- **Concrete Fix Summary**: Validate real calendar days (`Date.UTC` round-trip check blocking `2026-11-31` -> Postgres `22008` `A11-011`) and leave missing baggage `null` instead of fabricating `"20 Kg + 7 Kg"` in `lib/ai/extract-packages.ts` (`A12-011`, plus clean model cascade `A11-010`); pull live `sarToPkrRate` & catalog prices in `quoting-copilot.ts` fallback (`A12-010`); replace hardcoded `#DHALahore` / phone strings & `14.87 MB` logo bloat in Studio poster templates with `getCompanyInfo()` (`OD-10`) + compressed logo (`A11-013`); generate `socialJpegUrl` consistently across poster render paths (`A11-014`); log AI token/cost telemetry (`A23-013`); and replace N+1 sequential `for ... await db.insert/update` loops in `marketing-ops.ts` with batched multi-row queries (`A22-011`).
- **Red->Green Test**: `tests/w3/f-studio/flyer-dates-posters-and-batch.test.ts` — asserts `parseFlyerDateLabelsToIso("31 Nov 2026")` returns `null` (never `2026-11-31`), unstated baggage stays `null`, and Studio posters omit `#DHALahore`.

#### T-088 — [P2] Fix Broadcast CSV parser (`O'Connor`, `WhatsApp` header) & batch cost confirmation, wrap `WhatsAppAutoReplyStudio` modal in Base UI `<Dialog>`, and serialize Desk 4s poll requests
- **T-ID**: `T-088`
- **Severity**: `P2`
- **Title**: Fix Broadcast CSV parser (`O'Connor`, `WhatsApp` header) & batch cost confirmation, wrap `WhatsAppAutoReplyStudio` modal in Base UI `<Dialog>`, and serialize Desk 4s poll requests
- **Fixer Owner**: `F-WA`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/whatsapp/template-variables.ts`, `components/admin/desk/whatsapp-auto-reply-studio.tsx`, `components/admin/hubs/desk-hub-client.tsx`, `app/actions/whatsapp-crm.ts`
- **Source Finding IDs** (3): `A14-013`, `A14-016`, `A21-009`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Support apostrophes/UTF-8 names (`O'Connor`), `WhatsApp` / `Mobile` column headers, and RFC-4180 quoted commas in `parseWhatsappBroadcastCsv` (`lib/whatsapp/template-variables.ts`) + show estimated recipient count confirmation before paid `MARKETING` broadcasts (`A14-013`); replace raw `<div className="fixed inset-0">` overlay in `WhatsAppAutoReplyStudio` with accessible `@base-ui/react` `<Dialog>` (`Escape` + focus trap `A21-009`); and guard `DeskHubClient` polling with single-flight `inFlightRef` + scroll-position preservation so slow polls never overlap or yank scroll (`A14-016`).
- **Red->Green Test**: `tests/w3/f-wa/csv-parser-and-studio-dialog.test.ts` — parses CSV rows with `O'Connor`, quoted commas, and `WhatsApp` column headers accurately, and verifies `WhatsAppAutoReplyStudio` renders `role="dialog"`.

#### T-089 — [P2] Reserve PKT time-slots transactionally, purge fabricated `"DHA Phase 5, Lahore"` from Caption Copilot & GMB Previewer, fix mobile `320px` Calendar scroll, and align `/admin/distribution` `?tab=` links
- **T-ID**: `T-089`
- **Severity**: `P2`
- **Title**: Reserve PKT time-slots transactionally, purge fabricated `"DHA Phase 5, Lahore"` from Caption Copilot & GMB Previewer, fix mobile `320px` Calendar scroll, and align `/admin/distribution` `?tab=` links
- **Fixer Owner**: `F-SOCIAL`
- **Sub-Wave**: `W3B`
- **Target Files**: `lib/social/time-slots.ts`, `lib/social/caption-copilot.ts`, `lib/social/preview-formatter.ts`, `components/admin/campaigns/social-calendar-view.tsx`, `components/admin/hubs/campaigns-hub-client.tsx`, `app/admin/(dashboard)/distribution/page.tsx`, `app/admin/(dashboard)/outreach/page.tsx`
- **Source Finding IDs** (5): `A12-009`, `A16-015`, `A16-016`, `A17-014`, `A21-012`
- **Gate Status**: `NEEDS_DECISION: OD-10`
- **Concrete Fix Summary**: Fix PKT (`+05:00`) `<input type="datetime-local">` parsing, day-14 overflow window, and DB slot reservation in `lib/social/time-slots.ts` (`A16-015`); replace fabricated `"DHA Phase 5, Lahore"` branch references in `lib/social/caption-copilot.ts` & `lib/social/preview-formatter.ts` with verified `agency_settings` Askari 10 Lahore address (`A12-009`, `A16-016`, `OD-10`); add responsive horizontal container/agenda view to `SocialCalendarView` at `320px/375px` (`A21-012`); and align `/admin/distribution` + `/admin/outreach` redirects and `?tab=` query-param aliases in `CampaignsHubClient` (`A17-014`).
- **Red->Green Test**: `tests/w3/f-social/time-slots-and-brand-copy.test.ts` — verifies 11 AM / 4 PM / 9 PM PKT slot timestamps equal `06:00 / 11:00 / 16:00 UTC`, day-15+ overflow advances cleanly, and Caption Copilot / Previewer emit zero `DHA Phase 5` strings.

#### T-090 — [P2] Scope `trigger-realtime.ts` run tokens & `localProgressStore` per entity/user and remove `revalidatePath` from worker tasks
- **T-ID**: `T-090`
- **Severity**: `P2`
- **Title**: Scope `trigger-realtime.ts` run tokens & `localProgressStore` per entity/user and remove `revalidatePath` from worker tasks
- **Fixer Owner**: `F-JOBS`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/trigger-realtime.ts`, `trigger/metadata.ts`, `trigger/publish-social-post.task.ts`
- **Source Finding IDs** (4): `A02-012`, `A18-011`, `A18-012`, `A18-013`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Validate tag format and entity ownership in `app/actions/trigger-realtime.ts` before minting public Trigger read tokens or returning run outputs (`A02-012`, `A18-011`); key `localProgressStore` in `trigger/metadata.ts` strictly by `(taskType, entityId, runId)` instead of global `"latest"` (`A18-012`); and remove Next.js `revalidatePath` calls from inside Trigger worker tasks (`trigger/publish-social-post.task.ts` `A18-013`).
- **Red->Green Test**: `tests/w3/f-jobs/realtime-token-scoping.test.ts` — asserts arbitrary cross-entity tags are rejected by `listActiveRunsByTagsAction`, `localProgressStore` isolates concurrent entity runs, and `trigger/*.task.ts` contains zero `next/cache` imports.

#### T-091 — [P2] Add Zod `.safeParse()` + UUID validation across all 34 `catalog.ts`/`cms.ts` actions, reset dirty dialog state, fix Web Messages UX/`wa.me`, add `sortOrder` controls, and support `/admin/settings?tab=` aliases
- **T-ID**: `T-091`
- **Severity**: `P2`
- **Title**: Add Zod `.safeParse()` + UUID validation across all 34 `catalog.ts`/`cms.ts` actions, reset dirty dialog state, fix Web Messages UX/`wa.me`, add `sortOrder` controls, and support `/admin/settings?tab=` aliases
- **Fixer Owner**: `F-ADMIN`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/catalog.ts`, `app/actions/cms.ts`, `components/admin/catalog/messages-client.tsx`, `components/admin/catalog/departure-batch-dialog.tsx`, `components/admin/hubs/connections-settings-client.tsx`
- **Source Finding IDs** (6): `A02-010`, `A08-012`, `A19-011`, `A19-012`, `A19-013`, `A20-014`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Validate every ID/toggle/delete/upsert argument in `app/actions/catalog.ts` & `cms.ts` with `z.string().uuid()` + `.safeParse()` and catch Postgres `23505` unique collisions cleanly (`A02-010`, `A19-012`); sync dialog state via `key={entity?.id ?? "new"}` / `useEffect` across Catalog/Group dialogs (`A19-011`); keep active message visible after marking read, add E.164 `wa.me` reply link, and add `sortOrder` up/down controls (`A08-012`, `A19-013`); and honor `?tab=waba|devices|social|gotenberg|users|health` in `ConnectionsSettingsClient` (`A20-014`).
- **Red->Green Test**: `tests/w3/f-admin/catalog-validation-and-tabs.test.ts` — passes malformed non-UUID strings and duplicate slugs to `catalog.ts` / `cms.ts` actions (asserting structured `{ success: false }` instead of `500`) and tests `?tab=` alias mapping.

#### T-092 — [P2] Fix nested `<main>` landmark, add admin `error.tsx`/`loading.tsx` + skip link, lock `ThemeProvider` to light, lazy-load `CommandPalette`, and pass dynamic `slaOverdueHours` to `StatusBadge`
- **T-ID**: `T-092`
- **Severity**: `P2`
- **Title**: Fix nested `<main>` landmark, add admin `error.tsx`/`loading.tsx` + skip link, lock `ThemeProvider` to light, lazy-load `CommandPalette`, and pass dynamic `slaOverdueHours` to `StatusBadge`
- **Fixer Owner**: `F-UX`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/admin/(dashboard)/layout.tsx`, `app/admin/(dashboard)/error.tsx`, `app/admin/(dashboard)/loading.tsx`, `components/ui/sidebar.tsx`, `components/theme-provider.tsx`, `components/layout/admin-sidebar.tsx`, `components/layout/admin-topbar.tsx`, `components/layout/status-badge.tsx`
- **Source Finding IDs** (2): `A21-007`, `A22-010`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Change inner `<main>` in `app/admin/(dashboard)/layout.tsx` (or `SidebarInset`) to `<div>` so each admin route has exactly one `<main id="main-content">` landmark paired with a keyboard skip-to-content link (`A21-007`); add `app/admin/(dashboard)/error.tsx` and `loading.tsx`; enforce `forcedTheme="light" disableTransitionOnChange` in `components/theme-provider.tsx`; lazy-load `CommandPalette` via `next/dynamic` in `AdminTopbar` (`A22-010`); fix `AdminTopbar` web-messages notification link to `/admin/catalog?tab=messages`; and accept configurable `slaOverdueHours` in `StatusBadge`.
- **Red->Green Test**: `tests/w3/f-ux/admin-shell-a11y.test.ts` — renders admin shell structure and asserts single `<main>` landmark, skip-to-content anchor, `forcedTheme="light"`, and configurable `StatusBadge` SLA threshold.

#### T-093 — [P2] Restore `globalThis.fetch`/`process.env` mocks in `afterEach`, freeze wall-clock `Date.now()` PKT/KSA flakiness, replace hollow `typeof` self-tests, and unify Lahore office assertions
- **T-ID**: `T-093`
- **Severity**: `P2`
- **Title**: Restore `globalThis.fetch`/`process.env` mocks in `afterEach`, freeze wall-clock `Date.now()` PKT/KSA flakiness, replace hollow `typeof` self-tests, and unify Lahore office assertions
- **Fixer Owner**: `F-QA`
- **Sub-Wave**: `W3C`
- **Target Files**: `tests/ai-quoting-copilot.test.ts`, `tests/composio-and-social-oauth.test.ts`, `tests/social-phase2-reels-and-comments.test.ts`, `tests/social-phase3-calendar-copilot-and-providers.test.ts`, `tests/social-preview-and-analytics.test.ts`, `tests/whatsapp-phase2-bot-and-media.test.ts`, `tests/ziyarat-scope-sync.test.ts`
- **Source Finding IDs** (5): `A12-012`, `A24-007`, `A24-010`, `A24-011`, `A24-012`
- **Gate Status**: `NEEDS_DECISION: OD-10`
- **Concrete Fix Summary**: Replace unrestored global monkey-patches (`globalThis.fetch = ...`) with `vi.spyOn` + `vi.restoreAllMocks()` (`A24-010`); freeze time (`vi.useFakeTimers()`) on PKT/KSA boundary tests (`A24-011`); replace hollow `typeof fn === "function"` / copy-paste self-tests with real behavioral assertions including live-contract AI schema/redaction tests (`A12-012`, `A24-007`); and reconcile contradictory Rawalpindi vs Askari 10 Lahore office assertions across all test suites (`A24-012`, `OD-10`).
- **Red->Green Test**: `tests/unit/suite-determinism.test.ts` — runs suites under `TZ=UTC`, `TZ=America/Los_Angeles`, and `TZ=Asia/Karachi` in randomized order with 100% pass determinism.

### 2.4 `P3` — Low-Priority Polish, Repo Hygiene & Documentation Sync

#### T-094 — [P3] Guard `agency_settings` singleton constraint, clean `.trigger/` & duplicate `agent/` skill tree in `.gitignore`, and fix root title template
- **T-ID**: `T-094`
- **Severity**: `P3`
- **Title**: Guard `agency_settings` singleton constraint, clean `.trigger/` & duplicate `agent/` skill tree in `.gitignore`, and fix root title template
- **Fixer Owner**: `F-PLAT`
- **Sub-Wave**: `W3A`
- **Target Files**: `db/schema/settings.ts`, `app/layout.tsx`, `.gitignore`, `README.md`
- **Source Finding IDs** (4): `A01-012`, `A04-018`, `A21-014`, `A22-013`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Enforce single-row singleton key on `agency_settings` (`A04-018`), add `.trigger/`, `tsconfig.tsbuildinfo`, and `.next-dev.log` to `.gitignore` + update `README.md` (`A01-012`), fix duplicate `"| Al Ramlah Travels"` root `metadata.title.template` in `app/layout.tsx` (`A21-014`), and add permanent `redirects()` entries in `next.config.ts` (`A22-013`).
- **Red->Green Test**: `tests/w3/f-plat/repo-hygiene.test.ts` — verifies `.gitignore` excludes `.trigger/` and `.next-dev.log` and `agency_settings` enforces singleton upsert.

#### T-095 — [P3] Deduplicate `submitGroupBooking*`/`submitHajjInquiry*` exports, clean dead planner/contact props, remove outdated `"October 2026"` / `"COVID-19"` footer modals, and polish `design.md` gap tokens
- **T-ID**: `T-095`
- **Severity**: `P3`
- **Title**: Deduplicate `submitGroupBooking*`/`submitHajjInquiry*` exports, clean dead planner/contact props, remove outdated `"October 2026"` / `"COVID-19"` footer modals, and polish `design.md` gap tokens
- **Fixer Owner**: `F-PUB`
- **Sub-Wave**: `W3B`
- **Target Files**: `app/actions/applications.ts`, `components/planner/custom-journey-builder.tsx`, `components/public/contact-section.tsx`, `components/layout/public-footer.tsx`
- **Source Finding IDs** (5): `A00-024`, `A06-015`, `A08-013`, `A21-013`, `A25-014`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Consolidate duplicate action aliases and unexported internal helpers in `app/actions/applications.ts` (`A00-024`); remove dead `agencyWhatsapp` prop on `CustomJourneyBuilder` (`A06-015`), sticky simultaneous `success`+`error` banner in `ContactSection` (`A08-013`), and dead inline `"October 2026"` / `"COVID-19"` / `"Direct Saudia Agent"` footer modals in `PublicFooter` in favor of canonical `/privacy`, `/terms`, and `/refund-policy` routes (`A25-014`); and align flex `gap-*` spacing in touched public components (`A21-013`).
- **Red->Green Test**: `tests/w3/f-pub/footer-and-action-cleanup.test.ts` — asserts `PublicFooter` links to `/privacy`, `/terms`, `/refund-policy` with zero `COVID-19` modal text and `ContactSection` clears `success` state when a new validation error occurs.

#### T-096 — [P3] Sanitize CSS identifier & color value interpolation in `components/ui/chart.tsx` (`ChartStyle`)
- **T-ID**: `T-096`
- **Severity**: `P3`
- **Title**: Sanitize CSS identifier & color value interpolation in `components/ui/chart.tsx` (`ChartStyle`)
- **Fixer Owner**: `F-UX`
- **Sub-Wave**: `W3B`
- **Target Files**: `components/ui/chart.tsx`
- **Source Finding IDs** (1): `A03-014`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Validate `key` (`^[a-zA-Z0-9_-]+$`) and CSS color values (`^#[0-9a-fA-F]{3,8}$` or strict `oklch(...)`/`rgb(...)`/`hsl(...)`/`var(--...)` allowlist) in `components/ui/chart.tsx` before interpolating into `ChartStyle` `<style dangerouslySetInnerHTML>`.
- **Red->Green Test**: `tests/w3/f-ux/chart-style-sanitizer.test.ts` — passes malicious `red; } body { display: none` color config to `ChartStyle` and asserts unsafe CSS tokens are stripped.

#### T-097 — [P3] Author `RB-01..RB-10` operational runbooks & document reconciled post-W3C architecture/hash/test metrics
- **T-ID**: `T-097`
- **Severity**: `P3`
- **Title**: Author `RB-01..RB-10` operational runbooks & document reconciled post-W3C architecture/hash/test metrics
- **Fixer Owner**: `F-QA`
- **Sub-Wave**: `W3C`
- **Target Files**: `docs/audit/runbooks/RB-01-incident-response.md`, `docs/audit/runbooks/RB-02-db-pitr-and-restore.md`, `docs/audit/runbooks/RB-03-key-and-token-rotation.md`
- **Source Finding IDs** (2): `A00-026`, `A02-013`
- **Gate Status**: `UNBLOCKED`
- **Concrete Fix Summary**: Author operational runbooks `docs/audit/runbooks/RB-01..10.md` (incident triage, Neon PITR restore, `ENCRYPTION_KEY` rotation, Meta WABA token/webhook recovery, Oracle Gotenberg VM recovery, Social OAuth re-auth, DSAR erasure, CI failure triage) and coordinate post-merge doc-sync notes for `PLATFORM_MASTER_BRIEF.md` (`scrypt` Better Auth password hashing, exact schema table count, cron schedules, and verified test counts `A00-026`, `A02-013`).
- **Red->Green Test**: `tests/unit/docs-runbooks-presence.test.ts` — verifies all `RB-01..RB-10` runbook files exist and document accurate `scrypt` / Neon PITR / vault rotation procedures.

---

## 3. Raw Finding -> Canonical `T-ID` Traceability Index (`383 / 383` = `100.0%`)

Programmatic verification table mapping every raw finding across `w0-env-baseline.md` (`W0-001`..`W0-007`) and `findings/A00.md`..`A26.md` (`A00-001`..`A26-011`) to its exact Canonical `T-ID`, Fixer Owner, Sub-Wave, and Gate Status.

| # | Raw Finding ID | Source File | Raw Severity | Canonical `T-ID` | Canonical Severity | Fixer Owner | Sub-Wave | Gate Status |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| 1 | `W0-001` | `docs/audit/w0-env-baseline.md` | `P0` | `T-007` | `P0` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-10` |
| 2 | `W0-002` | `docs/audit/w0-env-baseline.md` | `P0` | `T-006` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 3 | `W0-003` | `docs/audit/w0-env-baseline.md` | `P0` | `T-039` | `P0` | `F-QA` | `W3C` | `UNBLOCKED` |
| 4 | `W0-004` | `docs/audit/w0-env-baseline.md` | `P1` | `T-005` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 5 | `W0-005` | `docs/audit/w0-env-baseline.md` | `P1` | `T-045` | `P1` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-07` |
| 6 | `W0-006` | `docs/audit/w0-env-baseline.md` | `P0` | `T-001` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 7 | `W0-007` | `docs/audit/w0-env-baseline.md` | `P0` | `T-007` | `P0` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-10` |
| 8 | `A00-001` | `docs/audit/findings/A00.md` | `P0` | `T-033` | `P0` | `F-SOCIAL` | `W3B` | `UNBLOCKED` |
| 9 | `A00-002` | `docs/audit/findings/A00.md` | `P0` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 10 | `A00-003` | `docs/audit/findings/A00.md` | `P0` | `T-014` | `P0` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-06` |
| 11 | `A00-004` | `docs/audit/findings/A00.md` | `P0` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 12 | `A00-005` | `docs/audit/findings/A00.md` | `P0` | `T-010` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 13 | `A00-006` | `docs/audit/findings/A00.md` | `P0` | `T-005` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 14 | `A00-007` | `docs/audit/findings/A00.md` | `P1` | `T-030` | `P0` | `F-WA` | `W3B` | `UNBLOCKED` |
| 15 | `A00-008` | `docs/audit/findings/A00.md` | `P1` | `T-036` | `P0` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 16 | `A00-009` | `docs/audit/findings/A00.md` | `P1` | `T-015` | `P0` | `F-INFRA` | `W3B` | `UNBLOCKED` |
| 17 | `A00-010` | `docs/audit/findings/A00.md` | `P1` | `T-074` | `P1` | `F-JOBS` | `W3B` | `NEEDS_DECISION: OD-07` |
| 18 | `A00-011` | `docs/audit/findings/A00.md` | `P1` | `T-017` | `P0` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-04` |
| 19 | `A00-012` | `docs/audit/findings/A00.md` | `P1` | `T-043` | `P1` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-02` |
| 20 | `A00-013` | `docs/audit/findings/A00.md` | `P1` | `T-068` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-07` |
| 21 | `A00-014` | `docs/audit/findings/A00.md` | `P1` | `T-044` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 22 | `A00-015` | `docs/audit/findings/A00.md` | `P1` | `T-068` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-07` |
| 23 | `A00-016` | `docs/audit/findings/A00.md` | `P1` | `T-041` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 24 | `A00-017` | `docs/audit/findings/A00.md` | `P2` | `T-036` | `P0` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 25 | `A00-018` | `docs/audit/findings/A00.md` | `P2` | `T-086` | `P2` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 26 | `A00-019` | `docs/audit/findings/A00.md` | `P2` | `T-079` | `P2` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 27 | `A00-020` | `docs/audit/findings/A00.md` | `P2` | `T-079` | `P2` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 28 | `A00-021` | `docs/audit/findings/A00.md` | `P2` | `T-047` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 29 | `A00-022` | `docs/audit/findings/A00.md` | `P2` | `T-009` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 30 | `A00-023` | `docs/audit/findings/A00.md` | `P2` | `T-046` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 31 | `A00-024` | `docs/audit/findings/A00.md` | `P3` | `T-095` | `P3` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 32 | `A00-025` | `docs/audit/findings/A00.md` | `P3` | `T-050` | `P1` | `F-DOM` | `W3B` | `UNBLOCKED` |
| 33 | `A00-026` | `docs/audit/findings/A00.md` | `P3` | `T-097` | `P3` | `F-QA` | `W3C` | `UNBLOCKED` |
| 34 | `A01-001` | `docs/audit/findings/A01.md` | `P0` | `T-001` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 35 | `A01-002` | `docs/audit/findings/A01.md` | `P0` | `T-002` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 36 | `A01-003` | `docs/audit/findings/A01.md` | `P0` | `T-002` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 37 | `A01-004` | `docs/audit/findings/A01.md` | `P0` | `T-013` | `P0` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 38 | `A01-005` | `docs/audit/findings/A01.md` | `P1` | `T-044` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 39 | `A01-006` | `docs/audit/findings/A01.md` | `P1` | `T-045` | `P1` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-07` |
| 40 | `A01-007` | `docs/audit/findings/A01.md` | `P1` | `T-045` | `P1` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-07` |
| 41 | `A01-008` | `docs/audit/findings/A01.md` | `P1` | `T-044` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 42 | `A01-009` | `docs/audit/findings/A01.md` | `P1` | `T-003` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 43 | `A01-010` | `docs/audit/findings/A01.md` | `P2` | `T-047` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 44 | `A01-011` | `docs/audit/findings/A01.md` | `P2` | `T-047` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 45 | `A01-012` | `docs/audit/findings/A01.md` | `P3` | `T-094` | `P3` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 46 | `A02-001` | `docs/audit/findings/A02.md` | `P0` | `T-004` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 47 | `A02-002` | `docs/audit/findings/A02.md` | `P0` | `T-033` | `P0` | `F-SOCIAL` | `W3B` | `UNBLOCKED` |
| 48 | `A02-003` | `docs/audit/findings/A02.md` | `P0` | `T-016` | `P0` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-05` |
| 49 | `A02-004` | `docs/audit/findings/A02.md` | `P0` | `T-007` | `P0` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-10` |
| 50 | `A02-005` | `docs/audit/findings/A02.md` | `P1` | `T-075` | `P1` | `F-ADMIN` | `W3B` | `NEEDS_DECISION: OD-07` |
| 51 | `A02-006` | `docs/audit/findings/A02.md` | `P1` | `T-075` | `P1` | `F-ADMIN` | `W3B` | `NEEDS_DECISION: OD-07` |
| 52 | `A02-007` | `docs/audit/findings/A02.md` | `P1` | `T-004` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 53 | `A02-008` | `docs/audit/findings/A02.md` | `P1` | `T-009` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 54 | `A02-009` | `docs/audit/findings/A02.md` | `P1` | `T-043` | `P1` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-02` |
| 55 | `A02-010` | `docs/audit/findings/A02.md` | `P2` | `T-091` | `P2` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 56 | `A02-011` | `docs/audit/findings/A02.md` | `P2` | `T-047` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 57 | `A02-012` | `docs/audit/findings/A02.md` | `P2` | `T-090` | `P2` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 58 | `A02-013` | `docs/audit/findings/A02.md` | `P3` | `T-097` | `P3` | `F-QA` | `W3C` | `UNBLOCKED` |
| 59 | `A03-001` | `docs/audit/findings/A03.md` | `P0` | `T-021` | `P0` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 60 | `A03-002` | `docs/audit/findings/A03.md` | `P0` | `T-014` | `P0` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-06` |
| 61 | `A03-003` | `docs/audit/findings/A03.md` | `P0` | `T-014` | `P0` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-06` |
| 62 | `A03-004` | `docs/audit/findings/A03.md` | `P0` | `T-025` | `P0` | `F-STUDIO` | `W3B` | `UNBLOCKED` |
| 63 | `A03-005` | `docs/audit/findings/A03.md` | `P1` | `T-002` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 64 | `A03-006` | `docs/audit/findings/A03.md` | `P1` | `T-002` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 65 | `A03-007` | `docs/audit/findings/A03.md` | `P1` | `T-008` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 66 | `A03-008` | `docs/audit/findings/A03.md` | `P1` | `T-065` | `P1` | `F-WA` | `W3B` | `UNBLOCKED` |
| 67 | `A03-009` | `docs/audit/findings/A03.md` | `P1` | `T-069` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 68 | `A03-010` | `docs/audit/findings/A03.md` | `P1` | `T-044` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 69 | `A03-011` | `docs/audit/findings/A03.md` | `P1` | `T-012` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 70 | `A03-012` | `docs/audit/findings/A03.md` | `P2` | `T-050` | `P1` | `F-DOM` | `W3B` | `UNBLOCKED` |
| 71 | `A03-013` | `docs/audit/findings/A03.md` | `P2` | `T-030` | `P0` | `F-WA` | `W3B` | `UNBLOCKED` |
| 72 | `A03-014` | `docs/audit/findings/A03.md` | `P3` | `T-096` | `P3` | `F-UX` | `W3B` | `UNBLOCKED` |
| 73 | `A04-001` | `docs/audit/findings/A04.md` | `P0` | `T-006` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 74 | `A04-002` | `docs/audit/findings/A04.md` | `P0` | `T-006` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 75 | `A04-003` | `docs/audit/findings/A04.md` | `P0` | `T-007` | `P0` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-10` |
| 76 | `A04-004` | `docs/audit/findings/A04.md` | `P0` | `T-005` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 77 | `A04-005` | `docs/audit/findings/A04.md` | `P0` | `T-022` | `P0` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-09` |
| 78 | `A04-006` | `docs/audit/findings/A04.md` | `P0` | `T-007` | `P0` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-10` |
| 79 | `A04-007` | `docs/audit/findings/A04.md` | `P1` | `T-042` | `P1` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-03` |
| 80 | `A04-008` | `docs/audit/findings/A04.md` | `P1` | `T-041` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 81 | `A04-009` | `docs/audit/findings/A04.md` | `P1` | `T-041` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 82 | `A04-010` | `docs/audit/findings/A04.md` | `P1` | `T-016` | `P0` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-05` |
| 83 | `A04-011` | `docs/audit/findings/A04.md` | `P1` | `T-041` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 84 | `A04-012` | `docs/audit/findings/A04.md` | `P1` | `T-041` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 85 | `A04-013` | `docs/audit/findings/A04.md` | `P1` | `T-041` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 86 | `A04-014` | `docs/audit/findings/A04.md` | `P2` | `T-079` | `P2` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 87 | `A04-015` | `docs/audit/findings/A04.md` | `P2` | `T-079` | `P2` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 88 | `A04-016` | `docs/audit/findings/A04.md` | `P2` | `T-080` | `P2` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-06` |
| 89 | `A04-017` | `docs/audit/findings/A04.md` | `P2` | `T-079` | `P2` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 90 | `A04-018` | `docs/audit/findings/A04.md` | `P3` | `T-094` | `P3` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 91 | `A05-001` | `docs/audit/findings/A05.md` | `P0` | `T-011` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 92 | `A05-002` | `docs/audit/findings/A05.md` | `P0` | `T-026` | `P0` | `F-STUDIO` | `W3B` | `UNBLOCKED` |
| 93 | `A05-003` | `docs/audit/findings/A05.md` | `P0` | `T-010` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 94 | `A05-004` | `docs/audit/findings/A05.md` | `P0` | `T-011` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 95 | `A05-005` | `docs/audit/findings/A05.md` | `P0` | `T-012` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 96 | `A05-006` | `docs/audit/findings/A05.md` | `P1` | `T-048` | `P1` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 97 | `A05-007` | `docs/audit/findings/A05.md` | `P1` | `T-063` | `P1` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-09` |
| 98 | `A05-008` | `docs/audit/findings/A05.md` | `P1` | `T-048` | `P1` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 99 | `A05-009` | `docs/audit/findings/A05.md` | `P1` | `T-010` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 100 | `A05-010` | `docs/audit/findings/A05.md` | `P1` | `T-059` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-02` |
| 101 | `A05-011` | `docs/audit/findings/A05.md` | `P1` | `T-049` | `P1` | `F-DOM` | `W3B` | `UNBLOCKED` |
| 102 | `A05-012` | `docs/audit/findings/A05.md` | `P1` | `T-012` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 103 | `A05-013` | `docs/audit/findings/A05.md` | `P2` | `T-081` | `P2` | `F-DOM` | `W3B` | `UNBLOCKED` |
| 104 | `A05-014` | `docs/audit/findings/A05.md` | `P2` | `T-083` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 105 | `A06-001` | `docs/audit/findings/A06.md` | `P0` | `T-018` | `P0` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 106 | `A06-002` | `docs/audit/findings/A06.md` | `P0` | `T-018` | `P0` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 107 | `A06-003` | `docs/audit/findings/A06.md` | `P1` | `T-053` | `P1` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 108 | `A06-004` | `docs/audit/findings/A06.md` | `P1` | `T-053` | `P1` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 109 | `A06-005` | `docs/audit/findings/A06.md` | `P1` | `T-012` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 110 | `A06-006` | `docs/audit/findings/A06.md` | `P1` | `T-012` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 111 | `A06-007` | `docs/audit/findings/A06.md` | `P1` | `T-053` | `P1` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 112 | `A06-008` | `docs/audit/findings/A06.md` | `P1` | `T-012` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 113 | `A06-009` | `docs/audit/findings/A06.md` | `P2` | `T-083` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 114 | `A06-010` | `docs/audit/findings/A06.md` | `P2` | `T-083` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 115 | `A06-011` | `docs/audit/findings/A06.md` | `P2` | `T-083` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 116 | `A06-012` | `docs/audit/findings/A06.md` | `P2` | `T-083` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 117 | `A06-013` | `docs/audit/findings/A06.md` | `P2` | `T-083` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 118 | `A06-014` | `docs/audit/findings/A06.md` | `P2` | `T-083` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 119 | `A06-015` | `docs/audit/findings/A06.md` | `P3` | `T-095` | `P3` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 120 | `A07-001` | `docs/audit/findings/A07.md` | `P0` | `T-019` | `P0` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 121 | `A07-002` | `docs/audit/findings/A07.md` | `P0` | `T-019` | `P0` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 122 | `A07-003` | `docs/audit/findings/A07.md` | `P0` | `T-026` | `P0` | `F-STUDIO` | `W3B` | `UNBLOCKED` |
| 123 | `A07-004` | `docs/audit/findings/A07.md` | `P0` | `T-022` | `P0` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-09` |
| 124 | `A07-005` | `docs/audit/findings/A07.md` | `P1` | `T-054` | `P1` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 125 | `A07-006` | `docs/audit/findings/A07.md` | `P1` | `T-054` | `P1` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 126 | `A07-007` | `docs/audit/findings/A07.md` | `P1` | `T-054` | `P1` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 127 | `A07-008` | `docs/audit/findings/A07.md` | `P1` | `T-061` | `P1` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 128 | `A07-009` | `docs/audit/findings/A07.md` | `P1` | `T-061` | `P1` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 129 | `A07-010` | `docs/audit/findings/A07.md` | `P2` | `T-084` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 130 | `A07-011` | `docs/audit/findings/A07.md` | `P2` | `T-012` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 131 | `A07-012` | `docs/audit/findings/A07.md` | `P2` | `T-086` | `P2` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 132 | `A08-001` | `docs/audit/findings/A08.md` | `P0` | `T-016` | `P0` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-05` |
| 133 | `A08-002` | `docs/audit/findings/A08.md` | `P0` | `T-017` | `P0` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-04` |
| 134 | `A08-003` | `docs/audit/findings/A08.md` | `P1` | `T-055` | `P1` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 135 | `A08-004` | `docs/audit/findings/A08.md` | `P1` | `T-055` | `P1` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 136 | `A08-005` | `docs/audit/findings/A08.md` | `P1` | `T-012` | `P0` | `F-DOM` | `W3B` | `NEEDS_DECISION: OD-09` |
| 137 | `A08-006` | `docs/audit/findings/A08.md` | `P1` | `T-076` | `P1` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 138 | `A08-007` | `docs/audit/findings/A08.md` | `P1` | `T-055` | `P1` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-09` |
| 139 | `A08-008` | `docs/audit/findings/A08.md` | `P1` | `T-076` | `P1` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 140 | `A08-009` | `docs/audit/findings/A08.md` | `P2` | `T-084` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 141 | `A08-010` | `docs/audit/findings/A08.md` | `P2` | `T-084` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 142 | `A08-011` | `docs/audit/findings/A08.md` | `P2` | `T-074` | `P1` | `F-JOBS` | `W3B` | `NEEDS_DECISION: OD-07` |
| 143 | `A08-012` | `docs/audit/findings/A08.md` | `P2` | `T-091` | `P2` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 144 | `A08-013` | `docs/audit/findings/A08.md` | `P3` | `T-095` | `P3` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 145 | `A09-001` | `docs/audit/findings/A09.md` | `P0` | `T-024` | `P0` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 146 | `A09-002` | `docs/audit/findings/A09.md` | `P1` | `T-060` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-07` |
| 147 | `A09-003` | `docs/audit/findings/A09.md` | `P1` | `T-060` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-07` |
| 148 | `A09-004` | `docs/audit/findings/A09.md` | `P1` | `T-062` | `P1` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-09` |
| 149 | `A09-005` | `docs/audit/findings/A09.md` | `P1` | `T-061` | `P1` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 150 | `A09-006` | `docs/audit/findings/A09.md` | `P1` | `T-060` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-07` |
| 151 | `A09-007` | `docs/audit/findings/A09.md` | `P2` | `T-086` | `P2` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 152 | `A09-008` | `docs/audit/findings/A09.md` | `P2` | `T-086` | `P2` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 153 | `A09-009` | `docs/audit/findings/A09.md` | `P2` | `T-086` | `P2` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 154 | `A09-010` | `docs/audit/findings/A09.md` | `P2` | `T-086` | `P2` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 155 | `A10-001` | `docs/audit/findings/A10.md` | `P0` | `T-021` | `P0` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 156 | `A10-002` | `docs/audit/findings/A10.md` | `P0` | `T-022` | `P0` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-09` |
| 157 | `A10-003` | `docs/audit/findings/A10.md` | `P0` | `T-023` | `P0` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-04` |
| 158 | `A10-004` | `docs/audit/findings/A10.md` | `P0` | `T-022` | `P0` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-09` |
| 159 | `A10-005` | `docs/audit/findings/A10.md` | `P1` | `T-058` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-09` |
| 160 | `A10-006` | `docs/audit/findings/A10.md` | `P1` | `T-059` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-02` |
| 161 | `A10-007` | `docs/audit/findings/A10.md` | `P1` | `T-058` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-09` |
| 162 | `A10-008` | `docs/audit/findings/A10.md` | `P1` | `T-059` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-02` |
| 163 | `A10-009` | `docs/audit/findings/A10.md` | `P1` | `T-042` | `P1` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-03` |
| 164 | `A10-010` | `docs/audit/findings/A10.md` | `P1` | `T-059` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-02` |
| 165 | `A10-011` | `docs/audit/findings/A10.md` | `P1` | `T-059` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-02` |
| 166 | `A10-012` | `docs/audit/findings/A10.md` | `P1` | `T-060` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-07` |
| 167 | `A10-013` | `docs/audit/findings/A10.md` | `P2` | `T-086` | `P2` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 168 | `A10-014` | `docs/audit/findings/A10.md` | `P2` | `T-086` | `P2` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 169 | `A10-015` | `docs/audit/findings/A10.md` | `P2` | `T-086` | `P2` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 170 | `A11-001` | `docs/audit/findings/A11.md` | `P0` | `T-026` | `P0` | `F-STUDIO` | `W3B` | `UNBLOCKED` |
| 171 | `A11-002` | `docs/audit/findings/A11.md` | `P0` | `T-026` | `P0` | `F-STUDIO` | `W3B` | `UNBLOCKED` |
| 172 | `A11-003` | `docs/audit/findings/A11.md` | `P0` | `T-026` | `P0` | `F-STUDIO` | `W3B` | `UNBLOCKED` |
| 173 | `A11-004` | `docs/audit/findings/A11.md` | `P0` | `T-025` | `P0` | `F-STUDIO` | `W3B` | `UNBLOCKED` |
| 174 | `A11-005` | `docs/audit/findings/A11.md` | `P1` | `T-062` | `P1` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-09` |
| 175 | `A11-006` | `docs/audit/findings/A11.md` | `P1` | `T-063` | `P1` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-09` |
| 176 | `A11-007` | `docs/audit/findings/A11.md` | `P1` | `T-062` | `P1` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-09` |
| 177 | `A11-008` | `docs/audit/findings/A11.md` | `P1` | `T-062` | `P1` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-09` |
| 178 | `A11-009` | `docs/audit/findings/A11.md` | `P1` | `T-062` | `P1` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-09` |
| 179 | `A11-010` | `docs/audit/findings/A11.md` | `P2` | `T-087` | `P2` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-10` |
| 180 | `A11-011` | `docs/audit/findings/A11.md` | `P2` | `T-087` | `P2` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-10` |
| 181 | `A11-012` | `docs/audit/findings/A11.md` | `P2` | `T-052` | `P1` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-06` |
| 182 | `A11-013` | `docs/audit/findings/A11.md` | `P2` | `T-087` | `P2` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-10` |
| 183 | `A11-014` | `docs/audit/findings/A11.md` | `P2` | `T-087` | `P2` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-10` |
| 184 | `A12-001` | `docs/audit/findings/A12.md` | `P0` | `T-028` | `P0` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-06` |
| 185 | `A12-002` | `docs/audit/findings/A12.md` | `P0` | `T-028` | `P0` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-06` |
| 186 | `A12-003` | `docs/audit/findings/A12.md` | `P1` | `T-063` | `P1` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-09` |
| 187 | `A12-004` | `docs/audit/findings/A12.md` | `P1` | `T-003` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 188 | `A12-005` | `docs/audit/findings/A12.md` | `P1` | `T-063` | `P1` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-09` |
| 189 | `A12-006` | `docs/audit/findings/A12.md` | `P1` | `T-063` | `P1` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-09` |
| 190 | `A12-007` | `docs/audit/findings/A12.md` | `P1` | `T-066` | `P1` | `F-WA` | `W3B` | `UNBLOCKED` |
| 191 | `A12-008` | `docs/audit/findings/A12.md` | `P1` | `T-063` | `P1` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-09` |
| 192 | `A12-009` | `docs/audit/findings/A12.md` | `P2` | `T-089` | `P2` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-10` |
| 193 | `A12-010` | `docs/audit/findings/A12.md` | `P2` | `T-087` | `P2` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-10` |
| 194 | `A12-011` | `docs/audit/findings/A12.md` | `P2` | `T-087` | `P2` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-10` |
| 195 | `A12-012` | `docs/audit/findings/A12.md` | `P2` | `T-093` | `P2` | `F-QA` | `W3C` | `NEEDS_DECISION: OD-10` |
| 196 | `A13-001` | `docs/audit/findings/A13.md` | `P0` | `T-015` | `P0` | `F-INFRA` | `W3B` | `UNBLOCKED` |
| 197 | `A13-002` | `docs/audit/findings/A13.md` | `P0` | `T-014` | `P0` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-06` |
| 198 | `A13-003` | `docs/audit/findings/A13.md` | `P0` | `T-014` | `P0` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-06` |
| 199 | `A13-004` | `docs/audit/findings/A13.md` | `P1` | `T-015` | `P0` | `F-INFRA` | `W3B` | `UNBLOCKED` |
| 200 | `A13-005` | `docs/audit/findings/A13.md` | `P1` | `T-051` | `P1` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-07` |
| 201 | `A13-006` | `docs/audit/findings/A13.md` | `P1` | `T-051` | `P1` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-07` |
| 202 | `A13-007` | `docs/audit/findings/A13.md` | `P1` | `T-070` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 203 | `A13-008` | `docs/audit/findings/A13.md` | `P1` | `T-065` | `P1` | `F-WA` | `W3B` | `UNBLOCKED` |
| 204 | `A13-009` | `docs/audit/findings/A13.md` | `P1` | `T-052` | `P1` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-06` |
| 205 | `A13-010` | `docs/audit/findings/A13.md` | `P2` | `T-052` | `P1` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-06` |
| 206 | `A13-011` | `docs/audit/findings/A13.md` | `P2` | `T-082` | `P2` | `F-INFRA` | `W3B` | `UNBLOCKED` |
| 207 | `A14-001` | `docs/audit/findings/A14.md` | `P0` | `T-029` | `P0` | `F-WA` | `W3B` | `UNBLOCKED` |
| 208 | `A14-002` | `docs/audit/findings/A14.md` | `P1` | `T-065` | `P1` | `F-WA` | `W3B` | `UNBLOCKED` |
| 209 | `A14-003` | `docs/audit/findings/A14.md` | `P1` | `T-065` | `P1` | `F-WA` | `W3B` | `UNBLOCKED` |
| 210 | `A14-004` | `docs/audit/findings/A14.md` | `P1` | `T-065` | `P1` | `F-WA` | `W3B` | `UNBLOCKED` |
| 211 | `A14-005` | `docs/audit/findings/A14.md` | `P0` | `T-030` | `P0` | `F-WA` | `W3B` | `UNBLOCKED` |
| 212 | `A14-006` | `docs/audit/findings/A14.md` | `P0` | `T-030` | `P0` | `F-WA` | `W3B` | `UNBLOCKED` |
| 213 | `A14-007` | `docs/audit/findings/A14.md` | `P1` | `T-066` | `P1` | `F-WA` | `W3B` | `UNBLOCKED` |
| 214 | `A14-008` | `docs/audit/findings/A14.md` | `P1` | `T-066` | `P1` | `F-WA` | `W3B` | `UNBLOCKED` |
| 215 | `A14-009` | `docs/audit/findings/A14.md` | `P0` | `T-030` | `P0` | `F-WA` | `W3B` | `UNBLOCKED` |
| 216 | `A14-010` | `docs/audit/findings/A14.md` | `P1` | `T-067` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 217 | `A14-011` | `docs/audit/findings/A14.md` | `P1` | `T-067` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 218 | `A14-012` | `docs/audit/findings/A14.md` | `P1` | `T-067` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 219 | `A14-013` | `docs/audit/findings/A14.md` | `P2` | `T-088` | `P2` | `F-WA` | `W3B` | `UNBLOCKED` |
| 220 | `A14-014` | `docs/audit/findings/A14.md` | `P1` | `T-068` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-07` |
| 221 | `A14-015` | `docs/audit/findings/A14.md` | `P1` | `T-068` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-07` |
| 222 | `A14-016` | `docs/audit/findings/A14.md` | `P2` | `T-088` | `P2` | `F-WA` | `W3B` | `UNBLOCKED` |
| 223 | `A15-001` | `docs/audit/findings/A15.md` | `P0` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 224 | `A15-002` | `docs/audit/findings/A15.md` | `P1` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 225 | `A15-003` | `docs/audit/findings/A15.md` | `P0` | `T-006` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 226 | `A15-004` | `docs/audit/findings/A15.md` | `P0` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 227 | `A15-005` | `docs/audit/findings/A15.md` | `P0` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 228 | `A15-006` | `docs/audit/findings/A15.md` | `P1` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 229 | `A15-007` | `docs/audit/findings/A15.md` | `P1` | `T-049` | `P1` | `F-DOM` | `W3B` | `UNBLOCKED` |
| 230 | `A15-008` | `docs/audit/findings/A15.md` | `P1` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 231 | `A15-009` | `docs/audit/findings/A15.md` | `P1` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 232 | `A15-010` | `docs/audit/findings/A15.md` | `P1` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 233 | `A15-011` | `docs/audit/findings/A15.md` | `P1` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 234 | `A15-012` | `docs/audit/findings/A15.md` | `P2` | `T-047` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 235 | `A15-013` | `docs/audit/findings/A15.md` | `P2` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 236 | `A16-001` | `docs/audit/findings/A16.md` | `P0` | `T-033` | `P0` | `F-SOCIAL` | `W3B` | `UNBLOCKED` |
| 237 | `A16-002` | `docs/audit/findings/A16.md` | `P0` | `T-034` | `P0` | `F-SOCIAL` | `W3B` | `UNBLOCKED` |
| 238 | `A16-003` | `docs/audit/findings/A16.md` | `P0` | `T-035` | `P0` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 239 | `A16-004` | `docs/audit/findings/A16.md` | `P0` | `T-035` | `P0` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 240 | `A16-005` | `docs/audit/findings/A16.md` | `P0` | `T-035` | `P0` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 241 | `A16-006` | `docs/audit/findings/A16.md` | `P0` | `T-037` | `P0` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 242 | `A16-007` | `docs/audit/findings/A16.md` | `P0` | `T-036` | `P0` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 243 | `A16-008` | `docs/audit/findings/A16.md` | `P1` | `T-069` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 244 | `A16-009` | `docs/audit/findings/A16.md` | `P1` | `T-069` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 245 | `A16-010` | `docs/audit/findings/A16.md` | `P1` | `T-035` | `P0` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 246 | `A16-011` | `docs/audit/findings/A16.md` | `P1` | `T-070` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 247 | `A16-012` | `docs/audit/findings/A16.md` | `P1` | `T-070` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 248 | `A16-013` | `docs/audit/findings/A16.md` | `P1` | `T-070` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 249 | `A16-014` | `docs/audit/findings/A16.md` | `P1` | `T-070` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 250 | `A16-015` | `docs/audit/findings/A16.md` | `P2` | `T-089` | `P2` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-10` |
| 251 | `A16-016` | `docs/audit/findings/A16.md` | `P2` | `T-089` | `P2` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-10` |
| 252 | `A17-001` | `docs/audit/findings/A17.md` | `P0` | `T-031` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 253 | `A17-002` | `docs/audit/findings/A17.md` | `P0` | `T-030` | `P0` | `F-WA` | `W3B` | `UNBLOCKED` |
| 254 | `A17-003` | `docs/audit/findings/A17.md` | `P0` | `T-027` | `P0` | `F-STUDIO` | `W3B` | `UNBLOCKED` |
| 255 | `A17-004` | `docs/audit/findings/A17.md` | `P1` | `T-073` | `P1` | `F-JOBS` | `W3B` | `NEEDS_DECISION: OD-01` |
| 256 | `A17-005` | `docs/audit/findings/A17.md` | `P1` | `T-071` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-07` |
| 257 | `A17-006` | `docs/audit/findings/A17.md` | `P1` | `T-067` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 258 | `A17-007` | `docs/audit/findings/A17.md` | `P1` | `T-064` | `P1` | `F-STUDIO` | `W3B` | `UNBLOCKED` |
| 259 | `A17-008` | `docs/audit/findings/A17.md` | `P1` | `T-071` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-07` |
| 260 | `A17-009` | `docs/audit/findings/A17.md` | `P1` | `T-071` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-07` |
| 261 | `A17-010` | `docs/audit/findings/A17.md` | `P1` | `T-070` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 262 | `A17-011` | `docs/audit/findings/A17.md` | `P1` | `T-071` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-07` |
| 263 | `A17-012` | `docs/audit/findings/A17.md` | `P2` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 264 | `A17-013` | `docs/audit/findings/A17.md` | `P2` | `T-081` | `P2` | `F-DOM` | `W3B` | `UNBLOCKED` |
| 265 | `A17-014` | `docs/audit/findings/A17.md` | `P2` | `T-089` | `P2` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-10` |
| 266 | `A18-001` | `docs/audit/findings/A18.md` | `P0` | `T-037` | `P0` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 267 | `A18-002` | `docs/audit/findings/A18.md` | `P0` | `T-037` | `P0` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 268 | `A18-003` | `docs/audit/findings/A18.md` | `P1` | `T-072` | `P1` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 269 | `A18-004` | `docs/audit/findings/A18.md` | `P1` | `T-072` | `P1` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 270 | `A18-005` | `docs/audit/findings/A18.md` | `P1` | `T-072` | `P1` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 271 | `A18-006` | `docs/audit/findings/A18.md` | `P1` | `T-072` | `P1` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 272 | `A18-007` | `docs/audit/findings/A18.md` | `P1` | `T-074` | `P1` | `F-JOBS` | `W3B` | `NEEDS_DECISION: OD-07` |
| 273 | `A18-008` | `docs/audit/findings/A18.md` | `P1` | `T-074` | `P1` | `F-JOBS` | `W3B` | `NEEDS_DECISION: OD-07` |
| 274 | `A18-009` | `docs/audit/findings/A18.md` | `P1` | `T-072` | `P1` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 275 | `A18-010` | `docs/audit/findings/A18.md` | `P1` | `T-074` | `P1` | `F-JOBS` | `W3B` | `NEEDS_DECISION: OD-07` |
| 276 | `A18-011` | `docs/audit/findings/A18.md` | `P2` | `T-090` | `P2` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 277 | `A18-012` | `docs/audit/findings/A18.md` | `P2` | `T-090` | `P2` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 278 | `A18-013` | `docs/audit/findings/A18.md` | `P2` | `T-090` | `P2` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 279 | `A19-001` | `docs/audit/findings/A19.md` | `P1` | `T-076` | `P1` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 280 | `A19-002` | `docs/audit/findings/A19.md` | `P1` | `T-041` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 281 | `A19-003` | `docs/audit/findings/A19.md` | `P1` | `T-050` | `P1` | `F-DOM` | `W3B` | `UNBLOCKED` |
| 282 | `A19-004` | `docs/audit/findings/A19.md` | `P1` | `T-075` | `P1` | `F-ADMIN` | `W3B` | `NEEDS_DECISION: OD-07` |
| 283 | `A19-005` | `docs/audit/findings/A19.md` | `P1` | `T-077` | `P1` | `F-ADMIN` | `W3B` | `NEEDS_DECISION: OD-10` |
| 284 | `A19-006` | `docs/audit/findings/A19.md` | `P1` | `T-076` | `P1` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 285 | `A19-007` | `docs/audit/findings/A19.md` | `P1` | `T-076` | `P1` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 286 | `A19-008` | `docs/audit/findings/A19.md` | `P2` | `T-054` | `P1` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 287 | `A19-009` | `docs/audit/findings/A19.md` | `P2` | `T-084` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 288 | `A19-010` | `docs/audit/findings/A19.md` | `P2` | `T-050` | `P1` | `F-DOM` | `W3B` | `UNBLOCKED` |
| 289 | `A19-011` | `docs/audit/findings/A19.md` | `P2` | `T-091` | `P2` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 290 | `A19-012` | `docs/audit/findings/A19.md` | `P2` | `T-091` | `P2` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 291 | `A19-013` | `docs/audit/findings/A19.md` | `P2` | `T-091` | `P2` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 292 | `A20-001` | `docs/audit/findings/A20.md` | `P0` | `T-038` | `P0` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 293 | `A20-002` | `docs/audit/findings/A20.md` | `P0` | `T-031` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 294 | `A20-003` | `docs/audit/findings/A20.md` | `P0` | `T-003` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 295 | `A20-004` | `docs/audit/findings/A20.md` | `P1` | `T-003` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 296 | `A20-005` | `docs/audit/findings/A20.md` | `P1` | `T-075` | `P1` | `F-ADMIN` | `W3B` | `NEEDS_DECISION: OD-07` |
| 297 | `A20-006` | `docs/audit/findings/A20.md` | `P1` | `T-008` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 298 | `A20-007` | `docs/audit/findings/A20.md` | `P1` | `T-067` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 299 | `A20-008` | `docs/audit/findings/A20.md` | `P1` | `T-075` | `P1` | `F-ADMIN` | `W3B` | `NEEDS_DECISION: OD-07` |
| 300 | `A20-009` | `docs/audit/findings/A20.md` | `P1` | `T-058` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-09` |
| 301 | `A20-010` | `docs/audit/findings/A20.md` | `P2` | `T-084` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 302 | `A20-011` | `docs/audit/findings/A20.md` | `P2` | `T-086` | `P2` | `F-DESK` | `W3B` | `UNBLOCKED` |
| 303 | `A20-012` | `docs/audit/findings/A20.md` | `P2` | `T-084` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 304 | `A20-013` | `docs/audit/findings/A20.md` | `P2` | `T-080` | `P2` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-06` |
| 305 | `A20-014` | `docs/audit/findings/A20.md` | `P2` | `T-091` | `P2` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 306 | `A20-015` | `docs/audit/findings/A20.md` | `P2` | `T-038` | `P0` | `F-ADMIN` | `W3B` | `UNBLOCKED` |
| 307 | `A21-001` | `docs/audit/findings/A21.md` | `P1` | `T-046` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 308 | `A21-002` | `docs/audit/findings/A21.md` | `P1` | `T-046` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 309 | `A21-003` | `docs/audit/findings/A21.md` | `P1` | `T-046` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 310 | `A21-004` | `docs/audit/findings/A21.md` | `P1` | `T-057` | `P1` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 311 | `A21-005` | `docs/audit/findings/A21.md` | `P2` | `T-046` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 312 | `A21-006` | `docs/audit/findings/A21.md` | `P2` | `T-085` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-08` |
| 313 | `A21-007` | `docs/audit/findings/A21.md` | `P2` | `T-092` | `P2` | `F-UX` | `W3B` | `UNBLOCKED` |
| 314 | `A21-008` | `docs/audit/findings/A21.md` | `P2` | `T-085` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-08` |
| 315 | `A21-009` | `docs/audit/findings/A21.md` | `P2` | `T-088` | `P2` | `F-WA` | `W3B` | `UNBLOCKED` |
| 316 | `A21-010` | `docs/audit/findings/A21.md` | `P2` | `T-085` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-08` |
| 317 | `A21-011` | `docs/audit/findings/A21.md` | `P2` | `T-085` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-08` |
| 318 | `A21-012` | `docs/audit/findings/A21.md` | `P2` | `T-089` | `P2` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-10` |
| 319 | `A21-013` | `docs/audit/findings/A21.md` | `P3` | `T-095` | `P3` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 320 | `A21-014` | `docs/audit/findings/A21.md` | `P3` | `T-094` | `P3` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 321 | `A22-001` | `docs/audit/findings/A22.md` | `P0` | `T-013` | `P0` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 322 | `A22-002` | `docs/audit/findings/A22.md` | `P1` | `T-045` | `P1` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-07` |
| 323 | `A22-003` | `docs/audit/findings/A22.md` | `P1` | `T-068` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-07` |
| 324 | `A22-004` | `docs/audit/findings/A22.md` | `P1` | `T-065` | `P1` | `F-WA` | `W3B` | `UNBLOCKED` |
| 325 | `A22-005` | `docs/audit/findings/A22.md` | `P1` | `T-057` | `P1` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 326 | `A22-006` | `docs/audit/findings/A22.md` | `P1` | `T-060` | `P1` | `F-DESK` | `W3B` | `NEEDS_DECISION: OD-07` |
| 327 | `A22-007` | `docs/audit/findings/A22.md` | `P1` | `T-005` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 328 | `A22-008` | `docs/audit/findings/A22.md` | `P1` | `T-057` | `P1` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 329 | `A22-009` | `docs/audit/findings/A22.md` | `P1` | `T-044` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 330 | `A22-010` | `docs/audit/findings/A22.md` | `P2` | `T-092` | `P2` | `F-UX` | `W3B` | `UNBLOCKED` |
| 331 | `A22-011` | `docs/audit/findings/A22.md` | `P2` | `T-087` | `P2` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-10` |
| 332 | `A22-012` | `docs/audit/findings/A22.md` | `P2` | `T-013` | `P0` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 333 | `A22-013` | `docs/audit/findings/A22.md` | `P3` | `T-094` | `P3` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 334 | `A23-001` | `docs/audit/findings/A23.md` | `P0` | `T-009` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 335 | `A23-002` | `docs/audit/findings/A23.md` | `P0` | `T-009` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 336 | `A23-003` | `docs/audit/findings/A23.md` | `P0` | `T-009` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 337 | `A23-004` | `docs/audit/findings/A23.md` | `P0` | `T-040` | `P0` | `F-QA` | `W3C` | `UNBLOCKED` |
| 338 | `A23-005` | `docs/audit/findings/A23.md` | `P1` | `T-045` | `P1` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-07` |
| 339 | `A23-006` | `docs/audit/findings/A23.md` | `P1` | `T-047` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 340 | `A23-007` | `docs/audit/findings/A23.md` | `P1` | `T-045` | `P1` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-07` |
| 341 | `A23-008` | `docs/audit/findings/A23.md` | `P1` | `T-008` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 342 | `A23-009` | `docs/audit/findings/A23.md` | `P1` | `T-007` | `P0` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-10` |
| 343 | `A23-010` | `docs/audit/findings/A23.md` | `P1` | `T-052` | `P1` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-06` |
| 344 | `A23-011` | `docs/audit/findings/A23.md` | `P1` | `T-051` | `P1` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-07` |
| 345 | `A23-012` | `docs/audit/findings/A23.md` | `P1` | `T-045` | `P1` | `F-PLAT` | `W3A` | `NEEDS_DECISION: OD-07` |
| 346 | `A23-013` | `docs/audit/findings/A23.md` | `P2` | `T-087` | `P2` | `F-STUDIO` | `W3B` | `NEEDS_DECISION: OD-10` |
| 347 | `A24-001` | `docs/audit/findings/A24.md` | `P0` | `T-039` | `P0` | `F-QA` | `W3C` | `UNBLOCKED` |
| 348 | `A24-002` | `docs/audit/findings/A24.md` | `P0` | `T-039` | `P0` | `F-QA` | `W3C` | `UNBLOCKED` |
| 349 | `A24-003` | `docs/audit/findings/A24.md` | `P1` | `T-078` | `P1` | `F-QA` | `W3C` | `UNBLOCKED` |
| 350 | `A24-004` | `docs/audit/findings/A24.md` | `P1` | `T-078` | `P1` | `F-QA` | `W3C` | `UNBLOCKED` |
| 351 | `A24-005` | `docs/audit/findings/A24.md` | `P1` | `T-078` | `P1` | `F-QA` | `W3C` | `UNBLOCKED` |
| 352 | `A24-006` | `docs/audit/findings/A24.md` | `P1` | `T-078` | `P1` | `F-QA` | `W3C` | `UNBLOCKED` |
| 353 | `A24-007` | `docs/audit/findings/A24.md` | `P2` | `T-093` | `P2` | `F-QA` | `W3C` | `NEEDS_DECISION: OD-10` |
| 354 | `A24-008` | `docs/audit/findings/A24.md` | `P1` | `T-040` | `P0` | `F-QA` | `W3C` | `UNBLOCKED` |
| 355 | `A24-009` | `docs/audit/findings/A24.md` | `P1` | `T-078` | `P1` | `F-QA` | `W3C` | `UNBLOCKED` |
| 356 | `A24-010` | `docs/audit/findings/A24.md` | `P2` | `T-093` | `P2` | `F-QA` | `W3C` | `NEEDS_DECISION: OD-10` |
| 357 | `A24-011` | `docs/audit/findings/A24.md` | `P2` | `T-093` | `P2` | `F-QA` | `W3C` | `NEEDS_DECISION: OD-10` |
| 358 | `A24-012` | `docs/audit/findings/A24.md` | `P2` | `T-093` | `P2` | `F-QA` | `W3C` | `NEEDS_DECISION: OD-10` |
| 359 | `A25-001` | `docs/audit/findings/A25.md` | `P0` | `T-014` | `P0` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-06` |
| 360 | `A25-002` | `docs/audit/findings/A25.md` | `P0` | `T-020` | `P0` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-06` |
| 361 | `A25-003` | `docs/audit/findings/A25.md` | `P0` | `T-030` | `P0` | `F-WA` | `W3B` | `UNBLOCKED` |
| 362 | `A25-004` | `docs/audit/findings/A25.md` | `P0` | `T-013` | `P0` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 363 | `A25-005` | `docs/audit/findings/A25.md` | `P1` | `T-032` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-01` |
| 364 | `A25-006` | `docs/audit/findings/A25.md` | `P1` | `T-056` | `P1` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 365 | `A25-007` | `docs/audit/findings/A25.md` | `P1` | `T-056` | `P1` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 366 | `A25-008` | `docs/audit/findings/A25.md` | `P1` | `T-074` | `P1` | `F-JOBS` | `W3B` | `NEEDS_DECISION: OD-07` |
| 367 | `A25-009` | `docs/audit/findings/A25.md` | `P1` | `T-056` | `P1` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 368 | `A25-010` | `docs/audit/findings/A25.md` | `P1` | `T-067` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 369 | `A25-011` | `docs/audit/findings/A25.md` | `P2` | `T-084` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 370 | `A25-012` | `docs/audit/findings/A25.md` | `P2` | `T-084` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 371 | `A25-013` | `docs/audit/findings/A25.md` | `P2` | `T-084` | `P2` | `F-PUB` | `W3B` | `NEEDS_DECISION: OD-10` |
| 372 | `A25-014` | `docs/audit/findings/A25.md` | `P3` | `T-095` | `P3` | `F-PUB` | `W3B` | `UNBLOCKED` |
| 373 | `A26-001` | `docs/audit/findings/A26.md` | `P0` | `T-005` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 374 | `A26-002` | `docs/audit/findings/A26.md` | `P0` | `T-008` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 375 | `A26-003` | `docs/audit/findings/A26.md` | `P0` | `T-030` | `P0` | `F-WA` | `W3B` | `UNBLOCKED` |
| 376 | `A26-004` | `docs/audit/findings/A26.md` | `P0` | `T-014` | `P0` | `F-INFRA` | `W3B` | `NEEDS_DECISION: OD-06` |
| 377 | `A26-005` | `docs/audit/findings/A26.md` | `P0` | `T-029` | `P0` | `F-WA` | `W3B` | `UNBLOCKED` |
| 378 | `A26-006` | `docs/audit/findings/A26.md` | `P0` | `T-031` | `P0` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 379 | `A26-007` | `docs/audit/findings/A26.md` | `P1` | `T-008` | `P0` | `F-PLAT` | `W3A` | `UNBLOCKED` |
| 380 | `A26-008` | `docs/audit/findings/A26.md` | `P1` | `T-037` | `P0` | `F-JOBS` | `W3B` | `UNBLOCKED` |
| 381 | `A26-009` | `docs/audit/findings/A26.md` | `P1` | `T-067` | `P1` | `F-WA` | `W3B` | `NEEDS_DECISION: OD-10` |
| 382 | `A26-010` | `docs/audit/findings/A26.md` | `P1` | `T-070` | `P1` | `F-SOCIAL` | `W3B` | `NEEDS_DECISION: OD-11` |
| 383 | `A26-011` | `docs/audit/findings/A26.md` | `P2` | `T-046` | `P1` | `F-PLAT` | `W3A` | `UNBLOCKED` |
