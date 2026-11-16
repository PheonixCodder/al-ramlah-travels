import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export const agencySettings = pgTable(
  "agency_settings",
  {
    id: varchar("id", { length: 32 }).primaryKey().default("default"),
    agencyName: text("agency_name").notNull().default("Al Ramlah Travels"),
    legalEntityName: text("legal_entity_name")
      .notNull()
      .default("Al Ramlah Travels"),
    tagline: text("tagline")
      .notNull()
      .default("Where Purpose Meets Excellence"),
    primaryWhatsapp: varchar("primary_whatsapp", { length: 32 })
      .notNull()
      .default("03274029701"),
    secondaryPhone: varchar("secondary_phone", { length: 32 }).default(
      "03190462638"
    ),
    supportEmail: varchar("support_email", { length: 255 })
      .notNull()
      .default("alramlahtravels@gmail.com"),
    officeAddress: text("office_address")
      .notNull()
      .default(
        "Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan"
      ),
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
    sarToPkrRate: numeric("sar_to_pkr_rate", {
      precision: 10,
      scale: 4,
      mode: "number",
    })
      .notNull()
      .default(75),

    // Regulatory & Banking Governance (`OD-10`, `T-080`)
    dtsLicense: varchar("dts_license", { length: 64 }),
    moraLicense: varchar("mora_license", { length: 64 }),
    iataCode: varchar("iata_code", { length: 32 }),
    ntnNumber: varchar("ntn_number", { length: 64 }),
    bankName: text("bank_name"),
    accountTitle: text("account_title").default("Al Ramlah Travels"),
    officialIban: varchar("official_iban", { length: 64 }),
    ibanVerified: boolean("iban_verified").notNull().default(false),

    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("chk_agency_settings_singleton", sql`${table.id} = 'default'`),
    check(
      "chk_agency_settings_positive_forex",
      sql`${table.sarToPkrRate} > 0 AND ${table.slaOverdueHours} >= 1`
    ),
  ]
)
