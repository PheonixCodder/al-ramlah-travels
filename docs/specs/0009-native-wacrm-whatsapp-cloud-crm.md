# 0009. Native WhatsApp Cloud API Engine and CRM

**Date**: 2026-11-02
**Status**: Approved (Implemented)

## Summary

This specification defines the native integration of the Official Meta WhatsApp Cloud API (version 21.0) directly into the Al Ramlah Travels Next.js 16 and Drizzle ORM platform. Ported from the battle tested wacrm open source codebase, this system provides encrypted WhatsApp Business account management, constant time HMAC webhook verification, bidirectional conversation threading, one click dispatch of three page luxury quotation PDFs, and automated detection of package reference codes. Inbound customer replies automatically clear the fourteen day personal outreach cooldown lock, enabling agency consultants to conduct responsive, compliant pilgrim consultations without external third party aggregators or monthly per conversation SaaS fees.

## Context

WhatsApp is the undisputed primary communication and commerce channel for Pakistani pilgrims and luxury Umrah travelers. Al Ramlah Travels conducts customer consultations, quote disbursements, group departure notices, and customized itinerary revisions predominantly over WhatsApp. Prior to this specification, consultants relied on disconnected manual chats from personal physical phones or unintegrated desktop sessions. Outbound quotes generated in the administrative worksheet required manual PDF exports, manual file transfers, and manual message pasting. This fragmentation created three severe operational bottlenecks:

First, customer conversations had zero linkage to central application dossiers or supplier package codes. When a prospective pilgrim replied to a marketing post (such as code ART-AM-21D-01 or booking reference ART-2026-8812), consultants had to ask the customer to repeat their requirements or manually search database records.

Second, the platform enforces a strict fourteen day personal outreach cooldown rule in the database to prevent spamming prospects across Askari 10 and Lahore travel circles. However, when an intending pilgrim voluntarily sent an inbound inquiry, the cooldown flag remained locked unless a staff member remembered to manually edit the prospect profile in the administrative portal.

Third, relying on third party WhatsApp aggregators (such as Twilio, MessageBird, or WATI) introduces substantial recurring costs, vendor lock in, data sovereignty risks, and delayed webhook deliveries. Because Al Ramlah Travels already operates an official Meta WhatsApp Business Account with verified business credentials, communicating directly with Meta Graph API version 21.0 eliminates intermediary fees while guaranteeing sub second webhook dispatch.

Failing to build a native WhatsApp CRM engine leaves the agency vulnerable to lost leads, disjointed customer communication histories, delayed quote deliveries, and potential account bans from non compliant messaging outside Meta 24 hour customer service windows.

## Requirements

**User stories**:
- As an agency ticketing consultant, I want to view inbound WhatsApp messages in a centralized conversation timeline linked to the pilgrim application dossier so that I have complete journey context during consultation.
- As an outreach specialist, I want inbound customer inquiries containing package reference codes (such as ART-AM-21D-01) to automatically unlock the fourteen day outreach cooldown so that I can immediately converse with warm prospects.
- As an agency administrator, I want to dispatch a rendered three page luxury quotation PDF to a pilgrim WhatsApp number with one click so that high intent travelers receive professional itineraries instantly.
- As a compliance manager, I want all WhatsApp access tokens stored under AES-256-GCM authenticated encryption and all inbound webhooks verified via constant time HMAC signatures so that our integration satisfies strict enterprise security standards.
- As an agency director, I want to broadcast pre approved Meta marketing templates to targeted pilgrim segments and track delivery and read receipts in real time so that seasonal Umrah departures fill efficiently.

