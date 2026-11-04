# 0011. Four Hub Admin Information Architecture and Kanban Desk

**Date**: 2026-11-02
**Status**: Approved (Implemented)

## Summary

This specification consolidates fifteen scattered administrative pages into four unified daily operational hubs, an executive overview, and an upgraded settings center for Al Ramlah Travels. Agency staff gain a visual drag and drop Kanban quoting desk, a global keyboard command palette for instant post code lookups, and unified workspaces for multimodal poster generation, social campaigns, and inventory management. The new information architecture reduces cognitive clutter, honors the single Haramain luxury theme, and preserves total backward compatibility for existing URLs and deep links.

## Context

Al Ramlah Travels operates a high touch pilgrimage travel agency where quoting speed, customer responsiveness, and multi channel marketing dictate commercial success. The current administrative portal houses fifteen individual top level routes in the sidebar. Staff must constantly jump between separate pages for supplier flyers, group departures, social distribution, personal outreach, post reverse lookups, contact messages, applications, and seven dynamic inventory tables.

This fragmented navigation creates severe daily operational friction:
1. Quoting staff must switch between three disconnected screens to resolve customer inquiries, check wholesale supplier rates, and track quoting status.
2. The applications list lacks visual pipeline velocity, forcing agents to scan tabular rows without an immediate grasp of stage progression or overdue service level agreements.
3. Marketing staff manage flyer uploads, poster generation, social distribution, and personal outreach across isolated pages with redundant forms and fragmented preview tools.
4. When a prospective pilgrim messages on WhatsApp asking about a specific post reference code like `ART-AM-21D-04`, staff must leave their current screen, navigate to the post lookup page, search manually, and transcribe numbers into a new quote.
5. Catalog and configuration settings are spread across seven distinct sidebar items, cluttering navigation for staff who only update hotels or transport tariffs occasionally.

To achieve operational excellence, the administrative experience requires consolidation into four clean daily hubs: Package and Poster Studio (`/admin/studio`), Campaigns and Outreach (`/admin/campaigns`), Pilgrim Inbox and Quote Desk (`/admin/desk`), and Catalog and Suppliers (`/admin/catalog`). An upgraded Connections and Settings hub (`/admin/settings`) houses technical integrations and role management, while a global keyboard command palette (`Cmd+K` or `Ctrl+K`) allows instant reverse lookups from any screen. All legacy routes must redirect transparently to prevent broken bookmarks, and deep links to application worksheets and official vouchers must remain fully functional.

## Requirements

**User stories**:
- As an agency quoting agent, I want a unified visual Kanban desk with drag and drop stage progression so that I can monitor application flow and prioritize urgent quotes before the twenty four hour threshold expires.
- As an agency quoting agent, I want a shared WhatsApp team inbox alongside contact inquiries so that our team can converse with pilgrims, inspect auto detected package cards, and generate quotes in one click.
- As an agency staff member, I want to press `Cmd+K` or `Ctrl+K` from any screen in the portal to search post codes, hotels, dates, or prices so that I can answer customer WhatsApp inquiries in seconds without losing my place.
- As a marketing specialist, I want a single Studio hub with a multimodal dropzone for supplier PDFs, images, and raw text so that I can extract packages, wrap margins, and publish promotional posters without switching tools.
- As an outreach coordinator, I want a unified Campaigns hub where I can schedule social media posts, copy WhatsApp group captions with poster downloads, and manage personal VIP outreach with cooldown safeguards.
- As an inventory manager, I want a tabbed Catalog hub with URL synced state so that I can update hotels, visa rates, transport sectors, ziyarat sites, and flight schedules in one organized workspace.
- As a super administrator, I want an upgraded Settings hub to verify Meta WhatsApp Business credentials, connect social media accounts, check Gotenberg PDF rendering health, and manage staff access.

