# 0012. Trigger dot dev v4 Hardening, Concurrency Queues, Cron Schedules, and Realtime React Hooks

**Date**: 2026-11-07
**Status**: Approved

## Summary

This specification upgrades the Al Ramlah Travels durable background execution layer (`web/trigger/*`) to production-grade Trigger dot dev v4 (`@trigger.dev/sdk` v4.8.3) patterns and wires live run progress into the 4-Hub Admin interface via `@trigger.dev/react-hooks` (`v4.8.3`). We replace untyped `task()` definitions with runtime-validated `schemaTask()` definitions backed by Zod schemas, enforce strict error discrimination using `AbortTaskRunError` so permanent 4xx/auth failures never burn retry attempts, isolate workload bottlenecks behind shared named queues (`gotenbergQueue`, `whatsappBroadcastQueue`, `socialPublishQueue`), refactor sequential loops to parallel `batchTrigger` / `batchTriggerAndWait` fan-out with `idempotencyKeys`, instrument every task with `metadata.set()` progress telemetry, mint scoped read-only public tokens in `web/app/actions/trigger-realtime.ts` (with a zero-config local dev fallback), and register declarative cron schedules (`proactive-social-token-refresh` and `sla-overdue-quote-monitor`) in `web/trigger/schedules.task.ts`.

## Context

In Slice 29 (`Spec 0010`), Al Ramlah Travels established four core Trigger dot dev Cloud tasks inside `web/trigger/`:
1. `extract-packages.task.ts` (Multimodal AI flyer package extraction + `sharp` 1080×1520 social JPEG normalization)
2. `publish-social-post.task.ts` (Scheduled Core 5 social publishing with `wait.until()` and two-step `wait.for()` campaign follow-ups)
3. `send-whatsapp-broadcast.task.ts` (Paced Meta WhatsApp Cloud API template broadcasts)
4. `render-gotenberg-asset.task.ts` (4K Spotlight posters, 4K Multi-Package Sheets, and 3-page Luxury Quotation PDFs via Oracle Cloud Always Free Gotenberg)

While these four tasks proved the durable execution model and local dev fallback (`web/trigger/dispatch.ts`), an architectural audit against the official Trigger dot dev v4 skills (`trigger-authoring-tasks`, `trigger-realtime-and-frontend`, `trigger-cost-savings`) surfaced seven high-leverage production gaps:

1. **Lack of runtime payload validation (`task` vs `schemaTask`)**: Tasks currently use `task({ id, run })` with TypeScript interfaces rather than `schemaTask({ id, schema, run })`. Malformed payloads discovered at runtime trigger up to 3 retry attempts instead of failing fast with `TaskPayloadParsedError`.
2. **Blind retries on permanent errors**: Tasks currently catch or rethrow errors without distinguishing permanent client/configuration errors (HTTP `400`, `401`, `403`, invalid Meta template, revoked OAuth token, missing database row, or unsupported media format) from transient infrastructure faults (`429` rate limits, `502`/`503`/`504` gateway timeouts). Permanent errors must throw `AbortTaskRunError` to halt retries immediately.
3. **Unbounded Gotenberg & Social concurrency**: Only `send-whatsapp-broadcast` defines an inline `queue: { concurrencyLimit: 1 }`. Concurrent 4K poster and PDF renders in `render-gotenberg-asset` can overwhelm the Oracle Cloud Always Free Gotenberg Chromium instance, causing OOM crashes. Shared named `queue()` definitions in `web/trigger/queues.ts` are needed to enforce strict system-wide concurrency caps across all tasks.
4. **Sequential loops instead of `batchTrigger` / `batchTriggerAndWait` fan-out**: Multi-post campaign dispatches, due-post/broadcast cron sweeps, and multi-card spotlight asset renders currently iterate sequentially via `for...of` loops rather than leveraging Trigger dot dev v4 batch triggering with scoped `idempotencyKeys`.
5. **No run metadata telemetry or scoped frontend tokens**: Tasks do not call `metadata.set()` during execution, and there is no Server Action to mint scoped `auth.createPublicToken({ scopes: { read: { runs: [runId] } } })` tokens for browser clients.
6. **Manual page refreshes in `/admin/studio` and `/admin/campaigns`**: Staff must manually refresh or wait on blocking server calls during 4K poster generation, multimodal flyer extraction, WhatsApp broadcast delivery, and multi-channel social publishing instead of seeing live progress bars and status badges powered by `useRealtimeRun` from `@trigger.dev/react-hooks`.
7. **Missing proactive operational cron schedules**: OAuth token refresh currently happens only reactively at publish time, and unquoted customer applications older than 24 hours have no automated SLA escalation sweep.

## Requirements

