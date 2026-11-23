# 0014. Postiz Phase 2: Multi-Page OAuth Selector, Proactive Token Refresh, Reels and Stories Upload, First-Comment Auto-Plug, and Analytics Sync

**Date**: 2026-11-07
**Status**: Accepted (Implemented)

## Summary

This specification completes the Phase 2 social media publishing and analytics engine for Al Ramlah Travels (`Slice 33`, Feature `#37`), closing the remaining functional gaps between our native Next.js 16 + Drizzle ORM port (`web/lib/social/*`) and the upstream `postiz-app` reference architecture. We introduce an interactive Multi-Account/Page/Location OAuth Selector flow for Meta and Google accounts, a proactive 24-hour OAuth token refresh worker (`web/lib/social/token-refresh.ts`) with permanent error classification, 3-phase chunked Facebook Reels and Stories uploads alongside Instagram `resolveReleaseId` timeout recovery, native First-Comment Auto-Plug support for `ART-...` WhatsApp lead conversion, and a unified Core 5 Social Post Analytics sync engine (`web/lib/social/analytics.ts`) surfaced directly in `/admin/campaigns?tab=social` and `/admin/settings`.

## Context

In Slice 29 (`Spec 0010`), Al Ramlah Travels ported the core 5 social media providers (`instagram`, `facebook`, `tiktok`, `youtube`, `gmb`) natively into Next.js 16 on Drizzle ORM and Neon PostgreSQL, eliminating the need to self-host the external NestJS/Prisma/Redis `postiz-app` container stack. While Slice 29 delivered end-to-end single-image, carousel, and basic video feed publishing with AES-256-GCM token encryption and two-step Spotlight-to-Sheet campaigns, five high-leverage production gaps remain:

1. **Blind `pages[0]` / `locations[0]` OAuth Auto-Selection**: In `web/lib/social/providers/facebook.ts`, `instagram.ts`, `youtube.ts`, and `gmb.ts`, the OAuth callback currently selects the very first returned item (`pagesData.data[0]`, first page with an `instagram_business_account`, `channelData.items[0]`, or `locData.locations[0]`). Agency administrators who manage multiple Facebook Pages, multiple Instagram Business accounts, brand vs. personal YouTube channels, or regional Google Business Profile office locations cannot choose which specific page or location to bind.
2. **Reactive-Only Token Refresh**: Currently, `dispatchPostToIntegration` in `web/app/actions/social-scheduler.ts` only checks token expiration five minutes before an active post dispatch. If an account sits idle over a weekend or a TikTok (24-hour) / Google (1-hour) / Meta (60-day) token expires before the next scheduled campaign, tokens can lapse silently without proactive background renewal or administrator visibility into `EXPIRED` credentials.
3. **Missing Facebook Reels/Stories 3-Phase Upload & Instagram Timeout Recovery**:
   - `facebook.ts` currently uploads all videos to `/{page-id}/videos` as standard horizontal/square feed videos and lacks support for vertical Facebook Reels (`/{page-id}/video_reels` 3-phase `start` -> binary stream to `rupload.facebook.com` -> `finish`) and 24-hour Facebook Page Stories (`/{page-id}/photo_stories` and `/{page-id}/video_stories`).
   - `instagram.ts` calls `POST /{ig-user-id}/media_publish` synchronously and fails immediately if Meta returns transient timeout errors (`code: -2` or `error_subcode: 2207051`), even when the container actually finishes publishing on Instagram's backend seconds later—a well-known Meta Graph API quirk solved in Postiz via `resolveReleaseId` fallback polling.
4. **No First-Comment Auto-Plug for `ART-...` Conversion**: Social algorithms on Instagram, Facebook, and YouTube penalize feed captions stuffed with external `wa.me` links, while pilgrims scrolling Umrah Spotlight Reels frequently check the top comment for exact Quad/Triple/Double pricing and a 1-tap WhatsApp inquiry link. We need native first-comment automation that posts the package's `ART-...` reference code and `https://wa.me/923274029701?text=...` CTA immediately after the main post goes live.
5. **No Post-Publication Performance Analytics**: Marketing staff currently have no visibility in `/admin/campaigns?tab=social` into how published posts perform across Instagram, Facebook, TikTok, YouTube, and Google Business Profile (`impressions`, `likes`, `comments`, `shares`, `clicks`).

## Requirements

**User stories**:
- As a super administrator connecting our agency's Meta or Google account in `/admin/settings`, I want a Page/Account/Location selector dialog when my login manages multiple Facebook Pages, Instagram Business profiles, YouTube channels, or Google Business Profile branches so that I bind the exact official Al Ramlah Travels page without disconnecting other properties.
- As a platform reliability engineer, I want a proactive token refresh engine that automatically renews OAuth tokens expiring within 24 hours, re-encrypts them with AES-256-GCM, and only flags an integration as `EXPIRED` when the provider returns a permanent revocation (`invalid_grant` or `OAuthException 190`).
- As a social media manager, I want to publish vertical promotional videos and posters as native Facebook Reels, Facebook Stories, or Instagram Reels (`postFormat: 'FEED' | 'REEL' | 'STORY'`), with automatic timeout recovery if Instagram's `media_publish` endpoint times out while processing a container.
- As a conversion marketer, I want every scheduled Instagram, Facebook, and YouTube post to support an automatic First Comment containing the package's `ART-...` code, room-sharing rates, and a pre-filled WhatsApp click-to-chat URL so that pilgrims convert directly into our WaCRM inbox.
- As a marketing director, I want to sync and inspect post performance metrics (`impressions`, `likes`, `comments`, `shares`, `clicks`) across all 5 connected social networks inside `/admin/campaigns?tab=social`.

