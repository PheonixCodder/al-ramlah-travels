# 0020. Postiz Phase 3: Visual Calendar & Time-Slot Queue, Per-Platform AI Composer, Reactive Engagement Auto-Plug, and Provider Hardening

**Date**: 2026-11-09
**Status**: Approved

## Summary

This specification defines **Slice 39 (Feature #43)**: the **Postiz Phase 3 Social Publishing Engine** for Al Ramlah Travels. Building upon our native Next.js 16 + Drizzle ORM social scheduler (`Spec 0010`), Phase 2 OAuth/Reels/First-Comment/Analytics engine (`Spec 0014`), and Interactive Core 5 Device Previewer (`Spec 0016`), Phase 3 brings enterprise-grade scheduling, AI content authoring, and platform reliability to `/admin/campaigns?tab=social`.

Specifically, this slice delivers:
1. **Visual Social Calendar & Time-Slot Queue**: A switchable PKT (`Asia/Karachi`, UTC+5) Week/Month calendar grid (`web/components/admin/campaigns/social-calendar-view.tsx`) backed by a pure time-slot calculation engine (`web/lib/social/time-slots.ts`) with default peak Umrah engagement windows (`11:00 AM`, `4:00 PM`, `9:00 PM PKT`), 1-click slot filling, and drag-and-drop / 1-click post rescheduling (`rescheduleSocialPostAction`).
2. **Per-Platform AI Social Caption & Hashtag Copilot**: A multi-channel caption generator (`web/lib/social/caption-copilot.ts`) powered by Vercel AI SDK (`OpenRouter` / `Gemini` with a deterministic luxury Haramain fallback) that drafts tailored captions for Instagram, Facebook, TikTok, YouTube Shorts, and Google Business Profile alongside 3 viral hook options and first-comment conversion copy.
3. **Upgraded Multi-Platform Composer**: Direct R2 drag-and-drop media upload, a **"Pick from Studio Library"** modal listing rendered 4K posters from `postAssets` and `supplierFlyers`, **Per-Platform Caption Override Tabs** (`Global Default` + `Instagram`, `Facebook`, `TikTok`, `YouTube`, `GMB`), and a 1-click **"Queue in Next Free PKT Slot"** button.
4. **Reactive Engagement Auto-Plug**: An automated conversion engine that monitors post performance during analytics sync; when an organic post achieves designated engagement thresholds (e.g. `likes >= 25` or `views >= 500`), the engine automatically injects a high-urgency WhatsApp booking comment (`https://wa.me/923274029701?text=ART-...`) on Instagram, Facebook, and YouTube without manual operator intervention.
5. **Provider Hardening**:
   - **Instagram Video Carousels**: Container polling (`GET /{childContainerId}?fields=status_code`) ensuring all video child containers reach `FINISHED` status before parent `CAROUSEL` container assembly to eliminate Graph API error `2207028` ("Carousel validation failed").
   - **TikTok Permalink Resolution**: Asynchronous polling of `POST https://open.tiktokapis.com/v2/post/publish/status/fetch/` with `publish_id` to resolve `publicaly_available_post_id`, transforming temporary upload tokens into live TikTok permalinks.

---

## Context

In Slices 29, 33, and 35 (`Specs 0010`, `0014`, and `0016`), Al Ramlah Travels ported the Core 5 social media adapters (`instagram`, `facebook`, `tiktok`, `youtube`, `gmb`) natively into Next.js 16 and Drizzle ORM on Neon Serverless PostgreSQL. Agency administrators can connect accounts via multi-page OAuth, publish 4K images, carousels, and vertical Reels/Stories, auto-plug `ART-...` first comments, preview posts on realistic device mockups, and inspect cross-channel analytics.

However, five operational friction points remain when operating social marketing at scale:

1. **Manual & Inefficient Scheduling**:
   - Operators currently schedule posts using an unconstrained native datetime input (`<Input type="datetime-local">`), requiring them to manually calculate optimal audience windows for Pakistan pilgrims.
   - There is no visual calendar view; operators can only browse a linear list queue, making it difficult to spot campaign gaps across upcoming weeks, Ramadan campaign schedules, or Umrah departure dates.
   - Upstream Postiz provides a dedicated time-slot table and calendar view (`time.table.tsx` and `calendar.tsx`) where posts snap to predefined peak posting times. Al Ramlah Travels requires a native Pakistan Standard Time (`Asia/Karachi`) slot engine to eliminate scheduling guesswork.

2. **One-Size-Fits-All Captions**:
   - The current composer uses a single global `caption` for all selected channels.
   - In practice, each network demands radically distinct formatting:
     - **Instagram**: Rich narrative, line breaks, emojis, 15–25 hashtags, link-in-bio or first-comment CTA (caption links are unclickable).
     - **Facebook**: Community-focused, clickable `https://wa.me/...` links directly in the body, full quad/triple/double pricing table.
     - **TikTok**: Punchy, short 100-character hook above the fold, high-velocity discovery tags (`#umrah #makkah`), concise pricing.
     - **YouTube Shorts**: Catchy title ($\le 100$ chars) with `#Shorts`, descriptive body ($\le 5000$ chars) with office NAP and helpline numbers.
     - **Google Business Profile**: Verified local update format with Askari 10 & DHA Lahore NAP consistency, offer summary ($\le 1500$ chars), and native `"Book"` / `"Learn More"` WhatsApp CTA button.
   - Operators need per-platform caption overrides that sync with the live device previewer.

3. **No Automated AI Copywriting for Umrah Packages**:
   - Creating engaging copy for 10+ weekly supplier flyers requires substantial manual typing. While Al Ramlah Travels has Vercel AI SDK infrastructure in `lib/ai/` (`quoting-copilot.ts`), the social scheduler has no AI copy generator to draft platform-adapted copy, hooks, and first comments from package metadata.

4. **Media Friction (Manual URL Copying)**:
   - To publish a 4K poster rendered in the Multimodal Studio (`/admin/studio`), operators must navigate away, copy the R2 URL, and paste it into the custom media input. There is no in-composer studio asset browser or direct R2 drag-and-drop dropzone.

5. **Provider Edge-Case Vulnerabilities**:
   - **Instagram Carousel with Video**: When a carousel contains both images and MP4 videos, Meta's Graph API processes video child containers asynchronously. Creating the parent `CAROUSEL` container immediately after creating child containers causes Meta to reject the request with code `2207028` ("Carousel validation failed") because the video container is still `IN_PROGRESS`.
   - **TikTok Video Permalinks**: TikTok's Direct Post API v2 returns a `publish_id` (e.g., `v_pub_file~...`), not the permanent public video ID (`publicaly_available_post_id`). Current code constructs the URL using `publish_id`, resulting in broken links until TikTok completes asynchronous content moderation.
   - **Reactive Engagement Drop-Off**: Posts that go viral organically often lose conversion momentum because staff cannot monitor comment sections 24/7. An automated mechanism is needed to detect engagement spikes and post a secondary urgency CTA.

---

## Requirements

### User Stories

- **As a social media manager**, I want a Visual Week and Month Social Calendar in PKT so that I can visualize our weekly publishing cadence, spot unscheduled days, and reschedule posts by dragging them or clicking open slots.
- **As a marketing operator**, I want a 1-click "Queue in Next Free PKT Slot" button (`11:00 AM`, `4:00 PM`, `9:00 PM PKT`) so that new posts automatically line up at peak Pakistani browsing hours without manual timestamp entry.
- **As a content creator**, I want an AI Caption Copilot that ingests package pricing, hotels, and airline details and generates 5 platform-optimized captions, 3 viral hooks, and a conversion first comment with one click.
- **As an admin**, I want Per-Platform Caption Override Tabs in the composer so that I can tweak the TikTok caption or YouTube title independently while keeping the global default intact, with live preview updates on each tab.
- **As a studio operator**, I want to pick rendered 4K posters and supplier flyers directly from a Studio Media Library modal inside the composer, or drag and drop new media to R2, eliminating manual URL copying.
- **As a conversion marketer**, I want a Reactive Engagement Auto-Plug that automatically comments on posts reaching engagement milestones (e.g., 25 likes or 500 views) with a high-urgency WhatsApp booking CTA.
- **As a platform reliability engineer**, I want Instagram video carousels to poll child containers until `FINISHED` before parent creation, and TikTok posts to resolve `publicaly_available_post_id`, preventing publishing failures and dead permalinks.

---

### Acceptance Criteria

- **AC-1: Schema Extensions & Zod Validation**:
  - Add `platformCaptions` (`jsonb`, default `{}`) on `scheduledPosts` typed as `Partial<Record<SocialProviderId, { caption?: string; firstComment?: string }>>`.
  - Add `engagementPlugConfig` (`jsonb`, nullable, default `null`) on `scheduledPosts` typed as `{ enabled: boolean; minLikes: number; minViews: number; plugText: string; triggeredAt?: string }`.
  - Update `createScheduledPostSchema`, `scheduleSocialPostSchema`, and server action types in `web/lib/validations/social-scheduler.ts` to validate these new properties.

- **AC-2: Instagram Video Carousel Hardening**:
  - In `web/lib/social/providers/instagram.ts`, when publishing a carousel containing one or more video attachments (`media_type: "VIDEO"`), the adapter must poll `GET /{childContainerId}?access_token={token}&fields=status_code` for each video child container.
  - Polling must repeat every 2 seconds up to 30 attempts (60s total) until `status_code === "FINISHED"`.
  - If any container returns `status_code === "ERROR"` or `"EXPIRED"`, abort immediately with a non-retryable error descriptive of the failure.
  - Only after all video child containers reach `FINISHED` may the adapter call `POST /{igUserId}/media` with `media_type=CAROUSEL` and `children`.

- **AC-3: TikTok Publish Status & Permalink Resolution**:
  - In `web/lib/social/providers/tiktok.ts`, implement `resolveTikTokPublishedPostId(params: { accessToken: string; publishId: string; username?: string })`.
  - The function must query `POST https://open.tiktokapis.com/v2/post/publish/status/fetch/` with `{ publish_id }`.
  - When TikTok returns `status === "PUBLISH_COMPLETE"` and `publicaly_available_post_id`, extract the first public ID and construct the canonical permalink: `https://www.tiktok.com/@{username}/video/{publicPostId}`.
  - Wire this resolution into `syncSocialPostAnalytics` in `web/lib/social/analytics.ts` so that published TikTok targets with `externalPostId` starting with `v_pub_file~` or `p_pub_url~` update to the permanent video ID and live permalink.

- **AC-4: Pure PKT Time-Slot Queue Engine (`web/lib/social/time-slots.ts`)**:
  - Define `DEFAULT_PKT_POSTING_SLOTS = ["11:00", "16:00", "21:00"]` (11:00 AM, 4:00 PM, 9:00 PM PKT, `Asia/Karachi`, UTC+5).
  - Implement `findNextFreePostingSlot(existingScheduledDates: Date[], now?: Date, customSlots?: string[]): Date`:
    - Evaluates future slots for today starting from `now` (with a 15-minute lead buffer).
    - If a slot has no existing post scheduled within $\pm 30$ minutes, selects it.
    - If all slots today are occupied or in the past, advances day-by-day to find the first open slot.
    - Returns the exact UTC `Date`.
  - Implement calendar bucketing helpers:
    - `formatPktDate(date: Date | string, formatStr?: string): string`
    - `bucketPostsByPktDate(posts: ScheduledPostWithTargets[]): Map<string, ScheduledPostWithTargets[]>`
    - `generateCalendarGridDays(year: number, month: number): CalendarDayCell[]` (35 or 42 cells starting Monday)
    - `generateWeekGridDays(anchorDate: Date): CalendarDayCell[]` (7 cells Monday to Sunday).

- **AC-5: AI Social Caption & Hashtag Copilot (`web/lib/social/caption-copilot.ts`)**:
  - Implement `generateSocialCaptionsCopilot(input: GenerateSocialCaptionsInput): Promise<GeneratedPlatformCaptionsResult>`.
  - Uses Vercel AI SDK (`generateText` + `Output.object`) with candidates `openrouter("google/gemini-2.5-flash")` and `google("gemini-2.5-flash")`.
  - Generates:
    - 3 distinct hook variations (Urgency/Economy, Luxury VIP, Spiritual Umrah).
    - Platform-specific captions for `instagram`, `facebook`, `tiktok`, `youtube`, and `gmb` respecting character folds, tone, hashtags, and CTA format.
    - Suggested first-comment text with `ART-...` code and WhatsApp link.
  - When no API keys are present (`OPENROUTER_API_KEY` and `GEMINI_API_KEY` missing), fall back to a deterministic luxury Haramain generator that produces complete, high-quality, branded captions without errors.

- **AC-6: Reactive Engagement Auto-Plug & Analytics Engine Integration**:
  - Wire `fetchPostAnalytics` onto all `SocialProviderAdapter` instances in `web/lib/social/providers/`.
  - In `syncSocialPostAnalytics` (`web/lib/social/analytics.ts`), after metrics are fetched:
    - Check if the parent post has `engagementPlugConfig?.enabled === true` and `!engagementPlugConfig.triggeredAt`.
    - Sum current `likes` and `views` across published targets.
    - If `likes >= minLikes` or `views >= minViews`, iterate over published targets for platforms supporting comments (`instagram`, `facebook`, `youtube`).
    - If `adapter.publishComment` is available, publish `engagementPlugConfig.plugText`.
    - Update `scheduledPosts.engagementPlugConfig` with `triggeredAt: new Date().toISOString()`.

- **AC-7: Upgraded Multi-Platform Composer & Server Actions**:
  - Implement Server Actions in `web/app/actions/social-scheduler.ts`:
    - `generateSocialCaptionsCopilotAction(input: GenerateSocialCaptionsInput)`
    - `rescheduleSocialPostAction(input: { postId: string; newScheduledFor: Date | string })`
    - `getNextFreeSocialSlotAction(input?: { customSlots?: string[] })`
    - `listStudioMediaLibraryAssetsAction(filter?: { kind?: string; search?: string; limit?: number })`
  - In `campaigns-hub-client.tsx`:
    - Add drag-and-drop R2 media upload with upload progress.
    - Add **"Pick from Studio Library"** button opening `StudioMediaPickerModal`.
    - Add **Per-Platform Caption Override Tabs** (`Global Default`, `Instagram`, `Facebook`, `TikTok`, `YouTube`, `GMB`) updating `platformCaptions` state and syncing with `SocialPlatformPreview`.
    - Add **"AI Generate Platform Captions"** button triggering `generateSocialCaptionsCopilotAction`.
    - Add **"Queue in Next Free PKT Slot"** button auto-filling the scheduled date.
    - Add optional **Reactive Engagement Auto-Plug** toggle with configurable thresholds.

- **AC-8: Visual PKT Week/Month Social Calendar View (`web/components/admin/campaigns/social-calendar-view.tsx`)**:
  - In `/admin/campaigns?tab=social`, add a view toggle: **[ List Queue ]** vs **[ Visual Calendar ]**.
  - Render an interactive calendar supporting **Week** and **Month** views in Pakistan Standard Time (`Asia/Karachi`).
  - Render post thumbnail chips with post code, platform badges, status color pills, and time in PKT.
  - Render empty PKT slot buttons (`+ 11:00 AM`, `+ 4:00 PM`, `+ 9:00 PM`) that pre-fill the composer for that time.
  - Support 1-click or drag-and-drop rescheduling calling `rescheduleSocialPostAction`.

- **AC-9: Comprehensive Unit & Integration Tests**:
  - Create `web/tests/social-phase3-calendar-copilot-and-providers.test.ts` verifying time-slot calculations, calendar bucketing, AI copilot fallback output, Instagram video polling logic, TikTok status resolution, and reactive engagement plug threshold triggers.

---

## Options Considered

### Option 1: Integrate an External Social Management SaaS (Buffer / Later / Postiz Cloud Container)
Offload calendar scheduling, AI caption generation, and media queueing to an external third-party API or self-hosted Postiz Docker container.

- **Pros**: Off-the-shelf UI and calendar features.
- **Cons**: Requires running external NestJS/Redis/Prisma services, adds monthly subscription costs, breaks our unified Next.js 16 + Neon PostgreSQL architecture, and prevents custom integration with Al Ramlah's `ART-...` quoting engine, WaCRM leads, and Gotenberg 4K posters.

### Option 2 (Chosen): Native Drizzle ORM Schema Extensions + Pure PKT Slot Engine + Vercel AI SDK Copilot + Base UI Components
Extend `scheduledPosts` with `platformCaptions` and `engagementPlugConfig`, build a zero-dependency PKT time-slot queue engine (`web/lib/social/time-slots.ts`), implement AI caption generation via Vercel AI SDK (`web/lib/social/caption-copilot.ts`) with deterministic fallback, harden Instagram carousel polling and TikTok status fetch, and surface an interactive Visual Calendar (`web/components/admin/campaigns/social-calendar-view.tsx`) and Studio Media Library picker directly in `/admin/campaigns?tab=social`.

- **Pros**:
  - Zero external service or container overhead; 100% native Next.js 16 App Router and Drizzle ORM.
  - Tailored to Al Ramlah Travels domain invariants (PKT time slots, luxury Haramain aesthetic, `ART-...` post codes, Askari 10 & DHA Lahore NAP).
  - 100% deterministic testability with Vitest; runs in local development without active API keys.
  - Reuses existing UI foundations (`base-nova` preset, `@base-ui/react`, Tailwind CSS v4).
- **Cons**:
  - Requires implementing custom calendar grid rendering and time calculation logic.

### Option 3: Separate Background Worker Cron Polling Every Minute
Use a persistent background cron that wakes up every minute to check if social posts need comments or rescheduling.

- **Pros**: Familiar cron architecture.
- **Cons**: High database query churn on serverless Neon PostgreSQL; reactive engagement checks are naturally triggered during periodic analytics sync without needing extra cron workers.

---

## Decision

**Chosen Option**: **Option 2**. We will natively build the Phase 3 Social Calendar, Time-Slot Queue, AI Copilot, Reactive Engagement Auto-Plug, and Provider Hardening directly into `web/lib/social/`, `web/db/schema/social-scheduler.ts`, and `web/components/admin/campaigns/`.

---

## Architecture and Technical Design

```
+-------------------------------------------------------------------------------------------------------------+
|                                    /admin/campaigns?tab=social                                              |
|                                                                                                             |
|  +-------------------------------------+  +--------------------------------------------------------------+  |
|  |     Core 5 Social Post Composer     |  |                 Social Calendar & Queue                      |  |
|  |                                     |  |                                                              |  |
|  |  [ Studio Media Picker ] [ R2 Drop ] |  |  View: [ List Queue ] | [ Visual Calendar (Week / Month) ]   |  |
|  |  ---------------------------------  |  |  ----------------------------------------------------------  |  |
|  |  Platform Caption Tabs:             |  |   Mon (PKT)     Tue (PKT)     Wed (PKT)     Thu (PKT) ...     |  |
|  |  [ Global ] [ IG ] [ FB ] [ TT ]... |  |  +-----------+ +-----------+ +-----------+ +-----------+     |  |
|  |  ---------------------------------  |  |  | [11:00 AM]| | [ART-01]  | | [11:00 AM]| | [ART-03]  |     |  |
|  |  [ ✨ AI Generate Captions & Hooks ]|  |  | + Slot    | | IG Reel   | | + Slot    | | FB Carousel |   |
|  |  [ ⚡ Queue Next Free PKT Slot ]    |  |  | [16:00 PM]| | [16:00 PM]| | [ART-02]  | | [16:00 PM]|     |  |
|  |  [x] Reactive Engagement Auto-Plug  |  |  | [21:00 PM]| | [21:00 PM]| | [21:00 PM]| | [21:00 PM]|     |  |
|  +-------------------------------------+  +--------------------------------------------------------------+  |
+-------------------------------------------------------------------------------------------------------------+
                                      |                                  |
                                      v                                  v
+------------------------------------------------------+  +---------------------------------------------------+
|               Server Actions & API                   |  |             lib/social Services                   |
|                                                      |  |                                                   |
| - generateSocialCaptionsCopilotAction                |  | - caption-copilot.ts (AI SDK + Luxury Fallback)   |
| - rescheduleSocialPostAction                         |  | - time-slots.ts (PKT Slot Queue & Grid Helpers)   |
| - getNextFreeSocialSlotAction                        |  | - analytics.ts (Reactive Engagement Auto-Plug)    |
| - listStudioMediaLibraryAssetsAction                 |  | - providers/instagram.ts (Video Carousel Polling) |
| - syncSocialPostAnalyticsAction                      |  | - providers/tiktok.ts (Status & Permalink Fetch)  |
+------------------------------------------------------+  +---------------------------------------------------+
                                      |                                  |
                                      +-----------------+----------------+
                                                        |
                                                        v
                                          +---------------------------+
                                          |   Neon PostgreSQL (Drizzle)|
                                          | - scheduledPosts          |
                                          |   + platformCaptions      |
                                          |   + engagementPlugConfig  |
                                          | - scheduledPostTargets    |
                                          | - postAssets / flyers     |
                                          +---------------------------+
```

---

### 1. Schema Extensions & Data Model

We update `web/db/schema/social-scheduler.ts` and `web/lib/social/types.ts`:

```typescript
// web/lib/social/types.ts

export interface PlatformCaptionOverride {
  caption?: string
  firstComment?: string
}

export type PlatformCaptionsMap = Partial<
  Record<SocialProviderId, PlatformCaptionOverride>
>

export interface EngagementPlugConfig {
  enabled: boolean
  minLikes: number
  minViews: number
  plugText: string
  triggeredAt?: string
}

// Extension to SocialPostPayload
export interface SocialPostPayload {
  id: string
  caption: string
  media: SocialMediaItem[]
  postType?: SocialPostType
  postFormat?: SocialPostFormat
  firstComment?: string | null
  platformCaptions?: PlatformCaptionsMap
  engagementPlugConfig?: EngagementPlugConfig | null
  title?: string
  callToActionUrl?: string
  callToActionType?: CallToActionActionType
  offerDetails?: SocialOfferDetails
  settings?: Record<string, unknown>
}
```

```typescript
// web/db/schema/social-scheduler.ts

export const scheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postAssetId: uuid("post_asset_id").references(() => postAssets.id, {
      onDelete: "set null",
    }),
    caption: text("caption").notNull(),
    postType: scheduledPostTypeEnum("post_type")
      .notNull()
      .default("single_image"),
    postFormat: socialPostFormatEnum("post_format")
      .notNull()
      .default("FEED"),
    firstComment: text("first_comment"),
    platformCaptions: jsonb("platform_captions")
      .$type<PlatformCaptionsMap>()
      .notNull()
      .default({}),
    engagementPlugConfig: jsonb("engagement_plug_config")
      .$type<EngagementPlugConfig | null>()
      .default(null),
    mediaUrls: jsonb("media_urls").$type<string[]>().notNull().default([]),
    socialJpegUrls: jsonb("social_jpeg_urls")
      .$type<string[]>()
      .notNull()
      .default([]),
    campaignStage: scheduledPostCampaignStageEnum("campaign_stage")
      .notNull()
      .default("standalone"),
    pairedFollowUpPostId: uuid("paired_follow_up_post_id"),
    twoStepDelayMinutes: integer("two_step_delay_minutes")
      .notNull()
      .default(180),
    status: scheduledPostStatusEnum("status").notNull().default("draft"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    triggerRunId: text("trigger_run_id"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_scheduled_posts_scheduled_for").on(table.scheduledFor),
    index("idx_scheduled_posts_status").on(table.status),
    index("idx_scheduled_posts_post_asset").on(table.postAssetId),
    index("idx_scheduled_posts_trigger_run").on(table.triggerRunId),
  ]
)
```

---

### 2. Provider Hardening

#### A. Instagram Video Carousel Polling (`web/lib/social/providers/instagram.ts`)

When creating an Instagram carousel containing video attachments:

```typescript
// Poll a single child video container until status_code === "FINISHED"
export async function pollInstagramContainerFinished(params: {
  containerId: string
  accessToken: string
  maxAttempts?: number
  delayMs?: number
}): Promise<void> {
  const { containerId, accessToken, maxAttempts = 30, delayMs = 2000 } = params

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(
      `${GRAPH_BASE_URL}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(
        accessToken
      )}`
    )
    if (!res.ok) {
      throw new Error(`Failed to check container ${containerId} status (${res.status})`)
    }

    const data = (await res.json()) as { status_code?: string; status?: string }
    const code = data.status_code?.toUpperCase()

    if (code === "FINISHED") {
      return // Ready for parent carousel container creation
    }

    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(
        `Instagram video container ${containerId} processing failed with status: ${code}`
      )
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw new Error(
    `Instagram video container ${containerId} timed out after ${maxAttempts * (delayMs / 1000)}s`
  )
}
```

