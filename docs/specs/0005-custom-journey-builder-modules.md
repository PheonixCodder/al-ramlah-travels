# 0005. Custom Journey Builder Modules

**Date**: 2026-10-17
**Status**: Proposed

## Summary

This specification defines the interactive Custom Journey Builder on the public Al Ramlah Travels platform. The application provides five toggleable service pillars for visas, return flights, named hotels, ground transport, and sacred ziyarat excursions backed by dynamic PostgreSQL catalog data. The interface automatically calculates travel dates, passenger allocations, airport constraints, room configurations, and vehicle quantities, displaying an itemized live summary card that transitions between fixed pricing for visa inquiries and live rate confirmation for volatile travel services.

## Context

Pilgrims preparing for Umrah encounter significant complexity when coordinating travel arrangements. Off-the-shelf package deals often impose rigid dates, substandard hotel locations, or unwanted transit segments. Conversely, booking each component independently through fragmented consumer travel websites creates logistical hazards, such as selecting flights arriving directly in Makkah (which has no civilian airport) or miscalculating Saudi Arabian stay durations and incurring regulatory visa fines.

To solve this, Al Ramlah Travels requires a unified, high-conversion Custom Journey Builder on its public home page (`app/(public)/page.tsx` and `components/planner/*`). The builder must empower pilgrims to configure any combination of travel services: from an ultra-simple visa purchase to a luxury five-pillar Umrah itinerary. Rather than burdening pilgrims with administrative choices (such as choosing between a 30-day or 90-day visa tier), the builder infers regulatory and logistical requirements from their travel dates and group demographics.

The user experience must balance extreme flexibility with ironclad business domain rules:
1. **Always-On Travel Parameters**: Planned arrival and departure dates must be permanently visible so visa validity spans are calculated transparently. Passenger demographics must separate ticketed travelers (`adults + children + infants`) from those requiring physical hotel beds and vehicle seats (`adults + children`).
2. **Airport Geography Rules**: Any journey starting in Makkah must strictly lock the entry airport to King Abdulaziz International Airport in Jeddah (`JED`), presenting a clear explanation to the user.
3. **Dynamic Inventory Integration**: Hotels, vehicles, airlines, departure cities, and ziyarat sites must render directly from the Neon PostgreSQL database rather than static hardcoded mockups, enabling real-time catalog management.
4. **Intelligent Allocation**: Room allocation must auto-distribute family groups across optimal private room splits (doubles, triples, quads), and transport fleet sizing must automatically scale vehicle counts or suggest upgrades when passenger counts exceed vehicle capacity.
5. **Commercial Transparency**: In `Visa Only` mode, where government visa fees are predictable, the system displays an immediate, binding Pakistani Rupee total. When volatile services (flights, hotels, transport, ziyarat) are included, the system displays an itemized Live Itinerary Summary Card with the badge `"Live Rate — Confirmed upon submission"`, eliminating customer price shock while protecting agency margins.

## Requirements

**User stories**:
- As an intending pilgrim, I want to toggle individual service pillars (Visa, Flights, Hotels, Transport, Ziyarat) or select preset modes so that I only customize the services relevant to my trip.
- As a family organizer, I want to input our travel dates and group composition once so that hotel beds, vehicle seats, and visa tiers calculate automatically without manual data re-entry.
- As a pilgrim selecting hotels, I want to view exact distances to the Haram courtyards, filter by star rating, toggle between shared beds and private rooms with automatic room splitting, and select available meal plans so that our accommodation matches our comfort standards.
- As a traveler booking ground transport, I want our city sequence to automatically populate our transit legs with appropriate vehicle capacities and private pickup times so that our family arrives smoothly at each holy site.
- As a pilgrim, I want to review an itemized itinerary summary card and submit my request or dispatch it directly to WhatsApp so that an agency consultant can confirm our personalized package.

