# Rationale: 0028 · Admin 4 Hub Operate Surface and Shell Alignment

_Decision record paired with [index.md](./index.md)._

## Context

Slices 45, 46 (`Spec 0026`), and 47 (`Spec 0027`) established `DESIGN.md`, semantic Haramain light tokens in `app/globals.css`, and Hallmark `sloplint.mjs` enforcement across all 19 public storefront route patterns (`0 FAIL` across 46 public files). By contrast, the protected Admin Control Plane (`app/admin/**`, `components/admin/**`, and `components/layout/{admin-sidebar,admin-topbar,command-palette,status-badge}.tsx`) was built across earlier feature slices (`Slices 4` through `43`) before `DESIGN.md` `Operate` surface rules and React 19 compiler lint checks were enforced.

Scanning all non voucher admin files reveals two concrete maintenance and quality gaps:
1. **751 Hallmark `sloplint.mjs` `FAIL` items (plus `148 REFLEX` and `89 WARN`) across 71 files**: `412` hardcoded hex literals (`FAIL 48`), `120` small `<= 15px` uppercase tracked labels (`FAIL 67`), `89` `transition-all` utilities (`FAIL 10a`), `40` raw Tailwind default palette swatches (`WARN 74`), `33` nested card borders (`FAIL 4`), `32` emoji icons standing in for vector icons (`FAIL 30a`), `20` template punctuation chains (`FAIL 63`), `16` inline JSX dashes/buzzwords (`FAIL 19`), `11` unguarded transform animations (`FAIL 27`), `9` missing or low contrast `:focus-visible` states (`FAIL 26a`), `5` unlabelled decorative `<svg>` tags (`FAIL 33`), `3` decorative eyebrows above headings (`FAIL 54`), and `1` purple pink gradient (`FAIL 2a`).
2. **108 ESLint warnings across Admin**: `68` `react-hooks/set-state-in-effect` warnings (dialogs and worksheets calling `setState` synchronously inside `useEffect`), `12` `react-hooks/purity` warnings (`Date.now()` called directly during render in `applications/page.tsx`, `applications-kanban-board.tsx`, `desk-hub-client.tsx`, and `connections-settings-client.tsx`), `7` `@next/next/no-img-element` warnings, `20` `@typescript-eslint/no-unused-vars` warnings, and `1` `react-hooks/exhaustive-deps` warning.

At the same time, the Admin Control Plane is governed by strict security invariants (`requireAdmin()` / `requireSuperAdmin()`, live `isActive` session revocation, `T-061` `staff` wholesale cost redaction, `OD-01` ban safe Assisted WhatsApp Queue, `OD-07` super admin gating, `OD-11` vendor audit flags) and extensive automated suites (`tests/e2e/j06-j12*`, `tests/e2e/j13-j22*`, `tests/e2e/j23*`, and `tests/w3/f-{admin,desk,studio,wa,social,ux}/*`). Leaving the admin surface unaligned perpetuates visual drift and cascading effect re-renders, whereas a careless rewrite would break battle tested operational workflows.

## Options considered

### Option 1: Semantic Operational Status Tokens + Five Way Disjoint Hub & Shell Refactor + React 19 Render Derivation Cleanup

Add four light mode semantic status token triplets (`--status-success`, `--status-warning`, `--status-danger`, `--status-info`) to `app/globals.css` and test locked string constants to `lib/constants/admin-labels.ts`, then refactor all in scope admin pages, shell chrome, and 4 Hub client views in place across five strictly disjoint worker touch boundaries (`M1`..`M5`) to achieve `0` `sloplint` `FAIL`s and `0` admin ESLint warnings while keeping voucher print pages, redirect stubs, database schemas, and Server Actions untouched.

