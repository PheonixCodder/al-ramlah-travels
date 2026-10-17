# 0002. Complete Drizzle PostgreSQL Data Model and Zod Contracts

**Date**: 2026-10-17
**Status**: Proposed

## Summary

This specification establishes the authoritative database architecture, relational schema, pure domain calculation helpers, and runtime validation contracts for Al Ramlah Travels. It implements a normalized PostgreSQL model using Drizzle ORM and Neon Serverless, integrating Better Auth for administrative identity and role management. The schema supports custom multi-service Umrah itineraries, fixed group package batches, Hajj consultation inquiries, live administrative quoting, dynamic inventory catalogs, and public content management.

## Context

Al Ramlah Travels operates a specialized Hajj and Umrah travel business serving pilgrims across Pakistan and international diaspora communities. The agency provides both modular custom journeys and pre-packaged group departures. In the custom journey flow, pilgrims configure up to five distinct service pillars comprising visas, flights, named hotels in Makkah and Madinah, point-to-point ground transport, and sacred ziyarat excursions. In the group booking flow, pilgrims reserve fixed seats on pre-scheduled departure batches departing from major Pakistani international airports.

The agency's commercial workflow involves a live quoting model rather than instant card checkout. Except for pure visa purchases (where the regulatory price is predictable and displayed immediately in Pakistani Rupees), travel costs fluctuate based on airline fare classes, hotel room allotments, seasonal surges during Ramadan, and private vehicle availability. The platform must capture high-intent leads, issue unique human-readable reference codes, compute deterministic baseline calculations (such as duration-based visa tiers, private room distributions, and vehicle fleet sizing), and provide an administrative quote worksheet where agency staff calculate live itemized PKR prices and dispatch them to pilgrims via WhatsApp or email.

Failing to establish a rigorous, type-safe data model at this foundational stage creates critical operational hazards. Inconsistent passenger counts can misallocate hotel beds or vehicle seats. Miscalculating Saudi Arabian stay lengths risks issuing the wrong visa tier, leading to regulatory fines or border rejection. Permitting direct airport selection in Makkah creates impossible flight itineraries because Makkah possesses no civilian airport. Unvalidated administrative inputs can corrupt financial balances across quotes and payment records.

To prevent these failure modes, the data model must enforce strong relational integrity, store single-currency monetary amounts in whole integer units (PKR), provide explicit enumerated lifecycle states, and define pure TypeScript helper functions that compute business invariants deterministically across both client forms and server actions.

## Requirements

**User stories**:
- As a pilgrim, I want to configure a custom Umrah journey or reserve a group package so that I receive an itemized, transparent quote with a trackable reference number.
- As a pilgrim seeking only a visa, I want to see an immediate, fixed PKR price based on my trip duration so that I can apply with complete cost certainty.
- As an agency administrator, I want to adjust visa rates, manage named hotels with specific meal plans, configure vehicles and transport sectors, and define group packages from a central catalog so that public booking forms always reflect current inventory.
- As an agency quoting agent, I want a single worksheet where visa costs pre-populate automatically and live rates for flights, hotels, and transport are itemized and totaled so that I can dispatch professional quotes quickly.
- As an agency executive, I want to track applications across a structured five-stage lifecycle with automated SLA overdue alerts so that our staff responds to every pilgrim inquiry within 24 hours.

**Acceptance criteria**:
- **AC-1**: Database schema defines all tables using Drizzle ORM PostgreSQL primitives (`pgTable`, `pgEnum`, `uuid`, `text`, `integer`, `boolean`, `timestamp`, `date`, `jsonb`, `index`, and `uniqueIndex`) and exports explicit Drizzle relation graphs for relational queries.
- **AC-2**: Better Auth identity tables (`user`, `session`, `account`, and `verification`) persist administrative credentials and enforce role-based access (`super_admin` vs `staff`) and account activation (`isActive`).
- **AC-3**: Agency settings persist in a singleton record (`agency_settings`) holding agency contact information, WhatsApp numbers, office address, working hours, and an SLA overdue threshold with a default of 24 hours.
- **AC-4**: Visa rates table (`visa_rates`) enforces two duration tiers (`short_term` for 30 days or fewer, `long_term` for greater than 30 days) with prices stored as integer PKR per passport, editable only by authenticated administrators.
- **AC-5**: Flights catalog tables (`airlines` and `departure_cities`) store active airlines with IATA codes and Pakistani departure cities with airport codes, supporting direct and connecting flight preferences.
- **AC-6**: Hotel catalog table (`hotels`) stores star ratings, physical distance in meters to Haram courtyards, distance descriptions, pedestrian access types (`walking` vs `shuttle`), room type allowances (`double`, `triple`, `quad`), dining flags, and per-hotel meal plans (`room_only`, `breakfast`, `half_board`, `full_board`).
- **AC-7**: Vehicle catalog table (`vehicles`) stores the eight locked road vehicle models plus the Haramain High-Speed Train, recording seating capacity, luggage capacity, and booking modes (`private_only`, `shared_and_private`, `shared_only`).
- **AC-8**: Transport sectors table (`transport_sectors`) models the seven locked point-to-point transfer routes between airports and holy city hotels, tracking origin, destination, and high-speed rail compatibility.
- **AC-9**: Ziyarat places table (`ziyarat_places`) records sacred sites in Makkah and Madinah with localized Arabic names, descriptions, and city tags.
- **AC-10**: Pre-built packages (`group_packages`) and departure batches (`group_departures`) track fixed dates, room tier prices (`quadPricePkr`, `triplePricePkr`, `doublePricePkr`), seat capacities, and real-time occupancy status (`open`, `filling_fast`, `sold_out`, `closed`).
- **AC-11**: Applications table (`applications`) supports all three intake channels (`custom_builder`, `group_booking`, `hajj_inquiry`), generates unique reference numbers (format `ART-YYYY-XXXX`), tracks passenger counts (`totalPassportCount` vs `bedAndSeatCount`), enforces airport constraints, and records normalized child records for hotel stays (`application_hotel_stays`) and transport segments (`application_transport_segments`).
- **AC-12**: Administrative quote table (`application_quotes`) version-tracks itemized cost breakdowns in whole PKR units, automatically pre-filling the calculated visa total, and records customer notes, internal staff remarks, payment statuses (`unpaid`, `partially_paid`, `paid_in_full`), and approval timestamps.
- **AC-13**: Pure domain calculation modules (`lib/domain/`) calculate visa tiers and costs, compute optimal private room splits, sequence itinerary dates, and determine vehicle quantities without database or network dependencies.
- **AC-14**: Runtime validation layer (`lib/validations/`) exports Zod schemas validating public form inputs, reference tracker queries, administrative inventory updates, and quote worksheet submissions.

## Options considered

### Option 1: Monolithic Flat Application Table with Generic JSONB Payloads
Store core lead contact information in a simple applications table, and place all itinerary configuration (stays, vehicles, flights, and quotes) inside unstructured JSONB blobs.

**Pros**:
- Extremely quick to scaffold initially without complex relational join definitions.
- Changes to itinerary structures require no database schema migrations.

