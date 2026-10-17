# 0007. Pre-Built Group Packages and Hajj Inquiries

**Date**: 2026-10-17
**Status**: Proposed

## Summary

This specification defines the pre-built group package management system and the dedicated VIP Hajj consultation intake engine for Al Ramlah Travels. Agency administrators can configure seasonal packages, schedule departure batches across Pakistani gateway cities, and track real-time seat occupancy. Pilgrims can explore package tiers, check remaining seat allotments, and book seats through an integrated booking modal, or submit specialized consultation requests for high-demand Hajj arrangements.

## Context

While customized Umrah itineraries provide maximum flexibility for seasoned travelers, a substantial portion of Pakistani pilgrims prefer pre-built group departures. Group packages offer fixed departure dates, group companionship, guided religious scholars, and significant cost savings achieved through bulk hotel and flight allotments. To serve this market, Al Ramlah Travels requires a structured package catalog that pairs fixed itineraries with flexible departure batches across major Pakistani international airports (Karachi, Lahore, Islamabad, Multan, Peshawar, and Sialkot).

Unlike Umrah, Hajj travel is strictly regulated by the Ministry of Religious Affairs (MORA) Pakistan and Saudi Arabia's Nusuk platform. Hajj operations are governed by official governmental quotas, mandatory balloting, and strict Maktab camp assignments in Mina and Arafat. Providing automated online e-commerce booking or fixed checkout for Hajj packages violates regulatory guidelines and exposes travel agencies to licensing revocation. High-intent pilgrims seeking premium Hajj arrangements require personalized consultations to assess quota availability, VIP Maktab camp tiers, and luxury private accommodation near the Jamarat.

To address these distinct commercial and regulatory realities, the platform must provide two specialized channels:
1. **Dynamic Group Package Management**: An administrative suite (`/admin/groups`) to manage packages and departure batches with real-time seat capacity tracking, paired with a public package showcase on the home page featuring transparent Quad, Triple, and Double bed pricing and live seat availability bars.
2. **Dedicated VIP Hajj Consultation Engine**: A prestigious, high-conversion consultation section (`#hajj-inquiry`) that captures pilgrim requirements across key accommodation categories (Aziziyah Standard, Shisha near Jamarat, VIP Mina Camp) and feeds directly into the central application pipeline with dedicated Hajj classification.

## Requirements

**User stories**:
- As an agency administrator, I want to create and edit pre-built group packages with linked hotels, airlines, and room-tier pricing so that our seasonal offerings are always up to date.
- As an agency ticketing manager, I want to schedule multiple departure batches per package with individual seat capacities and monitor real-time occupancy status so that we prevent overbooking.
- As an intending pilgrim, I want to browse group packages filtered by tier and departure city, view remaining seats, and book our family's spots so that we secure our pilgrimage at a fixed, predictable rate.
- As a pilgrim inquiring about Hajj, I want to submit a confidential consultation request specifying our preferred tent and hotel tier so that an agency Hajj director can contact us with authorized options.
- As an agency executive, I want group bookings and Hajj inquiries consolidated into our primary application CRM with appropriate source tags so that staff handle them according to their specific operational workflows.