**Acceptance criteria**:
- **AC-1**: The admin sidebar navigation at `components/layout/admin-sidebar.tsx` consolidates all administrative links into Executive Dashboard (`/admin`), four operational hubs (`/admin/studio`, `/admin/campaigns`, `/admin/desk`, `/admin/catalog`), and Agency Settings (`/admin/settings`), highlighting active parent hubs when viewing child routes or URL tabs.
- **AC-2**: The admin topbar at `components/layout/admin-topbar.tsx` provides a global keyboard shortcut (`Cmd+K` on macOS, `Ctrl+K` on Windows and Linux) that opens an instant Post Reverse Lookup Command Palette powered by `cmdk`, searching packages by code, price, hotel, airline, or date, and providing one click quote conversion.
- **AC-3**: The Package and Poster Studio at `app/admin/(dashboard)/studio/page.tsx` renders three unified tabs (`?tab=studio`, `?tab=vault`, `?tab=packages`): Tab 1 provides a multimodal dropzone accepting 4K images, PDFs, raw flyers, or pasted text, using presigned direct storage uploads and an interactive extraction workbench.
- **AC-4**: Tab 2 of the Studio hub (`Wrapped Flyers & Spotlights Vault`) presents filterable grid cards of generated multi package sheets and single package spotlight posters, supporting high resolution asset preview, link copying, and direct downloads.
- **AC-5**: Tab 3 of the Studio hub (`Website Group Packages`) embeds the pre existing `GroupsClient` component, allowing complete CRUD management for public group packages and departure batch seat inventory.
- **AC-6**: The Campaigns and Outreach hub at `app/admin/(dashboard)/campaigns/page.tsx` renders three tabs (`?tab=social`, `?tab=whatsapp`, `?tab=outreach`): Tab 1 provides a Core 5 social calendar (Instagram, Facebook, TikTok, YouTube, Google Business Profile) with scheduled post composing and a two step hook toggle.
- **AC-7**: Tab 2 of the Campaigns hub (`WhatsApp Queue`) provides a ban safe distribution queue for thirty or more WhatsApp groups and two WhatsApp Status lines, featuring one click caption copying, one click poster download, and manual posting audit checkboxes.
- **AC-8**: Tab 3 of the Campaigns hub (`Broadcasts & VIP Outreach`) integrates official Meta template broadcasts alongside the fourteen day cooldown personal outreach CRM, reusing `OutreachClient` to enforce safe contact cadences.
- **AC-9**: The Pilgrim Inbox and Quote Desk at `app/admin/(dashboard)/desk/page.tsx` renders two tabs (`?tab=inbox`, `?tab=pipeline`): Tab 1 houses the live WhatsApp Cloud API shared team inbox with a twenty four hour customer service window indicator, quick replies, auto detected `ART-...` post code cards, and a toggle for website contact messages.
- **AC-10**: Tab 2 of the Desk hub (`Applications Pipeline`) provides an interactive Kanban board built with `@dnd-kit/core`, organizing applications into five columns (`New`, `Pending Quote`, `Quoted`, `Approved`, `Rejected / Cancelled`).
- **AC-11**: Moving an application card between Kanban columns executes `updateApplicationStatusAction` with optimistic UI feedback, enforcing domain validation rules (for example, requiring an itemized quote before transitioning to `Quoted` or `Approved`).
- **AC-12**: The Applications Pipeline tab includes a view switcher between the Kanban board and the tabular view, embedding `ApplicationsTable`, `ApplicationsFilters`, and `ApplicationsKpiStrip`, with direct links to `/admin/applications/[id]` and `/admin/applications/[id]/voucher`.
- **AC-13**: The Catalog and Suppliers hub at `app/admin/(dashboard)/catalog/page.tsx` synchronizes its active view with the URL query parameter `?tab=`, embedding pre existing catalog clients (`HotelsClient`, `VisaClient`, `TransportClient`, `ZiyaratClient`, `FlightsClient`, `SuppliersClient`, and `ContentClient`).
- **AC-14**: The Connections and Settings hub at `app/admin/(dashboard)/settings/page.tsx` organizes agency configuration into clear cards: Meta WABA connection status, Core 5 social account links, Oracle Gotenberg PDF engine health check, general agency parameters, and super admin staff management (`UsersClient`).
- **AC-15**: Legacy administrative routes (`/admin/supplier-flyers`, `/admin/groups`, `/admin/distribution`, `/admin/outreach`, `/admin/post-lookup`, `/admin/messages`, `/admin/applications`, `/admin/hotels`, `/admin/visa`, `/admin/transport`, `/admin/ziyarat`, `/admin/flights`, `/admin/content`, `/admin/users`) render permanent server side redirects to their new hub and tab destinations, while `/admin/applications/[id]` and `/admin/applications/[id]/voucher` remain untouched.
- **AC-16**: All new and restructured components adhere strictly to the single luxury Haramain theme (Deep Emerald, Warm Ivory, Alabaster, and Metallic Gold), using Base UI `@base-ui/react` primitives with the `render` prop pattern and zero Radix UI `asChild` usage.

## Options considered

### Option 1: Retain fifteen separate top level sidebar items with collapsible accordion groups
Keep all fifteen pages at their existing URL paths and group them into accordion menus inside the sidebar.

**Pros**:
- Requires no URL changes or route redirection logic.
- Avoids refactoring page containers into tabbed wrappers.

**Cons**:
- Fails to solve cognitive overload: staff still navigate between fifteen different pages each day.
- Prevents cross functional workflows like viewing incoming WhatsApp messages and converting post lookups into quotes on a single screen.
- Keeps related tools (such as flyer extraction, wrapped posters, and group batches) artificially separated.

### Option 2 (Chosen): Consolidate into four operational hubs with topbar palette and Kanban desk
Restructure administrative workflows into four cohesive hubs (`Studio`, `Campaigns`, `Desk`, `Catalog`) plus `Settings`, powered by URL synced tabs, an interactive `@dnd-kit` Kanban board, and a global `Cmd+K` search palette. Legacy URLs redirect permanently to their corresponding hub tabs.

**Pros**:
- Aligns navigation directly with agency roles: content creation, marketing outreach, customer quoting, and inventory maintenance.
- Visual Kanban board gives immediate clarity on quoting progress, overdue service agreements, and conversion velocity.
- Global `Cmd+K` palette allows instantaneous post lookups from any screen without losing task context.
- Full backward compatibility: all historical URLs, browser bookmarks, and external links redirect seamlessly.
- Reuses all existing catalog, marketing, and table components without throwing away verified code.

**Cons**:
- Requires creating five new hub pages, updating topbar and sidebar layouts, and configuring thirteen redirect stubs.
- Requires adding `@dnd-kit/core` for Kanban drag and drop interaction.

### Option 3: Heavy single page application with client side floating modals
Merge the entire admin experience into a single monolithic client page that opens different tools inside floating modal windows or drawer panes.

**Pros**:
- Staff never experience full page navigations.

**Cons**:
- Severe performance penalty: loads massive JavaScript bundles and unnecessary database queries on initial render.
- Destroys browser history, making it impossible to share URLs or bookmark specific tabs.
- Violates Next.js 16 Server Component best practices and complicates error boundaries.

