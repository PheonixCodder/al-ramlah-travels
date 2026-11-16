# RB-10 — Deployment Rollback (Vercel + Trigger.dev + Drizzle) & CI Gate Triage

**Owner**: Engineering & Release Operations (`super_admin`)  
**CI Workflow**: `.github/workflows/ci.yml` (`web/.github/workflows/ci.yml` & monorepo mirror `../.github/workflows/ci.yml`)  
**Production Targets**: Vercel Pro (`Next.js 16.4.6` App Router) · Trigger.dev v4 Cloud (`proj_wceqpgjdgrgramynogwe`) · Neon Launch PostgreSQL

---

## 1. Instant Vercel Pro Application Rollback (`< 60 seconds`)

If a newly promoted production deployment introduces a `SEV-1`/`SEV-2` regression (`500` errors on `instrumentation.ts`, broken `/admin` hub, or failing `/api/health`):

### Option A — Vercel Dashboard Instant Rollback (Fastest)
1. Open **Vercel Dashboard** -> **al-ramlah-travels** -> **Deployments**.
2. Locate the last known-good **Production** deployment prior to the regression.
3. Click the **`...`** menu -> **Instant Rollback** -> Confirm.
   - Vercel atomically repoints the `alramlahtravels.com` edge alias to the immutable build artifact in `<10 seconds` with **zero rebuild delay**.

### Option B — Vercel CLI Rollback
```bash
npx vercel ls --prod
npx vercel rollback <PREVIOUS_HEALTHY_DEPLOYMENT_URL_OR_ID> --yes
curl -i -sS https://alramlahtravels.com/api/health?deep=1 \
  -H "Authorization: Bearer ${HEALTHCHECK_BEARER_TOKEN}"
```

---

## 2. Backward-Compatible Drizzle Migration Rules (Expand-Then-Contract)

Because Vercel Instant Rollback and Trigger.dev Worker Rollback revert **application code** without reverting **PostgreSQL DDL**, every production database change in `drizzle/` must obey the **3-Phase Expand-Then-Contract Rule**:

1. **Phase 1 — Expand (Safe Additive Migration + Dual-Compatible Code)**:
   - Allowed in `drizzle/NNNN_*.sql`: `CREATE TABLE`, `CREATE INDEX`, `ALTER TYPE ... ADD VALUE`, `ALTER TABLE ... ADD COLUMN <col> <type> NULL` (or `NOT NULL DEFAULT <literal>`).
   - **Forbidden in a single release**: `DROP COLUMN`, `DROP TABLE`, renaming columns in place, or adding `NOT NULL` without a `DEFAULT` on existing tables.
   - Result: If Vercel rolls back to `v(N-1)` immediately after deploy, `v(N-1)` ignores the new nullable/defaulted column and keeps running cleanly with `0` SQL errors!
2. **Phase 2 — Backfill & Switch Reads/Writes**:
   - Backfill existing rows in batches inside `withTransaction()`, deploy code reading/writing the new column, and bake for `>= 48 hours`.
3. **Phase 3 — Contract (Cleanup Release)**:
   - Only after zero active Vercel/Trigger deployments reference the deprecated column, ship a separate migration dropping the old column.

*If an emergency schema/data corruption ever slips past review, execute **RB-02 §2 (Neon 7-Day PITR Branch Restore)**.*

---

## 3. Trigger.dev v4 Cloud Worker Version Rollback

When rolling back Vercel across a change that also modified `trigger/*` payloads or task schemas, roll back Trigger.dev in lockstep:

1. **Instant Dashboard Promotion**:
   - Open **Trigger.dev Cloud Dashboard** (`proj_wceqpgjdgrgramynogwe`) -> **Deployments**.
   - Select the previous stable deployment version (e.g., `20261114.1`) -> click **Promote to Current**.
   - All newly queued runs immediately execute on the promoted container image while in-flight runs finish gracefully.
