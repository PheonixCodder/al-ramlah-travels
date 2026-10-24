# Independent Senior Code & Deployment Readiness Review

**Date**: 2026-10-24  
**Scope**: Full-stack deployment readiness audit across Infrastructure, Next.js 16 Config, Authentication, Neon PostgreSQL / Drizzle ORM, Domain Calculators, Custom Journey Builder (19 modules), Public Platform, and Admin Portal / Quoting CRM.

---

## Executive Summary

Three parallel independent Pro code-review subagents audited the entire codebase and ran `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test`. Together, they uncovered **31 concrete issues** across 4 severity tiers:
- **10 Critical / Deployment Blockers**
- **11 High Severity Issues**
- **7 Medium Severity Issues**
- **3 Low Severity / Polish Issues**

---

## 1. CRITICAL / DEPLOYMENT BLOCKERS (Must Fix Before Deployment)

1. **`npm run build` & `npm run typecheck` Fail on Corrupted `.next/dev/types/routes.d.ts`**
   - **Files**: [`tsconfig.json`](file:///c:/dev/al-ramlah-travels/tsconfig.json#L32), `.next/dev/types/routes.d.ts`
   - **Problem**: `tsconfig.json` includes volatile `.next/dev/types/**/*.ts` in compilation. A partial write in `.next/dev/types/routes.d.ts(91,1)` causes `tsc --noEmit` and `npm run build` to abort with `error TS1128: Declaration or statement expected`.
   - **Fix**: Remove `".next/dev/types/**/*.ts"` from `tsconfig.json` `"include"` and clean `.next/dev/types`.

2. **React 19 Rules of Hooks Violations Crash Custom Journey Builder When Toggling Pillars**
   - **Files**: [`components/planner/hotel-selection-module.tsx`](file:///c:/dev/al-ramlah-travels/components/planner/hotel-selection-module.tsx#L53-L88), [`components/planner/transport-selection-module.tsx`](file:///c:/dev/al-ramlah-travels/components/planner/transport-selection-module.tsx#L43-L65)
   - **Problem**: Both components execute early returns (`if (!pillars.hotels) return null` / `if (!pillars.transport) return null`) **before** calling `useMemo` and `useEffect`. Toggling the Hotels or Transport pillars changes the hook count between renders and throws a fatal React 19 client error (`Rendered fewer hooks than expected`). Also flagged as fatal ESLint `react-hooks/rules-of-hooks` errors.
   - **Fix**: Move all `useMemo` and `useEffect` hooks above the early `return null` statements.

3. **Transport Sector UUID vs. Code Mismatch Breaks `Transport Only` Mode & Station Transfers**
   - **Files**: [`components/planner/transport-selection-module.tsx`](file:///c:/dev/al-ramlah-travels/components/planner/transport-selection-module.tsx#L67-L91)
   - **Problem**:
     - `AIRPORT_SECTOR_IDS.has(s.id)` and `INTERCITY_SECTOR_IDS.has(s.id)` compare `s.id` (a database UUID) against sector code strings (`"JED_MAK"`, `"MAK_MED"`, etc.). As a result, `airportSectors` and `intercitySectors` are **always empty** in `Transport Only` mode, and all sectors get dumped into `ziyaratRailSectors`.
     - `hasStationTransfers` checks `s.sectorId === "MAK_TRN" || s.sectorId === "MED_TRN"`, whereas `s.sectorId` is stored as a UUID (`makTrnSector.id`). Thus `hasStationTransfers` is permanently `false` even after clicking `+ Add Station Transfers`.
   - **Fix**: Check `s.code` instead of `s.id` for `AIRPORT_SECTOR_IDS` / `INTERCITY_SECTOR_IDS`, and match `s.sectorId` against resolved sector UUIDs (`sec.code === "MAK_TRN" || sec.code === "MED_TRN"`).

4. **Plaintext One-Click Super Admin Credentials Exposed on Public `/admin/login` Page**
   - **File**: [`app/admin/(auth)/login/page.tsx`](file:///c:/dev/al-ramlah-travels/app/admin/%28auth%29/login/page.tsx#L205-L254)
   - **Problem**: Anyone visiting `/admin/login` in production can click the "Super Admin" demo button to auto-fill `admin@alramlahtravels.com` / `Admin@123456` and access the entire admin CRM.
   - **Fix**: Remove the one-click demo credentials block (or strictly gate it behind `process.env.NODE_ENV === "development"`).

5. **Production Domains Missing from `trustedOrigins` (`lib/auth.ts`) & `allowedOrigins` (`next.config.ts`)**
   - **Files**: [`lib/auth.ts`](file:///c:/dev/al-ramlah-travels/lib/auth.ts#L37-L47), [`next.config.ts`](file:///c:/dev/al-ramlah-travels/next.config.ts#L13-L25)
   - **Problem**: `trustedOrigins` in `lib/auth.ts` and `serverActions.allowedOrigins` in `next.config.ts` only list `localhost` and dev tunnel domains (`ngrok`, `trycloudflare`). In production behind a real domain / Nginx reverse proxy, Better Auth login and Next.js Server Actions will fail with 403 CSRF / Origin errors. Also `experimental.serverActions` in `next.config.ts` is deprecated in Next.js 16.
   - **Fix**: Dynamically include `process.env.NEXT_PUBLIC_APP_URL` and `process.env.BETTER_AUTH_URL` in both `trustedOrigins` and `allowedOrigins`.

6. **Premature Database Write Before Validation in `saveApplicationQuote`**
   - **File**: [`app/actions/quotes.ts`](file:///c:/dev/al-ramlah-travels/app/actions/quotes.ts#L93-L215)
   - **Problem**: `saveApplicationQuote` writes `applicationQuotes` (including `approvedAt = now`) on lines 120–131 **before** checking whether `grandTotalPkr <= 0` (line 156) or whether the group departure batch has enough remaining seats (line 190). If validation fails, the action returns `{ success: false }`, leaving the database corrupted with an `approvedAt` timestamp on a still-`pending_quote` application.
   - **Fix**: Move all precondition and seat-capacity validations **before** any database writes.

7. **Forked & Desynchronized Group / Hajj Server Actions (`app/actions/groups.ts` vs `app/actions/applications.ts`)**
   - **Files**: [`app/actions/groups.ts`](file:///c:/dev/al-ramlah-travels/app/actions/groups.ts#L267-L423), [`app/actions/applications.ts`](file:///c:/dev/al-ramlah-travels/app/actions/applications.ts#L355-L593), [`components/public/group-booking-modal.tsx`](file:///c:/dev/al-ramlah-travels/components/public/group-booking-modal.tsx#L20), [`components/public/hajj-inquiry-section.tsx`](file:///c:/dev/al-ramlah-travels/components/public/hajj-inquiry-section.tsx#L6)
   - **Problem**: `group-booking-modal.tsx` and `hajj-inquiry-section.tsx` call `submitGroupBooking` and `submitHajjInquiry` in `groups.ts` instead of the complete versions in `applications.ts`. The `groups.ts` versions fail to save `ksaArrivalDate` / `ksaDepartureDate` on group bookings (breaking the Status Tracker dates), fail to create an initial `applicationQuotes` row for Hajj inquiries, use an unvalidated 4-char random reference generator without DB uniqueness checks, and do not return a formatted WhatsApp URL.
   - **Fix**: Unify group booking and Hajj inquiry submissions so they set `ksaArrivalDate`/`ksaDepartureDate`, insert the initial `applicationQuotes` record, use collision-checked reference codes, catch Zod errors cleanly, and return the dynamic WhatsApp handoff URL.

8. **Non-Atomic Multi-Table Inserts & Group Seat Updates Without Rollback / Compensation**
   - **Files**: [`app/actions/applications.ts`](file:///c:/dev/al-ramlah-travels/app/actions/applications.ts#L170-L299), [`app/actions/quotes.ts`](file:///c:/dev/al-ramlah-travels/app/actions/quotes.ts#L183-L247), [`db/index.ts`](file:///c:/dev/al-ramlah-travels/db/index.ts)
   - **Problem**: Because `db/index.ts` uses `drizzle-orm/neon-http`, sequential inserts in `submitCustomApplication` (`applications` → `applicationHotelStays` → `applicationTransportSegments` → `applicationQuotes`) have no compensating cleanup if a child insert fails, leaving orphaned partial applications. Similarly, group seat updates should use atomic SQL expressions or compensating rollback.
   - **Fix**: Add compensating cleanup (`DELETE FROM applications WHERE id = newApp.id`) if child inserts fail, and guard group seat increments atomically.

9. **Expired Admin Session Causes Infinite Redirect / 500 Crash Loop**
   - **Files**: [`proxy.ts`](file:///c:/dev/al-ramlah-travels/proxy.ts#L7-L27), [`lib/auth-guard.ts`](file:///c:/dev/al-ramlah-travels/lib/auth-guard.ts#L19-L24), [`app/admin/(dashboard)/layout.tsx`](file:///c:/dev/al-ramlah-travels/app/admin/%28dashboard%29/layout.tsx#L15)
   - **Problem**: `proxy.ts` redirects `/admin/login` to `/admin` whenever a `better-auth.session_token` cookie exists, even if that session is expired in PostgreSQL. Then `app/admin/(dashboard)/layout.tsx` calls `requireAdmin()`, which throws an unhandled `Error("Unauthorized")` (500 crash), and visiting `/admin/login` redirects back to `/admin` in an infinite loop until cookies are manually cleared.
   - **Fix**: In `app/admin/(dashboard)/layout.tsx` (and `proxy.ts`), redirect to `/admin/login?session_expired=1` when `requireAdmin()` fails, and allow `/admin/login` to render whenever `?session_expired=1` is present.

10. **ESLint Build-Breaking Error in `applications-kpi-strip.tsx` (`@next/next/no-html-link-for-pages`)**
    - **File**: [`components/admin/applications/applications-kpi-strip.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/applications/applications-kpi-strip.tsx#L59-L63)
    - **Problem**: Uses raw `<a href="/admin/applications?status=pending_quote&filter=overdue">` instead of Next.js `<Link>`, causing `npm run lint` to fail with an error.
    - **Fix**: Replace `<a>` with `<Link>` from `next/link`.

---

## 2. HIGH SEVERITY ISSUES

11. **Admin Catalog CRUD Modals Do Not Update Table State Until Manual Browser Refresh (F5)**
    - **Files**: [`hotels-client.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/hotels-client.tsx), [`hotel-dialog.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/hotel-dialog.tsx), [`transport-client.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/transport-client.tsx), [`vehicle-dialog.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/vehicle-dialog.tsx), [`sector-dialog.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/sector-dialog.tsx), [`ziyarat-client.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/ziyarat-client.tsx), [`ziyarat-dialog.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/ziyarat-dialog.tsx), [`flights-client.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/flights-client.tsx), [`airline-dialog.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/airline-dialog.tsx), [`departure-city-dialog.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/departure-city-dialog.tsx), [`groups-client.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/groups-client.tsx), [`group-package-dialog.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/group-package-dialog.tsx), [`departure-batch-dialog.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/departure-batch-dialog.tsx), [`content-client.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/content-client.tsx), [`content-dialogs.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/catalog/content-dialogs.tsx)
    - **Problem**: Parent catalog components initialize `useState(initialItems)` without a `useEffect(() => setItems(initialItems), [initialItems])` sync hook, and child dialogs close without calling `router.refresh()`. Creating or editing any catalog item never updates the UI until the admin manually reloads the browser.
    - **Fix**: Add `useRouter().refresh()` in all catalog dialogs on success AND add `useEffect` prop synchronization in all parent catalog client components.

12. **Admin Sidebar & Topbar Print Directly Onto Customer Confirmation Vouchers**
    - **Files**: [`app/admin/(dashboard)/layout.tsx`](file:///c:/dev/al-ramlah-travels/app/admin/%28dashboard%29/layout.tsx#L66-L83), [`components/layout/admin-sidebar.tsx`](file:///c:/dev/al-ramlah-travels/components/layout/admin-sidebar.tsx#L175), [`components/layout/admin-topbar.tsx`](file:///c:/dev/al-ramlah-travels/components/layout/admin-topbar.tsx#L126)
    - **Problem**: `AdminSidebar` and `AdminTopbar` lack `print:hidden` classes, so clicking "Print / Save as PDF" on `/admin/applications/[id]/voucher` prints the admin navigation sidebar and topbar onto the pilgrim's official voucher.
    - **Fix**: Add `print:hidden` to `AdminSidebar` and `AdminTopbar` and strip layout padding/backgrounds on print (`print:p-0 print:bg-white`).

13. **UTC Midnight vs. Local Timezone Drift in Date Chaining & Visa Calculators**
    - **Files**: [`lib/domain/date-chaining.ts`](file:///c:/dev/al-ramlah-travels/lib/domain/date-chaining.ts#L72-L88), [`lib/domain/visa-calc.ts`](file:///c:/dev/al-ramlah-travels/lib/domain/visa-calc.ts#L32-L35), [`lib/domain/quote-hints.ts`](file:///c:/dev/al-ramlah-travels/lib/domain/quote-hints.ts#L137-L142), [`components/planner/planner-context.tsx`](file:///c:/dev/al-ramlah-travels/components/planner/planner-context.tsx#L191-L195)
    - **Problem**: Mixing `new Date("YYYY-MM-DD")` (UTC midnight) with `.getDate()` / `.setDate()` (local timezone) and `.toISOString()` shifts dates by 1 day in negative UTC offsets or across DST boundaries.
    - **Fix**: Use timezone-safe local date parsing (`parseLocalIsoDate` / `formatToLocalIso` or `Date.UTC` + `getUTCDate`/`setUTCDate`) consistently across all date helpers.

14. **Hardcoded Placeholder Phone/WhatsApp Numbers (`+923001234567`) in Public Header, Footer, FAB & Group Modal**
    - **Files**: [`app/(public)/layout.tsx`](file:///c:/dev/al-ramlah-travels/app/%28public%29/layout.tsx), [`components/layout/public-header.tsx`](file:///c:/dev/al-ramlah-travels/components/layout/public-header.tsx), [`components/layout/public-footer.tsx`](file:///c:/dev/al-ramlah-travels/components/layout/public-footer.tsx), [`components/layout/whatsapp-fab.tsx`](file:///c:/dev/al-ramlah-travels/components/layout/whatsapp-fab.tsx), [`components/public/group-booking-modal.tsx`](file:///c:/dev/al-ramlah-travels/components/public/group-booking-modal.tsx#L247)
    - **Problem**: `PublicHeader`, `PublicFooter`, `WhatsAppFab`, and `GroupBookingModal` hardcode `+923001234567` instead of reading `agencySettings` from the database.
    - **Fix**: Fetch `agencySettings` in `app/(public)/layout.tsx` and pass the real agency phone, WhatsApp, email, and address down to `PublicHeader`, `PublicFooter`, `WhatsAppFab`, and `GroupPackagesSection`.

15. **SAR-to-PKR Conversion Inconsistency in `visa-calc.ts`**
    - **File**: [`lib/domain/visa-calc.ts`](file:///c:/dev/al-ramlah-travels/lib/domain/visa-calc.ts#L42-L70)
    - **Problem**: When `options.sarToPkrRate` is passed, `withMasar: true` multiplies `500 SAR × 75 = 37,500 PKR`, whereas `withMasar: false` (470 SAR) ignores `sarToPkrRate` and returns `42,500 PKR`, making a cheaper SAR visa appear more expensive in PKR.
    - **Fix**: Apply `sarToPkrRate` consistently across both branches when provided.

16. **Duplicate DOM Input IDs Between `LeadCaptureDialog` and `ReviewAndSubmitStep`**
    - **Files**: [`components/planner/lead-capture-dialog.tsx`](file:///c:/dev/al-ramlah-travels/components/planner/lead-capture-dialog.tsx#L238-L354), [`components/planner/review-and-submit-step.tsx`](file:///c:/dev/al-ramlah-travels/components/planner/review-and-submit-step.tsx#L757-L873), [`components/planner/live-summary-card.tsx`](file:///c:/dev/al-ramlah-travels/components/planner/live-summary-card.tsx#L353-L365)
    - **Problem**: Both components mount in Step 6 with identical input IDs (`#lead-full-name`, `#lead-phone`, etc.), breaking `document.getElementById("lead-full-name")?.focus()` and HTML accessibility.
    - **Fix**: Prefix IDs in `LeadCaptureDialog` (`dialog-lead-full-name`, etc.).

17. **Post-Login Redirect Parameter Mismatch (`from` vs `callbackUrl`)**
    - **Files**: [`proxy.ts`](file:///c:/dev/al-ramlah-travels/proxy.ts#L25), [`app/admin/(auth)/login/page.tsx`](file:///c:/dev/al-ramlah-travels/app/admin/%28auth%29/login/page.tsx#L29)
    - **Problem**: `proxy.ts` sets `?from=/admin/...`, while `login/page.tsx` reads `searchParams.get("callbackUrl")`.
    - **Fix**: Read `searchParams.get("callbackUrl") || searchParams.get("from") || "/admin"`.

18. **Open Image Proxy Wildcard (`hostname: "**"`) in `next.config.ts`**
    - **File**: [`next.config.ts`](file:///c:/dev/al-ramlah-travels/next.config.ts#L32-L36)
    - **Problem**: Allows arbitrary external image proxying (SSRF risk).
    - **Fix**: Restrict `remotePatterns` to trusted image hosts or standard HTTPS image origins without unrestricted SSRF exposure.

19. **Missing Production Docker & `.env.example` Deployment Artifacts + Nginx Improvements**
    - **Files**: `Dockerfile`, `.dockerignore`, `.env.example`, [`nginx/nginx.conf`](file:///c:/dev/al-ramlah-travels/nginx/nginx.conf), [`next.config.ts`](file:///c:/dev/al-ramlah-travels/next.config.ts), [`db/index.ts`](file:///c:/dev/al-ramlah-travels/db/index.ts), [`lib/env.ts`](file:///c:/dev/al-ramlah-travels/lib/env.ts)
    - **Problem**: Missing `Dockerfile`, `.dockerignore`, `.env.example`, and `drizzle/` SQL migration files; `nginx/nginx.conf` lacks static asset caching (`/_next/static/`) and security headers; `db/index.ts` and `lib/env.ts` crash during `next build` if runtime secrets aren't injected at build time.
    - **Fix**: Add multi-stage `Dockerfile`, `.dockerignore`, `.env.example`, generate `drizzle/` migrations (`npx drizzle-kit generate`), harden `nginx/nginx.conf`, and make `lib/env.ts` / `db/index.ts` build-phase resilient.

20. **Empty String UUID Validation Failure When Optional Vehicle/Hotel IDs Are Blank**
    - **Files**: [`components/planner/review-and-submit-step.tsx`](file:///c:/dev/al-ramlah-travels/components/planner/review-and-submit-step.tsx#L219-L223), [`components/planner/live-summary-card.tsx`](file:///c:/dev/al-ramlah-travels/components/planner/live-summary-card.tsx#L106-L110)
    - **Problem**: Passing `""` instead of `undefined` for `ziyaratVehicleId` or `preferredAirlineId` fails `z.string().uuid().optional()`.
    - **Fix**: Coerce empty strings to `undefined` (`ziyaratVehicleId || undefined`) before submitting.

21. **Foreign Key Constraint on Staff User Deletion (`assignedStaffUserId` & `quotedByUserId`)**
    - **File**: [`db/schema/applications.ts`](file:///c:/dev/al-ramlah-travels/db/schema/applications.ts#L167-L169) (and line 295)
    - **Problem**: Missing `{ onDelete: "set null" }` on `assignedStaffUserId` and `quotedByUserId`, which prevents deleting a staff member who has ever been assigned or quoted an application.
    - **Fix**: Add `{ onDelete: "set null" }` to both references and push to Neon.

---

## 3. MEDIUM SEVERITY ISSUES

22. **Wrong Departure City Property Name in `lookupApplicationStatus` (`app/actions/applications.ts:829`)**
    - Reads `.departureCity?.name` instead of `.departureCity?.cityName`, causing group booking departure cities to show as blank in the public Status Tracker.

23. **WhatsApp Dispatch Links Fail on Pakistani Local `03...` Phone Numbers**
    - **Files**: [`components/admin/applications/quote-dispatch-bar.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/applications/quote-dispatch-bar.tsx#L141-L142), [`components/admin/applications/applications-table.tsx`](file:///c:/dev/al-ramlah-travels/components/admin/applications/applications-table.tsx#L145-L146), [`app/actions/applications.ts`](file:///c:/dev/al-ramlah-travels/app/actions/applications.ts)
    - **Problem**: `wa.me/03001234567` is rejected by WhatsApp because it lacks the `92` country code.
    - **Fix**: Normalize 11-digit `03XXXXXXXXX` numbers to `923XXXXXXXXX` across all `wa.me` link builders.

24. **Incorrect Revalidation Paths in `app/actions/quotes.ts`**
    - Line 260 calls `revalidatePath("/admin/catalog/groups")` instead of `revalidatePath("/admin/groups")`, and `updateApplicationStatus` omits `revalidatePath("/admin/groups")`.

25. **Hardcoded `0.4` / `0.6` Split in Admin Dashboard Pipeline Chart (`app/admin/(dashboard)/page.tsx:231, 237`)**
    - Approximates Pending vs Quoted pipeline PKR values using `0.4` and `0.6` multipliers instead of summing each status's actual quote totals.

26. **Catalog Delete Foreign-Key Fallback Leaves Item Showing "Active" in UI (`app/actions/catalog.ts`, `app/actions/groups.ts`)**
    - When deleting a referenced item, the server action deactivates it (`isActive: false`) in PostgreSQL but returns `{ success: false }`, so the client table still shows it as `Active`.

27. **Non-Sequential `segmentOrder` When Filtering Disabled Sectors in `Transport Only` Mode**
    - **Files**: [`components/planner/review-and-submit-step.tsx`](file:///c:/dev/al-ramlah-travels/components/planner/review-and-submit-step.tsx#L207-L216), [`components/planner/live-summary-card.tsx`](file:///c:/dev/al-ramlah-travels/components/planner/live-summary-card.tsx#L94-L104)
    - **Fix**: Re-index `segmentOrder: idx + 1` after `.filter((s) => s.enabled)`.

28. **Dead Anchor Links in `PublicFooter` (`#hotels`, `#privacy`, `#terms`, `#disclaimer`) & Domain Edge Cases (`visa-calc.ts`, `room-splitter.ts`, `vehicle-capacity.ts`, `planner-context.tsx:593`)**
    - Fix `#hotels` → `#custom-journey`, wire policy links cleanly, and fix 0-passport / 0-bed / `entryAirport: "MED"` edge cases.

---

## 4. LOW SEVERITY / PERFORMANCE & HYGIENE ISSUES

29. **682 KB Full-Resolution JPEG Used as Browser Favicon (`app/layout.tsx:57-60`) & Missing `metadataBase` / OpenGraph Tags**
    - Point `icons.icon` to `/favicon.ico` and add `metadataBase` + `openGraph` metadata in `app/layout.tsx`.

30. **Impure `Date.now()` Calls During Render (`components/layout/status-badge.tsx:84`, `app/admin/(dashboard)/layout.tsx:29`, `app/admin/(dashboard)/applications/page.tsx:46`)**
    - Compute timestamps cleanly outside pure render expressions to eliminate React 19 purity warnings and hydration drift.

31. **Restrict `updateAgencySettings` to `requireSuperAdmin()` (`app/actions/catalog.ts:777`) & Clean Up Unused `next-themes` / Barrel Exports**
    - Ensure only `super_admin` can modify global exchange rates and agency phone numbers; export all planner modules in `components/planner/index.ts`.
