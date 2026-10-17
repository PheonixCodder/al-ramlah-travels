import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const agencySettings = pgTable("agency_settings", {
  id: varchar("id", { length: 32 }).primaryKey().default("default"),
  agencyName: text("agency_name").notNull().default("Al Ramlah Travels"),
  tagline: text("tagline")
    .notNull()
    .default("Sacred Journeys Crafted with Dignity & Comfort"),
  primaryWhatsapp: varchar("primary_whatsapp", { length: 32 })
    .notNull()
    .default("+923001234567"),
  secondaryPhone: varchar("secondary_phone", { length: 32 }),
  supportEmail: varchar("support_email", { length: 255 })
    .notNull()
    .default("info@alramlahtravels.com"),
  officeAddress: text("office_address")
    .notNull()
    .default("Suite 402, Al-Hafeez Heights, Gulberg III, Lahore, Pakistan"),
  mapsEmbedUrl: text("maps_embed_url"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  youtubeUrl: text("youtube_url"),
  tiktokUrl: text("tiktok_url"),
  workingHours: text("working_hours")
    .notNull()
    .default("Monday to Saturday, 9:00 AM to 8:00 PM PKT"),
  slaOverdueHours: integer("sla_overdue_hours").notNull().default(24),
  updatedByUserId: text("updated_by_user_id").references(() => user.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