**Acceptance criteria**:
- **AC-1**: **Multi-Account / Page / Location OAuth Selection flow**: When `/api/oauth/social/[provider]/callback` discovers `>1` Facebook Page, Instagram Business Account, YouTube Channel, or Google Business Profile Location, store the AES-256-GCM encrypted candidate accounts in a short-lived pending state / cookie or `socialIntegrations` metadata and render a Page/Location Selector dialog in `/admin/settings` (`selectSocialAccountCandidateAction`) instead of blindly picking `pages[0]`. When exactly `1` candidate account is returned, bind it immediately without extra friction.
- **AC-2**: **Proactive Token Refresh engine (`web/lib/social/token-refresh.ts`)**: Scans active `socialIntegrations` whose `tokenExpiresAt` is within 24 hours (`<= now + 24h`), refreshes tokens via the provider adapter's `refreshAccessToken`, re-encrypts `encryptedAccessToken` and `encryptedRefreshToken` with AES-256-GCM (`encryptToken`), updates `tokenExpiresAt` and `lastSyncedAt`, and transitions `status` to `'EXPIRED'` (with `isActive = false` or explicit status badge) only on permanent `invalid_grant` / `OAuthException 190` errors while preserving transient network failures for retry.
- **AC-3**: **Facebook Reels & Stories 3-phase upload + Instagram `resolveReleaseId` timeout recovery**:
  - Upgrade `web/lib/social/providers/facebook.ts` to support `postFormat: 'FEED' | 'REEL' | 'STORY'` via `/video_reels` (`upload_phase=start` -> binary upload to `upload_url` -> `upload_phase=finish` with `video_state=PUBLISHED`) and `/photo_stories` / `/video_stories`.
  - Upgrade `web/lib/social/providers/instagram.ts` with `resolveReleaseId` timeout recovery that queries `GET /{ig-user-id}/media?fields=id,shortcode,permalink,timestamp,caption` when `media_publish` times out or returns transient error code `-2` or subcode `2207051`, matching the recently created container rather than failing the target or double-posting.
- **AC-4**: **First-Comment Auto-Plug for `ART-...` Conversion**:
  - Add `firstComment` (`text`, nullable) and `postFormat` (`pgEnum('social_post_format', ['FEED', 'REEL', 'STORY'])`, default `'FEED'`) columns to `scheduledPosts` in `web/db/schema/social-scheduler.ts` (plus `firstCommentId` / `firstCommentPostedAt` tracking in `scheduledPostTargets` or `analyticsData`).
  - Add optional `publishComment?(params: { accessToken: string; externalPostId: string; commentText: string; accountId?: string; metadata?: Record<string, unknown> }): Promise<{ commentId: string }>` to `SocialProviderAdapter` in `web/lib/social/types.ts` (aliased as `SocialProvider`).
  - Implement native first-comment posting for Instagram (`POST /{media-id}/comments` with `message`), Facebook (`POST /{post-id}/comments` with `message`), and YouTube (`POST https://www.googleapis.com/youtube/v3/commentThreads?part=snippet` with `videoId` and `textOriginal`).
  - Auto-generate a default `ART-...` WhatsApp click-to-chat CTA comment in `/admin/campaigns?tab=social` whenever a package or `postAsset` is selected.
- **AC-5**: **Core 5 Social Post Analytics Sync (`web/lib/social/analytics.ts` + `syncSocialPostAnalyticsAction` in `web/app/actions/social-scheduler.ts`)**: Fetches and stores `{ impressions, likes, comments, shares, clicks, lastSyncedAt }` in `scheduledPostTargets.analyticsData` (`jsonb`) across all 5 providers (`instagram`, `facebook`, `tiktok`, `youtube`, `gmb`), with a deterministic mock fallback in local development when live platform tokens or sandbox insights permissions are unavailable.
- **AC-6**: **UI upgrades in `/admin/campaigns?tab=social` and `/admin/settings`**:
  - `/admin/campaigns?tab=social`: Post Format selector (`Feed`, `Reel`, `Story`), First-Comment composer with 1-click `ART-...` WhatsApp CTA generator, and Analytics drawer/badges with a `"Sync Metrics"` button per post/target.
  - `/admin/settings`: Multi-Page/Location OAuth selector dialog (`?tab=connections&selectAccount=<provider>`), integration status badges (`ACTIVE` vs `EXPIRED`), and manual `"Refresh Token"` / `"Choose Different Page"` controls.