**Acceptance criteria**:
- **AC-1**: The admin group package management interface at `app/admin/(dashboard)/groups/page.tsx` supports full creation, editing, status toggling (`isActive`, `isFeatured`), and deletion of packages in the `group_packages` table, capturing title, slug, tier (`economy`, `bronze`, `silver`, `gold`, `vip_5star`), duration days, Makkah/Madinah nights, linked airline, linked hotels, meal plans, Quad/Triple/Double prices, and highlights.
- **AC-2**: The admin interface provides a departure batch manager for each package, supporting creation and management of records in `group_departures` with batch codes, departure city selection (from `departure_cities`), departure and return dates, total seat capacity, booked seat count, lifecycle status (`open`, `filling_fast`, `sold_out`, `closed`), and optional price overrides.
- **AC-3**: The departure batch scheduler automatically calculates remaining seats (`totalSeats - bookedSeats`) and visualizes occupancy through an interactive progress bar and status badge.
- **AC-4**: When booked seats reach $80\%$ of total capacity, the system automatically transitions batch status to `filling_fast`; when booked seats reach $100\%$, status automatically flips to `sold_out`.
- **AC-5**: The public group packages section (`components/public/group-packages-section.tsx` on `app/(public)/page.tsx#group-packages`) displays active packages with filters for package tier and departure gateway city.
- **AC-6**: Package cards prominently display fixed departure dates, departure airport code, airline badge, named Makkah and Madinah hotels with Haram distance labels, remaining seats indicator (`X seats left`), and published per-person prices for Quad, Triple, and Double sharing.
- **AC-7**: Clicking `"Book Package"` opens the Group Booking Modal (`components/public/group-booking-modal.tsx`), allowing the pilgrim to select an active departure batch, choose their room sharing tier (`Quad`, `Triple`, `Double`), input passenger demographics (`Adults`, `Children`, `Infants`), and provide contact details (`Name`, `Phone/WhatsApp`, `City`, `Email`).
- **AC-8**: The booking modal validates that `Adults + Children <= remainingSeats` in real-time, blocking submission and displaying an informative warning if the requested party size exceeds available batch seats.
- **AC-9**: Submitting the group booking modal invokes `submitGroupBookingAction` in `app/actions/applications.ts`, creating an application with `source: 'group_booking'`, linking `groupPackageId` and `groupDepartureId`, recording `selectedRoomType`, generating reference code `ART-YYYY-XXXX`, and pre-filling the quote draft with the selected room tier price multiplied by passenger count.
- **AC-10**: The public Hajj consultation section (`components/public/hajj-inquiry-section.tsx` on `app/(public)/page.tsx#hajj-inquiry`) renders a luxury Haramain-inspired layout emphasizing dedicated Maktab guidance, licensed VIP tent allotments, and executive logistics, with zero instant-purchase or fixed checkout mechanisms.
- **AC-11**: The Hajj consultation form captures `Full Name`, `Phone / WhatsApp Number`, `City`, `Email`, `Preferred Hajj Category` (`Aziziyah Standard`, `Shisha / Naseem Near Jamarat`, `VIP Mina Camp / Majar Al Kabsh`), `Estimated Travellers`, and `Pilgrim Notes`, submitting via `submitHajjInquiryAction` as `source: 'hajj_inquiry'` and `presetMode: 'hajj_consultation'` with reference code generation and immediate confirmation.

## Options considered

### Option 1: Static marketing cards with generic contact form
Render static hardcoded package cards on the home page and direct all booking inquiries to a generic contact form.

**Pros**:
- Minimal development effort with zero administrative package management tools.

**Cons**:
- Fails to track real-time departure seat capacity, creating severe overbooking risks.
- Requires software engineers to edit code whenever package prices, hotel assignments, or departure dates change.
- Treats high-value Hajj inquiries identically to general customer feedback, causing lost VIP leads.

### Option 2 (Chosen): Dynamic PostgreSQL group package & batch CRUD with real-time seat capacity validation and dedicated VIP Hajj engine
Build full administrative CRUD for packages and departure batches in Neon PostgreSQL, wire dynamic public package cards with real-time seat availability bars and room-sharing selectors, and build a dedicated VIP Hajj consultation intake section.

**Pros**:
- Empowers agency staff to create new seasonal Umrah departures (e.g. Rabi-ul-Awwal, Rajab, Ramadan, Shaban) without code deployments.
- Prevents overbooking by enforcing `Adults + Children <= remainingSeats` at both client and server validation layers.
- Respects Saudi and Pakistani Hajj regulations: eliminates illegal instant checkout while capturing qualified VIP leads.
- Unifies group bookings and Hajj inquiries into the central application pipeline with full reference tracking.

**Cons**:
- Requires managing relational foreign keys across airlines, hotels, departure cities, packages, and batches.

### Option 3: Full automated e-commerce checkout for both Umrah packages and Hajj
Implement credit card checkout with instant seat confirmation for all packages, including Hajj.

**Pros**:
- Provides instant payment collection without manual quote review.

**Cons**:
- Strictly illegal for Hajj under Saudi Ministry of Hajj and Umrah regulations (which require Nusuk platform registration and governmental balloting).
- Exposes agency to severe financial penalties and chargebacks if airline group tickets cannot be issued in time.
- Completely misaligned with customer payment habits in Pakistan, where large travel transactions occur via bank wire or in-office pay order.

## Decision