In `instagramProvider.publishPost`:
- After creating child containers with `is_carousel_item: "true"`, inspect which child containers were created with `media_type: "VIDEO"`.
- For each video child container, invoke `pollInstagramContainerFinished`.
- Only when all finish successfully, call `POST /{igUserId}/media` with `media_type=CAROUSEL` and `children`.

#### B. TikTok Publish Status & Permalink Resolution (`web/lib/social/providers/tiktok.ts`)

```typescript
export interface TikTokPublishStatusResult {
  status: "PUBLISH_COMPLETE" | "PROCESSING_DOWNLOAD" | "PROCESSING_UPLOAD" | "FAILED" | "UNKNOWN"
  publicPostId?: string
  publishedUrl?: string
  failReason?: string
}

export async function resolveTikTokPublishedPostId(params: {
  accessToken: string
  publishId: string
  username?: string
}): Promise<TikTokPublishStatusResult> {
  const { accessToken, publishId, username } = params

  try {
    const res = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ publish_id: publishId }),
      }
    )

    if (!res.ok) {
      return { status: "UNKNOWN", failReason: `HTTP ${res.status}` }
    }

    const data = (await res.json()) as {
      data?: {
        status?: string
        publicaly_available_post_id?: string[]
        fail_reason?: string
      }
      error?: { code: string; message: string }
    }

    const statusStr = data.data?.status || "UNKNOWN"
    const publicPostIds = data.data?.publicaly_available_post_id
    const publicPostId = Array.isArray(publicPostIds) && publicPostIds.length > 0 ? publicPostIds[0] : undefined

    let publishedUrl: string | undefined
    if (publicPostId) {
      const userHandle = username ? username.replace(/^@+/, "") : "alramlahtravels"
      publishedUrl = `https://www.tiktok.com/@${userHandle}/video/${publicPostId}`
    }

    return {
      status: (statusStr as TikTokPublishStatusResult["status"]) || "UNKNOWN",
      publicPostId,
      publishedUrl,
      failReason: data.data?.fail_reason,
    }
  } catch (err) {
    return {
      status: "UNKNOWN",
      failReason: err instanceof Error ? err.message : String(err),
    }
  }
}
```

---

### 3. Pure PKT Time-Slot Queue Engine (`web/lib/social/time-slots.ts`)

Pakistan Standard Time (`PKT`) is fixed at `UTC+5` (`Asia/Karachi`) with no Daylight Saving Time.

```typescript
export const PKT_TIMEZONE = "Asia/Karachi"
export const PKT_UTC_OFFSET_HOURS = 5
export const DEFAULT_PKT_POSTING_SLOTS = ["11:00", "16:00", "21:00"] as const