## Decision

**Chosen option**: Option 2: Consolidate into four operational hubs with topbar palette and Kanban desk.

Al Ramlah Travels will restructure the administrative portal into four daily hubs (`/admin/studio`, `/admin/campaigns`, `/admin/desk`, `/admin/catalog`), preserve `/admin` as the Executive Overview, upgrade `/admin/settings` with connection diagnostics, implement a global `Cmd+K` palette, and introduce an interactive `@dnd-kit` Kanban desk.

**Implementation skills**: `shadcn` (`shadcn/ui`, `.agents/skills/shadcn/`) · `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`)

## Rationale

In high volume pilgrimage travel operations, seconds matter. When an intending pilgrim calls or messages on WhatsApp asking about a specific flyer code, the quoting agent must instantly pull up wholesale costs, markup rules, and flight schedules. Navigating away from an active quote to open a separate post lookup screen disrupts train of thought and slows response times. A global `Cmd+K` command palette solves this friction permanently by placing reverse lookups a keystroke away from any screen.

Similarly, grouping applications into five distinct visual stages (`New`, `Pending Quote`, `Quoted`, `Approved`, `Rejected / Cancelled`) on a drag and drop Kanban desk transforms administrative workflow. Agency managers can immediately spot bottlenecks, see cards with pulsing red overdue indicators, and drag cards to advance their status. 

Consolidating fifteen scattered sidebar items into four daily hubs reduces cognitive fatigue. Quoting agents spend eighty percent of their day in the Desk hub, marketing managers work primarily inside the Studio and Campaigns hubs, and inventory managers access the Catalog hub when updating seasonal tariffs. By preserving existing URLs through clean server redirects, zero bookmarks or links are broken.

## Feature design

### Route map and component hierarchy

```
app/admin/(dashboard)/
├── page.tsx                           # Executive Dashboard (KPIs, occupancy, smart insights)
├── studio/
│   └── page.tsx                       # Hub 1: Package & Poster Studio (?tab=studio|vault|packages)
├── campaigns/
│   └── page.tsx                       # Hub 2: Campaigns & Outreach (?tab=social|whatsapp|outreach)
├── desk/
│   └── page.tsx                       # Hub 3: Pilgrim Inbox & Quote Desk (?tab=inbox|pipeline)
├── catalog/
│   └── page.tsx                       # Hub 4: Catalog & Suppliers (?tab=hotels|visa|transport|...)
├── settings/
│   └── page.tsx                       # Upgraded Connections & Settings (?tab=connections|agency|staff)
├── applications/
│   ├── page.tsx                       # Legacy redirect stub -> /admin/desk?tab=pipeline
│   └── [id]/
│       ├── page.tsx                   # Interactive Quoting Worksheet (intact, untouched)
│       └── voucher/
│           └── page.tsx               # Printable Official Luxury Voucher (intact, untouched)
├── supplier-flyers/page.tsx           # Legacy redirect stub -> /admin/studio?tab=studio
├── groups/page.tsx                    # Legacy redirect stub -> /admin/studio?tab=packages
├── distribution/page.tsx              # Legacy redirect stub -> /admin/campaigns?tab=whatsapp
├── outreach/page.tsx                  # Legacy redirect stub -> /admin/campaigns?tab=outreach
├── post-lookup/page.tsx               # Legacy redirect stub -> /admin/desk (with search modal trigger)
├── messages/page.tsx                  # Legacy redirect stub -> /admin/desk?tab=inbox
├── hotels/page.tsx                    # Legacy redirect stub -> /admin/catalog?tab=hotels
├── visa/page.tsx                      # Legacy redirect stub -> /admin/catalog?tab=visa
├── transport/page.tsx                 # Legacy redirect stub -> /admin/catalog?tab=transport
├── ziyarat/page.tsx                   # Legacy redirect stub -> /admin/catalog?tab=ziyarat
├── flights/page.tsx                   # Legacy redirect stub -> /admin/catalog?tab=flights
├── content/page.tsx                   # Legacy redirect stub -> /admin/catalog?tab=cms
└── users/page.tsx                     # Legacy redirect stub -> /admin/settings?tab=staff
```

### Visual layout and navigation architecture

The administrative sidebar is streamlined into three logical sections:
1. **Core Workspaces**:
   - Executive Dashboard (`/admin` with `LayoutDashboard` icon)
   - Pilgrim Inbox and Desk (`/admin/desk` with `Inbox` icon and live badge for pending quotes plus unread messages)
   - Package and Poster Studio (`/admin/studio` with `Sparkles` icon)
   - Campaigns and Outreach (`/admin/campaigns` with `Share2` icon)
2. **Operations and Inventory**:
   - Catalog and Suppliers (`/admin/catalog` with `Boxes` icon)
3. **System**:
   - Connections and Settings (`/admin/settings` with `Settings` icon)

The sidebar header preserves the Al Ramlah Travels emblem, while the footer displays authenticated staff details, role badge, and a sign out button.

### Hub 1: Package and Poster Studio (`/admin/studio`)

The Studio hub unifies the entire content generation pipeline under three URL synced tabs:

1. **Tab 1: Multimodal Dropzone & Extraction Workbench (`?tab=studio`)**:
   - Multimodal ingestion zone accepting high resolution images (PNG, JPEG, WebP), PDFs, raw supplier flyers, or pasted WhatsApp Urdu/English text.
   - Presigned direct upload to Cloudflare R2 storage with progress bar.
   - Multimodal extraction engine invoking Gemini Ultra with Sharp normalizer to parse dates, airline flight numbers, Makkah/Madinah hotels, Haram distances, and room sharing tariffs.
   - Live editable package cards allowing staff to review extracted data, set commission mode (`included_in_flyer` or `net_plus_markup`), apply profit margins, and verify retail rates before saving.
   - One click poster generator triggering 4K Multi Package Sheet rendering or Single Package Spotlight posters.

2. **Tab 2: Wrapped Flyers & Spotlights Vault (`?tab=vault`)**:
   - Visual media vault displaying all generated marketing assets.
   - Filter chips: All Assets, Multi Package Sheets, Single Package Spotlights, Custom Quotations.
   - Card actions: Full resolution preview modal, copy public asset URL, download 4K image, and publish to website group package.

3. **Tab 3: Website Group Packages & Batches (`?tab=packages`)**:
   - Directly embeds the existing `GroupsClient` component.
   - Full management of pre built packages in the `group_packages` table and seasonal departure batches in `group_departures`.
   - Real time seat availability meters with automatic badge transitions (`filling_fast` at 80 percent, `sold_out` at 100 percent).

### Hub 2: Campaigns and Outreach (`/admin/campaigns`)

The Campaigns hub unites multi channel broadcast and personalized customer cultivation under three tabs:

1. **Tab 1: Core 5 Social Calendar & Post Composer (`?tab=social`)**:
   - Visual weekly and monthly publication calendar displaying past and upcoming scheduled posts across Instagram, Facebook, TikTok, YouTube, and Google Business Profile.
   - Interactive Post Composer supporting caption writing, image attachment from the Studio vault, channel selection checkboxes, and schedule time picker.
   - Two Step Hook Toggle:
     - Step 1: Single Package Spotlight Hook post published immediately to capture attention.
     - Step 2: Multi Package Complete Sheet post automatically scheduled four hours later to fulfill algorithmic engagement and show full pricing.

2. **Tab 2: Ban Safe 1-Tap WhatsApp Groups & Status Queue (`?tab=whatsapp`)**:
   - Manages thirty or more WhatsApp community groups and two WhatsApp Status broadcast lines.
   - Safe manual distribution queue avoiding automated WhatsApp bulk bans.
   - Each row provides:
     - Group name, member count estimate, and category tag.
     - One click Copy Caption button (formatted with luxury emojis, Urdu greeting, and pricing breakdown).
     - One click Download 4K Poster button.
     - Checkbox logging (`Mark as Posted`) updating `daily_post_distributions` with timestamp and staff attribution.

3. **Tab 3: Official Meta Broadcasts & 14-Day VIP Outreach (`?tab=outreach`)**:
   - Official WhatsApp Cloud API template broadcasting interface for opt in subscriber lists.
   - Embeds the existing `OutreachClient` component for personal high value relationship cultivation.
   - Fourteen day cooldown safeguard: automatically flags contacts contacted within the past fourteen days with a cooldown badge, preventing aggressive sales cadences.
   - Lead status pipeline: `prospect`, `interested`, `active_conversation`, `contacted_cooldown`, `replied_active`, `quoted`, `booked_client`.

### Hub 3: Pilgrim Inbox and Quote Desk (`/admin/desk`)

The Desk hub is the central operational workstation for customer inquiries and quoting throughput, structured in two primary tabs:

1. **Tab 1: Shared WhatsApp Cloud API Inbox & Contact Messages (`?tab=inbox`)**:
   - Real time split pane shared team inbox adapted from proven `wacrm` patterns:
     - Left pane: Conversation list with status filters (`All`, `Unread`, `Active SLA`, `Overdue 24h`, `Contact Form`).
     - Center pane: Message thread showing incoming pilgrim messages, sent quotes, staff notes, and delivery checkmarks.
     - Right pane: Pilgrim dossier showing contact details, linked applications, lifetime value, and preferred departure city.
   - Twenty four hour WhatsApp customer service window countdown timer:
     - Shows remaining window duration (for example, `18h 42m remaining`).
     - When expired, composer automatically switches to pre approved Meta message template selector.
   - Auto detected `ART-...` Post Code Detection:
     - When incoming chat text contains an inquiry code like `ART-AM-21D-04` or `ART-UP-15D-02`, the thread automatically renders an inline rich package preview card displaying flight dates, hotels, and Quad/Triple/Double prices.
     - Card features a prominent `Convert to Quote` button that creates an inquiry and opens the quoting worksheet.
   - Quick reply macros for standard pilgrim questions (visa requirements, infant pricing rules, flight baggage allowance).
   - One click action to generate and dispatch the official three page luxury PDF quotation via WhatsApp.
   - Web Contact Messages sub tab: allows viewing and managing website contact form submissions from `contact_messages` without leaving the inbox.