**Cons**:
- Prevents database-level referential integrity checks against hotel and vehicle records.
- Obstructs executive SQL reporting and aggregation queries across hotels, occupancy, and transport sectors.
- Risks schema drift and missing validation checks when JSON shapes evolve across application versions.

### Option 2: Normalized Relational Model with Typed Enums and Pure Domain Logic (Recommended)
Model every domain entity as a first-class relational table in PostgreSQL via Drizzle ORM. Enforce foreign keys, unique constraints, and enumerated status strings. Isolate complex algorithmic rules (room distribution, visa tier calculation, date chaining) into pure, independently testable TypeScript domain functions.

**Pros**:
- Full ACID compliance and referential integrity guarantees across packages, applications, stays, and quotes.
- Fast, indexed administrative searches by reference code, phone number, status, and creation dates.
- Type-safe autocomplete and query compilation across Server Actions, Route Handlers, and client components.
- Clear separation between relational persistence and domain calculations.

**Cons**:
- Requires deliberate foreign key cascading configurations when removing draft applications.
- Involves more upfront boilerplate schema code across tables and join relations.

### Option 3: Document-Centric Approach via NoSQL Datastore
Utilize a document database (such as MongoDB or CouchDB) to persist hierarchical travel itineraries as document trees.

**Pros**:
- Hierarchical travel bookings naturally resemble document structures.

**Cons**:
- Violates the locked project architecture requiring PostgreSQL, Neon Serverless, and Drizzle ORM.
- Lacks native relational joins for multi-table administrative inventory updates.
- Requires maintaining two separate database connections for Better Auth and application data.

## Decision

**Chosen option**: Option 2: Normalized Relational Model with Typed Enums and Pure Domain Logic.

We implement a normalized PostgreSQL schema managed with Drizzle ORM, combining strict relational integrity for core entities with structured JSONB attributes for flexible multi-value properties (such as hotel amenities, room arrays, and package highlights). All business calculations reside in pure TypeScript modules in `lib/domain/`.

**Implementation skills**: `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-security-best-practices/`) · `create-auth` (`better-auth/skills`, `.agents/skills/create-auth/`)

## Rationale

The travel domain involves strict commercial, operational, and regulatory constraints. Financial quotas, visa durations, and seat allotments cannot tolerate data inconsistency. PostgreSQL running on Neon Serverless provides instant connection pooling and full ACID transactions. Drizzle ORM provides a zero-overhead TypeScript schema definition that mirrors native SQL tables while generating automated migrations via `drizzle-kit`.

Option 1 was rejected because burying hotel stays and vehicle bookings in untyped JSON documents makes administrative analytics, inventory status updates, and SQL joins unreliable. Option 3 was rejected because it introduces architectural fragmentation and conflicts with the repository standard. Option 2 strikes the ideal balance: foreign keys protect critical dependencies, while JSONB arrays handle straightforward list attributes without excessive junction table overhead.

## Feature design

### Data model sketch

The complete schema is located in `db/schema.ts` and structured into logical domains:

```
[Authentication & Admin Users]
- user (Better Auth core + role: 'super_admin' | 'staff', isActive: boolean)
- session (Better Auth core)
- account (Better Auth core)
- verification (Better Auth core)

[Agency Configuration]
- agency_settings (Singleton: contact numbers, office address, working hours, SLA threshold)

[Dynamic Inventory & Reference Catalogs]
- visa_rates (Duration tiers: short_term <= 30d, long_term > 30d, PKR rate per passport)
- airlines (IATA codes, flight direct/connecting availability, logos)
- departure_cities (Pakistan gateway cities: KHI, LHE, ISB, MUX, PEW, SKT, UET, LYP)
- hotels (Makkah/Madinah, star ratings, Haram distance, room types, meal plans)
- vehicles (8 road vehicle models + Haramain Train, seat/luggage capacities, booking modes)
- transport_sectors (7 point-to-point transfer routes between airports and holy city hotels)
- ziyarat_places (Sacred historical sites in Makkah and Madinah with Arabic calligraphy names)

[Commercial Group Packages]
- group_packages (Pre-built seasonal packages, tiers, hotel links, highlights, pricing)
- group_departures (Scheduled batch dates, total/booked seats, occupancy lifecycle states)

[Applications, Stays, Segments & Live Quotes]
- applications (Central lead record: reference code, contact info, passenger counts, dates, status)
- application_hotel_stays (Ordered city stays, hotel FK, nights, room allocation, meal plans)
- application_transport_segments (Ordered transfer legs, sector FK, vehicle FK, pickup times)
- application_quotes (Live pricing worksheet, itemized PKR line items, payment status, notes)

[Public CMS & Contact Inbox]
- hero_slides (Public hero carousel slides, badges, titles, images, call-to-action buttons)
- testimonials (Pilgrim reviews, star ratings, journey tags, verification flags)
- faqs (Categorized accordion questions and answers)
- contact_messages (Public inquiry inbox, read/replied lifecycle states, internal notes)
```

#### Detailed Schema Code Specifications (`db/schema.ts`)

