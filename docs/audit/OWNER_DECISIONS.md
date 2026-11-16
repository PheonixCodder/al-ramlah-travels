# Al Ramlah Travels — §11 Executive Owner Decisions Memo (`OD-01`..`OD-11`)

**Prepared by**: `w2-triage` (Wave 2 Audit Synthesis)  
**Date**: 2026-11-14  
**Companion Backlog**: [02-triage.md](file:///c:/dev/al-ramlah-travels/web/docs/audit/02-triage.md) (`97` Canonical Items from `383` raw audit findings; **51 `UNBLOCKED`** + **46 `NEEDS_DECISION`**)  

> [!IMPORTANT]
> **Fast-Track Sign-Off**: Wave 3 Fixers can begin executing all **51 `UNBLOCKED`** items immediately. Every decision below includes a battle-tested **Recommended Default**. Reply **`"APPROVED ALL DEFAULTS"`** (plus your official license/IBAN numbers under `OD-10` when ready) to unlock all **46 gated `T-ID`s** in a single pass, or specify overrides by ID (e.g., `"APPROVED ALL DEFAULTS except OD-02 = Option C, OD-04 = Option B"`).

---

## Quick Sign-Off Summary Matrix (`OD-01`..`OD-11`)

| ID | Decision Area | Recommended Default (If You Say "Go With Recommended") | Gated `T-ID`s |
| :--- | :--- | :--- | :--- |
| **`OD-01`** | Baileys Linked-Device Topology | **Option A**: Sunset server-side Baileys sockets; use Official Meta Cloud API v21.0 + 100% Ban-Safe Manual Assisted WA Group/Status Queue (`$0/mo`, `0%` SIM-ban risk) | `T-032`, `T-073` |
| **`OD-02`** | Transactional Email Provider | **Option A**: **Resend** + `@react-email` on `@alramlahtravels.com` (`$0/mo` 3k tier) for Quotation PDFs, Vouchers & Password Reset (+ `super_admin` temp-password fallback) | `T-043`, `T-059` |
| **`OD-03`** | Pilgrim Payments Scope | **Option A**: Append-only manual `application_payments` ledger + private R2 bank-receipt proof upload; no online card gateway in v1 | `T-042` |
| **`OD-04`** | Quote Acceptance & Public Voucher | **Option A**: Online Quote Accept/Revision on `/#track-status` + signed `/voucher/[token]` w/ QR code unlocked on `approved` + verified deposit/full payment | `T-017`, `T-023` |
| **`OD-05`** | Status Tracker Authentication | **Option A**: 48-bit CSPRNG `ART-...` ref + exact normalized phone match + `5/15m` Postgres rate limit + PII-redacted public DTO | `T-016` |
| **`OD-06`** | PII Storage, R2 TTLs & AI ZDR | **Option A**: Private R2 + `10m` signed `/api/media` URLs; purge passports **60d post-return**, leads **24m**, tax ledgers **6y**; PII-redacted ZDR AI + full `/privacy` | `T-014`, `T-020`, `T-028`, `T-052`, `T-080` |
| **`OD-07`** | Hosting Tier, Crons & RBAC | **Option A**: Vercel Pro + Neon Launch + Trigger Hobby + Oracle PAYG Always Free Gotenberg (`$0`) + strict `super_admin` gate on Settings/Rates/OAuth/CSV | `T-045`, `T-051`, `T-060`, `T-068`, `T-071`, `T-074`, `T-075` |
| **`OD-08`** | Languages & Prayer Times | **Option A**: English UI + `<ArabicText lang="ar" dir="rtl">` + Urdu/Arabic fonts in Desk/PDFs + header Haramain prayer-time pill (defer full `/ur` RTL to v2) | `T-085` |
| **`OD-09`** | 5 Business-Invariant Rules | **Option A**: Masar `<=30d` w/ live SAR->PKR on Hotel+Visa; Mode B `0`-tier stays `N/A`; Visa-Only requires dates; seats deduct on `approved`; infant airfare `>0`; Hajj 2027 indicative CRUD | `T-010`, `T-011`, `T-012`, `T-019`, `T-022`, `T-048`, `T-055`, `T-058`, `T-062`, `T-063`, `T-083` |
| **`OD-10`** | Address, IBAN, Licenses & Seed Purge | **Option A**: Single Askari 10 Sector C Lahore HQ + `03274029701`/`03190462638`; disable unverified Meezan IBAN until confirmed; purge client PDF & fake reviews; add DTS/MoRA/IATA/NTN fields + `/refund-policy` | `T-007`, `T-013`, `T-031`, `T-056`, `T-067`, `T-077`, `T-084`, `T-087`, `T-089`, `T-093` |
| **`OD-11`** | Core 5 Social Review & GBP v1 | **Option A**: Live IG/FB/YouTube; migrate GBP to v1 + add TikTok Audit UX gated behind approval flags; delete fake SHA-256 analytics & gate Auto-Plugs on real metrics | `T-035`, `T-036`, `T-069`, `T-070` |

---

## Detailed Decision Briefs (`OD-01`..`OD-11`)

### OD-01 — Baileys Linked-Device Topology & Ban-Safe WhatsApp Group/Status Queue

- **Why It Matters (Audit Evidence)**: Wave 1 proved that `@whiskeysockets/baileys` (`^7.0.0-rc14`) stores live WebSocket connections in a process-local `Map` (`lib/whatsapp/linked-device.ts`, `A00-004`, `A15-001`), which fails 100% across Vercel serverless lambdas and ephemeral Trigger.dev Cloud workers (`A17-004`). Furthermore, monolithic Signal key-ring JSONB writes cause concurrent `Bad MAC` session corruption (`A15-005`), pairing misses the mandatory `515 restartRequired` handshake (`A15-002`), `status@broadcast` posts to `0` contacts (`A15-009`), `1s` custom delays risk permanent Meta SIM bans on the agency's primary phone (`A15-011`), `/privacy` omits disclosing unofficial WhatsApp Web scraping (`A25-005`), and `purgeFakeMarketingChannelsAction` accidentally deletes all Core 5 social channels (`A00-002`, `A15-004`).
- **Concrete Options**:
  - **Option A (Recommended Default — Sunset Server-Side Baileys; Official Meta Cloud API v21.0 + 100% Ban-Safe Manual Assisted WA Group/Status Queue)**: Remove server-hosted `@whiskeysockets/baileys` sockets; keep all 1:1 CRM, Guided Umrah Intake, Auto-Replies, Quotations, and Broadcasts on the Official Meta WhatsApp Cloud API v21.0 (`$0` infra, `0%` SIM-ban risk), and run WhatsApp Group/Status distribution via the existing 1-Click Manual Assisted Share Queue (`wa.me` / native WhatsApp Desktop & Mobile share sheet with pre-rendered 4K poster + copied Urdu/English caption).
  - **Option B (Dedicated Single-Replica Railway / Render / VPS Worker + DB Outbox — `$5–10/mo`)**: Keep Baileys strictly inside a single long-lived Node 22 container (`replicas = 1`) communicating with Next.js via Postgres outbox + granular per-key Signal table, hardened with `30–90s` anti-ban jitter (`A15-002`..`A15-011`) and explicit `/privacy` disclosure.
  - **Option C (Oracle Cloud Always Free ARM64 `baileys-sidecar` Container — `$0/mo`)**: Host a single-instance `baileys-sidecar` Docker container alongside Gotenberg on the existing Oracle Cloud Always Free `VM.Standard.A1.Flex` instance behind Caddy TLS + constant-time `X-Sidecar-Secret` HMAC RPC.
- **Recommended Default**: **Option A** (Sunset server-side Baileys sockets in v1; use Official Meta Cloud API v21.0 for all automated 1:1 & Broadcast messaging + 1-Click Manual Assisted Queue for WhatsApp Groups/Status, and restrict channel cleanup to `super_admin` without touching Core 5 social channels). Zero monthly cost, zero `Bad MAC` crashes, and **0% risk of Meta banning Al Ramlah Travels' business SIM numbers**.
- **Gated `T-ID`s** (2): `T-032` (P0 · `F-WA`), `T-073` (P1 · `F-JOBS`)

---

### OD-02 — Transactional Email Provider & Admin Password-Reset Delivery

- **Why It Matters (Audit Evidence)**: The codebase currently has **zero** transactional email SDK (`package.json` omits `resend`/`nodemailer`, `A00-012`), `QuoteDispatchBar` opens a local `mailto:` link that cannot attach the 3-Page Gotenberg Quotation PDF (`A10-008`), and Better Auth has no `sendResetPassword` transport or self-service password reset (`A02-009`).
- **Concrete Options**:
  - **Option A (Recommended Default — Resend + `@react-email/components` on `@alramlahtravels.com`)**: Free tier includes `3,000 emails/mo` (`$0/mo` at launch, `$20/mo` Pro later). Powers 1-click Quotation PDF attachments, Confirmation Voucher emails, and Better Auth admin password-reset emails over HTTPS (works identically on Vercel and Docker).
  - **Option B (Postmark — `$15/mo` for 10,000 emails)**: Highest inbox placement for transactional PDFs/vouchers and password resets via HTTPS API.
  - **Option C (Existing Google Workspace / cPanel SMTP via `nodemailer`)**: `$0` incremental cost using existing `@alramlahtravels.com` mailbox credentials over SMTP port `465/587` (`500–2,000/day` limit).
  - **Option D (WhatsApp + Signed PDF Download Link Only — Zero Email Provider in v1)**: Remove Email dispatch button in favor of WhatsApp Cloud API PDF/template delivery + copyable signed link, and handle staff password resets exclusively via `super_admin` temporary-password issuance with forced first-login rotation.
- **Recommended Default**: **Option A (`Resend` + `@react-email/components`)**, paired with `super_admin` temporary-password issuance (`mustChangePassword = true`) as an immediate zero-dependency fallback until DNS DKIM/SPF records on `alramlahtravels.com` are verified.
- **Gated `T-ID`s** (2): `T-043` (P1 · `F-PLAT`), `T-059` (P1 · `F-DESK`)

---

### OD-03 — Pilgrim Payments Scope & Append-Only Receipt Ledger

- **Why It Matters (Audit Evidence)**: `application_quotes` currently tracks only a free-text/enum `paymentStatus` without `depositRequiredPkr`, without an `application_payments` ledger table, without bank-transfer receipt proof storage, and without SQL `CHECK` constraints (`A04-007`, `A10-009`, `FP-018`) — allowing `paid_in_full` to be toggled accidentally with `PKR 0` recorded.
- **Concrete Options**:
  - **Option A (Recommended Default — Append-Only Manual `application_payments` Ledger + Private R2 Receipt Proof Upload, Zero Online Gateway in v1)**: Consultants record bank transfers / cash / cheque installments (`amountPkr`, Meezan/bank reference, private R2 receipt image/PDF, `verifiedBy`) in an immutable `application_payments` table that deterministically computes `unpaid` / `deposit_paid` / `paid_in_full`. Matches standard Pakistani high-ticket (`PKR 350k–3M`) Umrah/Hajj agency workflows with zero gateway MDR fees.
  - **Option B (Lightweight Reconciled Columns Only — No Separate Ledger Table)**: Add `depositRequiredPkr`, `amountPaidPkr`, and `paymentReference` directly on `application_quotes` with `CHECK` constraints.
  - **Option C (Online Pakistani Payment Gateway Integration — Safepay / PayFast / Stripe)**: Full card/Raast checkout webhook integration (`2.5–3.5%` processing fee on `PKR 500k+` packages; requires merchant onboarding).
- **Recommended Default**: **Option A (Append-Only Manual `application_payments` Ledger + Private R2 Receipt Proof Upload, no online card gateway in v1)**. Eliminates accounting drift and `2.5–3.5%` card fees on low-margin Umrah packages while providing bank-grade auditability.
- **Gated `T-ID`s** (1): `T-042` (P1 · `F-PLAT`)

---

### OD-04 — Pilgrim Online Quote Acceptance & Public Signed Confirmation Voucher Unlock Rule

- **Why It Matters (Audit Evidence)**: Pilgrims viewing a quote on `/#track-status` currently have **no** online button to accept or request revisions (`A08-002`), `/admin/applications/[id]/voucher` is locked behind admin auth so pilgrims get redirected to `/admin/login` (`A00-011`, `A10-013`), and the admin voucher page stamps `"PAID & CONFIRMED"` even on `unpaid` or `rejected` leads (`A10-003`).
- **Concrete Options**:
  - **Option A (Recommended Default — Online Quote Accept/Revision on `/#track-status` + Public Signed `/voucher/[token]` Unlocked on `approved` AND Verified Deposit/Full Payment)**: Pilgrims can click **Accept Quote** or **Request Revision** on `/#track-status`; once an admin verifies at least the required deposit (`paymentStatus IN ('deposit_paid', 'paid_in_full')`) and marks the dossier `approved`, a capability-signed `/voucher/[token]` link with scannable verification QR code unlocks (clearly badging `DEPOSIT VERIFIED — BALANCE DUE` vs `PAID IN FULL`).
  - **Option B (Strict Full-Payment Gate — Unlock Voucher Only When `paymentStatus === 'paid_in_full'`)**: Same online quote acceptance and signed `/voucher/[token]` QR route, but Confirmation Vouchers unlock strictly after 100% balance settlement.
  - **Option C (Consultant-Mediated Only — No Self-Serve Online Quote Acceptance)**: Keep quote acceptance via WhatsApp/phone consultant and send static PDF vouchers manually after `approved` + payment verification.
- **Recommended Default**: **Option A** (Self-serve Quote Accept / Revision Request on `/#track-status`, plus capability-signed `/voucher/[token]` with QR code gated on `status === 'approved'` AND `paymentStatus IN ('deposit_paid', 'paid_in_full')` with honest balance-due badging).
- **Gated `T-ID`s** (2): `T-017` (P0 · `F-PUB`), `T-023` (P0 · `F-DESK`)

---

### OD-05 — Public Status Tracker (`/#track-status`) Authentication Strength

- **Why It Matters (Audit Evidence)**: `lookupApplicationStatus` currently suffers a double phone-verification bypass (`endsWith("")` evaluates `true` on `"-------"` or empty `customerWhatsapp`, `A02-003`, `A08-001`), uses 20-bit predictable `Math.random()` reference numbers, has zero rate limiting (`A03-011`), and runs `ILIKE` scans (`A04-010`).
- **Concrete Options**:
  - **Option A (Recommended Default — 48-Bit CSPRNG Reference + Exact Normalized Phone Match + PostgreSQL Rate Limit + Redacted Public DTO)**: Mint unguessable CSPRNG references (`ART-YYYYMMDD-<8-char>`), require exact normalized national phone match (`>=9` digits, constant-time), enforce `5 attempts / 15 min / IP` in PostgreSQL with uniform error messages, and return only itinerary/quote summary (never raw passport numbers, email, or internal notes).
  - **Option B (WhatsApp 6-Digit OTP Verification)**: Send a 6-digit OTP via Meta WhatsApp `AUTHENTICATION` template before displaying quote totals or itinerary status (`~PKR 4–12` Meta template fee per lookup).
  - **Option C (Capability-Signed Magic Link `/quote/[token]` Only)**: Disable reference+phone lookup form on `/` and access quotes solely via `256-bit` signed links dispatched on WhatsApp/Email.
- **Recommended Default**: **Option A** for `/#track-status` (48-bit CSPRNG `ART-...` reference + exact normalized phone match + `5/15m` PostgreSQL rate limit + PII-minimized public DTO), complemented by signed capability tokens on `/voucher/[token]` (`OD-04`). Frictionless for pilgrims at `$0` per lookup while eliminating enumeration.
- **Gated `T-ID`s** (1): `T-016` (P0 · `F-PUB`)

---

### OD-06 — Passport/CNIC PII Storage, Private R2 Signed URLs, Retention TTLs & AI Zero-Data-Retention

- **Why It Matters (Audit Evidence)**: `/privacy` promises restricted encrypted storage while inbound WhatsApp passport scans, client quotation PDFs, and supplier flyers sit in a single world-readable public R2 bucket (`A03-003`, `A25-001`) with zero object deletion or retention TTLs (`A04-016`, `A13-009`, `A25-008`), and pilgrim PII / WhatsApp histories are sent to Google Gemini / OpenRouter without `/privacy` disclosure or ZDR flags (`A12-002`, `A25-002`).
- **Concrete Options**:
  - **Option A (Recommended Default — Private R2 Prefix/Bucket + `10m` Signed `/api/media` Proxy + Automated Retention Cron + PII-Redacted ZDR AI)**: Serve only marketing/catalog imagery publicly; store all `passports/`, `whatsapp-media/`, `quotes/`, and `receipts/` privately via authenticated/signed `/api/media/[...key]` (`10-min` presigned GET URLs, `Cache-Control: private, no-store`); run nightly retention cron (**purge passport/CNIC scans 60 days after KSA return date**, **archive/anonymize unbooked inquiry PII after 24 months**, **retain tax/financial invoices 6 years per Pakistan Income Tax Ordinance 2001 §174**); redact pilgrim names/phones/passport numbers before LLM calls with OpenRouter `data_collection: "deny"`; and publish full sub-processor + DSAR table on `/privacy`.
  - **Option B (Zero Passport/Document Persistence in CRM)**: Disable inbound WhatsApp media mirroring for documents/images and handle passport collection strictly offline outside the web platform.
- **Recommended Default**: **Option A** (Private R2 signed media proxy + automated **60d passport / 24m unbooked lead / 6y financial ledger** retention schedule + PII-redacted ZDR AI calls + updated `/privacy` sub-processor & DSAR policy).
- **Gated `T-ID`s** (5): `T-014` (P0 · `F-INFRA`), `T-020` (P0 · `F-PUB`), `T-028` (P0 · `F-STUDIO`), `T-052` (P1 · `F-INFRA`), `T-080` (P2 · `F-PLAT`)

---

### OD-07 — Production Hosting Tier, Cron Cadence, Oracle Gotenberg VM & `super_admin` RBAC Policy

- **Why It Matters (Audit Evidence)**: Vercel Hobby prohibits commercial travel agency storefronts and caps uploads/functions (`4.5 MB` body, `10–60s` timeout, `A22-002`, `A23-012`), `*/5` Trigger crons + `/admin/desk` 4s DB-writing polls burn `>720h/mo` Neon compute (exceeding Neon Free `191.9h/mo` by `3.8×`, `A18-007`, `A22-003`), Oracle Always Free Tier reclaims idle ARM64 Gotenberg VMs unless upgraded to PAYG (`A13-006`, `A23-011`), and `staff` accounts can currently mutate WABA/Social OAuth, master pricing rates, staff accounts, and full-database CSV exports (`A02-005`, `A09-002`, `A17-009`, `A19-004`, `A20-005`).
- **Concrete Options**:
  - **Option A (Recommended Default — Commercial Managed Stack `~$45–50/mo` + Oracle PAYG Always Free `$0` Gotenberg + Strict `super_admin` Governance)**: Vercel Pro (`$20/mo`, commercial license, `300s` Fluid Compute) + Neon Launch (`~$15–19/mo`, `7-day` PITR) + Trigger.dev Hobby (`$10/mo`) + Oracle Cloud PAYG account running within Always Free `VM.Standard.A1.Flex` limits (`$0/mo`, eliminates idle VM reclamation); make Desk polling read-only + visibility-paused; and lock `/admin/settings`, WABA/Social OAuth, staff users, master catalog rates, bulk Meta Broadcasts, and CSV exports strictly to `super_admin` (while `staff` handles Desk Inbox, Kanban quotes, and drafting campaigns).
  - **Option B (Consolidated Docker VPS `~$12–20/mo` + Neon Launch)**: Deploy the hardened `node:22-alpine` `Dockerfile` + `nginx/nginx.conf` TLS stack on a 2-vCPU Hetzner/DigitalOcean VPS (no `4.5 MB` body cap, no serverless cold starts) alongside Trigger.dev + Gotenberg.
  - **Option C (Ultra-Low-Burn Launch Cadence)**: If running on constrained compute budgets during soft-launch, throttle crons to PKT business hours (`0 4-18 * * *` UTC = `9 AM–11 PM PKT` hourly) so Neon scales to zero overnight (`<150 compute-hours/mo`).
- **Recommended Default**: **Option A** (Commercial Managed Stack with Oracle PAYG Always Free ARM64 Gotenberg + read-only visibility-aware Desk polling + strict `super_admin` RBAC on Settings, OAuth, Catalog Rates, Staff, Bulk Broadcasts & CSV Exports; or **Option B** Docker VPS if avoiding Vercel Pro).
- **Gated `T-ID`s** (7): `T-045` (P1 · `F-PLAT`), `T-051` (P1 · `F-INFRA`), `T-060` (P1 · `F-DESK`), `T-068` (P1 · `F-WA`), `T-071` (P1 · `F-SOCIAL`), `T-074` (P1 · `F-JOBS`), `T-075` (P1 · `F-ADMIN`)

---

### OD-08 — Supported Public Languages & Header Haramain Prayer-Time Indicator

- **Why It Matters (Audit Evidence)**: `PLATFORM_MASTER_BRIEF.md` mentions English/Urdu switching and Makkah/Madinah live prayer times (`FP-017`), whereas the shipped app is English-only with decorative sacred Arabic spans lacking `lang="ar" dir="rtl"` (`A21-006`) and Gotenberg templates missing Arabic/Urdu fonts (`A13-005`, `A10-015`).
- **Concrete Options**:
  - **Option A (Recommended Default — English Storefront + Accessible `<ArabicText lang="ar" dir="rtl">` + Full Arabic/Urdu Font Support in Desk/PDFs/Posters + Lightweight Haramain Prayer-Time Pill)**: Keep the public UI in luxury English for v1 launch (reconciling the unshipped full-site `/ur` translation claim in the Brief), tag all sacred Arabic script with `lang="ar" dir="rtl"`, bundle Noto Naskh Arabic & Nastaliq Urdu fonts so Urdu pilgrim WhatsApp chats/notes/PDFs render flawlessly, and render a zero-API astronomical Makkah/Madinah prayer-time pill in `PublicHeader`.
  - **Option B (Full Bilingual `next-intl` English + `/ur` RTL Urdu Storefront)**: Translate all 35 public/planner components, Zod messages, and legal pages into RTL Nastaliq Urdu (`L`-effort multi-week expansion).
- **Recommended Default**: **Option A** for v1 production launch (English UI + WCAG-compliant `lang="ar" dir="rtl"` sacred script + full Urdu/Arabic font rendering in Desk/Gotenberg PDFs + zero-network Haramain prayer-time header pill; defer full `/ur` storefront localization to Phase 2).
- **Gated `T-ID`s** (1): `T-085` (P2 · `F-PUB`)

---

### OD-09 — Haramain Business-Invariant Clarifications (5 Pricing & Booking Edge Cases)

- **Why It Matters (Audit Evidence)**: Wave 1 Domain & Feature auditors (`A00`, `A05`, `A06`, `A07`, `A08`, `A10`, `A11`, `A12`, `A19`) uncovered 5 concrete specification ambiguities causing `PKR 25,000` mispriced Umrah posters, `28–30d` visa bracket gaps, unverified public seat lockouts, missing infant airfare, and hardcoded Hajj 2027 prices.
- **Concrete Options**:
  - **Option A (Recommended Default — Approve All 5 Domain Clarifications `09a`–`09e`)**:
  - **`09a` Masar Visa Brackets & Single-City Stays**: Treat `withMasar28DaysSar` as the `22–30 inclusive days` (`<=30d`) short-term Masar ceiling converted via live `agency_settings.sarToPkrRate` when `includeHotels=true`; keep `Visa Only` on fixed admin PKR columns (`short_term <= 30d`, `long_term > 30d`); and allow single-city `makkah_only` / `madinah_only` itineraries with Visa enabled.
  - **`09b` Mode B Unpriced (`0`) Room Tiers & `>10`-Card Flyers**: In Mode B (`net_plus_markup`), any `0` / blank supplier room tier remains `0` (`"On Request / N/A"`) — never `0 + commissionPkr` — and supplier flyers with `>10` packages paginate into multi-sheet (`Sheet 1/N`) posters with zero dropped cards.
  - **`09c` Visa-Only Dates, Makkah-First Ground Transfer & Luggage**: Require KSA arrival & departure dates on `Visa Only` (to auto-calculate `<=30d` vs `>30d` server-side per Invariant #1); allow Makkah-first with `includeTransport=false` (self-arranged JED->Makkah transfer) with an explicit pilgrim confirmation notice while keeping Entry Airport locked to `JED`; and warn when passenger suitcases exceed vehicle luggage capacity.
  - **`09d` Group Departure Seat Deduction & Infant Airfare**: Check open seat capacity at public submission, but deduct `group_departures.booked_seats` (`Adults + Children`, `0` infant seats) atomically ONLY when admin confirms `status = 'approved'` (preventing anonymous form spam from selling out real departures); and include infant airfare (`>0`, e.g. `10–15%` IATA infant fare or catalog infant ticket column) in Quoting Copilot whenever `infants > 0` and `includeFlights = true`.
  - **`09e` Hajj 2027 Packages**: Label Hajj 2027 prices (`PKR 1.70M–2.99M`) as **Indicative Pre-Registration Estimates Subject to MoRA / Saudi Nusuk Quota Announcement** and move them from hardcoded TSX into `/admin/catalog` CRUD.
  - **Option B (Custom Overrides on Individual Sub-Rules `09a`–`09e`)**: Specify any sub-rule (`09a`–`09e`) where Al Ramlah Travels prefers a different commercial formula (e.g., temporary `30-min` soft seat holds on public Group Booking submit, or `PKR 0` infant group airfare).
- **Recommended Default**: **Option A (Approve all 5 domain clarifications `09a`–`09e`)**. Eliminates under-quoting losses, prevents spam seat-exhaustion attacks, and preserves all 4 core Haramain invariants in `AGENTS.md`.
- **Gated `T-ID`s** (11): `T-010` (P0 · `F-DOM`), `T-011` (P0 · `F-DOM`), `T-012` (P0 · `F-DOM`), `T-019` (P0 · `F-PUB`), `T-022` (P0 · `F-DESK`), `T-048` (P1 · `F-DOM`), `T-055` (P1 · `F-PUB`), `T-058` (P1 · `F-DESK`), `T-062` (P1 · `F-STUDIO`), `T-063` (P1 · `F-STUDIO`), `T-083` (P2 · `F-PUB`)

---

### OD-10 — Official Lahore HQ Address, Phones, Meezan IBAN, Pakistan Regulatory Licenses & Seeded Content Purge

- **Why It Matters (Audit Evidence)**: Across the codebase, 4 conflicting addresses/cities appear (`Askari 10 Sector C` vs `Askari 10 Sector F` vs `DHA Phase 5, Lahore` vs `Rawalpindi`, `A11-013`, `A12-009`, `A16-016`, `A20-002`, `A24-012`, `A25-011`), 4 phone numbers conflict (`03274029701`, `03190462638` vs fake `+92 300 8451122`, `03214629700`), WhatsApp Auto-Responder replies with an unverified Meezan Bank IBAN (`PK42MEZN0002940105882914`, `A25-010`), a real client family quotation PDF is committed in `public/uploads/sample-posts/` (`A01-004`, `A25-004`), hardcoded fake 5-star pilgrim reviews render on `/` (`A25-009`), and mandatory Pakistani travel agency license numbers (DTS, MoRA/HGO, IATA, NTN) are absent (`A20-013`, `A25-006`, `A25-007`).
- **Concrete Options**:
  - **Option A (Recommended Default — Lock Single Askari 10 Lahore HQ + Official Phones, Gate IBAN Until Owner-Verified, Purge Client PDF & Fake Reviews, Populate License Inputs)**:
  1. **Canonical Address & Phones**: Set `Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan` and phones `+92 327 4029701` · `+92 319 0462638` across `agency_settings`, PDFs, Posters, Captions, and Legal pages — purging `Sector F`, `DHA Phase 5`, `Rawalpindi`, `+92 300 8451122`, and `03214629700`.
  2. **Meezan Bank IBAN Safety**: Set `iban_verified = false` by default so automated bots/PDFs NEVER send `PK42MEZN0002940105882914` until `super_admin` confirms and enables the official corporate account in `/admin/settings`.
  3. **PII & Fake-Review Purge**: Immediately delete `public/uploads/sample-posts/*-quotation.pdf` (`[REDACTED CLIENT FAMILY]`) + hide `DEFAULT_TESTIMONIALS` when `0` real DB reviews exist.
  4. **Regulatory Licenses & Refund Policy**: Add `DTS License #`, `MoRA / HGO Enrollment #`, `IATA / TIDS #`, and `FBR NTN #` fields in `/admin/settings` (rendering in Footer/PDFs once populated by Owner) and publish `/refund-policy`.
  - **Option B (Provide Exact Overrides Now)**: Reply with the exact final office street/sector wording, verified corporate Meezan IBAN, SECP legal entity name (`Private Limited` vs sole proprietorship), and DTS/MoRA/IATA/NTN registration numbers so Wave 3 seeds them directly.
- **Recommended Default**: **Option A** immediately unblocks code cleanup (purging leaked client PDF, fake helpline, `DHA Phase 5` / `Rawalpindi` drift, unverified IBAN auto-replies, and fake reviews), while providing `/admin/settings` inputs for the Owner to enter exact DTS/MoRA/NTN/IBAN values before go-live.
- **Gated `T-ID`s** (10): `T-007` (P0 · `F-PLAT`), `T-013` (P0 · `F-INFRA`), `T-031` (P0 · `F-WA`), `T-056` (P1 · `F-PUB`), `T-067` (P1 · `F-WA`), `T-077` (P1 · `F-ADMIN`), `T-084` (P2 · `F-PUB`), `T-087` (P2 · `F-STUDIO`), `T-089` (P2 · `F-SOCIAL`), `T-093` (P2 · `F-QA`)

---

### OD-11 — Core 5 Social App-Review Scope, Google Business Profile v1 Migration & Reactive Auto-Plugs

- **Why It Matters (Audit Evidence)**: Google Business Profile currently calls sunset `mybusiness.googleapis.com/v4` endpoints that return `HTTP 404` (`A16-004`) and requires Google GBP API Basic Access approval; TikTok Direct Post (`PUBLIC_TO_EVERYONE`) requires TikTok App Audit + 5 mandatory creator/privacy/commercial UI controls (`A16-011`); YouTube OAuth `Testing` mode locks uploaded videos private and caps daily quota at `6` uploads/day (`A16-013`); and Reactive Engagement Auto-Plugs currently fire spam comments off fabricated SHA-256 mock stats (`A00-017`, `A16-007`).
- **Concrete Options**:
  - **Option A (Recommended Default — Ship Live IG + FB Pages + YouTube First, Migrate GBP Code to v1 + Feature-Flag TikTok/GBP Until Platform Approvals Complete, Gate Auto-Plugs on Verified Live Metrics)**:
  - **Instagram & Facebook Pages**: Production-ready via Meta Business System User Page Access Tokens (`pages_manage_posts`, `pages_read_engagement`, `pages_manage_engagement`, `read_insights`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`).
  - **YouTube**: Production-ready once Google OAuth consent screen is switched to `In Production` (enforcing daily `10,000`-unit budget guard in app).
  - **TikTok & Google Business Profile**: Migrate GBP client code to v1 endpoints and implement TikTok's 5 Audit UX controls + `publish_id` polling, while gating live public publishing behind `TIKTOK_DIRECT_POST_APPROVED` / `GBP_API_APPROVED` readiness flags in `/admin/settings` until platform review approvals arrive.
  - **Reactive Engagement Auto-Plugs**: Delete SHA-256 mock stats and trigger auto-plug comments strictly once per post when **real** live API metrics cross the configured threshold.
  - **Option B (Defer TikTok & GBP Providers Out of Launch UI Entirely)**: Restrict Campaigns Hub to **Core 3 (`Instagram`, `Facebook Pages`, `YouTube`)** at v1 launch and re-enable TikTok & GBP tabs in Phase 2 after vendor audits complete.
  - **Option C (Disable Reactive Engagement Auto-Plugs Entirely)**: Keep First-Comment `ART-...` WhatsApp CTAs at publish time, and turn off milestone Reactive Auto-Plugs completely.
- **Recommended Default**: **Option A** (Fix all Core 5 provider clients including Meta Page-token refresh, IG container polling, GBP v1 endpoints & TikTok Audit UX controls; enable IG/FB/YouTube immediately; gate TikTok public Direct Post & GBP behind readiness flags until vendor review completes; and allow Reactive Auto-Plugs strictly on real verified metrics).
- **Gated `T-ID`s** (4): `T-035` (P0 · `F-SOCIAL`), `T-036` (P0 · `F-SOCIAL`), `T-069` (P1 · `F-SOCIAL`), `T-070` (P1 · `F-SOCIAL`)

---

## Owner Sign-Off Checklist (Copy & Reply)

```markdown
DECISION SIGN-OFF:
- Mode: APPROVED ALL DEFAULTS   (or list specific OD-01..OD-11 overrides)
- OD-10 Official Corporate Legal Name: Al Ramlah Travels (Pvt.) Ltd. [confirm]
- OD-10 Official Office Address: Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt [confirm]
- OD-10 Official Meezan Bank Title & IBAN (leave blank to keep disabled until ready): 
- OD-10 DTS License # / MoRA HGO # / IATA # / FBR NTN #: 
```
