# 0006. Admin Quoting Worksheet and Public Status Tracker

**Date**: 2026-10-17
**Status**: Proposed

## Summary

This specification defines the operational back office quoting engine and the public inquiry tracker for Al Ramlah Travels. Agency administrators can review incoming itineraries, calculate itemized pricing for volatile services, record payments, and dispatch quotes across WhatsApp, email, and printable vouchers. Prospective pilgrims can verify the live status of their inquiry using their reference code and phone number, viewing their itemized quotation once published.

## Context

Al Ramlah Travels operates on a high touch consultative model where flight fares, hotel allotments, and private vehicle tariffs fluctuate daily. Although government visa fees are predictable, offering instant automated checkout for complete custom packages creates significant commercial risk: supplier wholesale rates fluctuate during peak pilgrimage seasons, and airline seats require manual reservation. Consequently, incoming inquiries must be priced by agency ticketing staff within a dedicated worksheet.

Currently, quoting staff calculate numbers in offline spreadsheets and manually copy text snippets into WhatsApp. This manual workflow introduces severe operational friction:
1. Quotations lack standardized mathematical audit trails, leading to arithmetic mistakes and lost profit margins.
2. Status transitions between inquiry receipt, customer review, and deposit confirmation are uncoordinated, creating customer uncertainty and lost follow-up opportunities.
3. Group package seat allotments are not linked to application approvals, creating overbooking risks on fixed departure batches.
4. Pilgrims who submitted an inquiry have no self-service visibility into their request status, prompting repetitive phone calls and support inquiries.

To establish operational excellence, the platform requires a centralized Quoting Worksheet in the Admin Portal (`/admin/applications/[id]`) paired with a secure Public Request Status Tracker on the home page (`#track-status`). The worksheet must combine auto-calculated baseline costs (such as visa fees) with live supplier rates, enforce business validation on status transitions, automate group seat reservations upon approval, and produce multi-channel customer deliverables (WhatsApp summaries, emails, and printable official vouchers).

## Requirements

**User stories**:
- As an agency quoting agent, I want a single application detail view where I can inspect every detail of the pilgrim's itinerary alongside an interactive quoting worksheet so that I can compute accurate itemized prices quickly.
- As an agency administrator, I want the visa cost pre-filled automatically from the application's duration calculation while retaining the ability to adjust line items or apply customer discounts so that our pricing is fast yet flexible.
- As an agency manager, I want status changes strictly governed so that staff cannot mark an inquiry as `Quoted` or `Approved` without a valid non-zero quote, and approving a group booking automatically reserves seats on the linked departure batch.
- As an agency quoting agent, I want one-click quote dispatch tools for WhatsApp, email, and printable PDF vouchers so that I can deliver professional branded quotations to pilgrims instantly.
- As an intending pilgrim, I want to enter my reference number and phone number on the website so that I can check the progress of my inquiry and view our official itemized quotation.

**Acceptance criteria**:
- **AC-1**: The application detail page at `app/admin/(dashboard)/applications/[id]/page.tsx` implements the Next.js 16 asynchronous request contract (`const { id } = await params`) and renders the complete customer submission: demographics, stay breakdown, room allocation, transport segments, and selected ziyarat sites.
- **AC-2**: The Live Quoting Worksheet form (`components/admin/quote-worksheet-form.tsx`) pre-fills `visaTotalPkr` from `application.calculatedVisaTotalPkr` when `includeVisa` is true, providing live PKR inputs for `flightsTotalPkr`, `makkahHotelTotalPkr`, `madinahHotelTotalPkr`, `transportTotalPkr`, `ziyaratTotalPkr`, and `discountPkr`.
- **AC-3**: The worksheet dynamically computes and displays `grandTotalPkr` in real-time (`visa + flights + makkah + madinah + transport + ziyarat - discount`) using tabular numbers (`tabular-nums`), rejecting negative total amounts.
- **AC-4**: The worksheet manages payment tracking, including `paymentStatus` (`unpaid`, `partially_paid`, `paid_in_full`), `amountPaidPkr`, dynamic remaining balance computation, customer-facing notes (`quoteNotesCustomer`), and private staff notes (`internalNotesAdmin`).
- **AC-5**: The 5-stage status pipeline controls (`pending_quote` → `quoted` → `approved` → `rejected` / `cancelled`) enforce validation guards: transitioning to `quoted` or `approved` strictly requires a saved quote with `grandTotalPkr > 0`.
- **AC-6**: When an application with `source === 'group_booking'` transitions to `approved`, the server action automatically increments `bookedSeats` on the linked `group_departures` record inside a database transaction, automatically updating the batch status to `filling_fast` (if $\ge 80\%$ full) or `sold_out` (if $100\%$ full).
- **AC-7**: The worksheet provides one-click dispatch actions: **Send Itemized Quote via WhatsApp** (opening `https://wa.me/{phone}` with a pre-formatted luxury Markdown breakdown), **Email Quote**, and **Print / Download Official Voucher** (`/admin/applications/[id]/voucher`).
- **AC-8**: The printable voucher view at `/admin/applications/[id]/voucher` renders a high-resolution, print-optimized document with the agency crest, gold borders, passenger manifest, hotel stay confirmations, transport schedule, and itemized financial summary.
- **AC-9**: The Public Request Status Tracker component (`components/public/status-tracker.tsx`) accepts `Reference Number` and `Phone / WhatsApp Number`, invoking `lookupApplicationStatusAction(referenceNumber, phone)`.
- **AC-10**: The lookup action normalizes phone number digits (removing spaces, dashes, and international prefixes) to authenticate the inquiry, returning sanitized status and itinerary data when `pending_quote`, and returning the full itemized quote breakdown with a direct WhatsApp approval button once `quoted` or `approved`.