**Acceptance criteria**:
- **AC-1**: The builder renders top mode preset pills (`Complete Umrah Journey`, `Visa Only`, `Hotels Only`, `Transport Only`, `Custom Mix`) and five toggleable service pillar cards (`Umrah / KSA Visa`, `Return Flights`, `Makkah & Madinah Hotels`, `Ground Transport`, `Extra Services (Ziyarat)`), with preset selection activating the corresponding pillars and manual pillar toggling switching the mode to `Custom Mix`.
- **AC-2**: The always-on travel dates and demographics bar captures KSA Planned Arrival Date and KSA Planned Departure Date, dynamically calculating total stay duration and driving the background visa tier determination (`short_term` $\le 30$ days vs `long_term` $> 30$ days) without exposing a manual duration tier selector.
- **AC-3**: The traveller counter captures `Adults (12+ yrs)`, `Children (2–11 yrs)`, and `Infants (<2 yrs)`, rendering derived badges indicating `X Beds / Seats (Adults + Children)` and `Y Passports (Includes Infants)`.
- **AC-4**: When Hotels, Transport, or Flights are active, the builder renders the City Sequence & Date-Chaining module supporting five sequences (`Makkah → Madinah`, `Madinah → Makkah`, `Makkah → Madinah → Makkah`, `Makkah Only`, `Madinah Only`), automatically calculating stay check-in and check-out dates consecutively from the KSA arrival date.
- **AC-5**: Any itinerary sequence starting in Makkah automatically locks the entry airport selector to Jeddah (`JED`) with an informative badge stating `"Makkah has no airport — Entry locked to Jeddah (JED) with direct ground transfer to Makkah"`; itineraries starting or ending in Madinah allow choosing between Madinah Airport (`MED`) and Jeddah Airport (`JED`).
- **AC-6**: When the Flights pillar is active, the builder renders departure city selection (from `departure_cities` catalog), route type (`Direct Flight` vs `1-Stop Connecting`), cabin class (`Economy` vs `Business`), and preferred airline (from `airlines` catalog or `"Any / Best Available"`).
- **AC-7**: When the Hotels pillar is active, the builder renders dedicated hotel selectors for each stay in the sequence, offering star rating filters (`All`, `5-Star Luxury`, `4-Star Premium`, `3-Star Economy`), distance labels (`distanceLabel`), pedestrian badges (`Walking Distance` vs `24/7 Shuttle`), room category toggle (`Shared Room Beds` vs `Standalone Private Rooms`), and per-hotel meal plans.
- **AC-8**: In `Standalone Private Rooms` mode, the builder invokes `calculatePrivateRoomSplits(bedAndSeatCount)` to auto-allocate optimal room distributions (e.g. 5 pax = 1 Triple + 1 Double) and renders interactive radio pills for valid alternative splits; hotel meal plan selectors render conditionally only when the hotel has `offersDining === true`, displaying only supported meal plans or a `"Room Only — Dining not offered by this property"` badge.
- **AC-9**: When the Transport pillar is active, the builder auto-generates transit segments from the chosen city sequence and airports (or exposes all 6 point-to-point sectors in `Transport Only` mode), offers a `"Use same vehicle for entire journey"` toggle, supports Private vs Shared modes, calculates vehicle quantity via `calculateVehicleQuantity(bedAndSeatCount, vehicle)` with auto-incrementing counts and upgrade recommendations for overflow groups, and enables custom pickup time selection (`00:00`–`23:30`) exclusively for private transport.
- **AC-10**: When the Ziyarat pillar is active, the builder provides scope selection (`Makkah Ziyarat Only`, `Madinah Ziyarat Only`, `Both Makkah & Madinah Ziyarat`), displays dynamic sacred site cards from `ziyarat_places` with Arabic calligraphy names, and automatically inherits the primary vehicle from the Transport pillar unless Transport is disabled.
- **AC-11**: The sticky Live Itinerary Summary Card displays an immediate calculated PKR total (`totalPassportCount × visaRatePkr`) strictly when `presetMode === 'visa_only'`; whenever volatile services (`Flights`, `Hotels`, `Transport`, `Ziyarat`) are included, it renders an itemized itinerary summary with badge `"Live Rate — Confirmed upon submission"` and no partial PKR total.
- **AC-12**: Clicking `"Submit Journey Inquiry"` opens a lead capture drawer/modal requiring `Full Name`, `Phone / WhatsApp Number`, `City`, `Email Address`, and optional `Special Requests`, submitting via `submitCustomApplicationAction` and rendering a confirmation screen with the generated reference code (`ART-YYYY-XXXX`) and one-click WhatsApp handoff.