2. **Tab 2: Applications Pipeline & Kanban Desk (`?tab=pipeline`)**:
   - Dual view quoting command center with an instant view toggle button:
     - **Kanban Board View**: Five columns organized by pipeline status:
       1. `New` (Fresh web submissions and WhatsApp quote conversions, awaiting review).
       2. `Pending Quote` (Under active pricing by quoting staff).
       3. `Quoted` (Official itemized quote sent to pilgrim, awaiting customer review).
       4. `Approved` (Pilgrim accepted quote, deposit confirmed, seats reserved).
       5. `Rejected / Cancelled` (Declined inquiries or pilgrim cancellations).
     - **Table List View**: Reuses `ApplicationsTable`, `ApplicationsFilters`, and `ApplicationsKpiStrip` for bulk sorting, date range filtering, and CSV export.
   - Kanban Card Specifications:
     - Built using `@dnd-kit/core` with `PointerSensor` (5px activation distance to avoid accidental drags) and accessible keyboard navigation.
     - Card header: Pilgrim name, phone number, and reference number (`ART-YYYY-XXXX`).
     - Badge tags: Journey mode (`custom_builder`, `group_booking`, `visa_only`, `hajj_inquiry`), departure city, and passenger count (`Adults + Children + Infants`).
     - SLA Overdue Alert: If an application in `Pending Quote` exceeds the agency SLA threshold (default 24 hours), the card header displays a pulsing red alert dot and text (`Overdue 24h+`).
     - Card footer: Grand total PKR amount (in tabular numbers) or `Rate Pending`, plus quick action buttons to open `/admin/applications/[id]` worksheet or preview voucher.
   - Optimistic drag and drop updates: Moving a card immediately animates to the target column while dispatching `updateApplicationStatusAction` in the background. If server validation fails (for example, attempting to move to `Quoted` without a calculated price), the card snaps back and displays an error toast.

### Hub 4: Catalog and Suppliers (`/admin/catalog`)

The Catalog hub consolidates all master inventory and supplier relationships into a clean tabbed interface with URL synchronization (`/admin/catalog?tab=<tab_name>`):

| Tab Key | Label | Icon | Embedded Component | Data Tables Managed |
|---|---|---|---|---|
| `hotels` | Hotels Catalog | `Building2` | `HotelsClient` | `hotels` |
| `visa` | Visa Pricing | `FileCheck` | `VisaClient` | `visa_rates` |
| `transport` | Transport & Vehicles | `Car` | `TransportClient` | `vehicles`, `transport_sectors`, `transport_rates` |
| `ziyarat` | Ziyarat Places | `Compass` | `ZiyaratClient` | `ziyarat_places` |
| `flights` | Airlines & Cities | `Plane` | `FlightsClient` | `airlines`, `departure_cities` |
| `suppliers` | B2B Suppliers | `Coins` | `SuppliersClient` | `suppliers` |
| `cms` | Website CMS | `Globe` | `ContentClient` | `hero_slides`, `testimonials`, `faqs` |

Each tab preserves its existing search inputs, modal dialogs, and deletion confirmations. Loading the hub with a query parameter immediately activates the requested tab, allowing deep linking from settings or notification emails.

### Upgraded Connections and Settings (`/admin/settings`)

The Settings hub is upgraded into a clear diagnostic and management workstation divided into five configuration tabs (`?tab=connections|social|pdf|agency|staff`):

1. **Meta WhatsApp Business Account (WABA)**:
   - Status badge: Connected (green) or Needs Configuration (amber).
   - Display fields: Phone Number ID, WABA Account ID, App ID, Webhook Callback URL, and Webhook Verify Token.
   - Permanent System User Access Token verification button with token expiration check.
   - Inbound webhook health indicator showing timestamp of last received webhook payload.

2. **Core 5 Social OAuth Integrations**:
   - Connection cards for Instagram Business, Facebook Pages, TikTok Business, YouTube Channel, and Google Business Profile.
   - Each card displays account name, profile avatar, connection status, token validity, and a Connect or Disconnect button routing through secure OAuth callbacks.

3. **Oracle Cloud Gotenberg PDF Engine**:
   - Live health diagnostic pinging the Gotenberg service endpoint `/health`.
   - Displays server latency in milliseconds, engine version, and a Test PDF Generation button that renders a sample quotation to verify font rendering and gold border fidelity.

4. **Agency Parameters**:
   - Embeds `SettingsClient` for general agency details: agency name, helpline WhatsApp, official email, default currency (`PKR`), quotation validity days, and SLA overdue threshold (hours).

5. **Staff and Roles Management (`?tab=staff`)**:
   - Accessible strictly by users with the `super_admin` role.
   - Embeds `UsersClient` to invite staff members, assign roles (`super_admin` or `staff`), reset passwords, and audit active sessions.

### Global Post Reverse Lookup Command Palette (`cmdk` in `AdminTopbar`)

The `AdminTopbar` component is enhanced with a global keyboard shortcut palette built on the installed `cmdk` package:

1. **Trigger Mechanisms**:
   - Keyboard shortcut: `Cmd+K` on macOS, `Ctrl+K` on Windows and Linux.
   - Visual button: Clickable search trigger in the topbar header displaying `Search packages, post codes (Ctrl+K)`.
   - Programmable trigger: Window event `open-post-lookup` dispatched from legacy redirect stubs.

2. **Search Surface**:
   - Instant filtering across pre indexed packages in `supplier_flyer_packages`:
     - Reference Code (`ART-AM-21D-04`, `ART-UP-15D-02`, `ART-ZH-10D-01`).
     - Retail or Wholesale PKR Price (`269,899`, `315,000`, `450,000`).
     - Hotel Name in Makkah or Madinah (`Voco`, `Pullman Zamzam`, `Anwar Al Madinah`, `Frontel`).
     - Airline carrier or flight date (`Saudi Airlines`, `PIA`, `24 Nov`, `15 Dec`).
     - Supplier name (`Upsky Travels`, `Ammaar`, `Zahoor Travels`).