**Chosen option**: Option 2: Dynamic PostgreSQL group package & batch CRUD with real-time seat capacity validation and dedicated VIP Hajj engine.

Al Ramlah Travels will implement dynamic group package and departure batch management in the Admin Portal, connect real-time seat availability to the public package showcase and booking modal, and build a dedicated VIP Hajj consultation engine.

**Implementation skills**: `shadcn` (`shadcn/ui`, `.agents/skills/shadcn/`) · `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-security-best-practices/`)

## Rationale

Group packages and Hajj inquiries represent over $60\%$ of agency revenues, but they operate under completely different business models. Group Umrah packages are volume-driven, requiring precise seat allotment tracking across multiple regional airports to maximize flight charter occupancy. Providing staff with an intuitive batch scheduler and pilgrims with live seat counts creates urgency while preventing costly overbooking.

Conversely, Hajj represents an ultra-high-ticket, highly regulated pilgrimage where personal consultations are mandatory. By honoring this regulatory boundary and providing a dedicated luxury intake form for VIP Hajj inquiries, Al Ramlah Travels positions itself as an elite, compliant travel authority.

## Feature design

### Component and route layout

```
app/admin/(dashboard)/groups/
├── page.tsx                            # Server Component: Group packages list & batch overview
components/admin/
├── group-package-form.tsx              # Create/edit package: Tier, hotels, pricing, inclusions, banner
├── departure-batch-dialog.tsx          # Schedule departure batch: City, dates, total seats, overrides
├── batch-occupancy-indicator.tsx       # Visual progress bar with open / filling_fast / sold_out badge
└── group-packages-data-table.tsx       # Filterable table of packages, batches, and active bookings
components/public/
├── group-packages-section.tsx          # Public showcase container on home page with tier & city tabs
├── group-package-card.tsx              # Card: Airline, hotels, distance, price per sharing tier, seats left
├── group-booking-modal.tsx             # Room tier radio, passenger counter, seat validator, contact form
└── hajj-inquiry-section.tsx            # Dedicated luxury VIP Hajj consultation intake section
```

### State transitions

```
1. Group Departure Batch Seat Occupancy Lifecycle:
   [ open ] (Available seats > 20% of capacity)
      │
      ▼ (Booked seats reach 80% of total capacity)
   [ filling_fast ]
      │
      ▼ (Booked seats == totalSeats)
   [ sold_out ]
      │
      ▼ (Departure date passed or manual admin toggle)
   [ closed ]

2. Group Booking Application Lifecycle:
   [ Form Submitted ] ──> [ pending_quote ] (Reference code generated; pre-filled room price)
                                │
                                └──(Admin approves booking)──> [ approved ]
                                                                   │
                                                                   ▼
                                    (Atomically increments group_departures.bookedSeats)
                                    (Updates batch status if threshold reached)
```

### API surface

| Action / Route | Type | Inputs | Outputs | Auth | Error Handling |
|---|---|---|---|---|---|
| `app/admin/(dashboard)/groups/page.tsx` | Page Component | None | Package list, batches, and capacity summary | Staff or Super Admin | Redirect to login if unauthorized |
| `saveGroupPackageAction` | Server Action | `payload: GroupPackageInput` | `{ success: true, packageId: string }` | Staff or Super Admin | 400 Validation, 401 Unauthorized |
| `saveGroupDepartureAction` | Server Action | `payload: GroupDepartureInput` | `{ success: true, batchId: string }` | Staff or Super Admin | 400 Validation, 409 Duplicate Batch Code |
| `deleteGroupPackageAction` | Server Action | `{ packageId: string }` | `{ success: true }` | Super Admin Only | 403 Forbidden, 409 Has Active Bookings |
| `submitGroupBookingAction` | Server Action | `payload: GroupBookingInput` | `{ success: true, referenceNumber: string, preFilledTotalPkr: number }` | Public | 400 Validation, 409 Sold Out / Insufficient Seats |
| `submitHajjInquiryAction` | Server Action | `payload: HajjInquiryInput` | `{ success: true, referenceNumber: string }` | Public | 400 Validation, 429 Rate Limited |

### Value sourcing