export interface CalendarDayCell {
  dateKey: string // "YYYY-MM-DD" in PKT
  dayNumber: number
  month: number
  year: number
  isCurrentMonth: boolean
  isToday: boolean
  dateUtcStart: Date
}

export function parsePktSlotToUtc(dateKey: string, timeSlot: string): Date {
  const [hours, minutes] = timeSlot.split(":").map(Number)
  const [year, month, day] = dateKey.split("-").map(Number)
  // Construct UTC equivalent: PKT is UTC+5, so UTC hour = hours - 5
  return new Date(Date.UTC(year, month - 1, day, hours - PKT_UTC_OFFSET_HOURS, minutes, 0, 0))
}

export function formatPktDateKey(date: Date): string {
  // Format as YYYY-MM-DD in Asia/Karachi
  const pktMs = date.getTime() + PKT_UTC_OFFSET_HOURS * 3600 * 1000
  const d = new Date(pktMs)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatPktTime(date: Date): string {
  const pktMs = date.getTime() + PKT_UTC_OFFSET_HOURS * 3600 * 1000
  const d = new Date(pktMs)
  const hours = String(d.getUTCHours()).padStart(2, "0")
  const mins = String(d.getUTCMinutes()).padStart(2, "0")
  return `${hours}:${mins}`
}

/**
 * Finds the next available posting slot from DEFAULT_PKT_POSTING_SLOTS.
 * Ensures a minimum 15-minute future buffer and prevents collision within +/- 30 minutes
 * of any existing scheduled post.
 */
export function findNextFreePostingSlot(
  existingScheduledDates: Date[],
  now: Date = new Date(),
  customSlots: readonly string[] = DEFAULT_PKT_POSTING_SLOTS
): Date {
  const minLeadMs = 15 * 60 * 1000 // 15 mins lead time
  const minLeadTime = new Date(now.getTime() + minLeadMs)
  const collisionToleranceMs = 30 * 60 * 1000 // 30 mins collision window

  // Check up to 14 days ahead
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const checkDateMs = now.getTime() + dayOffset * 24 * 3600 * 1000
    const dateKey = formatPktDateKey(new Date(checkDateMs))

    for (const slot of customSlots) {
      const candidateUtc = parsePktSlotToUtc(dateKey, slot)

      if (candidateUtc.getTime() <= minLeadTime.getTime()) {
        continue // Slot is in the past or within 15 mins
      }

      // Check collision
      const hasCollision = existingScheduledDates.some((existing) => {
        return Math.abs(existing.getTime() - candidateUtc.getTime()) < collisionToleranceMs
      })

      if (!hasCollision) {
        return candidateUtc
      }
    }
  }

  // Fallback: 24h from now at 11:00 AM PKT
  const fallbackKey = formatPktDateKey(new Date(now.getTime() + 24 * 3600 * 1000))
  return parsePktSlotToUtc(fallbackKey, "11:00")
}
```

---

### 4. AI Social Caption & Hashtag Copilot (`web/lib/social/caption-copilot.ts`)

```typescript
export interface GenerateSocialCaptionsInput {
  postCode?: string
  title?: string
  campaignStage?: "step_1_spotlight_hook" | "step_2_all_packages" | "standalone"
  postFormat?: "FEED" | "REEL" | "STORY"
  sharingPricePkr?: number | null
  quadPricePkr?: number | null
  triplePricePkr?: number | null
  doublePricePkr?: number | null
  makkahHotelName?: string | null
  madinahHotelName?: string | null
  nightsMakkah?: number | null
  nightsMadinah?: number | null
  airlineName?: string | null
  customNotes?: string | null
}