```typescript
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ==========================================
// 1. POSTGRES ENUM DEFINITIONS
// ==========================================

export const roleEnum = pgEnum("user_role", ["super_admin", "staff"]);

export const visaTierEnum = pgEnum("visa_tier", ["short_term", "long_term"]);

export const cityNameEnum = pgEnum("city_name", ["makkah", "madinah"]);

export const hotelAccessTypeEnum = pgEnum("hotel_access_type", [
  "walking",
  "shuttle",
]);

export const mealPlanTypeEnum = pgEnum("meal_plan_type", [
  "room_only",
  "breakfast",
  "half_board",
  "full_board",
]);

export const roomCategoryEnum = pgEnum("room_category", ["shared", "private"]);

export const roomTypeEnum = pgEnum("room_type", ["double", "triple", "quad"]);

export const vehicleCategoryEnum = pgEnum("vehicle_category", [
  "sedan",
  "suv",
  "van",
  "minibus",
  "bus",
  "train",
]);

export const vehicleBookingModeEnum = pgEnum("vehicle_booking_mode", [
  "private_only",
  "shared_and_private",
  "shared_only",
]);

export const sectorPointTypeEnum = pgEnum("sector_point_type", [
  "airport",
  "hotel",
]);

export const packageTierEnum = pgEnum("package_tier", [
  "economy",
  "bronze",
  "silver",
  "gold",
  "vip_5star",
]);

export const groupDepartureStatusEnum = pgEnum("group_departure_status", [
  "open",
  "filling_fast",
  "sold_out",
  "closed",
]);

export const applicationSourceEnum = pgEnum("application_source", [
  "custom_builder",
  "group_booking",
  "hajj_inquiry",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending_quote",
  "quoted",
  "approved",
  "rejected",
  "cancelled",
]);

export const builderPresetModeEnum = pgEnum("builder_preset_mode", [
  "complete_umrah",
  "visa_only",
  "hotels_only",
  "transport_only",
  "custom_mix",
  "group_package",
  "hajj_consultation",
]);

export const citySequenceEnum = pgEnum("city_sequence", [
  "makkah_madinah",
  "madinah_makkah",
  "makkah_madinah_makkah",
  "makkah_only",
  "madinah_only",
]);

export const flightRouteTypeEnum = pgEnum("flight_route_type", [
  "direct",
  "connecting",
]);

export const cabinClassEnum = pgEnum("cabin_class", ["economy", "business"]);

export const transportServiceTypeEnum = pgEnum("transport_service_type", [
  "private",
  "shared",
]);

export const ziyaratScopeEnum = pgEnum("ziyarat_scope", [
  "makkah_only",
  "madinah_only",
  "both",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "partially_paid",
  "paid_in_full",
]);

export const faqCategoryEnum = pgEnum("faq_category", [
  "general",
  "visa",
  "hotels",
  "transport",
  "packages",
  "hajj",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "unread",
  "read",
  "replied",
  "archived",
]);

// ==========================================
// 2. AUTHENTICATION & USERS (BETTER AUTH)
// ==========================================

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: roleEnum("role").notNull().default("staff"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_user_email").on(table.email),
    index("idx_user_role").on(table.role),
  ]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_session_user_id").on(table.userId),
    uniqueIndex("idx_session_token").on(table.token),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_account_user_id").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_verification_identifier").on(table.identifier)]
);

// ==========================================
// 3. AGENCY SETTINGS (SINGLETON CONFIGURATION)
// ==========================================

export const agencySettings = pgTable("agency_settings", {
  id: varchar("id", { length: 32 }).primaryKey().default("default"),
  agencyName: text("agency_name").notNull().default("Al Ramlah Travels"),
  tagline: text("tagline")
    .notNull()
    .default("Sacred Journeys Crafted with Dignity & Comfort"),
  primaryWhatsapp: varchar("primary_whatsapp", { length: 32 })
    .notNull()
    .default("+923001234567"),
  secondaryPhone: varchar("secondary_phone", { length: 32 }),
  supportEmail: varchar("support_email", { length: 255 })
    .notNull()
    .default("info@alramlahtravels.com"),
  officeAddress: text("office_address")
    .notNull()
    .default("Suite 402, Al-Hafeez Heights, Gulberg III, Lahore, Pakistan"),
  mapsEmbedUrl: text("maps_embed_url"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  youtubeUrl: text("youtube_url"),
  tiktokUrl: text("tiktok_url"),
  workingHours: text("working_hours")
    .notNull()
    .default("Monday to Saturday, 9:00 AM to 8:00 PM PKT"),
  slaOverdueHours: integer("sla_overdue_hours").notNull().default(24),
  updatedByUserId: text("updated_by_user_id").references(() => user.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ==========================================
// 4. DYNAMIC VISA PRICING
// ==========================================

export const visaRates = pgTable("visa_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tier: visaTierEnum("tier").notNull().unique(),
  label: text("label").notNull(),
  maxDays: integer("max_days").notNull(),
  pricePkr: integer("price_pkr").notNull(),
  notes: text("notes"),
  updatedByUserId: text("updated_by_user_id").references(() => user.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ==========================================
// 5. FLIGHTS REFERENCE CATALOG
// ==========================================

export const airlines = pgTable(
  "airlines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    iataCode: varchar("iata_code", { length: 3 }).notNull().unique(),
    logoUrl: text("logo_url"),
    isDirectAvailable: boolean("is_direct_available").notNull().default(true),
    isConnectingAvailable: boolean("is_connecting_available")
      .notNull()
      .default(true),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_airline_active").on(table.isActive),
    index("idx_airline_sort").on(table.sortOrder),
  ]
);

export const departureCities = pgTable(
  "departure_cities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cityName: text("city_name").notNull(),
    airportCode: varchar("airport_code", { length: 3 }).notNull().unique(),
    airportName: text("airport_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_departure_city_active").on(table.isActive),
    index("idx_departure_city_sort").on(table.sortOrder),
  ]
);

// ==========================================
// 6. DYNAMIC HOTELS & MEAL PLANS
// ==========================================

export const hotels = pgTable(
  "hotels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    city: cityNameEnum("city").notNull(),
    starRating: integer("star_rating").notNull(),
    distanceMeters: integer("distance_meters").notNull(),
    distanceLabel: text("distance_label").notNull(),
    accessType: hotelAccessTypeEnum("access_type").notNull(),
    imageUrl: text("imageUrl").notNull(),
    galleryUrls: jsonb("gallery_urls").$type<string[]>().notNull().default([]),
    amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
    allowsSharedRooms: boolean("allows_shared_rooms").notNull().default(true),
    allowsPrivateRooms: boolean("allows_private_rooms").notNull().default(true),
    availableRoomTypes: jsonb("available_room_types")
      .$type<("double" | "triple" | "quad")[]>()
      .notNull()
      .default(["double", "triple", "quad"]),
    offersDining: boolean("offers_dining").notNull().default(false),
    availableMealPlans: jsonb("available_meal_plans")
      .$type<("room_only" | "breakfast" | "half_board" | "full_board")[]>()
      .notNull()
      .default(["room_only"]),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_hotel_city").on(table.city),
    index("idx_hotel_rating").on(table.starRating),
    index("idx_hotel_active").on(table.isActive),
    index("idx_hotel_featured").on(table.isFeatured),
  ]
);

// ==========================================
// 7. VEHICLES & TRANSPORT SECTORS
// ==========================================

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    category: vehicleCategoryEnum("category").notNull(),
    bookingMode: vehicleBookingModeEnum("booking_mode").notNull(),
    seatCapacity: integer("seat_capacity").notNull(),
    luggageCapacity: integer("luggage_capacity").notNull(),
    allowsCustomPickupTime: boolean("allows_custom_pickup_time")
      .notNull()
      .default(false),
    imageUrl: text("imageUrl"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_vehicle_category").on(table.category),
    index("idx_vehicle_active").on(table.isActive),
    index("idx_vehicle_sort").on(table.sortOrder),
  ]
);

export const transportSectors = pgTable(
  "transport_sectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    label: text("label").notNull(),
    originCity: text("origin_city").notNull(),
    destinationCity: text("destination_city").notNull(),
    originType: sectorPointTypeEnum("origin_type").notNull(),
    destinationType: sectorPointTypeEnum("destination_type").notNull(),
    supportsTrain: boolean("supports_train").notNull().default(false),
    approxDistanceKm: integer("approx_distance_km"),
    approxDurationMinutes: integer("approx_duration_minutes"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sector_code").on(table.code),
    index("idx_sector_active").on(table.isActive),
  ]
);

// ==========================================
// 8. SACRED ZIYARAT SITES
// ==========================================

export const ziyaratPlaces = pgTable(
  "ziyarat_places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    city: cityNameEnum("city").notNull(),
    name: text("name").notNull(),
    arabicName: text("arabic_name").notNull(),
    description: text("description").notNull(),
    imageUrl: text("imageUrl"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ziyarat_city").on(table.city),
    index("idx_ziyarat_active").on(table.isActive),
  ]
);

// ==========================================
// 9. GROUP PACKAGES & DEPARTURE BATCHES
// ==========================================

export const groupPackages = pgTable(
  "group_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    tier: packageTierEnum("tier").notNull(),
    durationDays: integer("duration_days").notNull(),
    makkahNights: integer("makkah_nights").notNull(),
    madinahNights: integer("madinah_nights").notNull(),
    airlineId: uuid("airline_id").references(() => airlines.id),
    makkahHotelId: uuid("makkah_hotel_id").references(() => hotels.id),
    madinahHotelId: uuid("madinah_hotel_id").references(() => hotels.id),
    includesVisa: boolean("includes_visa").notNull().default(true),
    includesTransport: boolean("includes_transport").notNull().default(true),
    includesZiyarat: boolean("includes_ziyarat").notNull().default(true),
    mealPlan: mealPlanTypeEnum("meal_plan").notNull().default("breakfast"),
    quadPricePkr: integer("quad_price_pkr").notNull(),
    triplePricePkr: integer("triple_price_pkr").notNull(),
    doublePricePkr: integer("double_price_pkr").notNull(),
    highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
    bannerUrl: text("banner_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_package_tier").on(table.tier),
    index("idx_package_active").on(table.isActive),
    index("idx_package_featured").on(table.isFeatured),
  ]
);

export const groupDepartures = pgTable(
  "group_departures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => groupPackages.id, { onDelete: "cascade" }),
    batchCode: varchar("batch_code", { length: 32 }).notNull().unique(),
    departureCityId: uuid("departure_city_id")
      .notNull()
      .references(() => departureCities.id),
    departureDate: date("departure_date").notNull(),
    returnDate: date("return_date").notNull(),
    totalSeats: integer("total_seats").notNull(),
    bookedSeats: integer("booked_seats").notNull().default(0),
    status: groupDepartureStatusEnum("status").notNull().default("open"),
    quadPriceOverridePkr: integer("quad_price_override_pkr"),
    triplePriceOverridePkr: integer("triple_price_override_pkr"),
    doublePriceOverridePkr: integer("double_price_override_pkr"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_departure_package").on(table.packageId),
    index("idx_departure_date").on(table.departureDate),
    index("idx_departure_status").on(table.status),
  ]
);

// ==========================================
// 10. APPLICATIONS (LEADS & ITINERARY MASTER)
// ==========================================

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referenceNumber: varchar("reference_number", { length: 32 })
      .notNull()
      .unique(),
    source: applicationSourceEnum("source").notNull(),
    status: applicationStatusEnum("status").notNull().default("pending_quote"),
    presetMode: builderPresetModeEnum("preset_mode").notNull(),

    // Customer Contact & Identification
    customerName: text("customer_name").notNull(),
    customerPhone: varchar("customer_phone", { length: 32 }).notNull(),
    customerWhatsapp: varchar("customer_whatsapp", { length: 32 }).notNull(),
    customerCity: text("customer_city").notNull(),
    customerEmail: varchar("customer_email", { length: 255 }),
    specialRequests: text("special_requests"),

    // Traveller Counts
    adults: integer("adults").notNull().default(1),
    children: integer("children").notNull().default(0),
    infants: integer("infants").notNull().default(0),
    totalPassportCount: integer("total_passport_count").notNull(),
    bedAndSeatCount: integer("bed_and_seat_count").notNull(),

    // Selected Service Pillars
    includeVisa: boolean("include_visa").notNull().default(true),
    includeFlights: boolean("include_flights").notNull().default(false),
    includeHotels: boolean("include_hotels").notNull().default(false),
    includeTransport: boolean("include_transport").notNull().default(false),
    includeZiyarat: boolean("include_ziyarat").notNull().default(false),

    // Saudi Arabia Dates & Visa Pricing
    ksaArrivalDate: date("ksa_arrival_date"),
    ksaDepartureDate: date("ksa_departure_date"),
    totalKsaDays: integer("total_ksa_days"),
    calculatedVisaTier: visaTierEnum("calculated_visa_tier"),
    lockedVisaRatePerPersonPkr: integer("locked_visa_rate_per_person_pkr"),
    calculatedVisaTotalPkr: integer("calculated_visa_total_pkr"),

    // Flight Configuration & Airport Rules
    citySequence: citySequenceEnum("city_sequence"),
    entryAirport: varchar("entry_airport", { length: 3 }),
    exitAirport: varchar("exit_airport", { length: 3 }),
    departureCityId: uuid("departure_city_id").references(
      () => departureCities.id
    ),
    flightRouteType: flightRouteTypeEnum("flight_route_type"),
    cabinClass: cabinClassEnum("cabin_class"),
    preferredAirlineId: uuid("preferred_airline_id").references(
      () => airlines.id
    ),

    // Group Package or Hajj Links
    groupPackageId: uuid("group_package_id").references(() => groupPackages.id),
    groupDepartureId: uuid("group_departure_id").references(
      () => groupDepartures.id
    ),
    selectedRoomType: roomTypeEnum("selected_room_type"),
    hajjConsultationType: text("hajj_consultation_type"),

    // Ziyarat Selection
    ziyaratScope: ziyaratScopeEnum("ziyarat_scope"),
    ziyaratVehicleId: uuid("ziyarat_vehicle_id").references(() => vehicles.id),
    selectedZiyaratPlaceIds: jsonb("selected_ziyarat_place_ids")
      .$type<string[]>()
      .notNull()
      .default([]),

    // Administrative Pipeline Tracking
    assignedStaffUserId: text("assigned_staff_user_id").references(
      () => user.id
    ),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    quoteSentAt: timestamp("quote_sent_at", { withTimezone: true }),
    decisionAt: timestamp("decision_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_app_ref_number").on(table.referenceNumber),
    index("idx_app_phone").on(table.customerPhone),
    index("idx_app_status").on(table.status),
    index("idx_app_created").on(table.createdAt),
    index("idx_app_assigned_staff").on(table.assignedStaffUserId),
  ]
);

// ==========================================
// 11. APPLICATION CHILD TABLES (STAYS, SEGMENTS, QUOTES)
// ==========================================

export const applicationHotelStays = pgTable(
  "application_hotel_stays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    stayOrder: integer("stay_order").notNull(),
    city: cityNameEnum("city").notNull(),
    hotelId: uuid("hotel_id")
      .notNull()
      .references(() => hotels.id),
    checkInDate: date("check_in_date").notNull(),
    checkOutDate: date("check_out_date").notNull(),
    nights: integer("nights").notNull(),
    roomCategory: roomCategoryEnum("room_category")
      .notNull()
      .default("private"),
    sharedRoomType: roomTypeEnum("shared_room_type"),
    privateRoomAllocation: jsonb("private_room_allocation")
      .$type<{ double: number; triple: number; quad: number }>()
      .default({ double: 0, triple: 0, quad: 0 }),
    mealPlan: mealPlanTypeEnum("meal_plan").notNull().default("room_only"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_stay_app_id").on(table.applicationId),
    index("idx_stay_hotel_id").on(table.hotelId),
  ]
);

export const applicationTransportSegments = pgTable(
  "application_transport_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    segmentOrder: integer("segment_order").notNull(),
    sectorId: uuid("sector_id")
      .notNull()
      .references(() => transportSectors.id),
    serviceType: transportServiceTypeEnum("service_type")
      .notNull()
      .default("private"),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),
    vehicleQuantity: integer("vehicle_quantity").notNull().default(1),
    scheduledDate: date("scheduled_date"),
    pickupTime: varchar("pickup_time", { length: 5 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_segment_app_id").on(table.applicationId),
    index("idx_segment_sector_id").on(table.sectorId),
  ]
);

export const applicationQuotes = pgTable(
  "application_quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    visaTotalPkr: integer("visa_total_pkr").notNull().default(0),
    flightsTotalPkr: integer("flights_total_pkr").notNull().default(0),
    makkahHotelTotalPkr: integer("makkah_hotel_total_pkr").notNull().default(0),
    madinahHotelTotalPkr: integer("madinah_hotel_total_pkr").notNull().default(0),
    transportTotalPkr: integer("transport_total_pkr").notNull().default(0),
    ziyaratTotalPkr: integer("ziyarat_total_pkr").notNull().default(0),
    discountPkr: integer("discount_pkr").notNull().default(0),
    grandTotalPkr: integer("grand_total_pkr").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("PKR"),
    quoteNotesCustomer: text("quote_notes_customer"),
    internalNotesAdmin: text("internal_notes_admin"),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("unpaid"),
    amountPaidPkr: integer("amount_paid_pkr").notNull().default(0),
    quotedByUserId: text("quoted_by_user_id").references(() => user.id),
    quotedAt: timestamp("quoted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_quote_app_id").on(table.applicationId),
    index("idx_quote_payment_status").on(table.paymentStatus),
  ]
);

// ==========================================
// 12. PUBLIC CMS & MESSAGES
// ==========================================

export const heroSlides = pgTable(
  "hero_slides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    badge: text("badge"),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    imageUrl: text("image_url").notNull(),
    primaryCtaLabel: text("primary_cta_label")
      .notNull()
      .default("Plan Custom Umrah"),
    primaryCtaUrl: text("primary_cta_url").notNull().default("#custom-builder"),
    secondaryCtaLabel: text("secondary_cta_label").default("Explore Packages"),
    secondaryCtaUrl: text("secondary_cta_url").default("#group-packages"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_hero_active").on(table.isActive),
    index("idx_hero_sort").on(table.sortOrder),
  ]
);

export const testimonials = pgTable(
  "testimonials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pilgrimName: text("pilgrim_name").notNull(),
    city: text("city").notNull(),
    quote: text("quote").notNull(),
    packageOrJourneyType: text("package_or_journey_type").notNull(),
    rating: integer("rating").notNull().default(5),
    avatarUrl: text("avatar_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_testimonial_active").on(table.isActive),
    index("idx_testimonial_featured").on(table.isFeatured),
  ]
);

export const faqs = pgTable(
  "faqs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: faqCategoryEnum("category").notNull().default("general"),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_faq_category").on(table.category),
    index("idx_faq_active").on(table.isActive),
  ]
);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }).notNull(),
    whatsapp: varchar("whatsapp", { length: 32 }),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: messageStatusEnum("status").notNull().default("unread"),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_contact_status").on(table.status),
    index("idx_contact_created").on(table.createdAt),
  ]
);

// ==========================================
// 13. DRIZZLE RELATIONS GRAPH
// ==========================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  assignedApplications: many(applications),
  quotesCreated: many(applicationQuotes),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const groupPackagesRelations = relations(groupPackages, ({ one, many }) => ({
  airline: one(airlines, {
    fields: [groupPackages.airlineId],
    references: [airlines.id],
  }),
  makkahHotel: one(hotels, {
    fields: [groupPackages.makkahHotelId],
    references: [hotels.id],
  }),
  madinahHotel: one(hotels, {
    fields: [groupPackages.madinahHotelId],
    references: [hotels.id],
  }),
  departures: many(groupDepartures),
  applications: many(applications),
}));

export const groupDeparturesRelations = relations(
  groupDepartures,
  ({ one, many }) => ({
    package: one(groupPackages, {
      fields: [groupDepartures.packageId],
      references: [groupPackages.id],
    }),
    departureCity: one(departureCities, {
      fields: [groupDepartures.departureCityId],
      references: [departureCities.id],
    }),
    applications: many(applications),
  })
);

export const applicationsRelations = relations(
  applications,
  ({ one, many }) => ({
    departureCity: one(departureCities, {
      fields: [applications.departureCityId],
      references: [departureCities.id],
    }),
    preferredAirline: one(airlines, {
      fields: [applications.preferredAirlineId],
      references: [airlines.id],
    }),
    groupPackage: one(groupPackages, {
      fields: [applications.groupPackageId],
      references: [groupPackages.id],
    }),
    groupDeparture: one(groupDepartures, {
      fields: [applications.groupDepartureId],
      references: [groupDepartures.id],
    }),
    ziyaratVehicle: one(vehicles, {
      fields: [applications.ziyaratVehicleId],
      references: [vehicles.id],
    }),
    assignedStaff: one(user, {
      fields: [applications.assignedStaffUserId],
      references: [user.id],
    }),
    hotelStays: many(applicationHotelStays),
    transportSegments: many(applicationTransportSegments),
    quotes: many(applicationQuotes),
  })
);

export const applicationHotelStaysRelations = relations(
  applicationHotelStays,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationHotelStays.applicationId],
      references: [applications.id],
    }),
    hotel: one(hotels, {
      fields: [applicationHotelStays.hotelId],
      references: [hotels.id],
    }),
  })
);

export const applicationTransportSegmentsRelations = relations(
  applicationTransportSegments,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationTransportSegments.applicationId],
      references: [applications.id],
    }),
    sector: one(transportSectors, {
      fields: [applicationTransportSegments.sectorId],
      references: [transportSectors.id],
    }),
    vehicle: one(vehicles, {
      fields: [applicationTransportSegments.vehicleId],
      references: [vehicles.id],
    }),
  })
);

export const applicationQuotesRelations = relations(
  applicationQuotes,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationQuotes.applicationId],
      references: [applications.id],
    }),
    quotedByUser: one(user, {
      fields: [applicationQuotes.quotedByUserId],
      references: [user.id],
    }),
  })
);
```

