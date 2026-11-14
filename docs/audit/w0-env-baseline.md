# Wave 0 — Disposable Environment, Migration/Seed Verification & Baseline Audit (`w0-env`)

- **Agent**: `w0-env` (Wave 0 Environment & Baseline Builder)
- **Workspace**: `c:\dev\al-ramlah-travels\web`
- **Branch**: `audit/production-hardening`
- **Timestamp (UTC)**: `2026-11-14T10:36:00Z`
- **Production Isolation Guarantee**: Zero reads/prints of `.env` values; zero connections, migrations, seeds, or test mutations sent to Neon (`neon.tech`), Cloudflare R2, Meta Graph API, or Trigger.dev Cloud. All database operations ran exclusively against disposable local Docker PostgreSQL (`127.0.0.1:54329/alramlah_audit`).

---

## Executive Summary Table

| Check / Deliverable | Command / Target | Result | Key Evidence / Finding |
| :--- | :--- | :--- | :--- |
| **Git Branch** | `git checkout -b audit/production-hardening` | **PASS (`exit 0`)** | Branch created cleanly; all uncommitted working-tree edits preserved intact. |
| **`.gitignore` Hardening** | `.gitignore` (`lines 30–34`) | **PASS** | `.env`, `.env.audit`, and `.next-dev.log` ignored; `!.env.example` tracked. |
| **Runtime Versions** | `node -v` / `npm -v` | **`v24.22.1` / `11.19.1`** | Host runs Node 24 LTS; `Dockerfile:7` uses **EOL `node:20-alpine`** (EOL `2026-04-30`, **W0-005**). |
| **Disposable Postgres 16** | `docker run ... postgres:16-alpine` (`alramlah-audit-pg`) | **PASS (Running)** | `PostgreSQL 16.16` bound strictly to `127.0.0.1:54329->5432/tcp` (`audit` / `alramlah_audit`). |
| **Audit Env & Guard** | `.env.audit` + `tests/helpers/audit-guard.ts` | **PASS (9/9 self-tests)** | Blocks `neon.tech`, missing `DATABASE_URL_POOLED` (`dotenv` trap), non-localhost DBs, and live R2/Meta/Trigger keys. |
| **Raw `drizzle-kit migrate`** | `npx drizzle-kit migrate` (against `127.0.0.1:54329`) | **FAIL (`exit 1`)** | `pg`/`postgres` absent from `package.json`; falls back to `@neondatabase/serverless` WebSocket driver (**W0-004**). |
| **Schema vs Migration Drift** | Official Drizzle `migrate()` + `information_schema` diff | **DRIFT FOUND (`W0-002`)** | `db/schema/*` = **43 tables / 740 cols / 46 enums**; `drizzle/` (`0000`+`0001`) creates **42 tables / 724 cols / 45 enums**. Missing `whatsapp_linked_device_sessions`, enum `whatsapp_linked_device_status`, and out-of-band index `idx_marketing_channels_external_handle`. |
| **Raw `db/seed.ts`** | `npx tsx db/seed.ts` (against `127.0.0.1:54329`) | **FAIL (`exit 1`)** | `db/index.ts:12,29` hardcodes `neon-http` (`https://api.0.0.1/sql`, **W0-004**). |
| **Bridged `db/seed.ts` (2×)** | Two-pass seed against `alramlah-audit-pg` | **CORRUPTS DATA (`W0-001`)** | Run #1 seeds `long_term` visa at `90d / PKR 68,000 / 750 SAR`; **Run #2 overwrites `long_term` to `30d / PKR 42,500 / 470 SAR`** (PKR 25,500/pilgrim underquote!) + seeds weak passwords `Admin@123456` / `Staff@123456` (**W0-007**). |
| **`npm run typecheck`** | `tsc --noEmit` | **PASS (`exit 0`)** | 0 TypeScript errors. |
| **`npm run lint`** | `eslint` | **PASS w/ Warnings (`exit 0`)** | **0 errors, 212 warnings** (`react-hooks/set-state-in-effect`, `no-unused-vars`, `no-explicit-any`, `no-img-element`, `react-hooks/purity`). |
| **`npm test`** | `tsx --test tests/*.test.ts` (isolated from `.env`) | **FAIL (`exit 1`, `W0-003`)** | **429 tests, 132 suites, 422 pass, 7 fail** (`108.5s`). Proves **6 unit tests execute live `INSERT`/`UPDATE`/`DELETE` on Neon prod** when `.env` is present! |
| **`npm run build`** | `next build --webpack` (`SKIP_ENV_VALIDATION=1`) | **PASS (Compiled + 27/27 Static Pages)** | Webpack compiled (`15.3m`), TypeScript passed (`22.2m`), **27/27 static pages generated (`28.4s`)**, **36 App Router routes** (`4.10 MB` `.next/static`, largest chunk `385.0 KB`); standalone NFT trace slow due to `shadcn`/`ts-morph` in prod `dependencies` + unexcluded `.next` in `tsconfig.json`. |
| **`npm audit --omit=dev`** | `npm audit --omit=dev` | **FAIL (`exit 1`, `W0-006`)** | **9 prod vulnerabilities** (`1 critical, 2 high, 4 moderate, 2 low`), incl. **3 Critical RCEs in `next@16.3.4`** (`-> 16.4.6`) & `shadcn` CLI in prod `dependencies`. |
| **Audit Tooling Inventory** | `@playwright/test`, `knip`, `gitleaks` | **MISSING** | None of `@playwright/test`, `knip`, or `gitleaks` are installed in `web/node_modules`. |

---

## 1. Git Branch & `.gitignore` Hardening

### 1.1 Branch Creation
Created `audit/production-hardening` in `c:\dev\al-ramlah-travels\web` without resetting, stashing, or altering any pre-existing uncommitted files:

```text
$ git checkout -b audit/production-hardening
Switched to a new branch 'audit/production-hardening'
```

### 1.2 `.gitignore` Verification
Added `.next-dev.log` to `c:\dev\al-ramlah-travels\web\.gitignore` (line 30) alongside the existing `.env*` / `!.env.example` rules (lines 33–34). Verified with `git check-ignore -v`:

```text
$ git check-ignore -v .env .env.audit .next-dev.log .env.example
.gitignore:33:.env*	.env
.gitignore:33:.env*	.env.audit
.gitignore:30:.next-dev.log	.next-dev.log
# (.env.example returned no match => remains tracked by git)
```

---

## 2. Runtime, Docker Container & `Dockerfile` Node EOL Audit

### 2.1 Host Runtime & Audit Tooling Inventory
- **Operating System**: Windows x64 (`powershell`)
- **`node -v`**: `v24.22.1`
- **`npm -v`**: `11.19.1`
- **Installed / Missing Tooling Check**:
  - `node_modules/@playwright/test`: **`False` (NOT installed)** — `Get-Command playwright` resolves only to an unrelated host Python binary (`C:\Users\ubaid\AppData\Local\Programs\Python\Python310\Scripts\playwright.exe`), NOT `@playwright/test` in Node. No `playwright.config.ts` or `tests/e2e/` exists yet.
  - `node_modules/knip` / `knip`: **`False` (NOT installed)**.
  - `gitleaks`: **`False` (NOT installed on PATH)**.
  - `node_modules/pg` / `node_modules/postgres`: **`False` (NOT installed)** — only `@neondatabase/serverless@^1.2.0` and `ws@^8.22.0` are installed.

### 2.2 Disposable Local PostgreSQL 16 Container (`alramlah-audit-pg`)
- **Initial `docker info` check**: Docker Desktop Linux engine was initially stopped (`ERROR: error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/info": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.`).
- **Resolution**: Started Docker Desktop (`Server Version: 29.2.0`) via persistent background daemon and launched disposable container `alramlah-audit-pg`:

```text
$ docker ps --filter name=alramlah-audit-pg
CONTAINER ID   IMAGE                COMMAND                  STATUS         PORTS                       NAMES
54e912b4d761   postgres:16-alpine   "docker-entrypoint.s…"   Up             127.0.0.1:54329->5432/tcp   alramlah-audit-pg

$ docker exec alramlah-audit-pg pg_isready -U audit -d alramlah_audit
/var/run/postgresql:5432 - accepting connections

$ docker exec alramlah-audit-pg psql -U audit -d alramlah_audit -c "SELECT version();"
PostgreSQL 16.16 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
```

### 2.3 `Dockerfile` Node.js End-of-Life (EOL) Status
- `web/Dockerfile:7` specifies:
  ```dockerfile
  FROM node:20-alpine AS base
  ```
- `web/package.json:63` specifies `"@types/node": "^20"` (and declares no `"engines"` field).
- **EOL Verdict (`W0-005`)**: **Node.js 20 reached End-of-Life on `2026-04-30`**. As of `2026-11-14`, `node:20-alpine` has been **unpatched for ~6.5 months** and no longer receives OpenSSL, HTTP/2, Undici, or V8 security updates. Self-hosted Docker builds must move to `node:22-alpine` (Maintenance LTS until `2027-04-30`) or `node:24-alpine` (Active/Maintenance LTS until `2028-04-30`, matching the local dev `v24.22.1` runtime).

---

## 3. Audit Environment (`.env.audit`) & Safety Guard (`tests/helpers/audit-guard.ts`)

### 3.1 Production-Leak Traps Discovered While Designing `.env.audit`
1. **`dotenv/config` + `DATABASE_URL_POOLED` Precedence Trap (`db/index.ts:1-21`, `drizzle.config.ts:1-10`)**:
   - `db/index.ts:1` executes `import "dotenv/config"` immediately at module import time and resolves `const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL`.
   - Because `dotenv/config` populates any *unset* environment variable from `.env` (without overriding set variables), **a command or test that overrides only `DATABASE_URL` still inherits the live Neon `DATABASE_URL_POOLED` from `.env`!**
   - `.env.audit` explicitly sets **both** `DATABASE_URL` and `DATABASE_URL_POOLED` to `postgresql://audit:audit_local_only@127.0.0.1:54329/alramlah_audit`, and `assertAuditSafeEnvironment()` throws immediately if **either** variable is unset, contains `neon.tech`, or resolves to a non-localhost host.
2. **Hidden Host Wrangler OAuth Fallback (`lib/storage/r2.ts:53-82, 206-225`)**:
   - In `lib/storage/r2.ts:206-225`, if `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` are unset, `uploadAssetToR2()` checks `R2_ACCOUNT_ID` and calls `readWranglerOAuthToken()`, which reads `%APPDATA%\xdg.config\.wrangler\config\default.toml` from the developer's host OS to upload straight to Cloudflare's live REST API!
   - `.env.audit` sets `R2_ACCOUNT_ID=""` and `CLOUDFLARE_API_TOKEN=""`, forcing safe local fallback, and `assertAuditSafeEnvironment()` rejects any non-mock value in `R2_ACCOUNT_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_API_TOKEN`, `META_APP_SECRET`, `TRIGGER_SECRET_KEY`, and AI/OAuth secrets.

### 3.2 `assertAuditSafeEnvironment()` Self-Verification (`tests/helpers/audit-guard.ts`)
Verified 9 positive/negative cases against `assertAuditSafeEnvironment()`:

```text
=== 1. AUDIT GUARD SELF-TESTS ===
PASS: Current audit environment accepted by assertAuditSafeEnvironment()
PASS: Rejects neon.tech in DATABASE_URL
PASS: Rejects neon.tech in DATABASE_URL_POOLED
PASS: Rejects missing DATABASE_URL_POOLED (blocks dotenv fallback trap)
PASS: Rejects non-localhost host
PASS: Rejects live R2_ACCOUNT_ID
PASS: Rejects live META_APP_SECRET
PASS: Rejects tr_prod_* TRIGGER_SECRET_KEY
PASS: Rejects tr_dev_* TRIGGER_SECRET_KEY
```

---

## 4. Drizzle Migration Execution & Schema Drift Audit (`db/schema/*` vs `drizzle/`)

