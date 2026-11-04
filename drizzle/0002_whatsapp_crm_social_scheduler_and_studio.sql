-- 0002: Multimodal Studio Columns + Native WACRM (Meta WhatsApp Cloud API) + Native Postiz Core 5 Social Scheduler

ALTER TYPE "channel_platform" ADD VALUE IF NOT EXISTS 'google_business';

ALTER TABLE "supplier_flyers" ADD COLUMN IF NOT EXISTS "social_ready_sheet_jpeg_url" text;
ALTER TABLE "supplier_flyers" ADD COLUMN IF NOT EXISTS "ingestion_source" varchar(32) DEFAULT 'raw_supplier_flyer' NOT NULL;
ALTER TABLE "supplier_flyers" ADD COLUMN IF NOT EXISTS "extraction_status" varchar(32) DEFAULT 'completed' NOT NULL;

-- ==========================================
-- 1. WHATSAPP CRM ENUMS & TABLES
-- ==========================================

DO $$ BEGIN
  CREATE TYPE "whatsapp_message_direction" AS ENUM ('inbound', 'outbound');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "whatsapp_message_status" AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "whatsapp_message_type" AS ENUM ('text', 'image', 'document', 'audio', 'video', 'template', 'interactive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "whatsapp_template_category" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "whatsapp_template_status" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "whatsapp_broadcast_status" AS ENUM ('draft', 'scheduled', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "whatsapp_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text DEFAULT 'Al Ramlah Primary' NOT NULL,
  "phone_number_id" varchar(64) NOT NULL UNIQUE,
  "waba_id" varchar(64) NOT NULL,
  "display_phone_number" varchar(32) NOT NULL,
  "verified_name" text,
  "quality_rating" varchar(32) DEFAULT 'GREEN',
  "messaging_limit" varchar(64),
  "encrypted_access_token" text NOT NULL,
  "webhook_verify_token" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_default" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_wa_acc_phone_id" ON "whatsapp_accounts" ("phone_number_id");
CREATE INDEX IF NOT EXISTS "idx_wa_acc_active" ON "whatsapp_accounts" ("is_active");

CREATE TABLE IF NOT EXISTS "whatsapp_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE,
  "contact_phone" varchar(32) NOT NULL,
  "contact_name" text,
  "outreach_contact_id" uuid REFERENCES "outreach_contacts"("id") ON DELETE SET NULL,
  "application_id" uuid REFERENCES "applications"("id") ON DELETE SET NULL,
  "detected_post_code" varchar(64),
  "last_customer_message_at" timestamp with time zone,
  "last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
  "unread_count" integer DEFAULT 0 NOT NULL,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "assigned_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_wa_conv_acc_phone" ON "whatsapp_conversations" ("account_id", "contact_phone");
CREATE INDEX IF NOT EXISTS "idx_wa_conv_last_msg" ON "whatsapp_conversations" ("account_id", "last_message_at");
CREATE INDEX IF NOT EXISTS "idx_wa_conv_outreach" ON "whatsapp_conversations" ("outreach_contact_id");
CREATE INDEX IF NOT EXISTS "idx_wa_conv_app" ON "whatsapp_conversations" ("application_id");
CREATE INDEX IF NOT EXISTS "idx_wa_conv_detected_code" ON "whatsapp_conversations" ("detected_post_code");

CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE,
  "wamid" varchar(128) NOT NULL UNIQUE,
  "direction" "whatsapp_message_direction" NOT NULL,
  "status" "whatsapp_message_status" DEFAULT 'sent' NOT NULL,
  "message_type" "whatsapp_message_type" NOT NULL,
  "body" text,
  "media_url" text,
  "media_type" varchar(64),
  "media_filename" text,
  "template_name" varchar(128),
  "context_message_id" varchar(128),
  "raw_payload" jsonb,
  "error_code" varchar(32),
  "error_message" text,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_wa_msg_wamid" ON "whatsapp_messages" ("wamid");
CREATE INDEX IF NOT EXISTS "idx_wa_msg_conv_created" ON "whatsapp_messages" ("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_wa_msg_status" ON "whatsapp_messages" ("status");

CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE,
  "meta_template_id" varchar(64) NOT NULL,
  "name" varchar(128) NOT NULL,
  "language" varchar(16) DEFAULT 'en_US' NOT NULL,
  "category" "whatsapp_template_category" NOT NULL,
  "status" "whatsapp_template_status" NOT NULL,
  "header_type" varchar(24),
  "header_content" text,
  "body_text" text NOT NULL,
  "footer_text" text,
  "buttons" jsonb DEFAULT '[]'::jsonb,
  "variable_mapping" jsonb DEFAULT '{}'::jsonb,
  "synced_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_wa_tmpl_acc_name_lang" ON "whatsapp_templates" ("account_id", "name", "language");
CREATE INDEX IF NOT EXISTS "idx_wa_tmpl_status" ON "whatsapp_templates" ("status");

CREATE TABLE IF NOT EXISTS "whatsapp_broadcasts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "whatsapp_templates"("id") ON DELETE RESTRICT,
  "template_name" varchar(128) NOT NULL,
  "template_language" varchar(16) DEFAULT 'en_US' NOT NULL,
  "status" "whatsapp_broadcast_status" DEFAULT 'draft' NOT NULL,
  "total_recipients" integer DEFAULT 0 NOT NULL,
  "sent_count" integer DEFAULT 0 NOT NULL,
  "delivered_count" integer DEFAULT 0 NOT NULL,
  "read_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "scheduled_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_wa_bc_acc_status" ON "whatsapp_broadcasts" ("account_id", "status");
CREATE INDEX IF NOT EXISTS "idx_wa_bc_scheduled" ON "whatsapp_broadcasts" ("scheduled_at");

CREATE TABLE IF NOT EXISTS "whatsapp_broadcast_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "broadcast_id" uuid NOT NULL REFERENCES "whatsapp_broadcasts"("id") ON DELETE CASCADE,
  "contact_phone" varchar(32) NOT NULL,
  "outreach_contact_id" uuid REFERENCES "outreach_contacts"("id") ON DELETE SET NULL,
  "status" "whatsapp_message_status" DEFAULT 'pending' NOT NULL,
  "wamid" varchar(128),
  "template_params" jsonb DEFAULT '{}'::jsonb,
  "error_code" varchar(32),
  "error_message" text,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "read_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_wa_bc_recip_broadcast" ON "whatsapp_broadcast_recipients" ("broadcast_id", "status");
CREATE INDEX IF NOT EXISTS "idx_wa_bc_recip_wamid" ON "whatsapp_broadcast_recipients" ("wamid");
CREATE INDEX IF NOT EXISTS "idx_wa_bc_recip_phone" ON "whatsapp_broadcast_recipients" ("contact_phone");

CREATE TABLE IF NOT EXISTS "whatsapp_quick_replies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE,
  "shortcut" varchar(64) NOT NULL,
  "title" text NOT NULL,
  "category" varchar(32) DEFAULT 'general' NOT NULL,
  "body_text" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_wa_qr_shortcut" ON "whatsapp_quick_replies" ("account_id", "shortcut");
CREATE INDEX IF NOT EXISTS "idx_wa_qr_active" ON "whatsapp_quick_replies" ("account_id", "is_active");

-- ==========================================
-- 2. SOCIAL SCHEDULER ENUMS & TABLES
-- ==========================================

DO $$ BEGIN
  CREATE TYPE "social_provider" AS ENUM ('instagram', 'facebook', 'tiktok', 'youtube', 'gmb');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "scheduled_post_type" AS ENUM ('single_image', 'carousel', 'video', 'story', 'offer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "scheduled_post_campaign_stage" AS ENUM ('step_1_spotlight_hook', 'step_2_all_packages', 'standalone');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "scheduled_post_status" AS ENUM ('draft', 'scheduled', 'publishing', 'completed', 'partially_failed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "scheduled_post_target_status" AS ENUM ('pending', 'publishing', 'published', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "social_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" "social_provider" NOT NULL,
  "name" text NOT NULL,
  "handle" text,
  "avatar_url" text,
  "internal_account_id" text NOT NULL,
  "encrypted_access_token" text NOT NULL,
  "encrypted_refresh_token" text,
  "token_expires_at" timestamp with time zone,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_synced_at" timestamp with time zone,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_social_integrations_provider_acc" ON "social_integrations" ("provider", "internal_account_id");
CREATE INDEX IF NOT EXISTS "idx_social_integrations_provider" ON "social_integrations" ("provider");
CREATE INDEX IF NOT EXISTS "idx_social_integrations_active" ON "social_integrations" ("is_active");

CREATE TABLE IF NOT EXISTS "scheduled_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_asset_id" uuid REFERENCES "post_assets"("id") ON DELETE SET NULL,
  "caption" text NOT NULL,
  "post_type" "scheduled_post_type" DEFAULT 'single_image' NOT NULL,
  "media_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "social_jpeg_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "campaign_stage" "scheduled_post_campaign_stage" DEFAULT 'standalone' NOT NULL,
  "paired_follow_up_post_id" uuid,
  "two_step_delay_minutes" integer DEFAULT 180 NOT NULL,
  "status" "scheduled_post_status" DEFAULT 'draft' NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "trigger_run_id" text,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_scheduled_posts_scheduled_for" ON "scheduled_posts" ("scheduled_for");
CREATE INDEX IF NOT EXISTS "idx_scheduled_posts_status" ON "scheduled_posts" ("status");
CREATE INDEX IF NOT EXISTS "idx_scheduled_posts_post_asset" ON "scheduled_posts" ("post_asset_id");
CREATE INDEX IF NOT EXISTS "idx_scheduled_posts_trigger_run" ON "scheduled_posts" ("trigger_run_id");

CREATE TABLE IF NOT EXISTS "scheduled_post_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scheduled_post_id" uuid NOT NULL REFERENCES "scheduled_posts"("id") ON DELETE CASCADE,
  "integration_id" uuid NOT NULL REFERENCES "social_integrations"("id") ON DELETE CASCADE,
  "status" "scheduled_post_target_status" DEFAULT 'pending' NOT NULL,
  "published_url" text,
  "external_post_id" text,
  "idempotency_key" varchar(128) NOT NULL,
  "error_message" text,
  "published_at" timestamp with time zone,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_scheduled_post_targets_idempotency" ON "scheduled_post_targets" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "idx_scheduled_post_targets_post_integration" ON "scheduled_post_targets" ("scheduled_post_id", "integration_id");
CREATE INDEX IF NOT EXISTS "idx_scheduled_post_targets_status" ON "scheduled_post_targets" ("status");