2. **Git SHA Re-Deploy (Alternative)**:
   ```bash
   git checkout <KNOWN_GOOD_COMMIT_SHA>
   cd web && TRIGGER_SECRET_KEY="tr_prod_<PRODUCTION_SECRET>" npm run trigger:deploy
   ```

---

## 4. Triaging `.github/workflows/ci.yml` Failures (Gates 1–10)

Every push to `main`, `master`, or `audit/**` and every Pull Request must pass all **10 sequential deterministic gates** on `ubuntu-latest` (`node-version: "22"`, disposable `postgres:16-alpine`). Never merge with failing checks or bypass environment validation via `SKIP_ENV_VALIDATION`.

| CI Gate | Failure Cause | Local Reproduction & Exact Remediation |
| :--- | :--- | :--- |
| **Gate 1: Secret & PII Guard** | Tracked `.env*` (other than `.env.example` / `.env.audit`), `.pem`/`.key`, `public/uploads/**/*.pdf`, or `public/uploads/r2-local/**`. | Run `git rm --cached <file>`, ensure pattern is in `.gitignore`, and rotate any exposed credential immediately (**RB-03**). |
| **Gate 2: `npm ci`** | `package.json` edited without regenerating `package-lock.json`. | Run `npm install` inside `web/` and commit the updated `package-lock.json`. |
| **Gate 3: `npm audit --omit=dev --audit-level=high`** | High/Critical CVE in runtime `dependencies`. | Run `npm audit --omit=dev`, upgrade the affected runtime package (or move dev-only tooling to `devDependencies`), and re-test. |
| **Gate 4: `npm run db:migrate`** | Broken SQL syntax in `drizzle/`, out-of-sync `drizzle/meta/_journal.json`, or invalid `CHECK`/FK constraint. | Reproduce against disposable local Postgres (`127.0.0.1:54329`) with `npm run db:generate && npm run db:migrate`. |
| **Gate 5: `2x npm run db:seed`** | Non-idempotent `.onConflictDoUpdate` or unique constraint collision on second `db:seed` pass, or `visa_rates.long_term` overwritten (`!= 68000`). | Inspect `db/seed.ts`: use `sql\`excluded.<col>\`` on multi-row upserts and verify `npm run db:seed && npm run db:seed` locally. |
| **Gate 6: `next typegen && npm run typecheck`** | Stale `.next/types` route params (Next.js 16 async `params`/`searchParams` Promises) or strict TypeScript error. | Run `npx next typegen && npm run typecheck` in `web/`; fix strict types directly without suppression directives. |
| **Gate 7: `npm run lint`** | ESLint rule violation or unignored generated directory. | Run `npm run lint` in `web/` and fix reported diagnostics cleanly without rule-suppression comments. |
| **Gate 8: `npm test`** | Regression in W3 suites (`tests/w3/**`), legacy suites (`tests/*.test.ts`), unit guards (`tests/unit/**`), or real-PG integration suites (`tests/integration/**`), or unmocked live internet `fetch` caught by `HermeticNetworkError`. | Run `npm test` locally with `.env.audit` (`127.0.0.1:54329`); route external HTTP calls in tests through `tests/fakes/*` (`gotenberg.fake.ts`, `meta-whatsapp.fake.ts`, `r2-s3.fake.ts`, `ai-openrouter.fake.ts`, `social-core5.fake.ts`). |
| **Gate 9: `npm run build` & `.nft.json` Audit** | RSC/Client boundary error, missing `.next/standalone/server.js`, or `.env*` / `public/uploads/` traced into `.next/server/**/*.nft.json`. | Run `npm run build` locally; verify `outputFileTracingExcludes` in `next.config.ts` and remove any dynamic `fs.readFile` over `public/uploads`. |
| **Gate 10: Playwright E2E (`J1`–`J22`)** | End-to-end UI regression, `320px/375px` mobile overflow, light-theme dark-mode leak, or `@axe-core/playwright` WCAG 2.2 AA contrast/landmark failure. | Download the uploaded **`playwright-report`** artifact from the failed GitHub Actions run (`npx playwright show-report`), reproduce locally with `npm run test:e2e`, and fix the component/action. |