### 4.1 Raw `npx drizzle-kit migrate` Against Disposable Local Postgres (`FAIL — exit 1`)
Running `npx drizzle-kit migrate` out-of-the-box against `postgresql://audit:audit_local_only@127.0.0.1:54329/alramlah_audit` fails with `exit 1` because `package.json` omits `pg` / `postgres`, forcing `drizzle-kit` onto `@neondatabase/serverless` WebSockets:

```text
$ npx drizzle-kit migrate
No config path provided, using default 'drizzle.config.ts'
Reading config file 'C:\dev\al-ramlah-travels\web\drizzle.config.ts'
Using '@neondatabase/serverless' driver for database querying
 Warning  '@neondatabase/serverless' can only connect to remote Neon/Vercel Postgres/Supabase instances through a websocket
[⣷] applying migrations...
MIGRATE_EXIT=1
```

### 4.2 Official Drizzle `migrate()` Execution & Live Introspection Diff
To inspect the exact SQL state produced by `web/drizzle/` (`0000_noisy_leader.sql` + `0001_cynical_proudstar.sql`) without modifying repo dependencies or source files, we ran Drizzle's official `drizzle-orm/neon-serverless` `migrate()` through a local loopback WebSocket-to-TCP bridge into `alramlah-audit-pg` (`127.0.0.1:54329`), then diffed `getTableConfig()` across all exports in `db/schema/*` against `information_schema` and `pg_catalog`:

```text
Applying Drizzle SQL migrations from C:/dev/al-ramlah-travels/web/drizzle ...
✅ Drizzle migrate() completed against alramlah-audit-pg!
BRIDGED_MIGRATE_EXIT=0

=== 2. SCHEMA COUNTS (db/schema/*) ===
Drizzle Tables: 43
Drizzle Columns: 740
Drizzle Enums: 46
Drizzle Explicit Indexes: 104
Drizzle Foreign Keys: 60

=== 3. APPLIED DRIZZLE MIGRATIONS IN DISPOSABLE PG ===
[
  { "id": 1, "hash": "c41f421a7228c5078fbabab40ae1f8eb1b37de7dbd904759c22c23add43e2708", "created_at": "1792856493665" },
  { "id": 2, "hash": "9ccdabeebdb965cd887aa1b647fc17f2e3828f90d645c0892c1d68b4aeb6b7bb", "created_at": "1794219930354" }
]
DB Public Tables Created: 42
DB Public Columns Created: 724
DB Public Enums Created: 45

=== 4. SCHEMA VS MIGRATION DRIFT REPORT ===
Missing Tables (in db/schema/* but NOT created by drizzle-kit migrate): [
  "whatsapp_linked_device_sessions"
]
Extra Tables (in DB but NOT in db/schema/*): []
Missing Columns (in existing tables): []
Extra Columns (in DB but NOT in db/schema/*): []
Nullability Drift: []
Missing Enums: [
  "whatsapp_linked_device_status"
]
Extra Enums: []
Enum Value Drift: []
```

### 4.3 Detailed Drift Breakdown (Slices 26–42)
| Drift Artifact | Defined In `db/schema/*` | Present in `drizzle/0000` + `0001`? | Ad-Hoc Script Origin | Production Impact |
| :--- | :--- | :--- | :--- | :--- |
| Enum `whatsapp_linked_device_status` (`disconnected`, `connecting`, `qr_ready`, `pairing_code_ready`, `connected`) | `db/schema/whatsapp-crm.ts:99-105` | **NO (MISSING)** | `scripts/sync-slice40-schema.ts:72-80` | Fresh staging/prod/DR `db:migrate` lacks enum type. |
| Table `whatsapp_linked_device_sessions` (16 columns + `idx_wa_linked_session_key` + `idx_wa_linked_status`) | `db/schema/whatsapp-crm.ts:446-477` | **NO (MISSING)** | `scripts/sync-slice40-schema.ts:86-110` | `/admin/settings` (WhatsApp Linked Devices), `/admin/campaigns` (WA Group/Status sync & dispatch), and Multi-Number routing crash with `relation "whatsapp_linked_device_sessions" does not exist`. |
| Partial Unique Index `idx_marketing_channels_external_handle` on `marketing_channels(external_group_id_or_handle) WHERE external_group_id_or_handle IS NOT NULL` | **MISSING from `db/schema/suppliers-and-marketing.ts:71-106`!** | **NO (MISSING)** | `scripts/sync-slice40-schema.ts:116-119` | **Two-way drift**: Neither `drizzle/` migrations nor `db/schema/*` declares this unique index! Even `drizzle-kit push` or `drizzle-kit generate` will NOT create it on a fresh DB, breaking `ON CONFLICT` group-sync upserts or allowing duplicate WhatsApp group channels. |
| Earlier Phase 3 columns (`whatsapp_conversations` pin/archive/intake, `social_posts` format/overrides, etc.) | `db/schema/*` | **YES** (folded into `0001_cynical_proudstar.sql`) | `scripts/sync-phase3-columns.ts`, `scripts/audit-and-sync-schema.ts` | 0 missing columns across the 42 migrated tables, but legacy ad-hoc sync scripts remain in `scripts/` alongside destructive `DELETE` SQL in `sync-slice40-schema.ts:55-66`. |

---

## 5. `db/seed.ts` Execution & Two-Pass Idempotency Audit

### 5.1 Raw `npx tsx db/seed.ts` Against Disposable Local Postgres (`FAIL — exit 1`)
Because `db/index.ts:12,29` unconditionally instantiates `neon(connectionString)` (`drizzle-orm/neon-http`), `@neondatabase/serverless` rewrites `127.0.0.1` to `https://api.0.0.1/sql` and fails immediately against standard PostgreSQL:

```text
$ npx tsx db/seed.ts
🌱 Starting Al Ramlah Travels database seed...
👤 Seeding admin & staff accounts...
❌ Seed execution failed: DrizzleQueryError: Failed query: select "id", "name", "email", "email_verified", "image", "role", "is_active", "created_at", "updated_at" from "user" "user" where "user"."email" = $1 limit $2
  cause: NeonDbError: Error connecting to database: TypeError: Failed to parse URL from https://api.0.0.1/sql
RAW_SEED_EXIT=1
```