3. **Result Presentation**:
   - Displays matching results in a luxury floating modal with emerald header and sand gold border.
   - Each result card displays:
     - Outbound flight route, carrier, and dates.
     - Makkah hotel name with Haram distance label and night count.
     - Madinah hotel name with Haram distance label and night count.
     - Quad, Triple, Double, and Sharing retail rates alongside net wholesale cost and agency commission margin.
     - Thumbnail preview of the single package spotlight poster.
   - Primary action: `Convert to Official Quote` button that opens a lightweight slide over modal, captures customer name and phone number, invokes `convertPostLookupToApplication`, and routes staff directly to `/admin/applications/[id]` with pre populated pricing.

### Backward Compatible Legacy URL Redirect Stubs

To ensure that bookmarks, staff habits, and external links never encounter a 404 error, all thirteen previous top level administrative routes are maintained as Next.js Server Component redirect stubs:

| Legacy Route | Redirect Destination | HTTP Status | Notes |
|---|---|---|---|
| `/admin/supplier-flyers` | `/admin/studio?tab=studio` | 308 Permanent | Maps directly to Multimodal Dropzone |
| `/admin/groups` | `/admin/studio?tab=packages` | 308 Permanent | Maps to Website Group Packages |
| `/admin/distribution` | `/admin/campaigns?tab=whatsapp` | 308 Permanent | Maps to WhatsApp Queue |
| `/admin/outreach` | `/admin/campaigns?tab=outreach` | 308 Permanent | Maps to VIP Outreach |
| `/admin/post-lookup` | `/admin/desk?openLookup=1` | 308 Permanent | Opens Desk hub with Command Palette open |
| `/admin/messages` | `/admin/desk?tab=inbox` | 308 Permanent | Maps to Shared Team Inbox |
| `/admin/applications` | `/admin/desk?tab=pipeline` | 308 Permanent | Maps to Applications Kanban / Table |
| `/admin/hotels` | `/admin/catalog?tab=hotels` | 308 Permanent | Maps to Hotels Catalog tab |
| `/admin/visa` | `/admin/catalog?tab=visa` | 308 Permanent | Maps to Visa Pricing tab |
| `/admin/transport` | `/admin/catalog?tab=transport` | 308 Permanent | Maps to Transport & Vehicles tab |
| `/admin/ziyarat` | `/admin/catalog?tab=ziyarat` | 308 Permanent | Maps to Ziyarat Places tab |
| `/admin/flights` | `/admin/catalog?tab=flights` | 308 Permanent | Maps to Airlines & Cities tab |
| `/admin/content` | `/admin/catalog?tab=cms` | 308 Permanent | Maps to Website CMS tab |
| `/admin/users` | `/admin/settings?tab=staff` | 308 Permanent | Maps to Staff & Roles in Settings |

The deep application routes `/admin/applications/[id]` (Quoting Worksheet) and `/admin/applications/[id]/voucher` (Printable Luxury Voucher) remain intact as active Server Components and are never redirected.

### Data model sketch and state transitions

No new database tables are required for this architectural reorganization. The four hubs and command palette leverage existing Drizzle ORM schemas in `db/schema/`:
- `applications.ts`: `applications`, `applicationQuotes`, `applicationHotelStays`, `applicationTransportSegments`.
- `suppliers-and-marketing.ts`: `suppliers`, `supplierFlyers`, `supplierFlyerPackages`, `postAssets`, `marketingChannels`, `dailyPostDistributions`, `outreachContacts`, `outreachLogs`.
- `packages.ts`: `groupPackages`, `groupDepartures`.
- `catalog.ts`: `hotels`, `vehicles`, `transportSectors`, `transportRates`, `ziyaratPlaces`, `airlines`, `departureCities`, `visaRates`.
- `cms.ts`: `heroSlides`, `testimonials`, `faqs`, `contactMessages`.
- `settings.ts`: `agencySettings`.

#### Applications Kanban state machine

```
[ New ]
   │
   ▼
[ Pending Quote ] ──(SLA > 24h: Overdue Alert)
   │
   ▼ (Requires grandTotalPkr > 0)
[ Quoted ]
   │
   ├──► [ Approved ] (Increments bookedSeats on group batches)
   │
   └──► [ Rejected / Cancelled ]
```

### API surface and Server Actions

| Action / Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `updateApplicationStatusAction` | Server Action | `id: string`, `status: ApplicationStatus`, `notes?: string` | `success: boolean`, `application: Application` | `staff` or `super_admin` | 400 (Validation failed), 401, 404 |
| `convertPostLookupToApplication` | Server Action | `packageItemId: string`, `customerName: string`, `customerPhone: string`, `selectedRoomType: string`, `adults: number` | `success: boolean`, `applicationId: string`, `referenceNumber: string` | `staff` or `super_admin` | 400, 401, 404 |
| `searchPostPackagesAction` | Server Action | `query: string`, `limit?: number` | `packages: LookupPackageItem[]` | `staff` or `super_admin` | 401 |
| `pingGotenbergHealthAction` | Server Action | none | `status: "healthy" \| "degraded" \| "offline"`, `latencyMs: number` | `super_admin` | 401, 500 |
| `verifyWabaConnectionAction` | Server Action | none | `connected: boolean`, `phoneInfo?: object`, `lastWebhookAt?: Date` | `super_admin` | 401, 502 |

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| Command Palette search | Package cards matching query | In memory filtering of `supplier_flyer_packages` with joined `flyer` and `supplier` |
| Command Palette convert | New application ID and reference number | Generated via `convertPostLookupToApplication` in `app/actions/marketing-ops.ts` |
| Kanban card render | Applicant name, reference code, party size | Direct columns from `applications` record (`fullName`, `referenceNumber`, `adults`, `children`, `infants`) |
| Kanban card price | Itemized grand total PKR amount | Derived from latest joined `application_quotes` record (`grandTotalPkr`) |
| Kanban SLA alert | Pulsing red overdue badge | Calculated client side comparing `application.createdAt` against `agency_settings.slaOverdueHours` |
| Desk tab toggle | Active tab state | URL search parameter `?tab=inbox` or `?tab=pipeline` via Next.js `searchParams` |
| Legacy route navigation | Permanent redirection to hub tab | Next.js server side `redirect("/admin/<hub>?tab=<tab>")` |
| Gotenberg health check | Latency and connection status | Live HTTP ping to `GOTENBERG_URL/health` inside `pingGotenbergHealthAction` |

