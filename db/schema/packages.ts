import { relations, sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { airlines, departureCities, hotels } from "./catalog"
import { applications } from "./applications"

// ==========================================
// GROUP PACKAGES ENUM DEFINITIONS
// ==========================================

export const packageTierEnum = pgEnum("package_tier", [
  "economy",
  "bronze",
  "silver",
  "gold",
  "vip_5star",
])

export const groupDepartureStatusEnum = pgEnum("group_departure_status", [
  "open",
  "filling_fast",
  "sold_out",
  "closed",
])

// ==========================================
// GROUP PACKAGES & DEPARTURE BATCHES
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
    quadPricePkr: bigint("quad_price_pkr", { mode: "number" }).notNull(),
    triplePricePkr: bigint("triple_price_pkr", { mode: "number" }).notNull(),
    doublePricePkr: bigint("double_price_pkr", { mode: "number" }).notNull(),
    sharingPricePkr: bigint("sharing_price_pkr", { mode: "number" })
      .notNull()
      .default(258299),
    infantPricePkr: bigint("infant_price_pkr", { mode: "number" })
      .notNull()
      .default(65000),
    giftedInclusions: jsonb("gifted_inclusions")
      .$type<string[]>()
      .notNull()
      .default([]),
    multiHotelOptions: jsonb("multi_hotel_options")
      .$type<
        Array<{
          pkgCode: string
          label: string
          makkahHotelName: string
          makkahDistance: string
          madinahHotelName: string
          madinahDistance: string
          sharingPricePkr: number
          quadPricePkr: number
          triplePricePkr: number
          doublePricePkr: number
        }>
      >()
      .notNull()
      .default([]),
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
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_package_tier").on(table.tier),
    index("idx_package_active").on(table.isActive),
    index("idx_package_featured").on(table.isFeatured),
    check(
      "chk_group_packages_durations_and_prices",
      sql`${table.durationDays} >= 1 AND ${table.makkahNights} >= 0 AND ${table.madinahNights} >= 0 AND ${table.quadPricePkr} >= 0 AND ${table.triplePricePkr} >= 0 AND ${table.doublePricePkr} >= 0 AND ${table.sharingPricePkr} >= 0 AND ${table.infantPricePkr} >= 0`
    ),
  ]
)

export const groupDepartures = pgTable(
  "group_departures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => groupPackages.id, { onDelete: "restrict" }),
    batchCode: varchar("batch_code", { length: 32 }).notNull().unique(),
    departureCityId: uuid("departure_city_id")
      .notNull()
      .references(() => departureCities.id),
    departureDate: date("departure_date").notNull(),
    returnDate: date("return_date").notNull(),
    totalSeats: integer("total_seats").notNull(),
    bookedSeats: integer("booked_seats").notNull().default(0),
    status: groupDepartureStatusEnum("status").notNull().default("open"),
    quadPriceOverridePkr: bigint("quad_price_override_pkr", { mode: "number" }),
    triplePriceOverridePkr: bigint("triple_price_override_pkr", {
      mode: "number",
    }),
    doublePriceOverridePkr: bigint("double_price_override_pkr", {
      mode: "number",
    }),
    sharingPriceOverridePkr: bigint("sharing_price_override_pkr", {
      mode: "number",
    }),
    outboundFlightNumber: text("outbound_flight_number"),
    returnFlightNumber: text("return_flight_number"),
    flightScheduleSummary: text("flight_schedule_summary"),
    routingNote: text("routing_note"),
    baggageAllowance: text("baggage_allowance").default(
      "23-KG Outbound / 46-KG Return"
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_departure_package").on(table.packageId),
    index("idx_departure_date").on(table.departureDate),
    index("idx_departure_status").on(table.status),
    check(
      "chk_group_departures_seats_and_dates",
      sql`${table.totalSeats} > 0 AND ${table.bookedSeats} >= 0 AND ${table.bookedSeats} <= ${table.totalSeats} AND ${table.returnDate} >= ${table.departureDate}`
    ),
  ]
)

// ==========================================
// HAJJ 2027 INDICATIVE PACKAGES (`OD-09e`)
// ==========================================

export const hajjPackages = pgTable(
  "hajj_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 96 }).notNull().unique(),
    title: text("title").notNull(),
    seasonYear: integer("season_year").notNull().default(2027),
    maktabTier: varchar("maktab_tier", { length: 32 }).notNull().default("A"),
    durationDays: integer("duration_days").notNull().default(21),
    makkahHotelName: text("makkah_hotel_name").notNull(),
    makkahDistanceLabel: text("makkah_distance_label").notNull(),
    madinahHotelName: text("madinah_hotel_name").notNull(),
    madinahDistanceLabel: text("madinah_distance_label").notNull(),
    aziziyahStayNotes: text("aziziyah_stay_notes"),
    indicativeSharingPkr: bigint("indicative_sharing_pkr", {
      mode: "number",
    }).notNull(),
    indicativeQuadPkr: bigint("indicative_quad_pkr", { mode: "number" }),
    indicativeTriplePkr: bigint("indicative_triple_pkr", { mode: "number" }),
    indicativeDoublePkr: bigint("indicative_double_pkr", { mode: "number" }),
    isIndicative: boolean("is_indicative").notNull().default(true),
    regulatoryDisclaimer: text("regulatory_disclaimer")
      .notNull()
      .default(
        "Indicative 2027 package structure — final Maktab tariff & quota subject to Saudi Ministry of Hajj & Umrah and Pakistan MORA announcement."
      ),
    highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_hajj_packages_active_sort").on(table.isActive, table.sortOrder),
    check(
      "chk_hajj_packages_positive_prices",
      sql`${table.durationDays} >= 1 AND ${table.indicativeSharingPkr} >= 0`
    ),
  ]
)

export type HajjPackage = typeof hajjPackages.$inferSelect
export type NewHajjPackage = typeof hajjPackages.$inferInsert

// ==========================================
// DRIZZLE RELATIONS GRAPH
// ==========================================

export const groupPackagesRelations = relations(
  groupPackages,
  ({ one, many }) => ({
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
  })
)

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
)
