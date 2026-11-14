# A02 — Complete Authorization & Validation Matrix

**Auditor**: A02 (Authentication, Authorization & Sessions)  
**Target**: `c:\dev\al-ramlah-travels\web` (Read-Only Static & AST Audit)  
**Companion Report**: `docs/audit/findings/A02.md` (`A02-001` through `A02-013`)

---

## Executive Summary

| Surface | Files | Total Runtime Units | `PASS` | `OVER-PERMISSIVE` | `VULNERABLE` | Notes |
|---|---:|---:|---:|---:|---:|---|
| Edge / Proxy (`proxy.ts`) | 1 | 1 matcher (`/admin/:path*`) | 0 | 0 | 1 | Cookie-existence check only; forced-logout GET gadget (`A02-011`) |
| App Router Layouts (`layout.tsx`) | 3 | 3 layouts | 3 | 0 | 0 | `app/admin/(dashboard)/layout.tsx:22` enforces `requireAdmin()` |
| App Router Pages (`page.tsx`) | 26 | 26 routes (`4` public/auth, `8` admin views, `14` redirects) | 25 | 1 | 0 | `/admin/settings` leaks plaintext `webhookVerifyToken` & OAuth metadata to `staff` (`A02-005`) |
| API Route Handlers (`route.ts`) | 7 | 10 HTTP method handlers | 4 | 3 | 3 | `POST /api/auth/sign-up/email` public admin creation (`A02-001`); `local` upload (`A00-003`); OAuth callback (`A02-005`, `A02-007`) |
| Server Actions (`"use server"`) | 12 | 158 exported functions (+ 19 TS type/interface exports = 177 AST exports) | 114 | 38 | 6 | `executeScheduledPostNowAction` unauth (`A02-002`); `lookupApplicationStatus` phone bypass (`A02-003`); only 6/158 use `requireSuperAdmin` (`A02-005`) |

### Key Cross-Cutting Observations
1. **Active-Status (`isActive`) Enforcement**:
   - `requireAdmin()` (`lib/auth-guard.ts:20–39`) and `requireSuperAdmin()` (`lib/auth-guard.ts:45–57`) call `auth.api.getSession({ headers: await headers() })` and explicitly reject `!session.user.isActive` (`L31`, `L52`). Because `session.cookieCache` is NOT enabled in `lib/auth.ts`, Better Auth queries Neon PostgreSQL `session JOIN user` on every call (`node_modules/better-auth/dist/api/routes/session.mjs:153`), so `requireAdmin()`/`requireSuperAdmin()` immediately observe `user.isActive = false` and `user.role` changes.
   - **Gap (`A02-006`)**: Better Auth's own `/api/auth/*` endpoints (`POST /api/auth/sign-in/email`, `GET /api/auth/get-session`, `POST /api/auth/change-password`, `POST /api/auth/update-user`) and `proxy.ts` do **NOT** check `user.isActive`, and `toggleUserActive` / `updateUserRole` do **NOT** delete existing rows from the `session` table.
2. **Runtime Zod Coverage on Server Actions (`A02-010`)**:
   - Out of `158` exported Server Actions: `8` take zero arguments, `15` are thin pass-through wrappers delegating to another action (`14` admin/public aliases + `createRealtimeRunTokenAction`), `101` invoke a Zod `.parse()` / `.safeParse()` schema directly, and **`34` parameterized non-delegating Server Actions have zero runtime Zod validation** (relying solely on compile-time TypeScript annotations on public HTTP POST endpoints).

---

## 1. Request Proxy (`proxy.ts`)

| File : Lines | Matcher | Guard Mechanism | `isActive` Check | Verdict | Findings & Notes |
|---|---|---|---|---|---|
| `proxy.ts:12–46` | `["/admin/:path*"]` (`L45`) | Cookie presence only: `better-auth.session_token` or `__Secure-better-auth.session_token` (`L7–10`) | No (never queries DB or verifies HMAC/expiry) | `VULNERABLE` | **1)** Excludes `/api/:path*` and Server Action POSTs to `/`. **2)** `GET /admin/login?session_expired=1` unconditionally deletes session cookies (`L17–24`, cross-site top-level GET logout gadget). **3)** Drops `request.nextUrl.search` from `callbackUrl` (`L35`). Mitigated for `/admin/(dashboard)/*` RSCs by `layout.tsx:22` `requireAdmin()` (`A02-011`). |

---

## 2. App Router Layouts (`3` files)

| # | Layout File : Line | Route Scope | Auth Guard | `isActive` Check | Verdict | Notes |
|---:|---|---|---|---|---|---|
| 1 | `app/layout.tsx:78` | Root (`/*`) | `none` (intentional public root shell) | N/A | `PASS` | Uses `process.env.NEXT_PUBLIC_APP_URL \|\| "http://localhost:3000"` for `metadataBase` (`L42`). |
| 2 | `app/(public)/layout.tsx:10` | Public marketing shell (`/`, `/privacy`, `/terms`) | `none` (intentional public layout) | N/A | `PASS` | Reads `agencySettings` (`id = "default"`) for public header/footer contact numbers (`L18–20`). |
| 3 | `app/admin/(dashboard)/layout.tsx:15` | All `/admin/*` except `/admin/login` | `requireAdmin` (`L22`) | Yes (DB query via `getSession`; redirects on error to `/admin/login?session_expired=1` at `L24`) | `PASS` | Defense-in-depth wrapper around all `8` active hub views and `14` legacy redirect stubs. Passes `userRole` to `<AdminSidebar>` (`L79`). |

---

## 3. App Router Pages (`26` files)

