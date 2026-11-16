# 0016. Postiz Core 5 Interactive Platform Post Previewer and Cross-Channel Analytics Dashboard

**Date**: 2026-11-07
**Status**: Approved

## Summary

This specification defines **Slice 35 (Feature #39)**: the **Postiz Core 5 Interactive Platform Post Previewer & Cross-Channel Analytics Dashboard** inside `/admin/campaigns?tab=social`. Building upon our native Next.js 16 + Drizzle ORM social scheduler (`Spec 0010`) and Phase 2 OAuth/Reels/First-Comment/Analytics engine (`Spec 0014`), we introduce a live 5-platform device mockup previewer (`web/components/admin/campaigns/social-platform-preview.tsx`) backed by a pure, deterministic formatting and validation engine (`web/lib/social/preview-formatter.ts`), alongside an executive Cross-Channel Analytics KPI Summary Strip, Per-Provider Comparison Grid, Per-Post Analytics Breakdown Drawer, and 1-click **"Sync All Published Metrics"** batch action (`syncAllPublishedPostsAnalyticsAction` in `web/app/actions/social-scheduler.ts`).

## Context

In Slices 29 and 33 (`Specs 0010` and `0014`), Al Ramlah Travels ported the Core 5 social media publishing and analytics adapters (`instagram`, `facebook`, `tiktok`, `youtube`, `gmb`) natively into Next.js 16 and Drizzle ORM. While social media managers can now compose posts with `FEED`, `REEL`, and `STORY` formats, attach `ART-...` First-Comment WhatsApp auto-plugs, and sync individual post metrics, two high-impact operator experience gaps remain in `/admin/campaigns?tab=social` when compared to the upstream `postiz-app` studio experience:

1. **No Live Platform-Specific Device Mockup or Format/Truncation Validation Before Publishing**:
   - Currently, the Social Post Composer only displays a small `80x96px` thumbnail of the selected `postAsset` next to a plain `<Textarea>` caption box.
   - Marketing staff cannot preview how a 4K Umrah Spotlight poster (`1080x1350` / `1080x1520`), multi-image carousel, vertical `9:16` Reel/Short, or 24-hour Story will actually render inside **Instagram**, **Facebook Page**, **TikTok**, **YouTube Shorts**, or **Google Business Profile (`GMB`)** mobile chrome before clicking publish.
   - Operators receive no live visual feedback on platform-specific caption character limits (`Instagram <= 2200`, `TikTok <= 2200`, `YouTube Title <= 100 / Description <= 5000`, `GMB <= 1500` chars), above-the-fold `...more` fold points, how the pinned `ART-...` First Comment looks immediately beneath the caption on Instagram/Facebook/YouTube, or how the **Askari 10 & DHA Lahore** verified local update card and `"Book"` / `"Learn More"` WhatsApp CTA button appear on Google Business Profile.
2. **No Cross-Channel Executive KPI Summary Strip or Bulk Analytics Sync**:
   - While `Spec 0014` added per-post analytics badges and a per-post `"Sync Metrics"` button, marketing directors visiting `/admin/campaigns?tab=social` lack a top-level **Cross-Channel Analytics KPI Summary Strip** aggregating total `impressions`, `likes`, `comments`, `shares`, `clicks`, and overall `engagementRate` (`(likes + comments + shares + clicks) / impressions * 100`) across all published campaigns and Core 5 channels.
   - Furthermore, refreshing metrics across 10+ published campaigns currently requires clicking `"Sync Metrics"` on each post row individually rather than a single **"Sync All Published Metrics"** batch action (`syncAllPublishedPostsAnalyticsAction`), and there is no interactive Per-Post Breakdown Drawer to compare channel-by-channel conversion performance side by side.

## Requirements

**User stories**:
- As a social media manager composing an Umrah campaign in `/admin/campaigns?tab=social`, I want an interactive 5-platform device mockup switcher (`Instagram`, `Facebook Page`, `TikTok`, `YouTube Shorts`, `Google Business Profile`) that updates in real time as I type my caption, switch between `FEED`, `REEL`, and `STORY` formats, step through multi-image carousel slides, or generate an `ART-...` First-Comment CTA so that I can verify visual framing and copy before scheduling.
- As a content creator, I want real-time character limit progress bars, truncation fold previews (`...more`), and format compatibility warnings per platform (`Instagram <= 2200`, `TikTok <= 2200`, `YouTube Title <= 100 / Description <= 5000`, `GMB <= 1500` chars) so that captions and titles never fail or clip key booking helplines mid-sentence.
- As a conversion marketer, I want to preview the pinned `ART-...` First Comment with clickable-style `wa.me/923274029701` WhatsApp inquiry formatting right inside the Instagram, Facebook, and YouTube mockups, as well as the verified **Askari 10 / DHA Lahore** local post card and `"Book"` / `"Learn More"` WhatsApp CTA button inside the Google Business Profile mockup.
- As a marketing director, I want a Cross-Channel Analytics KPI Summary Strip at the top of `/admin/campaigns?tab=social`, a 1-click **"Sync All Published Metrics"** button (`syncAllPublishedPostsAnalyticsAction`), and a Per-Post Breakdown Drawer so that I can evaluate total impressions, engagement rate, WhatsApp CTA clicks, and channel-by-channel ROI across all Core 5 networks at a glance.

**Acceptance criteria**:
- **AC-1**: **Interactive 5-Platform Device Mockup Switcher (`web/components/admin/campaigns/social-platform-preview.tsx` + `web/lib/social/preview-formatter.ts`)**:
  - Renders a live mobile device frame inside `/admin/campaigns?tab=social` supporting instant tab switching between **Instagram** (`instagram`), **Facebook Page** (`facebook`), **TikTok** (`tiktok`), **YouTube Shorts** (`youtube`), and **Google Business Profile** (`gmb`).
  - Reflects the agency's connected account metadata (`name`, `handle`, `avatarUrl`) when an active integration exists for that platform, falling back to official Al Ramlah Travels brand identity (`Al Ramlah Travels`, `@alramlahtravels`, Askari 10 & DHA Lahore) when previewing an unconnected channel.
- **AC-2**: **Format-Aware Aspect Ratio & Layout Simulation + Caption Truncation Warnings**:
  - Dynamically adapts the device viewport and platform chrome to the selected `postFormat`:
    - `FEED`: `4:5` (`1080x1350`) / `1:1` portrait-or-square frame with interactive multi-image carousel previous/next stepper and slide indicator dots when `mediaUrls.length > 1`.
    - `REEL`: `9:16` vertical full-screen short-form video overlay with platform-authentic right-rail action icons (heart, comment, share, music disc) and bottom-left handle/caption/audio marquee ticker.
    - `STORY`: `9:16` full-bleed ephemeral story frame with top segmented progress bars, `24h` timestamp header, and bottom reply/CTA bar (plus a clear platform compatibility badge when previewing `STORY` on channels that only support Feed/Short posts).
  - Enforces and displays platform-specific character counter & truncation diagnostics via `web/lib/social/preview-formatter.ts`:
    - **Instagram**: `<= 2200` chars (fold preview at `125` chars), hashtag count warning (`> 30` hashtags).
    - **Facebook Page**: `<= 63206` chars (fold preview at `250` chars).
    - **TikTok**: `<= 2200` chars (fold preview at `100` chars).
    - **YouTube Shorts**: Title `<= 100` chars, Description `<= 5000` chars (fold preview at `110` chars).
    - **Google Business Profile (`GMB`)**: Summary `<= 1500` chars (fold preview at `180` chars).
- **AC-3**: **Live Pinned First-Comment Preview (`Instagram`, `Facebook`, `YouTube`)**:
  - When `postFormat !== 'STORY'` and `firstComment` is populated, renders a realistic **"Pinned First Comment"** block immediately below the main post caption inside the **Instagram**, **Facebook Page**, and **YouTube Shorts** mockups.
  - Highlights `ART-...` package reference codes, Quad/Triple/Double PKR pricing, and `https://wa.me/...` click-to-chat links, while showing an informational badge on **TikTok** and **GMB** explaining that those platforms use caption/CTA buttons rather than automated first-comment threads.
- **AC-4**: **Google Business Profile (`GMB`) Local Update Preview**:
  - Renders a dedicated Google Search / Maps Local Update card displaying **Al Ramlah Travels — Askari 10 & DHA Lahore** with a verified Google Business checkmark badge, post category pill (`What's New` / `Offer`), formatted summary text (`<= 1500` chars), 4K package poster preview, and an interactive `"Book"` / `"Learn More"` WhatsApp Call-to-Action button preview pointing to `https://wa.me/923274029701`.
- **AC-5**: **Cross-Channel Analytics KPI Summary Strip, Bulk Sync Action & Per-Post Breakdown Drawer**:
  - Adds a Cross-Channel Analytics KPI Summary Strip in `/admin/campaigns?tab=social` displaying aggregated **Total Impressions**, **Total Likes**, **Total Comments**, **Total Shares**, **Total CTA Clicks**, and **Cross-Channel Engagement Rate** (`((likes + comments + shares + clicks) / impressions) * 100`, formatted to 2 decimal places, or `0%` when `impressions === 0`), plus per-provider performance pills across the Core 5 channels.
  - Implements `syncAllPublishedPostsAnalyticsAction` in `web/app/actions/social-scheduler.ts` (backed by `syncAllPublishedPostsAnalytics` in `web/lib/social/analytics.ts`) and wires a 1-click **"Sync All Published Metrics"** button in `/admin/campaigns?tab=social`.
  - Adds an interactive **Per-Post Analytics Breakdown Drawer / Dialog** (`@base-ui/react` Dialog) on each published post card showing target-by-target metrics (`impressions`, `likes`, `comments`, `shares`, `clicks`, `engagementRate`, `firstCommentId`, `publishedUrl`, `lastSyncedAt`) across Instagram, Facebook, TikTok, YouTube, and GMB.
- **AC-6**: **Comprehensive Unit Tests (`web/tests/social-preview-and-analytics.test.ts`)**:
  - Verifies `preview-formatter.ts` truncation limits (`Instagram <= 2200`, `TikTok <= 2200`, `YouTube Title <= 100 / Description <= 5000`, `GMB <= 1500`), aspect ratio & format rules (`FEED`, `REEL`, `STORY`), first-comment support detection, GMB CTA resolution, and cross-channel analytics aggregation + engagement rate math (`(likes + comments + shares + clicks) / impressions * 100`).

## Options considered

### Option 1: Embed third-party iframe oEmbed previews and external BI charting libraries
Use external Meta/TikTok/YouTube oEmbed iframe endpoints for previews and add a heavy charting library for analytics.

**Pros**:
- Uses official network oEmbed widgets for already-published URLs.

**Cons**:
- oEmbed endpoints **cannot** preview unpublished draft posts, local 4K flyer assets, or unsaved captions/first-comments while typing in the composer.
- External iframes fail in offline/sandbox environments, leak admin session metadata, and add slow third-party scripts.

### Option 2 (Chosen): Pure deterministic preview formatter (`web/lib/social/preview-formatter.ts`) + Native Haramain Emerald & Gold 5-Platform Device Mockup (`web/components/admin/campaigns/social-platform-preview.tsx`) + Drizzle cross-channel analytics aggregator
Build a pure TypeScript preview formatting and validation module (`web/lib/social/preview-formatter.ts`) paired with an interactive 5-platform device mockup component (`web/components/admin/campaigns/social-platform-preview.tsx`) and extend `web/lib/social/analytics.ts` + `web/app/actions/social-scheduler.ts` with pure cross-channel KPI aggregation and batch syncing (`syncAllPublishedPostsAnalyticsAction`).

**Pros**:
- **Zero-latency live preview**: Updates at 60fps on every keystroke, format toggle (`FEED` / `REEL` / `STORY`), or carousel slide change before a post is ever saved.
- **100% deterministic & testable**: All character limits, fold points, aspect ratios, hashtag counters, GMB local CTA states, and cross-channel engagement rate formulas live in pure functions (`web/lib/social/preview-formatter.ts` and `web/lib/social/analytics.ts`) that are fast to unit-test in Vitest (`web/tests/social-preview-and-analytics.test.ts`).
- **Zero extra database migrations required**: Leverages the existing `scheduledPosts` (`postFormat`, `firstComment`) and `scheduledPostTargets` (`analyticsData` JSONB) schema introduced in `Spec 0014`.

**Cons**:
- Requires crafting authentic CSS device layouts for 5 distinct social platforms (`instagram`, `facebook`, `tiktok`, `youtube`, `gmb`) and 3 formats (`FEED`, `REEL`, `STORY`).

### Option 3: Server-rendered PNG preview snapshots via Satori / Playwright
Render each platform preview on the server as a static image whenever the user pauses typing.

**Pros**:
- Produces downloadable mockup images.

**Cons**:
- Introduces 500ms–1500ms server round-trip lag on every caption edit, prevents interactive carousel stepping or `"more"` expansion inside the previewer, and wastes serverless CPU.

## Decision

**Chosen option**: Option 2: Pure deterministic preview formatter (`web/lib/social/preview-formatter.ts`) + Native Haramain Emerald & Gold 5-Platform Device Mockup (`web/components/admin/campaigns/social-platform-preview.tsx`) + Drizzle cross-channel analytics aggregator.

This option gives marketing operators instant, pixel-accurate interactive previews across all Core 5 social platforms and all 3 post formats (`FEED`, `REEL`, `STORY`), while delivering executive cross-channel analytics aggregation and 1-click bulk metrics synchronization with zero new external dependencies or schema migrations.

## Architecture and Technical Design

### 1. Pure Platform Preview Formatter & Validator (`web/lib/social/preview-formatter.ts` — `AC-1`, `AC-2`, `AC-3`, `AC-4`)

We create `web/lib/social/preview-formatter.ts` as a pure, zero-side-effect module shared by the client previewer and Vitest unit tests.

```typescript
import type { SocialPostFormat, SocialProviderId } from "./types"

export interface PlatformPreviewRules {
  provider: SocialProviderId
  label: string
  maxCaptionChars: number
  maxTitleChars?: number
  foldPreviewChars: number
  maxHashtags?: number
  supportsFirstComment: boolean
  supportedFormats: SocialPostFormat[]
  requiresVideo: boolean
}

export const CORE5_PREVIEW_RULES: Record<SocialProviderId, PlatformPreviewRules> = {
  instagram: {
    provider: "instagram",
    label: "Instagram",
    maxCaptionChars: 2200,
    foldPreviewChars: 125,
    maxHashtags: 30,
    supportsFirstComment: true,
    supportedFormats: ["FEED", "REEL", "STORY"],
    requiresVideo: false,
  },
  facebook: {
    provider: "facebook",
    label: "Facebook Page",
    maxCaptionChars: 63206,
    foldPreviewChars: 250,
    supportsFirstComment: true,
    supportedFormats: ["FEED", "REEL", "STORY"],
    requiresVideo: false,
  },
  tiktok: {
    provider: "tiktok",
    label: "TikTok",
    maxCaptionChars: 2200,
    foldPreviewChars: 100,
    supportsFirstComment: false,
    supportedFormats: ["REEL", "FEED"],
    requiresVideo: true,
  },
  youtube: {
    provider: "youtube",
    label: "YouTube Shorts",
    maxCaptionChars: 5000,
    maxTitleChars: 100,
    foldPreviewChars: 110,
    supportsFirstComment: true,
    supportedFormats: ["REEL", "FEED"],
    requiresVideo: true,
  },
  gmb: {
    provider: "gmb",
    label: "Google Business",
    maxCaptionChars: 1500,
    foldPreviewChars: 180,
    supportsFirstComment: false,
    supportedFormats: ["FEED"],
    requiresVideo: false,
  },
}
```

#### Key Exported Functions in `web/lib/social/preview-formatter.ts`:
1. **`resolveAspectRatioConfig(params: { provider: SocialProviderId; postFormat: SocialPostFormat; mediaCount: number })`**:
   - Returns `{ aspectRatio: "4:5" | "1:1" | "9:16" | "16:9"; aspectClass: string; layoutMode: "feed_card" | "vertical_reel" | "ephemeral_story" | "gmb_local_card"; isCarousel: boolean; formatSupported: boolean; formatWarning: string | null }`.
   - When `postFormat === "REEL"`, returns `aspectRatio: "9:16"`, `layoutMode: "vertical_reel"`.
   - When `postFormat === "STORY"`, returns `aspectRatio: "9:16"`, `layoutMode: "ephemeral_story"`, and flags `formatSupported: false` with an actionable warning if `provider` is `tiktok`, `youtube`, or `gmb` (which publish as vertical video or local feed updates rather than 24h stories).
   - When `postFormat === "FEED"`, returns `aspectRatio: "4:5"` (`layoutMode: "gmb_local_card"` for `gmb`, `"vertical_reel"` for `tiktok`/`youtube` Shorts, and `"feed_card"` for `instagram`/`facebook`), plus `isCarousel: mediaCount > 1` for multi-image carousels.
2. **`formatPlatformPreviewState(params: { provider: SocialProviderId; postFormat: SocialPostFormat; caption: string; title?: string; firstComment?: string | null; mediaUrls: string[]; postCode?: string; ctaType?: "BOOK" | "LEARN_MORE"; ctaWhatsappNumber?: string })`**:
   - Computes:
     - `captionLength`: `number`, `maxCaptionChars`: `number`, `remainingCaptionChars`: `number`, `isOverCaptionLimit`: `boolean`, `isNearCaptionLimit`: `boolean` (`>= 90%` of limit).
     - `titleText`: derived from `params.title` or first non-empty line of `caption`, with `titleLength`, `maxTitleChars` (`100` on YouTube), and `isOverTitleLimit` (`titleLength > 100` on YouTube).
     - `truncatedPreviewText` and `isTruncatedFold`: splits `caption` at `foldPreviewChars` with `...more` indicator.
     - `hashtags`: extracted `#...` tokens, `hashtagCount`, and `isOverHashtagLimit` (`> 30` on Instagram).
     - `firstCommentPreview`: `{ visible: boolean; text: string; containsArtCode: boolean; containsWhatsappLink: boolean; unsupportedReason: string | null }` — visible when `postFormat !== "STORY"`, `supportsFirstComment === true` (`instagram`, `facebook`, `youtube`), and `firstComment` is non-empty.
     - `gmbLocalCard`: `{ verifiedBadgeLabel: "Verified • Askari 10 & DHA Lahore"; branchLabel: "Al Ramlah Travels — Askari 10 & DHA Lahore"; ctaLabel: "Book on WhatsApp" | "Learn More"; ctaButtonType: "BOOK" | "LEARN_MORE"; ctaUrl: string }` — builds a pre-filled WhatsApp click-to-chat URL referencing `postCode` (`https://wa.me/923274029701?text=...`).
     - `warnings`: `string[]` — human-readable validation warnings (e.g., `"Instagram caption exceeds 2,200 characters"`, `"YouTube title exceeds 100 characters"`, `"Google Business Profile summary exceeds 1,500 characters"`, `"YouTube Shorts / TikTok requires an .mp4 or .mov video URL"`).

---

### 2. Interactive 5-Platform Device Mockup Component (`web/components/admin/campaigns/social-platform-preview.tsx` — `AC-1`, `AC-2`, `AC-3`, `AC-4`)

We create `web/components/admin/campaigns/social-platform-preview.tsx` and embed it directly into the `SocialCalendarTab` composer in `web/components/admin/hubs/campaigns-hub-client.tsx`.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  LIVE 5-PLATFORM DEVICE PREVIEWER                          [FEED · 4:5]    │
│  ┌───────────┬───────────┬───────────┬──────────────┬───────────────────┐  │
│  │ Instagram │ Facebook  │  TikTok   │ YouTube Shrt │ Google Business   │  │
│  └───────────┴───────────┴───────────┴──────────────┴───────────────────┘  │
│  ┌───────────────────────────────────────┐  ┌───────────────────────────┐  │
│  │       📱 Mobile Device Frame          │  │  Platform Diagnostics     │  │
│  │  • Header: @alramlahtravels (Verified)│  │  • Chars: 342 / 2,200     │  │
│  │  • Viewport:                          │  │  • Aspect: 4:5 Portrait   │  │
│  │    - FEED (4:5 + Carousel < 1/3 >)    │  │  • Hashtags: 7 / 30       │  │
│  │    - REEL (9:16 Vertical + Audio)     │  │  • First Comment: Active  │  │
│  │    - STORY (9:16 + Progress Bars)     │  │  • GMB CTA: [Book] [Learn]│  │
│  │  • Caption + "...more" toggle         │  │  • Warnings / Readiness   │  │
│  │  • 📌 Pinned First Comment (ART-...)  │  └───────────────────────────┘  │
│  └───────────────────────────────────────┘                                 │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Key Interactive Features:
1. **5-Platform Switcher Pill Bar**:
   - Switches between `instagram`, `facebook`, `tiktok`, `youtube`, and `gmb` with live warning dot indicators if any platform has a character or media-type violation.
2. **Multi-Image Carousel Stepper (`FEED`)**:
   - When `mediaUrls.length > 1`, renders previous/next chevron buttons (`<` / `>`), a `1 / N` badge in the top-right corner, and Instagram/Facebook carousel pagination dots at the bottom of the media frame.
3. **Format-Specific Device Chrome (`FEED` vs `REEL` vs `STORY`)**:
   - **`FEED` on Instagram / Facebook**: Authentic top profile bar, `4:5` poster viewport, engagement row (Heart, Comment, Share, Bookmark), caption with interactive `...more` / `less` toggle, and **Pinned First Comment** box showing the `ART-...` WhatsApp inquiry link.
   - **`REEL` on Instagram / Facebook / TikTok / YouTube Shorts**: Dark-mode `9:16` vertical video frame with right-side floating action rail (`Likes`, `Comments`, `Shares`, spinning audio disc), bottom overlay with `@alramlahtravels` handle, `Subscribe` / `Follow` pill, caption overlay, and expandable **Pinned Top Comment (`ART-...`)** drawer for Instagram, Facebook, and YouTube Shorts.
   - **`STORY` on Instagram / Facebook**: Full-bleed `9:16` frame with segmented top story progress bars, account avatar + `2h` badge, center 4K poster, and bottom `"Send message"` + heart/paper-plane bar.
4. **Google Business Profile (`GMB`) Local Update Card (`AC-4`)**:
   - Renders the official Google Business Profile update layout with:
     - **Al Ramlah Travels** header + **Verified • Askari 10 & DHA Lahore** badge (`ShieldCheck`).
     - Interactive CTA selector pill (`"Book"` vs `"Learn More"`) that updates the rendered Google Business button (`Book` / `Learn More`) linked to the package's `ART-...` WhatsApp click-to-chat URL.
     - Character counter (`<= 1,500` chars) and local search visibility preview.

---

### 3. Cross-Channel Analytics Aggregator, Bulk Sync & Breakdown Drawer (`web/lib/social/analytics.ts`, `web/app/actions/social-scheduler.ts`, `web/components/admin/hubs/campaigns-hub-client.tsx` — `AC-5`)

#### 3.1 Pure Cross-Channel Analytics Aggregation (`web/lib/social/analytics.ts`)
We extend `web/lib/social/analytics.ts` with pure calculation helpers and a batch database sync function:

```typescript
export interface CrossChannelProviderTotals {
  provider: SocialProviderId
  publishedTargetsCount: number
  impressions: number
  likes: number
  comments: number
  shares: number
  clicks: number
  totalEngagements: number
  engagementRate: number // Percentage rounded to 2 decimal places: ((likes + comments + shares + clicks) / impressions) * 100
}

export interface CrossChannelAnalyticsSummary {
  totalPublishedPosts: number
  totalPublishedTargets: number
  impressions: number
  likes: number
  comments: number
  shares: number
  clicks: number
  totalEngagements: number
  engagementRate: number // ((likes + comments + shares + clicks) / impressions) * 100
  firstCommentsPosted: number
  lastSyncedAt: string | null
  byProvider: Record<SocialProviderId, CrossChannelProviderTotals>
}
```

- **`computeEngagementRate(metrics: { impressions: number; likes: number; comments: number; shares: number; clicks: number }): number`**:
  - Formula:
    $$\text{engagementRate} = \begin{cases} \text{round2}\left(\frac{\text{likes} + \text{comments} + \text{shares} + \text{clicks}}{\text{impressions}} \times 100\right) & \text{if } \text{impressions} > 0 \\ 0 & \text{otherwise} \end{cases}$$
- **`aggregateCrossChannelAnalytics(posts: Array<{ id?: string; status?: string; targets: Array<{ status: string; externalPostId?: string | null; firstCommentExternalId?: string | null; analyticsData?: SocialPostAnalyticsData | null; integration: { provider: SocialProviderId } }> }>): CrossChannelAnalyticsSummary`**:
  - Aggregates totals across all posts and breaks down metrics across all Core 5 providers (`instagram`, `facebook`, `tiktok`, `youtube`, `gmb`).
- **`syncAllPublishedPostsAnalytics(): Promise<{ syncedPostsCount: number; syncedTargetsCount: number; summary: CrossChannelAnalyticsSummary }>`**:
  - Queries all `scheduledPosts` that have at least one target with `status === "published"` (or post status in `["completed", "partially_failed"]`), runs `syncSocialPostAnalytics(postId)` for each, and returns the updated cross-channel rollup.

#### 3.2 Server Action (`web/app/actions/social-scheduler.ts`)
- **`syncAllPublishedPostsAnalyticsAction()`**:
  - Authenticates the admin session (with development fallback matching `syncSocialPostAnalyticsAction`).
  - Invokes `syncAllPublishedPostsAnalytics()` from `web/lib/social/analytics.ts`.
  - Calls `revalidatePath("/admin/campaigns")` and returns `{ success: true, syncedPostsCount, syncedTargetsCount, summary }`.

#### 3.3 Executive KPI Strip & Per-Post Breakdown Drawer in `/admin/campaigns?tab=social` (`web/components/admin/hubs/campaigns-hub-client.tsx`)
1. **Cross-Channel Analytics KPI Summary Strip**:
   - Rendered at the top of `SocialCalendarTab` in `/admin/campaigns?tab=social`.
   - Displays 6 executive KPI cards: **Total Impressions**, **Engagement Rate (`%`)**, **Total Likes**, **Comments (+ Auto-Plugs)**, **Shares**, and **WhatsApp / CTA Clicks**, plus a 5-pill Per-Platform Breakdown bar (`IG`, `FB`, `TT`, `YT`, `GMB`) and the 1-click **"Sync All Published Metrics"** button (`syncAllPublishedPostsAnalyticsAction`).
2. **Per-Post Analytics Breakdown Drawer / Dialog**:
   - Each post card in the queue includes an **"Inspect Breakdown"** button opening a Haramain Emerald & Gold `@base-ui/react` Dialog (`SocialPostAnalyticsDrawer`) that displays:
     - Post-level totals (`impressions`, `likes`, `comments`, `shares`, `clicks`, `engagementRate`).
     - Channel-by-channel comparison rows for each target (`integration.name`, `provider`, `impressions`, `likes`, `comments`, `shares`, `clicks`, `engagementRate`, `firstCommentId` status badge, external post link, and a per-post `"Re-Sync Now"` button).

## Build plan

### Milestone 1: Pure Platform Preview Formatter & Cross-Channel Analytics Aggregation (`AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`)
- **Files**:
  - `web/lib/social/preview-formatter.ts`
  - `web/lib/social/analytics.ts`
  - `web/app/actions/social-scheduler.ts`
- **Deliverables**:
  - Create `web/lib/social/preview-formatter.ts` exporting `CORE5_PREVIEW_RULES`, `resolveAspectRatioConfig`, and `formatPlatformPreviewState` enforcing character limits (`Instagram <= 2200`, `TikTok <= 2200`, `YouTube Title <= 100 / Description <= 5000`, `GMB <= 1500`), aspect ratio & layout modes (`FEED` 4:5 / 1:1 with carousel detection, `REEL` 9:16, `STORY` 9:16), pinned first-comment visibility (`instagram`, `facebook`, `youtube`), and GMB Askari 10 / DHA Lahore `"Book"` / `"Learn More"` WhatsApp CTA metadata.
  - Extend `web/lib/social/analytics.ts` with `computeEngagementRate`, `aggregateCrossChannelAnalytics`, and `syncAllPublishedPostsAnalytics`.
  - Add `syncAllPublishedPostsAnalyticsAction` in `web/app/actions/social-scheduler.ts`.

### Milestone 2: Interactive 5-Platform Device Mockup Component & Analytics Dashboard UI (`AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`)
- **Files**:
  - `web/components/admin/campaigns/social-platform-preview.tsx`
  - `web/components/admin/hubs/campaigns-hub-client.tsx`
- **Deliverables**:
  - Create `web/components/admin/campaigns/social-platform-preview.tsx` providing the live 5-platform device switcher (`Instagram`, `Facebook Page`, `TikTok`, `YouTube Shorts`, `Google Business Profile`), format-aware viewport (`FEED` 4:5 with multi-image carousel stepper, `REEL` 9:16 vertical overlay with audio/action chrome, `STORY` 9:16 full-bleed frame with progress bars), live character/truncation warnings, pinned `ART-...` First-Comment preview (`IG`, `FB`, `YT`), and verified Askari 10 / DHA Lahore Google Business Profile card with interactive `"Book"` / `"Learn More"` WhatsApp CTA button.
  - Upgrade `web/components/admin/hubs/campaigns-hub-client.tsx` (`SocialCalendarTab`) with the embedded `SocialPlatformPreview`, the Cross-Channel Analytics KPI Summary Strip, the 1-click **"Sync All Published Metrics"** button (`syncAllPublishedPostsAnalyticsAction`), and the Per-Post Analytics Breakdown Dialog.

### Milestone 3: Unit Test Suite & Verification (`AC-6`)
- **Files**:
  - `web/tests/social-preview-and-analytics.test.ts`
- **Deliverables**:
  - Write unit tests in `web/tests/social-preview-and-analytics.test.ts` covering platform truncation thresholds (`Instagram <= 2200`, `TikTok <= 2200`, `YouTube Title <= 100 / Description <= 5000`, `GMB <= 1500`), format/aspect-ratio simulation (`FEED`, `REEL`, `STORY` + multi-image carousel), pinned first-comment preview rules, GMB local update CTA generation, and cross-channel analytics aggregation + engagement rate math (`(likes + comments + shares + clicks) / impressions * 100`).