### 5.2 Two-Pass Bridged Execution Against `alramlah-audit-pg` (`Run #1` & `Run #2`)
Routing `neon()` fetch calls exclusively to `alramlah-audit-pg` (`127.0.0.1:54329`, guarded by `assertAuditSafeEnvironment()`), we ran `db/seed.ts` **twice consecutively** on the cleanly migrated 42-table database:

```text
=== SEED RUN #1 ===
🌱 Starting Al Ramlah Travels database seed...
   ✅ Created Super Admin: admin@alramlahtravels.com
   ✅ Created Staff: staff@alramlahtravels.com
   ✅ Agency settings configured (SAR to PKR: 75).
   ✅ Visa rates configured (Short: 470 SAR / PKR 42,500, Long: 750 SAR / PKR 68,000).
   ✅ 8 Pakistani departure gateways seeded.
   ✅ 6 major carriers seeded.
   ✅ 18 named hotels seeded across 1★, 2★, 3★, 4★, 5★ and real-world allotment tiers.
   ✅ 10 locked road vehicles + Haramain High-Speed Train seeded.
   ✅ 12 locked transport sectors seeded.
   ✅ 128 transport rate cells seeded across 12 sectors and 11 vehicle models.
   ✅ 12 sacred ziyarat sites seeded with Arabic names.
   ✅ 4 group packages and scheduled departure batches seeded.
   ✅ Hero slides and FAQs seeded.
✨ Seed completed successfully! Core foundation catalog data populated.
SEED_RUN1_EXIT=0

    tier    | max_days | price_pkr | price_sar | without_masar_price_sar | with_masar_28_days_sar
------------+----------+-----------+-----------+-------------------------+------------------------
 short_term |       30 |     42500 |       470 |                     470 |                    545
 long_term  |       90 |     68000 |       750 |                     750 |                    750
(2 rows)

 users | cities | airlines | hotels | vehicles | sectors | trates | ziyarat | gpkgs | gdeps | slides | faqs
-------+--------+----------+--------+----------+---------+--------+---------+-------+-------+--------+------
     2 |      8 |        6 |     18 |       11 |      12 |    128 |      12 |     4 |     5 |      3 |    5

=== SEED RUN #2 ===
🌱 Starting Al Ramlah Travels database seed...
   ✅ Super Admin exists and role verified.
   ✅ Staff exists and role verified.
   ...
   ✅ Visa rates configured (Short: 470 SAR / PKR 42,500, Long: 750 SAR / PKR 68,000).
   ...
✨ Seed completed successfully! Core foundation catalog data populated.
SEED_RUN2_EXIT=0

    tier    | max_days | price_pkr | price_sar | without_masar_price_sar | with_masar_28_days_sar
------------+----------+-----------+-----------+-------------------------+------------------------
 short_term |       30 |     42500 |       470 |                     470 |                    545
 long_term  |       30 |     42500 |       470 |                     470 |                    545
(2 rows)

 users | cities | airlines | hotels | vehicles | sectors | trates | ziyarat | gpkgs | gdeps | slides | faqs
-------+--------+----------+--------+----------+---------+--------+---------+-------+-------+--------+------
     2 |      8 |        6 |     18 |       11 |      12 |    128 |      12 |     4 |     5 |      3 |    5
```

### 5.3 Critical Seed Findings
1. **P0 Visa Rate Data Corruption on Re-Seed (`db/seed.ts:141-187`, `W0-001`)**:
   - Table row counts are idempotent across Run #1 and Run #2, **and `seed.ts` does not fail on the missing `whatsapp_linked_device_sessions` table**, **HOWEVER** `db/seed.ts:175-187` attaches a single hardcoded `.onConflictDoUpdate` payload to a 2-row insert (`short_term` + `long_term`):
     ```ts
     .onConflictDoUpdate({
       target: schema.visaRates.tier,
       set: {
         pricePkr: 42500,
         priceSar: 470,
         withoutMasarPriceSar: 470,
         withMasar10DaysSar: 500,
         withMasar15DaysSar: 515,
         withMasar21DaysSar: 530,
         withMasar28DaysSar: 545,
         maxDays: 30,
       },
     })
     ```
   - On **any** second run of `db:seed`, `long_term` (`90 days`, `PKR 68,000`, `750 SAR`) is silently overwritten in PostgreSQL to `30 days`, `PKR 42,500`, `470 SAR` while the console still logs `Long: 750 SAR / PKR 68,000`! Because `Visa Only` mode quotes fixed PKR totals directly to customers (`>30` days = `long_term`), re-seeding causes an immediate **PKR 25,500 (280 SAR) loss per passport**.
2. **P0 Weak Default Admin/Staff Credentials (`db/seed.ts:28-29, 66-67`, `W0-007`)**:
   - Seeds `admin@alramlahtravels.com` (`super_admin`) with `Admin@123456` and `staff@alramlahtravels.com` (`staff`) with `Staff@123456` with zero `NODE_ENV === "production"` guard.

---

## 6. Baseline Verification Suite

### 6.1 TypeScript (`npm run typecheck`) — **PASS (`exit 0`)**
```text
> al-ramlah-travels@0.0.1 typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
```

### 6.2 ESLint (`npm run lint`) — **PASS with 212 Warnings (`exit 0`)**
```text
> al-ramlah-travels@0.0.1 lint
> eslint
✖ 212 problems (0 errors, 212 warnings)
LINT_EXIT=0
```
- **Dominant warning categories across `app/`, `components/`, `lib/`, `trigger/`, `scripts/`, `tests/`**:
  - `react-hooks/set-state-in-effect`: Cascading synchronous `setState` inside `useEffect` across admin hubs/catalogs (`campaign-realtime-status.tsx`, `social-platform-preview.tsx`, `studio-media-picker-modal.tsx`, `content-client.tsx`, `flights-client.tsx`, `groups-client.tsx`, `hotels-client.tsx`, `messages-client.tsx`, `transport-client.tsx`, `users-client.tsx`, `visa-client.tsx`, `ziyarat-client.tsx`, `copilot-realtime-run-banner.tsx`, `applications-kanban-board.tsx`, `carousel.tsx`, `use-mobile.ts`).
  - `react-hooks/purity`: Impure `Date.now()` called during render in `components/admin/hubs/applications-kanban-board.tsx:595,599` (hydration/render mismatch risk).
  - `@typescript-eslint/no-explicit-any`: Explicit `any` in `app/actions/social-scheduler.ts:2101`, `app/actions/trigger-realtime.ts:390`, `components/admin/desk/copilot-realtime-run-banner.tsx:42`, `lib/social/caption-copilot.ts:249`, `lib/whatsapp/linked-device-auth-postgres.ts:34,110`, `lib/whatsapp/linked-device.ts:369,870` (violates `AGENTS.md` zero-`any` rule).
  - `@next/next/no-img-element` & `@typescript-eslint/no-unused-vars` (incl. unused schedule imports in `trigger/schedules.task.ts:12-17`).

