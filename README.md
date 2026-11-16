# Al Ramlah Travels (`سفريات الرملة`) — Haramain Pilgrim Commerce, Omnichannel CRM & SEO/GEO Platform

Production-certified Next.js `16.4.6` App Router platform for **Al Ramlah Travels** (`سفريات الرملة`), headquartered at **Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan** (`+92 327 4029701` · `+92 319 0462638` · `https://alramlahtravels.com`).

---

## Release Certifications & Operational Runbooks

- **Executive & Technical Final Report**: [`docs/audit/FINAL_REPORT.md`](docs/audit/FINAL_REPORT.md)
- **Gate A — Production Readiness Certification (`Spec 0024` · `GA-01`–`GA-08` `8/8 PASS`)**: [`docs/audit/PRODUCTION_READINESS.md`](docs/audit/PRODUCTION_READINESS.md) · [`docs/audit/04-verification.md`](docs/audit/04-verification.md)
- **Gate B — Public Site SEO, GEO & Attribution Certification (`Spec 0025` · `GB-01`–`GB-08` `8/8 PASS` · `90.2/100` Grade `A`)**: [`docs/audit/SEO_READINESS.md`](docs/audit/SEO_READINESS.md) · [`docs/audit/seo/04-seo-verification.md`](docs/audit/seo/04-seo-verification.md)
- **Architecture & Platform Master Brief**: [`docs/PLATFORM_MASTER_BRIEF.md`](docs/PLATFORM_MASTER_BRIEF.md)
- **Owner Architectural Decisions (`OD-01`–`OD-11`)**: [`docs/audit/OWNER_DECISIONS.md`](docs/audit/OWNER_DECISIONS.md)
- **10 Operational Production Runbooks (`RB-01`–`RB-10`)**:
  1. [`RB-01-incident-response.md`](docs/audit/runbooks/RB-01-incident-response.md) — Severity Matrix (`SEV-1`..`SEV-4`) & `/api/health?deep=1` Diagnostics
  2. [`RB-02-db-pitr-and-restore.md`](docs/audit/runbooks/RB-02-db-pitr-and-restore.md) — Neon 7-Day PITR & AES-256-GCM Backup/Restore Drill (`npm run db:backup`)
  3. [`RB-03-key-and-token-rotation.md`](docs/audit/runbooks/RB-03-key-and-token-rotation.md) — Zero-Downtime `v2:` HKDF-AES-256-GCM Keyring Rotation (`ENCRYPTION_KEY_PREVIOUS`)
  4. [`RB-04-whatsapp-waba-and-webhook-recovery.md`](docs/audit/runbooks/RB-04-whatsapp-waba-and-webhook-recovery.md) — Meta WhatsApp Cloud API v21.0, Outbox Recovery & `OD-01` Queue Ops
  5. [`RB-05-social-oauth-and-quota-ops.md`](docs/audit/runbooks/RB-05-social-oauth-and-quota-ops.md) — Core 5 Social OAuth, YouTube Quota & `OD-11` (`TIKTOK_DIRECT_POST_APPROVED` / `GBP_API_APPROVED`) Activation
  6. [`RB-06-oracle-gotenberg-vm-recovery.md`](docs/audit/runbooks/RB-06-oracle-gotenberg-vm-recovery.md) — Oracle Cloud PAYG Always Free ARM64 Gotenberg `v8.17.0` Operations
  7. [`RB-07-trigger-dev-worker-and-cron-ops.md`](docs/audit/runbooks/RB-07-trigger-dev-worker-and-cron-ops.md) — Trigger.dev Cloud v4 Workers, 9 Bounded Queues & 5 PKT Crons
  8. [`RB-08-dsar-and-pii-retention-purge.md`](docs/audit/runbooks/RB-08-dsar-and-pii-retention-purge.md) — `OD-06` Pilgrim DSAR Erasure & 60d/24m/90d Retention Purge (6y FBR Carve-Out)
  9. [`RB-09-peak-ramadan-and-hajj-scaling.md`](docs/audit/runbooks/RB-09-peak-ramadan-and-hajj-scaling.md) — Peak Ramadan & Hajj Season Capacity & Pool Scaling
  10. [`RB-10-deployment-rollback-and-ci-triage.md`](docs/audit/runbooks/RB-10-deployment-rollback-and-ci-triage.md) — Zero-Downtime Cutover, Drizzle Migrations & `<60s` Rollback

---

## Stack & Architecture Overview