## Options considered

### Option 1: Static PDF quote generation via email only
Generate an offline PDF on the server and email it to the pilgrim as an attachment, with no interactive worksheet or web status tracker.

**Pros**:
- Traditional agency workflow familiar to corporate travel desks.

**Cons**:
- Severe communication delay: in Pakistan and diaspora markets, email open rates are under 20%, whereas WhatsApp engagement exceeds 90%.
- Pilgrims cannot track live progress or review quotes without downloading attachments.
- Lacks dynamic seat allocation integration with group departure batches.

### Option 2 (Chosen): Live quoting worksheet with 5-stage state machine, automated seat allotment, and two-factor public tracker
Implement an integrated admin worksheet that auto-calculates grand totals, validates lifecycle state changes, updates group batch inventory atomically, generates one-click WhatsApp summaries, and powers a public two-factor status lookup.

**Pros**:
- Eliminates quoting errors through live tabular calculations and pre-filled visa figures.
- Matches regional user behavior: one-click WhatsApp dispatch connects directly to customer phones.
- Two-factor lookup (reference + phone) protects customer privacy without forcing pilgrims to create passwords.
- Atomic group seat allotment prevents accidental overbooking on fixed departure batches.

**Cons**:
- Requires coordinating transactional updates across applications, quotes, and group departure inventory.

### Option 3: Automated instant supplier pricing API integration
Connect live global distribution system (GDS) APIs to automatically price flights and hotels without human staff intervention.

**Pros**:
- Zero staff quoting labor for standard commercial itineraries.

**Cons**:
- Saudi wholesale hotel suppliers and local transport operators in Makkah do not offer reliable real-time booking APIs for Pakistani private travel agencies.
- High API subscription costs and complex cancellation penalty liabilities.
- Conflicts with the agency's luxury bespoke service model.

## Decision

**Chosen option**: Option 2: Live quoting worksheet with 5-stage state machine, automated seat allotment, and two-factor public tracker.

Al Ramlah Travels will implement an interactive Quoting Worksheet in the Admin Portal paired with a public two-factor status tracker and one-click WhatsApp dispatch.

**Implementation skills**: `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-security-best-practices/`) · `shadcn` (`shadcn/ui`, `.agents/skills/shadcn/`)

## Rationale

In high-intent pilgrimage travel, speed and personal trust dictate conversion. Prospective pilgrims expect fast, transparent quotes delivered directly to WhatsApp. Option 2 enables staff to price an inquiry in less than two minutes: the visa cost is already pre-computed, hotel nights and room splits are clearly laid out, and the agent only needs to enter supplier wholesale rates and profit margins. 

Enforcing transactional seat increments upon group booking approval eliminates the persistent agency headache of overbooking fixed departures. The public tracker provides immediate reassurance to pilgrims who have submitted an inquiry, eliminating unnecessary status check phone calls.

## Feature design

### Component and route layout