**User stories**:
- As an agency marketing operator in `/admin/studio`, I want to see a live real-time progress bar and stage indicator (`0% -> 100%`) while AI extracts supplier flyer packages and Gotenberg renders 4K posters and PDFs, so that I know the exact status without refreshing the page.
- As an agency campaign manager in `/admin/campaigns`, I want to see live recipient delivery counters (`sentCount / totalRecipients`) during WhatsApp broadcasts and live per-channel status updates during social post publishing, so that I can monitor campaign execution in real time.
- As a platform reliability engineer, I want Gotenberg rendering capped at `concurrencyLimit: 2`, WhatsApp broadcasts serialized at `concurrencyLimit: 1`, and permanent 4xx/auth errors wrapped in `AbortTaskRunError`, so that our Oracle Cloud Gotenberg instance never crashes from OOM and invalid tokens never waste billable retries.
- As an operations manager, I want automated background schedules to proactively refresh expiring social OAuth tokens every 6 hours and flag unquoted customer applications exceeding our 24-hour SLA every 30 minutes, so that social campaigns never fail due to stale tokens and high-intent leads never go cold.
- As a developer running the app locally without `TRIGGER_SECRET_KEY`, I want all tasks, batch dispatches, and realtime UI progress hooks to degrade gracefully to deterministic local execution and synthetic completed run states without throwing missing-credential errors.

**Acceptance criteria**:
- **AC-1 (`schemaTask` + Zod Payload Validation)**: All durable tasks in `web/trigger/*.task.ts` (`extract-packages`, `publish-social-post`, `send-whatsapp-broadcast`, `render-gotenberg-asset`, plus any child tasks) are upgraded from raw `task()` to `schemaTask({ id, schema, queue, retry, run })` using strict `zod` schemas so invalid payloads fail immediately with `TaskPayloadParsedError` without retrying.
- **AC-2 (`AbortTaskRunError` Non-Retryable Error Discrimination)**: All tasks and shared error classifiers wrap non-retryable permanent failures (HTTP `400`, `401`, `403`, `404`, `422`, missing database records, AES-256-GCM decryption failures, revoked OAuth `invalid_grant` / `OAuthException 190`, invalid Meta template codes `132000`–`132016`, and unsupported media constraints) in `AbortTaskRunError` from `@trigger.dev/sdk`, ensuring Trigger dot dev only retries transient `408`, `429`, and `5xx` network/upstream errors.
- **AC-3 (Dedicated Concurrency Queues in `web/trigger/queues.ts`)**: `web/trigger/queues.ts` defines and exports three shared `queue()` instances from `@trigger.dev/sdk`:
  1. `gotenbergQueue` (`name: "gotenberg-render-queue"`, `concurrencyLimit: 2`) attached to `renderGotenbergAssetTask` (and flyer/poster rendering tasks) to prevent Chromium OOM crashes on the Oracle Cloud Always Free Gotenberg instance.
  2. `whatsappBroadcastQueue` (`name: "whatsapp-broadcast-queue"`, `concurrencyLimit: 1`) attached to `sendWhatsAppBroadcastTask` to guarantee strict FIFO anti-ban pacing across overlapping broadcasts.
  3. `socialPublishQueue` (`name: "social-publish-queue"`, `concurrencyLimit: 5`) attached to `publishSocialPostTask` to bound concurrent outbound media uploads across the Core 5 social APIs.