**Pros**:
- Reaches `0 FAIL` in `sloplint.mjs` and `0` ESLint warnings across all in scope admin files in one cohesive slice without altering any backend API, Zod schema, or Drizzle query.
- Semantic `--status-*` tokens eliminate both raw hex literals (`Gate 48`) and raw Tailwind default palette classes (`Gate 74`) while guaranteeing WCAG 2.2 AA contrast (`>= 4.5:1`) on every SLA badge, WhatsApp status pill, and OAuth health chip.
- Five disjoint worker boundaries (`M1` Shell/Overview/Dossiers, `M2` Desk/Kanban/WA, `M3` Campaigns/Social, `M4` Studio/Marketing/Catalog/Settings, `M5` Unit/Lint Gate Suite) allow clean parallel execution with zero merge collisions.

**Cons**:
- Requires disciplined surgical edits across ~70 files and careful adherence to the locked E2E/W3 selector map so no test locator regresses.

### Option 2: CSS Token & `sloplint` Sweep Only (Leave `108` ESLint Hook Warnings Untouched)

Replace hex classes, `transition-all`, small uppercase labels, and nested card borders to clear `sloplint`, but skip refactoring `useEffect` `setState` and `Date.now()` render purity warnings in admin components.

**Pros**:
- Smaller diff in dialog and hub client components because hook bodies stay untouched.

**Cons**:
- Leaves `80` React 19 hook purity and cascading effect `setState` warnings active in core daily operator workflows (`CommandPalette`, `QuoteWorksheetForm`, `DeskHubClient`, `CampaignsHubClient`, and all `20` Catalog dialogs), keeping `npm run lint` noisy and masking genuine hook bugs.

### Option 3: Extract a New Generic Admin Workbench Component Library First

Build a new abstraction layer of generic `<AdminPageShell>`, `<AdminDataTable>`, `<AdminFormModal>`, and `<AdminStatCard>` wrapper components and rewrite each hub to consume them.

**Pros**:
- Centralizes layout markup inside wrapper components.

**Cons**:
- High regression risk across complex domain specific surfaces (`@dnd-kit` Kanban drag handles, 5 platform social device previewer, itemized SAR/PKR quote worksheet, and 24h Meta template builders) where bespoke DOM IDs and E2E selectors are already locked by `J6`..`J22` and `W3` tests.

## Rationale

Option 1 matches the proven incremental enhancement pattern that succeeded in Slice 47 (`Spec 0027`): keep route structure, data fetching, RBAC, and domain state intact while upgrading tokens, containment layers, keyboard focus states, and React 19 hook hygiene in place. Adding `--status-success`, `--status-warning`, `--status-danger`, and `--status-info` in `app/globals.css` solves a genuine `Operate` need that `Persuade` marketing pages did not have: dense operational queues need unmistakable green/amber/red/blue status signals for SLA breaches, failed dispatches, and live connection health without falling back to uncalibrated Tailwind stock swatches. Keeping `applications/[id]/voucher` and `components/planner/**` strictly zero touch protects print geometry and pilgrim booking flows from any unintended side effects.

## Baseline Audit & Locked Test Contract Inventory