### State transitions

The platform models four distinct state machines:

```
1. Application Lifecycle State Machine:
   [pending_quote] (Public submission / lead captured)
        |
        v
    [quoted] (Staff enters rates in Quote Worksheet & dispatches)
      /    \
     /      \
    v        v
[approved] [rejected] / [cancelled]
    |
    v (Approved marks booking confirmed and locks seat in group departures if applicable)

2. Group Departure Seat Occupancy State Machine:
   [open] (Available seats > 20% of capacity)
     |
     v (Booked seats reach 80% of total capacity)
   [filling_fast]
     |
     v (Booked seats == totalSeats)
   [sold_out]
     |
     v (Manual admin closing or departure date passed)
   [closed]

3. Application Quote Payment State Machine:
   [unpaid] (Quote issued; zero payment recorded)
     |
     v (0 < amountPaidPkr < grandTotalPkr)
   [partially_paid]
     |
     v (amountPaidPkr >= grandTotalPkr)
   [paid_in_full]

4. Contact Message Read Status:
   [unread] -> [read] -> [replied] -> [archived]
```

### API surface & Server Actions

| Action / Route | Type | Inputs | Outputs | Auth | Error Handling |
|---|---|---|---|---|---|
| `submitCustomApplicationAction` | Server Action | Validated `ApplicationInput` Zod object | `{ success: true, referenceNumber: string }` | Public | 400 Bad Request, 500 Server Error |
| `submitGroupBookingAction` | Server Action | Validated `GroupBookingInput` Zod object | `{ success: true, referenceNumber: string }` | Public | 400 Validation, 409 Sold Out |
| `submitHajjInquiryAction` | Server Action | Validated `HajjInquiryInput` Zod object | `{ success: true, referenceNumber: string }` | Public | 400 Validation |
| `lookupApplicationStatusAction` | Server Action | `referenceNumber: string`, `phone: string` | Sanitized application view + live quote | Public | 404 Not Found, 401 Phone Mismatch |
| `updateApplicationQuoteAction` | Server Action | Validated `QuoteUpdateInput` Zod object | `{ success: true, quoteId: string }` | Staff / Admin | 401 Unauthorized, 404 Not Found |
| `updateApplicationStatusAction` | Server Action | `applicationId: string`, `status: ApplicationStatus` | `{ success: true }` | Staff / Admin | 401 Unauthorized, 400 Invalid Transition |
| `updateInventoryItemAction` | Server Action | Catalog type, entity ID, payload | `{ success: true, item: object }` | Admin | 401 Unauthorized, 403 Forbidden |
| `submitContactMessageAction` | Server Action | Validated `ContactMessageInput` | `{ success: true }` | Public | 400 Bad Request |

