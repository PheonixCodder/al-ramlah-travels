import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const agencySettings = pgTable("agency_settings", {
  id: varchar("id", { length: 32 }).primaryKey().default("default"),
  agencyName: text("agency_name").notNull().default("Al Ramlah Travels"),
  tagline: text("tagline")
    .notNull()
    .default("Where Purpose Meets Excellence"),
  primaryWhatsapp: varchar("primary_whatsapp", { length: 32 })
    .notNull()
    .default("03274029701"),
  secondaryPhone: varchar("secondary_phone", { length: 32 }).default("03190462638"),
  supportEmail: varchar("support_email", { length: 255 })
    .notNull()
    .default("alramlahtravels@gmail.com"),
  officeAddress: text("office_address")
    .notNull()
    .default("House no 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt"),
  mapsEmbedUrl: text("maps_embed_url").default(
    "https://maps.google.com/?q=Sector+C+Askari+10+Airport+Road+Lahore+Cantt"
  ),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  youtubeUrl: text("youtube_url"),
  tiktokUrl: text("tiktok_url"),
  workingHours: text("working_hours")
    .notNull()
    .default("Monday to Saturday: 9:00 AM to 8:00 PM PKT"),
  slaOverdueHours: integer("sla_overdue_hours").notNull().default(24),
  sarToPkrRate: integer("sar_to_pkr_rate").notNull().default(75),
  updatedByUserId: text("updated_by_user_id").references(() => user.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