export interface GeneratedPlatformCaptionsResult {
  hooks: [string, string, string]
  captions: {
    instagram: { caption: string; firstComment: string }
    facebook: { caption: string; firstComment: string }
    tiktok: { caption: string; firstComment?: string }
    youtube: { caption: string; firstComment: string; title: string }
    gmb: { caption: string; callToActionType: "BOOK" | "LEARN_MORE" }
  }
  globalDefault: string
  suggestedFirstComment: string
  modelUsed: string
}
```

#### Deterministic Luxury Haramain Fallback

When neither `OPENROUTER_API_KEY` nor `GEMINI_API_KEY` is present, the module generates complete, branded copy deterministically:

- **Hook 1**: "Labbaik Allahumma Labbaik — Complete VIP Umrah Journey 2026."
- **Hook 2**: "Executive Umrah at Economy Pricing — Direct Flights & 5-Star Haramain Comfort."
- **Hook 3**: "Limited Ramadan & Season Slots — Reserve Your Sacred Pilgrimage Today."
- **Instagram**: Formatted with Bismillah header, hotel walk distances, clean bullet points, 18 hashtags, and "👇 Link in Bio / First Comment to Book".
- **Facebook**: Full room-sharing PKR matrix, WhatsApp helpline buttons (`03274029701`), office address (`Askari 10 & DHA Lahore`).
- **TikTok**: Short 80-character hook, bullet price, `#umrah #makkah #madinah #alramlahtravels`.
- **YouTube Shorts**: Title `[ART] Luxury Umrah 2026 Package | Al Ramlah Travels #Shorts`, description with full itinerary and helpline.
- **GMB**: Local business update format emphasizing Askari 10 & DHA Lahore office consultation with a direct WhatsApp booking link.

