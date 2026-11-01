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
import { groupDepartures, groupPackages } from "./packages"
import { applications } from "./applications"

// ==========================================
// 1. SUPPLIER & MARKETING ENUMS
// ==========================================

export const supplierCategoryEnum = pgEnum("supplier_category", [
  "group_packages",
  "custom_packages",
  "both",
])

export const commissionModeEnum = pgEnum("commission_mode", [
  "included_in_flyer",
  "net_plus_markup",
])

export const flyerStatusEnum = pgEnum("flyer_status", [
  "extracted",
  "wrapped",
  "draft_extracted",
  "verified",
  "posters_generated",
  "archived",
])

export const posterAssetTypeEnum = pgEnum("poster_asset_type", [
  "multi_package_sheet",
  "single_package_spotlight",
  "custom_quotation_pdf",
])

export const channelPlatformEnum = pgEnum("channel_platform", [
  "whatsapp_group",
  "whatsapp_community",
  "whatsapp_status",
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
])

export const distributionDispatchStatusEnum = pgEnum(
  "distribution_dispatch_status",
  [
    "planned",
    "queued",
    "queued_auto",
    "sent",
    "posted",
    "manual_logged",
    "failed",
  ]
)

export const distributionStageEnum = pgEnum("distribution_stage", [
  "step_1_spotlight_hook",
  "step_2_all_packages",
  "standalone",
])

export const contactLeadStatusEnum = pgEnum("contact_lead_status", [
  "prospect",
  "interested",
  "active_conversation",
  "contacted_cooldown",
  "replied_active",
  "quoted",
  "booked_client",
  "do_not_contact",
])

// ==========================================
// 2. B2B SUPPLIERS (Upsky Travels, Ammaar, Zahoor Travels)
// ==========================================

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    codePrefix: varchar("code_prefix", { length: 12 }).notNull(),
    category: supplierCategoryEnum("category")
      .notNull()
      .default("group_packages"),
    defaultCommissionMode: commissionModeEnum("default_commission_mode")
      .notNull()
      .default("included_in_flyer"),
    defaultCommissionPkr: integer("default_commission_pkr")
      .notNull()
      .default(22000),
    contactPerson: text("contact_person"),
    whatsappNumber: varchar("whatsapp_number", { length: 32 }),
    phone: varchar("phone", { length: 32 }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_supplier_slug").on(table.slug),
    index("idx_supplier_active").on(table.isActive),
  ]
)

// ==========================================
// 3. SUPPLIER FLYERS (Raw Flyer + Metadata + Commission Config)
// ==========================================

export const supplierFlyers = pgTable(
  "supplier_flyers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flyerCode: varchar("flyer_code", { length: 32 }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    rawFlyerImageUrl: text("raw_flyer_image_url").notNull(),
    airlineName: text("airline_name").notNull(),
    airlineIataCode: varchar("airline_iata_code", { length: 8 }),
    airlineLogoUrl: text("airline_logo_url"),
    durationDays: integer("duration_days").notNull().default(15),
    daysTitle: text("days_title").notNull().default("15 DAYS"),
    routePill: text("route_pill").notNull().default("LHE - JED | JED - LHE"),
    departureCityCode: varchar("departure_city_code", { length: 8 })
      .notNull()
      .default("LHE"),
    arrivalAirportCode: varchar("arrival_airport_code", { length: 8 })
      .notNull()
      .default("JED"),
    returnAirportCode: varchar("return_airport_code", { length: 8 })
      .notNull()
      .default("JED"),
    outboundBaggage: text("outbound_baggage"),
    inboundBaggage: text("inbound_baggage"),
    giftedInclusions: jsonb("gifted_inclusions")
      .$type<string[]>()
      .notNull()
      .default([]),
    commissionMode: commissionModeEnum("commission_mode")
      .notNull()
      .default("included_in_flyer"),
    commissionPkr: integer("commission_pkr").notNull().default(22000),
    multiSheetImageUrl: text("multi_sheet_image_url"),
    multiSheetPdfUrl: text("multi_sheet_pdf_url"),
    extractedCardsCount: integer("extracted_cards_count").notNull().default(0),
    status: flyerStatusEnum("status").notNull().default("extracted"),
    receivedDate: date("received_date").notNull(),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_flyer_supplier").on(table.supplierId),
    index("idx_flyer_status").on(table.status),
  ]
)