### 1. Hallmark `sloplint.mjs` Baseline (`751 FAIL, 148 REFLEX, 89 WARN` across `71` files)
- `FAIL 48` (`412`): Raw hex literals (`#0A3622`, `#C5A059`, `#7A5C1E`, `#FAF7F0`, `#E6DEC8`, etc.) -> map to semantic tokens (`bg-primary`, `bg-sidebar`, `text-gold-text`, `border-gold-border`, `status-*`).
- `FAIL 67` (`120`): `<= 15px` `uppercase` or wide `tracking-*` labels -> convert to sentence/title case in `font-sans` with normal tracking.
- `FAIL 10a` (`89`): `transition-all` -> replace with `transition-colors`, `transition-opacity`, or `transition-transform`.
- `FAIL 4` (`33`): Card nested inside card -> keep outer card/dialog border only; convert inner cards to `bg-secondary/60` wells or `divide-y border-border` sections.
- `FAIL 30a` (`32`): Emoji characters used as UI icons -> replace with `lucide-react` icons (`aria-hidden="true"`).
- `FAIL 63` (`20`): Glued trailing `→` arrows or `2+` middle dots (`·`/`•`) -> use `<ArrowRight aria-hidden="true" />` and flex badges/separators (`formatCmdkPassengerSummary` for the single `•` locked by `J12`).
- `FAIL 19` (`16`): Inline JSX em/en dashes or buzzwords -> import `STUDIO_MODE_B_LABEL` from `lib/constants/admin-labels.ts` and reword non locked prose dashes.
- `FAIL 27` (`11`): Missing `motion-reduce:` alongside transform/keyframe classes -> add `motion-reduce:transition-none motion-reduce:transform-none` / `motion-reduce:animate-none`.
- `FAIL 26a` (`9`): Missing or `< 3:1` `:focus-visible` -> add `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary` (or `focus-visible:outline-gold` on dark `bg-sidebar`/`bg-primary` surfaces).
- `FAIL 33` (`5`): Unlabelled decorative `<svg>` -> add `aria-hidden="true"` (or accessible title/label).
- `FAIL 54` (`3`): Small inert eyebrow immediately before heading -> fold into heading or remove decorative eyebrow.
- `FAIL 2a` (`1`): `from-amber-500 via-pink-500 to-purple-600` in `social-platform-preview.tsx:560` -> replace with `bg-gold-gradient`.

### 2. ESLint Warning Baseline (`108` warnings across Admin)
- **`react-hooks/purity` (`12`)**: `app/admin/(dashboard)/applications/page.tsx:102`; `components/admin/hubs/applications-kanban-board.tsx:774`; `components/admin/hubs/connections-settings-client.tsx:1454,1460`; `components/admin/hubs/desk-hub-client.tsx:494,1029,1229,1281,1318,1366,1424,1639,2154`.
- **`react-hooks/exhaustive-deps` (`1`)**: `components/admin/hubs/studio-hub-client.tsx:302`.
- **`@next/next/no-img-element` (`7`)**: `components/admin/campaigns/social-platform-preview.tsx:722,841,1063`; `components/admin/hubs/campaigns-hub-client.tsx:2085,3257,4317,4708`.
- **`@typescript-eslint/no-unused-vars` (`20`)**: `connections-settings-client.tsx` (`9`), `desk-hub-client.tsx` (`9`), `studio-hub-client.tsx` (`2`), `post-lookup-client.tsx` (`1`).
- **`react-hooks/set-state-in-effect` (`68`)**: `command-palette.tsx:175`, `quote-dispatch-bar.tsx:76`, `quote-worksheet-form.tsx:171`, `campaign-realtime-status.tsx:59`, `social-platform-preview.tsx:236,301`, `studio-media-picker-modal.tsx:83`, `meta-template-builder-modal.tsx:135`, `whatsapp-auto-reply-studio.tsx:170,174`, `applications-kanban-board.tsx:259`, `campaigns-hub-client.tsx:929,958,991,1098,3993,4791`, `catalog-hub-client.tsx:447`, `connections-settings-client.tsx:415,440,467,552,749`, `desk-hub-client.tsx:698,1098`, `studio-hub-client.tsx:321,325,329,480`, `studio-realtime-run-banner.tsx:220,226,237`, `whatsapp-linked-device-card.tsx:66`, and `catalog/*` (`31` occurrences across the `20` catalog client/dialog files).