---

### 5. Reactive Engagement Auto-Plug & Analytics Engine

During `syncSocialPostAnalytics` in `web/lib/social/analytics.ts`:

```typescript
// 1. Evaluate engagement plug after syncing metrics
if (post.engagementPlugConfig?.enabled && !post.engagementPlugConfig.triggeredAt) {
  const { minLikes, minViews, plugText } = post.engagementPlugConfig
  const totalLikes = syncedList.reduce((acc, t) => acc + (t.analytics.likes || 0), 0)
  const totalViews = syncedList.reduce((acc, t) => acc + (t.analytics.impressions || 0), 0)

  if (totalLikes >= minLikes || totalViews >= minViews) {
    const plugEligibleTargets = rows.filter(
      (r) =>
        r.target.status === "published" &&
        r.target.externalPostId &&
        ["instagram", "facebook", "youtube"].includes(r.integration.provider)
    )

    for (const { target, integration } of plugEligibleTargets) {
      try {
        const adapter = getSocialProvider(integration.provider as SocialProviderId)
        if (adapter.publishComment) {
          const decryptedToken = decryptToken(integration.encryptedAccessToken)
          await adapter.publishComment({
            accessToken: decryptedToken,
            externalPostId: target.externalPostId!,
            commentText: plugText,
            accountId: integration.internalAccountId,
            metadata: integration.metadata,
          })
        }
      } catch (err) {
        // Log comment error without failing the analytics sync
      }
    }

    // Stamp triggeredAt to prevent duplicate plug execution
    await db
      .update(scheduledPosts)
      .set({
        engagementPlugConfig: {
          ...post.engagementPlugConfig,
          triggeredAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, post.id))
  }
}
```