| # | Route URL | File : Export Line | Layout Guard | Page Guard | `isActive` Check | Verdict | Notes |
|---:|---|---|---|---|---|---|---|
| 1 | `/` | `app/(public)/page.tsx:30` | `none` | `none` | N/A | `PASS` | Public Haramain landing page, Bespoke Builder, Group Departures, Hajj Inquiry, Tracker. |
| 2 | `/privacy` | `app/(public)/privacy/page.tsx:14` | `none` | `none` | N/A | `PASS` | Public Privacy Policy page. |
| 3 | `/terms` | `app/(public)/terms/page.tsx:14` | `none` | `none` | N/A | `PASS` | Public Terms of Service page. |
| 4 | `/admin/login` | `app/admin/(auth)/login/page.tsx:230` | `none` | `none` (Client login form) | No (`signIn.email` succeeds for `isActive=false` before dashboard layout kicks back; `A02-006`) | `PASS` | Open-redirect check at `L26–30` (`rawTarget.startsWith("/admin") && !rawTarget.startsWith("//")`) blocks external redirects. |
| 5 | `/admin` | `app/admin/(dashboard)/page.tsx:25` | `requireAdmin@L22` | `requireAdmin@L29` | Yes (DB) | `PASS` | Executive Overview KPIs & analytics hub. |
| 6 | `/admin/applications/[id]` | `app/admin/(dashboard)/applications/[id]/page.tsx:20` | `requireAdmin@L22` | `requireAdmin@L24` | Yes (DB) | `PASS` | Application dossier & Quote Worksheet (`params` awaited per Next.js 16). |
| 7 | `/admin/applications/[id]/voucher` | `app/admin/(dashboard)/applications/[id]/voucher/page.tsx:25` | `requireAdmin@L22` | `requireAdmin@L28` | Yes (DB) | `PASS` | Properly gated for staff, **but** no public signed pilgrim voucher route exists (`A00-011` / A10). |
| 8 | `/admin/campaigns` | `app/admin/(dashboard)/campaigns/page.tsx:70` | `requireAdmin@L22` | `requireAdmin@L73` | Yes (DB) | `PASS` | Social Scheduler, WA Groups/Status Queue, Broadcasts & 14-Day VIP Outreach hub. |
| 9 | `/admin/catalog` | `app/admin/(dashboard)/catalog/page.tsx:37` | `requireAdmin@L22` | `requireAdmin@L40` | Yes (DB) | `PASS` | Hotels, Flights, Transport, Ziyarat, Visa Rates & CMS hub. |
| 10 | `/admin/desk` | `app/admin/(dashboard)/desk/page.tsx:40` | `requireAdmin@L22` | `requireAdmin@L43` | Yes (DB) | `PASS` | Live WhatsApp Cloud Inbox + `@dnd-kit` Applications Kanban hub. |
| 11 | `/admin/settings` | `app/admin/(dashboard)/settings/page.tsx:40` | `requireAdmin@L22` | `requireAdmin@L44` | Yes (DB) | `OVER-PERMISSIVE` | **Leaks secrets/config to `staff` (`A02-005`)**: serializes plaintext `whatsappAccounts.webhookVerifyToken` (`L100`) and `socialIntegrations.metadata` (containing encrypted `pendingCandidates` tokens) into client RSC payload for `staff`, and renders editable `<SettingsClient />` (`agency` tab) to `staff`. `allUsers` query (`L77`) is gated on `isSuperAdmin`. |
| 12 | `/admin/studio` | `app/admin/(dashboard)/studio/page.tsx:26` | `requireAdmin@L22` | `requireAdmin@L29` | Yes (DB) | `PASS` | Multimodal BYO-Poster & Supplier Studio (exposes wholesale net costs to all `staff` by design). |
| 13 | `/admin/applications` | `app/admin/(dashboard)/applications/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/desk?tab=pipeline")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |
| 14 | `/admin/content` | `app/admin/(dashboard)/content/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/catalog?tab=cms")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |
| 15 | `/admin/distribution` | `app/admin/(dashboard)/distribution/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/campaigns?tab=social")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub (target tab mismatch noted in `W0-001`). |
| 16 | `/admin/flights` | `app/admin/(dashboard)/flights/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/catalog?tab=flights")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |
| 17 | `/admin/groups` | `app/admin/(dashboard)/groups/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/studio?tab=packages")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |
| 18 | `/admin/hotels` | `app/admin/(dashboard)/hotels/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/catalog?tab=hotels")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |
| 19 | `/admin/messages` | `app/admin/(dashboard)/messages/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/desk?tab=inbox")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |
| 20 | `/admin/outreach` | `app/admin/(dashboard)/outreach/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/campaigns?tab=outreach")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |
| 21 | `/admin/post-lookup` | `app/admin/(dashboard)/post-lookup/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/desk?lookup=1")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |
| 22 | `/admin/supplier-flyers` | `app/admin/(dashboard)/supplier-flyers/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/studio?tab=studio")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |
| 23 | `/admin/transport` | `app/admin/(dashboard)/transport/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/catalog?tab=transport")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |
| 24 | `/admin/users` | `app/admin/(dashboard)/users/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/settings?tab=staff")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub (`?tab=staff` falls back to `whatsapp` tab; `W0-001`). |
| 25 | `/admin/visa` | `app/admin/(dashboard)/visa/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/catalog?tab=visa")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |
| 26 | `/admin/ziyarat` | `app/admin/(dashboard)/ziyarat/page.tsx:3` | `requireAdmin@L22` | `none` (server `redirect("/admin/catalog?tab=ziyarat")`) | Yes (via layout `L22`) | `PASS` | Legacy redirect stub. |

---

## 4. API Route Handlers (`7` files, `10` HTTP method exports)

| # | Route File : Line | HTTP Method | Auth / Verification Guard | `isActive` Check | Zod Schema | Verdict | Findings & Notes |
|---:|---|---|---|---|---|---|---|
| 1 | `app/api/auth/[...all]/route.ts:4` | `GET` | Better Auth `toNextJsHandler(auth)` (`/api/auth/get-session`, `/api/auth/ok`, etc.) | **No** (`/get-session` returns user/session even when `user.isActive === false`; `A02-006`) | Better Auth internal | `PASS` | Read-only session/health endpoints; cookie flags degrade to `Secure=false` if `BETTER_AUTH_URL` is `http://` (`A02-007`). |
| 2 | `app/api/auth/[...all]/route.ts:4` | `POST` | Better Auth `toNextJsHandler(auth)` + `originCheck` | **No** (`sign-in/email` issues sessions to `isActive=false` users; `A02-006`) | Better Auth internal | `VULNERABLE` | **CRITICAL (`A02-001`)**: `emailAndPassword: { enabled: true }` without `disableSignUp: true` exposes unauthenticated `POST /api/auth/sign-up/email`, auto-creating active `role="staff"` admins! Also wildcard tunnel `trustedOrigins` in prod (`A02-007`) and `"no-trusted-ip"` global rate-limit DoS (`A02-008`). |
| 3 | `app/api/webhooks/whatsapp/route.ts:30` | `GET` | `hub.mode === "subscribe"` + constant-time SHA-256 `timingSafeEqualStrings` against `WHATSAPP_VERIFY_TOKEN` or active `whatsappAccounts.webhookVerifyToken` (`L19–25, L55–65`) | N/A | Manual query extraction (`L32–34`) | `PASS` | Note: `completeEmbeddedSignupCoexistenceAction` (`whatsapp-crm.ts:2756`) inserts hardcoded `"art_wa_token_verified"` into `whatsappAccounts.webhookVerifyToken` (`A02-005`). |
| 4 | `app/api/webhooks/whatsapp/route.ts:161` | `POST` | `readCappedBody` (`1 MB`, `413` at `L162`) + fail-closed `META_APP_SECRET` + `verifyMetaWebhookSignature` constant-time HMAC-SHA256 (`L169–196`, `lib/whatsapp/webhook-signature.ts:67`) | N/A | `whatsappWebhookPayloadSchema.safeParse` (downstream in `L203+`) | `PASS` | Cryptographic webhook verification is constant-time and fail-closed. |
| 5 | `app/api/oauth/social/[provider]/route.ts:53` | `GET` | `requireAdmin` (`L59`) + 32B CSPRNG state/PKCE cookies (`HttpOnly`, `SameSite=Lax`, `secure=isProduction`, 900s at `L91–107`) | Yes (DB) | `socialProviderIdSchema.safeParse@L67` | `OVER-PERMISSIVE` | Uses `requireAdmin()` instead of `requireSuperAdmin()` — allows `staff` to initiate agency OAuth flows (`A02-005`). |
| 6 | `app/api/oauth/social/[provider]/callback/route.ts:16` | `GET` | Pre-auth tunnel bounce (`L23–50`), then `requireAdmin` (`L54`) + single-use CSRF `state` cookie check (`L108`) | Yes (DB, after `L54`) | `socialProviderIdSchema.safeParse@L60` | `VULNERABLE` | **1)** `requireAdmin` lets `staff` overwrite agency `socialIntegrations` (`A02-005`). **2)** Pre-auth bounce (`L44–50`) redirects live `?code=...` to `NEXT_PUBLIC_APP_URL` (`http://localhost:3000` if misconfigured) before checking auth (`A02-007`). **3)** `social_oauth_candidates_${provider}` cookie omits `secure` flag (`L241–246`, `A02-007`). **4)** Logs secret `savedState` via `console.error` (`L109`, `A02-007`). |
| 7 | `app/api/oauth/social/[provider]/composio-callback/route.ts:13` | `GET` | `requireAdmin` (`L19`) + single-use CSRF `state` cookie check (`L61`) | Yes (DB) | Manual `SOCIAL_PROVIDER_IDS.includes` (`L29`) | `OVER-PERMISSIVE` | Lets `staff` overwrite agency `socialIntegrations` (`A02-005`) and logs expected `savedState` on mismatch (`L62–63`, `A02-007`). |
| 8 | `app/api/uploads/presign/route.ts:34` | `POST` | `requireAdmin` (`L36`) | Yes (DB) | `presignRequestSchema.safeParse@L46` (`15 MB` cap + MIME allowlist) | `PASS` | Auth and Zod schema enforced (storage bucket ACL / folder scoping covered by A03/A13). |
| 9 | `app/api/uploads/local/route.ts:74` | `PUT` | `requireAdmin` inside `handleLocalUpload` (`L8`) | Yes (DB) | **NONE** (`key` param regex-sanitized only; zero MIME/extension/size check) | `VULNERABLE` | Enabled unconditionally in `NODE_ENV=production`; allows any `staff` (or self-registered attacker via `A02-001`) to write arbitrary `.html`/`.svg` payloads to `public/uploads/r2-local/` (`A00-003` / A03 / A13). |
| 10 | `app/api/uploads/local/route.ts:78` | `POST` | `requireAdmin` inside `handleLocalUpload` (`L8`) | Yes (DB) | **NONE** | `VULNERABLE` | Same handler as `PUT` (`L74`); arbitrary file upload without MIME/size validation (`A00-003`). |

