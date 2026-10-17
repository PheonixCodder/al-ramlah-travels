# 0004. Core Quote Loop and Admin Sign-In

**Date**: 2026-10-17
**Status**: Proposed

## Summary

Al Ramlah Travels requires a functioning walking skeleton connecting prospective pilgrim inquiries to the administrative back office. This specification designs the core quote submission action, the administrative authentication sign in interface, and the central inquiry listing table. Pilgrims receive a collision safe tracking reference upon submission, and authenticated staff can immediately review inquiries with automated twenty four hour service level agreement alerts.

## Context

Al Ramlah Travels currently processes Umrah leads manually via disconnected phone calls, paper slips, and informal WhatsApp chats. This ad hoc approach causes lost inquiries, delayed response times, and zero visibility into operational backlog. To establish a reliable digital foundation, the platform needs an end to end vertical walking skeleton that unites the public visitor experience, database persistence, and back office operations.

The core workflow spans three distinct boundaries:
1. Prospective pilgrims submitting custom travel inquiries on the public home page must receive immediate confirmation with a human readable tracking code.
2. Administrative staff and agency executives must authenticate securely using their corporate credentials with strict role based access control.
3. Quoting staff must access an organized, real time applications queue that flags aging inquiries before they breach the agency twenty four hour service level agreement.

Developing isolated frontend prototypes without database connectivity or building an administrative dashboard disconnected from real customer submissions leads to painful integration rewrites. By locking the contracts for the submission server action, Better Auth credential authentication, and the administrative inquiry table in a single vertical slice, the engineering team proves the entire data flow from visitor form to database row to staff dashboard.

## Requirements

**User stories**:
- As an intending pilgrim, I want to submit my travel inquiry on the public site and receive an instant reference number so that I can track my quote progress and follow up on WhatsApp.
- As an agency administrator or staff member, I want to sign in securely with email and password so that I can access the operational dashboard and view pending applications.
- As an agency quoting agent, I want to filter and search incoming applications with prominent indicators for inquiries awaiting action over twenty four hours so that our team meets our customer service commitments.
- As a software engineer, I want public submissions validated strictly with Zod and written in a single database transaction so that partial or corrupt records never enter the system.

**Acceptance criteria**:
- **AC-1**: The admin sign-in page at `app/admin/(auth)/login/page.tsx` renders a luxury Haramain emerald and gold card with email and password inputs, error alerts, and demo credential quick-fill helpers in non-production environments.
- **AC-2**: Authentication is processed via `authClient.signIn.email`, verifying that the user account exists, is active (`isActive === true`), and possesses an administrative role (`role` in `['super_admin', 'staff']`), redirecting unauthenticated or unauthorized users with appropriate feedback.
- **AC-3**: Public submission Server Action `submitCustomApplicationAction` in `app/actions/applications.ts` validates payloads against `customApplicationSchema` using Zod, rejecting invalid or malformed data with detailed field errors.
- **AC-4**: The server action computes KSA duration days and determines the visa tier (`short_term` for 30 days or fewer, `long_term` for greater than 30 days) server-side via `calculateVisaTierAndCost`, pre-filling the visa total and preventing client price tampering.
- **AC-5**: The server action generates a collision-safe, human-readable reference number formatted as `ART-YYYY-XXXX` (where `YYYY` is the current Gregorian year and `XXXX` is a randomized alphanumeric code) and persists `applications`, `application_hotel_stays`, `application_transport_segments`, and an initial draft `application_quotes` record inside a PostgreSQL transaction.
- **AC-6**: The server action returns a structured response containing `{ success: true, referenceNumber, calculatedVisaTotalPkr, isVisaOnly, whatsappShareUrl }` allowing the client to render immediate confirmation and one-click WhatsApp handoff.
- **AC-7**: The admin applications page at `app/admin/(dashboard)/applications/page.tsx` renders a server-component data table with search query capabilities (matching reference number, customer name, phone, or city) and filter tabs for application status (`All`, `Pending Quote`, `Quoted`, `Approved`, `Rejected`, `Cancelled`) and intake source (`Custom Builder`, `Group Booking`, `Hajj Inquiry`).
- **AC-8**: The applications table calculates the elapsed time since inquiry creation against the agency 24-hour threshold, displaying a prominent, pulsing amber/red SLA overdue warning badge on any `pending_quote` application older than 24 hours.
- **AC-9**: Each application row provides a direct navigational link to its detailed quote worksheet at `/admin/applications/[id]`, displaying customer contact details, passenger counts (`bedAndSeatCount` and `totalPassportCount`), destination cities, and submission timestamp.

