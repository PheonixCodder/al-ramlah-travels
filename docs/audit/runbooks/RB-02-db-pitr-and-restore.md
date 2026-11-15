# RB-02 — Neon PostgreSQL 7-Day PITR Restore, Logical Backups & Forward Migration SOP

**Owner**: Database & Platform Operations (`super_admin`)  
**Target Tier (`OD-07`)**: Neon Launch Serverless PostgreSQL (**7-day Point-in-Time Recovery** retention window)  
**Driver Architecture (`db/index.ts`)**: `@neondatabase/serverless` WebSocket `Pool` (`drizzle-orm/neon-serverless`) in production (`*.neon.tech`) with real `BEGIN ... COMMIT` `withTransaction()` support; `pg.Pool` (`drizzle-orm/node-postgres`) on local/CI TCP Postgres.

> [!CAUTION]
> **STRICT PRODUCTION RULE**: **NEVER** run `npm run db:push` (`drizzle-kit push`) against staging or production databases. All schema changes must flow exclusively through reviewed, forward-only SQL migrations in `drizzle/` applied via `npm run db:migrate`.

---

## 1. Pre-Change Logical Backup (`npm run db:backup`)

Before running any production migration, key rotation, or bulk data remediation, capture an off-Neon logical backup using `scripts/db-backup.ts` (protected by `scripts/_guard.ts`, which blocks accidental remote execution without `--confirm-env=<hostname>` and passes `PGPASSWORD` via child process environment rather than CLI flags):

```bash
# Run from web/ with PostgreSQL client tools (pg_dump v16+) installed:
DATABASE_URL_DIRECT="postgresql://<user>:<pass>@<ep-unpooled-host>.neon.tech/<dbname>?sslmode=require" \
  npx tsx scripts/db-backup.ts --strict --confirm-env=<ep-unpooled-host>.neon.tech
```

### Verify the Generated Custom-Format Archive (`pg_restore --list`)
```bash
ls -lh backups/alramlah-backup-*.dump
pg_restore --list backups/alramlah-backup-<TIMESTAMP>.dump | head -n 40
```

Confirm the TOC lists core tables (`applications`, `application_quotes`, `application_payments`, `audit_logs`, `visa_rates`, `group_packages`, `group_departures`, `whatsapp_conversations`, `whatsapp_messages`, `social_integrations`). Encrypt off-site archives (`age` or AES-256-GCM) before uploading to long-term cold storage, and delete local `.dump` files once archived.

---

## 2. Neon Launch 7-Day Point-in-Time Recovery (PITR) Branch Restore Drill

Neon Launch retains continuous write-ahead log (WAL) history for **7 days**, allowing instant, non-destructive point-in-time branching to the exact second before an incident.

### Step 1 — Create an Isolated Recovery Branch at Target Timestamp
Determine the exact UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`) immediately preceding the incident (cross-referencing `audit_logs.created_at` from **RB-01 §4**):

```bash
# Using Neon CLI (or Neon Console -> Branches -> Create Branch -> Point in time):
neonctl branches create \
  --project-id "<NEON_PROJECT_ID>" \
  --parent main \
  --timestamp "2026-11-15T07:59:50Z" \
  --name "pitr-recovery-20261115"
