import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  foreignKey,
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
// 1. WHATSAPP ENUMS & NORMALIZATION HELPERS
// ==========================================

export const whatsappMessageDirectionEnum = pgEnum(
  "whatsapp_message_direction",
  ["inbound", "outbound"]
)

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
  "sticker",
  "reaction",
  "TEXT",
  "IMAGE",
  "DOCUMENT",
  "AUDIO",
  "VIDEO",
  "TEMPLATE",
  "INTERACTIVE",
  "STICKER",
  "REACTION",
])

export type CanonicalWhatsappMessageType =
  | "text"
  | "image"
  | "document"
  | "audio"
  | "video"
  | "template"
  | "interactive"
  | "sticker"
  | "reaction"

const CANONICAL_WA_MESSAGE_TYPES = new Set<CanonicalWhatsappMessageType>([
  "text",
  "image",
  "document",
  "audio",
  "video",
  "template",
  "interactive",
  "sticker",
  "reaction",
])

export function normalizeWhatsappMessageType(
  raw: string | null | undefined
): CanonicalWhatsappMessageType {
  const lowered = (raw ?? "text").trim().toLowerCase()
  if (CANONICAL_WA_MESSAGE_TYPES.has(lowered as CanonicalWhatsappMessageType)) {
    return lowered as CanonicalWhatsappMessageType
  }
  return "text"
}

/**
 * Scrubs raw Meta webhook payload PII (`T-080` 90-day retention policy helper)
 * while preserving non-PII delivery metadata (`id`, `type`, `timestamp`).
 */
export function scrubWhatsappRawPayload(
  payload: unknown
): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null
  }
  const obj = payload as Record<string, unknown>
  return {
    id: typeof obj.id === "string" ? obj.id : undefined,
    type: typeof obj.type === "string" ? obj.type : undefined,
    timestamp: typeof obj.timestamp === "string" ? obj.timestamp : undefined,
    redacted: true,
  }
}

export const whatsappTemplateCategoryEnum = pgEnum(
  "whatsapp_template_category",
  ["MARKETING", "UTILITY", "AUTHENTICATION"]
)

export const whatsappTemplateStatusEnum = pgEnum("whatsapp_template_status", [
  "APPROVED",
  "PENDING",
  "REJECTED",
  "PAUSED",
  "DISABLED",
])

export const whatsappBroadcastStatusEnum = pgEnum("whatsapp_broadcast_status", [
  "draft",
  "scheduled",
  "processing",
  "completed",
  "failed",
  "cancelled",
])

export const whatsappAutoReplyMatchTypeEnum = pgEnum(
  "whatsapp_auto_reply_match_type",
  ["CONTAINS", "EXACT", "STARTS_WITH", "REGEX"]
)

export type WhatsappAutoReplyMatchType =
  (typeof whatsappAutoReplyMatchTypeEnum.enumValues)[number]

export const whatsappLinkedDeviceStatusEnum = pgEnum(
  "whatsapp_linked_device_status",
  ["disconnected", "connecting", "qr_ready", "pairing_code_ready", "connected"]
)

export type WhatsappLinkedDeviceStatus =
  (typeof whatsappLinkedDeviceStatusEnum.enumValues)[number]

// ==========================================
// 2. WHATSAPP ACCOUNTS (Config & Credentials)
// ==========================================