- **AC-7**: **Strict Drizzle ORM + Neon PostgreSQL typing**: All schema definitions, queries, and mutations use Drizzle ORM (`drizzle-orm/pg-core`) and Neon Serverless PostgreSQL (`@neondatabase/serverless`)—never Convex or Prisma—and all UI primitives use `@base-ui/react` `render` prop composition (never Radix `asChild`).

## Options considered

### Option 1: Store pending multi-page OAuth candidates in Redis and poll social APIs from client components
Introduce an Upstash/Redis session cache for multi-page OAuth handshakes and fetch post analytics directly from the browser using short-lived tokens.

**Pros**:
- Keeps temporary OAuth candidate state outside PostgreSQL and browser cookies.

**Cons**:
- Violates our zero-Redis unified architecture and introduces unnecessary infrastructure configuration.
- Exposing provider tokens or calling Graph/TikTok/Google APIs from browser clients leaks credentials and triggers CORS failures.

### Option 2 (Chosen): Encrypted pending candidate state + Drizzle ORM schema extensions + native provider adapters with local dev fallback
Extend `web/db/schema/social-scheduler.ts` with `status` on `socialIntegrations`, `postFormat` and `firstComment` on `scheduledPosts`, and `analyticsData` (`jsonb`) on `scheduledPostTargets`. Store multi-account OAuth candidates encrypted via `encryptToken` (in an HttpOnly short-lived cookie and/or pending metadata on `socialIntegrations`), implement proactive refresh in `web/lib/social/token-refresh.ts`, implement 3-phase Reels/Stories + `resolveReleaseId` + `publishComment` + `fetchPostAnalytics` directly on the Core 5 provider adapters, and expose typed Server Actions in `web/app/actions/social-scheduler.ts`.

**Pros**:
- Zero external infrastructure dependencies beyond our existing Neon PostgreSQL database and AES-256-GCM crypto module (`web/lib/social/crypto.ts`).
- Preserves strict security: all candidate page tokens and refresh tokens remain AES-256-GCM encrypted at rest and in transit.
- Works identically in production (Trigger.dev Cloud + live Meta/Google/TikTok APIs) and in zero-config local development (deterministic analytics fallback + inline execution).
- Cleanly separates backend files (`db/schema/social-scheduler.ts`, `lib/social/*`, `app/api/oauth/social/*`, `app/actions/social-scheduler.ts`) from UI files (`components/admin/campaigns/*`, `components/admin/settings/*`).

**Cons**:
- Requires handling Meta's 3-phase binary upload protocol (`rupload.facebook.com`) and per-platform analytics response shapes in TypeScript.

### Option 3: Delegate Reels, first comments, and analytics exclusively to Composio MCP tools
Route all Phase 2 capabilities through third-party Composio action wrappers instead of our native `web/lib/social/providers/*` adapters.

**Pros**:
- Less direct HTTP plumbing for Meta Graph API endpoints.

**Cons**:
- Composio does not support 3-phase chunked Facebook Reels uploads, Instagram `resolveReleaseId` timeout recovery, GMB Performance API metrics, or multi-location GMB picker flows.
- Creates vendor lock-in and breaks when `COMPOSIO_API_KEY` is not configured.

## Decision

**Chosen option**: Option 2: Encrypted pending candidate state + Drizzle ORM schema extensions + native provider adapters with local dev fallback.

We will extend our native Postiz provider architecture in `web/lib/social/` and `web/db/schema/social-scheduler.ts` to support multi-account OAuth candidate selection, proactive 24h token refresh, Facebook 3-phase Reels/Stories + Instagram `resolveReleaseId` recovery, First-Comment `ART-...` auto-plugs, and Core 5 analytics sync.

## Architecture and Technical Design

### 1. Drizzle Schema Extensions (`web/db/schema/social-scheduler.ts`)

We extend `web/db/schema/social-scheduler.ts` with strictly typed PostgreSQL enums and columns while maintaining 100% backward compatibility with existing Slice 29 rows:

```typescript
export const socialIntegrationStatusEnum = pgEnum("social_integration_status", [
  "ACTIVE",
  "EXPIRED",
  "PENDING_SELECTION",
])

export const socialPostFormatEnum = pgEnum("social_post_format", [
  "FEED",
  "REEL",
  "STORY",
])

export interface SocialPostAnalyticsData {
  impressions: number
  likes: number
  comments: number
  shares: number
  clicks: number
  lastSyncedAt: string // ISO-8601 timestamp
  firstCommentId?: string
  firstCommentPostedAt?: string
  firstCommentError?: string
}
```

#### Table Additions:
1. **`socialIntegrations`**:
   - `status`: `socialIntegrationStatusEnum("status").notNull().default("ACTIVE")` — tracks whether the integration is healthy (`'ACTIVE'`), requires re-authentication due to a permanent OAuth failure (`'EXPIRED'`), or is awaiting multi-page selection (`'PENDING_SELECTION'`).