**Acceptance criteria**:
- **AC-1**: Drizzle schema in `web/db/schema/whatsapp-crm.ts` defines all seven relational tables (`whatsappAccounts`, `whatsappConversations`, `whatsappMessages`, `whatsappTemplates`, `whatsappBroadcasts`, `whatsappBroadcastRecipients`, and `whatsappQuickReplies`) with comprehensive foreign keys, indexes, and unique constraints.
- **AC-2**: Authenticated encryption module `web/lib/whatsapp/encryption.ts` encrypts Meta access tokens using AES-256-GCM with a twelve byte initialization vector and a sixteen byte authentication tag. It derives a development fallback key from `BETTER_AUTH_SECRET` in non production environments while strictly enforcing a thirty two byte `ENCRYPTION_KEY` in production.
- **AC-3**: Constant time signature verification module `web/lib/whatsapp/webhook-signature.ts` verifies Meta `x-hub-signature-256` headers using `crypto.timingSafeEqual` against comma separated candidate secrets from `META_APP_SECRET`. Capped body reader `web/lib/whatsapp/webhook-body.ts` rejects payloads exceeding four megabytes.
- **AC-4**: Meta Graph API version 21.0 client in `web/lib/whatsapp/meta-api.ts` provides typed, named parameter functions for phone verification, phone health, business registration, free form text messages, media documents (PDFs, images, voice notes), pre approved templates, and structured error extraction with `fbtrace_id`.
- **AC-5**: Post reference detector in `web/lib/whatsapp/post-ref-detector.ts` extracts `ART-...` patterns from inbound message bodies, resolves them against `postAssets` or `applications`, stamps `detectedPostCode` on the conversation, links `outreachContacts`, and updates `lastInboundReplyAt` to immediately unlock the fourteen day outreach cooldown.
- **AC-6**: Webhook endpoint at `web/app/api/webhooks/whatsapp/route.ts` handles `GET` hub challenge handshakes with constant time token comparison, and handles `POST` webhook events by deduplicating messages against the unique `wamid` column, updating message statuses (`sent`, `delivered`, `read`, `failed`), and resetting the twenty four hour customer service window.
- **AC-7**: Server Actions in `web/app/actions/whatsapp-crm.ts` enforce the twenty four hour customer service window, rejecting free form outbound messages when `now - conversation.lastCustomerMessageAt > 24 hours` and requiring a pre approved Meta template instead.
- **AC-8**: Server Action `sendLuxuryQuotationPdfWhatsappAction` triggers `renderAndUploadLuxuryQuotationPdf`, stores the resulting Cloudflare R2 public URL, dispatches a WhatsApp document message with clean filename `Al_Ramlah_Umrah_Quotation.pdf`, and logs the outbound message row.
- **AC-9**: Template send builder in `web/lib/whatsapp/template-send-builder.ts` constructs valid Meta component payloads with header media URLs, body positional or named variables, and dynamic button parameters.
- **AC-10**: Quick replies engine allows consultants to insert pre written Arabic and English messages into the chat composer via slash shortcuts (such as `/umrah-rates` or `/bank-details`).
- **AC-11**: Broadcast core engine creates broadcast batches, validates recipient phone numbers in international format, creates individual recipient tracking rows, dispatches template messages, and updates delivery aggregators.

## Options considered

### Option 1: External microservice deployment (running standalone wacrm container on Supabase)

Deploy the upstream wacrm project as a standalone Node.js and Supabase container on a separate virtual machine, communicating with the main Next.js platform via internal HTTP webhooks.

**Pros**:
- Avoids writing translation adapters between Supabase JavaScript clients and Drizzle ORM.
- Keeps experimental WhatsApp features physically isolated from primary database tables.

**Cons**:
- Requires maintaining two separate PostgreSQL database engines (Neon PostgreSQL for Al Ramlah Travels and Supabase PostgreSQL for wacrm).
- Creates split identity management where staff users must be synchronized across Better Auth and Supabase Auth.
- Prevents atomic relational joins between WhatsApp messages, application dossiers, and supplier flyer post codes.
- Doubles infrastructure operational overhead and hosting expense.

### Option 2: Third party aggregator service (Twilio, WATI, or MessageBird)

Subscribe to a commercial third party WhatsApp Business solution provider that offers pre packaged inbox dashboards and REST APIs.

**Pros**:
- Zero maintenance of Meta Graph API webhooks or signature verifications.
- Quick initial prototype setup via vendor software development kits.

