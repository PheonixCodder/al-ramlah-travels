import { relations } from "drizzle-orm"
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
    quadPricePkr: integer("quad_price_pkr").notNull(),
    triplePricePkr: integer("triple_price_pkr").notNull(),
    doublePricePkr: integer("double_price_pkr").notNull(),
    sharingPricePkr: integer("sharing_price_pkr").notNull().default(258299),
    infantPricePkr: integer("infant_price_pkr").notNull().default(65000),
    giftedInclusions: jsonb("gifted_inclusions").$type<string[]>().notNull().default([]),
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
      .defaultNow(),
  },
  (table) => [
    index("idx_package_tier").on(table.tier),
    index("idx_package_active").on(table.isActive),
    index("idx_package_featured").on(table.isFeatured),
  ]
)

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
    sharingPriceOverridePkr: integer("sharing_price_override_pkr"),
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
      .defaultNow(),
  },
  (table) => [
    index("idx_departure_package").on(table.packageId),
    index("idx_departure_date").on(table.departureDate),
    index("idx_departure_status").on(table.status),
  ]
)

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