## Options considered

### Option 1: Decoupled client mockups with mock in-memory store
Build the public form and admin dashboard with local state or in-memory arrays before wiring PostgreSQL and Better Auth.

**Pros**:
- Fast visual feedback on user interface components without configuring database connections.

**Cons**:
- Delays integration risk to later phases, often discovering schema and authentication incompatibilities late.
- Fails to validate transaction atomicity between applications, hotel stays, transport segments, and quote drafts.
- Incompatible with the project's Tracer Bullet methodology.

### Option 2 (Chosen): End-to-end vertical tracer bullet walking skeleton
Implement a complete vertical slice spanning public submission Server Action, Neon PostgreSQL transaction, Better Auth credential authentication, and the admin applications queue table.

**Pros**:
- Proves database connectivity, schema relations, validation contracts, and session authentication from day one.
- Validates the core business invariant: automatic server-side visa tier determination and quote draft creation.
- Provides immediate operational utility: administrators can review real submitted inquiries.

**Cons**:
- Requires coordinating database migrations, seed data, and auth cookies in the very first feature slice.

### Option 3: Generic BaaS API with client-side querying
Expose direct PostgreSQL tables via client-side Supabase or Firebase libraries, bypassing Next.js Server Actions.

**Pros**:
- Offloads backend endpoint authoring to third-party client libraries.

**Cons**:
- Violates repository architecture requiring Next.js 16 Server Actions, Neon PostgreSQL, and Better Auth.
- Exposes internal table structures to client browsers and complicates atomic multi-table business logic.

## Decision

**Chosen option**: Option 2: End-to-end vertical tracer bullet walking skeleton.

Al Ramlah Travels will build the complete quote loop and admin sign-in as an integrated vertical tracer bullet, connecting the public submission action, Neon PostgreSQL transaction, Better Auth credential authentication, and the admin applications table.

**Implementation skills**: `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-security-best-practices/`) · `create-auth` (`better-auth/skills`, `.agents/skills/create-auth/`) · `shadcn` (`shadcn/ui`, `.agents/skills/shadcn/`)

## Rationale

The Tracer Bullet approach requires each feature slice to pierce through every layer of the system: database, domain logic, server actions, and user interface. By building the walking skeleton first, we prove that:
1. Neon PostgreSQL transactions properly coordinate `applications`, child stays, child transport segments, and draft quotes.
2. Better Auth session cookies function predictably across Next.js 16 Server Components and `proxy.ts`.
3. The server-side domain calculation for visa duration tiers and pricing functions deterministically without client tampering.
4. Quoting staff can monitor incoming requests in real time with automatic 24-hour service level agreement alerts.

## Feature design

### Data model sketch

This slice integrates with the authoritative tables established in Spec 0002 (`docs/specs/0002-data-model.md`):