### 3. Must-Preserve E2E (`J6`..`J23`) & `W3` Source/DOM Contracts
- **Login & Shell (`J6`, `J22`, `f-ux/admin-shell-a11y.test.ts`)**: `input[type="email"]`, `input[type="password"]`, `button[type="submit"]`; `app/admin/(dashboard)/layout.tsx` keeps `AdminShellFrame`, `mustChangePassword`, `/admin/login?change_password=1`; `<a href="#main-content">Skip to main content</a>`; single `<main id="main-content" tabIndex={-1}>`; `error.tsx` keeps `"use client"`, `role="alert"`, `tabular-nums`, `href="/admin"`; `loading.tsx` keeps `role="status"`, `aria-busy="true"`; `admin-topbar.tsx` keeps lazy `next/dynamic` (`ssr: false`) for `CommandPalette`, `0` `<h1>` tags, `/admin/catalog?tab=messages`, `tabular-nums`, and overdue SLA link (`a[href*="filter=overdue"]` / `[title*="SLA"]` / `[href*="/admin/desk"]`); `status-badge.tsx` keeps `DEFAULT_SLA_OVERDUE_HOURS = 2`, `SLA Overdue (2h+)`, `TabularPrice` (`PKR 425,000`, `tabular-nums`).
- **Command Palette (`J12`)**: `Control+k` opens `input[cmdk-input], input[placeholder*="ART-"]`; button `/1-Click Convert to Quote/i`; inputs `placeholder*="Pilgrim Full Name"`, `placeholder*="WhatsApp / Phone"`, `#cmd-adults`, `#cmd-children`, `#cmd-infants`; text `/3 Beds\/Seats \(Adults \+ Children\) • 4 Total Passports/i` (via `formatCmdkPassengerSummary`); button `/Create Dossier & Open Quote/i`.
- **Dossier & Worksheet (`J7`, `J8`, `J9`, `J23`, `f-desk`)**: `#visa-total`, `#flights-total`, `#makkah-hotel-total`, `#madinah-hotel-total`, `#customer-notes`; buttons/links `/Save & Mark Quoted/i` -> `/Success/i`, `/3-Page Luxury PDF/i` -> `/Open PDF/i`, `/AI Copilot Pre-Fill & Summary/i` -> `/AI Quoting Copilot Recommendation/i` & `div` `/Suggested Total/i`, `/\+ Record Payment/i` -> `input[placeholder*="250000"]`, `input[placeholder*="TXN / Slip"]`, `/Commit Verified Receipt/i` -> `/\+PKR 50,000/i`; `quote-worksheet-form.tsx` never contains `suppliers[0]?.id`; UTM strings `"Paid Search: Google Ads"`, `"Google CPC"`, `"Campaign: ramadan_2027"`.
- **Desk & Kanban (`J7`, `J15`..`J17`, `f-desk`, `f-wa`)**: `KANBAN_COLUMN_IDS = ["pending_quote","quoted","revision_requested","approved","rejected","cancelled"]`, `setActivatorNodeRef`, `"Move application "`; `desk/page.tsx` keeps `schema.user.isActive` and `desc(schema.whatsappMessages.createdAt)`; `desk-hub-client.tsx` keeps `pollInFlightRef`, `shouldAutoScrollThreadOnUpdate`, buttons `/Auto-Replies & Setup/i` and `/Meta Templates/i`, expired window text `/24-hour|24h|template|window/i`; `whatsapp-auto-reply-studio.tsx` uses `@/components/ui/dialog` (`0` `fixed inset-0`, `0` `dark:`).
- **Studio, Campaigns, Catalog & Settings (`J10`, `J11`, `J18`..`J21`, `f-studio`, `f-social`, `f-admin`)**: `studio-hub-client.tsx` keeps `STUDIO_MODE_B_LABEL` (`/Mode B — Raw B2B Supplier Wholesale Flyer/i`), `net_plus_markup`, `perTierMarkupPkr`, `isPdfAssetPreviewUrl`, `/Vector PDF Document|Open Vector PDF/i`, `input[placeholder*="posters/finished"]`, `/Draft Review Required/i`, `/Approve Draft/i`, `/Render 4K Sheet/i`, `/rendered and uploaded to Cloudflare R2/i`; `campaigns/page.tsx` keeps `postsPageSize`, `contactsPageSize`, `count()`, `sanitizeIntegrationMetaForClient`; `campaigns-hub-client.tsx` keeps verbatim `<span>Failed</span>` and `userRole === "super_admin"` (`0` `whatsapp-linked-device` imports); `social-calendar-view.tsx` keeps `md:hidden`, `overflow-x-auto`, `min-w-[680px]`; `applications/page.tsx` keeps `const PAGE_SIZE = 25`, `limit: PAGE_SIZE`, `offset,`, `buildQueuePageHref`.