```

### Step 2 — Run Read-Only Integrity Verification Against the Recovery Branch
Obtain the pooled and unpooled connection strings for `pitr-recovery-20261115` and run the mandatory post-restore verification queries in **Section 4** below **before** cutting traffic over.

### Step 3 — Promote or Cut Over Application Traffic
- **Option A — Surgical Data Repair (Preferred for isolated table/row loss)**: Export the affected rows from `pitr-recovery-20261115` via `pg_dump --table=<name> --data-only` and restore them transactionally into `main` so zero recent bookings/webhooks arriving after the incident timestamp are lost.
- **Option B — Full Branch Cutover (Catastrophic corruption)**:
  1. Put Meta WABA retries on hold (Meta automatically buffers and retries `5xx` webhook deliveries with exponential backoff for up to 7 days).
  2. Update `DATABASE_URL`, `DATABASE_URL_POOLED`, and `DATABASE_URL_UNPOOLED` in **both** Vercel Pro and Trigger.dev Cloud to the `pitr-recovery-20261115` endpoints (or use Neon Console **Set as Primary**).
  3. Trigger a Vercel redeployment and `npm run trigger:deploy`, then verify `GET /api/health?deep=1` returns `200 OK`.

---

## 3. Safe Forward-Migration SOP (`npm run db:migrate`)

1. **Author & Generate Locally**: Edit `db/schema/*.ts` and run `npm run db:generate` (`drizzle-kit generate`). Inspect the generated SQL in `drizzle/NNNN_*.sql` and `drizzle/meta/_journal.json`.
2. **Expand-Then-Contract Check**: Verify the SQL contains zero destructive column drops or incompatible type rewrites still referenced by the currently running Vercel/Trigger workers (see **RB-10 §2**).
3. **Test on Hermetic CI / Disposable Postgres**: Confirm Gate 4 (`npm run db:migrate`), Gate 5 (`2x npm run db:seed`), and `tests/integration/db-migrations-and-seed.test.ts` pass on `postgres:16-alpine`.
4. **Backup Production**: Run `scripts/db-backup.ts --strict` (**Section 1**).
5. **Apply Against Unpooled Endpoint**: Always run DDL migrations over `DATABASE_URL_UNPOOLED` (direct Neon connection, bypassing PgBouncer transaction pooling):
   ```bash
   DATABASE_URL_UNPOOLED="postgresql://<user>:<pass>@<ep-unpooled-host>.neon.tech/<dbname>?sslmode=require" \
     npx tsx db/migrate.ts --confirm-env=<ep-unpooled-host>.neon.tech
   ```

> [!WARNING]
> Only run `db/seed.ts` on initial empty-database bootstrap (requiring `ADMIN_BOOTSTRAP_PASSWORD` >= 12 chars in `NODE_ENV=production`). Although `db/seed.ts` uses `excluded.*` idempotent upserts (`T-007`), production catalog rates edited by `super_admin` in `/admin/catalog` should not be overwritten by baseline seed defaults.

---

## 4. Mandatory Post-Restore & Post-Migration Verification SQL

Run all 5 checks via `psql "${DATABASE_URL_UNPOOLED}"` and confirm zero anomalies:

```sql
-- 1. Confirm all 48 public schema base tables & Drizzle journal exist
SELECT COUNT(*) AS public_table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 48

-- 2. Verify short_term vs long_term visa_rates integrity (W0-001 / T-007 regression check)
SELECT tier, max_days, price_pkr, price_sar, without_masar_price_sar, with_masar_28_days_sar
FROM visa_rates
ORDER BY tier ASC;
-- Expected baseline (unless updated by super_admin):
--   long_term  | max_days = 90 | price_pkr >= 68000 (must NEVER equal short_term!)
--   short_term | max_days = 30 | price_pkr >= 42500

-- 3. Verify group_departures.booked_seats matches approved passenger bed_and_seat_count (OD-09d)
SELECT
  gd.id,
  gd.batch_code,
  gd.total_seats,
  gd.booked_seats,
  COALESCE(SUM(a.bed_and_seat_count) FILTER (WHERE a.status = 'approved'), 0) AS expected_approved_seats
FROM group_departures gd
LEFT JOIN applications a ON a.group_departure_id = gd.id
GROUP BY gd.id, gd.batch_code, gd.total_seats, gd.booked_seats
HAVING gd.booked_seats < 0
    OR gd.booked_seats > gd.total_seats
    OR gd.booked_seats <> COALESCE(SUM(a.bed_and_seat_count) FILTER (WHERE a.status = 'approved'), 0);
-- Expected: 0 rows

-- 4. Verify application_payments ledger reconciles with application_quotes.amount_paid_pkr (OD-03)
SELECT
  aq.id AS quote_id,
  aq.application_id,
  aq.amount_paid_pkr,
  COALESCE(SUM(ap.amount_pkr) FILTER (WHERE ap.verified_at IS NOT NULL), 0) AS verified_ledger_sum_pkr
FROM application_quotes aq
LEFT JOIN application_payments ap ON ap.quote_id = aq.id
GROUP BY aq.id, aq.application_id, aq.amount_paid_pkr
HAVING aq.amount_paid_pkr < 0;
-- Expected: 0 rows

-- 5. Confirm audit_logs immutability trigger is active
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'audit_logs'::regclass
  AND tgname = 'trg_audit_logs_immutable';
-- Expected: 1 row (trg_audit_logs_immutable | O)
```

---

## 5. Monthly Restore Drill Cadence

On the **1st Monday of every month** (and 14 days prior to Ramadan and Hajj peak windows):
1. Create a Neon PITR branch from 24 hours prior and restore the latest `alramlah-backup-*.dump` into a disposable local `postgres:16-alpine` container (`pg_restore --no-owner --no-acl -d drill_db`).
2. Execute all 5 SQL queries in **Section 4** and record the RTO (target `< 15 minutes`) and RPO (`< 1 minute` via Neon WAL) in `audit_logs` / ops log.
3. Delete the temporary PITR branch in Neon Console so branch storage compute is not billed.
