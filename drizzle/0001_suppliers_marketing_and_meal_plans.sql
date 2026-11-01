-- 0001: Restored Hotel Meal Plans + B2B Suppliers, 4K Post Studio, Multi-Channel Distribution & 14-Day Outreach CRM

DO $$ BEGIN
  CREATE TYPE "meal_plan_type" AS ENUM ('room_only', 'breakfast', 'half_board', 'full_board');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "offers_meal_plan" boolean DEFAULT true NOT NULL;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "breakfast_price_sar_per_pax" integer DEFAULT 35 NOT NULL;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "lunch_price_sar_per_pax" integer DEFAULT 45 NOT NULL;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "dinner_price_sar_per_pax" integer DEFAULT 50 NOT NULL;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "full_board_price_sar_per_pax" integer DEFAULT 115 NOT NULL;

ALTER TABLE "application_hotel_stays" ADD COLUMN IF NOT EXISTS "meal_plan" "meal_plan_type" DEFAULT 'room_only' NOT NULL;
ALTER TABLE "application_hotel_stays" ADD COLUMN IF NOT EXISTS "include_breakfast" boolean DEFAULT false NOT NULL;
ALTER TABLE "application_hotel_stays" ADD COLUMN IF NOT EXISTS "include_lunch" boolean DEFAULT false NOT NULL;
ALTER TABLE "application_hotel_stays" ADD COLUMN IF NOT EXISTS "include_dinner" boolean DEFAULT false NOT NULL;

ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "source_post_code" varchar(64);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "source_channel_id" uuid;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "supplier_id" uuid;

ALTER TABLE "application_quotes" ADD COLUMN IF NOT EXISTS "supplier_id" uuid;
ALTER TABLE "application_quotes" ADD COLUMN IF NOT EXISTS "supplier_net_cost_pkr" integer DEFAULT 0 NOT NULL;
ALTER TABLE "application_quotes" ADD COLUMN IF NOT EXISTS "commission_pkr" integer DEFAULT 25000 NOT NULL;
ALTER TABLE "application_quotes" ADD COLUMN IF NOT EXISTS "quotation_pdf_url" text;
ALTER TABLE "application_quotes" ADD COLUMN IF NOT EXISTS "quotation_pdf_generated_at" timestamp with time zone;

DROP TABLE IF EXISTS "outreach_logs" CASCADE;
DROP TABLE IF EXISTS "outreach_contacts" CASCADE;
DROP TABLE IF EXISTS "channel_post_distributions" CASCADE;
DROP TABLE IF EXISTS "daily_post_distributions" CASCADE;
DROP TABLE IF EXISTS "marketing_channels" CASCADE;
DROP TABLE IF EXISTS "marketing_post_assets" CASCADE;
DROP TABLE IF EXISTS "post_assets" CASCADE;
DROP TABLE IF EXISTS "supplier_package_items" CASCADE;
DROP TABLE IF EXISTS "supplier_flyer_packages" CASCADE;
DROP TABLE IF EXISTS "supplier_flyers" CASCADE;
DROP TABLE IF EXISTS "suppliers" CASCADE;

DROP TYPE IF EXISTS "supplier_category" CASCADE;
DROP TYPE IF EXISTS "commission_mode" CASCADE;
DROP TYPE IF EXISTS "flyer_status" CASCADE;
DROP TYPE IF EXISTS "poster_asset_type" CASCADE;
DROP TYPE IF EXISTS "channel_platform" CASCADE;
DROP TYPE IF EXISTS "distribution_dispatch_status" CASCADE;
DROP TYPE IF EXISTS "distribution_stage" CASCADE;
DROP TYPE IF EXISTS "contact_lead_status" CASCADE;