```
app/admin/(dashboard)/applications/[id]/
├── page.tsx                            # Server Component: Async params, itinerary view, worksheet shell
└── voucher/
    └── page.tsx                        # Clean print-optimized voucher view with print button & styling
components/admin/
├── quote-worksheet-form.tsx            # Live financial inputs, dynamic grand total, notes & payment status
├── application-itinerary-card.tsx      # Comprehensive itinerary view (stays, transport, demographics)
├── application-status-controller.tsx   # 5-stage pipeline transition buttons with validation guards
└── quote-dispatch-bar.tsx              # WhatsApp quote generator, Email trigger, and Voucher link
components/public/
└── status-tracker.tsx                  # Public reference + phone lookup widget on home page
```

### State transitions

```
1. Application Lifecycle State Machine:
   [ pending_quote ]
          │
          ├──(Admin enters rates & clicks "Save & Mark Quoted")
          │  [Guard: grandTotalPkr > 0]
          ▼
      [ quoted ]
         /      \
        /        \
       ▼          ▼
  [ approved ]   [ rejected ] / [ cancelled ]
       │
       └──(If source == 'group_booking') ──> Atomically increment group_departures.bookedSeats
                                             If bookedSeats >= totalSeats ──> batch status = 'sold_out'
                                             Else if bookedSeats / totalSeats >= 0.8 ──> batch status = 'filling_fast'

2. Quote Payment State Transitions:
   [ unpaid ] ──(0 < amountPaidPkr < grandTotalPkr)──> [ partially_paid ] ──(amountPaidPkr >= grandTotalPkr)──> [ paid_in_full ]
```

### API surface

| Action / Route | Type | Inputs | Outputs | Auth | Error Handling |
|---|---|---|---|---|---|
| `app/admin/(dashboard)/applications/[id]/page.tsx` | Page Component | `params: Promise<{ id: string }>` | Full application view, stays, segments, quotes | Staff or Super Admin | 404 if application ID not found |
| `saveApplicationQuoteAction` | Server Action | `payload: QuoteWorksheetInput` | `{ success: true, quoteId: string, grandTotalPkr: number }` | Staff or Super Admin | 400 Validation, 401 Unauthorized |
| `updateApplicationStatusAction` | Server Action | `{ applicationId: string, newStatus: ApplicationStatus, notes?: string }` | `{ success: true, previousStatus, newStatus }` | Staff or Super Admin | 400 Guard Violation (e.g. Quoted with 0 total), 409 Sold Out |
| `lookupApplicationStatusAction` | Server Action | `{ referenceNumber: string, phone: string }` | `{ success: true, application: SanitizedApplicationView, quote?: SanitizedQuoteView }` | Public | 404 Reference Not Found, 401 Phone Verification Mismatch |
| `app/admin/(dashboard)/applications/[id]/voucher/page.tsx` | Print Route | `params: Promise<{ id: string }>` | Branded printable voucher HTML | Staff or Super Admin | 404 Not Found, redirect to login if unauthenticated |

### Value sourcing

| Action / Surface | Value Produced or Displayed | Authoritative Source |
|---|---|---|
| Quoting Worksheet | Pre-filled `visaTotalPkr` | `applications.calculatedVisaTotalPkr` (editable override) |
| Quoting Worksheet | `grandTotalPkr` | Derived: `visaTotalPkr + flightsTotalPkr + makkahHotelTotalPkr + madinahHotelTotalPkr + transportTotalPkr + ziyaratTotalPkr - discountPkr` |
| Quoting Worksheet | Remaining Balance | Derived: `Math.max(0, grandTotalPkr - amountPaidPkr)` |
| Status Controller | `quotedAt` timestamp | Server timestamp (`new Date()`) set upon transition to `quoted` |
| Status Controller | `approvedAt` timestamp | Server timestamp (`new Date()`) set upon transition to `approved` |
| Group Batch Sync | `group_departures.bookedSeats` | Derived: `currentBookedSeats + application.bedAndSeatCount` |
| Group Batch Sync | `group_departures.status` | Derived: Evaluated against `totalSeats` and `bookedSeats` |
| WhatsApp Dispatch | Message Payload Text | Formatted template containing reference code, passenger names, itemized lines, total PKR, and validity |
| Public Tracker | Sanitized Status View | `applications.status`, dates, city sequence, and hotel names |
| Public Tracker | Published Quote Breakdown | `application_quotes` line items (rendered only when status is `quoted` or `approved`) |