### Value sourcing

Every value computed or displayed traces to a verified source:

| Action / Surface | Value Produced or Displayed | Authoritative Source |
|---|---|---|
| Custom Builder Visa Output | `calculatedVisaTier` (`short_term` or `long_term`) | Computed via `calculateVisaTierAndCost(ksaArrivalDate, ksaDepartureDate)` |
| Custom Builder Visa Output | `calculatedVisaTotalPkr` | `pricePkr` from `visa_rates` $\times$ `totalPassportCount` |
| Itinerary Live Summary Card | Fixed price total or `"Live Rate — Confirmed upon submission"` | `presetMode === 'visa_only'` ? `calculatedVisaTotalPkr` : Live rate label |
| Flight Module Airport Lock | `entryAirport: 'JED'` | Invariant enforced by `chainItineraryDates`: if first city is Makkah, airport locks to `JED` |
| Hotel Room Allocation | `double`, `triple`, `quad` counts | Computed by `calculatePrivateRoomSplits(bedAndSeatCount)` |
| Vehicle Quantity Field | `vehicleQuantity` integer | Computed by `calculateVehicleQuantity(bedAndSeatCount, vehicle)` |
| Quote Worksheet Pre-fill | `visaTotalPkr` line item | Pre-filled automatically from `applications.calculatedVisaTotalPkr` |
| Quote Grand Total | `grandTotalPkr` integer | Derived: `visa + flights + makkah + madinah + transport + ziyarat - discount` |
| Executive SLA Overdue Alert | Overdue badge on pending applications | Computed from `applications.createdAt` vs `agency_settings.slaOverdueHours` (24h default) |