### Key invariants

- Single luxury theme enforcement: All hub containers, cards, tables, modals, and palettes must render exclusively in Deep Haramain Emerald (`#0A3622` / `#0F4C31`), Warm Ivory (`#FAF7F0`), Alabaster (`#F5EFE6`), and Metallic Gold (`#C5A059`). Zero dark mode toggles or dark classes may be introduced.
- Base UI render prop standard: All dropdown menus, dialogs, sheets, tooltips, and popovers must use `@base-ui/react` primitives using the `render` prop pattern (for example, `<DropdownMenuTrigger render={<Button ... />} />`). Radix UI `asChild` composition is strictly forbidden.
- URL state synchronization: Active tabs across all four hubs (`/admin/studio`, `/admin/campaigns`, `/admin/desk`, `/admin/catalog`, `/admin/settings`) must reflect in the URL query string (`?tab=...`), enabling browser back/forward buttons, direct bookmarking, and link sharing.
- Drag constraint distance: The `@dnd-kit/core` Kanban board must enforce a minimum pointer drag distance of 5 pixels before activating, ensuring that standard card clicks (to open worksheets or vouchers) are never misidentified as drag events.
- Immutable deep routes: The quoting detail route `/admin/applications/[id]` and printable voucher `/admin/applications/[id]/voucher` must never be relocated or redirected, preserving deep link stability for quotation dispatches.

### Security model

- Role based access control: All hub routes and server actions are guarded by `requireAdmin()`. Hub 4 Catalog editing and General Settings are accessible by both `staff` and `super_admin` roles. Staff management (`/admin/settings?tab=staff`) and technical credentials (Meta WABA tokens, OAuth secrets) are strictly restricted to `super_admin`.
- Credential masking: When viewing Meta WABA tokens or social client secrets in the Settings hub, values must be masked (showing only the last four characters), with plain text editing requiring re authentication.
- Input validation: All state transitions, search queries, and quote conversions must be parsed and validated with strict Zod schemas before database execution.

### Configuration required