**Cons**:
- Incurs steep markup fees (often two to four cents per conversation on top of Meta wholesale fees), which rapidly escalates costs during large broadcast campaigns.
- Traps customer conversation data in proprietary external clouds, complicating GDPR and data export compliance.
- Lacks native understanding of Al Ramlah custom entities, such as fourteen day outreach cooldowns, flyer post codes, and three page luxury quotation PDFs.
- Vendor outages disrupt customer communication even when Meta Cloud API remains operational.

### Option 3 (Chosen): Native Meta WhatsApp Cloud API v21.0 integration in Next.js 16 and Drizzle ORM

Port the security primitives, Meta API client, and webhook ingestion logic from wacrm directly into `web/lib/whatsapp/` and define native Drizzle ORM schema tables in `web/db/schema/whatsapp-crm.ts` on Neon PostgreSQL.

**Pros**:
- Communicates directly with Meta Cloud API version 21.0 with zero intermediary SaaS fees.
- Stores all accounts, conversations, messages, and broadcasts in the single Neon PostgreSQL database, enabling instant relational joins to `applications`, `outreachContacts`, and `postAssets`.
- Unlocks seamless cross module automation: inbound pilgrim messages instantly clear outreach cooldown locks and link to quoting dossiers.
- Retains full cryptographic control over access tokens via AES-256-GCM with environment specific key derivation.
- Keeps the entire stack unified under Next.js 16 App Router, React Server Components, Server Actions, and Drizzle ORM.

**Cons**:
- Requires porting wacrm Supabase query methods to Drizzle ORM query builders.
- Requires maintaining local webhook endpoints and Meta app configuration.

## Decision

**Chosen option**: Option 3: Native Meta WhatsApp Cloud API v21.0 integration in Next.js 16 and Drizzle ORM.

Al Ramlah Travels will natively embed the official Meta WhatsApp Cloud API engine into the primary web repository, backing all conversations and message logs with Neon PostgreSQL via Drizzle ORM.

**Implementation skills**: `better-auth-security-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-security-best-practices/`)

## Rationale

Embedding the WhatsApp Cloud API natively eliminates the operational friction of running multiple databases while providing a single pane of glass for agency consultants. Because Al Ramlah Travels already manages pilgrim applications and supplier marketing flyers inside the Next.js admin portal, bringing conversations into the same database schema enables automations that external services cannot match. When an intending pilgrim replies to a flyer distributed across Askari 10 WhatsApp groups, the system extracts the embedded post code, maps it to the specific supplier package, unlocks the pilgrim contact cooldown, and equips the consultant with an instant quote draft. Operating directly against Meta Cloud API also cuts messaging expenses to pure Meta wholesale rates, saving substantial funds during high volume Ramadan and Hajj marketing campaigns.

## Feature design

### Component and directory structure

```
web/
├── db/
│   └── schema/
│       ├── index.ts                     # Re-exports whatsapp-crm tables
│       └── whatsapp-crm.ts             # 7 Drizzle tables, enums, relations
├── lib/
│   └── whatsapp/
│       ├── encryption.ts               # AES-256-GCM token cipher with dev fallback
│       ├── webhook-signature.ts        # Constant-time HMAC SHA-256 verifier
│       ├── webhook-body.ts             # Capped request body reader (max 4MB)
│       ├── meta-api.ts                 # Meta Graph API v21.0 named-parameter client
│       ├── post-ref-detector.ts        # ART-... code extractor & cooldown unblocker
│       ├── template-send-builder.ts    # Send-time component & variable constructor
│       ├── broadcast-core.ts           # Batch recipient resolving & delivery fanout
│       └── types.ts                    # WhatsApp TypeScript interfaces & envelopes
├── app/
│   ├── api/
│   │   └── webhooks/
│   │       └── whatsapp/
│   │           └── route.ts            # GET challenge & POST message/receipt handler
│   └── actions/
│       └── whatsapp-crm.ts             # Server Actions: send, quote PDF, templates, setup
```