### 6.3 Unit/Integration Test Suite (`npm test`) — **FAIL When Isolated From Live Neon (`exit 1`)**
Executed with both `DATABASE_URL` and `DATABASE_URL_POOLED` pointed to `127.0.0.1:54329` so live Neon in `.env` was completely untouched:

```text
> al-ramlah-travels@0.0.1 test
> tsx --test tests/*.test.ts

ℹ tests 429
ℹ suites 132
ℹ pass 422
ℹ fail 7
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 108542.5944
```

- **All 7 Failing Tests & Why They Previously Masked a P0 Production Hazard (`W0-003`)**:
  1. `tests/trigger-v4-webhook-and-realtime-copilot.test.ts:432` — `dispatchViaSocialBridge routes to native postiz when active DB integration exists`: `AssertionError: Expected 'local_queue' to strictly equal 'postiz'`. Queries live `social_integrations` table without seeding or mocking; only passed previously because the developer's live Neon DB happened to have an active `instagram` OAuth row! Also attempts `DELETE` cleanup on `whatsapp_conversations` (`line 379`).
  2. `tests/whatsapp-linked-device-and-groups.test.ts:360` — `inserts, updates status, and reads whatsappLinkedDeviceSessions in Neon PostgreSQL`: Executes real `INSERT` / `UPDATE` / `DELETE` against `whatsapp_linked_device_sessions` via `db`.
  3. `tests/whatsapp-multi-number-system.test.ts:65` — `queries database and returns array of linked device sessions`: Queries live `whatsapp_linked_device_sessions`.
  4. `tests/whatsapp-multi-number-system.test.ts:114` — `creates and updates a custom session slot in Neon PostgreSQL`: Inserts/updates `test_custom_slot_unit` in `whatsapp_linked_device_sessions`.
  5. `tests/whatsapp-multi-number-system.test.ts:138` — `successfully deletes any session slot and purges its linked whatsapp_accounts row`: Inserts & deletes rows in `whatsapp_accounts` and `whatsapp_linked_device_sessions`.
  6. `tests/whatsapp-multi-number-system.test.ts:253` — `falls back gracefully when preferredSessionKey is 'auto' or omitted`: Queries live `whatsapp_linked_device_sessions`.
  7. `tests/whatsapp-multi-number-system.test.ts:268` — `creates and maps distinct whatsappAccounts row for Line 1 and Line 2`: Upserts `phone_number_id = 'linked-default'` and `'linked-line_2'` into **live `whatsapp_accounts`**!

### 6.4 Production Build (`npm run build`) & Bundle Size Baseline
Executed `npm run build` (`next build --webpack`) with `SKIP_ENV_VALIDATION=1` and `DATABASE_URL` / `DATABASE_URL_POOLED` overridden to `127.0.0.1:54329`:

```text
> al-ramlah-travels@0.0.1 build
> next build --webpack

▲ Next.js 16.3.4 (webpack)
- Environments: .env
✓ Running next.config.ts took 35.6s
- Experiments (use with caution):
  · serverActions

  Creating an optimized production build ...
✓ Compiled successfully in 15.3min
  Running TypeScript ...
  Finished TypeScript in 22.2min ...
  Collecting page data using 11 workers ...
  Generating static pages using 11 workers (0/27) ...
✓ Generating static pages using 11 workers (27/27) in 28.4s
  Finalizing page optimization ...
  Collecting build traces ...
```

- **App Router Surface & Static vs Dynamic Classification (`.next/server/app-paths-manifest.json` + `.next/prerender-manifest.json`)**:
  - **Total compiled App Router routes**: **36** (**28 pages** + **8 route handlers**).
  - **`○` Static Prerendered Routes (4 total in `prerender-manifest.json`)**: `/admin/login` (`11,805 B` HTML), `/_not-found` (`10,493 B` HTML), `/_global-error` (`8,891 B` HTML), `/favicon.ico`.
  - **`ƒ` Dynamic Server-Rendered Routes (32 total)**: Includes **all 3 public marketing/legal pages** (`/` `app/(public)/page`, `/privacy`, `/terms` — rendered dynamically on every request rather than SSG/ISR!), all 6 canonical Admin Hubs (`/admin`, `/admin/studio`, `/admin/campaigns`, `/admin/desk`, `/admin/catalog`, `/admin/settings`), 2 detail routes (`/admin/applications/[id]`, `/admin/applications/[id]/voucher`), all 14 legacy `/admin/*` redirect pages, and 7 `/api/*` route handlers (`/api/auth/[...all]`, `/api/webhooks/whatsapp`, `/api/uploads/presign`, `/api/uploads/local`, `/api/oauth/social/[provider]`, `/api/oauth/social/[provider]/callback`, `/api/oauth/social/[provider]/composio-callback`).