// ==========================================
// 4. SUPPLIER FLYER PACKAGES (Cards 01..N on a Flyer)
// ==========================================

export const supplierFlyerPackages = pgTable(
  "supplier_flyer_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flyerId: uuid("flyer_id")
      .notNull()
      .references(() => supplierFlyers.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    cardNumber: varchar("card_number", { length: 8 }).notNull(),
    postCode: varchar("post_code", { length: 64 }).notNull().unique(),
    sheetIndex: integer("sheet_index").notNull().default(1),

    // Outbound & Return Flight Schedule
    outboundFlightNo: text("outbound_flight_no").notNull(),
    outboundDateLabel: text("outbound_date_label").notNull(),
    outboundRoute: text("outbound_route").notNull(),
    outboundDepTime: text("outbound_dep_time").notNull(),
    outboundArrTime: text("outbound_arr_time").notNull(),
    returnFlightNo: text("return_flight_no").notNull(),
    returnDateLabel: text("return_date_label").notNull(),
    returnRoute: text("return_route").notNull(),
    returnDepTime: text("return_dep_time").notNull(),
    returnArrTime: text("return_arr_time").notNull(),

    // Makkah & Madinah Hotel Details
    makkahNights: varchar("makkah_nights", { length: 8 }).notNull(),
    makkahHotelName: text("makkah_hotel_name").notNull(),
    makkahDistanceLabel: text("makkah_distance_label").notNull(),
    madinahNights: varchar("madinah_nights", { length: 8 }).notNull(),
    madinahHotelName: text("madinah_hotel_name").notNull(),
    madinahDistanceLabel: text("madinah_distance_label").notNull(),
    mealPlanLabel: text("meal_plan_label").default("Room Only"),

    // Raw Supplier Flyer Prices (PKR)
    rawSharingPkr: integer("raw_sharing_pkr").notNull(),
    rawQuadPkr: integer("raw_quad_pkr").notNull(),
    rawTriplePkr: integer("raw_triple_pkr").notNull(),
    rawDoublePkr: integer("raw_double_pkr").notNull(),

    // Net Supplier Payable (PKR)
    netSharingPkr: integer("net_sharing_pkr").notNull(),
    netQuadPkr: integer("net_quad_pkr").notNull(),
    netTriplePkr: integer("net_triple_pkr").notNull(),
    netDoublePkr: integer("net_double_pkr").notNull(),

    // Commission & Final Al Ramlah Retail Display Prices (PKR)
    commissionPkr: integer("commission_pkr").notNull().default(22000),
    retailSharingPkr: integer("retail_sharing_pkr").notNull(),
    retailQuadPkr: integer("retail_quad_pkr").notNull(),
    retailTriplePkr: integer("retail_triple_pkr").notNull(),
    retailDoublePkr: integer("retail_double_pkr").notNull(),

    // Generated Single-Package Spotlight Poster Asset (Skill 3)
    spotlightPosterUrl: text("spotlight_poster_url"),
    spotlightPdfUrl: text("spotlight_pdf_url"),

    // Public Website Sync Links
    publishedGroupPackageId: uuid("published_group_package_id").references(
      () => groupPackages.id,
      { onDelete: "set null" }
    ),
    publishedGroupDepartureId: uuid("published_group_departure_id").references(
      () => groupDepartures.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_pkg_item_post_code").on(table.postCode),
    index("idx_pkg_item_flyer").on(table.flyerId),
    index("idx_pkg_item_supplier").on(table.supplierId),
    index("idx_pkg_item_sharing_price").on(table.retailSharingPkr),
  ]
)

// ==========================================
// 5. GENERATED POST ASSETS (Multi-Package Sheets & Single Spotlights)
// ==========================================

export const postAssets = pgTable(
  "post_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postCode: varchar("post_code", { length: 64 }).notNull().unique(),
    kind: posterAssetTypeEnum("kind").notNull(),
    title: text("title").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    flyerId: uuid("flyer_id")
      .notNull()
      .references(() => supplierFlyers.id, { onDelete: "cascade" }),
    flyerPackageId: uuid("flyer_package_id").references(
      () => supplierFlyerPackages.id,
      { onDelete: "cascade" }
    ),
    imageUrl: text("image_url").notNull(),
    pdfUrl: text("pdf_url"),
    captionWhatsapp: text("caption_whatsapp"),
    captionInstagram: text("caption_instagram"),
    searchableText: text("searchable_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_post_asset_code").on(table.postCode),
    index("idx_post_asset_flyer").on(table.flyerId),
    index("idx_post_asset_kind").on(table.kind),
  ]
)