### Key invariants

1. **Next.js 16 Asynchronous Contract**: In `app/admin/(dashboard)/applications/[id]/page.tsx`, `params` is strictly an asynchronous Promise that must be awaited before accessing `id`.
2. **Quotation Transition Guards**: An application cannot transition to `quoted` or `approved` unless a saved `application_quotes` record exists with `grandTotalPkr > 0`. Transitioning back to `pending_quote` clears `quoteSentAt`.
3. **Atomic Group Seat Management**: When approving a `group_booking` application, the increment of `bookedSeats` on `group_departures` and the status transition of `applications` must execute inside a single database transaction. If available seats are insufficient, the transaction aborts with a `409 Conflict (Sold Out)` error.
4. **Two-Factor Phone Authentication**: The public status tracker verifies caller identity by matching the normalized numeric digits of the submitted phone number against `applications.customerPhone` or `applications.customerWhatsapp` (stripping spaces, parentheses, hyphens, and leading zeros).
5. **Voucher Print Layout**: The voucher route operates with `@media print` CSS rules, suppressing navigation bars, sidebars, and action buttons to produce a pristine single or multi-page printed document.
6. **Monetary Precision**: All financial fields (`visaTotalPkr`, `flightsTotalPkr`, `makkahHotelTotalPkr`, `madinahHotelTotalPkr`, `transportTotalPkr`, `ziyaratTotalPkr`, `discountPkr`, `grandTotalPkr`, `amountPaidPkr`) are non-negative whole integers in Pakistani Rupees (PKR).

### Security model

- **Admin Authorization**: The application detail page, quote worksheet mutations, status transitions, and printable voucher views require an active session with role `super_admin` or `staff`.
- **Public Tracker Data Sanitization**: `lookupApplicationStatusAction` never exposes internal staff notes (`internalNotesAdmin`), supplier profit margins, or assigned staff user IDs. Only customer-facing quote notes (`quoteNotesCustomer`), itemized retail figures, and travel dates are returned.
- **Lookup Rate Limiting**: The public tracker endpoint is rate-limited by IP address to prevent brute-force reference number enumeration.

### Configuration required

No new external environment variables are required. Relies on existing `DATABASE_URL_POOLED` and `NEXT_PUBLIC_APP_URL`.

### Critical test scenarios

- **Happy path (Pricing, Quoting, and WhatsApp Dispatch)**: Quoting agent opens `/admin/applications/[id]`; views customer's 14-day itinerary (4 adults, 2 rooms); worksheet pre-fills visa cost; agent enters flight and hotel supplier rates; grand total updates instantly to PKR 1,850,000; agent clicks `"Save & Mark Quoted"`; application status transitions to `quoted`; agent clicks `"Send Quote via WhatsApp"`; opens WhatsApp with pre-composed itemized quote; pilgrim opens public tracker on home page; enters reference number and phone; views published quotation with WhatsApp approval link. Verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-7**, **AC-9**, **AC-10**.
- **Quote Transition Guard Enforcement**: Quoting agent attempts to click `"Mark Quoted"` on an application with zero entered prices; action is blocked with error `"Cannot quote an application with a grand total of PKR 0. Please enter itemized rates."` Verifies **AC-5**.
- **Group Booking Seat Inventory Sync**: Group package departure batch has 2 seats remaining; an application for 4 seats is reviewed; admin attempts to mark it `Approved`; transaction detects `bookedSeats + 4 > totalSeats`; transaction aborts with error `"Insufficient seats remaining in departure batch (2 available, 4 requested)"`; batch status automatically sets to `sold_out`. Verifies **AC-6**.
- **Public Tracker Phone Verification**: User enters reference number `ART-2026-X1Y2` with incorrect phone number; server returns error `"Application not found or phone number does not match records"`; user enters correct phone number with different formatting (`+92 300 1234567` vs `03001234567`); phone normalizer matches digits; server returns full application status and quote breakdown. Verifies **AC-9**, **AC-10**.
- **Printable Voucher Rendering**: Admin navigates to `/admin/applications/[id]/voucher`; page renders luxury Haramain emerald and gold header, customer passenger manifest, confirmed hotel names, transport legs, and itemized financial summary; browser print dialog produces clean vector document without sidebar or navigation elements. Verifies **AC-8**.

## Build plan

