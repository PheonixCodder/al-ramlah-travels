# Trigger.dev Cloud v4 Durable Workers (`trigger`)

## Overview

Durable background task definitions (`8` `schemaTask`s, `9` bounded queues, `6` `schedules.task` PKT crons), fail-closed production dispatch, and classification-driven retry handling for `@trigger.dev/sdk` v4. Reference: [services/trigger.dev](../../services/trigger.dev/).

## Key files

| File | Owns |
|---|---|
| [trigger.config.ts](../trigger.config.ts) & [env.ts](../lib/trigger/env.ts) | `dirs: ["./trigger"]`, `sharp` external, `public/logo*` bundle, Cloud env check |
| [index.ts](./index.ts) & [queues.ts](./queues.ts) | Central barrel & all `9` bounded `queue()` definitions |
| [dispatch.ts](./dispatch.ts) & [metadata.ts](./metadata.ts) | Fail-closed Cloud dispatch, global idempotency keys, `15m` realtime tokens |
| [errors.ts](./errors.ts) | `classifyTaskError()` / `rethrowAsTaskError()` -> `AbortTaskRunError` vs retry |
| [extract-packages.task.ts](./extract-packages.task.ts) | `extract-packages` (`aiExtractionQueue`, limit `3`) |
| [quoting-copilot.task.ts](./quoting-copilot.task.ts) | `quoting-copilot` (`quotingCopilotQueue`, limit `3`) |
| [render-gotenberg-asset.task.ts](./render-gotenberg-asset.task.ts) | `render-gotenberg-asset` (`gotenbergQueue`, limit `2` for Oracle ARM64) |
| [publish-social-post.task.ts](./publish-social-post.task.ts) | `publish-social-post` (`socialPublishQueue`, `5`) + `sweep-due-social-posts` (`15 9-23 * * *`) |
| [send-whatsapp-broadcast.task.ts](./send-whatsapp-broadcast.task.ts) | `send-whatsapp-broadcast` (`whatsappBroadcastQueue`, `1`) + `sweep-due-whatsapp-broadcasts` (`30 9-23 * * *`) |
| [send-whatsapp-group-campaign.task.ts](./send-whatsapp-group-campaign.task.ts) | `send-whatsapp-group-campaign` (`whatsappGroupCampaignQueue`, `1`, `OD-01` `manual_ready`) |
| [process-inbound-whatsapp.task.ts](./process-inbound-whatsapp.task.ts) | `process-inbound-whatsapp` (`inboundWhatsappQueue`, `10`, keyed by `conversationId`) |
| [mirror-whatsapp-media.task.ts](./mirror-whatsapp-media.task.ts) | `mirror-whatsapp-media` (`mediaMirrorQueue`, `5`, private R2 download/upload) |
| [schedules.task.ts](./schedules.task.ts) | `proactive-social-token-refresh` (`0 */6 * * *`), `sync-recent-social-analytics` (`20 10,16,22 * * *`), `sla-overdue-quote-monitor` (`5 9-23 * * *`), `pii-and-media-retention-purge` (`30 3 * * *`) |

## Commands (run inside `web/`)

```bash
npm run trigger:dev     # Run local Trigger.dev v4 worker dev tunnel
npm run trigger:deploy  # Deploy tasks & schedules to Trigger.dev Cloud
```

## Conventions

- **All `9` Queues & `6` PKT Schedules**: Every cron uses `timezone: "Asia/Karachi"` (`environments: ["PRODUCTION"]`) on `scheduledMaintenanceQueue` (`concurrencyLimit: 1`): `proactive-social-token-refresh`, `sync-recent-social-analytics`, `sla-overdue-quote-monitor` (sets `slaEscalatedAt` cleanly without mutating `specialRequests`), `pii-and-media-retention-purge` (`OD-06`: 60d post-return `passports/` R2 purge, 730d/24-mo unbooked leads & `whatsapp-media/`, 2190d/6-yr booked retention, 90d `rawPayload` scrub), plus the two sweeper crons.
- **Retry Classification ([errors.ts](./errors.ts))**: Wrap API/DB failures with `rethrowAsTaskError()`. Permanent errors (`400/401/403/404/410/422`, OAuth `190`/`invalid_grant`, AES-GCM decryption failures, Meta template `132000–132016`, missing DB rows, Zod errors) throw `AbortTaskRunError`; transient errors (`408/425/429/5xx`, network/PG codes) retry with `retryAfterMs`.
- **Shared `ENCRYPTION_KEY` Parity**: [trigger.config.ts](../trigger.config.ts) runs `assertTriggerWorkerEnv()` on non-dev init (`DATABASE_URL`, `ENCRYPTION_KEY`, R2 keys, `GOTENBERG_API_URL`). **`ENCRYPTION_KEY` in Trigger.dev Cloud must match Vercel Web** so workers decrypt `v2:` vault secrets.

## Gotchas

- **Fail-Closed Production Dispatch ([dispatch.ts](./dispatch.ts))**: When `NODE_ENV === "production" && !isAuditLocalE2eMode()`, `dispatch.ts` requires a `tr_prod_*` `TRIGGER_SECRET_KEY` and throws `TriggerDispatchConfigurationError` rather than running 60–300s tasks inline inside serverless functions; never swallow Cloud errors into inline double-execution.
- **Idempotency & Atomic Claims**: Use `composeDispatchIdempotencySeed()` + `idempotencyKeys.create(..., { scope: "global" })` and `auth.createPublicToken` (`15m`) for `useRealtimeRun`. [publish-social-post.task.ts](./publish-social-post.task.ts) atomically claims `WHERE status = 'scheduled'` post-`wait.until()` to prevent sweepers from double-posting.
- **Zero Next.js Request Coupling**: Tasks under `web/trigger/` must never import `next/headers`, `next/cache`, or `'use server'` actions.

## Agent skills

- [trigger-authoring-tasks](../.agents/skills/trigger-authoring-tasks/): `schemaTask()`, queues, `wait.until()`, retries, and `schedules.task`
- [trigger-realtime-and-frontend](../.agents/skills/trigger-realtime-and-frontend/): `useRealtimeRun` & scoped public token consumption
- [trigger-cost-savings](../.agents/skills/trigger-cost-savings/): Concurrency bounds, machine sizing, and schedule optimization

## Related specs

- [Spec 0012 — Trigger v4 Hardening, Queues & Realtime Hooks](../docs/specs/0012-trigger-v4-hardening-queues-and-realtime-hooks.md)
- [Spec 0015 — Durable AI Quoting Copilot & Concierge](../docs/specs/0015-durable-ai-quoting-copilot-and-whatsapp-concierge.md)
- [Spec 0018 — Async Webhook & Realtime Copilot](../docs/specs/0018-trigger-v4-async-webhook-and-realtime-copilot.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