## Options considered

### Option 1: Multi-step wizard with hardcoded static options
Implement a rigid 5-step wizard (`Step 1: Dates -> Step 2: Flights -> Step 3: Hotels -> Step 4: Transport -> Step 5: Review`) with hardcoded hotel and vehicle lists.

**Pros**:
- Simple state management with step-by-step sequential validation.
- Low upfront backend integration effort.

**Cons**:
- Severe UX friction: users seeking only a visa or hotel are forced to click through irrelevant steps.
- Hardcoded inventories require code deployments whenever hotel rates, meal plans, or vehicle models change.
- Step-by-step wizards hide live pricing and summary feedback until the final screen, decreasing conversion.

### Option 2 (Chosen): Pure dynamic catalog single-page modular builder with pure domain calculators
Implement an interactive single-page builder on the home page backed by dynamic PostgreSQL catalog queries, an always-visible sticky live summary card, top mode presets, and pure domain calculation helpers (`lib/domain/`).

**Pros**:
- Pilgrim can jump immediately to their desired services or toggle pillars with real-time summary updates.
- 100% dynamic: hotel names, distances, room types, vehicle capacities, airlines, and ziyarat sites render from Neon PostgreSQL.
- Pure domain calculators guarantee exact parity between client UI previews and server-side submission actions.
- Sticky live summary card provides immediate feedback, reinforcing transparency and luxury positioning.

**Cons**:
- Requires disciplined client state coordination across interdependent modules (city sequence, stay dates, vehicle inheritance).

### Option 3: External embedded form builder
Embed an external form service (such as Typeform or JotForm) inside the page.

**Pros**:
- Zero custom frontend form development.

**Cons**:
- Completely fails brand identity: destroys the luxury Haramain aesthetic.
- Impossible to enforce domain invariants (Makkah airport lockout, private room splits, vehicle capacity scaling).
- Violates the repository stack and subagent architecture.

## Decision

**Chosen option**: Option 2: Pure dynamic catalog single-page modular builder with pure domain calculators.

The Custom Journey Builder will be built as an interactive, modular component suite in `components/planner/`, backed by dynamic catalog queries in `app/(public)/page.tsx` and pure calculation helpers in `lib/domain/`.

**Implementation skills**: `shadcn` (`shadcn/ui`, `.agents/skills/shadcn/`) · `migrate-radix-to-base` (`shadcn/base-ui`, `.agents/skills/migrate-radix-to-base/`) · `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`)

## Rationale

The modular single-page architecture maximizes conversion and flexibility. Pilgrims booking Umrah range from solo professionals needing only an expedited visa to multi-generational family groups configuring complex 14-day multi-city itineraries. 

By grounding the builder in pure domain calculation helpers (`lib/domain/visa.ts`, `lib/domain/rooms.ts`, `lib/domain/dates.ts`, `lib/domain/vehicles.ts`), the same deterministic rules govern both the interactive UI previews and the backend Server Action validations. Fetching catalog data directly from Neon Serverless PostgreSQL guarantees that any inventory modification performed in the Admin Portal (Slice 4) immediately reflects on the public website without redeploying code.

## Feature design

### Component architecture (`components/planner/`)