```
[user]
- id: text (PK)
- email: varchar(255) (unique)
- role: enum ('super_admin', 'staff')
- isActive: boolean (default true)
- name: text

[session]
- id: text (PK)
- userId: text (FK -> user.id)
- token: text (unique)
- expiresAt: timestamp with time zone

[applications]
- id: uuid (PK)
- referenceNumber: varchar(32) (unique, format 'ART-YYYY-XXXX')
- source: enum ('custom_builder', 'group_booking', 'hajj_inquiry')
- status: enum ('pending_quote', 'quoted', 'approved', 'rejected', 'cancelled')
- presetMode: enum ('complete_umrah', 'visa_only', 'hotels_only', 'transport_only', 'custom_mix', ...)
- customerName, customerPhone, customerWhatsapp, customerCity, customerEmail, specialRequests
- adults, children, infants, totalPassportCount, bedAndSeatCount
- includeVisa, includeFlights, includeHotels, includeTransport, includeZiyarat
- ksaArrivalDate, ksaDepartureDate, totalKsaDays, calculatedVisaTier, lockedVisaRatePerPersonPkr, calculatedVisaTotalPkr
- citySequence, entryAirport, exitAirport, departureCityId, flightRouteType, cabinClass, preferredAirlineId
- assignedStaffUserId: text (FK -> user.id, nullable)
- createdAt, updatedAt

[application_hotel_stays]
- id: uuid (PK)
- applicationId: uuid (FK -> applications.id, cascade delete)
- stayOrder: integer (1, 2, 3)
- city: enum ('makkah', 'madinah')
- hotelId: uuid (FK -> hotels.id)
- checkInDate, checkOutDate, nights
- roomCategory: enum ('shared', 'private')
- sharedRoomType, privateRoomAllocation (jsonb)
- mealPlan: enum ('room_only', 'breakfast', 'half_board', 'full_board')

[application_transport_segments]
- id: uuid (PK)
- applicationId: uuid (FK -> applications.id, cascade delete)
- segmentOrder: integer
- sectorId: uuid (FK -> transport_sectors.id)
- serviceType: enum ('private', 'shared')
- vehicleId: uuid (FK -> vehicles.id)
- vehicleQuantity: integer
- scheduledDate, pickupTime, notes

[application_quotes]
- id: uuid (PK)
- applicationId: uuid (FK -> applications.id, cascade delete)
- version: integer (default 1)
- visaTotalPkr: integer (pre-filled from applications.calculatedVisaTotalPkr)
- flightsTotalPkr, makkahHotelTotalPkr, madinahHotelTotalPkr, transportTotalPkr, ziyaratTotalPkr: integer (default 0)
- discountPkr, grandTotalPkr: integer
- paymentStatus: enum ('unpaid', 'partially_paid', 'paid_in_full')
- quotedByUserId: text (FK -> user.id, nullable)
- validUntil: timestamp with time zone
```

### State transitions

Application intake and review lifecycle:

```
[ Visitor Submits Form ]
           │
           ▼
[ `pending_quote` ] ──(Over 24 hours elapsed)──> [ `pending_quote` (Pulsing SLA Overdue) ]
           │
           ├────────────────────────────(Admin reviews & enters quote)
           ▼
       [ `quoted` ]
      /            \
     /              \
    ▼                ▼
[ `approved` ]    [ `rejected` ] / [ `cancelled` ]
```

### API surface

| Surface / Function | Type | Inputs | Outputs | Auth | Error Handling |
|---|---|---|---|---|---|
| `app/admin/(auth)/login/page.tsx` | Page Component | Email, Password | Interactive login card | Public | Renders inline error toast / alert on invalid credentials or inactive account |
| `authClient.signIn.email` | Better Auth Client SDK | `{ email, password, callbackURL: '/admin/applications' }` | Session token & user record | Public | 401 Unauthorized, 403 Inactive account |
| `submitCustomApplicationAction` | Server Action (`app/actions/applications.ts`) | `payload: CustomApplicationInput` | `{ success: true, referenceNumber: string, calculatedVisaTotalPkr: number, isVisaOnly: boolean, whatsappShareUrl: string }` | Public | 400 Zod validation errors, 500 DB transaction abort |
| `app/admin/(dashboard)/applications/page.tsx` | Server Component Page | `searchParams: { q?: string, status?: string, source?: string, page?: string }` | Filterable applications data table with SLA alerts | Staff or Super Admin (`requireAdmin()`) | Redirects to `/admin/login` if session missing or expired |

### Value sourcing

| Action / Surface | Value Produced or Displayed | Authoritative Source |
|---|---|---|
| Public Submission | `referenceNumber` | Server generated: `ART-` + current Gregorian year + `-` + 4 uppercase alphanumeric characters (`ART-2026-X7K2`) |
| Public Submission | `totalPassportCount` | Derived: `adults + children + infants` |
| Public Submission | `bedAndSeatCount` | Derived: `adults + children` |
| Public Submission | `calculatedVisaTier` | Derived: `calculateVisaTierAndCost(ksaArrivalDate, ksaDepartureDate)` |
| Public Submission | `calculatedVisaTotalPkr` | `pricePkr` from `visa_rates` table $\times$ `totalPassportCount` |
| Public Submission | Initial `application_quotes.visaTotalPkr` | Pre-filled directly from `applications.calculatedVisaTotalPkr` |
| Public Confirmation | `whatsappShareUrl` | Constructed: `https://wa.me/{agencySettings.primaryWhatsapp}?text={encodedMessage}` |
| Admin Applications Table | 24h SLA Overdue Warning | Evaluated: `application.status === 'pending_quote' && (Date.now() - createdAt.getTime()) > (24 * 3600 * 1000)` |
| Admin Applications Table | Destination Summary | Concatenated city labels from `application_hotel_stays` or `citySequence` |