The feature is constructed through an ordered four-milestone Tracer Bullet plan:

1. **Milestone 1: Admin application detail view and Next.js 16 async params resolution**, satisfies **AC-1**
   - Create `app/admin/(dashboard)/applications/[id]/page.tsx` awaiting asynchronous `params`.
   - Build `ApplicationItineraryCard` rendering demographics, travel dates, hotel stays (room splits, meal plans), transport sectors (vehicles, pickup times), and ziyarat places.
   - Fetch linked relations: `departureCity`, `preferredAirline`, `assignedStaff`, `hotelStays`, `transportSegments`, and `quotes`.

2. **Milestone 2: Interactive Live Quoting Worksheet form and real-time grand total arithmetic**, satisfies **AC-2**, **AC-3**, **AC-4**
   - Create Zod schema `quoteWorksheetSchema` in `lib/validations/quote.ts`.
   - Build `QuoteWorksheetForm` in `components/admin/quote-worksheet-form.tsx` with pre-filled visa total and live inputs for flights, hotels, transport, ziyarat, and discount.
   - Implement real-time mathematical calculation of `grandTotalPkr` and remaining balance with `tabular-nums`.
   - Implement `saveApplicationQuoteAction` in `app/actions/quotes.ts` updating `application_quotes` and updating `applications.updatedAt`.

3. **Milestone 3: 5-stage status pipeline controller, transition guards, and group departure seat sync**, satisfies **AC-5**, **AC-6**
   - Build `ApplicationStatusController` in `components/admin/application-status-controller.tsx`.
   - Implement `updateApplicationStatusAction` in `app/actions/applications.ts` enforcing the non-zero quote guard.
   - Add atomic transaction updating `group_departures.bookedSeats` and auto-flipping batch status (`open` → `filling_fast` → `sold_out`) upon group booking approval.

4. **Milestone 4: Multi-channel quote dispatch (WhatsApp, Email, Printable Voucher) and Public Status Tracker**, satisfies **AC-7**, **AC-8**, **AC-9**, **AC-10**
   - Build `QuoteDispatchBar` with WhatsApp Markdown message generator and Email trigger.
   - Create print-optimized voucher view at `app/admin/(dashboard)/applications/[id]/voucher/page.tsx`.
   - Build `StatusTracker` widget in `components/public/status-tracker.tsx` on `app/(public)/page.tsx#track-status`.
   - Implement `lookupApplicationStatusAction` with phone digit normalization, returning sanitized status and published quote breakdown.

## Consequences

**Positive**:
- Replaces disconnected manual spreadsheets with a fast, type-safe administrative quoting engine.
- Bridges the communication gap with prospective pilgrims via one-click WhatsApp dispatch.
- Enforces strict business integrity: quotes cannot be dispatched with zero prices, and group departures cannot be overbooked.
- Provides customer peace of mind through a secure, self-service public status tracker.

**Negative / tradeoffs**:
- Quoting staff must manually input supplier rates for flights and hotels rather than relying on automated GDS feeds (aligned with Pakistani market reality).
- Printing vouchers relies on browser print engines; varying printer drivers may require print preview margin adjustments.

**Neutral**:
- The public tracker does not require customer account creation, relying on reference code and phone number verification.

## Follow-up

- [ ] Connect transactional SMS/WhatsApp notification webhooks once a third-party gateway (such as Twilio or Infobip) is selected in post-launch phases.
- [ ] Implement Slice 4 (`Dynamic inventory & catalog management`) to allow admins to manage the underlying hotel and vehicle tariffs.

## References

**Project sources**:
- `AGENTS.md`: Stack definition, Next.js 16 conventions, and single luxury theme rules
- `docs/scope/scope.md`: Feature 7 scope requirements
- `docs/specs/0001-stack-and-architecture.md`: Next.js 16 App Router asynchronous params contract
- `docs/specs/0002-data-model.md`: `applications`, `application_quotes`, and `group_departures` schema
- `docs/specs/0003-design-system-and-ui-foundation.md`: Status badge color tokens and tabular typography
- `docs/specs/0004-core-quote-loop-and-admin-sign-in.md`: Application intake and initial draft quote creation

**Practices & standards**:
- Next.js 16 Dynamic Route Segment specification (`params` as Promise)
- Single-currency integer monetary storage and rounding standards
- Two-factor non-account inquiry lookup security model