```
components/planner/
├── journey-builder.tsx                 # Master state coordinator & layout container
├── mode-preset-pills.tsx               # Top preset selectors (Complete, Visa Only, Hotels Only, etc.)
├── service-pillar-toggles.tsx          # 5 luxury toggle cards with icons & active indicators
├── dates-and-travellers-bar.tsx        # Arrival/departure date pickers & demographic counters
├── city-sequence-module.tsx            # Sequence selector, date-chaining & airport rules badge
├── flight-preferences-module.tsx       # Departure city, route type, cabin class, airline picker
├── hotel-selection-module.tsx          # Stay tabs, hotel cards, star filter, room split & dining
│   ├── hotel-card.tsx                  # Image, star rating, distance badge, shuttle tag, amenities
│   ├── room-allocator.tsx              # Shared beds vs Private room auto-split allocator pills
│   └── meal-plan-selector.tsx          # Conditional dining plans or Room Only notice
├── transport-selection-module.tsx      # Transit segments, vehicle fleet picker, pickup times
│   ├── segment-card.tsx                # Sector origin/destination, service mode, vehicle picker
│   └── vehicle-capacity-pill.tsx       # Capacity check, auto-quantity multiplier & upgrade suggestions
├── ziyarat-selection-module.tsx        # Scope pills, sacred site cards & vehicle inheritance
├── live-summary-card.tsx               # Sticky desktop sidebar / mobile drawer with itemized summary
└── lead-capture-dialog.tsx             # Contact info modal, submission mutation & confirmation
```

### State management (`components/planner/planner-context.tsx`)

The planner state is managed via a dedicated React Context and reducer (`usePlannerStore`) supporting deep reactivity and URL state synchronization:

```typescript
export interface PlannerState {
  presetMode: "complete_umrah" | "visa_only" | "hotels_only" | "transport_only" | "custom_mix"
  pillars: {
    visa: boolean
    flights: boolean
    hotels: boolean
    transport: boolean
    ziyarat: boolean
  }
  dates: {
    arrivalDate: string // YYYY-MM-DD
    departureDate: string // YYYY-MM-DD
    totalKsaDays: number
  }
  travellers: {
    adults: number
    children: number
    infants: number
    totalPassportCount: number
    bedAndSeatCount: number
  }
  itinerary: {
    citySequence: "makkah_madinah" | "madinah_makkah" | "makkah_madinah_makkah" | "makkah_only" | "madinah_only"
    entryAirport: "JED" | "MED"
    exitAirport: "JED" | "MED"
    stays: Array<{
      stayOrder: number
      city: "makkah" | "madinah"
      checkInDate: string
      checkOutDate: string
      nights: number
      hotelId?: string
      roomCategory: "shared" | "private"
      sharedRoomType?: "double" | "triple" | "quad"
      privateRoomAllocation: { double: number; triple: number; quad: number }
      mealPlan: "room_only" | "breakfast" | "half_board" | "full_board"
    }>
  }
  flights: {
    departureCityId?: string
    routeType: "direct" | "connecting"
    cabinClass: "economy" | "business"
    preferredAirlineId?: string
  }
  transport: {
    useSameVehicle: boolean
    globalVehicleId?: string
    segments: Array<{
      segmentOrder: number
      sectorId: string
      serviceType: "private" | "shared"
      vehicleId: string
      vehicleQuantity: number
      pickupTime?: string
    }>
  }
  ziyarat: {
    scope: "makkah_only" | "madinah_only" | "both"
    selectedPlaceIds: string[]
    vehicleId?: string
    inheritTransportVehicle: boolean
  }
  submission: {
    isSubmitting: boolean
    isSuccess: boolean
    referenceNumber?: string
    calculatedVisaTotalPkr?: number
    whatsappShareUrl?: string
  }
}
```

### State transitions

```
Preset Pill Clicked:
  - "Complete Umrah"  ──> Pillars: { visa: T, flights: T, hotels: T, transport: T, ziyarat: T }
  - "Visa Only"       ──> Pillars: { visa: T, flights: F, hotels: F, transport: F, ziyarat: F }
  - "Hotels Only"     ──> Pillars: { visa: F, flights: F, hotels: T, transport: F, ziyarat: F }
  - "Transport Only"  ──> Pillars: { visa: F, flights: F, hotels: F, transport: T, ziyarat: F }
  - Individual Toggle ──> Pillars mutated ──> presetMode auto-updates to "Custom Mix"

Submission Lifecycle:
  [ In Progress: Planner Interaction ]
                 │
                 ▼
      [ Click "Submit Inquiry" ]
                 │
                 ▼
    [ Lead Capture Modal Open ]
                 │
                 ▼ (Zod validation passes)
  [ Server Action Execution (Pending) ]
          /                 \
         / (Success)         \ (Failure)
        ▼                     ▼
[ Confirmation Screen ]   [ Field Errors Toast ]
(Reference Code + WA)
```