| Action / Surface | Value Produced or Displayed | Authoritative Source |
|---|---|---|
| Package Card | Starting Price | Minimum of `quadPricePkr`, `triplePricePkr`, and `doublePricePkr` |
| Package Card | Remaining Seats Badge | `batch.totalSeats - batch.bookedSeats` |
| Package Card | Batch Occupancy Status | Evaluated: `open`, `filling_fast` (if $\ge 80\%$), `sold_out` (if $100\%$) |
| Booking Modal | Available Batches | `group_departures` table where `packageId = X` and `status IN ('open', 'filling_fast')` |
| Booking Modal | Maximum Allowed Travellers | Clamped: `Math.min(10, remainingSeats)` |
| Group Booking Action | Draft Quote `grandTotalPkr` | Derived: `selectedRoomPricePkr * bedAndSeatCount` |
| Hajj Inquiry Action | Application `source` & `presetMode` | Fixed: `source = 'hajj_inquiry'`, `presetMode = 'hajj_consultation'` |
| Confirmation Screen | Reference Number | Generated: `ART-YYYY-XXXX` |

### Key invariants

1. **Seat Capacity Enforcement**: An application for a group departure batch cannot be submitted or approved if `bedAndSeatCount` exceeds available seats (`totalSeats - bookedSeats`). The booking modal enforces this on the client, and `submitGroupBookingAction` re-evaluates it inside a PostgreSQL transaction.
2. **Hajj Compliance Non-Checkout Rule**: The Hajj consultation module must never present an instant purchase button, package price tag, or room-tier checkout. It operates exclusively as a consultation callback request.
3. **Batch Code Uniqueness**: Batch codes (`group_departures.batchCode`) must be strictly unique across all packages (e.g. `UMR-2026-OCT-KHI-01`).
4. **Price Override Precedence**: If a departure batch specifies `quadPriceOverridePkr`, that price takes precedence over the parent package's `quadPricePkr` for bookings linked to that specific departure.
5. **Super Admin Delete Restriction**: Only `super_admin` users can delete group packages; standard `staff` accounts can create, edit, or toggle visibility, but cannot delete.

### Security model

- **Admin Package & Batch Operations**: Guarded by `requireAdmin()` for mutations and `requireSuperAdmin()` for package deletion.
- **Public Booking Validation**: Input payload is validated against `groupBookingSchema` using Zod, verifying that `packageId` and `departureId` exist, are active, and belong to each other.
- **Rate-Limiting on Inquiries**: Both group booking and Hajj consultation actions enforce IP-based rate limiting to prevent automated lead spam.

### Configuration required

No new external environment variables are required. Relies on existing `DATABASE_URL_POOLED` and `NEXT_PUBLIC_APP_URL`.

### Critical test scenarios

- **Happy path (Group Package Booking)**: Admin creates 15-day Gold Umrah Package; adds departure batch from Islamabad (`ISB`) with 30 total seats; visitor opens public site; views package card showing `"ISB Departure — 30 seats left"`; clicks `"Book Package"`; selects Quad sharing for 4 adults; modal validates $4 \le 30$; visitor submits contact info; application created with `source: 'group_booking'` and reference `ART-2026-C9D4`; admin opens application; marks `Approved`; batch booked seats increments from 0 to 4; remaining seats displays 26. Verifies **AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**.
- **Overbooking Prevention Guard**: A departure batch has 2 seats remaining; visitor attempts to submit a booking for 3 adults and 1 child (4 beds); modal displays error `"Only 2 seats remaining in this departure batch"`; if visitor bypasses client check, server action aborts transaction with `409 Conflict: Insufficient seats remaining`. Verifies **AC-4**, **AC-8**.
- **Automated Batch Status Progression**: Batch with 20 seats has 15 booked seats; admin approves a booking for 2 seats (total 17/20, $85\%$); batch status automatically flips to `filling_fast`; admin approves final 3 seats (total 20/20, $100\%$); batch status automatically flips to `sold_out`; public card updates badge to `"Sold Out"` and disables booking modal. Verifies **AC-3**, **AC-4**, **AC-6**.
- **Hajj VIP Consultation Flow**: Visitor navigates to `#hajj-inquiry`; fills VIP inquiry selecting `"VIP Mina Camp / Majar Al Kabsh"` for 6 estimated travellers; submits; system creates application with `source: 'hajj_inquiry'` and reference `ART-2026-H1J2`; inquiry displays in admin queue with distinctive gold Hajj Consultation badge and 24h SLA tracking. Verifies **AC-10**, **AC-11**.