- **AC-4 (`batchTrigger` / `batchTriggerAndWait` Fan-Out & Scoped Idempotency Keys)**: Sequential `for...of` task trigger loops in `web/trigger/publish-social-post.task.ts`, `web/trigger/send-whatsapp-broadcast.task.ts`, `web/trigger/extract-packages.task.ts`, and `web/app/actions/social-scheduler.ts` are refactored to use `batchTrigger` / `batchTriggerAndWait` (with `idempotencyKeys.create(..., { scope: "global" })` or deterministic idempotency keys) and proper `Result` checking (`result.ok` / `run.ok`) without wrapping Trigger waits in `Promise.all`.
- **AC-5 (`metadata.set()` Progress Tracking & Scoped Public Token Minting)**: `extract-packages.task.ts`, `publish-social-post.task.ts`, `send-whatsapp-broadcast.task.ts`, and `render-gotenberg-asset.task.ts` update structured run telemetry via `metadata.set("stage", ...)` and `metadata.set("progress", 0..100)` (plus task-specific counters such as `sentCount`, `failedCount`, `totalRecipients`, `completedTargets`, `extractedCount`, and `assetUrls`) inside `run()`. A new Server Action module `web/app/actions/trigger-realtime.ts` validates Better Auth admin sessions, mints scoped read-only public tokens via `auth.createPublicToken({ scopes: { read: { runs: runIds } }, expirationTime: "15m" })`, and provides a deterministic local dev fallback snapshot when `TRIGGER_SECRET_KEY` is absent or when a run executes inline (`inline_*` synthetic run ID).
- **AC-6 (`@trigger.dev/react-hooks` `useRealtimeRun` Integration in `/admin/studio` & `/admin/campaigns`)**: Reusable client components in `web/components/admin/studio/*` and `web/components/admin/campaigns/*` (integrated into `studio-hub-client.tsx` and `campaigns-hub-client.tsx`) subscribe to active runs using `useRealtimeRun(runId, { accessToken, skipColumns: ["payload", "output"], enabled })` from `@trigger.dev/react-hooks`, rendering live progress bars (`0%–100%`), stage labels, and recipient/target counters, and automatically invoking completion callbacks without requiring manual `router.refresh()` clicks.
- **AC-7 (Declarative Cron Schedules in `web/trigger/schedules.task.ts`)**: `web/trigger/schedules.task.ts` defines and exports declarative `schedules.task()` crons (alongside exported runner functions for unit testing and manual admin invocation):
  1. `proactive-social-token-refresh` (`cron: { pattern: "0 */6 * * *", timezone: "Asia/Karachi" }`): queries active `socialIntegrations` whose `tokenExpiresAt` is within 24 hours, refreshes OAuth credentials via the provider adapter, re-encrypts tokens with AES-256-GCM, and marks integrations `isActive: false` with `metadata.reauthRequired = true` on permanent `invalid_grant` / `190` errors.
  2. `sla-overdue-quote-monitor` (`cron: { pattern: "*/30 * * * *", timezone: "Asia/Karachi" }`): queries `applications` in `submitted` or `reviewing` status created more than 24 hours ago that have no sent `applicationQuotes` record, flags their SLA breach metadata/audit log, and returns the overdue summary for staff notification in `/admin/desk`.

## Options considered

### Option 1: Custom database polling loop with `setInterval` and Next.js Route Handlers
Store task progress percentages in a new PostgreSQL `background_job_progress` table, keep raw `task()` definitions, and poll `/api/admin/jobs/[id]` every 1.5 seconds from React components using `setInterval`.

**Pros**:
- Works identically in local development and production without Trigger dot dev public tokens.

**Cons**:
- Generates continuous database read traffic and serverless function invocations for every open admin tab.
- Ignores `@trigger.dev/react-hooks` (`v4.8.3`), which is already installed in `web/package.json` and provides zero-polling SSE/WebSocket push updates via `useRealtimeRun`.
- Does not solve concurrency bottlenecks on Gotenberg, untyped payloads, or wasted retries on permanent 4xx errors.

### Option 2 (Chosen): Native Trigger dot dev v4 `schemaTask`, shared `queue()`, `AbortTaskRunError`, `schedules.task()`, and `@trigger.dev/react-hooks` (`useRealtimeRun`) with inline dev fallback
Adopt the full Trigger dot dev v4 primitives across `web/trigger/*`, mint scoped read tokens in `web/app/actions/trigger-realtime.ts`, and pair `useRealtimeRun` with a clean synthetic-run fallback when `TRIGGER_SECRET_KEY` is unset or when `dispatch.ts` falls back to inline execution.

**Pros**:
- Uses the exact version-pinned `@trigger.dev/sdk` (`4.8.3`) and `@trigger.dev/react-hooks` (`4.8.3`) APIs already installed in `web/package.json`.
- Protects the Oracle Cloud Gotenberg container (`concurrencyLimit: 2`) and WhatsApp number quality rating (`concurrencyLimit: 1`) at the worker queue level.
- Eliminates wasted cloud compute and retry delays by failing fast on Zod schema violations (`TaskPayloadParsedError`) and permanent upstream errors (`AbortTaskRunError`).
- Delivers instant push telemetry (`metadata.set`) to `/admin/studio` and `/admin/campaigns` while preserving 100% zero-config local dev compatibility.

**Cons**:
- Requires a lightweight wrapper hook/component so that inline runs (which complete during the Server Action call when `TRIGGER_SECRET_KEY` is absent) seamlessly render `100% Completed` without attempting to open a Trigger dot dev Cloud SSE stream with a dummy token.

### Option 3: Trigger tasks directly from the browser using `useRealtimeTaskTrigger` and `createTriggerPublicToken`
Move task triggering out of Next.js Server Actions and into browser client components using `auth.createTriggerPublicToken()`.

**Pros**:
- Combines triggering and subscribing into a single React hook call.

