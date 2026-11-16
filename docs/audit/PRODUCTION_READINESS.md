# PRODUCTION READINESS CERTIFICATION — GATE A (`Spec 0024`)

- **Platform**: **Al Ramlah Travels (`سفريات الرملة`)** — Next.js `16.4.6` · React `19.2.8` · TypeScript `5` · Drizzle ORM + Neon Serverless PostgreSQL `16` · Better Auth · Trigger.dev Cloud `v4` · Cloudflare R2 · Oracle Cloud Always Free ARM64 Gotenberg `v8.17.0`
- **Branch Certified**: `audit/production-hardening`
- **Wave 3 Baseline Commit**: `fd1cea5` (`W3A → W3B1 → W3B2 → W3C` — `97/97` Canonical `T-ID`s & `383/383` Raw Findings Remediated)
- **Wave 4 Verification & Surgical Closure Commit**: `c0488f4` (`V01`–`V05` independent adversarial reports + `v06` closure of `T-061` `P2` residual, `V01-NEW-01` proxy IP guard, and `E2E-J1` cold-boot hydration stabilization)
- **Certification Date**: `2026-11-15`
- **Gate A Verdict**: **`PASS — CERTIFIED PRODUCTION-READY (PHASE B SPEC 0025 UNLOCKED)`**
- **Companion Evidence Artifacts**:
  - Wave 4 Consolidated Verification Report: [04-verification.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/04-verification.md)
  - Independent Domain Verifier Reports: [V01.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/verification/V01.md) · [V02.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/verification/V02.md) · [V03.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/verification/V03.md) · [V04.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/verification/V04.md) · [V05.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/verification/V05.md)
  - Wave 3–4 Remediation Ledger: [03-fix-log.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/03-fix-log.md)
  - Master Deduplicated Triage Backlog: [02-triage.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/02-triage.md)
  - Executive Owner Decisions: [OWNER_DECISIONS.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/OWNER_DECISIONS.md)
  - Architecture & Remediation Specification: [0024-production-readiness-audit-and-hardening.md](file:///c:/dev/al-ramlah-travels/web/docs/specs/0024-production-readiness-audit-and-hardening.md)

---

## 1. Gate A Acceptance Criteria Checklist (`GA-01`–`GA-08`)

Per [0024-production-readiness-audit-and-hardening.md](file:///c:/dev/al-ramlah-travels/web/docs/specs/0024-production-readiness-audit-and-hardening.md#L147-L159) §5 and [SWARM_PROMPT.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/SWARM_PROMPT.md#L206-L211) §9.4, every Gate A criterion has been independently verified against real disposable PostgreSQL 16 (`127.0.0.1:54329`), contract-faithful HTTP fakes (`127.0.0.1:3998`), and the production standalone Next.js `16.4.6` server (`127.0.0.1:3123`):

| Gate ID | Acceptance Criterion | Status | Reproducible Empirical Evidence & Commit SHAs |
| :---: | :--- | :---: | :--- |
| **`GA-01`** | **Zero Open `P0` / `P1` Findings** (`100%` of `96` raw `P0` and `179` raw `P1` findings resolved, regression-tested, and closed; `0` open `P2`) | **`PASS`** | **`383 / 383` raw findings** (`96 P0 | 179 P1 | 95 P2 | 13 P3`) and **`97 / 97` Canonical `T-ID`s** (`40 P0 | 38 P1 | 15 P2 | 4 P3`) verified closed across `V01`–`V05` + `v06` (`c0488f4`). Open `P0 = 0`, Open `P1 = 0`, Open `P2 = 0` ([04-verification.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/04-verification.md) §1 & §4). |
| **`GA-02`** | **Clean Static, Dependency & Bundle Hygiene** (`typecheck`, `lint`, `build` exit `0`; `npm audit --omit=dev` has `0` Critical/High CVEs; `.nft.json` has `0` `.env*` & `0` `public/uploads/**` leaks; `0` client PII in working tree) | **`PASS`** | • `npm audit --omit=dev --audit-level=high` → `exit 0` (`0` critical, `0` high; `next@16.4.6`; `@whiskeysockets/baileys` removed in `e95a30f`).<br>• `npx next typegen && npm run typecheck && npx tsc --noEmit -p tests/e2e/tsconfig.json` → `exit 0` (`0` errors).<br>• `npm run lint` → `exit 0` (`0` errors).<br>• `npm run build` → `exit 0` (`32/32` static units, `.next/standalone/server.js` generated; `43/43` `.nft.json` manifests verified with `env-leaks: 0` & `upload-leaks: 0`).<br>• `public/uploads/sample-posts/zahoor-adil-rafi-quotation.pdf` deleted (`9344ddf`); `0` tracked files in `public/uploads`. |
| **`GA-03`** | **Zero-Drift Migrations & `2×` Idempotent Seed** (Fresh `db:migrate` on empty PG16 creates `100%` of schema with `0` drift; `2×` `db:seed` preserves `long_term` = `90d / PKR 68,000` & deactivated staff) | **`PASS`** | • Fresh `drizzle-kit migrate` (`3` SQL migrations, `2d3e427`) on blank `alramlah_v02_verify` & `alramlah_audit_migtest` created **`48 / 48` tables**, **`815 / 815` columns**, **`47 / 47` enums**, **`175` indexes**, **`69` FKs**, **`17` `CHECK` constraints**, and **`1` immutability trigger** (`trg_audit_logs_immutable`) with **`0` drift** ([V02.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/verification/V02.md) §2.1).<br>• Back-to-back `tsx db/seed.ts` Run #1 = **`222` rows**, Run #2 = **`222` rows** (`0` delta); `long_term` = `90d / 750 SAR / PKR 68,000` preserved; deactivated `staff` stayed `is_active = false`; weak prod passwords rejected (`tests/integration/db-migrations-and-seed.test.ts` `3/3` PASS). |
| **`GA-04`** | **100% AuthN/AuthZ & RBAC Enforcement** (Public sign-up disabled `403`; `100%` of `194` `"use server"` exports & API routes enforce AuthZ + Zod; deactivated staff revoked on next request; Status Tracker anti-enumeration) | **`PASS`** | • `disableSignUp: true` + `POST /api/auth/sign-up/*` `403` (`342eaef`).<br>• All `194` exports across `12` `"use server"` modules audited (`66` `requireSuperAdmin()`, `117` `requireAdmin()`, `10` rate-limited public actions, `1` stateless regex helper; `0` unauthenticated admin actions — [V01.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/verification/V01.md) §4.1 & `tests/integration/server-actions-authz.test.ts` `4/4` PASS).<br>• `lookupApplicationStatus` enforces 48-bit CSPRNG `ART-...`, constant-time `>=9`-digit E.164 match (rejects `"-------"`), dual IP + per-reference PG rate limits (`c0488f4`), and PII/wholesale-redacted DTO (`J5`, `J6`). |
| **`GA-05`** | **9 Haramain Business Invariants & Financial Integrity** (Server visa tier + Masar SAR×PKR math, Live Rate vs Visa-Only, Makkah→`JED` / `MED→JED`, infant `0`-bed/`1`-passport + airfare, room splitter `allowedRoomTypes`, fleet enums, date chaining, Mode A/B `0`-tier math, deterministic Copilot & `FOR UPDATE` seat locks) | **`PASS`** | • **`13,825 / 13,825` deterministic PRNG property cases** passed in `2.15s` across all 9 Brief §5.4 invariants ([V02.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/verification/V02.md) §3).<br>• `10`-way parallel `SELECT ... FOR UPDATE` race against a `4`-seat batch yielded exact **`4` reservations / `6` rejections (`0` oversells)** (`concurrency-and-fk.test.ts` `2/2` PASS).<br>• Quoting Copilot (`cbad379`) restricts LLM output to narrative notes and computes `100%` of PKR totals deterministically on the server (`J1`–`J4`, `J7`–`J12`). |
| **`GA-06`** | **Fail-Closed Production Topology & External Resilience** (Missing prod env fails closed; `r2-local`, local Chrome `cdp`, inline Trigger fallback, `wamid.sim_*` fake sends, and SHA-256 fake social analytics unreachable in prod; Gotenberg v8 `/html` `<1 MB` escaped payloads; `AbortSignal.timeout`) | **`PASS`** | • `parseEnv()` throws on missing secrets, `http://localhost`, or `SKIP_ENV_VALIDATION` in `NODE_ENV=production` (`de7b3e5`).<br>• `r2-local` & `~/.wrangler` blocked (`9344ddf`); `chromium-cdp.ts` throws `ChromiumCdpProductionBlockedError` (`9344ddf`); `trigger/dispatch.ts` throws `TriggerDispatchConfigurationError` (`964ebe7`); `0` `wamid.sim_*` / `wamid.bridge_*` (`3fa1f28`); `0` SHA-256 fake social stats (`729baf2`).<br>• Compressed logos (`16.8 KB` + `28.3 KB`) shrink Gotenberg HTML payloads from `42.55 MB` to `<65 KB` against `/forms/chromium/convert/html` & `/screenshot/html` with `escapeHtml()` + inline CSP (`J7`, `J10`, `J11`, `J20`, `J22`). |
| **`GA-07`** | **Compliance, Privacy, DNC & Auditability** (Private R2 + signed `/api/media/*` proxy; inbound `"STOP"` sets global `do_not_contact`; truthful `/privacy`, `/terms`, `/refund-policy`; immutable `audit_logs`; PII-redacted `logger.ts`; `/api/health` + `/admin/settings?tab=health` + `RB-01..10` + 10-gate CI) | **`PASS`** | • `passports/`, `whatsapp-media/`, `quotes/`, `receipts/` isolated behind auth/HMAC `/api/media/[...key]` (`Cache-Control: private, no-store`, `9344ddf`).<br>• Inbound `"STOP"`/`"UNSUBSCRIBE"`/`"RUKO"` sets `do_not_contact` across `whatsapp_conversations` & `outreach_contacts` before cooldown unlock (`3fa1f28`, `J17`).<br>• `trg_audit_logs_immutable` rejects `UPDATE`/`DELETE` with `SQLSTATE 55000`; `lib/logger.ts` redacts phones/tokens/OTPs/SQL params (`342eaef`).<br>• `/api/health` + Bearer/Admin `/api/health?deep=1`, `/admin/settings?tab=health`, dual `.github/workflows/ci.yml`, and `RB-01..RB-10` verified (`e95a30f`, `J19`, `J22`). |
| **`GA-08`** | **WCAG 2.2 AA, Locked Light Theme & `J1`–`J22` E2E Green** (OS Dark Mode never activates dark classes; `>=4.5:1` text / `>=3.0:1` UI contrast; `0` Axe critical/serious violations; `21/21` Playwright specs covering `J1`–`J22` green on Desktop & Mobile; `>=80%` overall / `>=90%` domain V8 coverage) | **`PASS`** | • `@custom-variant dark (&:where(.never-dark *));` + `color-scheme: light` + `forcedTheme="light"`; `--gold-text` = `6.73:1` on `#FAF7F0`, `--input` = `3.42:1`, `0` `asChild`, `100%` `<ArabicText lang="ar" dir="rtl">` ([V03.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/verification/V03.md) §3.4).<br>• **`21 / 21` Playwright specs (`J1`–`J22`) PASSED (`exit 0`)** across `1440×900`, `375×812`, and `320×640` (`0` overflow, `0` unexcluded `@axe-core/playwright` violations).<br>• **`692 / 692` automated tests passed**; V8 active module coverage = **`91.37%` lines** (`96.41%` across `lib/domain/*`). |

---

## 2. Reproducible Verification Command Summary

Executed against `.env.audit` + `alramlah-audit-pg` (`127.0.0.1:54329`):

```text
$ npm audit --omit=dev --audit-level=high
found 0 critical, 0 high vulnerabilities (exit code 0)

$ npx next typegen && npm run typecheck && npx tsc --noEmit -p tests/e2e/tsconfig.json
0 TypeScript errors across app, server actions, trigger tasks, and E2E suites (exit code 0)

$ npm run lint
✖ 125 problems (0 errors, 125 warnings) (exit code 0)

$ npm test
[run-all-tests] Node runner: 98 files | 215 suites | 669 passed | 0 failed | 0 skipped (222.16s)
[run-all-tests] Vitest runner: 7 files | 23 passed | 0 failed | 0 skipped (24.48s)
TOTAL: 105 files | 692 / 692 passed (exit code 0)

$ npm run build
▲ Next.js 16.4.6 (Turbopack) — Compiled successfully in 18.5s | Static pages (32/32) in 890ms
.next/standalone/server.js: PRESENT | .nft.json parsed: 43/43 | env-leaks: 0 | upload-leaks: 0 (exit code 0)

$ npm run test:e2e
Running 21 tests using 1 worker (chromium-desktop + mobile 375x812 & 320x640 + dark-OS emulation + @axe-core/playwright)
21 passed (6.8m) | Post-E2E listening ports (3123, 3998): 0 (exit code 0)
```

---

## 3. §11 Owner Decisions (`OD-01`–`OD-11`) Compliance Matrix

All 11 Owner Decision gates in [OWNER_DECISIONS.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/OWNER_DECISIONS.md) were implemented under **Recommended Default (Option A)** and verified end-to-end:

| ID | Approved Architecture / Policy | Verified Production Implementation | Status |
| :---: | :--- | :--- | :---: |
| **`OD-01`** | Sunset server-side Baileys sockets; use Meta Cloud API v21.0 + Ban-Safe Manual Assisted WA Group/Status Queue | `@whiskeysockets/baileys` removed from `package.json`; `lib/whatsapp/linked-device.ts` & `send-whatsapp-group-campaign.task.ts` prepare manual `wa.me` + copy-packs (`0%` SIM-ban risk); `purgeFakeMarketingChannelsAction` strictly filters WA channel types (`J18`). | **COMPLIANT** |
| **`OD-02`** | Resend transactional email (`@alramlahtravels.com`) + `super_admin` password-reset fallback | `lib/security/mailer.ts` dispatches escaped HTML emails via `Resend` for Quotation PDFs & Better Auth `sendResetPassword`, paired with `resetStaffPassword` (`mustChangePassword = true`) in `/admin/settings` (`J7`). | **COMPLIANT** |
| **`OD-03`** | Append-only manual `application_payments` ledger + private R2 bank-receipt proof upload (no card gateway in v1) | `application_payments` table (`ON DELETE RESTRICT`, `amount_pkr > 0` `CHECK`) + `recordApplicationPaymentAction` storing receipts under private `receipts/` R2 keys and computing deterministic payment status (`J9`). | **COMPLIANT** |
| **`OD-04`** | Online Pilgrim Quote Accept/Revision on `/#track-status` + signed QR `/voucher/[token]` gated on `approved` + verified deposit/full payment | `respondToApplicationQuoteAction` transitions `quoted → approved \| revision_requested` with `audit_logs`; `/voucher/[token]` & admin voucher return `403` until `approved` AND `deposit_paid \| paid_in_full` (`J9`). | **COMPLIANT** |
| **`OD-05`** | 48-bit CSPRNG `ART-...` ref + exact normalized E.164 phone match (`>=9` digits) + PG rate limits + redacted DTO | `buildCsprngApplicationReference` (`randomBytes(6)`), constant-time E.164 phone match, dual IP (`5/15m`) + per-ref (`12/15m`) PG rate limits, zero wholesale/admin-note leakage (`J5`). | **COMPLIANT** |
| **`OD-06`** | Private R2 + signed `/api/media/*` URLs; 60d passport / 24m lead / 6y tax retention cron; PII-scrubbed ZDR AI + truthful `/privacy` | Private R2 prefixes served via `10m` presigned/auth `/api/media/[...key]`; `runPiiAndMediaRetentionPurge` (`30 3 * * *` PKT) enforces 60d/24m/90d purges with 6y FBR carve-out; `scrubCopilotPromptPii` + OpenRouter `data_collection: "deny"` (`J5`, `J8`, `J13`). | **COMPLIANT** |
| **`OD-07`** | Managed stack (Vercel Pro / Docker VPS + Neon Launch + Trigger + `$0` OCI PAYG ARM64 Gotenberg) + strict `super_admin` RBAC & Neon-safe crons | `66` high-privilege Server Actions + OAuth routes + CSV export locked to `requireSuperAdmin()`; Desk 4s poll is read-only & visibility-paused; PKT `09:00–23:00` crons allow Neon overnight scale-to-zero (`J6`, `J15`, `J19`). | **COMPLIANT** |
| **`OD-08`** | English storefront + `<ArabicText lang="ar" dir="rtl">` + Noto Arabic/Urdu fonts in Desk/PDFs + offline Haramain prayer pill | `100%` of sacred Arabic wrapped in `<ArabicText>`; Noto Naskh Arabic & Nastaliq Urdu configured in `render-quotation-pdf.ts` & `setup-oracle-arm.sh`; zero-network Umm al-Qura prayer pill in `PublicHeader` (`J5`, `J7`). | **COMPLIANT** |
| **`OD-09`** | Masar `<=30d` × live `sarToPkrRate`; Mode B `0`-tier stays `"On Request"`; mandatory `Visa Only` dates; `approved` seat deduction; infant airfare `>0`; `hajj_packages` CRUD | All 5 domain clarifications (`09a`–`09e`) enforced across `lib/domain/*`, `lib/validations/*`, `app/actions/*`, and `db/schema/packages.ts`, proven by `13,825` property cases + `J1`–`J4` & `J10`. | **COMPLIANT** |
| **`OD-10`** | Canonical Askari 10 Sector C Lahore HQ + official phones; `iban_verified = false` default; client PDF & fake reviews purged; DTS/MoRA/IATA/NTN fields + `/refund-policy` | Single SSoT in `lib/company-info.ts` & `agency_settings` (`Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt`, `+92 327 4029701` · `+92 319 0462638`); unverified IBAN suppressed until `ibanVerified = true`; `/refund-policy` live (`J5`, `J21`). | **COMPLIANT** |
| **`OD-11`** | Live IG/FB/YouTube; GBP migrated to v1 + TikTok Audit UX gated behind `GBP_API_APPROVED` / `TIKTOK_DIRECT_POST_APPROVED`; `0` fake analytics | `lib/social/providers/gmb.ts` uses GBP v1 APIs; `tiktok.ts` implements `creator_info/query` + `SELF_ONLY` pre-audit safety; `analytics.ts` returns honest `status: "unavailable"` (`0` SHA-256 mocks); auto-plugs require `status === "live"` (`J19`, `J20`). | **COMPLIANT** |

---

## 4. Operational Runbooks Index (`RB-01`–`RB-10`)

All 10 production operational runbooks are authored, secret-clean, and verified in `docs/audit/runbooks/`:

1. [RB-01-incident-response.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/runbooks/RB-01-incident-response.md) — Severity Matrix (`SEV-1`..`SEV-4`), Triage Contacts, `/api/health?deep=1` Diagnostics & Escalation Protocol
2. [RB-02-db-pitr-and-restore.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/runbooks/RB-02-db-pitr-and-restore.md) — Neon PostgreSQL 7-Day Point-in-Time Recovery (PITR) & `scripts/db-backup.ts` AES-256-GCM Restore Drill
3. [RB-03-key-and-token-rotation.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/runbooks/RB-03-key-and-token-rotation.md) — Zero-Downtime `v2:` Vault Rotation (`ENCRYPTION_KEY_PREVIOUS`), `BETTER_AUTH_SECRET` & Better Auth `scrypt` Emergency Reset
4. [RB-04-whatsapp-waba-and-webhook-recovery.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/runbooks/RB-04-whatsapp-waba-and-webhook-recovery.md) — Meta WhatsApp Cloud API v21.0 Token Renewal, `retry_pending` Outbox Recovery & `OD-01` Queue Operations
5. [RB-05-social-oauth-and-quota-ops.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/runbooks/RB-05-social-oauth-and-quota-ops.md) — Core 5 Social OAuth Re-Authentication, YouTube Quota Budget & `OD-11` (`TIKTOK_DIRECT_POST_APPROVED` / `GBP_API_APPROVED`) Activation
6. [RB-06-oracle-gotenberg-vm-recovery.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/runbooks/RB-06-oracle-gotenberg-vm-recovery.md) — Oracle Cloud PAYG Always Free ARM64 Gotenberg `v8.17.0` Container Health, Font Stack & Failover Operations
7. [RB-07-trigger-dev-worker-and-cron-ops.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/runbooks/RB-07-trigger-dev-worker-and-cron-ops.md) — Trigger.dev Cloud v4 Worker Deployment (`npm run trigger:deploy`), Env Parity, Queues & PKT Cron Operations
8. [RB-08-dsar-and-pii-retention-purge.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/runbooks/RB-08-dsar-and-pii-retention-purge.md) — `OD-06` Pilgrim DSAR Access/Erasure Workflow, Automated 60d/24m/90d Retention Purge & 6-Year FBR Tax Ledger Carve-Out
9. [RB-09-peak-ramadan-and-hajj-scaling.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/runbooks/RB-09-peak-ramadan-and-hajj-scaling.md) — Peak Ramadan & Hajj Season Capacity Scaling, Neon Pool Sizing, Seat-Lock Monitoring & Broadcast Pacing
10. [RB-10-deployment-rollback-and-ci-triage.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/runbooks/RB-10-deployment-rollback-and-ci-triage.md) — Zero-Downtime Vercel / Docker Cutover, Expand-Then-Contract Drizzle Migrations, `<60s` Rollback & 10-Gate CI Triage

---

## 5. Go-Live Owner Credential & Cutover Checklist

Before switching live pilgrim traffic onto the production domain (`https://alramlahtravels.com`), complete the following owner-controlled configuration steps (every item can be verified visually on `/admin/settings?tab=health` and via `curl -H "Authorization: Bearer $HEALTHCHECK_BEARER_TOKEN" https://alramlahtravels.com/api/health?deep=1`):

### 5.1 Agency Banking & Regulatory Verification (`/admin/settings` — `super_admin` Only)
- [ ] **Corporate Bank Account (`OD-10`)**: Enter the verified **Al Ramlah Travels** corporate Meezan Bank account title & 24-character `PK...` IBAN in `/admin/settings` and toggle **`iban_verified = true`**. *(Until toggled on, Quotation PDFs and WhatsApp bots intentionally omit IBAN numbers so an unverified account is never sent to pilgrims.)*
- [ ] **Pakistan Travel Regulatory Licenses (`OD-10`)**: Populate official **DTS License #**, **MoRA / HGO Enrollment #**, **IATA / TIDS Code**, **FBR NTN #**, and **Legal Entity Name** in `/admin/settings` so they render automatically in `PublicFooter` and 3-Page Quotation PDFs.
- [ ] **Live SAR → PKR Exchange Rate & Visa Tariffs (`/admin/catalog`)**: Confirm current `agency_settings.sar_to_pkr_rate` and `visa_rates` (`short_term` 30d & `long_term` 90d PKR/Masar SAR columns) reflect today's wholesale Saudi market rates.

### 5.2 Production Infrastructure & Environment Secrets (Vercel Pro / Docker VPS + Trigger.dev Cloud)
- [ ] **Core URLs & Auth Secrets**:
  - `NODE_ENV=production` (`SKIP_ENV_VALIDATION` **unset**)
  - `NEXT_PUBLIC_APP_URL=https://alramlahtravels.com` and `BETTER_AUTH_URL=https://alramlahtravels.com`
  - `BETTER_AUTH_SECRET` (`>= 32` random bytes: `openssl rand -base64 48`)
  - `ENCRYPTION_KEY` (`64` hex chars / `32` bytes: `openssl rand -hex 32` — **must match identically in both Web and Trigger.dev Cloud**)
  - `ADMIN_BOOTSTRAP_PASSWORD` (`>= 16` chars for initial `npm run db:seed` bootstrap only; rotate immediately after first `super_admin` login and unset)
  - `HEALTHCHECK_BEARER_TOKEN` (`openssl rand -hex 32` for uptime monitors hitting `/api/health?deep=1`)
  - `CLOUDFLARE_PROXY=true` **only** if DNS runs orange-cloud proxied behind Cloudflare (leave unset/false when terminating directly on Vercel or Nginx so `extractClientIp` trusts `x-vercel-forwarded-for` / `$remote_addr`).
- [ ] **Neon Serverless PostgreSQL (`OD-07` — Neon Launch w/ 7-Day PITR)**:
  - Run `npx drizzle-kit migrate` against `DATABASE_URL_UNPOOLED` (`-pooler` stripped), then set `DATABASE_URL` & `DATABASE_URL_POOLED` (PgBouncer `-pooler`) and `DATABASE_URL_UNPOOLED` in both Web and Trigger.dev Cloud (`RB-02`, `RB-10`).
- [ ] **Cloudflare R2 Object Storage (`OD-06`)**:
  - Provision `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_URL` (`https://assets.alramlahtravels.com`). Ensure public CDN exposure applies **only** to public prefixes (`posters/`, `cms/`, `hotels/`) or separate public/private buckets; `passports/`, `whatsapp-media/`, `quotes/`, and `receipts/` are served exclusively through signed `/api/media/[...key]`.
- [ ] **Oracle Cloud PAYG Always Free ARM64 Gotenberg v8 (`OD-07`)**:
  - Upgrade Oracle Cloud tenancy to **Pay-As-You-Go (PAYG)** while keeping `VM.Standard.A1.Flex` within Always Free limits (`$0/mo`, prevents idle VM reclamation), deploy `../scripts/oracle-gotenberg/setup-oracle-arm.sh` (`gotenberg/gotenberg:8.17.0` with Noto Arabic/Urdu fonts), and set `GOTENBERG_API_URL` + `GOTENBERG_API_KEY` in Web and Trigger.dev Cloud (`RB-06`).
- [ ] **Resend Transactional Email (`OD-02`)**:
  - Verify SPF, DKIM, and DMARC DNS records for `@alramlahtravels.com` in Resend, then set `RESEND_API_KEY` and `EMAIL_FROM="Al Ramlah Travels <quotes@alramlahtravels.com>"`.
- [ ] **Trigger.dev Cloud v4 Durable Workers**:
  - Set `TRIGGER_SECRET_KEY=tr_prod_...` in Web, mirror all DB/R2/Gotenberg/AI/Meta/Resend/`ENCRYPTION_KEY` secrets into Trigger.dev Cloud Production environment, and deploy workers via `npm run trigger:deploy` (`RB-07`).
- [ ] **Meta WhatsApp Cloud API v21.0 (`OD-01`)**:
  - Set `META_APP_SECRET`, configure a permanent Meta Business System User token + `>= 16`-char `webhookVerifyToken` via `/admin/settings?tab=waba`, and register `https://alramlahtravels.com/api/webhooks/whatsapp` in Meta App Dashboard (`messages` + `message_template_status_update` fields, `RB-04`).
- [ ] **AI Providers (`OD-06` Zero-Data-Retention)**:
  - Set `OPENROUTER_API_KEY` (with ZDR policy active; app automatically sends `provider: { data_collection: "deny" }`) and/or `GOOGLE_GENERATIVE_AI_API_KEY` (paid tier so prompts are not used for model training).
- [ ] **Core 5 Social OAuth & Post-Audit Feature Flags (`OD-11`)**:
  - Configure Meta (`META_APP_ID`/`META_APP_SECRET`) and Google (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, OAuth Consent Screen set to **In Production**) for immediate **Instagram**, **Facebook Pages**, and **YouTube** publishing.
  - Keep `TIKTOK_DIRECT_POST_APPROVED` and `GBP_API_APPROVED` unset/`false` at initial cutover; once TikTok Content Posting API Audit and Google Business Profile Basic Access approval emails arrive, set `TIKTOK_DIRECT_POST_APPROVED=true` and/or `GBP_API_APPROVED=true` (`RB-05`).
- [ ] **Optional Pre-Public-Mirror Git History Scrub (`T-013`)**:
  - Working tree at `HEAD` and all build artifacts contain **`0` client PII files**; if this private repository is ever mirrored to a third-party or public Git remote, run `git filter-repo --path public/uploads/sample-posts/zahoor-adil-rafi-quotation.pdf --invert-paths` per `RB-08` to purge pre-audit historical blobs.

---

## 6. Gate A Sign-Off

**Certified by**: Wave 4 Independent Verification Swarm (`v01`, `v02`, `v03`, `v04`, `v05`, and Lead Verifier `v06`)  
**Status**: **GATE A PASSED (`8 / 8` Criteria Green) — CLEARED FOR PRODUCTION CUTOVER & PHASE B (`Spec 0025 — Public Site SEO Readiness`)**
