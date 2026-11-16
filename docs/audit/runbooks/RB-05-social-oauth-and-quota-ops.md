# RB-05 — Core 5 Social OAuth Re-Authentication, Feature Flags & Quota Operations

**Owner**: Marketing & Platform Operations (`super_admin`)  
**Engine**: Native Core 5 Social Scheduler (`lib/social/*`, `db/schema/social-scheduler.ts`, `trigger/publish-social-post.task.ts`, `trigger/schedules.task.ts`)  
**Providers**: `instagram`, `facebook` (Facebook Pages), `youtube`, `tiktok`, `gmb` (Google Business Profile API v1)

---

## 1. Core 5 OAuth Re-Authentication SOP (`/admin/settings?tab=social`)

All social OAuth connection, candidate selection, and disconnection mutations are strictly locked to **`super_admin`** (`T-033`, `T-075`) and recorded in `audit_logs`.

### When to Re-Authenticate
- `/admin` Overview `SmartInsightsBanner` displays an expiring/expired token warning (`social_integrations.status = 'EXPIRED'` or `token_expires_at < NOW() + INTERVAL '72 hours'`).
- `proactive-social-token-refresh` (`0 */6 * * *` `Asia/Karachi`) marks an integration `deactivated_permanent_error` due to revoked consent, changed platform password, or expired refresh token.

### Step-by-Step Re-Connection
1. Log in as `super_admin` and navigate to `https://alramlahtravels.com/admin/settings?tab=social`.
2. Click **Reconnect / Connect Account** for the affected provider (`Instagram`, `Facebook Pages`, `YouTube`, `TikTok`, or `Google Business Profile`).
   - `app/api/oauth/social/[provider]/route.ts` sets a signed `HttpOnly; Secure` CSRF `social_oauth_state_<provider>` cookie before redirecting to the vendor consent screen.
3. Complete vendor authorization using the official Al Ramlah Travels brand account.
4. On callback (`/api/oauth/social/[provider]/callback`), if multiple Pages, Instagram Business Accounts, YouTube Channels, or GBP Locations are returned (`status = 'PENDING_SELECTION'`), select the canonical Al Ramlah Travels profile in the candidate picker modal.
   - Candidate tokens in `social_integrations.metadata` are encrypted via `lib/security/vault.ts` and never serialized to RSC client HTML (`T-038`).

### Quick SQL Health Check of Connected Integrations
```sql
SELECT
  id,
  provider,
  name,
  handle,
  status,
  is_active,
  token_expires_at AT TIME ZONE 'Asia/Karachi' AS expires_pkt,
  last_synced_at AT TIME ZONE 'Asia/Karachi' AS last_synced_pkt
FROM social_integrations
ORDER BY provider ASC, updated_at DESC;
```

---

## 2. Meta (Instagram & Facebook Pages) 60-Day Page Token Diagnostics