**Cons**:
- Splits validation, database record creation (`scheduledPosts`, `whatsappBroadcasts`, `supplierFlyers`), and audit logging between Server Actions and client components.
- Breaks our existing zero-config local dev fallback architecture (`web/trigger/dispatch.ts`), which relies on Server Actions to run `inlineRunner` transparently when no cloud worker is attached.

## Decision

**Chosen option**: Option 2: Native Trigger dot dev v4 `schemaTask`, shared `queue()`, `AbortTaskRunError`, `schedules.task()`, and `@trigger.dev/react-hooks` (`useRealtimeRun`) with inline dev fallback.

We will harden all Trigger dot dev tasks in `web/trigger/*` using `schemaTask`, `AbortTaskRunError`, `metadata.set()`, `batchTrigger`, and shared queues in `web/trigger/queues.ts`, centralize operational crons in `web/trigger/schedules.task.ts`, expose scoped public token minting in `web/app/actions/trigger-realtime.ts`, and integrate `@trigger.dev/react-hooks` (`useRealtimeRun`) into `/admin/studio` and `/admin/campaigns`.

**Implementation skills**:
- `trigger-authoring-tasks` (`.agents/skills/trigger-authoring-tasks/SKILL.md` & `node_modules/@trigger.dev/sdk/skills/trigger-authoring-tasks/SKILL.md`)
- `trigger-realtime-and-frontend` (`.agents/skills/trigger-realtime-and-frontend/SKILL.md` & `node_modules/@trigger.dev/sdk/skills/trigger-realtime-and-frontend/SKILL.md`)
- `trigger-cost-savings` (`.agents/skills/trigger-cost-savings/SKILL.md`)

## Architecture and Technical Design

### 1. Target File Structure

```text
web/
├── trigger.config.ts                                   # Hardened v4 config (retries, machine, build.external)
├── trigger/
│   ├── index.ts                                        # Barrel exports for tasks, queues, schedules, and dispatch
│   ├── queues.ts                                       # NEW: gotenbergQueue, whatsappBroadcastQueue, socialPublishQueue
│   ├── errors.ts                                       # NEW: Non-retryable error classifier -> AbortTaskRunError
│   ├── metadata.ts                                     # NEW: Typed metadata helper & safe wrapper for inline/cloud runs
│   ├── dispatch.ts                                     # UPDATED: Batch dispatch helpers & inline synthetic runId support
│   ├── extract-packages.task.ts                        # UPDATED: schemaTask + metadata.set + AbortTaskRunError + batchTrigger
│   ├── publish-social-post.task.ts                     # UPDATED: schemaTask + socialPublishQueue + metadata.set + AbortTaskRunError
│   ├── send-whatsapp-broadcast.task.ts                 # UPDATED: schemaTask + whatsappBroadcastQueue + metadata.set + AbortTaskRunError
│   ├── render-gotenberg-asset.task.ts                  # UPDATED: schemaTask + gotenbergQueue + metadata.set + AbortTaskRunError
│   └── schedules.task.ts                               # NEW: proactive-social-token-refresh & sla-overdue-quote-monitor (+ due sweeps)
├── app/
│   └── actions/
│       ├── trigger-realtime.ts                         # NEW: Server Action minting scoped Public Access Tokens + local fallback
│       └── social-scheduler.ts                         # UPDATED: Parallel batchTrigger fan-out & realtime runId/token return
└── components/
    └── admin/
        ├── studio/
        │   └── studio-realtime-run-banner.tsx          # NEW: useRealtimeRun progress bar for AI extraction & 4K Gotenberg renders
        ├── campaigns/
        │   └── campaign-realtime-status.tsx            # NEW: useRealtimeRun live progress for WA broadcasts & social posts
        └── hubs/
            ├── studio-hub-client.tsx                   # UPDATED: Wires StudioRealtimeRunBanner into extraction & poster flows
            └── campaigns-hub-client.tsx                # UPDATED: Wires CampaignRealtimeStatus into broadcast & social rows
```

### 2. Dedicated Concurrency Queues (`web/trigger/queues.ts`)

All tasks that touch rate-limited external APIs or memory-constrained containers must bind to shared named queues defined via `queue()` from `@trigger.dev/sdk`:

```ts
import { queue } from "@trigger.dev/sdk"

/**
 * Protects the Oracle Cloud Always Free Gotenberg Chromium instance (1GB–2GB RAM)
 * from concurrent 4K screenshot / multi-page PDF OOM spikes.
 */
export const gotenbergQueue = queue({
  name: "gotenberg-render-queue",
  concurrencyLimit: 2,
})

/**
 * Guarantees strict FIFO execution across WhatsApp template broadcasts so two
 * overlapping campaigns never interleave and violate Meta's 25–50 msg/min anti-ban pacing.
 */
export const whatsappBroadcastQueue = queue({
  name: "whatsapp-broadcast-queue",
  concurrencyLimit: 1,
})

/**
 * Bounds concurrent outbound media uploads to Instagram, Facebook, TikTok, YouTube, and GMB.
 */
export const socialPublishQueue = queue({
  name: "social-publish-queue",
  concurrencyLimit: 5,
})
```

