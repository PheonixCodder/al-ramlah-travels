import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

// ==========================================
// CMS ENUMS
// ==========================================

export const faqCategoryEnum = pgEnum("faq_category", [
  "general",
  "visa",
  "hotels",
  "transport",
  "packages",
  "hajj",
])

export const messageStatusEnum = pgEnum("message_status", [
  "unread",
  "read",
  "replied",
  "archived",
])

// ==========================================
// PUBLIC CMS & MESSAGES TABLES
// ==========================================

export const heroSlides = pgTable(
  "hero_slides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    badge: text("badge"),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    imageUrl: text("image_url").notNull(),
    primaryCtaLabel: text("primary_cta_label")
      .notNull()
      .default("Plan Custom Umrah"),
    primaryCtaUrl: text("primary_cta_url").notNull().default("#custom-builder"),
    secondaryCtaLabel: text("secondary_cta_label").default("Explore Packages"),
    secondaryCtaUrl: text("secondary_cta_url").default("#group-packages"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_hero_active").on(table.isActive),
    index("idx_hero_sort").on(table.sortOrder),
  ]
)

export const testimonials = pgTable(
  "testimonials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pilgrimName: text("pilgrim_name").notNull(),
    city: text("city").notNull(),
    quote: text("quote").notNull(),
    packageOrJourneyType: text("package_or_journey_type").notNull(),
    rating: integer("rating").notNull().default(5),
    avatarUrl: text("avatar_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_testimonial_active").on(table.isActive),
    index("idx_testimonial_featured").on(table.isFeatured),
    check("chk_testimonials_rating", sql`${table.rating} BETWEEN 1 AND 5`),
  ]
)

export const faqs = pgTable(
  "faqs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: faqCategoryEnum("category").notNull().default("general"),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_faq_category").on(table.category),
    index("idx_faq_active").on(table.isActive),
  ]
)

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }).notNull(),
    whatsapp: varchar("whatsapp", { length: 32 }),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: messageStatusEnum("status").notNull().default("unread"),
    adminNotes: text("admin_notes"),
    utmSource: varchar("utm_source", { length: 120 }),
    utmMedium: varchar("utm_medium", { length: 120 }),
    utmCampaign: varchar("utm_campaign", { length: 160 }),
    utmContent: varchar("utm_content", { length: 160 }),
    utmTerm: varchar("utm_term", { length: 160 }),
    landingPage: text("landing_page"),
    httpReferrer: text("http_referrer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_contact_status").on(table.status),
    index("idx_contact_created").on(table.createdAt),
    index("idx_contact_messages_utm_source").on(table.utmSource),
  ]
)