export const whatsappAccounts = pgTable(
  "whatsapp_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().default("Al Ramlah Primary"),
    phoneNumberId: varchar("phone_number_id", { length: 64 })
      .notNull()
      .unique(),
    wabaId: varchar("waba_id", { length: 64 }).notNull(),
    displayPhoneNumber: varchar("display_phone_number", {
      length: 32,
    }).notNull(),
    verifiedName: text("verified_name"),
    qualityRating: varchar("quality_rating", { length: 32 }).default("GREEN"),
    messagingLimit: varchar("messaging_limit", { length: 64 }),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    webhookVerifyToken: text("webhook_verify_token").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(true),
    autoReplyEnabled: boolean("auto_reply_enabled").notNull().default(true),
    autoReplyCooldownMinutes: integer("auto_reply_cooldown_minutes")
      .notNull()
      .default(60),
    welcomeGreetingEnabled: boolean("welcome_greeting_enabled")
      .notNull()
      .default(true),
    welcomeGreetingText: text("welcome_greeting_text"),
    awayGreetingEnabled: boolean("away_greeting_enabled")
      .notNull()
      .default(true),
    awayGreetingText: text("away_greeting_text"),
    businessHoursStart: text("business_hours_start").notNull().default("09:00"),
    businessHoursEnd: text("business_hours_end").notNull().default("21:00"),
    accountRole: varchar("account_role", { length: 32 })
      .notNull()
      .default("COEXISTENCE_FOUNDER"),
    isOnBizApp: boolean("is_on_biz_app").notNull().default(true),
    platformType: varchar("platform_type", { length: 32 }).default("CLOUD_API"),
    intentFilterEnabled: boolean("intent_filter_enabled")
      .notNull()
      .default(true),
    embeddedSignupConfigId: varchar("embedded_signup_config_id", {
      length: 128,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("idx_wa_acc_active").on(table.isActive)]
)

// ==========================================
// 3. WHATSAPP CONVERSATIONS
// ==========================================

export interface WhatsappInternalNote {
  id: string
  userId: string
  userName: string
  note: string
  createdAt: string
}

export type WhatsappConversationInternalNote = WhatsappInternalNote

export type WhatsappIntakeStep =
  | "IDLE"
  | "AWAITING_MONTH"
  | "AWAITING_PILGRIMS"
  | "AWAITING_HOTEL_TIER"
  | "COMPLETED"

export interface WhatsappIntakeFlowState {
  step: WhatsappIntakeStep
  month?: string
  pilgrimCount?: string
  hotelTier?: string
  applicationId?: string
  startedAt?: string
  updatedAt?: string
}

export const whatsappConversations = pgTable(
  "whatsapp_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => whatsappAccounts.id, { onDelete: "restrict" }),
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
    lastAutoRepliedPostCode: varchar("last_auto_replied_post_code", {
      length: 64,
    }),
    lastAutoRepliedAt: timestamp("last_auto_replied_at", {
      withTimezone: true,
    }),
    lastCustomerMessageAt: timestamp("last_customer_message_at", {
      withTimezone: true,
    }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    unreadCount: integer("unread_count").notNull().default(0),
    isPinned: boolean("is_pinned").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    assignedUserId: text("assigned_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    internalNotes: jsonb("internal_notes")
      .$type<WhatsappInternalNote[]>()
      .notNull()
      .default([]),
    intakeFlowState: jsonb("intake_flow_state")
      .$type<WhatsappIntakeFlowState>()
      .notNull()
      .default({ step: "IDLE" }),
    intentCategory: varchar("intent_category", { length: 32 })
      .notNull()
      .default("TRAVEL_LEAD"),
    intentConfidence: integer("intent_confidence").notNull().default(100),
    intentReason: text("intent_reason"),
    forwardedToAgentConversationId: uuid("forwarded_to_agent_conversation_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("idx_wa_conv_acc_phone").on(
      table.accountId,
      table.contactPhone
    ),
    index("idx_wa_conv_desk_inbox").on(
      table.accountId,
      table.isArchived,
      table.isPinned,
      table.lastMessageAt
    ),
    index("idx_wa_conv_last_msg").on(table.accountId, table.lastMessageAt),
    index("idx_wa_conv_outreach").on(table.outreachContactId),
    index("idx_wa_conv_app").on(table.applicationId),
    index("idx_wa_conv_detected_code").on(table.detectedPostCode),
    foreignKey({
      columns: [table.forwardedToAgentConversationId],
      foreignColumns: [table.id],
      name: "fk_wa_conv_forwarded_to",
    }).onDelete("set null"),
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
    rawMediaId: varchar("raw_media_id", { length: 128 }),
    mediaUrl: text("media_url"),
    mediaType: varchar("media_type", { length: 64 }),
    mediaMimeType: text("media_mime_type"),
    mediaSha256: text("media_sha256"),
    mediaFileSize: integer("media_file_size"),
    mediaFilename: text("media_filename"),
    templateName: varchar("template_name", { length: 128 }),
    contextMessageId: varchar("context_message_id", { length: 128 }),
    interactivePayload: jsonb("interactive_payload").$type<
      Record<string, unknown>
    >(),
    reactionEmoji: text("reaction_emoji"),
    reactedToWabaMessageId: text("reacted_to_waba_message_id"),
    isAutoReply: boolean("is_auto_reply").notNull().default(false),
    rawPayload: jsonb("raw_payload"),
    payloadRedactedAt: timestamp("payload_redacted_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 32 }),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_wa_msg_conv_created").on(table.conversationId, table.createdAt),
    index("idx_wa_msg_status").on(table.status),
    index("idx_wa_msg_created").on(table.createdAt),
    check(
      "chk_wa_messages_lowercase_type",
      sql`${table.messageType}::text = lower(${table.messageType}::text)`
    ),
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
    rejectionReason: text("rejection_reason"),
    headerType: varchar("header_type", { length: 24 }),
    headerContent: text("header_content"),
    bodyText: text("body_text").notNull(),
    footerText: text("footer_text"),
    buttons: jsonb("buttons")
      .$type<Array<Record<string, unknown>>>()
      .default([]),
    variableMapping: jsonb("variable_mapping")
      .$type<Record<string, string>>()
      .default({}),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("idx_wa_tmpl_acc_name_lang").on(
      table.accountId,
      table.name,
      table.language
    ),
    index("idx_wa_tmpl_meta_id").on(table.metaTemplateId),
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
      .references(() => whatsappAccounts.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => whatsappTemplates.id, { onDelete: "restrict" }),
    templateName: varchar("template_name", { length: 128 }).notNull(),
    templateLanguage: varchar("template_language", { length: 16 })
      .notNull()
      .default("en_US"),
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
    headerMediaUrl: text("header_media_url"),
    defaultTemplateParams: jsonb("default_template_params")
      .$type<Record<string, unknown> | string[]>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
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
    templateParams: jsonb("template_params")
      .$type<Record<string, unknown>>()
      .default({}),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("idx_wa_qr_shortcut").on(table.accountId, table.shortcut),
    index("idx_wa_qr_active").on(table.accountId, table.isActive),
  ]
)

// ==========================================
// 8. WHATSAPP AUTO-REPLY RULES (Spec 0017)
// ==========================================

export const whatsappAutoReplyRules = pgTable(
  "whatsapp_auto_reply_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => whatsappAccounts.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    matchType: whatsappAutoReplyMatchTypeEnum("match_type")
      .notNull()
      .default("CONTAINS"),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    responseText: text("response_text").notNull(),
    mediaUrl: text("media_url"),
    mediaFilename: text("media_filename"),
    interactiveButtons: jsonb("interactive_buttons")
      .$type<Array<{ id: string; title: string }>>()
      .default([]),
    priority: integer("priority").notNull().default(100),
    cooldownMinutes: integer("cooldown_minutes").notNull().default(60),
    isActive: boolean("is_active").notNull().default(true),
    triggerCount: integer("trigger_count").notNull().default(0),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("idx_wa_arr_active_prio").on(table.isActive, table.priority)]
)

export type WhatsappAutoReplyRule = typeof whatsappAutoReplyRules.$inferSelect
export type NewWhatsappAutoReplyRule =
  typeof whatsappAutoReplyRules.$inferInsert

// ==========================================
// 9. RELATIONS
// ==========================================

export const whatsappAccountsRelations = relations(
  whatsappAccounts,
  ({ many }) => ({
    conversations: many(whatsappConversations),
    templates: many(whatsappTemplates),
    broadcasts: many(whatsappBroadcasts),
    quickReplies: many(whatsappQuickReplies),
    autoReplyRules: many(whatsappAutoReplyRules),
  })
)

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

export const whatsappMessagesRelations = relations(
  whatsappMessages,
  ({ one }) => ({
    conversation: one(whatsappConversations, {
      fields: [whatsappMessages.conversationId],
      references: [whatsappConversations.id],
    }),
  })
)

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

export const whatsappAutoReplyRulesRelations = relations(
  whatsappAutoReplyRules,
  ({ one }) => ({
    account: one(whatsappAccounts, {
      fields: [whatsappAutoReplyRules.accountId],
      references: [whatsappAccounts.id],
    }),
  })
)

export type WhatsappAccount = typeof whatsappAccounts.$inferSelect
export type NewWhatsappAccount = typeof whatsappAccounts.$inferInsert
export type WhatsappConversation = typeof whatsappConversations.$inferSelect
export type NewWhatsappConversation = typeof whatsappConversations.$inferInsert
export type WhatsappMessage = typeof whatsappMessages.$inferSelect
export type NewWhatsappMessage = typeof whatsappMessages.$inferInsert
export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect
export type NewWhatsappTemplate = typeof whatsappTemplates.$inferInsert
export type WhatsappBroadcast = typeof whatsappBroadcasts.$inferSelect
export type NewWhatsappBroadcast = typeof whatsappBroadcasts.$inferInsert
export type WhatsappBroadcastRecipient =
  typeof whatsappBroadcastRecipients.$inferSelect
export type NewWhatsappBroadcastRecipient =
  typeof whatsappBroadcastRecipients.$inferInsert
export type WhatsappQuickReply = typeof whatsappQuickReplies.$inferSelect
export type NewWhatsappQuickReply = typeof whatsappQuickReplies.$inferInsert

// ==========================================
// 12. WHATSAPP LINKED DEVICE SESSIONS (Legacy Baileys Table — Sunset in W3B `OD-01`)
// ==========================================

export const whatsappLinkedDeviceSessions = pgTable(
  "whatsapp_linked_device_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionKey: varchar("session_key", { length: 64 })
      .notNull()
      .default("default")
      .unique(),
    label: text("label").notNull().default("Primary Business WhatsApp"),
    phoneNumber: varchar("phone_number", { length: 32 }),
    pushName: text("push_name"),
    status: whatsappLinkedDeviceStatusEnum("status")
      .notNull()
      .default("disconnected"),
    qrDataUrl: text("qr_data_url"),
    pairingCode: varchar("pairing_code", { length: 16 }),
    encryptedAuthCreds: text("encrypted_auth_creds"),
    encryptedAuthKeys: text("encrypted_auth_keys"),
    groupsSyncedCount: integer("groups_synced_count").notNull().default(0),
    lastError: text("last_error"),
    lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("idx_wa_linked_status").on(table.status)]
)

export type WhatsappLinkedDeviceSession =
  typeof whatsappLinkedDeviceSessions.$inferSelect
export type NewWhatsappLinkedDeviceSession =
  typeof whatsappLinkedDeviceSessions.$inferInsert