### 3. Error Classification & `AbortTaskRunError` (`web/trigger/errors.ts`)

To prevent Trigger dot dev from retrying permanent errors, `web/trigger/errors.ts` provides a deterministic classifier used across all four tasks:

```ts
import { AbortTaskRunError } from "@trigger.dev/sdk"
import { MetaApiError } from "@/lib/whatsapp/meta-api"

export interface ErrorClassification {
  retryable: boolean
  reason: string
  statusCode?: number
}

/**
 * Classifies an error as permanent (non-retryable -> AbortTaskRunError) vs transient (retryable).
 * Permanent conditions:
 * - HTTP 400, 401, 403, 404, 422
 * - OAuth invalid_grant, OAuthException 190, token decryption failure
 * - Meta WhatsApp template/parameter errors (codes 100, 190, 131009, 132000–132016)
 * - Missing database entity (post not found, broadcast not found, flyer not found)
 */
export function classifyTaskError(error: unknown): ErrorClassification

/**
 * Rethrows permanent errors wrapped in AbortTaskRunError so Trigger.dev skips remaining retries,
 * while rethrowing transient errors (429, 500, 502, 503, 504, ECONNRESET, ETIMEDOUT) for backoff retry.
 */
export function rethrowAsTaskError(error: unknown, contextPrefix?: string): never
```

### 4. `schemaTask` Zod Contracts (`web/trigger/*.task.ts`)

Every task in `web/trigger/*.task.ts` is upgraded from `task()` to `schemaTask()` with exported Zod schemas:

1. **`extractPackagesTask` (`web/trigger/extract-packages.task.ts`)**:
   - `extractPackagesPayloadSchema`: validates `mode` (`"multimodal" | "supplier_flyer_draft"`), `flyerId` (`z.string().uuid().optional()`), `supplierId` (`z.string().uuid().optional()`), `rawFlyerUrl` / `mediaUrl` (`z.string().min(1).optional()`), `rawText`, `ingestionMode`, `supplierSlug`, `commissionMode`, `commissionPkr`, `defaultDepartureCityCode`, `presetKey`, `socialKeyPrefix`, and optional `renderSpotlights` (`z.boolean().optional()`).
   - When `renderSpotlights` is enabled for extracted cards, uses `renderGotenbergAssetTask.batchTriggerAndWait` (or `batchTrigger`) with scoped `idempotencyKeys` instead of sequential loops.
2. **`publishSocialPostTask` (`web/trigger/publish-social-post.task.ts`)**:
   - `publishSocialPostPayloadSchema`: `z.object({ scheduledPostId: z.string().min(1) })`.
   - Bound to `queue: socialPublishQueue`.
   - `sweepDueSocialPostsSchedule`: uses `publishSocialPostTask.batchTrigger(duePosts.map(...))` instead of sequential `for (const p of duePosts)` execution.
3. **`sendWhatsAppBroadcastTask` (`web/trigger/send-whatsapp-broadcast.task.ts`)**:
   - `sendWhatsAppBroadcastPayloadSchema`: `z.object({ broadcastId: z.string().min(1), paceMs: z.number().int().min(0).max(10000).optional() })`.
   - Bound to `queue: whatsappBroadcastQueue`.
   - Distinguishes permanent account/token/template errors (throws `AbortTaskRunError`) from per-recipient delivery errors.
   - `sweepDueWhatsappBroadcastsSchedule`: uses `sendWhatsAppBroadcastTask.batchTrigger(...)` with deterministic idempotency keys instead of a sequential `for` loop.
4. **`renderGotenbergAssetTask` (`web/trigger/render-gotenberg-asset.task.ts`)**:
   - `renderGotenbergAssetPayloadSchema`: discriminated union (`z.discriminatedUnion("kind", [...])`) covering `"quotation_pdf"`, `"multi_poster"`, and `"single_poster"`.
   - Bound to `queue: gotenbergQueue`.

### 5. Run Metadata Contract (`web/trigger/metadata.ts`)

Because our `run*` functions can execute either inside a Trigger dot dev Cloud worker (`run()`) or inline during local development when `TRIGGER_SECRET_KEY` is absent, calling `metadata.set()` outside a Trigger dot dev task context is a no-op in `@trigger.dev/sdk`. We standardize run telemetry through a typed helper in `web/trigger/metadata.ts`:

```ts
import { metadata } from "@trigger.dev/sdk"

export type TaskRunStage =
  | "queued"
  | "initializing"
  | "waiting_until_scheduled"
  | "extracting_ai"
  | "normalizing_jpeg"
  | "persisting_db"
  | "rendering_gotenberg"
  | "uploading_r2"
  | "publishing_targets"
  | "waiting_step2_delay"
  | "publishing_step2"
  | "sending_broadcast"
  | "completed"
  | "failed"

export interface TaskProgressMetadata {
  stage: TaskRunStage
  label: string
  progress: number // 0..100
  updatedAt: string
  // Optional domain counters
  extractedCount?: number
  totalRecipients?: number
  sentCount?: number
  failedCount?: number
  completedTargets?: number
  failedTargets?: number
  totalTargets?: number
  pdfUrl?: string
  pngUrl?: string
  socialJpegUrl?: string
  error?: string
}

/**
 * Safely updates Trigger.dev run metadata inside a task run.
 * Uses synchronous chainable metadata.set() calls and never throws when invoked inline in local dev.
 */
export function updateTaskProgress(patch: Partial<TaskProgressMetadata> & {
  stage: TaskRunStage
  progress: number
  label: string
}): void
```

Stage progression per task:
- **`extract-packages`**: `initializing` (`10%`) -> `extracting_ai` (`40%`) -> `normalizing_jpeg` (`75%`) -> `persisting_db` (`90%`) -> `completed` (`100%`).
- **`render-gotenberg-asset`**: `initializing` (`15%`) -> `rendering_gotenberg` (`55%`) -> `uploading_r2` (`85%`) -> `persisting_db` (`95%`) -> `completed` (`100%`).
- **`publish-social-post`**: `initializing` (`10%`) -> `waiting_until_scheduled` (`20%`, if future) -> `publishing_targets` (`50%`) -> `waiting_step2_delay` (`75%`, if 2-step) -> `publishing_step2` (`90%`, if 2-step) -> `completed` (`100%`).
- **`send-whatsapp-broadcast`**: `initializing` (`5%`) -> `sending_broadcast` (`10%..95%`, updated as recipients are processed with `sentCount`, `failedCount`, `totalRecipients`) -> `completed` (`100%`).

### 6. Scoped Public Token Minting & Local Dev Fallback (`web/app/actions/trigger-realtime.ts`)

Per the `trigger-realtime-and-frontend` skill:
1. Browser clients using `useRealtimeRun` MUST authenticate with a scoped Public Access Token created via `auth.createPublicToken({ scopes: { read: { runs: [runId] } } })`.
2. A token with no scopes (`auth.createPublicToken()`) 403s on every subscription.
3. For status badges and progress bars, `useRealtimeRun` MUST pass `skipColumns: ["payload", "output"]` to minimize wire payload size.
4. When `TRIGGER_SECRET_KEY` is absent (or when a run executed inline in local dev with a synthetic `inline_*` run ID), `createRealtimeRunTokenAction` returns `mode: "inline"` with a pre-resolved `completed` snapshot so the client component renders `100%` immediately without attempting a cloud WebSocket/SSE connection.

```ts
"use server"

import { auth, runs } from "@trigger.dev/sdk"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth-guard"
import { isTriggerCloudConfigured } from "@/trigger/dispatch"
import type { TaskProgressMetadata } from "@/trigger/metadata"

export interface RealtimeRunAuthResult {
  success: boolean
  mode: "cloud" | "inline"
  runId: string
  publicAccessToken?: string
  fallbackStatus?: "COMPLETED" | "EXECUTING" | "QUEUED" | "FAILED"
  fallbackMetadata?: Partial<TaskProgressMetadata>
  error?: string
}

export async function createRealtimeRunTokenAction(
  rawInput: unknown
): Promise<RealtimeRunAuthResult>

export async function createBatchRealtimeRunTokensAction(
  rawInput: unknown
): Promise<{
  success: boolean
  mode: "cloud" | "inline"
  publicAccessToken?: string
  runIds: string[]
  error?: string
}>
```

### 7. Declarative Cron Schedules (`web/trigger/schedules.task.ts`)

We consolidate operational cron schedules in `web/trigger/schedules.task.ts` using `schedules.task()` from `@trigger.dev/sdk`:

