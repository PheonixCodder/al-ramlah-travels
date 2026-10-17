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
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import {
  airlines,
  cityNameEnum,
  departureCities,
  hotels,
  mealPlanTypeEnum,
  roomCategoryEnum,
  roomTypeEnum,
  transportSectors,
  vehicles,
  visaTierEnum,
} from "./catalog"
import { groupDepartures, groupPackages } from "./packages"

// ==========================================
// APPLICATION ENUMS
// ==========================================

export const applicationSourceEnum = pgEnum("application_source", [
  "custom_builder",
  "group_booking",
  "hajj_inquiry",
])

export const applicationStatusEnum = pgEnum("application_status", [
  "pending_quote",
  "quoted",
  "approved",
  "rejected",
  "cancelled",
])

export const builderPresetModeEnum = pgEnum("builder_preset_mode", [
  "complete_umrah",
  "visa_only",
  "hotels_only",
  "transport_only",
  "custom_mix",
  "group_package",
  "hajj_consultation",
])

export const citySequenceEnum = pgEnum("city_sequence", [
  "makkah_madinah",
  "madinah_makkah",
  "makkah_madinah_makkah",
  "makkah_only",
  "madinah_only",
])

export const flightRouteTypeEnum = pgEnum("flight_route_type", [
  "direct",
  "connecting",
])

export const cabinClassEnum = pgEnum("cabin_class", ["economy", "business"])

export const transportServiceTypeEnum = pgEnum("transport_service_type", [
  "private",
  "shared",
])

export const ziyaratScopeEnum = pgEnum("ziyarat_scope", [
  "makkah_only",
  "madinah_only",
  "both",
])

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "partially_paid",
  "paid_in_full",
])

// ==========================================
// APPLICATIONS TABLE
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
)

// ==========================================
// APPLICATION HOTEL STAYS
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
)

// ==========================================
// APPLICATION TRANSPORT SEGMENTS
// ==========================================

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
)

// ==========================================
// APPLICATION QUOTES
// ==========================================

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
    madinahHotelTotalPkr: integer("madinah_hotel_total_pkr")
      .notNull()
      .default(0),
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
)

// ==========================================
// DRIZZLE RELATIONS GRAPH
// ==========================================

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
)

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
)

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
)

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
)