CREATE TYPE "supplier_category" AS ENUM ('group_packages', 'custom_packages', 'both');
CREATE TYPE "commission_mode" AS ENUM ('included_in_flyer', 'net_plus_markup');
CREATE TYPE "flyer_status" AS ENUM ('extracted', 'wrapped', 'draft_extracted', 'verified', 'posters_generated', 'archived');
CREATE TYPE "poster_asset_type" AS ENUM ('multi_package_sheet', 'single_package_spotlight', 'custom_quotation_pdf');
CREATE TYPE "channel_platform" AS ENUM ('whatsapp_group', 'whatsapp_community', 'whatsapp_status', 'instagram', 'facebook', 'tiktok', 'youtube');
CREATE TYPE "distribution_dispatch_status" AS ENUM ('planned', 'queued', 'queued_auto', 'sent', 'posted', 'manual_logged', 'failed');
CREATE TYPE "distribution_stage" AS ENUM ('step_1_spotlight_hook', 'step_2_all_packages', 'standalone');
CREATE TYPE "contact_lead_status" AS ENUM ('prospect', 'interested', 'active_conversation', 'contacted_cooldown', 'replied_active', 'quoted', 'booked_client', 'do_not_contact');

CREATE TABLE "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" varchar(64) NOT NULL UNIQUE,
  "code_prefix" varchar(12) NOT NULL,
  "category" "supplier_category" DEFAULT 'group_packages' NOT NULL,
  "default_commission_mode" "commission_mode" DEFAULT 'included_in_flyer' NOT NULL,
  "default_commission_pkr" integer DEFAULT 22000 NOT NULL,
  "contact_person" text,
  "whatsapp_number" varchar(32),
  "phone" varchar(32),
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "supplier_flyers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "flyer_code" varchar(32),
  "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "raw_flyer_image_url" text NOT NULL,
  "airline_name" text NOT NULL,
  "airline_iata_code" varchar(8),
  "airline_logo_url" text,
  "duration_days" integer DEFAULT 15 NOT NULL,
  "days_title" text DEFAULT '15 DAYS' NOT NULL,
  "route_pill" text DEFAULT 'LHE - JED | JED - LHE' NOT NULL,
  "departure_city_code" varchar(8) DEFAULT 'LHE' NOT NULL,
  "arrival_airport_code" varchar(8) DEFAULT 'JED' NOT NULL,
  "return_airport_code" varchar(8) DEFAULT 'JED' NOT NULL,
  "outbound_baggage" text,
  "inbound_baggage" text,
  "gifted_inclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "commission_mode" "commission_mode" DEFAULT 'included_in_flyer' NOT NULL,
  "commission_pkr" integer DEFAULT 22000 NOT NULL,
  "multi_sheet_image_url" text,
  "multi_sheet_pdf_url" text,
  "extracted_cards_count" integer DEFAULT 0 NOT NULL,
  "status" "flyer_status" DEFAULT 'extracted' NOT NULL,
  "received_date" date NOT NULL,
  "notes" text,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "supplier_flyer_packages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "flyer_id" uuid NOT NULL REFERENCES "supplier_flyers"("id") ON DELETE CASCADE,
  "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
  "card_number" varchar(8) NOT NULL,
  "post_code" varchar(64) NOT NULL UNIQUE,
  "sheet_index" integer DEFAULT 1 NOT NULL,
  "outbound_flight_no" text NOT NULL,
  "outbound_date_label" text NOT NULL,
  "outbound_route" text NOT NULL,
  "outbound_dep_time" text NOT NULL,
  "outbound_arr_time" text NOT NULL,
  "return_flight_no" text NOT NULL,
  "return_date_label" text NOT NULL,
  "return_route" text NOT NULL,
  "return_dep_time" text NOT NULL,
  "return_arr_time" text NOT NULL,
  "makkah_nights" varchar(8) NOT NULL,
  "makkah_hotel_name" text NOT NULL,
  "makkah_distance_label" text NOT NULL,
  "madinah_nights" varchar(8) NOT NULL,
  "madinah_hotel_name" text NOT NULL,
  "madinah_distance_label" text NOT NULL,
  "meal_plan_label" text DEFAULT 'Room Only',
  "raw_sharing_pkr" integer NOT NULL,
  "raw_quad_pkr" integer NOT NULL,
  "raw_triple_pkr" integer NOT NULL,
  "raw_double_pkr" integer NOT NULL,
  "net_sharing_pkr" integer NOT NULL,
  "net_quad_pkr" integer NOT NULL,
  "net_triple_pkr" integer NOT NULL,
  "net_double_pkr" integer NOT NULL,
  "commission_pkr" integer DEFAULT 22000 NOT NULL,
  "retail_sharing_pkr" integer NOT NULL,
  "retail_quad_pkr" integer NOT NULL,
  "retail_triple_pkr" integer NOT NULL,
  "retail_double_pkr" integer NOT NULL,
  "spotlight_poster_url" text,
  "spotlight_pdf_url" text,
  "published_group_package_id" uuid REFERENCES "group_packages"("id") ON DELETE SET NULL,
  "published_group_departure_id" uuid REFERENCES "group_departures"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "post_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_code" varchar(64) NOT NULL UNIQUE,
  "kind" "poster_asset_type" NOT NULL,
  "title" text NOT NULL,
  "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
  "flyer_id" uuid NOT NULL REFERENCES "supplier_flyers"("id") ON DELETE CASCADE,
  "flyer_package_id" uuid REFERENCES "supplier_flyer_packages"("id") ON DELETE CASCADE,
  "image_url" text NOT NULL,
  "pdf_url" text,
  "caption_whatsapp" text,
  "caption_instagram" text,
  "searchable_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "marketing_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "platform" "channel_platform" NOT NULL,
  "area_tag" text DEFAULT 'Lahore' NOT NULL,
  "sender_whatsapp_number" varchar(32),
  "external_group_id_or_handle" text,
  "invite_link_or_url" text,
  "member_count" integer,
  "daily_target_posts" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "last_posted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "daily_post_distributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scheduled_date" date NOT NULL,
  "channel_id" uuid NOT NULL REFERENCES "marketing_channels"("id") ON DELETE CASCADE,
  "post_asset_id" uuid NOT NULL REFERENCES "post_assets"("id") ON DELETE CASCADE,
  "paired_follow_up_asset_id" uuid REFERENCES "post_assets"("id") ON DELETE SET NULL,
  "stage" "distribution_stage" DEFAULT 'step_1_spotlight_hook' NOT NULL,
  "status" "distribution_dispatch_status" DEFAULT 'sent' NOT NULL,
  "sender_whatsapp_line" varchar(32),
  "caption_used" text,
  "external_queue_job_id" text,
  "posted_at" timestamp with time zone,
  "inquiries_generated_count" integer DEFAULT 0 NOT NULL,
  "posted_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "outreach_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text NOT NULL,
  "whatsapp_number" varchar(32) NOT NULL UNIQUE,
  "secondary_phone" varchar(32),
  "city" text DEFAULT 'Lahore' NOT NULL,
  "area_community" text DEFAULT 'Askari 10',
  "source_group_or_channel" text,
  "assigned_whatsapp_line" varchar(32) DEFAULT '03274029701' NOT NULL,
  "interest_status" varchar(32) DEFAULT 'prospect' NOT NULL,
  "last_outreach_at" timestamp with time zone,
  "cooldown_until" timestamp with time zone,
  "last_inbound_reply_at" timestamp with time zone,
  "total_outreach_count" integer DEFAULT 0 NOT NULL,
  "packages_shared_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "outreach_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contact_id" uuid NOT NULL REFERENCES "outreach_contacts"("id") ON DELETE CASCADE,
  "post_asset_id" uuid REFERENCES "post_assets"("id") ON DELETE SET NULL,
  "flyer_id" uuid REFERENCES "supplier_flyers"("id") ON DELETE SET NULL,
  "application_id" uuid REFERENCES "applications"("id") ON DELETE SET NULL,
  "direction" varchar(16) DEFAULT 'outbound' NOT NULL,
  "sender_whatsapp_line" varchar(32) NOT NULL,
  "message_text" text NOT NULL,
  "delivery_status" varchar(32) DEFAULT 'sent' NOT NULL,
  "cooldown_locked_until" timestamp with time zone,
  "sent_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