---

### 6. Studio Media Library Picker & Server Actions

In `web/app/actions/social-scheduler.ts`, we introduce:

1. `generateSocialCaptionsCopilotAction(input: GenerateSocialCaptionsInput)`
2. `rescheduleSocialPostAction(input: { postId: string; newScheduledFor: Date | string })`:
   - Validates admin auth.
   - Updates `scheduledFor` on `scheduledPosts` when post is in `scheduled` or `draft` status.
   - If `triggerRunId` exists and Trigger.dev Cloud is configured, reschedules the scheduled task run.
3. `getNextFreeSocialSlotAction(input?: { customSlots?: string[] })`:
   - Queries active scheduled posts within the next 14 days.
   - Calls `findNextFreePostingSlot`.
   - Returns `{ nextSlotUtc: string; pktLabel: string }`.
4. `listStudioMediaLibraryAssetsAction(filter?: { kind?: string; search?: string; limit?: number })`:
   - Queries `postAssets` joined with `suppliers` and `supplierFlyers`.
   - Returns array of `{ id, postCode, title, imageUrl, pdfUrl, kind, supplierName, createdAt }` for 1-click insertion into the composer.

---

### 7. Upgraded Multi-Platform Composer

The composer inside `web/components/admin/hubs/campaigns-hub-client.tsx` is enhanced with:
- **Studio Media Picker Modal**: Opens `web/components/admin/campaigns/studio-media-picker-modal.tsx`, displaying 4K posters and flyers with a search filter. Clicking an item sets `selectedAssetId` and populates `mediaUrls` with the high-resolution URL.
- **R2 Drag-and-Drop Dropzone**: Direct file uploader using `/api/uploads/presign` to push images and MP4 videos directly to Cloudflare R2, automatically appending the resulting URL to `mediaUrls`.
- **Per-Platform Caption Tabs**: Tabs for `Global Default`, `Instagram`, `Facebook`, `TikTok`, `YouTube`, and `GMB`. Modifying a tab stores the override in `platformCaptions[provider]`. The embedded `SocialPlatformPreview` reflects the specific tab's copy in real time.
- **"AI Generate Platform Captions" Button**: Calls `generateSocialCaptionsCopilotAction` and fills the global caption plus all 5 platform override tabs simultaneously.
- **"Queue in Next Free PKT Slot" Button**: Fetches `getNextFreeSocialSlotAction` and sets `scheduledDateTime` to the next open peak window (`11:00 AM`, `4:00 PM`, or `9:00 PM PKT`).
- **Reactive Engagement Auto-Plug Toggle**: Switch to enable the auto-comment feature with inputs for `minLikes` (default: 25), `minViews` (default: 500), and `plugText`.

