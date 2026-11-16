# RB-07 — Trigger.dev v4 Cloud Worker, Queue Concurrency & Scheduled Cron Operations

**Owner**: Backend & Platform Operations (`super_admin`)  
**SDK & Project**: `@trigger.dev/sdk@4.8.3` · Trigger.dev Cloud Hobby (`OD-07`) · Project Ref `proj_wceqpgjdgrgramynogwe` (`trigger.config.ts`)  
**Source Directory**: `web/trigger/*` + `web/lib/trigger/env.ts`

---

## 1. Deploying Trigger.dev Workers (`npm run trigger:deploy`)

Trigger.dev Cloud runs in isolated `medium-1x` Node containers (`maxDuration: 300` seconds) that bundle `public/logo*` via `additionalFiles` (`T-072`) and are deployed **separately** from Vercel Next.js builds. Whenever any file under `trigger/`, `lib/`, or `db/schema/` changes:

```bash
cd web
TRIGGER_SECRET_KEY="tr_prod_<PRODUCTION_SECRET>" npm run trigger:deploy
```

> [!WARNING]
> Production Next.js lambdas (`trigger/dispatch.ts`) **fail closed** if `TRIGGER_SECRET_KEY` is unset or unreachable (`T-037`) rather than executing 60–300s tasks inline inside Vercel request handlers.

---

## 2. Mandatory Environment Variable Parity Checklist (Vercel Pro <-> Trigger.dev Cloud)

On every non-`DEVELOPMENT` task boot, `trigger.config.ts` calls `assertTriggerWorkerEnv(process.env)` (`lib/trigger/env.ts`), immediately throwing a non-retryable `AbortTaskRunError` if critical worker secrets are missing. Keep all keys below **100% identical** between Vercel Pro (`Production`) and Trigger.dev Cloud (`Production`):