### Data model sketch (Drizzle PostgreSQL)

The schema defines seven tables in `web/db/schema/whatsapp-crm.ts`:

```typescript
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
```

### State transitions

#### 1. Message delivery lifecycle
```
[Client / Action Send]
        │
        ▼
   ( pending ) ──► Meta API Call ──► ( sent ) [wamid stamped]
                                        │
                         Inbound Status │ Receipt (delivered)
                                        ▼
                                  ( delivered )
                                        │
                         Inbound Status │ Receipt (read)
                                        ▼
                                     ( read )

* On HTTP or Meta network error: ( pending ) ──► ( failed ) [errorCode & errorMessage stamped]
```

#### 2. Broadcast campaign lifecycle
```
( draft ) ──► [Schedule or Launch] ──► ( processing ) ──► All Recipients Processed ──► ( completed )
     │                                        │
     ▼                                        ▼
( cancelled )                            ( failed ) [Unrecoverable Account or Meta error]
```

#### 3. Fourteen day outreach cooldown auto unlock
```
Outreach Contact state:
  lastOutreachAt = 2 days ago
  cooldownUntil = 12 days remaining
  interestStatus = 'contacted_cooldown'
        │
        ▼  [Inbound WhatsApp Message arrives with text or package inquiry]
  post-ref-detector executes:
  1. Detects ART-... code or matches phone number in outreachContacts
  2. Updates outreachContacts.lastInboundReplyAt = new Date()
  3. Updates outreachContacts.interestStatus = 'replied_active'
        │
        ▼
  Result: calculateOutreachCooldown evaluates lastInboundReplyAt > lastOutreachAt
  statusLabel = 'Exempt (Active Customer Reply)'
  isLocked = false
  isEligibleToMessage = true
```

#### 4. Twenty four hour customer service window
```
Pilgrim sends inbound message:
  whatsappConversations.lastCustomerMessageAt = now
  Service Window: OPEN (24:00:00 remaining)
  Allowed outbound messages: Free form text, custom images, luxury quotation PDFs, audio, voice notes

24 Hours elapse with no customer reply:
  now - lastCustomerMessageAt > 24 hours
  Service Window: EXPIRED
  Allowed outbound messages: Pre approved Meta templates ONLY
  Attempted free form send: REJECTED with explicit error message directing consultant to pick a template
```

### API surface