---

## 5. Server Actions (`12` `"use server"` modules, ALL `158` exported functions)

> **Completeness Note**: TypeScript AST inspection across all `12` files in `app/actions/*.ts` found **`177` total `export` statements**: **`158` exported runtime async functions** (enumerated 1–158 below) and **`19` compile-time-only TypeScript `interface`/`type` exports** (listed in §5.13 so every AST export is accounted for).
>
> **Legend**:
> - `requireStaffSession` (`app/actions/quoting-copilot.ts:74–77`) is a local wrapper calling `requireAdmin()` (`lib/auth-guard.ts:20`).
> - `delegates -> fn` indicates a 1-line exported alias that immediately calls `fn(...)` in the same or sibling `"use server"` module and inherits its guard/Zod behavior.

### 5.1 `app/actions/applications.ts` (`9` functions + `4` interfaces)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 1 | `generateApplicationReference` (`L35–49`) | `none` | N/A | `NONE` | `VULNERABLE` | Internal helper accidentally exported from `"use server"` file (`A02-013`); uses `Math.random()` (`L30`, `A02-009`) and allows unauthenticated DB probing on `applications.referenceNumber`. |
| 2 | `submitCustomApplication` (`L80–371`) | `none` (public form) | N/A | `customJourneyApplicationSchema.safeParse@L84` | `PASS` | Public Bespoke Umrah submission; Zod validated (rate-limiting/spam covered by A03/A06). |
| 3 | `submitGroupBookingApplication` (`L387–570`) | `none` (public form) | N/A | `groupBookingSchema.safeParse@L391` | `PASS` | Public Group Umrah booking; Zod validated (seat race covered by A07). |
| 4 | `submitGroupPackageApplication` (`L572–576`) | `delegates -> submitGroupBookingApplication` (`none`) | N/A | Via `#3` (`groupBookingSchema.safeParse@L391`) | `PASS` | Duplicate exported alias (`A02-013`). |
| 5 | `submitGroupBooking` (`L578–582`) | `delegates -> submitGroupBookingApplication` (`none`) | N/A | Via `#3` (`groupBookingSchema.safeParse@L391`) | `PASS` | Duplicate exported alias (`A02-013`; also re-exported in `groups.ts` `#55`). |
| 6 | `submitHajjInquiryApplication` (`L596–704`) | `none` (public form) | N/A | `hajjInquirySchema.safeParse@L600` | `PASS` | Public Hajj 2027 inquiry; Zod validated. |
| 7 | `submitHajjApplication` (`L706–710`) | `delegates -> submitHajjInquiryApplication` (`none`) | N/A | Via `#6` (`hajjInquirySchema.safeParse@L600`) | `PASS` | Duplicate exported alias (`A02-013`). |
| 8 | `submitHajjInquiry` (`L712–716`) | `delegates -> submitHajjInquiryApplication` (`none`) | N/A | Via `#6` (`hajjInquirySchema.safeParse@L600`) | `PASS` | Duplicate exported alias (`A02-013`; also re-exported in `groups.ts` `#56`). |
| 9 | `lookupApplicationStatus` (`L812–999`) | `none` (public tracker) | N/A | `statusLookupSchema.safeParse@L816` | `VULNERABLE` | **CRITICAL (`A02-003`)**: `customerPhone: z.string().trim().min(7)` allows `"-------"` -> `cleanPhoneNumber` returns `""` -> `storedPhoneDigits.endsWith("")` is **`true` for 100% of applications**! Plus distinct not-found vs phone-mismatch errors create an enumeration oracle with zero rate limit. |

