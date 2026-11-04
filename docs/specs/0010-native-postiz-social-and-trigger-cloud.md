# 0010. Native Postiz Social Providers and Trigger dot dev Cloud Durable Workers

**Date**: 2026-11-02
**Status**: Approved (Implemented)

## Summary

This specification ports the core social media publishing engine from Postiz directly into the Al Ramlah Travels Next.js application, eliminating external microservice dependencies. We establish native TypeScript adapters for Instagram, Facebook, TikTok, YouTube, and Google Business Profile alongside an AES 256 GCM encrypted token storage schema in Neon PostgreSQL. We connect Trigger dot dev Cloud to execute long running background tasks, including multimodal package extraction, scheduled multi channel publishing with two step campaign delays, paced WhatsApp broadcasts, and Gotenberg poster rendering. A built in zero config fallback allows local developers to test all workflows without configuring external cloud API keys.

## Context

Al Ramlah Travels operates a high volume B2B to B2C Umrah and Hajj marketing engine. Agency marketing staff receive raw supplier flyers every week from Saudi consolidators like Ammaar, Upsky Travels, and Zahoor Travels. Staff wrap these offerings with agency profit margins, convert them into luxury branded posters, and distribute them across dozens of WhatsApp groups and five major social media networks.

Previously, social scheduling depended on an external NestJS microservice clone of Postiz. Running this separate Node application required Redis containers, a separate Prisma database, and independent hosting infrastructure. This architecture introduced operational overhead, synchronization delays, and deployment friction for a lean engineering team. Furthermore, standard Next.js serverless route handlers cannot execute long running or delayed operations because Vercel and similar edge platforms enforce strict execution timeouts between fifteen and sixty seconds.

A robust solution requires two interconnected pillars. First, the core social provider adapters and OAuth token handling must live natively inside the Next.js codebase as pure TypeScript modules running on Drizzle ORM and Neon PostgreSQL. Second, background tasks that require durable execution, long scheduled pauses, or intensive media processing must run on a dedicated worker platform. Trigger dot dev Cloud provides this durable execution runtime with state checkpointing, allowing tasks to sleep for hours or days without consuming billable serverless compute.

## Requirements

**User stories**:
- As an agency marketing manager, I want to connect our official Instagram, Facebook, TikTok, YouTube, and Google Business accounts using standard OAuth so that the agency can publish verified travel packages directly from the admin dashboard.
- As an agency content creator, I want to schedule package promotions across multiple social networks simultaneously, with automated image resizing and format validation, so that our posts never get rejected by platform algorithms.
- As an agency campaign planner, I want to run two step campaigns that publish a single package spotlight hook first and automatically follow up with a multi package sheet three hours later, so that our campaigns generate maximum customer engagement.
- As a software engineer, I want scheduled tasks to run reliably in the cloud with zero config local fallbacks so that development and automated tests run smoothly without third party cloud credentials.

