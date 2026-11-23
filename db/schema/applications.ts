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
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { account, session, user } from "./auth"
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
import { marketingChannels, suppliers } from "./suppliers-and-marketing"

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

/**
 * Extended status value already provisioned in PostgreSQL `application_status` enum
 * (`0002_production_hardening_foundation.sql`) for W3B pilgrim quote-revision flows (`T-017`).
 */
export type ExtendedApplicationStatus =
  (typeof applicationStatusEnum.enumValues)[number] | "revision_requested"

export const REVISION_REQUESTED_STATUS =
  "revision_requested" as unknown as (typeof applicationStatusEnum.enumValues)[number]

export const builderPresetModeEnum = pgEnum("builder_preset_mode", [
  "complete_umrah",
  "visa_only",
  "flights_only",
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
  "makkah_madinah_jeddah",
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

export type ExtendedPaymentStatus =
  (typeof paymentStatusEnum.enumValues)[number] | "deposit_paid"

export const DEPOSIT_PAID_PAYMENT_STATUS =
  "deposit_paid" as unknown as (typeof paymentStatusEnum.enumValues)[number]

export const paymentMethodEnum = pgEnum("payment_method", [
  "bank_transfer",
  "cash_lahore_hq",
  "cheque_pay_order",
  "online_gateway",
  "other",
])

export const travellerCategoryEnum = pgEnum("traveller_category", [
  "adult",
  "child",
  "infant",
])

export const pilgrimDocumentTypeEnum = pgEnum("pilgrim_document_type", [
  "passport_bio_page",
  "national_id",
  "visa_photo",
])

export const pilgrimDocumentStatusEnum = pgEnum("pilgrim_document_status", [
  "missing",
  "uploaded",
  "approved",
  "reupload_requested",
  "purged",
])

export type TravellerCategory =
  (typeof travellerCategoryEnum.enumValues)[number]
export type PilgrimDocumentType =
  (typeof pilgrimDocumentTypeEnum.enumValues)[number]
export type PilgrimDocumentStatus =
  (typeof pilgrimDocumentStatusEnum.enumValues)[number]

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
    clientSubmissionId: varchar("client_submission_id", {
      length: 64,
    }).unique(),
    voucherToken: varchar("voucher_token", { length: 128 }).unique(),
    documentPortalTokenHash: varchar("document_portal_token_hash", {
      length: 64,
    }).unique(),
    documentPortalTokenEncrypted: text("document_portal_token_encrypted"),
    documentPortalTokenRotatedAt: timestamp(
      "document_portal_token_rotated_at",
      { withTimezone: true }
    ),
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
    revisionNotesCustomer: text("revision_notes_customer"),

    // Traveller Counts
    adults: integer("adults").notNull().default(1),
    children: integer("children").notNull().default(0),
    infants: integer("infants").notNull().default(0),
    totalPassportCount: integer("total_passport_count").notNull(), // Adults + Children + Infants
    bedAndSeatCount: integer("bed_and_seat_count").notNull(), // Adults + Children (Infants occupy 0 beds / 0 seats)

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
    lockedVisaRatePerPersonPkr: bigint("locked_visa_rate_per_person_pkr", {
      mode: "number",
    }),
    calculatedVisaTotalPkr: bigint("calculated_visa_total_pkr", {
      mode: "number",
    }),

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
    hajjInquiryJson: jsonb("hajj_inquiry_json").$type<Record<
      string,
      unknown
    > | null>(),

    // Marketing Post & B2B Supplier Attribution
    sourcePostCode: varchar("source_post_code", { length: 64 }),
    sourceChannelId: uuid("source_channel_id").references(
      () => marketingChannels.id,
      { onDelete: "set null" }
    ),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),

    // Web SEO, GEO & Paid Campaign First-Touch Attribution (Nullable / Additive)
    utmSource: varchar("utm_source", { length: 120 }),
    utmMedium: varchar("utm_medium", { length: 120 }),
    utmCampaign: varchar("utm_campaign", { length: 160 }),
    utmContent: varchar("utm_content", { length: 160 }),
    utmTerm: varchar("utm_term", { length: 160 }),
    landingPage: text("landing_page"),
    httpReferrer: text("http_referrer"),

    // Ziyarat Selection
    ziyaratScope: ziyaratScopeEnum("ziyarat_scope"),
    ziyaratVehicleId: uuid("ziyarat_vehicle_id").references(() => vehicles.id),
    selectedZiyaratPlaceIds: jsonb("selected_ziyarat_place_ids")
      .$type<string[]>()
      .notNull()
      .default([]),

    // Administrative Pipeline Tracking
    assignedStaffUserId: text("assigned_staff_user_id").references(
      () => user.id,
      { onDelete: "set null" }
    ),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    quoteSentAt: timestamp("quote_sent_at", { withTimezone: true }),
    slaEscalatedAt: timestamp("sla_escalated_at", { withTimezone: true }),
    decisionAt: timestamp("decision_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_app_phone").on(table.customerPhone),
    index("idx_app_status_created").on(table.status, table.createdAt),
    index("idx_app_created").on(table.createdAt),
    index("idx_app_assigned_staff").on(table.assignedStaffUserId),
    index("idx_applications_utm_source_campaign").on(
      table.utmSource,
      table.utmCampaign
    ),
    check(
      "chk_applications_traveller_invariants",
      sql`${table.adults} >= 1 AND ${table.children} >= 0 AND ${table.infants} >= 0 AND ${table.totalPassportCount} = (${table.adults} + ${table.children} + ${table.infants}) AND ${table.bedAndSeatCount} = (${table.adults} + ${table.children}) AND (${table.ksaArrivalDate} IS NULL OR ${table.ksaDepartureDate} IS NULL OR ${table.ksaDepartureDate} >= ${table.ksaArrivalDate})`
    ),
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
    includeBreakfast: boolean("include_breakfast").notNull().default(false),
    includeLunch: boolean("include_lunch").notNull().default(false),
    includeDinner: boolean("include_dinner").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_stay_app_id").on(table.applicationId),
    index("idx_stay_hotel_id").on(table.hotelId),
    check(
      "chk_app_hotel_stays_dates_nights",
      sql`${table.nights} >= 1 AND ${table.checkOutDate} > ${table.checkInDate}`
    ),
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
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_segment_app_id").on(table.applicationId),
    index("idx_segment_sector_id").on(table.sectorId),
    check("chk_app_transport_segments_qty", sql`${table.vehicleQuantity} >= 1`),
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
    visaTotalPkr: bigint("visa_total_pkr", { mode: "number" })
      .notNull()
      .default(0),
    flightsTotalPkr: bigint("flights_total_pkr", { mode: "number" })
      .notNull()
      .default(0),
    makkahHotelTotalPkr: bigint("makkah_hotel_total_pkr", { mode: "number" })
      .notNull()
      .default(0),
    madinahHotelTotalPkr: bigint("madinah_hotel_total_pkr", { mode: "number" })
      .notNull()
      .default(0),
    transportTotalPkr: bigint("transport_total_pkr", { mode: "number" })
      .notNull()
      .default(0),
    ziyaratTotalPkr: bigint("ziyarat_total_pkr", { mode: "number" })
      .notNull()
      .default(0),
    discountPkr: bigint("discount_pkr", { mode: "number" })
      .notNull()
      .default(0),
    grandTotalPkr: bigint("grand_total_pkr", { mode: "number" })
      .notNull()
      .default(0),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    supplierNetCostPkr: bigint("supplier_net_cost_pkr", { mode: "number" })
      .notNull()
      .default(0),
    commissionPkr: bigint("commission_pkr", { mode: "number" })
      .notNull()
      .default(25000),
    depositRequiredPkr: bigint("deposit_required_pkr", { mode: "number" })
      .notNull()
      .default(0),
    quotationPdfUrl: text("quotation_pdf_url"),
    quotationPdfGeneratedAt: timestamp("quotation_pdf_generated_at", {
      withTimezone: true,
    }),
    currency: varchar("currency", { length: 3 }).notNull().default("PKR"),
    quoteNotesCustomer: text("quote_notes_customer"),
    internalNotesAdmin: text("internal_notes_admin"),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("unpaid"),
    amountPaidPkr: bigint("amount_paid_pkr", { mode: "number" })
      .notNull()
      .default(0),
    quotedByUserId: text("quoted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    quotedAt: timestamp("quoted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("idx_quote_app_version").on(table.applicationId, table.version),
    index("idx_quote_payment_status").on(table.paymentStatus),
    check(
      "chk_application_quotes_non_negative",
      sql`${table.version} >= 1 AND ${table.visaTotalPkr} >= 0 AND ${table.flightsTotalPkr} >= 0 AND ${table.makkahHotelTotalPkr} >= 0 AND ${table.madinahHotelTotalPkr} >= 0 AND ${table.transportTotalPkr} >= 0 AND ${table.ziyaratTotalPkr} >= 0 AND ${table.discountPkr} >= 0 AND ${table.grandTotalPkr} >= 0 AND ${table.depositRequiredPkr} >= 0 AND ${table.amountPaidPkr} >= 0`
    ),
  ]
)