### 5.2 `app/actions/catalog.ts` (`27` functions)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 10 | `upsertHotel` (`L47–132`) | `requireAdmin@L48` | Yes (DB) | `hotelSchema.parse@L49` | `PASS` | Validated catalog upsert. |
| 11 | `toggleHotelActive` (`L134–144`) | `requireAdmin@L135` | Yes (DB) | `NONE` (`id: string, isActive: boolean`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 12 | `deleteHotel` (`L146–175`) | `requireAdmin@L147` | Yes (DB) | `NONE` (`id: string`) | `OVER-PERMISSIVE` | Allows `staff` to permanently hard-delete master hotel inventory (`A02-005`); missing Zod (`A02-010`). |
| 13 | `upsertVehicle` (`L181–232`) | `requireAdmin@L182` | Yes (DB) | `vehicleSchema.parse@L183` | `PASS` | Validated catalog upsert. |
| 14 | `toggleVehicleActive` (`L234–244`) | `requireAdmin@L235` | Yes (DB) | `NONE` (`id: string, isActive: boolean`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 15 | `deleteVehicle` (`L246–275`) | `requireAdmin@L247` | Yes (DB) | `NONE` (`id: string`) | `OVER-PERMISSIVE` | Allows `staff` to hard-delete fleet vehicle types (`A02-005`); missing Zod (`A02-010`). |
| 16 | `deleteTransportVehicle` (`L277–279`) | `delegates -> deleteVehicle` (`requireAdmin@L247`) | Yes (DB) | `NONE` | `OVER-PERMISSIVE` | Duplicate alias (`A02-013`) + `staff` hard-delete (`A02-005`) + missing Zod (`A02-010`). |
| 17 | `upsertTransportSector` (`L281–336`) | `requireAdmin@L282` | Yes (DB) | `transportSectorSchema.parse@L283` | `PASS` | Validated catalog upsert. |
| 18 | `toggleSectorActive` (`L338–348`) | `requireAdmin@L339` | Yes (DB) | `NONE` (`id: string, isActive: boolean`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 19 | `deleteTransportSector` (`L350–380`) | `requireAdmin@L351` | Yes (DB) | `NONE` (`id: string`) | `OVER-PERMISSIVE` | Allows `staff` to hard-delete transport sectors (`A02-005`); missing Zod (`A02-010`). |
| 20 | `upsertTransportRate` (`L386–450`) | `requireAdmin@L387` | Yes (DB) | `transportRateSchema.parse@L388` | `PASS` | Validated catalog upsert. |
| 21 | `deleteTransportRate` (`L452–466`) | `requireAdmin@L453` | Yes (DB) | `NONE` (`id: string`) | `OVER-PERMISSIVE` | Allows `staff` to hard-delete sector pricing (`A02-005`); missing Zod (`A02-010`). |
| 22 | `upsertZiyaratPlace` (`L472–513`) | `requireAdmin@L473` | Yes (DB) | `ziyaratPlaceSchema.parse@L474` | `PASS` | Validated catalog upsert. |
| 23 | `toggleZiyaratActive` (`L515–525`) | `requireAdmin@L516` | Yes (DB) | `NONE` (`id: string, isActive: boolean`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 24 | `deleteZiyaratPlace` (`L527–557`) | `requireAdmin@L528` | Yes (DB) | `NONE` (`id: string`) | `OVER-PERMISSIVE` | Allows `staff` to hard-delete Ziyarat POIs (`A02-005`); missing Zod (`A02-010`). |
| 25 | `deleteZiyaratPoi` (`L559–561`) | `delegates -> deleteZiyaratPlace` (`requireAdmin@L528`) | Yes (DB) | `NONE` | `OVER-PERMISSIVE` | Duplicate alias (`A02-013`) + `staff` hard-delete (`A02-005`) + missing Zod (`A02-010`). |
| 26 | `upsertAirline` (`L567–608`) | `requireAdmin@L568` | Yes (DB) | `airlineSchema.parse@L569` | `PASS` | Validated catalog upsert. |
| 27 | `toggleAirlineActive` (`L610–620`) | `requireAdmin@L611` | Yes (DB) | `NONE` (`id: string, isActive: boolean`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 28 | `deleteAirline` (`L622–652`) | `requireAdmin@L623` | Yes (DB) | `NONE` (`id: string`) | `OVER-PERMISSIVE` | Allows `staff` to hard-delete airlines (`A02-005`); missing Zod (`A02-010`). |
| 29 | `upsertDepartureCity` (`L654–691`) | `requireAdmin@L655` | Yes (DB) | `departureCitySchema.parse@L656` | `PASS` | Validated catalog upsert. |
| 30 | `toggleDepartureCityActive` (`L693–703`) | `requireAdmin@L694` | Yes (DB) | `NONE` (`id: string, isActive: boolean`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 31 | `deleteDepartureCity` (`L705–735`) | `requireAdmin@L706` | Yes (DB) | `NONE` (`id: string`) | `OVER-PERMISSIVE` | Allows `staff` to hard-delete departure cities (`A02-005`); missing Zod (`A02-010`). |
| 32 | `updateVisaRate` (`L754–779`) | `requireAdmin@L755` | Yes (DB) | `updateVisaRateSchema.parse@L756` | `OVER-PERMISSIVE` | Master SAR/PKR exchange rate & fixed public `Visa Only` customer pricing can be overwritten by any `staff` (`A02-005`). |
| 33 | `updateAgencySettings` (`L802–853`) | `requireSuperAdmin@L803` | Yes (DB) | `agencySettingsActionSchema.parse@L804` | `PASS` | Properly restricted to `super_admin` (though UI renders form to `staff`; `A02-005`). |
| 34 | `createStaffUser` (`L859–903`) | `requireSuperAdmin@L860` | Yes (DB) | `createStaffUserSchema.parse@L861` | `PASS` | Guarded by `requireSuperAdmin`; note `auth.api.signUpEmail` (`L876`) will break once `disableSignUp: true` is enabled unless switched to `internalAdapter` (`A02-001`), and `revalidatePath("/admin/users")` (`L901`) targets a redirect stub (`A02-006`). |
| 35 | `toggleUserActive` (`L905–918`) | `requireSuperAdmin@L906` | Yes (DB) | `NONE` (`userId: string, isActive: boolean`) | `PASS` | Guarded by `requireSuperAdmin`, **but** fails to revoke active `session` rows, lacks last-`super_admin` count lock (`A02-006`), and omits runtime Zod (`A02-010`). |
| 36 | `updateUserRole` (`L920–936`) | `requireSuperAdmin@L924` | Yes (DB) | `NONE` (`userId: string, role: "super_admin" \| "staff"`) | `PASS` | Guarded by `requireSuperAdmin`, **but** fails to revoke active `session` rows, lacks last-`super_admin` count lock (`A02-006`), and omits runtime Zod (`z.enum` missing; arbitrary role string hits PG text column `user.role`! `A02-010`). |

### 5.3 `app/actions/cms.ts` (`12` functions)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 37 | `upsertHeroSlide` (`L20–67`) | `requireAdmin@L21` | Yes (DB) | `heroSlideSchema.parse@L22` | `PASS` | Validated CMS upsert. |
| 38 | `toggleHeroSlideActive` (`L69–79`) | `requireAdmin@L70` | Yes (DB) | `NONE` (`id: string, isActive: boolean`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 39 | `deleteHeroSlide` (`L81–87`) | `requireAdmin@L82` | Yes (DB) | `NONE` (`id: string`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 40 | `upsertTestimonial` (`L93–138`) | `requireAdmin@L94` | Yes (DB) | `testimonialSchema.parse@L95` | `PASS` | Validated CMS upsert. |
| 41 | `toggleTestimonialActive` (`L140–150`) | `requireAdmin@L141` | Yes (DB) | `NONE` (`id: string, isActive: boolean`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 42 | `deleteTestimonial` (`L152–158`) | `requireAdmin@L153` | Yes (DB) | `NONE` (`id: string`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 43 | `upsertFaq` (`L164–201`) | `requireAdmin@L165` | Yes (DB) | `faqSchema.parse@L166` | `PASS` | Validated CMS upsert. |
| 44 | `toggleFaqActive` (`L203–213`) | `requireAdmin@L204` | Yes (DB) | `NONE` (`id: string, isActive: boolean`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 45 | `deleteFaq` (`L215–221`) | `requireAdmin@L216` | Yes (DB) | `NONE` (`id: string`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 46 | `updateContactMessageStatus` (`L233–251`) | `requireAdmin@L234` | Yes (DB) | `updateMessageStatusSchema.parse@L235` | `PASS` | Validated status update. |
| 47 | `deleteContactMessage` (`L253–258`) | `requireAdmin@L254` | Yes (DB) | `NONE` (`id: string`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 48 | `submitContactMessage` (`L264–283`) | `none` (public form) | N/A | `contactMessageSchema.parse@L265` | `PASS` | Public contact form; Zod validated (rate-limit/honeypot covered by A03/A08). |

### 5.4 `app/actions/command-lookup.ts` (`1` function + `1` interface)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 49 | `searchPostPackagesCommandAction` (`L78–316`) | `requireAdmin@L85` | Yes (DB) | `NONE` (`rawQuery: string = ""`, manual `typeof`/`trim` check) | `PASS` | Missing Zod max-length schema (`A02-010`). |

### 5.5 `app/actions/groups.ts` (`7` functions)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 50 | `upsertGroupPackage` (`L35–110`) | `requireAdmin@L36` | Yes (DB) | `groupPackageSchema.parse@L37` | `PASS` | Validated group package upsert. |
| 51 | `toggleGroupPackageActive` (`L112–122`) | `requireAdmin@L113` | Yes (DB) | `NONE` (`id: string, isActive: boolean`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 52 | `deleteGroupPackage` (`L124–154`) | `requireAdmin@L125` | Yes (DB) | `NONE` (`id: string`) | `OVER-PERMISSIVE` | Allows `staff` to permanently hard-delete group packages (`A02-005`); missing Zod (`A02-010`). |
| 53 | `upsertGroupDeparture` (`L160–231`) | `requireAdmin@L161` | Yes (DB) | `groupDepartureSchema.parse@L162` | `PASS` | Validated departure upsert. |
| 54 | `deleteGroupDeparture` (`L233–263`) | `requireAdmin@L234` | Yes (DB) | `NONE` (`id: string`) | `OVER-PERMISSIVE` | Allows `staff` to hard-delete group departures (`A02-005`); missing Zod (`A02-010`). |
| 55 | `submitGroupBooking` (`L269–271`) | `delegates -> submitGroupBookingApplication` (`none`) | N/A | Via `#3` (`groupBookingSchema.safeParse@L391`) | `PASS` | Cross-module duplicate alias (`A02-013`). |
| 56 | `submitHajjInquiry` (`L273–275`) | `delegates -> submitHajjInquiryApplication` (`none`) | N/A | Via `#6` (`hajjInquirySchema.safeParse@L600`) | `PASS` | Cross-module duplicate alias (`A02-013`). |

### 5.6 `app/actions/marketing-ops.ts` (`21` functions + `1` interface)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 57 | `upsertSupplier` (`L56–118`) | `requireAdmin@L57` | Yes (DB) | `supplierSchema.safeParse@L58` | `OVER-PERMISSIVE` | Allows `staff` to modify wholesale B2B supplier directory & default markup settings (`A02-005`). |
| 58 | `uploadRawFlyerFileAction` (`L124–148`) | `requireAdmin@L125` | Yes (DB) | `NONE` (`formData: FormData`, manual `15 MB` check only; no MIME allowlist) | `PASS` | Missing Zod / MIME allowlist (`A02-010`; upload security in A03/A11). |
| 59 | `extractSupplierFlyerDraftAction` (`L150–194`) | `requireAdmin@L155` | Yes (DB) | `NONE` (`params: { imageUrl?, supplierSlug?, presetKey? }`) | `PASS` | Missing Zod URL/SSRF validation on `params.imageUrl` (`A02-010`; SSRF analyzed by A03/A11). |
| 60 | `upsertSupplierFlyerWithPackages` (`L200–423`) | `requireAdmin@L201` | Yes (DB) | `supplierFlyerUpsertSchema.safeParse@L202` | `PASS` | Validated flyer & package extraction save. |
| 61 | `generateMultiPackageSheetForFlyer` (`L429–599`) | `requireAdmin@L430` | Yes (DB) | `NONE` (`flyerId: string`) | `PASS` | Missing runtime Zod UUID validation (`A02-010`). |
| 62 | `generateSingleSpotlightForCard` (`L601–764`) | `requireAdmin@L602` | Yes (DB) | `NONE` (`packageItemId: string`) | `PASS` | Missing runtime Zod UUID validation (`A02-010`). |
| 63 | `publishFlyerCardToPublicGroupPackages` (`L965–1007`) | `requireAdmin@L968` | Yes (DB) | `NONE` (`packageItemId: string`) | `PASS` | Missing runtime Zod UUID validation (`A02-010`). |
| 64 | `publishAllFlyerCardsToPublicGroupPackagesAction` (`L1009–1083`) | `requireAdmin@L1012` | Yes (DB) | `publishAllFlyerCardsSchema.safeParse@L1014` | `PASS` | Validated bulk publish. |
| 65 | `convertPostLookupToApplication` (`L1089–1208`) | `requireAdmin@L1098` | Yes (DB) | `NONE` (`params: { packageItemId, customerName, customerPhone, adults, ... }`) | `PASS` | **Complex multi-field mutation with zero runtime Zod (`A02-010`)**: unvalidated `adults` (negative/NaN/float), `selectedRoomType`, `customerPhone` written directly to `applications`. |
| 66 | `upsertMarketingChannel` (`L1214–1270`) | `requireAdmin@L1215` | Yes (DB) | `marketingChannelSchema.safeParse@L1216` | `PASS` | Validated channel upsert. |
| 67 | `dispatchOrLogDistribution` (`L1272–1374`) | `requireAdmin@L1273` | Yes (DB) | `logDistributionSchema.safeParse@L1274` | `PASS` | Validated distribution log/dispatch. |
| 68 | `upsertOutreachContact` (`L1380–1438`) | `requireAdmin@L1381` | Yes (DB) | `outreachContactSchema.safeParse@L1382` | `PASS` | Validated VIP outreach contact upsert. |
| 69 | `sendPersonalOutreachAction` (`L1440–1541`) | `requireAdmin@L1441` | Yes (DB) | `sendOutreachMessageSchema.safeParse@L1442` | `PASS` | Validated 1:1 outreach send. |
| 70 | `markContactInboundReplyAction` (`L1543–1565`) | `requireAdmin@L1544` | Yes (DB) | `NONE` (`contactId: string`) | `PASS` | Missing runtime Zod UUID validation (`A02-010`). |
| 71 | `testGotenbergConnectionAction` (`L1571–1588`) | `requireAdmin@L1572` | Yes (DB) | N/A (0 args) | `PASS` | Read-only Gotenberg health probe. |
| 72 | `ingestFinishedPosterOrFlyerAction` (`L1600–1878`) | `requireAdmin@L1603` | Yes (DB) | `NONE` (`rawInput: IngestFinishedPosterOrFlyerInput`) | `PASS` | **Large multi-field Studio ingestion endpoint with zero runtime Zod (`A02-010`)** (`fileUrl`, `title`, `manualPricePkr`, `mode`, etc. only manually checked). |
| 73 | `updateExtractedFlyerCardAction` (`L1884–2019`) | `requireAdmin@L1885` | Yes (DB) | `updateExtractedFlyerCardSchema.safeParse@L1886` | `PASS` | Validated flyer card edit. |
| 74 | `updatePackageSpotlightImageAction` (`L2027–2107`) | `requireAdmin@L2028` | Yes (DB) | `updatePackageSpotlightImageSchema.safeParse@L2029` | `PASS` | Validated spotlight image update. |
| 75 | `deleteSupplierFlyerAction` (`L2109–2198`) | `requireAdmin@L2110` | Yes (DB) | `deleteSupplierFlyerSchema.safeParse@L2111` | `OVER-PERMISSIVE` | Allows `staff` to permanently hard-delete supplier flyers and cascade-delete extracted package cards (`A02-005`). |
| 76 | `dispatchDistributionMatrixPostsAction` (`L2201–2203`) | `delegates -> dispatchOrLogDistribution` (`requireAdmin@L1273`) | Yes (DB) | Via `#67` (`logDistributionSchema.safeParse@L1274`) | `PASS` | Duplicate exported alias (`A02-013`). |
| 77 | `sendDirect1on1OutreachMessageAction` (`L2205–2207`) | `delegates -> sendPersonalOutreachAction` (`requireAdmin@L1441`) | Yes (DB) | Via `#69` (`sendOutreachMessageSchema.safeParse@L1442`) | `PASS` | Duplicate exported alias (`A02-013`). |

### 5.7 `app/actions/quotes.ts` (`4` functions + `1` type)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 78 | `saveApplicationQuote` (`L50–327`) | `requireAdmin@L51` | Yes (DB) | `saveQuoteInputSchema.safeParse@L54` | `PASS` | Records `createdByUserId: session.user.id`. |
| 79 | `updateApplicationStatus` (`L334–528`) | `requireAdmin@L335` | Yes (DB) | `applicationStatusUpdateSchema.safeParse@L338` | `PASS` | Validated Kanban status update (state machine rules covered by A10). |
| 80 | `generateApplicationLuxuryPdf` (`L742–816`) | `requireAdmin@L743` | Yes (DB) | `NONE` (`applicationId: string`) | `PASS` | Missing runtime Zod UUID validation (`A02-010`). |
| 81 | `startApplicationLuxuryPdfRunAction` (`L824–911`) | `requireAdmin@L834` | Yes (DB) | `NONE` (`applicationId: string`) | `PASS` | Missing runtime Zod UUID validation (`A02-010`). |

### 5.8 `app/actions/quoting-copilot.ts` (`5` functions + `4` types)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 82 | `generateWaConversationCopilotDraftAction` (`L83–161`) | `requireStaffSession@L87` (`-> requireAdmin`) | Yes (DB) | `waConversationCopilotInputSchema.safeParse@L97` | `PASS` | Validated AI copilot draft action. |
| 83 | `generateApplicationQuoteCopilotDraftAction` (`L168–249`) | `requireStaffSession@L172` (`-> requireAdmin`) | Yes (DB) | `applicationQuoteCopilotInputSchema.safeParse@L183` | `PASS` | Validated AI quote copilot draft action. |
| 84 | `startWhatsappCopilotRunAction` (`L257–342`) | `requireStaffSession@L268` (`-> requireAdmin`) | Yes (DB) | `waConversationCopilotInputSchema.safeParse@L277` | `PASS` | Validated Trigger.dev realtime copilot launch. |
| 85 | `startApplicationCopilotRunAction` (`L350–411`) | `requireStaffSession@L361` (`-> requireAdmin`) | Yes (DB) | `applicationQuoteCopilotInputSchema.safeParse@L370` | `PASS` | Validated Trigger.dev realtime copilot launch. |
| 86 | `triggerQuotingCopilotAction` (`L416–421`) | `delegates -> startApplicationCopilotRunAction` (`requireStaffSession@L361`) | Yes (DB) | Via `#85` (`applicationQuoteCopilotInputSchema.safeParse@L370`) | `PASS` | Duplicate exported alias (`A02-013`). |

### 5.9 `app/actions/social-scheduler.ts` (`20` functions + `2` interfaces)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 87 | `listSocialIntegrationsAction` (`L116–161`) | `requireAdmin@L122` | Yes (DB) | N/A (0 args) | `PASS` | Returns safe projection (omits encrypted token columns). |
| 88 | `getPendingSocialAccountCandidatesAction` (`L167–258`) | `requireAdmin@L182` | Yes (DB) | `NONE` (`input?: SocialProviderId \| { provider?, integrationId? }`) | `OVER-PERMISSIVE` | Allows `staff` to inspect pending OAuth account candidates (`A02-005`); missing Zod (`A02-010`). |
| 89 | `selectSocialAccountCandidateAction` (`L264–474`) | `requireAdmin@L272` | Yes (DB) | `selectSocialAccountCandidateSchema.safeParse@L273` | `OVER-PERMISSIVE` | Allows `staff` to bind/overwrite agency-wide Core 5 OAuth accounts (`A02-005`). |
| 90 | `refreshSocialIntegrationTokenAction` (`L479–527`) | `requireAdmin@L488` | Yes (DB) | `refreshSocialIntegrationTokenSchema.safeParse@L489` | `OVER-PERMISSIVE` | Allows `staff` to rotate agency OAuth tokens (`A02-005`). |
| 91 | `runProactiveTokenRefreshAction` (`L529–531`) | `delegates -> refreshSocialIntegrationTokenAction` (`requireAdmin@L488`) | Yes (DB) | Via `#90` (`refreshSocialIntegrationTokenSchema.safeParse@L489`) | `OVER-PERMISSIVE` | Duplicate alias (`A02-013`) + `staff` token rotation (`A02-005`). |
| 92 | `disconnectSocialIntegrationAction` (`L536–568`) | `requireAdmin@L540` | Yes (DB) | `disconnectSocialIntegrationSchema.safeParse@L541` | `OVER-PERMISSIVE` | Allows `staff` to disconnect & wipe encrypted OAuth tokens for agency channels (`A02-005`). |
| 93 | `saveManualSocialIntegrationAction` (`L573–660`) | `requireAdmin@L577` | Yes (DB) | `saveManualSocialIntegrationSchema.safeParse@L578` | `OVER-PERMISSIVE` | Allows `staff` to inject arbitrary OAuth `accessToken` / `refreshToken` for Instagram, FB, TikTok, YT, GMB (`A02-005`). |
| 94 | `listScheduledPostsAction` (`L683–771`) | `requireAdmin@L692` | Yes (DB) | `NONE` (`filter?: { status?: string; limit?: number }`) | `PASS` | Missing runtime Zod (`A02-010`; caps `limit <= 200` manually). |
| 95 | `generateArtFirstCommentAction` (`L776–902`) | `requireAdmin@L785` | Yes (DB) | `generateArtFirstCommentSchema.safeParse@L786` | `PASS` | Validated first-comment generator. |
| 96 | `syncSocialPostAnalyticsAction` (`L908–942`) | `requireAdmin@L916` | Yes (DB) | `syncSocialPostAnalyticsSchema.safeParse@L917` | `PASS` | Validated single-post analytics sync. |
| 97 | `syncAllPublishedPostsAnalyticsAction` (`L947–980`) | `requireAdmin@L958` | Yes (DB) | `NONE` (`rawInput?: { limit?: number }`) | `PASS` | Missing runtime Zod (`A02-010`; caps `limit <= 50` manually). |
| 98 | `createScheduledSocialPostAction` (`L986–1229`) | `requireAdmin@L995` | Yes (DB) | `createScheduledPostSchema.safeParse@L996` | `PASS` | Validated social post scheduler; records `createdByUserId: session.user.id`. |
| 99 | `scheduleSocialPostAction` (`L1231–1233`) | `delegates -> createScheduledSocialPostAction` (`requireAdmin@L995`) | Yes (DB) | Via `#98` (`createScheduledPostSchema.safeParse@L996`) | `PASS` | Duplicate exported alias (`A02-013`). |
| 100 | `executeScheduledPostNowAction` (`L1443–1662`) | **`none` (ZERO AUTH GUARD!)** | **No** | **`NONE`** (`params: { scheduledPostId: string }`) | `VULNERABLE` | **CRITICAL (`A02-002` / `A00-001`)**: Public `"use server"` POST endpoint with zero authentication and zero Zod validation! Any anonymous caller can decrypt agency OAuth tokens and immediately publish any `DRAFT`/`SCHEDULED` post across Instagram, Facebook, TikTok, YouTube & GMB. |
| 101 | `cancelScheduledPostAction` (`L1667–1763`) | `requireAdmin@L1671` | Yes (DB) | `cancelScheduledPostSchema.safeParse@L1672` | `PASS` | Validated schedule cancellation. |
| 102 | `retryFailedPostTargetAction` (`L1768–1926`) | `requireAdmin@L1772` | Yes (DB) | `retryFailedPostTargetSchema.safeParse@L1773` | `PASS` | Validated target retry. |
| 103 | `generateSocialCaptionsCopilotAction` (`L1937–1958`) | `requireAdmin@L1944` | Yes (DB) | `generateSocialCaptionsCopilotSchema.parse@L1947` | `PASS` | Validated AI social caption copilot. |
| 104 | `rescheduleSocialPostAction` (`L1963–2025`) | `requireAdmin@L1971` | Yes (DB) | `rescheduleSocialPostSchema.parse@L1975` | `PASS` | Validated post drag-and-drop reschedule. |
| 105 | `getNextFreeSocialSlotAction` (`L2031–2070`) | `requireAdmin@L2039` | Yes (DB) | `NONE` (`input?: { customSlots?: string[] }`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 106 | `listStudioMediaLibraryAssetsAction` (`L2076–2146`) | `requireAdmin@L2094` | Yes (DB) | `NONE` (`filter?: { kind?: string; search?: string; limit?: number }`) | `PASS` | Missing runtime Zod (`A02-010`). |

### 5.10 `app/actions/trigger-realtime.ts` (`5` functions + `4` interfaces)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 107 | `mintRealtimeRunPublicTokenAction` (`L71–135`) | `requireAdmin@L75` | Yes (DB) | `NONE` (`rawInput: string \| { runId: string }`) | `VULNERABLE` | **Unscoped Run Token Minting (`A02-012`)**: lacks Zod `run_*` validation (`A02-010`) and never verifies `runs.retrieve(runId)` tags/taskIdentifier before minting a 1-hour Trigger.dev `publicAccessToken` for any arbitrary run ID in the project. |
| 108 | `getTaskRunProgressAction` (`L141–268`) | `requireAdmin@L145` | Yes (DB) | `NONE` (`rawInput: string \| { runId: string }`) | `VULNERABLE` | **Unscoped Run Output Read (`A02-012`)**: lacks Zod (`A02-010`) and returns `run.metadata` + `run.output` for any `runId` without verifying task family or project tags. |
| 109 | `createRealtimeRunTokenAction` (`L273–279`) | `delegates -> mintRealtimeRunPublicTokenAction` (`requireAdmin@L75`) | Yes (DB) | `NONE` | `VULNERABLE` | Duplicate alias (`A02-013`) inheriting unscoped token minting (`A02-012`). |
| 110 | `createBatchRealtimeRunTokensAction` (`L284–338`) | `requireAdmin@L295` | Yes (DB) | `batchRunIdsInputSchema.parse@L296` | `PASS` | Zod validated (max 25 non-empty IDs); note same Trigger project tag-scoping recommendation applies (`A02-012`). |
| 111 | `listActiveRunsByTagsAction` (`L369–448`) | `requireAdmin@L373` | Yes (DB) | `listActiveRunsInputSchema.parse@L374` | `PASS` | Zod validated (`max(10)` tags, `max(50)` limit). |

### 5.11 `app/actions/whatsapp-crm.ts` (`36` functions)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 112 | `upsertWhatsappAccountAction` (`L91–281`) | `requireAdmin@L92` | Yes (DB) | `upsertWhatsappAccountSchema.parse@L93` | `OVER-PERMISSIVE` | **Privilege Escalation (`A02-005`)**: any `staff` user can overwrite Meta System User `accessToken`, `wabaId`, `phoneNumberId`, `businessManagerId`, and `webhookVerifyToken`! |
| 113 | `syncWhatsappTemplatesAction` (`L283–394`) | `requireAdmin@L284` | Yes (DB) | `NONE` (`accountId: string`) | `OVER-PERMISSIVE` | WABA template sync accessible to `staff` (`A02-005`); missing runtime Zod (`A02-010`). |
| 114 | `listWhatsappConversationsAction` (`L400–504`) | `requireAdmin@L407` | Yes (DB) | `NONE` (`params?: { accountId?, search?, filter?, limit?, offset? }`) | `PASS` | Missing runtime Zod (`A02-010`; caps `limit <= 100` manually). |
| 115 | `getConversationMessagesAction` (`L506–526`) | `requireAdmin@L510` | Yes (DB) | `NONE` (`conversationId: string, limit = 50`) | `PASS` | **Uncapped `limit` (`A02-010`)**: `limit` is passed directly to `.limit(limit)` (`L523`) without clamping or Zod `z.number().int().min(1).max(200)`. |
| 116 | `getWhatsappConversationThreadAction` (`L528–533`) | `delegates -> getConversationMessagesAction` (`requireAdmin@L510`) | Yes (DB) | `NONE` | `PASS` | Duplicate alias (`A02-013`) + uncapped `limit` (`A02-010`). |
| 117 | `toggleWhatsappConversationPinAction` (`L539–558`) | `requireAdmin@L540` | Yes (DB) | `toggleWhatsappConversationPinSchema.parse@L541` | `PASS` | Validated Desk thread pin toggle. |
| 118 | `toggleWhatsappConversationArchiveAction` (`L560–579`) | `requireAdmin@L561` | Yes (DB) | `toggleWhatsappConversationArchiveSchema.parse@L562` | `PASS` | Validated Desk thread archive toggle. |
| 119 | `assignWhatsappConversationAgentAction` (`L581–604`) | `requireAdmin@L582` | Yes (DB) | `assignWhatsappConversationAgentSchema.parse@L583` | `PASS` | Validated staff assignment. |
| 120 | `addWhatsappConversationInternalNoteAction` (`L606–647`) | `requireAdmin@L607` | Yes (DB) | `addWhatsappConversationInternalNoteSchema.parse@L608` | `PASS` | Validated internal note append (`authorId: session.user.id`). |
| 121 | `sendWhatsappConversationReplyAction` (`L653–865`) | `requireAdmin@L654` | Yes (DB) | `sendWhatsappConversationReplySchema.parse@L655` | `PASS` | Validated 1:1 WhatsApp Desk reply. |
| 122 | `sendApplicationLuxuryPdfViaWhatsappAction` (`L871–1024`) | `requireAdmin@L872` | Yes (DB) | `sendApplicationLuxuryPdfSchema.parse@L873` | `PASS` | Validated PDF quote send. |
| 123 | `upsertQuickReplyAction` (`L1030–1101`) | `requireAdmin@L1031` | Yes (DB) | `upsertWhatsappQuickReplySchema.parse@L1032` | `PASS` | Validated `/shortcut` quick reply upsert. |
| 124 | `upsertWhatsappQuickReplyAction` (`L1103–1105`) | `delegates -> upsertQuickReplyAction` (`requireAdmin@L1031`) | Yes (DB) | Via `#123` (`upsertWhatsappQuickReplySchema.parse@L1032`) | `PASS` | Duplicate exported alias (`A02-013`). |
| 125 | `deleteQuickReplyAction` (`L1107–1117`) | `requireAdmin@L1108` | Yes (DB) | `deleteWhatsappQuickReplySchema.parse@L1109` | `PASS` | Validated quick reply delete. |
| 126 | `deleteWhatsappQuickReplyAction` (`L1119–1121`) | `delegates -> deleteQuickReplyAction` (`requireAdmin@L1108`) | Yes (DB) | Via `#125` (`deleteWhatsappQuickReplySchema.parse@L1109`) | `PASS` | Duplicate exported alias (`A02-013`). |
| 127 | `createAndQueueWhatsappBroadcastAction` (`L1127–1382`) | `requireSuperAdmin@L1128` | Yes (DB) | `createWhatsappBroadcastSchema.parse@L1129` | `PASS` | Exemplar RBAC: restricted to `super_admin` + Zod validated. |
| 128 | `getWhatsappBroadcastDetailsAction` (`L1384–1435`) | `requireAdmin@L1385` | Yes (DB) | `getWhatsappBroadcastDetailsSchema.parse@L1386` | `PASS` | Read-only broadcast delivery stats. |
| 129 | `retryFailedWhatsappBroadcastRecipientsAction` (`L1437–1601`) | `requireSuperAdmin@L1438` | Yes (DB) | `retryFailedWhatsappBroadcastSchema.parse@L1439` | `PASS` | Exemplar RBAC: restricted to `super_admin` + Zod validated. |
| 130 | `markConversationMessagesAsReadAction` (`L1607–1704`) | `requireAdmin@L1608` | Yes (DB) | `markConversationAsReadSchema.parse@L1612` | `PASS` | Validated blue-tick read receipt. |
| 131 | `markConversationReadAction` (`L1706–1708`) | `delegates -> markConversationMessagesAsReadAction` (`requireAdmin@L1608`) | Yes (DB) | Via `#130` (`markConversationAsReadSchema.parse@L1612`) | `PASS` | Duplicate exported alias (`A02-013`). |
| 132 | `sendWhatsAppInteractiveButtonsAction` (`L1710–1817`) | `requireAdmin@L1711` | Yes (DB) | `sendInteractiveButtonsSchema.parse@L1712` | `PASS` | Validated interactive button message. |
| 133 | `sendWhatsAppInteractiveListAction` (`L1819–1928`) | `requireAdmin@L1820` | Yes (DB) | `sendInteractiveListSchema.parse@L1821` | `PASS` | Validated interactive list message. |
| 134 | `sendWhatsAppReactionAction` (`L1930–2014`) | `requireAdmin@L1931` | Yes (DB) | `sendWhatsappReactionSchema.parse@L1932` | `PASS` | Validated emoji reaction. |
| 135 | `createWhatsAppTemplateAction` (`L2020–2129`) | `requireAdmin@L2021` | Yes (DB) | `createWhatsappTemplateSchema.parse@L2022` | `OVER-PERMISSIVE` | Allows `staff` to submit new Meta WABA templates for review (`A02-005`). |
| 136 | `deleteWhatsAppTemplateAction` (`L2131–2207`) | `requireAdmin@L2132` | Yes (DB) | `deleteWhatsappTemplateSchema.parse@L2133` | `OVER-PERMISSIVE` | Allows `staff` to delete approved Meta WABA templates (`A02-005`). |
| 137 | `toggleWhatsAppAutoResponderAction` (`L2209–2255`) | `requireAdmin@L2210` | Yes (DB) | `toggleWhatsappAutoResponderSchema.parse@L2211` | `OVER-PERMISSIVE` | Allows `staff` to disable agency-wide inbound WhatsApp bot (`A02-005`). |
| 138 | `triggerManualMediaMirrorAction` (`L2257–2276`) | `requireAdmin@L2258` | Yes (DB) | `triggerManualMediaMirrorSchema.parse@L2262` | `PASS` | Validated inbound media mirror retry. |
| 139 | `listWhatsappAutoReplyRulesAction` (`L2299–2325`) | `requireAdmin@L2300` | Yes (DB) | `NONE` (`accountId?: string`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 140 | `upsertWhatsappAutoReplyRuleAction` (`L2327–2400`) | `requireAdmin@L2328` | Yes (DB) | `upsertWhatsappAutoReplyRuleSchema.parse@L2329` | `PASS` | Validated rule upsert (note: `REGEX` ReDoS covered by A14 `H19`). |
| 141 | `deleteWhatsappAutoReplyRuleAction` (`L2402–2415`) | `requireAdmin@L2403` | Yes (DB) | `deleteWhatsappAutoReplyRuleSchema.parse@L2404` | `PASS` | Validated rule delete. |
| 142 | `toggleWhatsappAutoReplyRuleAction` (`L2417–2436`) | `requireAdmin@L2418` | Yes (DB) | `toggleWhatsappAutoReplyRuleSchema.parse@L2419` | `PASS` | Validated rule toggle. |
| 143 | `ensureDefaultAutoReplyRulesAction` (`L2438–2497`) | `requireAdmin@L2439` | Yes (DB) | `NONE` (`accountId?: string`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 144 | `updateWhatsappGreetingSettingsAction` (`L2499–2550`) | `requireAdmin@L2500` | Yes (DB) | `updateWhatsappGreetingSettingsSchema.parse@L2501` | `OVER-PERMISSIVE` | Allows `staff` to overwrite WABA business hours, welcome & away greetings (`A02-005`). |
| 145 | `updateConversationIntentAction` (`L2556–2584`) | `requireAdmin@L2561` | Yes (DB) | `NONE` (`rawInput: { conversationId, intentCategory, intentReason? }`) | `PASS` | Missing runtime Zod (`A02-010`; manual `includes` check on `intentCategory`, unvalidated `intentReason` length). |
| 146 | `handoffConversationToDedicatedAgentAction` (`L2586–2681`) | `requireAdmin@L2589` | Yes (DB) | `NONE` (`rawInput: { conversationId: string }`) | `PASS` | Missing runtime Zod (`A02-010`). |
| 147 | `completeEmbeddedSignupCoexistenceAction` (`L2683–2773`) | `requireAdmin@L2693` | Yes (DB) | `NONE` (`rawInput: { code?, accessToken?, wabaId, phoneNumberId, ... }`) | `OVER-PERMISSIVE` | **Multiple Flaws (`A02-005`, `A02-010`)**: **1)** `staff` can execute Meta Embedded Signup & overwrite WABA accounts; **2)** zero runtime Zod schema; **3)** hardcodes predictable `webhookVerifyToken: "art_wa_token_verified"` on new accounts (`L2756`). |

### 5.12 `app/actions/whatsapp-linked-device.ts` (`11` functions + `2` interfaces)

| # | Exported Function (`lines`) | Auth Guard | `isActive` Check | Zod Schema | Verdict | Notes / Finding |
|---:|---|---|---|---|---|---|
| 148 | `getLinkedDeviceStatusAction` (`L90–110`) | `requireAdmin@L94` | Yes (DB) | `NONE` (`sessionKey = "default"`) | `OVER-PERMISSIVE` | Returns live `qrDataUrl` & `pairingCode` to any `staff` (`A02-005`); missing Zod (`A02-010`). |
| 149 | `listLinkedDeviceSessionsAction` (`L115–134`) | `requireAdmin@L121` | Yes (DB) | N/A (0 args) | `OVER-PERMISSIVE` | Exposes all Baileys session slots (including pending `qrDataUrl` / `pairingCode`) to `staff` (`A02-005`). |
| 150 | `createLinkedDeviceSessionSlotAction` (`L139–163`) | `requireAdmin@L145` | Yes (DB) | `createLinkedDeviceSessionSlotSchema.parse@L146` | `OVER-PERMISSIVE` | Allows `staff` to create Baileys WhatsApp device slots (`A02-005`). |
| 151 | `updateLinkedDeviceSessionSlotAction` (`L168–196`) | `requireAdmin@L174` | Yes (DB) | `updateLinkedDeviceSessionSlotSchema.parse@L175` | `OVER-PERMISSIVE` | Allows `staff` to reconfigure Baileys device slots (`A02-005`). |
| 152 | `deleteLinkedDeviceSessionSlotAction` (`L202–222`) | `requireAdmin@L207` | Yes (DB) | `deleteLinkedDeviceSessionSlotSchema.parse@L208` | `OVER-PERMISSIVE` | Allows `staff` to wipe Baileys auth credentials & session slots (`A02-005`). |
| 153 | `startLinkedDeviceConnectionAction` (`L227–265`) | `requireAdmin@L235` | Yes (DB) | `startLinkedDeviceConnectionSchema.parse@L236` | `OVER-PERMISSIVE` | Allows `staff` to initiate QR / phone-number pairing on agency WhatsApp slots (`A02-005`). |
| 154 | `disconnectLinkedDeviceAction` (`L270–289`) | `requireAdmin@L274` | Yes (DB) | `NONE` (`sessionKey = "default"`) | `OVER-PERMISSIVE` | Allows `staff` to log out connected agency WhatsApp devices (`A02-005`); missing Zod (`A02-010`). |
| 155 | `syncRealWhatsappGroupsAction` (`L294–313`) | `requireAdmin@L298` | Yes (DB) | `NONE` (`sessionKey = "default"`) | `OVER-PERMISSIVE` | Allows `staff` to sync personal/founder WhatsApp group rosters (`A02-005`); missing Zod (`A02-010`). |
| 156 | `syncAllConnectedLinkedDevicesAction` (`L318–347`) | `requireAdmin@L326` | Yes (DB) | N/A (0 args) | `OVER-PERMISSIVE` | Allows `staff` to sync all connected Baileys devices (`A02-005`). |
| 157 | `purgeFakeMarketingChannelsAction` (`L352–399`) | `requireAdmin@L358` | Yes (DB) | N/A (0 args) | `OVER-PERMISSIVE` | Destructive bulk delete across `marketingChannels` accessible to `staff` (`A02-005`). |
| 158 | `dispatchAutomatedWhatsappGroupsCampaignAction` (`L404–460`) | `requireAdmin@L413` | Yes (DB) | `dispatchAutomatedWhatsappGroupsCampaignSchema.parse@L414` | `OVER-PERMISSIVE` | Allows `staff` to trigger automated Baileys multi-group blasts (high WhatsApp number-ban risk; compare `createAndQueueWhatsappBroadcastAction` `#127` which requires `super_admin`; `A02-005`). |

### 5.13 Non-Runtime TypeScript Type & Interface Exports in `"use server"` Modules (`19` declarations)

For AST audit completeness (`158` runtime functions + `19` compile-time type/interface exports = `177` `export` nodes):
- `app/actions/applications.ts` (`4`): `L68–78` (`CustomApplicationResult`), `L377–385` (`GroupBookingApplicationResult`), `L588–594` (`HajjInquiryApplicationResult`), `L722–810` (`ApplicationStatusLookupResult`).
- `app/actions/command-lookup.ts` (`1`): `L14–71` (`PostCommandLookupResult`).
- `app/actions/marketing-ops.ts` (`1`): `L1590–1598` (`IngestFinishedPosterOrFlyerInput`).
- `app/actions/quotes.ts` (`1`): `L31` (`SaveApplicationQuoteInput`).
- `app/actions/quoting-copilot.ts` (`4`): `L30–32`, `L34–36`, `L38–52`, `L54–68` (copilot input/result type aliases).
- `app/actions/social-scheduler.ts` (`2`): `L81–95` (`SocialIntegrationSummary`), `L666–678` (`ScheduledPostSummary`).
- `app/actions/trigger-realtime.ts` (`4`): `L43–53`, `L55–62`, `L340–347`, `L349–355` (run progress/summary interfaces).
- `app/actions/whatsapp-linked-device.ts` (`2`): `L40–55` (`LinkedDeviceSessionSlotRow`), `L57–62` (`StartLinkedDeviceResult`).