### API surface

| Surface / Action | Type | Inputs | Outputs | Auth | Error Handling |
|---|---|---|---|---|---|
| `getPlannerCatalogData` | Server Component Data Query | None | `{ visaRates, airlines, departureCities, hotels, vehicles, transportSectors, ziyaratPlaces }` | Public | Cached server-side with revalidation |
| `calculateVisaTierAndCost` | Pure Domain Function | `arrivalStr, departureStr, passports, rates` | `VisaCalculationResult` | Public | Enforces minimum 1 day duration |
| `calculatePrivateRoomSplits` | Pure Domain Function | `bedCount` | `{ primaryAllocation, validAlternatives }` | Public | Handles solo to multi-room splits |
| `chainItineraryDates` | Pure Domain Function | `sequence, arrivalStr, staysConfig` | `{ entryAirport, chainedStays, finalDepartureDate }` | Public | Clamps dates to valid ranges |
| `calculateVehicleQuantity` | Pure Domain Function | `seatCount, vehicle` | `{ requiredQuantity, suggestUpgrade, recommendedCategory }` | Public | Fallbacks for shared vs private |
| `submitCustomApplicationAction` | Server Action (`app/actions/applications.ts`) | `payload: CustomApplicationInput` | `{ success: true, referenceNumber, calculatedVisaTotalPkr, isVisaOnly, whatsappShareUrl }` | Public | 400 Bad Request on validation failure |

### Value sourcing

| Action / Surface | Value Produced or Displayed | Authoritative Source |
|---|---|---|
| Demographic Counters | Beds / Seats Count | Derived: `adults + children` |
| Demographic Counters | Total Passports Count | Derived: `adults + children + infants` |
| City Sequence Module | Entry Airport Lock (`JED`) | Invariant: If sequence starts with Makkah, locked to `JED` |
| Hotel Stay Dates | Stay Check-In & Check-Out | Derived: Computed via `chainItineraryDates` from `arrivalDate` and night counts |
| Room Allocator | Auto Room Splits | Computed via `calculatePrivateRoomSplits(bedAndSeatCount)` |
| Hotel Meal Plan Selector | Available Meal Options | Filtered: Rendered conditionally based on `hotel.offersDining` and `hotel.availableMealPlans` |
| Transport Module | Required Vehicle Count | Computed via `calculateVehicleQuantity(bedAndSeatCount, vehicle)` |
| Transport Module | Pickup Time Picker Disabled | Invariant: Disabled when `serviceType === 'shared'`; enabled when `serviceType === 'private'` |
| Ziyarat Module | Inherited Vehicle Label | Derived: Inherits `transport.segments[0].vehicleId` when `transport.pillars === true` |
| Live Summary Card | Pricing Display | `presetMode === 'visa_only'` ? `formatPKR(calculatedVisaTotalPkr)` : `"Live Rate — Confirmed upon submission"` |
| Submission Confirmation | Reference Code | Generated in Server Action: `ART-YYYY-XXXX` |
| Submission Confirmation | WhatsApp Handshake Link | Derived: `https://wa.me/{agencyNumber}?text={encodedSummary}` |

### Key invariants