### Key invariants

1. **Passenger Count Separation**: `totalPassportCount = adults + children + infants`. `bedAndSeatCount = adults + children`. Infants under 2 years require a visa and flight ticket but occupy 0 hotel beds and 0 vehicle seats.
2. **Visa Duration Tier Threshold**: If the calendar span from KSA Arrival to KSA Departure is 30 days or fewer, the tier is strictly `short_term`. If greater than 30 days, the tier is strictly `long_term`. Customers never choose their visa tier manually.
3. **Airport Geography Invariant**: Makkah has no civilian airport. Any itinerary with Makkah as its first destination strictly locks `entryAirport` to Jeddah (`JED`). If the first destination is Madinah, `entryAirport` defaults to Prince Mohammad bin Abdulaziz Airport (`MED`).
4. **Visa Pricing Display Exclusivity**: An immediate fixed PKR price is displayed to the public customer only when `presetMode === 'visa_only'`. Whenever volatile components (flights, hotels, transport, ziyarat) are included, the UI displays the Live Itinerary Summary Card with `"Live Rate — Confirmed upon submission"`.
5. **Private Room Allocation Parity**: Private hotel rooms must accommodate all `bedAndSeatCount` passengers. Standard bed capacities: Double = 2, Triple = 3, Quad = 4. A solo traveler in a private room is allocated 1 Double room.
6. **Vehicle Capacity and Booking Modes**: Road vehicle passenger seats are measured against `bedAndSeatCount`. Vehicles designated `private_only` permit custom pickup times. Shared vehicles and train bookings operate on scheduled group timetables and do not accept custom pickup times.
7. **Monetary Integer Storage**: All monetary figures (`pricePkr`, `grandTotalPkr`, `amountPaidPkr`, etc.) are stored as non-negative integers representing whole Pakistani Rupees. No floating-point currencies are permitted in the database.

### Pure Domain Modules (`lib/domain/`)

The build implements four pure calculation functions:

```typescript
// lib/domain/visa.ts
export interface VisaRateTiers {
  shortTermPricePkr: number;
  longTermPricePkr: number;
}

export interface VisaCalculationResult {
  totalKsaDays: number;
  tier: "short_term" | "long_term";
  pricePerPassportPkr: number;
  totalVisaCostPkr: number;
}

export function calculateVisaTierAndCost(
  arrivalDateStr: string,
  departureDateStr: string,
  totalPassports: number,
  rates: VisaRateTiers
): VisaCalculationResult {
  const arrival = new Date(arrivalDateStr);
  const departure = new Date(departureDateStr);
  const diffTime = departure.getTime() - arrival.getTime();
  const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

  const tier = diffDays <= 30 ? "short_term" : "long_term";
  const pricePerPassportPkr =
    tier === "short_term" ? rates.shortTermPricePkr : rates.longTermPricePkr;
  const totalVisaCostPkr = pricePerPassportPkr * Math.max(1, totalPassports);

  return {
    totalKsaDays: diffDays,
    tier,
    pricePerPassportPkr,
    totalVisaCostPkr,
  };
}

// lib/domain/rooms.ts
export interface RoomSplitOption {
  double: number;
  triple: number;
  quad: number;
  totalRooms: number;
  totalBeds: number;
}

export function calculatePrivateRoomSplits(bedCount: number): {
  primaryAllocation: RoomSplitOption;
  validAlternatives: RoomSplitOption[];
} {
  if (bedCount <= 1) {
    const solo = { double: 1, triple: 0, quad: 0, totalRooms: 1, totalBeds: 2 };
    return { primaryAllocation: solo, validAlternatives: [] };
  }

  const validSplits: RoomSplitOption[] = [];

  // Generate combinations of Quad (4), Triple (3), Double (2)
  for (let q = 0; q <= Math.ceil(bedCount / 4); q++) {
    for (let t = 0; t <= Math.ceil(bedCount / 3); t++) {
      for (let d = 0; d <= Math.ceil(bedCount / 2); d++) {
        const capacity = q * 4 + t * 3 + d * 2;
        if (capacity >= bedCount && capacity <= bedCount + 2) {
          validSplits.push({
            quad: q,
            triple: t,
            double: d,
            totalRooms: q + t + d,
            totalBeds: capacity,
          });
        }
      }
    }
  }

  // Sort splits: first by lowest wasted beds, then by fewest rooms, then preferring quads
  validSplits.sort((a, b) => {
    const wasteA = a.totalBeds - bedCount;
    const wasteB = b.totalBeds - bedCount;
    if (wasteA !== wasteB) return wasteA - wasteB;
    if (a.totalRooms !== b.totalRooms) return a.totalRooms - b.totalRooms;
    return b.quad - a.quad;
  });

  const primary = validSplits[0] ?? {
    quad: Math.ceil(bedCount / 4),
    triple: 0,
    double: 0,
    totalRooms: Math.ceil(bedCount / 4),
    totalBeds: Math.ceil(bedCount / 4) * 4,
  };

  return {
    primaryAllocation: primary,
    validAlternatives: validSplits.slice(1, 4),
  };
}

// lib/domain/dates.ts
export interface ChainedStay {
  city: "makkah" | "madinah";
  checkInDate: string;
  checkOutDate: string;
  nights: number;
}

export function chainItineraryDates(
  sequence: "makkah_madinah" | "madinah_makkah" | "makkah_madinah_makkah" | "makkah_only" | "madinah_only",
  arrivalDateStr: string,
  staysConfig: { city: "makkah" | "madinah"; nights: number }[]
): {
  entryAirport: "JED" | "MED";
  chainedStays: ChainedStay[];
  finalDepartureDate: string;
} {
  const entryAirport: "JED" | "MED" =
    sequence.startsWith("makkah") ? "JED" : "MED";

  let currentDate = new Date(arrivalDateStr);
  const chainedStays: ChainedStay[] = [];

  for (const stay of staysConfig) {
    const checkIn = new Date(currentDate);
    const checkOut = new Date(currentDate);
    checkOut.setDate(checkOut.getDate() + stay.nights);

    chainedStays.push({
      city: stay.city,
      checkInDate: checkIn.toISOString().split("T")[0]!,
      checkOutDate: checkOut.toISOString().split("T")[0]!,
      nights: stay.nights,
    });

    currentDate = checkOut;
  }

  return {
    entryAirport,
    chainedStays,
    finalDepartureDate: currentDate.toISOString().split("T")[0]!,
  };
}

// lib/domain/vehicles.ts
export function calculateVehicleQuantity(
  seatCount: number,
  vehicle: {
    seatCapacity: number;
    bookingMode: "private_only" | "shared_and_private" | "shared_only";
  }
): {
  requiredQuantity: number;
  suggestUpgrade: boolean;
  recommendedCategory?: string;
} {
  if (vehicle.bookingMode === "shared_only") {
    return { requiredQuantity: seatCount, suggestUpgrade: false };
  }

  const count = Math.ceil(seatCount / Math.max(1, vehicle.seatCapacity));
  const suggestUpgrade = count > 1 && seatCount <= 10;

  let recommendedCategory: string | undefined;
  if (suggestUpgrade) {
    if (seatCount <= 5) recommendedCategory = "suv";
    else if (seatCount <= 7) recommendedCategory = "van";
    else if (seatCount <= 10) recommendedCategory = "van_hiace";
  }

  return {
    requiredQuantity: count,
    suggestUpgrade,
    recommendedCategory,
  };
}
```

### Runtime Zod Validation Layer (`lib/validations/`)

```typescript
// lib/validations/application.ts
import { z } from "zod";

export const passengerCountsSchema = z.object({
  adults: z.number().int().min(1, "At least 1 adult is required"),
  children: z.number().int().min(0).default(0),
  infants: z.number().int().min(0).default(0),
});

export const customerContactSchema = z.object({
  customerName: z.string().trim().min(3, "Name must be at least 3 characters"),
  customerPhone: z.string().trim().regex(/^\+?[0-9\s-]{10,18}$/, "Valid phone number required"),
  customerWhatsapp: z.string().trim().regex(/^\+?[0-9\s-]{10,18}$/, "Valid WhatsApp number required"),
  customerCity: z.string().trim().min(2, "City is required"),
  customerEmail: z.string().trim().email("Invalid email format").optional().or(z.literal("")),
  specialRequests: z.string().trim().max(1000).optional(),
});

export const customJourneyApplicationSchema = z.object({
  presetMode: z.enum([
    "complete_umrah",
    "visa_only",
    "hotels_only",
    "transport_only",
    "custom_mix",
  ]),
  includeVisa: z.boolean(),
  includeFlights: z.boolean(),
  includeHotels: z.boolean(),
  includeTransport: z.boolean(),
  includeZiyarat: z.boolean(),

  passengers: passengerCountsSchema,
  contact: customerContactSchema,

  ksaArrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD").optional(),
  ksaDepartureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD").optional(),

  citySequence: z.enum([
    "makkah_madinah",
    "madinah_makkah",
    "makkah_madinah_makkah",
    "makkah_only",
    "madinah_only",
  ]).optional(),
  departureCityId: z.string().uuid().optional(),
  preferredAirlineId: z.string().uuid().optional(),
  flightRouteType: z.enum(["direct", "connecting"]).optional(),
  cabinClass: z.enum(["economy", "business"]).optional(),

  hotelStays: z.array(
    z.object({
      stayOrder: z.number().int().min(1).max(3),
      city: z.enum(["makkah", "madinah"]),
      hotelId: z.string().uuid(),
      nights: z.number().int().min(1).max(60),
      roomCategory: z.enum(["shared", "private"]),
      sharedRoomType: z.enum(["double", "triple", "quad"]).optional(),
      privateRoomAllocation: z.object({
        double: z.number().int().min(0),
        triple: z.number().int().min(0),
        quad: z.number().int().min(0),
      }).optional(),
      mealPlan: z.enum(["room_only", "breakfast", "half_board", "full_board"]),
    })
  ).optional(),

  transportSegments: z.array(
    z.object({
      segmentOrder: z.number().int().min(1),
      sectorId: z.string().uuid(),
      serviceType: z.enum(["private", "shared"]),
      vehicleId: z.string().uuid(),
      scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      pickupTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    })
  ).optional(),

  ziyaratScope: z.enum(["makkah_only", "madinah_only", "both"]).optional(),
  ziyaratVehicleId: z.string().uuid().optional(),
  selectedZiyaratPlaceIds: z.array(z.string().uuid()).optional(),
});

// lib/validations/quote.ts
export const quoteUpdateSchema = z.object({
  applicationId: z.string().uuid(),
  visaTotalPkr: z.number().int().min(0),
  flightsTotalPkr: z.number().int().min(0),
  makkahHotelTotalPkr: z.number().int().min(0),
  madinahHotelTotalPkr: z.number().int().min(0),
  transportTotalPkr: z.number().int().min(0),
  ziyaratTotalPkr: z.number().int().min(0),
  discountPkr: z.number().int().min(0).default(0),
  quoteNotesCustomer: z.string().max(2000).optional(),
  internalNotesAdmin: z.string().max(2000).optional(),
  paymentStatus: z.enum(["unpaid", "partially_paid", "paid_in_full"]).default("unpaid"),
  amountPaidPkr: z.number().int().min(0).default(0),
  validUntilDays: z.number().int().min(1).max(30).default(7),
});

// lib/validations/status-lookup.ts
export const statusLookupSchema = z.object({
  referenceNumber: z.string().trim().regex(/^ART-\d{4}-[A-Z0-9]{4,6}$/i, "Format: ART-2026-XXXX"),
  customerPhone: z.string().trim().min(7, "Enter matching phone number"),
});
```