### Key invariants

1. **Atomic Lead Persistence**: An application submission must insert into `applications`, `application_hotel_stays`, `application_transport_segments`, and `application_quotes` within a single database transaction. If any child insertion fails, the entire transaction rolls back.
2. **Server-Side Visa Rate Enforcement**: The client form cannot declare the visa price. The server action fetches authoritative visa rates from `visa_rates`, executes `calculateVisaTierAndCost`, and records `calculatedVisaTier` and `calculatedVisaTotalPkr`.
3. **Reference Number Uniqueness**: Reference numbers are strictly unique across the system. In the event of a collision, the generator executes up to three retries before throwing an error.
4. **Administrative Access Isolation**: Only users with `isActive === true` and `role` in `['super_admin', 'staff']` can authenticate at `/admin/login` or access `/admin/applications`.
5. **Monetary Integer Integrity**: All currency values (`calculatedVisaTotalPkr`, `visaTotalPkr`, `grandTotalPkr`) are stored as whole non-negative integers representing Pakistani Rupees.

### Security model

- **Public Submission Protection**: The public submission Server Action validates all fields with strict Zod types, rejecting unexpected properties. Rate-limiting is applied by client IP address to prevent spam lead injections.
- **Admin Authentication Hardening**: Better Auth handles credential hashing (bcrypt/argon2), session generation, and cookie management (`SameSite=Lax`, `HttpOnly`, `Secure`).
- **Session Verification in Next.js 16**: Defense in depth is maintained via `proxy.ts` (edge cookie redirect), `app/admin/(dashboard)/layout.tsx` (server-side session cryptographic verification via `auth.api.getSession`), and Server Action authorization guards (`requireAdmin()`).

### Configuration required

- `DATABASE_URL_POOLED`: Managed connection string for Neon Serverless PostgreSQL.
- `DATABASE_URL`: Direct unpooled connection string for migrations.
- `BETTER_AUTH_SECRET`: Secret key for session token signing (minimum 32 characters).
- `BETTER_AUTH_URL`: Canonical application URL for auth callback resolution.
- `NEXT_PUBLIC_APP_URL`: Public base URL for constructing external share links.

### Critical test scenarios

- **Happy path (Submission to Admin Visibility)**: Intending pilgrim submits inquiry on public home page; server action generates reference number `ART-2026-A1B2` and inserts records into Neon PostgreSQL; admin signs in at `/admin/login` using credentials; redirected to `/admin/applications`; sees new application row with reference `ART-2026-A1B2`, status `pending_quote`, and correct passenger counts. Verifies **AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-6**, **AC-7**, **AC-9**.
- **Server Visa Tier Validation**: Pilgrim submits travel dates spanning 35 days with 3 adults; server calculates `long_term` tier; applies long-term rate ($3 \times \text{long-term price}$) and stores in `applications` and draft `application_quotes`, ignoring any altered client price payload. Verifies **AC-4**, **AC-5**.
- **SLA Overdue Indicator**: Database contains an application with `status = 'pending_quote'` created 26 hours ago; applications table displays prominent pulsing red SLA overdue badge; application created 2 hours ago displays standard amber pending badge. Verifies **AC-8**.
- **Auth and Role Enforcement**: Inactive staff account attempts login; receives `"Your account is disabled. Please contact the administrator."`; authenticated staff account accesses `/admin/applications` successfully; non-authenticated visitor visiting `/admin/applications` is redirected to `/admin/login`. Verifies **AC-1**, **AC-2**.

## Build plan

The feature is constructed through an ordered Tracer Bullet plan satisfying all acceptance criteria:

1. **Milestone 1: Better Auth Admin Sign-In page, session handling, and demo credential helper**, satisfies **AC-1**, **AC-2**
   - Build luxury Haramain emerald and gold sign-in card at `app/admin/(auth)/login/page.tsx` using Base UI components and Tailwind v4.
   - Wire credentials submission to `authClient.signIn.email` with automatic redirect to `/admin/applications`.
   - Implement active account check (`isActive === true`) and admin role check (`super_admin` or `staff`).
   - Add development demo credential quick-fill helper (`admin@alramlahtravels.com` / `staff@alramlahtravels.com`).

2. **Milestone 2: Core public application submission Server Action, reference code generator, and transaction persistence**, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-6**
   - Create Zod schema `customApplicationSchema` in `lib/validations/application.ts`.
   - Implement collision-safe reference code generator `generateApplicationReference()` returning `ART-YYYY-XXXX`.
   - Implement `submitCustomApplicationAction` in `app/actions/applications.ts` running inside a Neon PostgreSQL transaction (`db.transaction()`).
   - Calculate KSA duration and visa tier server-side via `calculateVisaTierAndCost`, populating `applications`, `application_hotel_stays`, `application_transport_segments`, and an initial draft `application_quotes` row.
   - Return structured response with `referenceNumber`, `calculatedVisaTotalPkr`, and pre-composed WhatsApp share link.

3. **Milestone 3: Admin applications list view with search, status filters, source filters, and 24h SLA overdue badge**, satisfies **AC-7**, **AC-8**, **AC-9**
   - Build server-rendered applications list page at `app/admin/(dashboard)/applications/page.tsx`.
   - Implement search filtering across reference number, customer name, phone number, and city.
   - Implement status tab filters (`All`, `Pending Quote`, `Quoted`, `Approved`, `Rejected`, `Cancelled`) and intake source filters (`Custom Builder`, `Group Booking`, `Hajj Inquiry`).
   - Compute 24-hour service level agreement threshold against `applications.createdAt`, rendering a pulsing red SLA overdue badge on delayed pending inquiries.
   - Render table rows with direct links to `/admin/applications/[id]`.

4. **Milestone 4: End-to-end walking skeleton integration and smoke verification**, satisfies **AC-1**, **AC-2**, **AC-5**, **AC-7**
   - Connect a lightweight public quick-inquiry trigger on the home page to test real submission.
   - Verify that submitting a lead creates real rows across all 4 database tables and immediately displays in the admin queue.
   - Verify Next.js 16 asynchronous `params` and `searchParams` in `/admin/applications`.
   - Execute static verification suite: `npm run typecheck`, `npm run lint`, and `npm run build`.

## Consequences

**Positive**:
- Replaces disconnected manual lead capture with an automated, trackable database pipeline.
- Establishes a verified walking skeleton early, reducing architectural risk for subsequent slices.
- Guarantees data integrity by executing multi-table inserts inside atomic database transactions.
- Provides immediate operational accountability with automated 24-hour SLA overdue alerts.

**Negative / tradeoffs**:
- Transactional inserts across four tables increase submission latency slightly compared to flat document writes (mitigated by Neon connection pooling).
- Admins must remember credentials rather than using social OAuth, matching enterprise travel agency security guidelines.

**Neutral**:
- The admin applications table in this slice renders core inquiry details and links to `/admin/applications/[id]`; the interactive Quote Worksheet itself is implemented in Slice 3.

## Follow-up

- [ ] Complete Slice 2 (`Custom journey builder modules`) to thicken the public journey configuration wizard with dynamic catalog data.
- [ ] Complete Slice 3 (`Admin quoting worksheet`) to allow admins to edit itemized hotel, flight, and transport prices and dispatch quotes.

## References

**Project sources**:
- `AGENTS.md`: Stack definition, Next.js 16 conventions, and single luxury theme rules
- `docs/scope/scope.md`: Feature 5 scope requirements
- `docs/specs/0001-stack-and-architecture.md`: Next.js 16, Neon PostgreSQL, Drizzle ORM, and Better Auth architecture
- `docs/specs/0002-data-model.md`: Full schema definitions, relations, and calculation helpers
- `docs/specs/0003-design-system-and-ui-foundation.md`: Luxury theme tokens and layout shells

**Practices & standards**:
- Tracer Bullet development methodology (pragmatic programmer walking skeleton)
- OWASP Session Management and Password Storage Guidelines
- Defense in Depth route authorization for Next.js App Router applications