| Endpoint or Server Action | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/webhooks/whatsapp` | GET | `hub.mode`, `hub.verify_token`, `hub.challenge` | Raw challenge text | Public (Meta Verification) | 403 Forbidden |
| `/api/webhooks/whatsapp` | POST | Raw JSON body, `x-hub-signature-256` | `{ status: "ok" }` | HMAC-SHA256 constant time | 401 Unauthorized, 413 Payload Too Large |
| `saveWhatsappAccountAction` | Server Action | `phoneNumberId`, `wabaId`, `displayPhoneNumber`, `accessToken`, `pin` | `{ success: true, accountId }` | `super_admin` | 400 Validation, 401 Unauthorized, 500 Meta Error |
| `sendWhatsappReplyAction` | Server Action | `conversationId`, `messageType`, `text`, `mediaUrl`, `contextMessageId` | `{ success: true, messageId, wamid }` | `staff` or `super_admin` | 400 Outside 24h Window, 404 Conversation Missing |
| `sendLuxuryQuotationPdfWhatsappAction` | Server Action | `applicationId` or `quotationInput`, `phoneNumberOverride` | `{ success: true, pdfUrl, messageId, wamid }` | `staff` or `super_admin` | 404 Application Missing, 422 PDF Generation Failed |
| `sendTemplateMessageAction` | Server Action | `conversationId` or `phone`, `templateName`, `language`, `params` | `{ success: true, messageId, wamid }` | `staff` or `super_admin` | 400 Template Missing, 422 Variable Mismatch |
| `createWhatsappBroadcastAction` | Server Action | `name`, `templateId`, `recipientPhones`, `scheduledAt` | `{ success: true, broadcastId, totalRecipients }` | `super_admin` | 400 Empty Recipients, 404 Template Not Approved |
| `manageQuickRepliesAction` | Server Action | `shortcut`, `title`, `bodyText`, `category` | `{ success: true, quickReplyId }` | `staff` or `super_admin` | 409 Shortcut Exists |

### Value sourcing

| Action | Value produced or displayed | Source |
|---|---|---|
| Inbound message webhook | `whatsappMessages.wamid` | Meta webhook payload `entry[].changes[].value.messages[].id` |
| Inbound message webhook | `whatsappMessages.body` | Meta payload `messages[].text.body` or `button.text` |
| Inbound message webhook | `whatsappConversations.detectedPostCode` | Extracted from message text by `post-ref-detector.ts` regex |
| Inbound message webhook | `outreachContacts.lastInboundReplyAt` | Current server timestamp `new Date()` upon verified inbound message |
| Inbound message webhook | `whatsappConversations.lastCustomerMessageAt` | Timestamp `new Date(Number(messages[].timestamp) * 1000)` |
| Quotation dispatch | `whatsappMessages.mediaUrl` | Cloudflare R2 URL returned by `renderAndUploadLuxuryQuotationPdf` |
| Quotation dispatch | `whatsappMessages.mediaFilename` | Static branding string `'Al_Ramlah_Umrah_Quotation.pdf'` |
| Outbound reply | Service window status | Derived from `Date.now() - conversation.lastCustomerMessageAt <= 86400000` |
| Account setup | `whatsappAccounts.encryptedAccessToken` | Output of `encrypt(rawAccessToken)` using AES-256-GCM |
| Account setup | `whatsappAccounts.verifiedName` | Meta Graph API response from `GET /{phoneNumberId}?fields=verified_name` |

### Key invariants

1. **Idempotency via unique wamid**: Every message received from Meta carries a globally unique `wamid`. The database enforces a `uniqueIndex` on `whatsappMessages.wamid`. Any duplicate webhook replay from Meta is skipped cleanly without creating duplicate messages or duplicate unread counts.
2. **Constant time HMAC verification**: Every inbound webhook POST must match at least one candidate secret in `META_APP_SECRET`. Comparisons use `crypto.timingSafeEqual` with matched buffer lengths to prevent timing side channel attacks.
3. **AES-256-GCM authenticated encryption**: All Meta Graph API access tokens are stored encrypted in PostgreSQL. Every ciphertext contains a twelve byte random initialization vector, the ciphertext bytes, and a sixteen byte authentication tag separated by colons (`iv:ciphertext:tag`). Any bit flipping or storage tampering causes immediate decryption failure.
4. **Strict twenty four hour customer service window**: Free form outbound text and media messages are strictly permitted only within twenty four hours of the customer last inbound message (`lastCustomerMessageAt`). Outside this window, server actions reject free form messaging and require an approved Meta template.
5. **Deterministic fourteen day cooldown unlock**: Whenever an inbound customer message matches a known `outreachContacts` phone number, `lastInboundReplyAt` is set to the current timestamp. Domain helper `calculateOutreachCooldown` detects `lastInboundReplyAt > lastOutreachAt` and marks the contact exempt from cooldown, allowing consultants to reply immediately without administrative hurdles.

### Security model

- **Authentication & Roles**:
  - `super_admin`: Full access to configure WhatsApp Business accounts, rotate tokens, create broadcasts, edit quick replies, and view all conversations.
  - `staff`: Access to view conversations, send replies inside open 24 hour windows, dispatch quotation PDFs, send approved templates, and use quick replies. Blocked from altering account tokens or triggering mass broadcasts.
  - `public`: Unauthenticated access is restricted strictly to `/api/webhooks/whatsapp` for Meta verification and webhook delivery, guarded by HMAC SHA-256 signatures.
- **Credential Storage**: Meta access tokens are never logged or returned in plain text to client browsers. In production, omitting `ENCRYPTION_KEY` triggers an immediate boot failure. In development, key derivation from `BETTER_AUTH_SECRET` allows seamless local testing without complex configuration.

### Configuration required

- `ENCRYPTION_KEY`: A sixty four character hexadecimal string (thirty two bytes) used for AES-256-GCM encryption of Meta tokens. Mandatory in production.
- `META_APP_SECRET`: Meta App Secret obtained from Meta App Dashboard (App Settings -> Basic). Supports multiple comma separated secrets for multi app environments.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: High entropy random secret string configured in Meta App Dashboard Webhooks configuration for challenge verification.
- `BETTER_AUTH_SECRET`: Existing auth secret used as a salt for fallback encryption key derivation in local development.

### Critical test scenarios

- **Happy path: Inbound inquiry auto detection and cooldown unlock**: Pilgrim sends WhatsApp message `"Salam, what is the price for ART-AM-21D-01?"`. System verifies HMAC signature, creates conversation, extracts `ART-AM-21D-01`, links flyer package, updates `outreachContacts.lastInboundReplyAt`, unfreezes fourteen day cooldown, and records inbound message with unread count. Verifies **AC-1**, **AC-3**, **AC-5**, **AC-6**.
- **Happy path: One click three page quotation PDF dispatch**: Consultant clicks `"Send Quote via WhatsApp"` on application dossier. Action renders PDF via `renderAndUploadLuxuryQuotationPdf`, uploads to Cloudflare R2, calls Meta Graph API `sendMediaMessage`, records outbound message with `wamid`, and links conversation to application. Verifies **AC-4**, **AC-8**.
- **Failure case: Outside twenty four hour customer service window**: Consultant attempts to send free form text to a customer who has not replied in thirty hours. Server Action checks `now - conversation.lastCustomerMessageAt > 24 hours` and throws an error indicating the customer service window is closed and prompting for an approved template. Verifies **AC-7**.
- **Failure case: Webhook HMAC signature forgery**: Attacker posts fake status payloads to `/api/webhooks/whatsapp` without a valid `x-hub-signature-256` header. System fails constant time verification and returns HTTP 401 Unauthorized without executing database operations. Verifies **AC-3**.
- **Failure case: Idempotent message deduplication**: Meta delivers the same message webhook twice due to network delay. On second delivery, unique constraint on `whatsappMessages.wamid` catches the insert, skipping duplicate logging and preserving unread counts. Verifies **AC-1**, **AC-6**.
- **Auth and permission guard**: Staff user attempts to trigger `createWhatsappBroadcastAction`. Server action checks user role via Better Auth session, recognizes lack of `super_admin` privilege, and denies access with HTTP 403 Forbidden. Verifies **AC-11**.

## Build plan

The build plan follows the Tracer Bullet approach, establishing a thin end to end thread through schema, security verification, Meta Graph client, inbound webhooks, and administrative actions.

1. Create Drizzle schema `web/db/schema/whatsapp-crm.ts` defining all seven tables, enums, indexes, and relations, satisfying **AC-1**.
2. Build AES-256-GCM authenticated encryption in `web/lib/whatsapp/encryption.ts` with twelve byte initialization vector, sixteen byte auth tag, and development key fallback from `BETTER_AUTH_SECRET`, satisfying **AC-2**.
3. Implement constant time signature verification in `web/lib/whatsapp/webhook-signature.ts` and capped body reader in `web/lib/whatsapp/webhook-body.ts`, satisfying **AC-3**.
4. Port Meta Graph API version 21.0 client in `web/lib/whatsapp/meta-api.ts` with typed named parameter helpers for text, media documents, templates, and phone health, satisfying **AC-4**.
5. Build post reference detector in `web/lib/whatsapp/post-ref-detector.ts` to extract `ART-...` codes and update `outreachContacts.lastInboundReplyAt` to unblock fourteen day cooldowns, satisfying **AC-5**.
6. Implement webhook route `web/app/api/webhooks/whatsapp/route.ts` with `GET` challenge handshake and `POST` inbound message and status ingestion with `wamid` deduplication, satisfying **AC-6**, **AC-7**.
7. Implement template send builder in `web/lib/whatsapp/template-send-builder.ts` for dynamic header media and button parameter assembly, satisfying **AC-9**.
8. Build broadcast core in `web/lib/whatsapp/broadcast-core.ts` for recipient validation, batch logging, and delivery aggregation, satisfying **AC-11**.
9. Implement Server Actions in `web/app/actions/whatsapp-crm.ts` for account onboarding, conversation replies with twenty four hour window checks, one click luxury quotation PDF sending, and quick replies management, satisfying **AC-7**, **AC-8**, **AC-10**.
10. Add unit and integration tests covering encryption round trips, constant time signature verification, post code detection, and cooldown unblocking, satisfying **AC-2**, **AC-3**, **AC-5**.

### Scope milestone rollup

- **Milestone 1**: Drizzle PostgreSQL Schema and Encryption Foundation (`web/db/schema/whatsapp-crm.ts`, `web/lib/whatsapp/encryption.ts`, types, Zod schemas)
- **Milestone 2**: Meta Graph API v21.0 Client, Post Reference Detector and 14 Day Cooldown Auto Unlock (`web/lib/whatsapp/meta-api.ts`, `web/lib/whatsapp/post-ref-detector.ts`, `web/lib/whatsapp/template-send-builder.ts`)
- **Milestone 3**: Inbound Webhook Handler with Constant Time HMAC Verification (`web/lib/whatsapp/webhook-signature.ts`, `web/lib/whatsapp/webhook-body.ts`, `web/app/api/webhooks/whatsapp/route.ts`)
- **Milestone 4**: WhatsApp CRM Server Actions, 1 Click Luxury Quotation PDF Dispatch and Meta Template Broadcasts (`web/app/actions/whatsapp-crm.ts`, `web/lib/whatsapp/broadcast-core.ts`)

## Consequences

**Positive**:
- Direct integration with Meta Graph API version 21.0 eliminates all third party SaaS intermediary costs.
- Complete consolidation of WhatsApp messages into Neon PostgreSQL enables instantaneous cross referencing with applications, supplier flyers, and outreach contacts.
- Inbound inquiries automatically unblock the fourteen day outreach cooldown, turning cold outreach tracking into an intelligent, active conversation lifecycle.
- Consultants can dispatch pristine three page luxury quotation PDFs directly into customer WhatsApp chats with a single click.

**Negative / tradeoffs**:
- Requires careful operational monitoring of Meta Webhook delivery status and access token validity.
- Agency consultants must be trained on Meta twenty four hour customer service window rules to ensure outbound messages use approved templates when windows lapse.

**Neutral**:
- Requires configuring `META_APP_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in deployment environment variables.

## Follow-up

- [ ] Register the production webhook URL in Meta App Dashboard under WhatsApp -> Configuration -> Webhook Callback URL once deployed.
- [ ] Ensure Meta App Review permissions for `whatsapp_business_messaging` and `whatsapp_business_management` are approved for production tier messaging limits.

## References

**Project sources**:
- Cloned wacrm repository source code in `services/wacrm/src/lib/whatsapp/`
- Existing marketing and outreach schema in `web/db/schema/suppliers-and-marketing.ts`
- Existing application dossier schema in `web/db/schema/applications.ts`
- Luxury quotation PDF generator in `web/lib/posters/render-quotation-pdf.ts`
- Outreach cooldown domain engine in `web/lib/domain/marketing-ops.ts`

**Practices & standards**:
- Meta WhatsApp Cloud API version 21.0 Documentation (Webhook verification, messages endpoint, media upload, pre approved templates)
- National Institute of Standards and Technology NIST SP 800-38D Recommendation for Galois/Counter Mode (GCM)
- RFC 2104 HMAC Keyed Hashing for Message Authentication
- OWASP Cryptographic Storage Guidelines for sensitive third party access tokens