## Build plan

The feature is constructed through an ordered four-milestone Tracer Bullet plan:

1. **Milestone 1: Admin Pre-Built Group Packages CRUD and inventory management**, satisfies **AC-1**
   - Create `app/admin/(dashboard)/groups/page.tsx` rendering package inventory table.
   - Build `GroupPackageForm` supporting tier, duration, Makkah/Madinah nights, airline linkage, hotel linkage, meal plans, sharing prices (Quad, Triple, Double), and highlights.
   - Implement `saveGroupPackageAction` and `deleteGroupPackageAction` in `app/actions/groups.ts`.

2. **Milestone 2: Admin Departure Batches scheduler and real-time occupancy monitor**, satisfies **AC-2**, **AC-3**, **AC-4**
   - Build `DepartureBatchDialog` in `components/admin/departure-batch-dialog.tsx` for scheduling batches with city pickers, dates, total seats, and price overrides.
   - Build `BatchOccupancyIndicator` visualizing remaining seats and automatic status badges (`open`, `filling_fast`, `sold_out`, `closed`).
   - Implement `saveGroupDepartureAction` enforcing unique batch codes.

3. **Milestone 3: Public Pre-Built Group Packages showcase, batch filters, and seat-validated booking modal**, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**
   - Build `GroupPackagesSection` in `components/public/group-packages-section.tsx` on `app/(public)/page.tsx#group-packages` with tier and city filter tabs.
   - Build `GroupPackageCard` displaying airline logo, hotel distances, room tier prices, and seats remaining progress bar.
   - Build `GroupBookingModal` with room sharing selection, demographic counters, and real-time seat availability validation (`Adults + Children <= remainingSeats`).
   - Implement `submitGroupBookingAction` in `app/actions/applications.ts` generating reference code and pre-filling draft quote.

4. **Milestone 4: Public VIP Hajj Consultation inquiry section and CRM integration**, satisfies **AC-10**, **AC-11**
   - Build `HajjInquirySection` in `components/public/hajj-inquiry-section.tsx` on `app/(public)/page.tsx#hajj-inquiry` featuring luxury Haramain styling and Maktab tent tier selection.
   - Implement `submitHajjInquiryAction` in `app/actions/applications.ts` saving as `source: 'hajj_inquiry'` and `presetMode: 'hajj_consultation'`.
   - Verify that Hajj inquiries display with dedicated tags and 24h SLA overdue tracking in the admin dashboard.

## Consequences

**Positive**:
- Provides high-converting commercial inventory for pilgrims seeking structured, cost-effective Umrah packages.
- Protects the agency from accidental overbooking through transactional seat capacity tracking.
- Fully complies with Saudi and Pakistani Hajj regulations by replacing risky e-commerce checkout with qualified VIP consultations.
- Integrates all package bookings and Hajj inquiries into the central application pipeline, simplifying staff workflows.

**Negative / tradeoffs**:
- Requires administrative discipline to schedule and update departure batches as flight blocks are confirmed.
- Hajj inquiries require manual staff callbacks rather than automated quote generation due to quota unpredictability.

**Neutral**:
- Price overrides at the batch level allow seasonal demand pricing without altering base package definitions.

## Follow-up

- [ ] Connect batch seat incrementing to Slice 3 (`Admin quoting worksheet`) when group booking applications are approved.
- [ ] Connect public package display to real seeded database records once Seed scripts run.

## References

**Project sources**:
- `AGENTS.md`: Stack definition, Next.js 16 conventions, and single luxury theme rules
- `docs/scope/scope.md`: Feature 9 scope requirements
- `docs/specs/0001-stack-and-architecture.md`: Next.js 16 App Router architecture
- `docs/specs/0002-data-model.md`: `group_packages`, `group_departures`, and `applications` schema
- `docs/specs/0003-design-system-and-ui-foundation.md`: Luxury theme tokens and layout shells
- `docs/specs/0006-admin-quoting-worksheet-and-status-tracker.md`: Status transitions and seat increment rules

**Practices & standards**:
- Ministry of Religious Affairs (MORA) Pakistan Hajj Policy Guidelines
- Saudi Ministry of Hajj and Umrah Nusuk Platform Regulations
- Real-time seat inventory reservation patterns and database concurrency protection