- **Runtime & Framework**: Node.js `22+` LTS, TypeScript `5`, Next.js `16.4.6` (App Router, `output: "standalone"`), React `19.2.8`
- **Database & ORM**: PostgreSQL `16` (`48` tables, `47` enums, `17` SQL `CHECK` constraints, `1` append-only `audit_logs` immutability trigger — dual `neon-http` + transactional `Pool` driver via `@neondatabase/serverless` in production and `pg` TCP Pool in local Docker/CI), Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Authentication, Security & RBAC**: Better Auth (`better-auth`) with disabled public sign-up (`403`), live DB `isActive` session revocation, `super_admin` vs `staff` role guards across `194` `"use server"` exports, PostgreSQL `rate_limit_buckets`, `v2:` HKDF-AES-256-GCM secret vault, and PII-redacted structured logging
- **Public Storefront, Hub-and-Spoke SEO & Attribution**:
  - **Locked Haramain Luxury Light Palette** (`#0A3622` Deep Emerald · `#FAF7F0` Warm Ivory · `#C5A059` Metallic Gold · WCAG 2.2 AA `--gold-text` `#7A5C1E`) built on `@base-ui/react` (`shadcn` `base-nova`, `render` prop composition)
  - **19 Indexable Public Route Patterns** (`/`, `/umrah-packages`, `/umrah-packages/[slug]`, `/umrah-packages/from-{lahore,karachi,islamabad}`, `/hajj-2027`, `/umrah-visa`, `/hotels/{makkah,madinah}`, `/ziyarat`, `/ziyarat/{makkah,madinah}`, `/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/refund-policy`) + `app/robots.ts`, `app/sitemap.ts`, `public/llms.txt`, `1200×630` `next/og` cards, XSS-safe penalty-free JSON-LD, and signed QR `/voucher/[token]`
  - **7-Column First-Touch Attribution** (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `landing_page`, `http_referrer`) captured via `<UtmTracker />` into `applications` and `contact_messages`, surfaced in Admin Dossiers/Messages, and exported formula-safely via CSV
- **Storage, PDF, Email & Durable Workers**:
  - **Cloudflare R2** (`@aws-sdk/client-s3`): Public CDN prefixes (`posters/`, `cms/`, `hotels/`) isolated from private PII prefixes (`passports/`, `whatsapp-media/`, `quotes/`, `receipts/`, `flyers/`) served via authenticated/HMAC `/api/media/[...key]`
  - **Gotenberg `v8.17.0`** (`$0/mo` Oracle Cloud PAYG Always Free ARM64 VM): Escaped `<65 KB` HTML-to-PDF 3-page Luxury Quotations & Ultra-HD `3240×4560` / `1080×1520` Sharp social posters
  - **Resend** (`OD-02`): Escaped HTML transactional quotation & password-reset emails
  - **Trigger.dev Cloud `v4`** (`@trigger.dev/sdk`): `8` `schemaTask` workers + `5` PKT crons across `9` bounded concurrency queues
- **WhatsApp CRM & Core 5 Social Scheduler**:
  - **Meta WhatsApp Cloud API `v21.0` (`OD-01`)**: `<150ms` constant-time HMAC webhook + atomic outbox, 3-Priority Auto-Responder (`ART-...` Package Bot, Guided 3-Step Umrah Intake, Keyword Rules, PKT Greetings), global `"STOP"`/`"RUKO"` `do_not_contact` enforcement, `>24h` template gate, and Ban-Safe Manual Assisted WA Group/Status Copy-Pack Queue (sunset server-side `@whiskeysockets/baileys` sockets)
  - **Core 5 Social Scheduler (`OD-11`)**: Native OAuth & publishing for Instagram, Facebook Pages, YouTube, Google Business Profile v1 (`GBP_API_APPROVED`), and TikTok Content Posting v2 (`TIKTOK_DIRECT_POST_APPROVED`) with honest live-only analytics

---

## Quickstart (Disposable Local PostgreSQL 16)

1. Copy `.env.example` to `.env.local` (or `.env.audit` for hermetic test runs) and populate local values:
   ```bash
   cp .env.example .env.local
   ```
2. Start a disposable PostgreSQL 16 container:
   ```bash
   docker run -d --name alramlah-audit-pg \
     -p 127.0.0.1:54329:5432 \
     -e POSTGRES_USER=audit \
     -e POSTGRES_PASSWORD=audit_local_only \
     -e POSTGRES_DB=alramlah_audit \
     postgres:16-alpine
   ```
3. Install dependencies, apply all 4 forward Drizzle SQL migrations, and run the idempotent seed:
   ```bash
   npm ci
   npm run db:migrate
   ADMIN_BOOTSTRAP_PASSWORD="YourStrongBootstrapPassword123!" npm run db:seed
   ```
4. Launch the development server and Trigger.dev worker:
   ```bash
   npm run dev
   npm run trigger:dev
   ```

---

## Developer & Release Verification Commands

```bash
# 1. Production dependency CVE gate (0 critical, 0 high)
npm audit --omit=dev --audit-level=high

# 2. Next.js 16 route type generation & strict TypeScript checks (app + E2E)
npx next typegen && npm run typecheck && npx tsc --noEmit -p tests/e2e/tsconfig.json

# 3. ESLint static analysis (0 errors)
npm run lint

# 4. Hermetic unit, domain property (13,825 cases), SEO & real-PG integration suites (731 tests)
npm test

# 5. Standalone production build (56 static/ISR units + .next/standalone/server.js)
npm run build

# 6. Full-stack Playwright E2E + unexcluded @axe-core/playwright WCAG 2.2 AA (J1–J23, 26 specs)
npm run test:e2e

# Database & Worker Utilities
npm run db:generate      # Generate Drizzle SQL migrations from db/schema/*
npm run db:migrate       # Apply forward SQL migrations (db/migrate.ts)
npm run db:seed          # Idempotent catalog, rolling PKT departures & FAQ seed
npm run db:backup        # Encrypted PostgreSQL logical backup (RB-02)
npm run trigger:deploy   # Deploy Trigger.dev Cloud v4 workers
```
