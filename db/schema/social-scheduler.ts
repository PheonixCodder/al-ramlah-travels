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
import { postAssets } from "./suppliers-and-marketing"

// ==========================================
// 1. SOCIAL SCHEDULER ENUMS
// ==========================================

export const socialProviderEnum = pgEnum("social_provider", [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "gmb",
])

export const scheduledPostTypeEnum = pgEnum("scheduled_post_type", [
  "single_image",
  "carousel",
  "video",
  "story",
  "offer",
])

export const scheduledPostCampaignStageEnum = pgEnum(
  "scheduled_post_campaign_stage",
  ["step_1_spotlight_hook", "step_2_all_packages", "standalone"]
)

export const scheduledPostStatusEnum = pgEnum("scheduled_post_status", [
  "draft",
  "scheduled",
  "publishing",
  "completed",
  "partially_failed",
  "failed",
  "cancelled",
])

export const scheduledPostTargetStatusEnum = pgEnum(
  "scheduled_post_target_status",
  ["pending", "publishing", "published", "failed", "skipped"]
)

// ==========================================
// 2. CONNECTED SOCIAL INTEGRATIONS
// ==========================================

export const socialIntegrations = pgTable(
  "social_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: socialProviderEnum("provider").notNull(),
    name: text("name").notNull(),
    handle: text("handle"),
    avatarUrl: text("avatar_url"),
    internalAccountId: text("internal_account_id").notNull(),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
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
    uniqueIndex("idx_social_integrations_provider_acc").on(
      table.provider,
      table.internalAccountId
    ),
    index("idx_social_integrations_provider").on(table.provider),
    index("idx_social_integrations_active").on(table.isActive),
  ]
)

// ==========================================
// 3. SCHEDULED SOCIAL POSTS
// ==========================================

export const scheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postAssetId: uuid("post_asset_id").references(() => postAssets.id, {
      onDelete: "set null",
    }),
    caption: text("caption").notNull(),
    postType: scheduledPostTypeEnum("post_type")
      .notNull()
      .default("single_image"),
    mediaUrls: jsonb("media_urls").$type<string[]>().notNull().default([]),
    socialJpegUrls: jsonb("social_jpeg_urls")
      .$type<string[]>()
      .notNull()
      .default([]),
    campaignStage: scheduledPostCampaignStageEnum("campaign_stage")
      .notNull()
      .default("standalone"),
    pairedFollowUpPostId: uuid("paired_follow_up_post_id"),
    twoStepDelayMinutes: integer("two_step_delay_minutes")
      .notNull()
      .default(180),
    status: scheduledPostStatusEnum("status").notNull().default("draft"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    triggerRunId: text("trigger_run_id"),
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
    index("idx_scheduled_posts_scheduled_for").on(table.scheduledFor),
    index("idx_scheduled_posts_status").on(table.status),
    index("idx_scheduled_posts_post_asset").on(table.postAssetId),
    index("idx_scheduled_posts_trigger_run").on(table.triggerRunId),
  ]
)

// ==========================================
// 4. SCHEDULED POST TARGETS (Per Channel)
// ==========================================

export const scheduledPostTargets = pgTable(
  "scheduled_post_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduledPostId: uuid("scheduled_post_id")
      .notNull()
      .references(() => scheduledPosts.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => socialIntegrations.id, { onDelete: "cascade" }),
    status: scheduledPostTargetStatusEnum("status")
      .notNull()
      .default("pending"),
    publishedUrl: text("published_url"),
    externalPostId: text("external_post_id"),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    errorMessage: text("error_message"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_scheduled_post_targets_idempotency").on(
      table.idempotencyKey
    ),
    index("idx_scheduled_post_targets_post_integration").on(
      table.scheduledPostId,
      table.integrationId
    ),
    index("idx_scheduled_post_targets_status").on(table.status),
  ]
)

// ==========================================
// 5. RELATIONS
// ==========================================

export const socialIntegrationsRelations = relations(
  socialIntegrations,
  ({ one, many }) => ({
    createdByUser: one(user, {
      fields: [socialIntegrations.createdByUserId],
      references: [user.id],
    }),
    targets: many(scheduledPostTargets),
  })
)

export const scheduledPostsRelations = relations(
  scheduledPosts,
  ({ one, many }) => ({
    postAsset: one(postAssets, {
      fields: [scheduledPosts.postAssetId],
      references: [postAssets.id],
    }),
    pairedFollowUpPost: one(scheduledPosts, {
      fields: [scheduledPosts.pairedFollowUpPostId],
      references: [scheduledPosts.id],
      relationName: "pairedFollowUp",
    }),
    createdByUser: one(user, {
      fields: [scheduledPosts.createdByUserId],
      references: [user.id],
    }),
    targets: many(scheduledPostTargets),
  })
)

export const scheduledPostTargetsRelations = relations(
  scheduledPostTargets,
  ({ one }) => ({
    scheduledPost: one(scheduledPosts, {
      fields: [scheduledPostTargets.scheduledPostId],
      references: [scheduledPosts.id],
    }),
    integration: one(socialIntegrations, {
      fields: [scheduledPostTargets.integrationId],
      references: [socialIntegrations.id],
    }),
  })
)

// ==========================================
// 6. TYPE INFERENCES
// ==========================================

export type SocialIntegration = typeof socialIntegrations.$inferSelect
export type NewSocialIntegration = typeof socialIntegrations.$inferInsert

export type ScheduledPost = typeof scheduledPosts.$inferSelect
export type NewScheduledPost = typeof scheduledPosts.$inferInsert

export type ScheduledPostTarget = typeof scheduledPostTargets.$inferSelect
export type NewScheduledPostTarget = typeof scheduledPostTargets.$inferInsert
