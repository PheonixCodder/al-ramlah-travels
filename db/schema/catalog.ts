import {
  boolean,
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
import { user } from "./auth"

// ==========================================
// CATALOG ENUM DEFINITIONS
// ==========================================

export const visaTierEnum = pgEnum("visa_tier", ["short_term", "long_term"])

export const cityNameEnum = pgEnum("city_name", ["makkah", "madinah"])

export const hotelAccessTypeEnum = pgEnum("hotel_access_type", [
  "walking",
  "shuttle",
])

export const mealPlanTypeEnum = pgEnum("meal_plan_type", [
  "room_only",
  "breakfast",
  "half_board",
  "full_board",
])

export const roomCategoryEnum = pgEnum("room_category", ["shared", "private"])

export const roomTypeEnum = pgEnum("room_type", ["double", "triple", "quad"])

export const vehicleCategoryEnum = pgEnum("vehicle_category", [
  "sedan",
  "suv",
  "van",
  "minibus",
  "bus",
  "train",
])

export const vehicleBookingModeEnum = pgEnum("vehicle_booking_mode", [
  "private_only",
  "shared_and_private",
  "shared_only",
])

export const sectorPointTypeEnum = pgEnum("sector_point_type", [
  "airport",
  "hotel",
])

// ==========================================
// DYNAMIC VISA PRICING
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
})

// ==========================================
// FLIGHTS REFERENCE CATALOG
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
)

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
)

// ==========================================
// DYNAMIC HOTELS & MEAL PLANS
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
)

// ==========================================
// VEHICLES & TRANSPORT SECTORS
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
)

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
)

// ==========================================
// SACRED ZIYARAT SITES
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
)