**Acceptance criteria**:
- **AC-1**: Drizzle schema in `web/db/schema/social-scheduler.ts` defines `socialIntegrations`, `scheduledPosts`, and `scheduledPostTargets` with strict PostgreSQL types, foreign keys, relations, enums, and unique indexes.
- **AC-2**: Sensitive OAuth credentials (`accessToken` and `refreshToken`) are encrypted before database insertion using AES 256 GCM via `encryptToken` in `web/lib/social/crypto.ts` and decrypted via `decryptToken` on demand, ensuring plaintext tokens are never stored in the database.
- **AC-3**: OAuth start route `/api/oauth/social/[provider]/route.ts` verifies Better Auth staff session, generates signed state with PKCE code verifier cookie, and redirects to provider authorization URL with required scopes.
- **AC-4**: OAuth callback route `/api/oauth/social/[provider]/callback/route.ts` verifies state against CSRF, exchanges authorization code for tokens, fetches account metadata, encrypts tokens, and upserts `socialIntegrations` record.
- **AC-5**: TypeScript provider adapters in `web/lib/social/providers/` (`instagram.ts`, `facebook.ts`, `tiktok.ts`, `youtube.ts`, `gmb.ts`) implement the unified `SocialProvider` interface with platform specific API calls and error classification.
- **AC-6**: Provider adapters enforce exact platform media validation rules before upload (Instagram carousel up to 10 JPEGs, TikTok image shorter side at or below 1080 pixels with JPEG conversion, YouTube single MP4 video, Google Business Profile single photo with optional Call to Action card).
- **AC-7**: Server Actions in `web/app/actions/social-scheduler.ts` validate post scheduling payloads with Zod, manage database mutations, and enqueue background publishing tasks.
- **AC-8**: Trigger dot dev configuration in `web/trigger.config.ts` establishes cloud worker project binding with retry backoff and local dev execution fallback when `TRIGGER_SECRET_KEY` is absent.
- **AC-9**: `extract-packages.task.ts` runs multimodal package extraction and generates 1080p social JPEG cards via `sharp` saved to Cloudflare R2.
- **AC-10**: `publish-social-post.task.ts` uses `wait.until` for durable future scheduling, checks token expiration, publishes to targeted channels using idempotency keys, and triggers paired two step follow up posts after a configured delay using `wait.for`.
- **AC-11**: `send-whatsapp-broadcast.task.ts` delivers paced Meta WhatsApp Cloud API template messages with anti ban pacing (25 to 50 messages per minute) and line rotation.
- **AC-12**: `render-gotenberg-asset.task.ts` generates high resolution posters and PDF itineraries using the Oracle Cloud Always Free Gotenberg service and pipes results to Cloudflare R2.
- **AC-13**: Local development fallback allows full testing without Trigger dot dev Cloud credentials by executing tasks synchronously or via Next.js background queues.

## Options considered

### Option 1: Retain external Dockerized Postiz microservice with BullMQ and Redis
Keep the external NestJS Postiz service running in a separate container, connecting via REST API bridges and shared Redis queues.

**Pros**:
- Reuses existing Postiz NestJS controllers and database schema directly without code modifications.

**Cons**:
- Requires managing Redis containers, Prisma migrations, and separate Node process lifecycles.
- Introduces network latency, cross service authentication complexity, and split database state between Prisma and Drizzle.
- Fails to provide durable long scheduled sleeps for two step campaign sequencing.

### Option 2 (Chosen): Native TypeScript Core 5 provider port with Trigger dot dev Cloud durable workers
Port the five core social publishing adapters directly into `web/lib/social/`, persist OAuth tokens and scheduled posts in Drizzle ORM with AES 256 GCM encryption, and delegate durable delays and background processing to Trigger dot dev Cloud.

**Pros**:
- Unifies the entire platform into a single Next.js TypeScript repository with zero separate server containers.
- Reuses Drizzle ORM, Neon PostgreSQL, Better Auth role verification, and existing Cloudflare R2 storage utilities.
- Leverages Trigger dot dev Cloud state checkpointing, allowing tasks to sleep for hours or days without paying for idle server compute.
- Includes a transparent local dev fallback so developers can test without cloud keys.

**Cons**:
- Requires translating NestJS provider classes and decorators into clean TypeScript modules.
- Requires maintaining social provider OAuth scopes and API version bumps in house.

### Option 3: Third party SaaS social media management API (e.g. Ayrshare or Buffer)
Outsource all social media token storage, validation, and multi channel publishing to a managed SaaS service.

**Pros**:
- Offloads OAuth maintenance and social media API changes to an external vendor.

**Cons**:
- Incurs recurring monthly SaaS subscription fees that escalate steeply with post volume and connected accounts.
- Stores customer tokens and brand assets on third party servers outside agency data boundaries.
- Limits custom campaign behaviors, such as the two step Spotlight to Multi Package Sheet delay.

## Decision

**Chosen option**: Option 2: Native TypeScript Core 5 provider port with Trigger dot dev Cloud durable workers.

Al Ramlah Travels will natively embed the core five social media providers (Instagram, Facebook, TikTok, YouTube, Google Business Profile) into the Next.js application using Drizzle ORM and AES 256 GCM encryption, orchestrated by Trigger dot dev Cloud durable tasks with an inline local development fallback.

**Implementation skills**: `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`), `better-auth-security-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-security-best-practices/`), `shadcn` (`shadcn/ui`, `.agents/skills/shadcn/`)

## Rationale