2. **`scheduledPosts`**:
   - `postFormat`: `socialPostFormatEnum("post_format").notNull().default("FEED")` — specifies whether the post should be published as a standard Feed post (`'FEED'`), vertical short-form video Reel/Short (`'REEL'`), or 24-hour ephemeral Story (`'STORY'`).
   - `firstComment`: `text("first_comment")` (nullable) — optional follow-up comment automatically posted immediately after primary post publication (e.g., `ART-...` package code + WhatsApp inquiry link).
3. **`scheduledPostTargets`**:
   - `analyticsData`: `jsonb("analytics_data").$type<SocialPostAnalyticsData | null>().default(null)` — stores normalized engagement metrics (`impressions`, `likes`, `comments`, `shares`, `clicks`, `lastSyncedAt`) and optional first-comment metadata (`firstCommentId`, `firstCommentPostedAt`, `firstCommentError`).

---

### 2. Multi-Account / Page / Location OAuth Selection Flow (`AC-1`)

#### Provider Candidate Discovery (`web/lib/social/types.ts` & `web/lib/social/providers/*.ts`)
We extend `SocialOAuthTokenResult` in `web/lib/social/types.ts` with an optional `candidates?: SocialOAuthAccountCandidate[]` array:

```typescript
export interface SocialOAuthAccountCandidate {
  internalAccountId: string
  name: string
  handle?: string
  avatarUrl?: string
  accessToken: string // Plaintext inside adapter return; encrypted before persistence!
  refreshToken?: string
  expiresIn?: number
  scopes: string[]
  metadata?: Record<string, unknown>
}
```

Each multi-account provider returns all discovered accounts in `candidates` while keeping the primary return fields populated with `candidates[0]` for backward compatibility:
- **`facebook.ts`**: Maps every item in `GET /me/accounts?fields=id,name,access_token,picture{url},category` into `candidates`. Each candidate carries its own Page-specific `access_token`, `id`, `name`, and `avatarUrl`.
- **`instagram.ts`**: Filters `GET /me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}` for all Pages that have a linked `instagram_business_account`, mapping each into a `SocialOAuthAccountCandidate`.
- **`youtube.ts`**: Requests `GET /youtube/v3/channels?part=snippet&mine=true&maxResults=50` and maps all returned channels into `candidates`.
- **`gmb.ts`**: Iterates across returned accounts from `mybusinessaccountmanagement.googleapis.com/v1/accounts` and fetches locations via `mybusinessbusinessinformation.googleapis.com/v1/{accountName}/locations?readMask=name,title,storefrontAddress`, mapping every verified business location into `candidates`.

#### Callback & Encrypted Candidate Storage (`web/app/api/oauth/social/[provider]/callback/route.ts`)
When `adapter.exchangeCodeForTokens(...)` returns:
1. **Single Account (`!tokenResult.candidates || tokenResult.candidates.length <= 1`)**:
   - Behaves identically to Slice 29: encrypts tokens with `encryptToken`, upserts `socialIntegrations` with `status: "ACTIVE"`, and redirects to `/admin/settings?tab=connections&connected=${provider}`.
