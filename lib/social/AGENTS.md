# Native Core 5 Social Engine (`lib/social`)

## Overview

Native Core 5 multi-channel OAuth, media SSRF safety, PKT slot reservation, AI captioning, publishing, first-comment auto-plug, and live-only analytics ported from [services/postiz-app](../../../services/postiz-app/) for `instagram`, `facebook`, `youtube`, `gmb`, and `tiktok` (with optional `composio.ts` fallback limited to `instagram`/`facebook`).

## Key files

| File | Owns |
|---|---|
| [providers/index.ts](./providers/index.ts) | `SOCIAL_PROVIDERS` registry (`instagram`, `facebook`, `tiktok`, `youtube`, `gmb`) |
| [providers/instagram.ts](./providers/instagram.ts) & [facebook.ts](./providers/facebook.ts) | Graph publishing, Reel/Story `pollInstagramContainerFinished()`, Page tokens |
| [providers/gmb.ts](./providers/gmb.ts) & [tiktok.ts](./providers/tiktok.ts) | `isGbpApiApproved()`, `isTikTokDirectPostApproved()`, `queryTikTokCreatorInfo()` |
| [providers/youtube.ts](./providers/youtube.ts) | `YOUTUBE_DAILY_QUOTA_LIMIT`, `reserveYouTubeQuotaUnits()` quota tracking |
| [oauth-state.ts](./oauth-state.ts) & [crypto.ts](./crypto.ts) | HKDF HMAC-SHA256 CSRF `state`, validated origin, `v2:` [vault](../security/vault.ts) encryption |
| [route.ts](../../app/api/oauth/social/%5Bprovider%5D/route.ts) & [callback](../../app/api/oauth/social/%5Bprovider%5D/callback/route.ts) | `requireSuperAdmin()` OAuth initiation & 15m `PENDING_SELECTION` staging |
| [token-refresh.ts](./token-refresh.ts) | `refreshSingleSocialIntegrationToken()`, Meta Page-token re-derivation |
| [publish-executor.ts](./publish-executor.ts) & [safe-media.ts](./safe-media.ts) | Worker-safe execution & HTTPS R2 allowlist + [ssrf-guard.ts](../security/ssrf-guard.ts) |
| [time-slots.ts](./time-slots.ts) & [caption-copilot.ts](./caption-copilot.ts) | `Asia/Karachi` slots (`11:00`, `16:00`, `21:00`), `pg_advisory_xact_lock`, AI copy |
| [analytics.ts](./analytics.ts) & [reactive-engagement.ts](./reactive-engagement.ts) | Honest live-only insights sync (`null` fallback) & reactive comment plug |

## Conventions

- **OAuth Hardening**: OAuth routes execute `requireSuperAdmin()` before inspecting `?code` or cookies (`buildOAuthAuthFailureResponse`), require validated HTTPS non-loopback `NEXT_PUBLIC_APP_URL` in prod (`resolveValidatedOAuthAppOrigin()`), and verify HKDF `state` via `timingSafeEqual` (15m TTL) plus HttpOnly PKCE cookies.
- **Credential Encryption & `PENDING_SELECTION`**: Encrypt provider tokens with `v2:` vault ([crypto.ts](./crypto.ts)) and stage multi-page picks in `social_integrations` ([social-scheduler.ts](../../db/schema/social-scheduler.ts)) as `PENDING_SELECTION` (`15m` expiry).
- **SSRF Media Allowlist**: [safe-media.ts](./safe-media.ts) restricts media uploads to allowlisted HTTPS R2 / first-party hosts (`getSocialAllowedMediaHosts`), blocking `blob:`, `data:`, `file:`, loopback, RFC1918, and DNS rebinding via [ssrf-guard.ts](../security/ssrf-guard.ts).
- **Worker-Safe Execution**: [publish-executor.ts](./publish-executor.ts) avoids `next/headers` so [publish-social-post.task.ts](../../trigger/publish-social-post.task.ts) preserves per-platform captions/`_meta`, triggers fault-isolated first-comment plugs ([first-comment.ts](./first-comment.ts), skipped on `STORY`), and formats `1080×1520` assets ([normalize-media.ts](./normalize-media.ts)).
- **PKT Scheduling & Copilot**: [time-slots.ts](./time-slots.ts) operates strictly in `Asia/Karachi` (`UTC+5`) and uses `pg_advisory_xact_lock` inside `reserveNextFreePostingSlotInTx()` to avoid concurrent slot collisions; [caption-copilot.ts](./caption-copilot.ts) falls back deterministically to Askari 10 copy (`buildDeterministicSocialCaptions`).

## Gotchas

- **Meta Page-Token Preservation**: Never overwrite a Facebook/Instagram integration's `encryptedAccessToken` with a bare User token. `refreshSingleSocialIntegrationToken()` ([token-refresh.ts](./token-refresh.ts)) must pass `{ internalAccountId, pageId, metadata }` so `/me/accounts` re-derives the Page token; transient refresh errors preserve `isActive` while permanent errors (`190`, `invalid_grant`, `OAuthException`) mark `status: "EXPIRED"`, `isActive: false`.
- **`OD-11` Vendor Audit Gates**: Keep `isGbpApiApproved()` (`GBP_API_APPROVED === "true"`) gating GBP v1 (`mybusinessaccountmanagement`, `mybusinessbusinessinformation`, `businessprofileperformance`), and keep `isTikTokDirectPostApproved()` (`TIKTOK_DIRECT_POST_APPROVED === "true"`) forcing safe `SELF_ONLY` privacy via `queryTikTokCreatorInfo()` + `pollTikTokPublishComplete()` until TikTok App Review approval.
- **Honest Live-Only Analytics (`T-036`)**: `fetchSocialTargetAnalytics()` ([analytics.ts](./analytics.ts)) returns `null` when tokens are mock/local/Composio, `externalPostId` is missing, or approval flags are off — NEVER fabricate synthetic engagement numbers; `evaluateAndTriggerReactiveEngagementPlug()` runs only when `syncedTargets > 0`.

## Related specs

- [Spec 0010 — Native Postiz Social & Trigger Cloud](../../docs/specs/0010-native-postiz-social-and-trigger-cloud.md)
- [Spec 0014 — OAuth Selector, Reels, Comments & Analytics](../../docs/specs/0014-postiz-phase2-oauth-selector-reels-comments-analytics.md)
- [Spec 0020 — Calendar Slots, AI Composer & Providers](../../docs/specs/0020-postiz-phase3-calendar-slots-ai-composer-and-providers.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
