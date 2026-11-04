import { relations } from "drizzle-orm"
import {
  boolean,
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
import { applications } from "./applications"
import { outreachContacts } from "./suppliers-and-marketing"

// ==========================================
// 1. WHATSAPP ENUMS
// ==========================================

export const whatsappMessageDirectionEnum = pgEnum("whatsapp_message_direction", [
  "inbound",
  "outbound",
])

export const whatsappMessageStatusEnum = pgEnum("whatsapp_message_status", [
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
])

export const whatsappMessageTypeEnum = pgEnum("whatsapp_message_type", [
  "text",
  "image",
  "document",
  "audio",
  "video",
  "template",
  "interactive",
])

export const whatsappTemplateCategoryEnum = pgEnum("whatsapp_template_category", [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
])

export const whatsappTemplateStatusEnum = pgEnum("whatsapp_template_status", [
  "APPROVED",
  "PENDING",
  "REJECTED",
  "PAUSED",
])

export const whatsappBroadcastStatusEnum = pgEnum("whatsapp_broadcast_status", [
  "draft",
  "scheduled",
  "processing",
  "completed",
  "failed",
  "cancelled",
])

// ==========================================
// 2. WHATSAPP ACCOUNTS (Config & Credentials)
// ==========================================

export const whatsappAccounts = pgTable(
  "whatsapp_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().default("Al Ramlah Primary"),
    phoneNumberId: varchar("phone_number_id", { length: 64 }).notNull().unique(),
    wabaId: varchar("waba_id", { length: 64 }).notNull(),
    displayPhoneNumber: varchar("display_phone_number", { length: 32 }).notNull(),
    verifiedName: text("verified_name"),
    qualityRating: varchar("quality_rating", { length: 32 }).default("GREEN"),
    messagingLimit: varchar("messaging_limit", { length: 64 }),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    webhookVerifyToken: text("webhook_verify_token").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_wa_acc_phone_id").on(table.phoneNumberId),
    index("idx_wa_acc_active").on(table.isActive),
  ]
)

// ==========================================
// 3. WHATSAPP CONVERSATIONS
// ==========================================

export const whatsappConversations = pgTable(
  "whatsapp_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => whatsappAccounts.id, { onDelete: "cascade" }),
    contactPhone: varchar("contact_phone", { length: 32 }).notNull(),
    contactName: text("contact_name"),
    outreachContactId: uuid("outreach_contact_id").references(
      () => outreachContacts.id,
      { onDelete: "set null" }
    ),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    detectedPostCode: varchar("detected_post_code", { length: 64 }),
    lastCustomerMessageAt: timestamp("last_customer_message_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    unreadCount: integer("unread_count").notNull().default(0),
    isPinned: boolean("is_pinned").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    assignedUserId: text("assigned_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_wa_conv_acc_phone").on(table.accountId, table.contactPhone),
    index("idx_wa_conv_last_msg").on(table.accountId, table.lastMessageAt),
    index("idx_wa_conv_outreach").on(table.outreachContactId),
    index("idx_wa_conv_app").on(table.applicationId),
    index("idx_wa_conv_detected_code").on(table.detectedPostCode),
  ]
)

// ==========================================
// 4. WHATSAPP MESSAGES
// ==========================================

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => whatsappConversations.id, { onDelete: "cascade" }),
    wamid: varchar("wamid", { length: 128 }).notNull().unique(),
    direction: whatsappMessageDirectionEnum("direction").notNull(),
    status: whatsappMessageStatusEnum("status").notNull().default("sent"),
    messageType: whatsappMessageTypeEnum("message_type").notNull(),
    body: text("body"),
    mediaUrl: text("media_url"),
    mediaType: varchar("media_type", { length: 64 }),
    mediaFilename: text("media_filename"),
    templateName: varchar("template_name", { length: 128 }),
    contextMessageId: varchar("context_message_id", { length: 128 }),
    rawPayload: jsonb("raw_payload"),
    errorCode: varchar("error_code", { length: 32 }),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_wa_msg_wamid").on(table.wamid),
    index("idx_wa_msg_conv_created").on(table.conversationId, table.createdAt),
    index("idx_wa_msg_status").on(table.status),
  ]
)

// ==========================================
// 5. WHATSAPP TEMPLATES
// ==========================================

export const whatsappTemplates = pgTable(
  "whatsapp_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => whatsappAccounts.id, { onDelete: "cascade" }),
    metaTemplateId: varchar("meta_template_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    language: varchar("language", { length: 16 }).notNull().default("en_US"),
    category: whatsappTemplateCategoryEnum("category").notNull(),
    status: whatsappTemplateStatusEnum("status").notNull(),
    headerType: varchar("header_type", { length: 24 }),
    headerContent: text("header_content"),
    bodyText: text("body_text").notNull(),
    footerText: text("footer_text"),
    buttons: jsonb("buttons").$type<Array<Record<string, unknown>>>().default([]),
    variableMapping: jsonb("variable_mapping").$type<Record<string, string>>().default({}),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_wa_tmpl_acc_name_lang").on(table.accountId, table.name, table.language),
    index("idx_wa_tmpl_status").on(table.status),
  ]
)

