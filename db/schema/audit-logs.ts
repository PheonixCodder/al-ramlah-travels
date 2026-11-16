import { relations } from "drizzle-orm"
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

/**
 * Append-only security & financial audit trail (`T-009`).
 * Backed by a PostgreSQL `BEFORE UPDATE OR DELETE` immutability trigger so rows
 * can never be altered or deleted via standard application DML.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: text("actor_id"),
    actorRole: varchar("actor_role", { length: 32 }),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: text("entity_id"),
    beforeJson: jsonb("before_json").$type<Record<string, unknown> | null>(),
    afterJson: jsonb("after_json").$type<Record<string, unknown> | null>(),
    ipHash: varchar("ip_hash", { length: 64 }),
    requestId: varchar("request_id", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_audit_logs_entity").on(table.entityType, table.entityId),
    index("idx_audit_logs_actor_created").on(table.actorId, table.createdAt),
    index("idx_audit_logs_action_created").on(table.action, table.createdAt),
  ]
)

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(user, {
    fields: [auditLogs.actorId],
    references: [user.id],
  }),
}))

/**
 * Shared serverless-safe rate-limit buckets (`T-009`).
 * Updated atomically via `INSERT ... ON CONFLICT (key) DO UPDATE` so limits hold
 * across Vercel serverless isolates and worker instances without Redis.
 */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: varchar("key", { length: 255 }).primaryKey(),
    count: integer("count").notNull().default(1),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_rate_limit_buckets_expires_at").on(table.expiresAt)]
)
