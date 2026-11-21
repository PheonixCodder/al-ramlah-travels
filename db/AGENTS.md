# Database, Schema & Seed (`db`)

## Overview

Dual-driver PostgreSQL 16 data layer (`db/index.ts`), Drizzle ORM definitions (`48` `pgTable` tables, `47` `pgEnum` enums, `17` SQL `check()` constraints across `db/schema/`), ordered SQL migrations (`drizzle/`), idempotent bootstrap seeding (`seed.ts`), and hermetic audit DB guards.

## Key files

| File | Owns |
|---|---|
| [index.ts](./index.ts) | `db`, `createDatabaseClient()`, `isNeonServerlessUrl()`, `withTransaction()` |
| [migrate.ts](./migrate.ts) & [seed.ts](./seed.ts) | Dual-driver migration runner & idempotent initial data bootstrap |
| [schema/index.ts](./schema/index.ts) | Barrel exporting all 10 schema modules (`48` tables, `47` enums, `17` checks) |
| [schema/applications.ts](./schema/applications.ts) | `applications`, hotel stays, transport segments, `application_quotes`, `application_payments` |
| [schema/audit-logs.ts](./schema/audit-logs.ts) | Immutable `audit_logs` & Postgres-backed `rate_limit_buckets` |
| [schema/packages.ts](./schema/packages.ts) | `group_packages`, `group_departures`, `hajj_packages` |
| [0002_production_hardening_foundation.sql](../drizzle/0002_production_hardening_foundation.sql) | `trg_audit_logs_immutable` trigger, `deposit_paid`, `revision_requested`, `17` checks |
| [0003_seo_lead_attribution.sql](../drizzle/0003_seo_lead_attribution.sql) | 7 first-touch UTM/landing/referrer attribution columns on leads & messages |
| [_guard.ts](../scripts/_guard.ts) & [audit-guard.ts](../tests/helpers/audit-guard.ts) | Host allowlist blocking live `neon.tech` during seeds, scripts & tests |

## Commands (run inside `web/`)

```bash
npm run db:generate   # Generate Drizzle SQL migrations from db/schema/*
npm run db:migrate    # Apply pending migrations to guarded DB target
npm run db:seed       # Run idempotent seed (requires .env.audit or local target)
npm run db:backup     # Logical backup helper
```

## Conventions

- **Dual-Driver Transactions ([index.ts](./index.ts))**: `isNeonServerlessUrl()` routes `.neon.tech` URLs to `@neondatabase/serverless` (`NeonPool` + `ws`) and local/Docker/CI URLs to `pg.Pool` (`node-postgres`). Use `withTransaction(fn)` for real SQL `BEGIN ... COMMIT / ROLLBACK` across both drivers; verify Drizzle APIs against [services/drizzle-orm](../../services/drizzle-orm/).
- **Atomic Group Seat Holds (`T-022`)**: Confirming a group departure on `approved` status (`actions/quotes.ts`, `actions/groups.ts`) must lock `group_departures` via `SELECT ... FOR UPDATE` inside `withTransaction()` and check `bookedSeats + (adults + children) <= totalSeats` (`Infants` occupy `0` beds/seats).
- **Append-Only Financial & Audit Logs**: `application_payments` (`OD-03`) enforces `onDelete: "restrict"` on `applicationId` and `quoteId` plus `amountPkr > 0` to gate `/voucher/[token]` (`OD-04`). `trg_audit_logs_immutable` raises SQLSTATE `55000` on any `UPDATE`/`DELETE` against `audit_logs`.

## Gotchas

- **Hermetic Audit DB Safety**: NEVER point `npm test`, `npm run test:e2e`, `db:migrate`, or `db:seed` at `web/.env` (`neon.tech`). [tests/helpers/audit-guard.ts](../tests/helpers/audit-guard.ts) (`assertAuditSafeEnvironment()`) and [scripts/_guard.ts](../scripts/_guard.ts) (`resolveGuardedScriptDatabaseUrl()`) hard-abort on non-loopback or `.neon.tech` URLs; always target `.env.audit` (`127.0.0.1:54329/alramlah_audit`).
- **Idempotent Seed Discipline**: Re-running `npm run db:seed` twice back-to-back must produce zero constraint failures or duplicate rows (`ibanVerified: false`, `mustChangePassword: true` on seeded admin; production requires `ADMIN_BOOTSTRAP_PASSWORD >= 12` chars).
- **Attribution & Public Projection Parity**: Adding wholesale SAR columns to catalog/package schemas requires updating [public-queries.ts](../lib/seo/public-queries.ts) so public DTOs never serialize supplier net SAR rates.

## Related specs

- [Spec 0002 — Data Model](../docs/specs/0002-data-model.md)
- [Spec 0024 — Production Readiness Audit & Hardening](../docs/specs/0024-production-readiness-audit-and-hardening.md)
- [Spec 0025 — Public Site SEO Readiness](../docs/specs/0025-public-site-seo-readiness.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