// ==========================================
// 6. WHATSAPP BROADCASTS & RECIPIENTS
// ==========================================

export const whatsappBroadcasts = pgTable(
  "whatsapp_broadcasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => whatsappAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => whatsappTemplates.id, { onDelete: "restrict" }),
    templateName: varchar("template_name", { length: 128 }).notNull(),
    templateLanguage: varchar("template_language", { length: 16 }).notNull().default("en_US"),
    status: whatsappBroadcastStatusEnum("status").notNull().default("draft"),
    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    readCount: integer("read_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_wa_bc_acc_status").on(table.accountId, table.status),
    index("idx_wa_bc_scheduled").on(table.scheduledAt),
  ]
)

export const whatsappBroadcastRecipients = pgTable(
  "whatsapp_broadcast_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    broadcastId: uuid("broadcast_id")
      .notNull()
      .references(() => whatsappBroadcasts.id, { onDelete: "cascade" }),
    contactPhone: varchar("contact_phone", { length: 32 }).notNull(),
    outreachContactId: uuid("outreach_contact_id").references(
      () => outreachContacts.id,
      { onDelete: "set null" }
    ),
    status: whatsappMessageStatusEnum("status").notNull().default("pending"),
    wamid: varchar("wamid", { length: 128 }),
    templateParams: jsonb("template_params").$type<Record<string, unknown>>().default({}),
    errorCode: varchar("error_code", { length: 32 }),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_wa_bc_recip_broadcast").on(table.broadcastId, table.status),
    index("idx_wa_bc_recip_wamid").on(table.wamid),
    index("idx_wa_bc_recip_phone").on(table.contactPhone),
  ]
)

// ==========================================
// 7. WHATSAPP QUICK REPLIES
// ==========================================

export const whatsappQuickReplies = pgTable(
  "whatsapp_quick_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => whatsappAccounts.id, { onDelete: "cascade" }),
    shortcut: varchar("shortcut", { length: 64 }).notNull(),
    title: text("title").notNull(),
    category: varchar("category", { length: 32 }).notNull().default("general"),
    bodyText: text("body_text").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_wa_qr_shortcut").on(table.accountId, table.shortcut),
    index("idx_wa_qr_active").on(table.accountId, table.isActive),
  ]
)

// ==========================================
// 8. RELATIONS
// ==========================================

export const whatsappAccountsRelations = relations(whatsappAccounts, ({ many }) => ({
  conversations: many(whatsappConversations),
  templates: many(whatsappTemplates),
  broadcasts: many(whatsappBroadcasts),
  quickReplies: many(whatsappQuickReplies),
}))

export const whatsappConversationsRelations = relations(
  whatsappConversations,
  ({ one, many }) => ({
    account: one(whatsappAccounts, {
      fields: [whatsappConversations.accountId],
      references: [whatsappAccounts.id],
    }),
    outreachContact: one(outreachContacts, {
      fields: [whatsappConversations.outreachContactId],
      references: [outreachContacts.id],
    }),
    application: one(applications, {
      fields: [whatsappConversations.applicationId],
      references: [applications.id],
    }),
    assignedUser: one(user, {
      fields: [whatsappConversations.assignedUserId],
      references: [user.id],
    }),
    messages: many(whatsappMessages),
  })
)

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  conversation: one(whatsappConversations, {
    fields: [whatsappMessages.conversationId],
    references: [whatsappConversations.id],
  }),
}))

export const whatsappTemplatesRelations = relations(
  whatsappTemplates,
  ({ one, many }) => ({
    account: one(whatsappAccounts, {
      fields: [whatsappTemplates.accountId],
      references: [whatsappAccounts.id],
    }),
    broadcasts: many(whatsappBroadcasts),
  })
)

export const whatsappBroadcastsRelations = relations(
  whatsappBroadcasts,
  ({ one, many }) => ({
    account: one(whatsappAccounts, {
      fields: [whatsappBroadcasts.accountId],
      references: [whatsappAccounts.id],
    }),
    template: one(whatsappTemplates, {
      fields: [whatsappBroadcasts.templateId],
      references: [whatsappTemplates.id],
    }),
    recipients: many(whatsappBroadcastRecipients),
  })
)

export const whatsappBroadcastRecipientsRelations = relations(
  whatsappBroadcastRecipients,
  ({ one }) => ({
    broadcast: one(whatsappBroadcasts, {
      fields: [whatsappBroadcastRecipients.broadcastId],
      references: [whatsappBroadcasts.id],
    }),
    outreachContact: one(outreachContacts, {
      fields: [whatsappBroadcastRecipients.outreachContactId],
      references: [outreachContacts.id],
    }),
  })
)

export const whatsappQuickRepliesRelations = relations(
  whatsappQuickReplies,
  ({ one }) => ({
    account: one(whatsappAccounts, {
      fields: [whatsappQuickReplies.accountId],
      references: [whatsappAccounts.id],
    }),
  })
)