- **Static Client Bundle Size Baseline (`.next/static`)**:
  - Total `.next/static` footprint: **`4.10 MB`**
  - Top 15 client JS chunks in `.next/static/chunks/`:

    | Chunk File | Size (KB) | Size (Bytes) |
    | :--- | ---: | ---: |
    | `5525-94f1d53e3626afc7.js` | `385.0 KB` | `394,217` |
    | `2414-7be0bcde995accf6.js` | `347.7 KB` | `356,084` |
    | `3794-a6cbe3f16d804637.js` | `235.7 KB` | `241,388` |
    | `4bd1b696-8a4ab4fdf0ae305a.js` | `196.3 KB` | `201,060` |
    | `framework-666c53740fc261c8.js` | `185.2 KB` | `189,686` |
    | `main-d8ddcf5f6ea7bbe2.js` | `130.9 KB` | `134,040` |
    | `polyfills-42372ed130431b0a.js` | `110.0 KB` | `112,594` |
    | `6756-533741a8e23a090c.js` | `92.8 KB` | `95,040` |
    | `3076-0fe90a67187bc1b9.js` | `89.5 KB` | `91,606` |
    | `5318-9bcc0142132a827b.js` | `57.1 KB` | `58,506` |
    | `2797-744b646e56200915.js` | `38.1 KB` | `39,016` |
    | `1036-0c2e502fc31f3752.js` | `36.6 KB` | `37,487` |
    | `1887-6ab9995b5e8a87f3.js` | `32.7 KB` | `33,535` |
    | `4609-946ddb08261fdfd5.js` | `31.9 KB` | `32,698` |
    | `243-7052b6fbdc67397e.js` | `24.8 KB` | `25,348` |

- **Build Performance Bottleneck Identified**: `tsconfig.json:31-46` includes `"**/*.ts"`, `"**/*.tsx"`, `"**/*.mts"`, `".next/types/**/*.ts"` while `"exclude"` omits `".next"`, `"scripts"`, and `"tests"`, causing Next's post-webpack `tsc` worker (`1.48 GB` RSS) to take >20 minutes under host load despite standalone `npm run typecheck` completing in seconds.
- **Bonus `next.config.ts` Security Observations**:
  - `next.config.ts:33-36` configures wildcard `{ protocol: "https", hostname: "**" }` on `images.remotePatterns` (arbitrary external image optimization proxy / SSRF amplifier alongside `GHSA-cjq9-62q9-8jv4` & `GHSA-2464-fhr4-w9xw`).
  - `next.config.ts:21-27` permanently trusts `*.ngrok-free.app`, `*.trycloudflare.com`, `*.devtunnels.ms` in `experimental.serverActions.allowedOrigins` even in production builds!

### 6.5 Dependency Security Audit (`npm audit --omit=dev`) — **FAIL (`exit 1`, 9 Vulnerabilities)**
```text
$ npm audit --omit=dev
9 vulnerabilities (2 low, 4 moderate, 2 high, 1 critical)
AUDIT_EXIT=1
```
| Package | Installed / Range | Severity | Advisories | Root Cause / Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **`next`** | `16.3.4` (`16.0.0 - 16.4.0`) | **Critical** | **3 Critical RCEs** (`GHSA-vcvr-r3jv-pc5j` RCE in `next/og`, `GHSA-2464-fhr4-w9xw` unauth RCE in Image Optimization SVG, `GHSA-673q-mjm6-r5xr` unauth RCE in `use cache`), **SSRF** (`GHSA-cjq9-62q9-8jv4`), **Server Actions DoS** (`GHSA-p3m5-59mp-jv5r`), **SSG/ISR Cache Poisoning & Leaks** (`GHSA-mcj8-r9mp-w47p`, `GHSA-4jqv-mc3x-m676`, `GHSA-3w37-wq28-93x7`, `GHSA-h694-7cp9-m8p3`, `GHSA-f87g-xv8r-7p7x`, `GHSA-39w2-rjm5-chcv`) | Upgrade `next` & `eslint-config-next` to **`16.4.6+`**. |
| **`deepmerge-ts`** (via `@prisma/config`) | `<8.0.0` | **High** | `GHSA-ggr8-5vv4-36mx` (stack exhaustion on recursive object graphs) | Transitive dependency; `npm audit fix` or prune unused Prisma config transitive tree. |
| **`shadcn`** (`@shadcn/registry` -> `deepmerge`, `ts-morph` -> `minimatch`) | `^4.21.0` in `dependencies` | **Moderate / High** | `GHSA-gcqx-w48m-w2h4` (`deepmerge` prototype poisoning), `GHSA-g3hv-75wg-m249` (`minimatch` ReDoS/DoS) | `shadcn` CLI (`package.json:55`) is misplaced in production `dependencies` instead of `devDependencies` (or `npx` invocation), bloating production `node_modules` and standalone Docker layers. |

---

## 7. Mandatory Structured Findings (`W0-001` – `W0-007`)