// ==========================================
// 6. MARKETING CHANNELS (30+ WA Groups, 2 WA Statuses, Social Accounts)
// ==========================================

export const marketingChannels = pgTable(
  "marketing_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    platform: channelPlatformEnum("platform").notNull(),
    areaTag: text("area_tag").notNull().default("Lahore"),
    senderWhatsappNumber: varchar("sender_whatsapp_number", { length: 32 }),
    externalGroupIdOrHandle: text("external_group_id_or_handle"),
    inviteLinkOrUrl: text("invite_link_or_url"),
    memberCount: integer("member_count"),
    dailyTargetPosts: integer("daily_target_posts").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    lastPostedAt: timestamp("last_posted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_channel_platform").on(table.platform),
    index("idx_channel_area").on(table.areaTag),
    index("idx_channel_active").on(table.isActive),
  ]
)

// ==========================================
// 7. DAILY DISTRIBUTION MATRIX LOGS
// ==========================================

export const dailyPostDistributions = pgTable(
  "daily_post_distributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduledDate: date("scheduled_date").notNull(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => marketingChannels.id, { onDelete: "cascade" }),
    postAssetId: uuid("post_asset_id")
      .notNull()
      .references(() => postAssets.id, { onDelete: "cascade" }),
    pairedFollowUpAssetId: uuid("paired_follow_up_asset_id").references(
      () => postAssets.id,
      { onDelete: "set null" }
    ),
    stage: distributionStageEnum("stage")
      .notNull()
      .default("step_1_spotlight_hook"),
    status: distributionDispatchStatusEnum("status")
      .notNull()
      .default("sent"),
    senderWhatsappLine: varchar("sender_whatsapp_line", { length: 32 }),
    captionUsed: text("caption_used"),
    externalQueueJobId: text("external_queue_job_id"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    inquiriesGeneratedCount: integer("inquiries_generated_count")
      .notNull()
      .default(0),
    postedByUserId: text("posted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_dist_date").on(table.scheduledDate),
    index("idx_dist_channel").on(table.channelId),
    index("idx_dist_asset").on(table.postAssetId),
  ]
)

// ==========================================
// 8. 1-ON-1 PERSONAL OUTREACH CRM & 14-DAY COOLDOWN
// ==========================================

export const outreachContacts = pgTable(
  "outreach_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    whatsappNumber: varchar("whatsapp_number", { length: 32 })
      .notNull()
      .unique(),
    secondaryPhone: varchar("secondary_phone", { length: 32 }),
    city: text("city").notNull().default("Lahore"),
    areaCommunity: text("area_community").default("Askari 10"),
    sourceGroupOrChannel: text("source_group_or_channel"),
    assignedWhatsappLine: varchar("assigned_whatsapp_line", { length: 32 })
      .notNull()
      .default("03274029701"),
    interestStatus: varchar("interest_status", { length: 32 })
      .notNull()
      .default("prospect"),
    lastOutreachAt: timestamp("last_outreach_at", { withTimezone: true }),
    cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
    lastInboundReplyAt: timestamp("last_inbound_reply_at", {
      withTimezone: true,
    }),
    totalOutreachCount: integer("total_outreach_count").notNull().default(0),
    packagesSharedHistory: jsonb("packages_shared_history")
      .$type<string[]>()
      .notNull()
      .default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_outreach_wa_number").on(table.whatsappNumber),
    index("idx_outreach_status").on(table.interestStatus),
    index("idx_outreach_cooldown").on(table.cooldownUntil),
  ]
)