| Category | Required / Synced Environment Variables |
| :--- | :--- |
| **Neon PostgreSQL** | `DATABASE_URL`, `DATABASE_URL_POOLED` (`-pooler` endpoint) |
| **AES-256-GCM Vault** | `ENCRYPTION_KEY` (exact same 64-hex key as Vercel!), `ENCRYPTION_KEY_PREVIOUS` (during rotation) |
| **Cloudflare R2** | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` |
| **Oracle Gotenberg** | `GOTENBERG_API_URL` (`https://pdf.alramlahtravels.com`), `GOTENBERG_API_KEY` |
| **AI Providers (`OD-06`)** | `GOOGLE_GENERATIVE_AI_API_KEY` (or `GEMINI_API_KEY`), `OPENROUTER_API_KEY`, `OPENROUTER_FAST_MODEL` |
| **Transactional Email (`OD-02`)** | `RESEND_API_KEY`, `EMAIL_FROM` (`Al Ramlah Travels <concierge@alramlahtravels.com>`) |
| **Meta & Core 5 Social (`OD-11`)** | `META_APP_ID`, `META_APP_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_BASE_URL`, `TIKTOK_DIRECT_POST_APPROVED`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GBP_API_APPROVED` |

---

## 3. Dead-Letter Run Triage (`AbortTaskRunError` vs Retryable `429`/`5xx`)

`trigger/errors.ts` (`rethrowAsTaskError`) classifies task failures into two deterministic buckets (`T-037`):

1. **Permanent Failures (`AbortTaskRunError` — `0` automatic retries, immediate red `FAILED` badge)**:
   - HTTP `400`, `401`, `403`, `404`, `422` from Meta Graph, Social OAuth providers, Gotenberg, or R2.
   - Missing worker env vars (`assertTriggerWorkerEnv`) or `Vault decryption failed` (`ENCRYPTION_KEY` drift).
   - **Action**: Fix the underlying credential/env/payload first (see **RB-03**, **RB-04**, **RB-05**, **RB-06**), then click **Replay** in the Trigger.dev Dashboard (or trigger a fresh action in `/admin`, which hashes `scheduledFor` / `contentHash` / `retryAttempt` into `idempotencyKeys.create(seed, { scope: "global" })` so retries are never blocked by 30-day idempotency keys).
2. **Transient Failures (Standard Error Rethrow — up to `3` exponential backoff attempts, `1s -> 15s`)**:
   - HTTP `429` (`Too Many Requests`), `500`, `502`, `503`, `504`, Neon cold-start socket resets, or `AbortSignal.timeout`.
   - **Action**: If all 3 attempts exhaust during an upstream provider outage, wait for upstream recovery and bulk-replay failed runs filtered by Task ID in Trigger.dev Cloud.

---

## 4. Queue Concurrency Caps Reference (`trigger/queues.ts`)

| Exported Queue | Queue Name | `concurrencyLimit` | Protected Resource / Invariant |
| :--- | :--- | :---: | :--- |
| `gotenbergQueue` | `gotenberg-render-queue` | **`2`** | Matches Oracle Gotenberg `--chromium-max-concurrency=2` (`6 GB` RAM cap). |
| `whatsappBroadcastQueue` | `whatsapp-broadcast-queue` | **`1`** | Strict FIFO execution preserving Meta 25–50 msg/min anti-ban pacing. |
| `socialPublishQueue` | `social-publish-queue` | **`5`** | Bounds parallel video/carousel transfers to IG, FB, TikTok, YT, and GBP. |
| `aiExtractionQueue` | `ai-extraction-queue` | **`3`** | Caps parallel Gemini / OpenRouter multimodal supplier flyer extractions. |
| `quotingCopilotQueue` | `quoting-copilot-queue` | **`3`** | Bounds concurrent AI Quoting Copilot runs (`CopilotRealtimeRunBanner`). |
| `inboundWhatsappQueue` | `inbound-whatsapp-queue` | **`10`** | Global cap + per-conversation `concurrencyKey: conversationId` FIFO ordering. |
| `mediaMirrorQueue` | `whatsapp-media-mirror-queue` | **`5`** | Caps parallel Meta media downloads -> private R2 `whatsapp-media/` uploads. |
| `whatsappGroupCampaignQueue` | `whatsapp-group-campaign-queue` | **`1`** | Serializes `OD-01` Ban-Safe Manual Assisted WA Group/Status queue transitions. |
| `scheduledMaintenanceQueue` | `scheduled-maintenance-queue` | **`1`** | Overlap lock across all scheduled maintenance, SLA, and retention crons. |

---

## 5. Scheduled Crons Reference & `sla-overdue-quote-monitor` Verification (`T-074`)

All schedules run exclusively in `environments: ["PRODUCTION"]` under `timezone: "Asia/Karachi"` on `scheduledMaintenanceQueue` (`concurrencyLimit: 1`), tuned so Neon Serverless Postgres scales to zero overnight (`OD-07`):

| Task ID | PKT Cron Pattern | Cadence (PKT) | Operational Purpose |
| :--- | :--- | :--- | :--- |
| `proactive-social-token-refresh` | `0 */6 * * *` | Every 6 hours | Renews Core 5 OAuth tokens expiring within 24h via `lib/social/token-refresh.ts`. |
| `sync-recent-social-analytics` | `20 10,16,22 * * *` | 10:20, 16:20, 22:20 | Syncs live engagement metrics for latest 25 published posts (`0` fake metrics). |
| `sla-overdue-quote-monitor` | `5 9-23 * * *` | Hourly (9 AM–11 PM) | Flags unquoted `new`/`pending_quote` web & WA leads past `agency_settings.sla_overdue_hours` by stamping `applications.sla_escalated_at` (`T-074` SLA-overdue timestamp column, tracked in triage as `applications.sla_overdue_at` — **never** mutating pilgrim-visible `special_requests`!) and emailing `super_admin` alerts. |
| `pii-and-media-retention-purge` | `30 3 * * *` | Daily at 03:30 AM | Enforces `OD-06` 60-day passport / 24-month unbooked lead / 90-day raw payload retention (**RB-08**). |
| `sweep-due-social-posts` | `15 9-23 * * *` | Hourly (9 AM–11 PM) | Safety-net sweeper for `scheduled_posts` overdue `>10m` (guarded by atomic `'publishing'` claim lock). |
| `sweep-due-whatsapp-broadcasts` | `30 9-23 * * *` | Hourly (9 AM–11 PM) | Safety-net sweeper for `whatsapp_broadcasts` overdue `>10m`. |

### Inspecting SLA-Overdue Escalated Applications in PostgreSQL
```sql
SELECT
  reference_number,
  source,
  status,
  customer_city,
  created_at AT TIME ZONE 'Asia/Karachi' AS submitted_pkt,
  sla_escalated_at AT TIME ZONE 'Asia/Karachi' AS sla_overdue_flagged_pkt
FROM applications
WHERE status IN ('pending_quote')
  AND quote_sent_at IS NULL
  AND sla_escalated_at IS NOT NULL
ORDER BY created_at ASC;
```