1. **Duration Tier Auto-Calculation**: The visa duration tier is derived solely from the elapsed calendar days between KSA Arrival Date and KSA Departure Date ($\le 30\text{ days} \implies \text{short\_term}$; $> 30\text{ days} \implies \text{long\_term}$). The UI must never display a manual tier dropdown.
2. **Infant Exemption Rule**: Infants ($<2\text{ years}$) require a visa and infant airfare, contributing to `totalPassportCount`, but occupy 0 hotel beds and 0 vehicle seats, contributing 0 to `bedAndSeatCount`.
3. **Makkah Civilian Airport Invariant**: Makkah has no civilian airport. Any sequence beginning in Makkah automatically locks the entry airport to Jeddah (`JED`) and displays an informative badge explaining the airport rule and direct ground transfer.
4. **Consecutive Date Chaining**: Check-in of Stay 2 must strictly match Check-out of Stay 1. Changing nights in Makkah automatically adjusts check-in dates in Madinah without user calculation.
5. **Conditional Hotel Dining**: Properties with `offersDining === false` render a subtle `"Room Only — Dining not offered by this property"` notice and suppress meal plan selectors. Only properties with `offersDining === true` expose their specific `availableMealPlans`.
6. **Vehicle Capacity and Mode Rules**: Vehicle quantities auto-scale when passenger counts exceed vehicle capacity ($n = \lceil \text{seatCount} / \text{capacity} \rceil$). Custom pickup time selection is disabled for shared transit and available only for private transport.
7. **Ziyarat Vehicle Inheritance**: When the Transport pillar is active, Ziyarat excursions default to the primary vehicle selected in Transport. If Transport is toggled off, a fallback vehicle selector is displayed.
8. **Summary Pricing Exclusivity**: A fixed PKR total is displayed to the customer strictly when only Visa is selected. Whenever flights, hotels, transport, or ziyarat are active, the summary card displays `"Live Rate — Confirmed upon submission"`, preventing volatile supplier rate mismatches.

### Security model

- **Public Data Access**: Catalog queries (`hotels`, `vehicles`, `airlines`, `departure_cities`, `ziyarat_places`) read active rows (`isActive === true`) via public Server Components with cached responses.
- **Server-Side Validation**: All incoming submissions are validated against `customApplicationSchema` using Zod before any database transaction begins.
- **Anti-Tampering Guarantees**: Client-side prices are never trusted; the server recomputes the visa tier and total using the database `visa_rates` table.
- **Client IP Rate Limiting**: The public submission Server Action is protected against spam and automated denial-of-service attempts.

### Configuration required

No additional environment variables are required beyond `DATABASE_URL_POOLED` and `NEXT_PUBLIC_APP_URL`.

### Critical test scenarios

- **Happy path (Complete Umrah Journey)**: Visitor selects `"Complete Umrah Journey"`; sets 14 days, 4 adults, 1 child, 1 infant (5 beds/seats, 6 passports); selects Makkah first (locks entry airport to `JED`); chooses 5-star Makkah hotel with private room split (1 Quad + 1 Double) and breakfast; chooses GMC Yukon transport with 10:00 AM private pickup; selects both Makkah and Madinah ziyarat; submits lead capture form; receives reference `ART-2026-B8D1` with one-click WhatsApp link. Verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-12**.
- **Visa Only Mode (Fixed Price Contract)**: Visitor clicks `"Visa Only"` preset; enters 20 days and 3 adults; summary card immediately displays exact calculated PKR price ($3 \times \text{short-term rate}$); switches dates to 35 days; summary card dynamically updates to long-term price; submits; received confirmation displays exact PKR figure. Verifies **AC-1**, **AC-2**, **AC-3**, **AC-11**, **AC-12**.
- **Airport Lockout Invariant**: User switches sequence from `Madinah → Makkah` to `Makkah → Madinah`; entry airport automatically shifts from `MED` to `JED`; selector disables with explanatory badge; user switches to `Madinah → Makkah`; entry airport unlocks, allowing either `MED` or `JED`. Verifies **AC-5**.
- **Private Room Split Allocation**: Group with 5 adults and 1 child (6 beds) chooses private rooms; allocator auto-selects primary allocation (1 Quad + 1 Double = 6 beds); renders interactive alternative pills (`2 Triples` and `3 Doubles`); clicking `2 Triples` updates state immediately. Verifies **AC-8**.
- **Vehicle Capacity Overflow Warning**: Group of 6 travelers selects Toyota Camry Sedan (capacity 4); system auto-increments quantity to 2 vehicles; displays recommendation badge: `"Consider upgrading to a 7-seat GMC Yukon or Hyundai Staria for single-vehicle comfort"`. Verifies **AC-9**.

## Build plan

The feature is constructed through an ordered five-milestone Tracer Bullet plan:

1. **Milestone 1: Planner state store, mode preset pills, 5 toggleable service pillars, always-on travel dates, and traveller counter with bed/seat vs passport badge**, satisfies **AC-1**, **AC-2**, **AC-3**
   - Implement `PlannerProvider` and `usePlannerStore` reducer in `components/planner/planner-context.tsx`.
   - Build `ModePresetPills` and `ServicePillarToggles` with luxury emerald and gold styling.
   - Build `DatesAndTravellersBar` integrating Gregorian date range pickers and adult/child/infant counters with derived bed/seat vs passport badges.
   - Connect background duration calculation and visa tier determination.

2. **Milestone 2: City sequence selector, Jeddah/Madinah airport enforcement, and automatic stay date-chaining engine**, satisfies **AC-4**, **AC-5**
   - Build `CitySequenceModule` supporting all 5 sequence configurations.
   - Implement airport rule logic: starting in Makkah locks entry airport to `JED` with an explanatory badge.
   - Implement automatic stay date chaining using `chainItineraryDates` from `lib/domain/dates.ts`.

3. **Milestone 3: Flight route preferences module and Named Hotels catalog with star filters, private room auto-split allocator, and conditional per-hotel dining selectors**, satisfies **AC-6**, **AC-7**, **AC-8**
   - Build `FlightPreferencesModule` with departure cities, route types, cabin classes, and airline pickers.
   - Build `HotelSelectionModule` with stay tabs, star rating filters, Haram distance indicators, and shuttle tags.
   - Implement `RoomAllocator` supporting shared beds and standalone private rooms with auto-splits via `calculatePrivateRoomSplits`.
   - Implement conditional meal plan selector respecting `offersDining` and `availableMealPlans`.

4. **Milestone 4: Segment-by-segment transport configuration, vehicle fleet capacity sizing, pickup time control, and Ziyarat site cards with vehicle inheritance**, satisfies **AC-9**, **AC-10**
   - Build `TransportSelectionModule` auto-generating transit legs from the chosen sequence and airports.
   - Implement vehicle picker with `calculateVehicleQuantity`, auto-quantity scaling, and upgrade recommendations.
   - Add pickup time selector enabled strictly for private transport.
   - Build `ZiyaratSelectionModule` with Makkah/Madinah sacred site cards, Arabic typography, and transport vehicle inheritance.

5. **Milestone 5: Sticky Live Itinerary Summary Card with dynamic live rate vs fixed visa price mode, lead capture modal, WhatsApp dispatch, and confirmation screen**, satisfies **AC-11**, **AC-12**
   - Build `LiveSummaryCard` with sticky desktop layout and responsive mobile drawer.
   - Enforce pricing visibility rules: exact PKR total for `Visa Only`, `"Live Rate — Confirmed upon submission"` when volatile services are active.
   - Build `LeadCaptureDialog` with Zod validation, connecting to `submitCustomApplicationAction`.
6. **Milestone 6: Dynamic Step-by-Step Journey Wizard with in-place stepper and synchronized summary card**, satisfies **Feature 12**
   - Restructure `CustomJourneyBuilder` into an in-place dynamic stepper showing strictly one active step at a time in the left column (`lg:col-span-8`).
   - Retain sticky `LiveSummaryCard` in right column (`lg:col-span-4`) with live two-way synchronization.
   - Build `WizardStepperHeader` with visual progress bar (Emerald & Gold gradient), step progress count, and clickable step tabs with completed checkmarks (`✓`).
   - Build `WizardBottomNav` with Previous / Next step navigation and automatic smooth scrolling to `#custom-journey`.
   - Build `ReviewAndSubmitStep` displaying high-fidelity itinerary recap, fixed visa total vs live rate notice, and in-page lead capture form with instant reference code and WhatsApp dispatch.

## Dynamic Step-by-Step Journey Wizard Architecture

### 1. In-Place Single-Step Display
To eliminate infinite vertical page scrolling while preserving comprehensive, uncompromised cards for hotels, vehicles, and ziyarat sanctuaries, the builder renders strictly **one active step at a time** in the main column.