---

### 8. Visual Week/Month Social Calendar View (`web/components/admin/campaigns/social-calendar-view.tsx`)

A dedicated component in `/admin/campaigns?tab=social`:
- **View Toggle**: Segmented control switching between **[ List Queue ]** and **[ Visual Calendar ]**.
- **Calendar Mode**: Buttons to toggle between **Week** (7 days, hourly slot rows) and **Month** (35-42 day grid).
- **Navigation**: Previous / Today / Next buttons with header displaying the active month/year in PKT.
- **Day Cells**:
  - Displays day number and highlights today.
  - Lists scheduled and published posts as compact cards showing post thumbnail, post code, platform icons, and PKT time badge.
  - Displays empty peak time-slot buttons (`+ 11:00 AM`, `+ 4:00 PM`, `+ 9:00 PM PKT`). Clicking an empty slot opens the composer pre-filled with that date and time.
- **Rescheduling**: Supports 1-click modal or drag-and-drop to move a post to a different day/slot via `rescheduleSocialPostAction`.

---

## Build Plan

```
+--------------------------------------------------------------------------------------------------+
| Milestone 1: Schema, Hardening & Slot Engine                                                     |
| [x] Drizzle schema extensions (platformCaptions, engagementPlugConfig) & Zod validations         |
| [x] Instagram carousel video child container polling loop (status_code === 'FINISHED')           |
| [x] TikTok publish status fetch & permalink resolver (resolveTikTokPublishedPostId)              |
| [x] Pure PKT time-slot queue calculation engine (web/lib/social/time-slots.ts)                   |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
| Milestone 2: AI Copilot, Reactive Auto-Plug & Server Actions                                     |
| [x] AI social caption & hashtag copilot (caption-copilot.ts) with luxury Haramain fallback       |
| [x] Reactive engagement plug evaluation in syncSocialPostAnalytics                               |
| [x] Server actions: generateSocialCaptionsCopilotAction, rescheduleSocialPostAction,             |
|     getNextFreeSocialSlotAction, listStudioMediaLibraryAssetsAction                              |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
| Milestone 3: Upgraded Multi-Platform Composer & Studio Picker                                    |
| [x] Studio media library picker modal (studio-media-picker-modal.tsx)                             |
| [x] R2 drag-and-drop dropzone in composer                                                        |
| [x] Per-platform caption override tabs synced live with SocialPlatformPreview                    |
| [x] 1-click AI caption generation & 1-click Next Free PKT Slot queueing                          |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
| Milestone 4: Visual Week/Month Social Calendar & Unit Test Suite                                 |
| [x] Interactive PKT Social Calendar View (social-calendar-view.tsx) in /admin/campaigns         |
| [x] Empty peak slot insertion & 1-click/DnD post rescheduling                                    |
| [x] Comprehensive unit tests (tests/social-phase3-calendar-copilot-and-providers.test.ts)        |
+--------------------------------------------------------------------------------------------------+
```

### Milestone 1: Schema Extensions, Provider Hardening (IG Video Carousel Polling & TikTok Publish Status) & Time-Slot Queue Calculator

**Deliverables**:
1. `web/db/schema/social-scheduler.ts`:
   - Add `platformCaptions` (`jsonb`, default `{}`) on `scheduledPosts`.
   - Add `engagementPlugConfig` (`jsonb`, default `null`) on `scheduledPosts`.
2. `web/lib/validations/social-scheduler.ts`:
   - Add `platformCaptionsSchema` and `engagementPlugConfigSchema`.
   - Update `createScheduledPostSchema` and `scheduleSocialPostSchema`.
3. `web/lib/social/providers/instagram.ts`:
   - Add `pollInstagramContainerFinished` to poll video child containers in carousels until `status_code === "FINISHED"`.
   - Abort with non-retryable error if container status is `"ERROR"` or `"EXPIRED"`.
4. `web/lib/social/providers/tiktok.ts`:
   - Implement `resolveTikTokPublishedPostId` querying `/v2/post/publish/status/fetch/` to retrieve `publicaly_available_post_id` and construct the true permalink.
5. `web/lib/social/time-slots.ts`:
   - Implement `DEFAULT_PKT_POSTING_SLOTS`, `findNextFreePostingSlot`, `parsePktSlotToUtc`, `formatPktDateKey`, `formatPktTime`, and calendar grid helpers (`generateCalendarGridDays`, `generateWeekGridDays`, `bucketPostsByPktDate`).

**Acceptance Criteria Verification**:
- `npm run typecheck` passes with schema changes.
- Unit tests verify PKT slot math, collision avoidance, and calendar day generation.

---

### Milestone 2: AI Social Caption & Hashtag Copilot, Reactive Engagement Auto-Plug & R2 Media Library Server Actions

**Deliverables**:
1. `web/lib/social/caption-copilot.ts`:
   - Implement `generateSocialCaptionsCopilot` with Vercel AI SDK and deterministic luxury Haramain fallback.
   - Generates 3 hooks, 5 platform captions, and first-comment text.
2. `web/lib/social/analytics.ts`:
   - Wire `fetchPostAnalytics` onto all provider adapters.
   - In `syncSocialPostAnalytics`, add `resolveTikTokPublishedPostId` execution to fix pending TikTok permalinks.
   - Implement reactive engagement auto-plug logic: check `engagementPlugConfig`, evaluate `minLikes`/`minViews`, trigger `publishComment`, and update `triggeredAt`.
3. `web/app/actions/social-scheduler.ts`:
   - Add `generateSocialCaptionsCopilotAction`.
   - Add `rescheduleSocialPostAction`.
   - Add `getNextFreeSocialSlotAction`.
   - Add `listStudioMediaLibraryAssetsAction`.

**Acceptance Criteria Verification**:
- Copilot returns structured platform captions even when no external AI keys are set.
- Reactive auto-plug fires only once when thresholds are met.

---

### Milestone 3: Upgraded Multi-Platform Composer (R2 Dropzone, Studio Media Picker, Per-Platform Caption Tabs & AI Copilot)

**Deliverables**:
1. `web/components/admin/campaigns/studio-media-picker-modal.tsx`:
   - Searchable modal displaying 4K posters and supplier flyers from `listStudioMediaLibraryAssetsAction`.