1. **`proactiveSocialTokenRefreshSchedule` (`id: "proactive-social-token-refresh"`)**:
   - Cron: `{ pattern: "0 */6 * * *", timezone: "Asia/Karachi" }` (every 6 hours PKT).
   - Runner `runProactiveSocialTokenRefresh(options?: { withinHours?: number })`:
     - Queries `socialIntegrations` where `isActive = true` and `tokenExpiresAt <= now + 24h` (and `encryptedRefreshToken IS NOT NULL` or Meta long-lived exchange applies).
     - Calls `adapter.refreshAccessToken(decryptedRefreshToken)`.
     - On success: encrypts new `accessToken` and `refreshToken` via `encryptToken()` (AES-256-GCM) and updates `tokenExpiresAt`, `lastSyncedAt`, and `updatedAt`.
     - On permanent OAuth failure (`invalid_grant`, `OAuthException 190`, `token_revoked`): marks `isActive = false` and merges `{ reauthRequired: true, lastRefreshError: errMsg, lastRefreshErrorAt: now.toISOString() }` into `socialIntegrations.metadata` without crashing the batch.
2. **`slaOverdueQuoteMonitorSchedule` (`id: "sla-overdue-quote-monitor"`)**:
   - Cron: `{ pattern: "*/30 * * * *", timezone: "Asia/Karachi" }` (every 30 minutes PKT).
   - Runner `runSlaOverdueQuoteMonitor(options?: { slaHours?: number })`:
     - Queries `applications` where `status IN ('submitted', 'reviewing')` and `createdAt <= now - 24h`.
     - Checks `applicationQuotes` to find applications with zero sent/accepted quotes.
     - Updates `applications.internalNotes` or audit metadata idempotently (`[SLA-OVERDUE-24H]` marker) if not already flagged, and returns `{ checkedAt, overdueCount, newlyFlaggedCount, overdueApplications }` so `/admin/desk` can highlight overdue leads.
3. **Safety Sweeps Re-exported**:
   - `sweepDueSocialPostsSchedule` and `sweepDueWhatsappBroadcastsSchedule` are also exported from `web/trigger/schedules.task.ts` (and re-exported from `web/trigger/index.ts`) using `batchTrigger` for due items.

### 8. Key Invariants & Security Model

- **Never import task instances into Next.js Server Actions / Route Handlers for runtime bundling**: Server Actions must either trigger by task string ID via `web/trigger/dispatch.ts` or use `import type { ... }` for type parameters (`useRealtimeRun<typeof extractPackagesTask>`).
- **Scoped Read-Only Tokens Only**: `web/app/actions/trigger-realtime.ts` requires `await requireAdmin()` (Better Auth `staff` or `super_admin` session) and scopes every `createPublicToken` call strictly to `{ scopes: { read: { runs: runIds } } }` with a 15-minute expiration.
- **No `Promise.all` around Trigger Waits**: Parallel child task execution inside a task must use `batchTriggerAndWait` or `batchTrigger`, never `Promise.all([task.triggerAndWait(...), ...])`.
- **Zero-Config Local Dev Invariant**: When `TRIGGER_SECRET_KEY` is omitted or blank, all tasks, batch triggers, and realtime UI progress bars must succeed without throwing configuration errors.

## Build plan

### Milestone 1: Shared Concurrency Queues, Error Discrimination, Metadata Helpers, and `schemaTask` Hardening
**Satisfies**: `AC-1`, `AC-2`, `AC-3`, `AC-4`
**Target files**:
- `web/trigger.config.ts`
- `web/trigger/queues.ts` (new)
- `web/trigger/errors.ts` (new)
- `web/trigger/metadata.ts` (new)
- `web/trigger/dispatch.ts`
- `web/trigger/extract-packages.task.ts`
- `web/trigger/publish-social-post.task.ts`
- `web/trigger/send-whatsapp-broadcast.task.ts`
- `web/trigger/render-gotenberg-asset.task.ts`

**Implementation steps**:
1. Create `web/trigger/queues.ts` defining `gotenbergQueue` (`concurrencyLimit: 2`), `whatsappBroadcastQueue` (`concurrencyLimit: 1`), and `socialPublishQueue` (`concurrencyLimit: 5`).
2. Create `web/trigger/errors.ts` implementing `classifyTaskError(error)` and `rethrowAsTaskError(error, contextPrefix)` using `AbortTaskRunError` from `@trigger.dev/sdk`.
3. Create `web/trigger/metadata.ts` implementing `updateTaskProgress(patch)` using `metadata.set()` from `@trigger.dev/sdk` with a safe try/catch wrapper for inline local execution.
4. Upgrade `extractPackagesTask`, `publishSocialPostTask`, `sendWhatsAppBroadcastTask`, and `renderGotenbergAssetTask` from `task()` to `schemaTask()` with exported Zod schemas (`extractPackagesPayloadSchema`, `publishSocialPostPayloadSchema`, `sendWhatsAppBroadcastPayloadSchema`, `renderGotenbergAssetPayloadSchema`), queue bindings, `updateTaskProgress()` calls at each stage, and `AbortTaskRunError` discrimination.
5. Add `batchTriggerByIdOrInline` helper in `web/trigger/dispatch.ts` and refactor sequential `for...of` trigger loops in `publish-social-post.task.ts`, `send-whatsapp-broadcast.task.ts`, and `extract-packages.task.ts` to use `batchTrigger` / `batchTriggerAndWait` with deterministic `idempotencyKeys`.