- `META_WABA_PHONE_NUMBER_ID`: WhatsApp Business Phone Number ID for Cloud API dispatch.
- `META_WABA_ACCESS_TOKEN`: Permanent system user access token for official WhatsApp messaging.
- `META_WABA_VERIFY_TOKEN`: Webhook challenge token configured in Meta App Dashboard.
- `GOTENBERG_URL`: Endpoint for the Oracle Cloud Gotenberg PDF rendering container (e.g. `http://gotenberg:3000`).
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`: Cloudflare R2 credentials for presigned flyer uploads and poster asset hosting.

### Critical test scenarios

- Happy path (Global Command Palette): Quoting agent on `/admin/studio` presses `Cmd+K`, types `ART-AM`, selects `ART-AM-21D-04`, enters customer name and phone, clicks Convert to Quote, and is routed immediately to `/admin/applications/[id]` with pre filled prices, verifying **AC-2**.
- Happy path (Kanban stage transition): Quoting agent drags an application card from `Pending Quote` to `Quoted` on `/admin/desk?tab=pipeline`; card moves smoothly, optimistic update renders, database persists new status, and pilgrim status tracker reflects `quoted`, verifying **AC-10** and **AC-11**.
- Failure case (Invalid Kanban transition): Quoting agent attempts to drag an unpriced inquiry (`grandTotalPkr == 0`) from `Pending Quote` to `Approved`; server action rejects transition with 400 error, card snaps back to original column, and user sees an error toast explaining that approved quotes require a positive total, verifying **AC-11**.
- Failure case (Legacy redirect preserving deep links): User navigates to `/admin/hotels`; server issues immediate 308 redirect to `/admin/catalog?tab=hotels`. User navigates to `/admin/applications/app_123`; route renders directly without redirection, verifying **AC-15**.
- Auth/permission check: Staff member without `super_admin` role navigates to `/admin/settings?tab=staff`; page renders access denied banner or hides staff tab, preventing non administrators from managing accounts, verifying **AC-14**.

## Build plan

The build plan follows a vertical Tracer Bullet approach, implementing navigation shells and legacy redirects first, layering the global command palette, and systematically delivering each of the four operational hubs with full end to end behavior.

1. Create permanent server side redirect stubs for all thirteen legacy admin routes in `app/admin/(dashboard)/` (`supplier-flyers`, `groups`, `distribution`, `outreach`, `post-lookup`, `messages`, `applications`, `hotels`, `visa`, `transport`, `ziyarat`, `flights`, `content`, `users`), leaving `/admin/applications/[id]` untouched, satisfies **AC-15**.
2. Restructure `components/layout/admin-sidebar.tsx` to consolidate navigation into Executive Dashboard, four operational hubs (`/admin/studio`, `/admin/campaigns`, `/admin/desk`, `/admin/catalog`), and Settings, with active parent highlighting and live operational badge counts, satisfies **AC-1**, **AC-16**.
3. Implement the global `Cmd+K` / `Ctrl+K` Post Reverse Lookup Command Palette in `components/layout/admin-topbar.tsx` using `cmdk`, wiring instant package search and 1-click quote conversion via `convertPostLookupToApplication`, satisfies **AC-2**, **AC-16**.
4. Construct Hub 1: Package and Poster Studio at `app/admin/(dashboard)/studio/page.tsx`, organizing Tab 1 (Multimodal Dropzone and Extraction Workbench), Tab 2 (Wrapped Flyers and Spotlights Vault), and Tab 3 (Website Group Packages reusing `GroupsClient`), satisfies **AC-3**, **AC-4**, **AC-5**, **AC-16**.
5. Construct Hub 2: Campaigns and Outreach at `app/admin/(dashboard)/campaigns/page.tsx`, organizing Tab 1 (Core 5 Social Calendar and Post Composer with two step hook toggle), Tab 2 (WhatsApp Groups and Status Queue with one click copy and poster download), and Tab 3 (Broadcasts and 14-Day VIP Outreach reusing `OutreachClient`), satisfies **AC-6**, **AC-7**, **AC-8**, **AC-16**.
6. Construct Hub 3: Pilgrim Inbox and Quote Desk at `app/admin/(dashboard)/desk/page.tsx`, implementing Tab 1 (Live WhatsApp Cloud API team inbox with 24h SLA indicator and auto detected post cards) and Tab 2 (Applications Pipeline with `@dnd-kit` Kanban board, status transitions, and Table View toggle), satisfies **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-16**.
7. Construct Hub 4: Catalog and Suppliers at `app/admin/(dashboard)/catalog/page.tsx`, providing URL synced tabs (`?tab=`) that embed existing catalog clients (`HotelsClient`, `VisaClient`, `TransportClient`, `ZiyaratClient`, `FlightsClient`, `SuppliersClient`, and `ContentClient`), satisfies **AC-13**, **AC-16**.
8. Upgrade Connections and Settings at `app/admin/(dashboard)/settings/page.tsx` with dedicated cards for Meta WABA configuration, Core 5 Social OAuth accounts, Oracle Gotenberg PDF health diagnostics, agency parameters, and super admin staff management (`UsersClient`), satisfies **AC-14**, **AC-16**.

## Consequences

**Positive**:
- Streamlines daily quoting workflows: quoting agents can monitor applications on a visual Kanban board, handle WhatsApp conversations, and convert post lookups without switching screens.
- Dramatically cuts administrative clutter: replaces fifteen top level navigation items with four logical hubs tailored to specific business roles.
- Eliminates quote lookup latency: the global `Cmd+K` palette allows staff to answer customer pricing inquiries from anywhere in the portal within three seconds.
- Zero broken links: all historical URLs and bookmarks redirect permanently and seamlessly to their new tab locations.
- Maximizes code reuse: preserves and integrates all existing catalog CRUD clients, marketing tools, and application worksheets without throwaway rewrites.

**Negative / tradeoffs**:
- Requires installing `@dnd-kit/core` to support accessible drag and drop interaction on the Kanban desk.
- Tabbed hubs require staff to adapt to URL query parameters (`?tab=...`) instead of individual bookmarkable pathnames, though server redirects ease this transition.

**Neutral**:
- Legacy route folders must remain in the repository as lightweight redirect stubs to ensure permanent HTTP compatibility.
- Quoting staff must be oriented on the five column Kanban lifecycle states and the twenty four hour overdue indicator.

## Follow-up

- [ ] Verify that `@dnd-kit/core` pointer activation constraints prevent touch scrolling conflicts on tablet and mobile browser viewports.
- [ ] Confirm that Meta WABA webhook events trigger optimistic updates in the shared WhatsApp team inbox tab.
- [ ] Monitor server response times on `searchPostPackagesAction` during peak pilgrimage booking seasons to ensure command palette results render in under 100 milliseconds.

## References

**Project sources**:
- `AGENTS.md`: Single luxury Haramain theme rules, Base UI `render` prop composition, and Tracer Bullet build methodology.
- `design.md`: Color tokens (Deep Haramain Emerald, Warm Ivory, Alabaster Parchment, Sand Gold Hairline, Metallic Gold), typography, and semantic status color guidelines.
- Spec 0006: `0006-admin-quoting-worksheet-and-status-tracker.md` (Admin quoting worksheet layout, status transitions, and voucher generation).
- Spec 0007: `0007-group-packages-and-hajj-inquiries.md` (Group package CRUD, departure batch management, and seat occupancy calculation).

**Practices & standards**:
- Accessible Drag and Drop: W3C WAI ARIA Drag and Drop Design Pattern utilizing `@dnd-kit/core` with keyboard accessibility and pointer distance thresholds.
- Strangler Fig Pattern: Incrementally wrapping and consolidating legacy URL endpoints into unified hubs while maintaining backward compatible redirects.
- Base UI Render Prop Standard: Component composition using the `@base-ui/react` `render` prop pattern in place of Radix UI `asChild`.