2. **Multiple Accounts (`tokenResult.candidates.length > 1`)**:
   - Encrypts each candidate's `accessToken` and `refreshToken` using `encryptToken(candidate.accessToken)` so plaintext tokens are never written to disk, database, or cookies:
     ```typescript
     export interface EncryptedSocialAccountCandidate {
       internalAccountId: string
       name: string
       handle?: string
       avatarUrl?: string
       encryptedAccessToken: string
       encryptedRefreshToken?: string | null
       expiresIn?: number
       scopes: string[]
       metadata?: Record<string, unknown>
     }
     ```
   - Stores the encrypted candidates list in both:
     1. An HttpOnly, signed/encrypted cookie `social_oauth_candidates_${provider}` (`maxAge: 900` seconds / 15 minutes), and
     2. A pending `socialIntegrations` row (or existing row's `metadata.pendingCandidates`) with `metadata: { pendingCandidates: encryptedCandidates, pendingCreatedAt: new Date().toISOString() }` so large multi-page payloads never exceed browser 4KB cookie limits.
   - Redirects the administrator to `/admin/settings?tab=connections&selectAccount=${provider}`.

#### Candidate Selection Server Action (`web/app/actions/social-scheduler.ts`)
- **`getPendingSocialAccountCandidatesAction(provider?: SocialProviderId)`**:
  - Reads pending candidates from the HttpOnly cookie and/or `socialIntegrations.metadata.pendingCandidates`, returning sanitized candidate summaries (`internalAccountId`, `name`, `handle`, `avatarUrl`, `provider`, `metadata`) **without** exposing `encryptedAccessToken` or `encryptedRefreshToken` to the client.
- **`selectSocialAccountCandidateAction({ provider, internalAccountId })`**:
  - Validates input with Zod (`selectSocialAccountCandidateSchema`).
  - Locates the matching `EncryptedSocialAccountCandidate` from the pending store.
  - Upserts the chosen account into `socialIntegrations` with `status: "ACTIVE"`, `isActive: true`, `encryptedAccessToken`, `encryptedRefreshToken`, `tokenExpiresAt`, and cleaned `metadata` (stripping `pendingCandidates`), deletes any temporary `PENDING_SELECTION` placeholder row and cookie, calls `revalidatePath("/admin/settings")`, and returns `{ success: true, integrationId }`.

---

### 3. Proactive Token Refresh Engine (`web/lib/social/token-refresh.ts` — `AC-2`)

```
[Active Social Integrations in DB]
        │
        ▼ (Filter: isActive = true AND status != 'EXPIRED' AND tokenExpiresAt <= now + 24h)
[refreshExpiringSocialTokens()]
        │
        ├──► Calls adapter.refreshAccessToken(decryptToken(token))
        │       │
        │       ├──► Success: encryptToken(newAccess), encryptToken(newRefresh),
        │       │             update tokenExpiresAt, status = 'ACTIVE', lastSyncedAt = now
        │       │
        │       └──► Failure: inspect error via isPermanentOAuthRefreshError(err)
        │               ├──► Permanent ('invalid_grant' | 'OAuthException' | code 190 | 'token_revoked'):
        │               │    Update status = 'EXPIRED', isActive = false, metadata.lastRefreshError
        │               └──► Transient (HTTP 429 / 5xx / timeout):
        │                    Keep status = 'ACTIVE', record metadata.lastTransientRefreshWarning
```

- **Module**: `web/lib/social/token-refresh.ts`
- **Exports**:
  - `isPermanentOAuthRefreshError(error: unknown): boolean` — returns `true` when the error message or provider payload contains `invalid_grant`, `OAuthException`, error code `190`, `Error validating access token`, `token_revoked`, or `refresh_token_expired`.
  - `refreshSingleSocialIntegrationToken(integrationId: string): Promise<TokenRefreshItemResult>` — refreshes a single integration on demand or during a batch sweep. Note that for Meta (`facebook` and `instagram`), if `encryptedRefreshToken` is null, it uses `decryptToken(integration.encryptedAccessToken)` as the `fb_exchange_token` input to renew long-lived tokens before they expire.
  - `refreshExpiringSocialTokens(options?: { withinHours?: number }): Promise<TokenRefreshBatchResult>` — queries all `socialIntegrations` where `isActive = true` and `tokenExpiresAt <= new Date(Date.now() + (withinHours ?? 24) * 3600 * 1000)`, refreshes each sequentially with error isolation, and returns `{ scannedCount, refreshedCount, expiredCount, transientFailureCount, results }`.

---

### 4. Facebook Reels & Stories 3-Phase Upload + Instagram `resolveReleaseId` Recovery (`AC-3`)

#### 4.1 Facebook Reels & Stories (`web/lib/social/providers/facebook.ts`)
We inspect `post.postFormat` (defaulting to `'FEED'`, or inferred as `'STORY'` when `post.postType === 'story'`):

1. **`postFormat === 'REEL'` (Facebook Reels 3-Phase Upload via `/{page-id}/video_reels`)**:
   - Requires a single video (`MP4`) attachment.
   - **Phase 1 (`start`)**:
     ```
     POST https://graph.facebook.com/v25.0/{page-id}/video_reels
     Body: { upload_phase: "start", access_token }
     Response: { video_id: string, upload_url: string }
     ```
   - **Phase 2 (`binary transfer`)**:
     - Fetches the video binary buffer (via URL or local `/public` path) and uploads it to `upload_url` (`https://rupload.facebook.com/video-upload/v25.0/{video_id}`):
     ```
     POST {upload_url}
     Headers: {
       Authorization: "OAuth {access_token}",
       offset: "0",
       file_size: "{buffer.byteLength}",
       "Content-Type": "application/octet-stream"
     }
     Body: Uint8Array(videoBuffer)
     ```
   - **Phase 3 (`finish`)**:
     ```
     POST https://graph.facebook.com/v25.0/{page-id}/video_reels
     Body: {
       upload_phase: "finish",
       video_id,
       video_state: "PUBLISHED",
       description: post.caption,
       access_token
     }
     ```
   - Returns `{ externalPostId: video_id, publishedUrl: "https://www.facebook.com/reel/${video_id}" }`.

2. **`postFormat === 'STORY'` (Facebook Page Photo & Video Stories)**:
   - **Photo Story** (when `media[0].type === 'image'`):
     1. Uploads photo unpublished via `POST /{page-id}/photos` with `{ url: media[0].url, published: "false", access_token }` -> receives `{ id: photo_id }`.
     2. Publishes story via `POST /{page-id}/photo_stories` with `{ photo_id, access_token }` -> receives `{ post_id }`.
   - **Video Story** (when `media[0].type === 'video'`):
     1. Phase 1 (`start`): `POST /{page-id}/video_stories` with `{ upload_phase: "start", access_token }` -> receives `{ video_id, upload_url }`.
     2. Phase 2 (`binary transfer`): `POST {upload_url}` with `offset: "0"`, `file_size`, and binary buffer.
     3. Phase 3 (`finish`): `POST /{page-id}/video_stories` with `{ upload_phase: "finish", video_id, access_token }` -> receives `{ post_id }`.
   - Returns `{ externalPostId: post_id || video_id, publishedUrl: "https://www.facebook.com/stories/${pageId}" }`.

3. **`postFormat === 'FEED'`**:
   - Retains the existing text, single-photo, multi-photo album, and standard video feed publishing logic.

#### 4.2 Instagram Stories, Reels & `resolveReleaseId` Timeout Recovery (`web/lib/social/providers/instagram.ts`)
- **Format Support**:
  - When `post.postFormat === 'STORY'` or `post.postType === 'story'`, sets `createBody.media_type = "STORIES"` on the `POST /{ig-user-id}/media` container creation call.
  - When `post.postFormat === 'REEL'` or single video, sets `createBody.media_type = "REELS"`.
- **`resolveReleaseId` Timeout Recovery**:
  - In Postiz's production Instagram adapter, `POST /{ig-user-id}/media_publish` frequently times out or returns Meta error code `-2` (`Transient error`) or subcode `2207051` (`Media is being processed / publish timeout`) even though Instagram finishes publishing the container asynchronously within a few seconds.
  - We implement `resolveInstagramReleaseId(params: { igUserId: string; accessToken: string; creationId: string; caption?: string; publishedAfterMs: number })`:
    - When `media_publish` returns an error with `code === -2`, `error_subcode === 2207051`, HTTP `504`/`502`/`500`, or message matching `/timeout|transient|2207051|try again/i`, the adapter queries:
      `GET https://graph.facebook.com/v25.0/{ig-user-id}/media?fields=id,shortcode,permalink,timestamp,caption&limit=10&access_token={accessToken}`
    - Matches a media item created within the last 5 minutes (`publishedAfterMs - 60_000`) whose caption prefix matches `post.caption.slice(0, 80)` (or the newest item if caption is empty on a Story).
    - If found, recovers cleanly and returns `{ externalPostId: matched.id, publishedUrl: matched.permalink || "https://www.instagram.com/p/${matched.shortcode || matched.id}" }` without throwing or creating a duplicate post.

---

### 5. First-Comment Auto-Plug for `ART-...` Conversion (`AC-4`)

#### 5.1 Provider Interface & Implementations (`web/lib/social/types.ts` & `providers/*.ts`)
We extend `SocialProviderAdapter` (and export `type SocialProvider = SocialProviderAdapter`) with:

```typescript
export interface SocialPublishCommentParams {
  accessToken: string
  externalPostId: string
  commentText: string
  accountId?: string
  metadata?: Record<string, unknown>
}

export interface SocialPublishCommentResult {
  commentId: string
  rawResponse?: unknown
}
```

Native implementations across the 3 comment-supporting platforms:
1. **Instagram (`web/lib/social/providers/instagram.ts`)**:
   - Endpoint: `POST https://graph.facebook.com/v25.0/{externalPostId}/comments`
   - Body: `new URLSearchParams({ message: commentText, access_token: accessToken })`
   - Returns `{ commentId: data.id }`.
2. **Facebook (`web/lib/social/providers/facebook.ts`)**:
   - Endpoint: `POST https://graph.facebook.com/v25.0/{externalPostId}/comments`
   - Body: `new URLSearchParams({ message: commentText, access_token: accessToken })`
   - Returns `{ commentId: data.id }`.
3. **YouTube (`web/lib/social/providers/youtube.ts`)**:
   - Endpoint: `POST https://www.googleapis.com/youtube/v3/commentThreads?part=snippet`
   - Headers: `Authorization: Bearer ${accessToken}`, `Content-Type: application/json`
   - Body:
     ```json
     {
       "snippet": {
         "videoId": "<externalPostId>",
         "topLevelComment": {
           "snippet": {
             "textOriginal": "<commentText>"
           }
         }
       }
     }
     ```
   - Returns `{ commentId: data.id }`.

#### 5.2 Execution Hook in `executeScheduledPostNowAction` (`web/app/actions/social-scheduler.ts`)
Immediately after a target channel transitions to `status: "published"` with `publishResult.externalPostId`:
- If `post.firstComment?.trim()` is non-empty, `post.postFormat !== "STORY"` (Stories do not have public comment threads), and `adapter.publishComment` is defined:
  - Invokes `adapter.publishComment({ accessToken, externalPostId: publishResult.externalPostId, commentText: post.firstComment.trim(), accountId: integration.internalAccountId, metadata: integration.metadata })`.
  - Records `firstCommentId` and `firstCommentPostedAt` inside `scheduledPostTargets.analyticsData`.
  - **Fault Isolation Invariant**: If the first-comment API call fails (for example, comments disabled on the target video or missing `youtube.force-ssl` scope), the primary post **remains `published`** and `firstCommentError` is recorded non-fatally in `analyticsData` so the worker never re-publishes a duplicate primary post.

#### 5.3 Default `ART-...` WhatsApp CTA Generator Helper (`web/lib/social/first-comment.ts`)
We provide a pure helper `buildArtFirstCommentPlug(params)` used by both the server and `/admin/campaigns?tab=social`:
```typescript
export function buildArtFirstCommentPlug(params: {
  postCode: string
  title?: string
  quadPricePkr?: number | null
  triplePricePkr?: number | null
  doublePricePkr?: number | null
  whatsappNumber?: string
}): string
```
Produces a high-converting comment with the exact `ART-...` reference code that our WaCRM webhook auto-responder (`Spec 0013`) detects:
> `🕋 Instant Package Inquiry — Ref: ART-UP-15D-02`
> `💰 Quad: PKR 269,899 | Triple: PKR 289,000 | Double: PKR 315,000`
> `📲 Tap here for instant 3-page PDF itinerary & booking on WhatsApp:`
> `https://wa.me/923274029701?text=Assalamu%20Alaikum%20I%20want%20details%20for%20ART-UP-15D-02`

---

### 6. Core 5 Social Post Analytics Sync (`web/lib/social/analytics.ts` — `AC-5`)

We create `web/lib/social/analytics.ts` exporting `fetchTargetPostAnalytics` and `syncSocialPostAnalytics`:

| Provider | Native API Endpoint | Mapped Metrics (`impressions`, `likes`, `comments`, `shares`, `clicks`) |
| :--- | :--- | :--- |
| **Instagram** | `GET /{media-id}?fields=like_count,comments_count` + `GET /{media-id}/insights?metric=impressions,reach,shares,saved` | `impressions` (or `reach`), `likes: like_count`, `comments: comments_count`, `shares`, `clicks: saved` |
| **Facebook** | `GET /{post-id}?fields=shares,likes.summary(true),comments.summary(true),insights.metric(post_impressions,post_clicks)` | `impressions: post_impressions`, `likes: likes.summary.total_count`, `comments: comments.summary.total_count`, `shares: shares.count`, `clicks: post_clicks` |
| **YouTube** | `GET https://www.googleapis.com/youtube/v3/videos?part=statistics&id={videoId}` | `impressions: viewCount`, `likes: likeCount`, `comments: commentCount`, `shares: 0`, `clicks: favoriteCount` |
| **TikTok** | `POST https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count` | `impressions: view_count`, `likes: like_count`, `comments: comment_count`, `shares: share_count`, `clicks: 0` |
| **Google Business (`gmb`)** | `POST https://mybusiness.googleapis.com/v4/{locationPath}/localPosts:reportInsights` | `impressions: LOCAL_POST_VIEWS_SEARCH`, `clicks: LOCAL_POST_ACTIONS_CALL_TO_ACTION`, `likes: 0`, `comments: 0`, `shares: 0` |

#### Deterministic Local Dev & Sandbox Fallback
When running in local development without live platform insights permissions, or when a mock/composio token is used (`accessToken.startsWith("mock_")` or `accessToken.startsWith("composio:")` or network call fails in dev mode), `web/lib/social/analytics.ts` computes deterministic, realistic metrics seeded from a SHA-256 hash of ` `${provider}:${externalPostId}` ` so tests and local UI demos are 100% reproducible and never return `NaN` or crash.

---

### 7. UI Upgrades in `/admin/campaigns?tab=social` and `/admin/settings` (`AC-6`)

1. **`/admin/settings` (`web/components/admin/settings/settings-hub-client.tsx` or `social-account-selector-dialog.tsx`)**:
   - Detects `?selectAccount=<provider>` or pending candidates from `getPendingSocialAccountCandidatesAction`.
   - Renders a Haramain Emerald & Gold `@base-ui/react` Dialog listing all discovered Facebook Pages, Instagram Business accounts, YouTube Channels, or GMB Locations with avatar, handle/category, and internal ID.
   - Clicking **"Connect Selected Account"** invokes `selectSocialAccountCandidateAction`.
   - Displays `ACTIVE` (emerald) vs `EXPIRED` (crimson alert with **"Reconnect OAuth"** CTA) status badges and a **"Refresh Expiring Tokens"** diagnostic button calling `runProactiveTokenRefreshAction`.
2. **`/admin/campaigns?tab=social` (`web/components/admin/campaigns/campaigns-hub-client.tsx`)**:
   - **Post Format Selector**: Segmented control for `FEED` (`Feed Post`), `REEL` (`Vertical Reel / Short`), and `STORY` (`24h Story`).
   - **First-Comment Auto-Plug Box**: Textarea for `firstComment` with a 1-click **"Generate ART-... WhatsApp CTA"** button that populates `buildArtFirstCommentPlug(...)` from the selected `postAsset` / package.
   - **Post Analytics Badges & Drawer**: Each published post card displays aggregated `impressions`, `likes`, `comments`, `shares`, and `clicks` with a **"Sync Analytics"** button invoking `syncSocialPostAnalyticsAction({ scheduledPostId })`.

## Build plan

### Milestone 1: Drizzle Schema Extensions, Validation Schemas & Core Types (`AC-1`, `AC-4`, `AC-5`, `AC-7`)
- **Files**:
  - `web/db/schema/social-scheduler.ts`
  - `web/lib/social/types.ts`
  - `web/lib/validations/social-scheduler.ts`
- **Deliverables**:
  - Add `socialIntegrationStatusEnum` (`'ACTIVE' | 'EXPIRED' | 'PENDING_SELECTION'`) and `status` column to `socialIntegrations`.
  - Add `socialPostFormatEnum` (`'FEED' | 'REEL' | 'STORY'`), `postFormat`, and `firstComment` columns to `scheduledPosts`.
  - Add `analyticsData` (`jsonb` typed as `SocialPostAnalyticsData | null`) to `scheduledPostTargets`.
  - Extend `SocialProviderAdapter` (and export `SocialProvider` alias) in `web/lib/social/types.ts` with `SocialPostFormat`, `SocialOAuthAccountCandidate`, `publishComment?`, and `SocialPostAnalyticsData`.
  - Update `createScheduledPostSchema`, `followUpPostSchema`, `selectSocialAccountCandidateSchema`, and `syncSocialPostAnalyticsSchema` in `web/lib/validations/social-scheduler.ts`.

### Milestone 2: Multi-Account OAuth Discovery, Facebook 3-Phase Reels/Stories, IG `resolveReleaseId` & First-Comment Adapters (`AC-1`, `AC-3`, `AC-4`)
- **Files**:
  - `web/lib/social/providers/facebook.ts`
  - `web/lib/social/providers/instagram.ts`
  - `web/lib/social/providers/youtube.ts`
  - `web/lib/social/providers/gmb.ts`
  - `web/lib/social/providers/tiktok.ts`
  - `web/lib/social/first-comment.ts`
- **Deliverables**:
  - Return full `candidates` array in `exchangeCodeForTokens` across `facebook.ts`, `instagram.ts`, `youtube.ts`, and `gmb.ts`.
  - Implement 3-phase Facebook Reels upload (`/video_reels` `start` -> binary transfer -> `finish`) and Facebook Photo/Video Stories (`/photo_stories`, `/video_stories`) in `facebook.ts`.
  - Implement Instagram Stories/Reels format handling and `resolveInstagramReleaseId` (`GET /{ig-user-id}/media`) timeout recovery on error `-2` / `2207051` in `instagram.ts`.
  - Implement `publishComment` on `instagram.ts` (`POST /{media-id}/comments`), `facebook.ts` (`POST /{post-id}/comments`), and `youtube.ts` (`POST /youtube/v3/commentThreads`).
  - Create `web/lib/social/first-comment.ts` with `buildArtFirstCommentPlug`.

### Milestone 3: Proactive Token Refresh Engine, Core 5 Analytics Sync & OAuth/Scheduler Server Actions (`AC-1`, `AC-2`, `AC-4`, `AC-5`)
- **Files**:
  - `web/lib/social/token-refresh.ts`
  - `web/lib/social/analytics.ts`
  - `web/app/api/oauth/social/[provider]/callback/route.ts`
  - `web/app/actions/social-scheduler.ts`
- **Deliverables**:
  - Implement `web/lib/social/token-refresh.ts` (`refreshExpiringSocialTokens`, `refreshSingleSocialIntegrationToken`, `isPermanentOAuthRefreshError`) scanning integrations expiring within 24 hours, re-encrypting tokens via `encryptToken`, and setting `status = 'EXPIRED'` only on permanent `invalid_grant` / `OAuthException 190` errors.
  - Implement `web/lib/social/analytics.ts` (`fetchTargetPostAnalytics`, `buildDeterministicMockAnalytics`) for Instagram, Facebook, TikTok, YouTube, and GMB.
  - Update `/api/oauth/social/[provider]/callback/route.ts` to detect `candidates.length > 1`, store AES-256-GCM encrypted candidates, and redirect to `/admin/settings?tab=connections&selectAccount=${provider}`.
  - Update `web/app/actions/social-scheduler.ts` with `getPendingSocialAccountCandidatesAction`, `selectSocialAccountCandidateAction`, `runProactiveTokenRefreshAction`, `syncSocialPostAnalyticsAction`, and automatic `firstComment` execution inside `executeScheduledPostNowAction`.

### Milestone 4: Admin Campaigns & Settings UI Upgrades (`AC-1`, `AC-4`, `AC-5`, `AC-6`, `AC-7`)
- **Files**:
  - `web/components/admin/settings/settings-hub-client.tsx`
  - `web/components/admin/campaigns/campaigns-hub-client.tsx`
  - `web/app/admin/(dashboard)/settings/page.tsx`
  - `web/app/admin/(dashboard)/campaigns/page.tsx`
- **Deliverables**:
  - Add Multi-Page/Location OAuth Selector modal, `ACTIVE`/`EXPIRED` integration badges, and manual token refresh trigger in `/admin/settings`.
  - Add `postFormat` (`Feed`, `Reel`, `Story`) selector, `firstComment` input with 1-click `ART-...` WhatsApp CTA generator, and Core 5 post analytics badges/drawer with `"Sync Metrics"` button in `/admin/campaigns?tab=social`.