Embedding the social media adapters natively provides significant architectural advantages. First, all post records, flyer references, and social tokens reside in Neon PostgreSQL alongside customer applications and inventory, maintaining complete relational integrity. Second, using AES 256 GCM authenticated encryption ensures that access and refresh tokens remain protected even in the event of database dumps or read replicas. Third, Trigger dot dev Cloud solves the serverless timeout dilemma by snapshotting worker execution during long pauses (using CRIU process checkpointing), waking up exactly when scheduled without keeping expensive container instances running. Finally, having an automatic local fallback ensures that the test suite and local onboarding remain completely friction free.

## Feature design

### Data model sketch

The social scheduler schema lives in `web/db/schema/social-scheduler.ts` and defines three primary tables:

```
[social_integrations]
- id: uuid (PK, defaultRandom)
- provider: pgEnum ('instagram', 'facebook', 'tiktok', 'youtube', 'gmb')
- name: text (Account label, e.g. "Al Ramlah Travels Official FB Page")
- handle: text (nullable, e.g. "@alramlahtravels")
- avatarUrl: text (nullable)
- internalAccountId: text (Unique provider ID, e.g. Meta Page ID, IG ID, Channel ID)
- encryptedAccessToken: text (AES-256-GCM encrypted payload, never plaintext)
- encryptedRefreshToken: text (nullable, AES-256-GCM encrypted refresh token)
- tokenExpiresAt: timestamp with time zone (nullable)
- scopes: jsonb (Array of granted OAuth permissions)
- metadata: jsonb (Provider specific configuration, e.g. GMB location name, TikTok posting mode)
- isActive: boolean (default true)
- lastSyncedAt: timestamp with time zone (nullable)
- createdByUserId: text (references user.id)
- createdAt: timestamp with time zone (default now)
- updatedAt: timestamp with time zone (default now)
Unique Index: (provider, internalAccountId)

[scheduled_posts]
- id: uuid (PK, defaultRandom)
- postAssetId: uuid (nullable, references post_assets.id in suppliers-and-marketing.ts)
- caption: text (Marketing copy, prices, contact phone numbers)
- postType: pgEnum ('single_image', 'carousel', 'video', 'story', 'offer')
- mediaUrls: jsonb (Array of primary Cloudflare R2 media URLs)
- socialJpegUrls: jsonb (Array of 1080p normalized JPEG URLs generated by sharp)
- campaignStage: pgEnum ('step_1_spotlight_hook', 'step_2_all_packages', 'standalone')
- pairedFollowUpPostId: uuid (nullable, self references scheduled_posts.id for two step funnel)
- twoStepDelayMinutes: integer (default 180, delay between Spotlight and Sheet)
- status: pgEnum ('draft', 'scheduled', 'publishing', 'completed', 'partially_failed', 'failed', 'cancelled')
- scheduledFor: timestamp with time zone (Target publication time)
- triggerRunId: text (nullable, Trigger.dev Cloud task run identifier)
- createdByUserId: text (references user.id)
- createdAt: timestamp with time zone (default now)
- updatedAt: timestamp with time zone (default now)
Indexes: scheduledFor, status, postAssetId, triggerRunId

[scheduled_post_targets]
- id: uuid (PK, defaultRandom)
- scheduledPostId: uuid (references scheduled_posts.id, cascade delete)
- integrationId: uuid (references social_integrations.id, cascade delete)
- status: pgEnum ('pending', 'publishing', 'published', 'failed', 'skipped')
- publishedUrl: text (nullable, permanent social link, e.g. https://instagram.com/p/...)
- externalPostId: text (nullable, ID returned by platform API)
- idempotencyKey: varchar(128) (unique, formatted as soc-pub-{postId}-{integrationId}-{attempt})
- errorMessage: text (nullable, diagnostic error details on failure)
- publishedAt: timestamp with time zone (nullable)
- attemptCount: integer (default 0)
- createdAt: timestamp with time zone (default now)
- updatedAt: timestamp with time zone (default now)
Unique Index: idempotencyKey
Indexes: (scheduledPostId, integrationId), status
```

### State transitions

The publication state machine guarantees deterministic progression and safe recovery:

```
1. Scheduled Post Lifecycle:
   [ draft ]
      │
      ▼ (Staff confirms post and targets)
   [ scheduled ] (Trigger.dev task dispatched with wait.until)
      │
      ▼ (Execution time arrived)
   [ publishing ]
      ├── All targets succeed ───────────────► [ completed ]
      │                                            │
      │                                            ▼ (If paired two step post exists)
      │                                       [ wait.for(delayMinutes) ] ──► Triggers Step 2
      ├── Some targets fail, some succeed ───► [ partially_failed ]
      └── All targets fail ──────────────────► [ failed ]

   (At any time before publishing)
   [ scheduled ] ──► Staff cancels ──────────► [ cancelled ]

2. Scheduled Post Target Lifecycle:
   [ pending ]
      │
      ▼ (Worker acquires lock with idempotencyKey)
   [ publishing ]
      ├── API call succeeds ─────────────────► [ published ] (Stores externalPostId & URL)
      └── API call throws non retryable ─────► [ failed ] (Stores errorMessage)
```

### Core social provider validation rules

Each provider in `web/lib/social/providers/` enforces platform specific constraints before attempting remote publishing:

1. **Instagram (`instagram.ts`)**:
   - Requires an Instagram Business account connected to a Facebook Page.
   - Attachments: Minimum 1 media item, maximum 10 items for carousel.
   - Formats: Photos must be JPEG or PNG. Videos must be MP4.
   - Aspect ratios: Must be between 4:5 and 1.91:1.
   - Caption: Maximum 2,200 characters.
   - Publishing: Single items publish via single container. Carousels create child containers with `is_carousel_item=true`, bind to parent carousel container, and publish via `media_publish`.

2. **Facebook (`facebook.ts`)**:
   - Publishes to agency Facebook Pages via Meta Graph API v25.0.
   - Attachments: Supports text only, single image, multi photo album, and MP4 video.
   - Formats: High resolution JPEG or PNG, MP4 video.
   - Caption: Maximum 63,206 characters.
   - Publishing: Single photo uploads to `/{page-id}/photos`. Multi photo posts upload unshared photos (`published: false`) and attach IDs to `/{page-id}/feed`. Videos upload to `/{page-id}/videos`.

3. **TikTok (`tiktok.ts`)**:
   - Uses TikTok Content Posting API v2.
   - Shorter side constraint: `Math.min(width, height) <= 1080`. Shorter dimension must not exceed 1080 pixels; images exceeding this threshold are automatically downscaled via `sharp`.
   - Format: `convertToJPEG = true`. All non JPEG images are converted to JPEG.
   - Attachments: Minimum 1 media item. Multiple items must all be images (up to 35 photos). Videos must be exactly 1 MP4 file.
   - Caption: Maximum 2,000 characters.
   - Content posting method: Defaults to `DIRECT_POST` (direct feed publication).

4. **YouTube (`youtube.ts`)**:
   - Uses YouTube Data API v3.
   - Attachments: Exactly 1 media attachment required.
   - Format: Must be an MP4 video file.
   - Title: Maximum 100 characters.
   - Description: Maximum 5,000 characters.
   - Category: Defaults to Category 19 (Travel and Events).
   - Privacy: Defaults to `public`.

5. **Google Business Profile (`gmb.ts`)**:
   - Uses Google My Business Local Posts API v4 / Business Information API.
   - Attachments: Text content with optional single image. Videos are not supported in local posts.
   - Formats: Single high quality JPEG or PNG.
   - Summary: Maximum 1,500 characters.
   - Post types: Supports `STANDARD` updates and `OFFER` promotions with start and end dates.
   - Call to Action: Adds structured action button (`CALL`, `BOOK`, or `LEARN_MORE`) pointing directly to package landing page or WhatsApp click to chat URL.

### API surface

The API surface comprises OAuth route handlers, Next.js Server Actions, and Trigger dot dev durable background tasks:

| Route / Function | Type | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/oauth/social/[provider]` | GET | `provider` param | 302 Redirect to OAuth consent | Better Auth Staff | 400 invalid provider, 401 unauthenticated |
| `/api/oauth/social/[provider]/callback` | GET | `code`, `state` query params | 302 Redirect to admin settings | Better Auth Staff | 400 state mismatch (CSRF), 403 access denied |
| `createScheduledPostAction` | Server Action | `postAssetId`, `caption`, `postType`, `mediaUrls`, `scheduledFor`, `targetIntegrationIds`, `twoStepDelayMinutes` | `{ success: true, postId, triggerRunId }` | Better Auth Staff | 400 validation error, 404 missing asset |
| `cancelScheduledPostAction` | Server Action | `postId` | `{ success: true }` | Better Auth Staff | 400 cannot cancel running post, 404 not found |
| `retryFailedPostTargetAction` | Server Action | `targetId` | `{ success: true, newStatus }` | Better Auth Staff | 400 target already published, 404 not found |
| `getSocialIntegrationsAction` | Server Action | none | `{ integrations: [...] }` | Better Auth Staff | 401 unauthenticated |
| `disconnectSocialIntegrationAction` | Server Action | `integrationId` | `{ success: true }` | Better Auth Super Admin | 404 not found |
| `extractPackagesTask` | Trigger.dev Task | `{ flyerId, rawFlyerUrl, supplierId }` | `{ extractedCount, cardCodes }` | Cloud Secret | 500 extraction failure, 422 malformed schema |
| `publishSocialPostTask` | Trigger.dev Task | `{ scheduledPostId }` | `{ completedTargets, failedTargets }` | Cloud Secret | 401 expired token refresh fail, 429 rate limit |
| `sendWhatsAppBroadcastTask` | Trigger.dev Task | `{ broadcastId, contactIds, templateName, mediaUrl }` | `{ sentCount, failedCount }` | Cloud Secret | 400 invalid template, 429 Meta pacing limit |
| `renderGotenbergAssetTask` | Trigger.dev Task | `{ postAssetId, templateType, options }` | `{ r2Url, pdfUrl }` | Cloud Secret | 500 Gotenberg render error, 503 service unavailable |

### Value sourcing

Every value produced, stored, or displayed maps strictly to an authoritative upstream source:

| Action | Value produced / displayed | Source |
|---|---|---|
| OAuth authorization start | State parameter with nonce | Cryptographically random bytes generated via `crypto.randomBytes(32)` |
| OAuth authorization start | PKCE code challenge | SHA 256 hash of random `code_verifier` stored in secure HttpOnly cookie |
| OAuth token persistence | Encrypted access and refresh tokens | Plaintext token from provider token response encrypted with `ENCRYPTION_KEY` |
| Token expiration check | Token validity timestamp | Computed as current timestamp plus provider `expires_in` seconds |
| Social post scheduling | Post media URLs | Selected from confirmed `postAssets.imageUrl` in `suppliers-and-marketing.ts` |
| Image normalization | Social 1080p JPEG URLs | Output of `sharp` resizing pipeline uploaded to Cloudflare R2 |
| Post target dispatch | Idempotency key | Deterministic string `soc-pub-${postId}-${integrationId}-${attemptCount}` |
| Published post tracking | Canonical social media URL | Value returned from provider publishing response (`releaseURL` or `permalink_url`) |
| Two step campaign trigger | Follow up task dispatch | Triggered from `scheduledPosts.pairedFollowUpPostId` after `wait.for` sleep |
| WhatsApp broadcast delivery | Recipient phone numbers | Validated numbers from `outreachContacts.whatsappNumber` in `suppliers-and-marketing.ts` |

### Key invariants

- **Token encryption at rest**: OAuth access and refresh tokens must never be written to PostgreSQL in plaintext. All writes pass through AES 256 GCM encryption using `ENCRYPTION_KEY`.
- **Media dimensions compliance**: Images destined for TikTok must never exceed 1080 pixels on the shorter side. Images exceeding this constraint must be downscaled via `sharp` before API submission.
- **Single image limit for Google Business**: Google Business local posts strictly disallow video and multiple photos; only one photo attachment is permitted per post.
- **Idempotency protection**: Every external social post target carries a unique idempotency key. If a worker retries following a network interruption, the provider adapter verifies that the post was not already released.
- **Two step campaign ordering**: A Step 2 Multi Package Sheet post must never publish before its corresponding Step 1 Spotlight Hook post has completed successfully.
- **Zero config fallback**: If `TRIGGER_SECRET_KEY` is undefined or blank, background tasks execute inline or log cleanly to console without crashing the application.

### Security model

- **Authentication and roles**: All administrative social management actions require an active Better Auth session. Managing integrations and disconnecting channels is restricted to `super_admin`. Scheduling and reviewing posts is permitted for `staff` and `super_admin`.
- **OAuth CSRF and PKCE hardening**: All OAuth handshakes utilize signed state tokens combined with PKCE code challenges stored in temporary secure cookies, preventing authorization injection and interception.
- **Token cryptographic isolation**: Tokens are encrypted using AES 256 GCM with unique 12 byte initialization vectors and 16 byte authentication tags per token. If a token is corrupted or tampered with, decryption fails immediately.
- **Server side request forgery protection**: Media URLs fetched for upload to social networks must pass strict domain whitelisting, permitting only trusted Cloudflare R2 bucket domains.

### Configuration required

The following environment variables in `web/lib/env.ts` govern social scheduling and background processing:

- `ENCRYPTION_KEY`: 32 byte hexadecimal string (64 characters) used for AES 256 GCM token encryption. A default fallback is provided for local development.
- `TRIGGER_SECRET_KEY`: Trigger dot dev secret API key for cloud task dispatch. When omitted, system enters zero config local execution mode.
- `TRIGGER_PROJECT_ID`: Trigger dot dev project identifier (e.g. `proj_alramlah_cloud`).
- `FACEBOOK_CLIENT_ID`: Meta App ID for Facebook and Instagram publishing.
- `FACEBOOK_CLIENT_SECRET`: Meta App Secret for token exchange.
- `TIKTOK_CLIENT_KEY`: TikTok App Client Key for Content Posting API.
- `TIKTOK_CLIENT_SECRET`: TikTok App Client Secret.
- `GOOGLE_OAUTH_CLIENT_ID`: Google Cloud OAuth 2.0 Client ID for YouTube and Google Business Profile.
- `GOOGLE_OAUTH_CLIENT_SECRET`: Google Cloud OAuth 2.0 Client Secret.
- `GOTENBERG_API_URL`: HTTP endpoint for Oracle Cloud Always Free Gotenberg instance.

### Critical test scenarios

- **Happy path (Multi channel scheduled post)**: Staff member selects a wrapped Spotlight poster for an Upsky Travels Umrah deal; enters caption; selects Instagram and Facebook targets; sets schedule for two hours in the future; clicks `"Schedule Post"`. System validates media, generates 1080p JPEGs, inserts `scheduled_posts` and target records, and enqueues Trigger dot dev job. At scheduled time, worker wakes up via `wait.until`, publishes to Instagram container, publishes to Facebook Page feed, saves permanent post URLs, and marks post `completed`. Verifies **AC-1**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-10**.
- **TikTok shorter side resize guard**: Staff selects a 4K Gemini Ultra poster (3240x4560 pixels) for TikTok publication. Adapter detects that shorter side (3240px) exceeds 1080px threshold. Sharp downscales image to 1080x1520 JPEG in Cloudflare R2. TikTok Content Posting API accepts payload without `picture_size_check_failed` error. Verifies **AC-6**, **AC-9**.
- **Two step campaign sequential delay**: Staff schedules a two step campaign: Spotlight Hook (Step 1) and Multi Package Sheet (Step 2) with a 180 minute delay. Trigger dot dev executes Step 1; verifies both channels published; calls `await wait.for({ minutes: 180 })`; state checkpoints cleanly; after 3 hours, worker resumes, verifies Step 1 success, and publishes Step 2. Verifies **AC-7**, **AC-10**.
- **Zero config local dev fallback**: Developer boots repository locally without `TRIGGER_SECRET_KEY`. Staff schedules a post for immediate publication. Server Action detects missing cloud secret, executes publishing adapter inline, updates target status to `published`, and logs status to console without throwing errors. Verifies **AC-8**, **AC-13**.
- **OAuth state CSRF tampering rejection**: Malicious request attempts to hit `/api/oauth/social/facebook/callback` with invalid state parameter. Handler rejects request with 403 Forbidden and logs security warning without creating database records. Verifies **AC-3**, **AC-4**.

## Build plan

The build plan follows the project Tracer Bullet approach across four incremental milestones:

1. **Milestone 1: Drizzle database schema, relations, and token cryptography**, satisfies **AC-1**, **AC-2**
   - Create `web/db/schema/social-scheduler.ts` defining `socialIntegrations`, `scheduledPosts`, `scheduledPostTargets`, and relations.
   - Implement `web/lib/social/crypto.ts` with AES 256 GCM `encryptToken` and `decryptToken` supporting local dev fallback.
   - Define TypeScript types, enums, and interfaces in `web/lib/social/types.ts`.
   - Export new schema tables in `web/db/schema/index.ts`.

2. **Milestone 2: Core 5 social provider adapters and media normalization**, satisfies **AC-5**, **AC-6**
   - Implement `web/lib/social/providers/instagram.ts` supporting single image and carousel publishing via Meta Graph API v25.0.
   - Implement `web/lib/social/providers/facebook.ts` supporting Page feed photo albums and videos.
   - Implement `web/lib/social/providers/tiktok.ts` with automatic shorter side 1080px check and JPEG conversion.
   - Implement `web/lib/social/providers/youtube.ts` with MP4 video attachment validation and metadata tags.
   - Implement `web/lib/social/providers/gmb.ts` supporting local post updates and offer cards with Call to Action buttons.

3. **Milestone 3: OAuth authentication routes and scheduler Server Actions**, satisfies **AC-3**, **AC-4**, **AC-7**
   - Implement `/api/oauth/social/[provider]/route.ts` with Better Auth session check and PKCE state generation.
   - Implement `/api/oauth/social/[provider]/callback/route.ts` with CSRF validation, token exchange, and encrypted upsert.
   - Implement `web/app/actions/social-scheduler.ts` with `createScheduledPostAction`, `cancelScheduledPostAction`, and `retryFailedPostTargetAction`.
   - Implement Zod validation schemas for scheduling payloads.

4. **Milestone 4: Trigger dot dev Cloud durable workers and zero config fallback**, satisfies **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-13**
   - Configure `web/trigger.config.ts` with project settings and retry policies.
   - Implement `web/trigger/extract-packages.task.ts` for multimodal AI extraction and sharp 1080p JPEG rendering.
   - Implement `web/trigger/publish-social-post.task.ts` with `wait.until`, token refresh, idempotency, and two step `wait.for` delay.
   - Implement `web/trigger/send-whatsapp-broadcast.task.ts` with anti ban rate limiting and pacing.
   - Implement `web/trigger/render-gotenberg-asset.task.ts` connecting Oracle Gotenberg to Cloudflare R2.
   - Implement zero config inline fallback when `TRIGGER_SECRET_KEY` is not configured.

## Consequences

**Positive**:
- Eliminates external NestJS, Redis, and Prisma microservices, consolidating the entire social publishing engine into the Next.js application.
- Protects OAuth tokens at rest using authenticated AES 256 GCM encryption.
- Enables long scheduled pauses and two step marketing campaigns without serverless execution timeouts.
- Ensures zero config local development so tests and local servers run without paid cloud credentials.

**Negative / tradeoffs**:
- Maintaining social provider API integrations in house requires monitoring Meta, TikTok, and Google API version deprecations.
- Video uploads to YouTube and Facebook consume worker outbound bandwidth when transferring large files from R2.

**Neutral**:
- Providers use official public REST and Graph APIs, requiring standard developer app registration with Meta, Google, and TikTok.

## Follow-up

- [ ] Register official Al Ramlah Travels production apps in Meta Developer Portal, Google Cloud Console, and TikTok Developer Center.
- [ ] Connect the social scheduler UI in `/admin/campaigns` during Slice 30 admin reorganization.

## References

**Project sources**:
- `AGENTS.md`: Stack definition, Next.js 16 App Router conventions, and Tracer Bullet approach.
- `web/lib/env.ts`: Central environment variable validation including Trigger dot dev and social OAuth keys.
- `web/db/schema/suppliers-and-marketing.ts`: Upstream `postAssets` and marketing channel definitions.
- `web/lib/bridges/marketing-bridges.ts`: Existing legacy bridge abstractions replaced by native adapters.
- `services/postiz-app/libraries/nestjs-libraries/src/integrations/social/`: Reference implementations for Instagram, Facebook, TikTok, YouTube, and Google Business Profile.
- `services/trigger.dev/`: Reference implementation for Trigger dot dev v3 tasks, `wait.until`, and `wait.for`.

**Practices & standards**:
- Meta Graph API v25.0 Content Publishing Specification
- TikTok Content Posting API v2 Direct Post Specification
- Google YouTube Data API v3 Resumable Upload Specification
- NIST SP 800-38D Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM)
- RFC 7636 Proof Key for Code Exchange by OAuth Public Clients (PKCE)