### W0-001 — `db/seed.ts` overwrites `long_term` 90-day visa rate with `short_term` 30-day PKR/SAR rate on second run
- Severity: P0
- Category: data-integrity
- Where: `db/seed.ts:141-187` (`visa_rates` `.onConflictDoUpdate`)
- Brief claim contradicted (if any): Foundation seed safely populates short-term (PKR 42,500) and long-term (PKR 68,000) visa tiers.
- Evidence: Executed `db/seed.ts` twice against disposable PostgreSQL 16 (`alramlah-audit-pg`). After Run #1: `long_term = (max_days: 90, price_pkr: 68000, price_sar: 750)`. After Run #2: `long_term = (max_days: 30, price_pkr: 42500, price_sar: 470, with_masar_28_days_sar: 545)`, while stdout falsely logged `Long: 750 SAR / PKR 68,000`.
- Impact (business terms): Re-running `npm run db:seed` on any environment silently corrupts 31–90 day Umrah visas to short-term pricing, underquoting `Visa Only` customers and pre-filled admin worksheets by **PKR 25,500 (280 SAR) per passport**.
- Root cause: `.onConflictDoUpdate({ target: schema.visaRates.tier, set: { pricePkr: 42500, ... } })` applies static `short_term` literals to every conflicting row in the multi-row `VALUES` batch instead of referencing `excluded.*`.
- Recommended fix: Replace hardcoded `set` literals with `sql\`excluded.price_pkr\``, `sql\`excluded.price_sar\``, `sql\`excluded.max_days\``, etc. (or upsert `short_term` and `long_term` in separate statements, or use `onConflictDoNothing` in non-reset mode so admin rate edits in `/admin/catalog` aren't clobbered).
- Test to add: Integration test running `seed()` twice against disposable Postgres and asserting `short_term` (`30d / 42500 / 470`) and `long_term` (`90d / 68000 / 750`) remain distinct and intact.
- Effort: S (<2h)
- Confidence: High
- Needs owner decision: no

### W0-002 — Drizzle migrations (`drizzle/`) miss Slice 40/41 table, enum, and unique channel index
- Severity: P0
- Category: data-integrity
- Where: `drizzle/0000_noisy_leader.sql`, `drizzle/0001_cynical_proudstar.sql`, `db/schema/whatsapp-crm.ts:99-105,446-477`, `db/schema/suppliers-and-marketing.ts:71-106`, `scripts/sync-slice40-schema.ts:72-120`
- Brief claim contradicted (if any): 43 tables & 46 enums managed reproducibly via Drizzle ORM migrations.
- Evidence: Fresh `migrate()` against `alramlah-audit-pg` creates **42 tables / 724 columns / 45 enums** vs `db/schema/*` defining **43 tables / 740 columns / 46 enums**. Missing: table `whatsapp_linked_device_sessions` (16 cols, 2 indexes) and enum `whatsapp_linked_device_status`. Additionally, `scripts/sync-slice40-schema.ts:116-119` created `CREATE UNIQUE INDEX idx_marketing_channels_external_handle ON marketing_channels (external_group_id_or_handle) WHERE external_group_id_or_handle IS NOT NULL` directly on Neon without adding it to `db/schema/suppliers-and-marketing.ts` or `drizzle/`.
- Impact (business terms): Any fresh production deployment, staging environment, or disaster-recovery restore using `drizzle-kit migrate` crashes on WhatsApp Linked-Device settings, WA Group/Status campaigns, and Multi-Number routing, and lacks uniqueness protection on synced WhatsApp group JIDs.
- Root cause: Slice 40/41 applied DDL directly to Neon via `scripts/sync-slice40-schema.ts` instead of updating `db/schema/suppliers-and-marketing.ts` and running `npx drizzle-kit generate`.
- Recommended fix: Declare the partial unique index `idx_marketing_channels_external_handle` in `db/schema/suppliers-and-marketing.ts`, generate `drizzle/0002_*.sql` with `IF NOT EXISTS` guards so both existing Neon DBs and fresh DBs converge cleanly, and quarantine destructive `DELETE` scripts in `scripts/`.
- Test to add: CI/integration gate that runs `drizzle-kit migrate` on an empty local Postgres container and asserts zero table/column/enum/index drift against `db/schema/*`.
- Effort: S (<2h)
- Confidence: High
- Needs owner decision: no

### W0-003 — `npm test` mutates live Neon production database when `.env` is present
- Severity: P0
- Category: reliability
- Where: `tests/whatsapp-linked-device-and-groups.test.ts:352,360`, `tests/whatsapp-multi-number-system.test.ts:65,114,138,253,268`, `tests/trigger-v4-webhook-and-realtime-copilot.test.ts:379,432`, `db/index.ts:1,16`
- Brief claim contradicted (if any): 429 automated tests provide safe, deterministic regression verification.
- Evidence: When `.env` is isolated (`DATABASE_URL` + `DATABASE_URL_POOLED` set to `127.0.0.1:54329`), `npm test` fails 7 of 429 tests because 6 tests perform unmocked `INSERT`/`UPDATE`/`DELETE` SQL on `whatsapp_linked_device_sessions` and `whatsapp_accounts` (including upserting `phone_number_id = 'linked-default'` and `'linked-line_2'`), and 1 test (`trigger-v4-webhook-and-realtime-copilot.test.ts:432`) asserts live `social_integrations` state (`expected 'postiz', got 'local_queue'`). Worse, `db/index.ts:1` imports `"dotenv/config"` and checks `DATABASE_URL_POOLED` first, silently routing `npm test` to live Neon whenever `.env` exists.
- Impact (business terms): Running `npm test` locally or in CI with prod env vars mutates live `whatsapp_accounts` and `whatsapp_linked_device_sessions` rows in production and deletes matching `whatsapp_conversations` rows.
- Root cause: Database-mutating integration tests were mixed into unit test files without `assertAuditSafeEnvironment()` or a local PostgreSQL driver, and `trigger-v4` AC-7 relied on ambient Neon OAuth state.
- Recommended fix: Call `assertAuditSafeEnvironment()` in test bootstrap, separate DB integration tests under `tests/integration/` running against `alramlah-audit-pg` (with seeded test fixtures for `social_integrations`), and keep `npm test` strictly offline/hermetic.
- Test to add: Guard test verifying `npm test` passes 100% offline with `.env.audit` and throws immediately if `DATABASE_URL*` targets `neon.tech`.
- Effort: M (<1d)
- Confidence: High
- Needs owner decision: no

### W0-004 — Hardcoded `neon-http` driver and missing `pg` driver break local Postgres migrations, seeds, and self-hosted Postgres
- Severity: P1
- Category: infra
- Where: `db/index.ts:11-31`, `drizzle.config.ts:1-11`, `package.json:22-77`
- Brief claim contradicted (if any): Portable PostgreSQL + Docker standalone support alongside Neon.
- Evidence: Raw `npx drizzle-kit migrate` exits `1` (`Warning '@neondatabase/serverless' can only connect to remote Neon/Vercel Postgres/Supabase instances through a websocket`), and raw `npx tsx db/seed.ts` exits `1` (`TypeError: Failed to parse URL from https://api.0.0.1/sql`). `node_modules/pg` is `False`.
- Impact (business terms): Developers, CI pipelines, and self-hosted Docker deployments cannot run `npm run db:migrate`, `npm run db:seed`, or app queries against standard TCP PostgreSQL (local Docker, RDS, or VPS Postgres), forcing dangerous reliance on shared cloud Neon instances. Also note `neon-http` limitations on interactive multi-statement transactions (`SWARM_PROMPT` §5.2).
- Root cause: `db/index.ts` unconditionally uses `drizzle-orm/neon-http` (`neon()`) and `package.json` omits `pg` / `@types/pg`.
- Recommended fix: Install `pg` + `@types/pg` so `drizzle-kit migrate` works natively over TCP, and select `drizzle-orm/node-postgres` (`Pool`) when `DATABASE_URL` targets localhost / standard TCP Postgres (or `DATABASE_DRIVER=pg`), keeping Neon serverless/pooled driver for `*.neon.tech`.
- Test to add: Integration test executing `npm run db:migrate` and `npm run db:seed` natively against `alramlah-audit-pg` with exit code `0`.
- Effort: S (<2h)
- Confidence: High
- Needs owner decision: no

### W0-005 — `web/Dockerfile` uses End-of-Life `node:20-alpine` base image
- Severity: P1
- Category: security
- Where: `Dockerfile:7`, `package.json:63`
- Brief claim contradicted (if any): Production-ready multi-stage Docker deployment.
- Evidence: `Dockerfile:7` sets `FROM node:20-alpine AS base`. Node.js 20 reached official End-of-Life on `2026-04-30` (>6 months unpatched as of Nov 2026), while developer machines run `v24.22.1`.
- Impact (business terms): Containerized deployments (VPS/Oracle/Docker) run an unmaintained Node runtime receiving zero security patches for TLS/OpenSSL, HTTP parser, or `undici` `fetch` vulnerabilities, and diverge by 4 major versions from dev (`v24` vs `v20`).
- Root cause: `Dockerfile` was pinned to `node:20-alpine` prior to Node 20 EOL and never updated; `package.json` lacks `"engines"`.
- Recommended fix: Upgrade `Dockerfile:7` to `FROM node:22-alpine AS base` or `FROM node:24-alpine AS base`, update `@types/node` accordingly, and add `"engines": { "node": ">=22.0.0" }` in `package.json`.
- Test to add: `docker build` smoke check verifying `node -v` inside the built runner image is a supported active/maintenance LTS (`>=22`).
- Effort: S (<2h)
- Confidence: High
- Needs owner decision: no

### W0-006 — Critical Next.js 16.3.4 RCE/SSRF/Cache-Poisoning CVEs and `shadcn` CLI shipped in prod `dependencies`
- Severity: P0
- Category: security
- Where: `package.json:47,55,71`, `next.config.ts:21-27,33-36`
- Brief claim contradicted (if any): Hardened Next.js 16 production runtime.
- Evidence: `npm audit --omit=dev` exits `1` with **9 production vulnerabilities (`1 critical, 2 high, 4 moderate, 2 low`)**, including **3 unauthenticated Critical RCE advisories in `next@16.3.4`** (`GHSA-vcvr-r3jv-pc5j`, `GHSA-2464-fhr4-w9xw`, `GHSA-673q-mjm6-r5xr`), Image Optimization SSRF (`GHSA-cjq9-62q9-8jv4` — amplified by `hostname: "**"` in `next.config.ts:35`!), Server Actions DoS (`GHSA-p3m5-59mp-jv5r` — alongside wildcard `*.ngrok-free.app` / `*.trycloudflare.com` in `allowedOrigins` at `next.config.ts:21-27`), and SSG/ISR cache poisoning (`GHSA-mcj8-r9mp-w47p`, `GHSA-4jqv-mc3x-m676`). In addition, `shadcn@^4.21.0` is listed in `dependencies` instead of `devDependencies`, pulling vulnerable `deepmerge` (`GHSA-gcqx-w48m-w2h4`) and `minimatch` (`GHSA-g3hv-75wg-m249`) into prod.
- Impact (business terms): Unauthenticated remote code execution, SSRF into cloud metadata/internal Gotenberg endpoints, cross-user cache poisoning, and bloated production attack surface.
- Root cause: `next` pinned at `16.3.4` without security patch bumps (`16.4.6+`), permissive dev wildcards left in `next.config.ts`, and `shadcn` CLI installed without `--save-dev`.
- Recommended fix: Upgrade `next` and `eslint-config-next` to `16.4.6+`, move `shadcn` to `devDependencies`, restrict `images.remotePatterns` to explicit R2/CDN hosts (removing `hostname: "**"`), and gate tunnel wildcards in `serverActions.allowedOrigins` behind `process.env.NODE_ENV !== "production"`.
- Test to add: CI check asserting `npm audit --omit=dev --audit-level=high` exits `0` and unit check verifying `nextConfig` omits `hostname: "**"` and dev tunnel origins when `NODE_ENV=production`.
- Effort: S (<2h)
- Confidence: High
- Needs owner decision: no

### W0-007 — `db/seed.ts` creates `super_admin` and `staff` accounts with hardcoded weak passwords in any environment
- Severity: P0
- Category: security
- Where: `db/seed.ts:20-95` (`Admin@123456`, `Staff@123456`)
- Brief claim contradicted (if any): Role-based admin security (`super_admin` / `staff`) protecting PII, WABA tokens, and quotes.
- Evidence: `db/seed.ts:29` sets `Admin@123456` for `admin@alramlahtravels.com` (`super_admin`) and `db/seed.ts:67` sets `Staff@123456` for `staff@alramlahtravels.com` (`staff`) via `auth.api.signUpEmail`, with zero `NODE_ENV === "production"` guard or env-supplied bootstrap secret requirement.
- Impact (business terms): If `db:seed` is run during production onboarding (as standard setup instructions imply) and passwords are not immediately rotated, anyone can log into `/admin/login` as `super_admin`, exfiltrate pilgrim passport/phone PII, read decrypted WABA/OAuth tokens, or send WhatsApp broadcasts.
- Root cause: Development convenience credentials were hardcoded directly in the shared catalog seed script without separating catalog reference data from user bootstrap.
- Recommended fix: Refuse creating default password accounts when `NODE_ENV === "production"` unless explicit high-entropy `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars are provided (or split catalog seeding from dev-only user seeding).
- Test to add: Unit/integration test verifying `seed()` refuses hardcoded `Admin@123456` when `NODE_ENV === "production"`.
- Effort: S (<2h)
- Confidence: High
- Needs owner decision: no