### Milestone 2: Declarative Cron Schedules (`proactive-social-token-refresh` & `sla-overdue-quote-monitor`)
**Satisfies**: `AC-7`
**Target files**:
- `web/trigger/schedules.task.ts` (new)
- `web/trigger/index.ts`

**Implementation steps**:
1. Create `web/trigger/schedules.task.ts` with `schedules.task()` from `@trigger.dev/sdk`.
2. Implement `runProactiveSocialTokenRefresh` and `proactiveSocialTokenRefreshSchedule` (`cron: { pattern: "0 */6 * * *", timezone: "Asia/Karachi" }`) to refresh `socialIntegrations` expiring within 24 hours, re-encrypting tokens via `encryptToken` (`web/lib/social/crypto.ts`) and isolating permanent `invalid_grant` / `OAuthException 190` errors by setting `isActive: false` and `metadata.reauthRequired = true`.
3. Implement `runSlaOverdueQuoteMonitor` and `slaOverdueQuoteMonitorSchedule` (`cron: { pattern: "*/30 * * * *", timezone: "Asia/Karachi" }`) to detect `applications` in `submitted` or `reviewing` status older than 24 hours without any sent `applicationQuotes` record, recording an idempotent `[SLA-OVERDUE-24H]` marker and returning the structured overdue report.
4. Export all schedules, queues, error helpers, and task modules from `web/trigger/index.ts`.

### Milestone 3: Scoped Public Token Server Actions & Parallel Fan-Out in Server Actions
**Satisfies**: `AC-4`, `AC-5`
**Target files**:
- `web/app/actions/trigger-realtime.ts` (new)
- `web/app/actions/social-scheduler.ts`

**Implementation steps**:
1. Create `web/app/actions/trigger-realtime.ts` with `createRealtimeRunTokenAction` and `createBatchRealtimeRunTokensAction` guarded by `requireAdmin()`.
2. When `isTriggerCloudConfigured()` is true and `runId` is not an `inline_*` synthetic ID, mint a scoped read token via `auth.createPublicToken({ scopes: { read: { runs: [runId] } }, expirationTime: "15m" })`.
3. When `TRIGGER_SECRET_KEY` is absent or `runId` starts with `inline_`, return `{ success: true, mode: "inline", runId, fallbackStatus: "COMPLETED", fallbackMetadata: { stage: "completed", progress: 100, label: "Completed locally" } }`.
4. Update `web/app/actions/social-scheduler.ts` so `createScheduledSocialPostAction` returns `triggerRunId` (or synthetic `inline_*` run ID) and supports batch triggering for multi-post campaign creation.

### Milestone 4: Realtime React Hooks (`useRealtimeRun`) in `/admin/studio` and `/admin/campaigns`
**Satisfies**: `AC-6`
**Target files**:
- `web/components/admin/studio/studio-realtime-run-banner.tsx` (new)
- `web/components/admin/campaigns/campaign-realtime-status.tsx` (new)
- `web/components/admin/hubs/studio-hub-client.tsx`
- `web/components/admin/hubs/campaigns-hub-client.tsx`

**Implementation steps**:
1. Create `"use client"` component `web/components/admin/studio/studio-realtime-run-banner.tsx` using `useRealtimeRun` from `@trigger.dev/react-hooks` with `skipColumns: ["payload", "output"]` and `enabled: Boolean(runId && accessToken && mode === "cloud")`. Render a luxury Haramain Emerald/Gold progress bar (`0%–100%`), current `stage` badge, extracted card count, and automatic `onComplete` callback support (with instant `100%` state when `mode === "inline"`).
2. Create `"use client"` component `web/components/admin/campaigns/campaign-realtime-status.tsx` using `useRealtimeRun` to display live WhatsApp broadcast delivery progress (`sentCount / totalRecipients` + progress bar) and live social post publishing status (`completedTargets / totalTargets` + stage indicator).
3. Wire `StudioRealtimeRunBanner` into `web/components/admin/hubs/studio-hub-client.tsx` during AI flyer extraction and 4K Gotenberg poster rendering.
4. Wire `CampaignRealtimeStatus` into `web/components/admin/hubs/campaigns-hub-client.tsx` for active/processing WhatsApp broadcasts and scheduled/publishing social posts, triggering data refresh automatically upon run completion without manual `router.refresh()` clicks.