// ==========================================
// APPLICATION PAYMENTS LEDGER (`OD-03`, `T-042`)
// ==========================================

export const applicationPayments = pgTable(
  "application_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => applicationQuotes.id, { onDelete: "restrict" }),
    amountPkr: bigint("amount_pkr", { mode: "number" }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method")
      .notNull()
      .default("bank_transfer"),
    bankReference: varchar("bank_reference", { length: 128 }),
    receiptR2Key: text("receipt_r2_key"),
    notes: text("notes"),
    recordedById: text("recorded_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    verifiedById: text("verified_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_payment_app_created").on(table.applicationId, table.createdAt),
    index("idx_payment_quote_id").on(table.quoteId),
    check(
      "chk_application_payments_positive_amount",
      sql`${table.amountPkr} > 0`
    ),
  ]
)

export type ApplicationPayment = typeof applicationPayments.$inferSelect
export type NewApplicationPayment = typeof applicationPayments.$inferInsert

// ==========================================
// APPLICATION TRAVELLERS & DOCUMENTS (`Spec 0029`)
// ==========================================

export const applicationTravellers = pgTable(
  "application_travellers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    slotIndex: integer("slot_index").notNull(),
    category: travellerCategoryEnum("category").notNull(),
    categoryOrdinal: integer("category_ordinal").notNull(),
    fullName: text("full_name"),
    passportNumber: varchar("passport_number", { length: 32 }),
    passportExpiryDate: date("passport_expiry_date"),
    nationalIdNumber: varchar("national_id_number", { length: 32 }),
    expiryOverrideByStaff: boolean("expiry_override_by_staff")
      .notNull()
      .default(false),
    expiryOverrideReason: text("expiry_override_reason"),
    piiPurgedAt: timestamp("pii_purged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("uq_app_traveller_slot").on(
      table.applicationId,
      table.slotIndex
    ),
    uniqueIndex("uq_app_traveller_cat_ord").on(
      table.applicationId,
      table.category,
      table.categoryOrdinal
    ),
    check(
      "chk_app_traveller_slot_pos",
      sql`${table.slotIndex} >= 1 AND ${table.categoryOrdinal} >= 1`
    ),
    check(
      "chk_app_traveller_override_reason",
      sql`${table.expiryOverrideByStaff} = false OR (${table.expiryOverrideReason} IS NOT NULL AND length(btrim(${table.expiryOverrideReason})) > 0)`
    ),
  ]
)