### Architecture (`T-035`)
- Meta OAuth exchanges a short-lived User token for a 60-day long-lived User token, then derives a **Page Access Token** via `GET https://graph.facebook.com/v21.0/me/accounts` (and resolves the linked `instagram_business_account`).
- `lib/social/token-refresh.ts` re-derives the Page Access Token via `/me/accounts` during proactive renewal so a Page token is **never** overwritten by a bare User token.
- Required Meta App Scopes: `pages_manage_posts`, `pages_read_engagement`, `pages_manage_engagement`, `read_insights`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`.

### Troubleshooting Instagram Reel / Carousel Publish Failures
- `lib/social/providers/instagram.ts` polls `pollInstagramContainerFinished` until container `status_code === "FINISHED"` before calling `/media_publish`.
- If a container returns `status_code === "ERROR"` (`2207026` unsupported video codec/aspect ratio or `2207052` media fetch error):
  1. Ensure videos are H.264 MP4 (`<= 100 MB`) uploaded via `/api/uploads/presign` to public R2 (`assets.alramlahtravels.com` / `r2.alramlahtravels.com` — never `blob:` or private `/api/media/` URLs, as Meta's crawler must fetch the media over HTTPS).
  2. Images normalized by Studio (`sharp` `1080×1520` EXIF-rotated JPEG) satisfy Instagram 4:5 / Reel cover specs out of the box.

---

## 3. Enabling `TIKTOK_DIRECT_POST_APPROVED` & `GBP_API_APPROVED` Post-Audit (`OD-11`)

Per Owner Decision **`OD-11` (Option A)**, Instagram, Facebook Pages, and YouTube operate live immediately, while TikTok public Direct Post and Google Business Profile v1 are feature-flagged in `lib/env.ts` until vendor app audits conclude:

### 3.1 Unlocking TikTok Direct Post (`TIKTOK_DIRECT_POST_APPROVED`)
1. Complete **TikTok Content Posting API Audit** in the TikTok Developer Portal (`developers.tiktok.com`), demonstrating the shipped creator-info fetch (`creator_info/query`), dynamic privacy-level selector (no default `PUBLIC_TO_EVERYONE` forced), comment/duet/stitch toggles, commercial content disclosure toggle, and `publish_id` status polling (`T-069`).
2. Confirm OAuth scopes `user.info.basic`, `user.info.profile`, `video.publish`, `video.upload`, and `video.list` are approved in Production mode, and `TIKTOK_REDIRECT_BASE_URL` is set to `https://alramlahtravels.com`.
3. Set `TIKTOK_DIRECT_POST_APPROVED="true"` in **both** Vercel Pro and Trigger.dev Cloud (`npm run trigger:deploy`), then redeploy Vercel.

### 3.2 Unlocking Google Business Profile v1 (`GBP_API_APPROVED`)
1. Obtain **Google Business Profile API Basic Access** approval on the Google Cloud project (`mybusinessbusinessinformation.googleapis.com` v1 + `mybusiness.googleapis.com` Local Posts v4/v1 bridge — sunset v4 insights endpoints have already been removed in `lib/social/providers/gmb.ts` per `T-035`).
2. Re-authenticate Google OAuth in `/admin/settings?tab=social` to select the Askari 10 Lahore Cantt GBP Location.
3. Set `GBP_API_APPROVED="true"` in **both** Vercel Pro and Trigger.dev Cloud (`npm run trigger:deploy`), then redeploy Vercel.

---

## 4. YouTube Data API v3 Quota & Honest Analytics / Auto-Plug Rules

### 4.1 YouTube Daily `10,000`-Unit Budget Governance
- Google's default YouTube Data API v3 quota is **`10,000` units/day** (resetting at midnight Pacific Time).
- Every `videos.insert` upload costs **`1,600` units** (= maximum **`6` video/Short uploads per day** before hitting `403 quotaExceeded`).
- **Crucial Pre-Launch Check**: Ensure the Google Cloud **OAuth Consent Screen** publishing status is set to **`In production`** (not `Testing`). In `Testing` mode, Google revokes refresh tokens every 7 days and permanently locks uploaded YouTube videos to `private` (`unverified_app` restriction).
- If Al Ramlah Travels needs `>6` YouTube Shorts/day during Ramadan, submit the Google Cloud **YouTube API Quota Extension Form** requesting `50,000` units/day.

### 4.2 Honest Analytics & Reactive Engagement Auto-Plugs (`T-036`)
- `lib/social/analytics.ts` never fabricates deterministic mock numbers: if a provider API does not expose an insight metric or returns an error, `syncStatus` reports `"unavailable"` (`null` metrics).
- Reactive Engagement Auto-Plugs (`lib/social/reactive-engagement.ts` posting automated `ART-...` WhatsApp booking CTAs when a post crosses its viral threshold) fire **strictly once per post** (`autoPlugFiredAt` idempotency lock) and **only** when verified live provider metrics exceed the configured threshold.