The active steps array is computed dynamically via `wizardSteps` in `planner-context.tsx`:
- **Step 1 (`id: "setup"`, title: `"Journey & Dates"`)**: Always present. Renders `ModePresetPills`, `ServicePillarToggles`, `DatesAndTravellersBar`, and `CitySequenceModule`.
- **Dynamic Middle Steps**:
  - `flights`: Renders `FlightPreferencesModule` (active only when `pillars.flights === true`).
  - `hotels`: Renders `HotelSelectionModule` (active only when `pillars.hotels === true`).
  - `transport`: Renders `TransportSelectionModule` (active only when `pillars.transport === true`).
  - `ziyarat`: Renders `ZiyaratSelectionModule` (active only when `pillars.ziyarat === true`).
- **Final Step (`id: "review"`, title: `"Review & Submit"`)**: Always present. Renders `ReviewAndSubmitStep` with comprehensive journey recap, price guarantee notes, and the inline lead capture form.

### 2. Dynamic Step Counts by Journey Preset
- **Visa Only (`visa_only`)**: **2 steps** (`1. Setup & Dates` → `2. Review & Submit`).
- **Hotels Only (`hotels_only`)**: **3 steps** (`1. Setup & Dates` → `2. Haramain Hotels` → `3. Review & Submit`).
- **Transport Only (`transport_only`)**: **3 steps** (`1. Setup & Dates` → `2. Ground Transport` → `3. Review & Submit`).
- **Complete Umrah (`complete_umrah`)**: **6 steps** (`1. Setup & Dates` → `2. Flights & Route` → `3. Haramain Hotels` → `4. Ground Transport` → `5. Sacred Ziyarat` → `6. Review & Submit`).
- **Custom Mix (`custom_mix`)**: Dynamically adjusts to only the active pillars.

### 3. Stepper Synchronization & Navigation
- **Header Progress Stepper**: Shows `Step X of Y`, completion percentage, and clickable step pills with checkmarks for past steps.
- **Bottom Navigation Bar**: Left button returns to previous step; right CTA button advances to next step and scrolls smoothly to `#custom-journey`.
- **Sticky Live Summary Card**: Fully synchronized with the wizard. Line items allow jumping directly to their corresponding step. The primary CTA button dynamically advances to the Review step, or focuses the lead form if already on the final step.

## Consequences

**Positive**:
- Empowers pilgrims with unprecedented transparency and control over their sacred journey arrangements.
- Enforces complex Saudi Arabian travel regulations and airport logistics transparently in the background.
- Maximizes lead generation conversion by offering pre-built mode shortcuts alongside deep customization.
- Connects public inquiries directly to the administrative database and WhatsApp channels.

**Negative / tradeoffs**:
- Complex state coordination across five interdependent modules increases client bundle size (mitigated by Next.js dynamic imports and server-side catalog pre-fetching).
- Requires ongoing maintenance of hotel and vehicle catalog records in the admin portal to keep public choices current.

**Neutral**:
- Customers do not receive immediate instant online booking for flights and hotels; instead, the live quoting model allows agency staff to guarantee optimal rates before payment.

## Follow-up

- [ ] Connect the dynamic catalog pre-fetch in `app/(public)/page.tsx` to real Neon PostgreSQL tables once Seed data is applied.
- [ ] Implement Slice 3 (`Admin quoting worksheet`) so staff can inspect these detailed multi-stay and multi-segment submissions.

## References

**Project sources**:
- `AGENTS.md`: Stack definition, Next.js 16 conventions, and single luxury theme rules
- `docs/scope/scope.md`: Feature 6 scope requirements
- `docs/specs/0001-stack-and-architecture.md`: Next.js 16 App Router and database architecture
- `docs/specs/0002-data-model.md`: Authoritative schema, relations, and pure domain calculation helpers
- `docs/specs/0003-design-system-and-ui-foundation.md`: Luxury Haramain design tokens, Base UI render-prop rules, and layout shells
- `docs/specs/0004-core-quote-loop-and-admin-sign-in.md`: Submission Server Action and walking skeleton contracts

**Practices & standards**:
- Al-Safa and Haramain Safar visual design patterns for Umrah planners
- General Authority of Civil Aviation (GACA) Saudi Arabia airport regulations
- Next.js 16 App Router Server Component data fetching and React Context state management