export type ApplicationTraveller = typeof applicationTravellers.$inferSelect
export type NewApplicationTraveller = typeof applicationTravellers.$inferInsert

export const applicationDocuments = pgTable(
  "application_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    travellerId: uuid("traveller_id")
      .notNull()
      .references(() => applicationTravellers.id, { onDelete: "cascade" }),
    docType: pilgrimDocumentTypeEnum("doc_type").notNull(),
    status: pilgrimDocumentStatusEnum("status").notNull().default("missing"),
    storageKey: text("storage_key"),
    originalFilename: varchar("original_filename", { length: 200 }),
    mimeType: varchar("mime_type", { length: 64 }),
    sizeBytes: integer("size_bytes"),
    rejectionReason: text("rejection_reason"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    piiPurgedAt: timestamp("pii_purged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("uq_traveller_doc_type").on(table.travellerId, table.docType),
    index("idx_app_docs_app_status").on(table.applicationId, table.status),
    check(
      "chk_app_doc_size_bounds",
      sql`${table.sizeBytes} IS NULL OR (${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 10485760)`
    ),
    check(
      "chk_app_doc_rejection_reason",
      sql`${table.status} != 'reupload_requested' OR (${table.rejectionReason} IS NOT NULL AND length(btrim(${table.rejectionReason})) > 0)`
    ),
    check(
      "chk_app_doc_visa_photo_mime",
      sql`${table.docType} != 'visa_photo' OR ${table.mimeType} IS NULL OR ${table.mimeType} IN ('image/jpeg', 'image/png', 'image/webp')`
    ),
  ]
)

export type ApplicationDocument = typeof applicationDocuments.$inferSelect
export type NewApplicationDocument = typeof applicationDocuments.$inferInsert

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
    supplier: one(suppliers, {
      fields: [applications.supplierId],
      references: [suppliers.id],
    }),
    sourceChannel: one(marketingChannels, {
      fields: [applications.sourceChannelId],
      references: [marketingChannels.id],
    }),
    hotelStays: many(applicationHotelStays),
    transportSegments: many(applicationTransportSegments),
    quotes: many(applicationQuotes),
    payments: many(applicationPayments),
    travellers: many(applicationTravellers),
    documents: many(applicationDocuments),
  })
)