export const outreachLogs = pgTable(
  "outreach_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => outreachContacts.id, { onDelete: "cascade" }),
    postAssetId: uuid("post_asset_id").references(() => postAssets.id, {
      onDelete: "set null",
    }),
    flyerId: uuid("flyer_id").references(() => supplierFlyers.id, {
      onDelete: "set null",
    }),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    direction: varchar("direction", { length: 16 })
      .notNull()
      .default("outbound"),
    senderWhatsappLine: varchar("sender_whatsapp_line", {
      length: 32,
    }).notNull(),
    messageText: text("message_text").notNull(),
    deliveryStatus: varchar("delivery_status", { length: 32 })
      .notNull()
      .default("sent"),
    cooldownLockedUntil: timestamp("cooldown_locked_until", {
      withTimezone: true,
    }),
    sentByUserId: text("sent_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_outreach_log_contact").on(table.contactId),
    index("idx_outreach_log_sent_at").on(table.sentAt),
  ]
)

// ==========================================
// 9. DRIZZLE RELATIONS GRAPH
// ==========================================

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  flyers: many(supplierFlyers),
  packages: many(supplierFlyerPackages),
  postAssets: many(postAssets),
}))

export const supplierFlyersRelations = relations(
  supplierFlyers,
  ({ one, many }) => ({
    supplier: one(suppliers, {
      fields: [supplierFlyers.supplierId],
      references: [suppliers.id],
    }),
    packages: many(supplierFlyerPackages),
    postAssets: many(postAssets),
  })
)

export const supplierFlyerPackagesRelations = relations(
  supplierFlyerPackages,
  ({ one, many }) => ({
    flyer: one(supplierFlyers, {
      fields: [supplierFlyerPackages.flyerId],
      references: [supplierFlyers.id],
    }),
    supplier: one(suppliers, {
      fields: [supplierFlyerPackages.supplierId],
      references: [suppliers.id],
    }),
    publishedGroupPackage: one(groupPackages, {
      fields: [supplierFlyerPackages.publishedGroupPackageId],
      references: [groupPackages.id],
    }),
    publishedGroupDeparture: one(groupDepartures, {
      fields: [supplierFlyerPackages.publishedGroupDepartureId],
      references: [groupDepartures.id],
    }),
    postAssets: many(postAssets),
  })
)

export const postAssetsRelations = relations(postAssets, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [postAssets.supplierId],
    references: [suppliers.id],
  }),
  flyer: one(supplierFlyers, {
    fields: [postAssets.flyerId],
    references: [supplierFlyers.id],
  }),
  flyerPackage: one(supplierFlyerPackages, {
    fields: [postAssets.flyerPackageId],
    references: [supplierFlyerPackages.id],
  }),
  distributions: many(dailyPostDistributions, {
    relationName: "primaryPostAsset",
  }),
  pairedDistributions: many(dailyPostDistributions, {
    relationName: "pairedFollowUpPostAsset",
  }),
  outreachLogs: many(outreachLogs),
}))

export const marketingChannelsRelations = relations(
  marketingChannels,
  ({ many }) => ({
    distributions: many(dailyPostDistributions),
  })
)

export const dailyPostDistributionsRelations = relations(
  dailyPostDistributions,
  ({ one }) => ({
    channel: one(marketingChannels, {
      fields: [dailyPostDistributions.channelId],
      references: [marketingChannels.id],
    }),
    postAsset: one(postAssets, {
      fields: [dailyPostDistributions.postAssetId],
      references: [postAssets.id],
      relationName: "primaryPostAsset",
    }),
    pairedFollowUpAsset: one(postAssets, {
      fields: [dailyPostDistributions.pairedFollowUpAssetId],
      references: [postAssets.id],
      relationName: "pairedFollowUpPostAsset",
    }),
  })
)

export const outreachContactsRelations = relations(
  outreachContacts,
  ({ many }) => ({
    logs: many(outreachLogs),
  })
)

export const outreachLogsRelations = relations(outreachLogs, ({ one }) => ({
  contact: one(outreachContacts, {
    fields: [outreachLogs.contactId],
    references: [outreachContacts.id],
  }),
  postAsset: one(postAssets, {
    fields: [outreachLogs.postAssetId],
    references: [postAssets.id],
  }),
  flyer: one(supplierFlyers, {
    fields: [outreachLogs.flyerId],
    references: [supplierFlyers.id],
  }),
  application: one(applications, {
    fields: [outreachLogs.applicationId],
    references: [applications.id],
  }),
}))