2. `web/components/admin/hubs/campaigns-hub-client.tsx` (and composer subcomponents):
   - Add R2 drag-and-drop dropzone.
   - Add "Pick from Studio Library" button.
   - Add Per-Platform Caption Override Tabs (`Global Default`, `Instagram`, `Facebook`, `TikTok`, `YouTube`, `GMB`).
   - Add "AI Generate Platform Captions" button calling `generateSocialCaptionsCopilotAction`.
   - Add "Queue in Next Free PKT Slot" button calling `getNextFreeSocialSlotAction`.
   - Add Reactive Engagement Auto-Plug configuration fields.
3. Live preview synchronization:
   - Ensure `SocialPlatformPreview` renders the active tab's caption override.

**Acceptance Criteria Verification**:
- Operator can pick a 4K asset from the modal without leaving the composer.
- Switching platform tabs updates the preview frame immediately.
- 1-click slot button fills the scheduled time input with the next open PKT slot.

---

### Milestone 4: Visual Week/Month Social Calendar View & Unit Test Suite

**Deliverables**:
1. `web/components/admin/campaigns/social-calendar-view.tsx`:
   - Week and Month calendar grid in Pakistan Standard Time (`Asia/Karachi`).
   - Post chips with thumbnails, badges, and PKT time pills.
   - Empty PKT slot buttons (`+ 11:00 AM`, `+ 4:00 PM`, `+ 9:00 PM`) opening pre-filled composer.
   - Rescheduling dialog or drag-and-drop action calling `rescheduleSocialPostAction`.
2. `web/components/admin/hubs/campaigns-hub-client.tsx`:
   - Add view toggle: **[ List Queue ]** vs **[ Visual Calendar ]**.
3. `web/tests/social-phase3-calendar-copilot-and-providers.test.ts`:
   - Test PKT time-slot queue calculation and collision logic.
   - Test calendar grid generator (month and week days).
   - Test AI copilot fallback structure and hook generation.
   - Test Instagram video carousel polling error/success handling.
   - Test TikTok publish status resolution.
   - Test reactive engagement plug threshold evaluation.

**Acceptance Criteria Verification**:
- `npm test` passes all tests in `web/tests/social-phase3-calendar-copilot-and-providers.test.ts`.
- `npm run build` succeeds cleanly.

---

## Acceptance Criteria Checklist

| Acceptance Criteria | Target Deliverable | Verifying Milestone / Test |
| :--- | :--- | :--- |
| **AC-1**: Schema & Zod | `web/db/schema/social-scheduler.ts`, `web/lib/validations/social-scheduler.ts` | Milestone 1 / Typecheck & Unit Tests |
| **AC-2**: IG Carousel Polling | `web/lib/social/providers/instagram.ts` | Milestone 1 / Mocked polling test in Vitest |
| **AC-3**: TikTok Permalink | `web/lib/social/providers/tiktok.ts`, `web/lib/social/analytics.ts` | Milestone 1 / TikTok status test in Vitest |
| **AC-4**: PKT Slot Engine | `web/lib/social/time-slots.ts` | Milestone 1 / Slot calculation tests in Vitest |
| **AC-5**: AI Caption Copilot | `web/lib/social/caption-copilot.ts` | Milestone 2 / Deterministic fallback test in Vitest |
| **AC-6**: Reactive Auto-Plug | `web/lib/social/analytics.ts` | Milestone 2 / Threshold trigger test in Vitest |
| **AC-7**: Upgraded Composer | `campaigns-hub-client.tsx`, `studio-media-picker-modal.tsx` | Milestone 3 / Admin Hub Manual & E2E Verification |
| **AC-8**: Visual Calendar | `social-calendar-view.tsx` | Milestone 4 / Component rendering & Action tests |
| **AC-9**: Unit Test Suite | `tests/social-phase3-calendar-copilot-and-providers.test.ts` | Milestone 4 / `npm test` execution |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Meta Graph API Video Encoding Delays**: Long video files may take $>60$ seconds to encode, exceeding polling limits. | Publishing failure for large video carousel attachments. | Limit Instagram carousel video attachments to $\le 60$ seconds and enforce 60s timeout with clear retryable error diagnostics. |
| **TikTok Moderation Delays**: Video moderation may take hours, keeping `publicaly_available_post_id` pending. | Post shows profile URL rather than permanent video permalink. | `syncSocialPostAnalytics` periodically re-checks pending TikTok publish IDs during standard analytics sync cycles until resolved. |
| **AI Quota Exhaustion / Missing Keys**: `OPENROUTER_API_KEY` or `GEMINI_API_KEY` unconfigured or rate-limited. | AI caption generation fails in composer. | Deterministic luxury Haramain fallback generates high-converting, complete copy with zero API dependencies. |
| **Timezone Drift**: Browser client timezone differs from Pakistan Standard Time (PKT). | Posts scheduled at incorrect local times. | All slot calculations and calendar grid bucketing operate strictly in `Asia/Karachi` (UTC+5) using explicit UTC offsets. |
| **Spam / Policy Violations with Auto-Plugs**: Repeated automated comments on social platforms may trigger spam flags. | Account restrictions on Meta or YouTube. | Enforce strict idempotency: the reactive engagement plug triggers at most once per post (`triggeredAt`), and only on verified high-engagement posts. |

---

## Security & Privacy

1. **Role-Based Access Control**: All newly introduced Server Actions (`generateSocialCaptionsCopilotAction`, `rescheduleSocialPostAction`, `getNextFreeSocialSlotAction`, `listStudioMediaLibraryAssetsAction`) enforce `requireAdmin()` with `super_admin` and `staff` role verification.
2. **AES-256-GCM Token Encryption**: Provider access tokens and refresh tokens remain encrypted at rest in Neon PostgreSQL using our authenticated crypto module (`web/lib/social/crypto.ts`). Tokens are decrypted only transiently in server-side provider adapters.
3. **No Client-Side Credential Exposure**: Client components never receive raw OAuth tokens or external API keys; all social interactions are routed through Server Actions and Trigger.dev tasks.
4. **Input Sanitization**: All custom captions, first comments, and engagement plug copy are validated with Zod, sanitized against control characters, and truncated to safe platform boundaries before dispatch.