### Security model

- **Public Access**: Visitors can submit custom applications, group booking requests, Hajj inquiries, contact messages, and read active inventory catalogs (`hotels`, `vehicles`, `ziyarat_places`, `airlines`, `departure_cities`, `group_packages`).
- **Application Tracking Protection**: The public status tracker requires matching both `referenceNumber` and `customerPhone`. The returned payload strips all internal staff notes, admin IDs, and margins.
- **Administrative Access**: Admin portal mutations (editing visa rates, catalog inventory, quote worksheets, application statuses, and CMS items) require an active Better Auth session.
- **Role Isolation**: Only `super_admin` can create or deactivate staff accounts and modify global agency settings. Both `super_admin` and `staff` can manage applications, inventory items, and issue quotes.

### Configuration required

- `DATABASE_URL`: Connection URI string for Neon Serverless PostgreSQL with SSL enabled.
- `BETTER_AUTH_SECRET`: Minimum 32-character encryption key for signing session tokens and credentials.
- `BETTER_AUTH_URL`: Canonical public URL (e.g. `http://localhost:3000` for development, `https://alramlahtravels.com` for production).

### Critical test scenarios

- **Happy Path: Custom Journey Application with Visa and Stays**: User submits a 14-day itinerary (`makkah_madinah`, 2 adults, 1 infant). System computes `short_term` visa tier, locks `entryAirport = 'JED'`, stores application with `ART-2026-XXXX`, persists 2 hotel stays, calculates `bedAndSeatCount = 2`, and pre-fills visa cost in draft quote, verifies **AC-4**, **AC-11**, **AC-12**, **AC-13**.
- **Failure Case: Makkah Airport Lockdown**: Client submits payload attempting to set `entryAirport: 'MED'` or an invalid airport for an itinerary starting with Makkah. Server validation rejects or auto-corrects to `JED`, verifies **AC-11**, **AC-14**.
- **Edge Case: Visa Tier Threshold Boundary (30 Days vs 31 Days)**: A 30-day stay (e.g. 2026-11-01 to 2026-11-30) resolves strictly to `short_term`. A 31-day stay (e.g. 2026-11-01 to 2026-12-01) resolves strictly to `long_term`, verifies **AC-4**, **AC-13**.
- **Edge Case: Private Room Auto-Allocation for 7 Pax**: Group of 7 adults + children request private rooms. Algorithm yields optimal allocation: 1 Quad (4) + 1 Triple (3) = 7 beds across 2 rooms, verifies **AC-6**, **AC-13**.
- **Auth & Permission: Unauthenticated Catalog Modification**: Non-authenticated request attempts to invoke `updateInventoryItemAction`. Request is denied with HTTP 401 Unauthorized, verifies **AC-2**.

## Build plan

The build plan executes Feature 3 (`Data model`) under the Beta workflow tier (`/architect` -> `/develop` -> `/check verify` -> `/test` -> `/sync`):

1. **Scaffold PostgreSQL Schema Primitives and Enums**: Create `db/schema.ts` defining all 18 PostgreSQL enums, table schemas, relations, and table index declarations, satisfies **AC-1**, **AC-2**, **AC-3**.
2. **Implement Catalog and Reference Tables**: Define `visa_rates`, `airlines`, `departure_cities`, `hotels`, `vehicles`, `transport_sectors`, and `ziyarat_places` with all locked columns and types, satisfies **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**.
3. **Implement Packages, Applications, Stays, Segments, and Quotes**: Define `group_packages`, `group_departures`, `applications`, `application_hotel_stays`, `application_transport_segments`, and `application_quotes` with foreign keys and cascade rules, satisfies **AC-10**, **AC-11**, **AC-12**.
4. **Implement Public CMS and Contact Inbox Tables**: Define `hero_slides`, `testimonials`, `faqs`, and `contact_messages` with status and sorting indexes, satisfies **AC-1**.
5. **Implement Pure Domain Calculation Modules**: Create `lib/domain/visa.ts`, `lib/domain/rooms.ts`, `lib/domain/dates.ts`, and `lib/domain/vehicles.ts` with comprehensive unit test coverage, satisfies **AC-13**.
6. **Implement Zod Validation Contracts**: Create `lib/validations/application.ts`, `lib/validations/quote.ts`, `lib/validations/inventory.ts`, `lib/validations/cms.ts`, and `lib/validations/status-lookup.ts`, satisfies **AC-14**.
7. **Create Seed Script with Realistic Al Ramlah Travels Data**: Write `db/seed.ts` seeding administrative accounts, default agency settings, 2 visa rate tiers, 7 airlines, 8 Pakistani departure cities, 10 named hotels, 9 vehicles (including Haramain Train), 7 transport sectors, 13 ziyarat places, 4 group packages with departures, 3 hero slides, 4 testimonials, and 6 FAQs, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**.
8. **Verify Drizzle Migration and Database Push**: Execute `npx drizzle-kit generate` and push to Neon PostgreSQL, verifying schema integrity, satisfies **AC-1**.

## Consequences

**Positive**:
- End-to-end type safety spanning database tables, relations, server actions, and UI components.
- Complete domain invariants (airport lockdown, visa calculation, room splits) are enforced centrally, eliminating client-side tampering risks.
- Clean separation between pure domain math and database access allows robust testing without database mocking.
- Scalable foundation ready for all subsequent feature slices (Custom Journey Builder, Admin Worksheet, Catalog Manager, Group Packages, CMS).

**Negative / tradeoffs**:
- A normalized schema with 17 tables requires structured relational joins when loading deep application records.
- Schema adjustments during development require running `drizzle-kit generate` and `drizzle-kit migrate`.

**Neutral**:
- Database operations require an active Neon Serverless PostgreSQL connection string in `.env.local`.

## Follow-up

- [ ] Ensure `DATABASE_URL` is set in `.env.local` prior to executing `drizzle-kit push` or seed execution in `/develop`.
- [ ] In Slice 1 (`Core quote loop & admin sign in`), wire Better Auth route handler at `app/api/auth/[...all]/route.ts` against the `user`, `session`, and `account` tables defined in this spec.
- [ ] In Slice 2 (`Custom journey builder modules`), import the pure domain helpers directly into the client journey state store for live responsive feedback.

## References

**Project sources**:
- `AGENTS.md`: Stack definition (Next.js 16, Neon PostgreSQL, Drizzle ORM, Better Auth, Zod)
- `docs/scope/scope.md`: Feature 3 acceptance seeds and milestone definitions
- `.agents/skills/better-auth-best-practices/`: Better Auth Drizzle PostgreSQL adapter conventions
- `.agents/skills/create-auth/`: Route handler scaffolding and migration patterns

**Practices & standards**:
- Single-currency integer monetary representation (PKR whole units) to prevent IEEE 754 floating-point errors
- Functional core, imperative shell (pure domain modules isolated from database effects)
- Normalized relational modeling with explicit foreign key cascading and multi-column indexes