export const applicationTravellersRelations = relations(
  applicationTravellers,
  ({ one, many }) => ({
    application: one(applications, {
      fields: [applicationTravellers.applicationId],
      references: [applications.id],
    }),
    documents: many(applicationDocuments),
  })
)

export const applicationDocumentsRelations = relations(
  applicationDocuments,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationDocuments.applicationId],
      references: [applications.id],
    }),
    traveller: one(applicationTravellers, {
      fields: [applicationDocuments.travellerId],
      references: [applicationTravellers.id],
    }),
    reviewedByUser: one(user, {
      fields: [applicationDocuments.reviewedByUserId],
      references: [user.id],
    }),
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
  ({ one, many }) => ({
    application: one(applications, {
      fields: [applicationQuotes.applicationId],
      references: [applications.id],
    }),
    supplier: one(suppliers, {
      fields: [applicationQuotes.supplierId],
      references: [suppliers.id],
    }),
    quotedByUser: one(user, {
      fields: [applicationQuotes.quotedByUserId],
      references: [user.id],
    }),
    payments: many(applicationPayments),
  })
)

export const applicationPaymentsRelations = relations(
  applicationPayments,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationPayments.applicationId],
      references: [applications.id],
    }),
    quote: one(applicationQuotes, {
      fields: [applicationPayments.quoteId],
      references: [applicationQuotes.id],
    }),
    recordedBy: one(user, {
      fields: [applicationPayments.recordedById],
      references: [user.id],
      relationName: "paymentRecordedBy",
    }),
    verifiedBy: one(user, {
      fields: [applicationPayments.verifiedById],
      references: [user.id],
      relationName: "paymentVerifiedBy",
    }),
  })
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  assignedApplications: many(applications),
  quotesCreated: many(applicationQuotes),
}))
