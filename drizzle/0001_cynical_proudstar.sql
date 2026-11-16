CREATE TYPE "public"."meal_plan_type" AS ENUM('room_only', 'breakfast', 'half_board', 'full_board');--> statement-breakpoint
CREATE TYPE "public"."channel_platform" AS ENUM('whatsapp_group', 'whatsapp_community', 'whatsapp_status', 'instagram', 'facebook', 'tiktok', 'youtube', 'google_business');--> statement-breakpoint
CREATE TYPE "public"."commission_mode" AS ENUM('included_in_flyer', 'net_plus_markup');--> statement-breakpoint
CREATE TYPE "public"."contact_lead_status" AS ENUM('prospect', 'interested', 'active_conversation', 'contacted_cooldown', 'replied_active', 'quoted', 'booked_client', 'do_not_contact');--> statement-breakpoint
CREATE TYPE "public"."distribution_dispatch_status" AS ENUM('planned', 'queued', 'queued_auto', 'sent', 'posted', 'manual_logged', 'failed');--> statement-breakpoint
CREATE TYPE "public"."distribution_stage" AS ENUM('step_1_spotlight_hook', 'step_2_all_packages', 'standalone');--> statement-breakpoint
CREATE TYPE "public"."flyer_status" AS ENUM('extracted', 'wrapped', 'draft_extracted', 'verified', 'posters_generated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."poster_asset_type" AS ENUM('multi_package_sheet', 'single_package_spotlight', 'custom_quotation_pdf');--> statement-breakpoint
CREATE TYPE "public"."supplier_category" AS ENUM('group_packages', 'custom_packages', 'both');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_auto_reply_match_type" AS ENUM('CONTAINS', 'EXACT', 'STARTS_WITH', 'REGEX');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_broadcast_status" AS ENUM('draft', 'scheduled', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_status" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_type" AS ENUM('text', 'image', 'document', 'audio', 'video', 'template', 'interactive', 'sticker', 'reaction', 'TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'TEMPLATE', 'INTERACTIVE', 'STICKER', 'REACTION');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_template_category" AS ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_template_status" AS ENUM('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED');--> statement-breakpoint
CREATE TYPE "public"."scheduled_post_campaign_stage" AS ENUM('step_1_spotlight_hook', 'step_2_all_packages', 'standalone');--> statement-breakpoint
CREATE TYPE "public"."scheduled_post_status" AS ENUM('draft', 'scheduled', 'publishing', 'completed', 'partially_failed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."scheduled_post_target_status" AS ENUM('pending', 'publishing', 'published', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."scheduled_post_type" AS ENUM('single_image', 'carousel', 'video', 'story', 'offer');--> statement-breakpoint
CREATE TYPE "public"."social_integration_status" AS ENUM('ACTIVE', 'EXPIRED', 'PENDING_SELECTION');--> statement-breakpoint
CREATE TYPE "public"."social_post_format" AS ENUM('FEED', 'REEL', 'STORY');--> statement-breakpoint
CREATE TYPE "public"."social_provider" AS ENUM('instagram', 'facebook', 'tiktok', 'youtube', 'gmb');--> statement-breakpoint
CREATE TABLE "daily_post_distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_date" date NOT NULL,
	"channel_id" uuid NOT NULL,
	"post_asset_id" uuid NOT NULL,
	"paired_follow_up_asset_id" uuid,
	"stage" "distribution_stage" DEFAULT 'step_1_spotlight_hook' NOT NULL,
	"status" "distribution_dispatch_status" DEFAULT 'sent' NOT NULL,
	"sender_whatsapp_line" varchar(32),
	"caption_used" text,
	"external_queue_job_id" text,
	"posted_at" timestamp with time zone,
	"inquiries_generated_count" integer DEFAULT 0 NOT NULL,
	"posted_by_user_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "outreach_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"whatsapp_number" varchar(32) NOT NULL,
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_contacts_whatsapp_number_unique" UNIQUE("whatsapp_number")
);
--> statement-breakpoint
CREATE TABLE "outreach_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"post_asset_id" uuid,
	"flyer_id" uuid,
	"application_id" uuid,
	"direction" varchar(16) DEFAULT 'outbound' NOT NULL,
	"sender_whatsapp_line" varchar(32) NOT NULL,
	"message_text" text NOT NULL,
	"delivery_status" varchar(32) DEFAULT 'sent' NOT NULL,
	"cooldown_locked_until" timestamp with time zone,
	"sent_by_user_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_code" varchar(64) NOT NULL,
	"kind" "poster_asset_type" NOT NULL,
	"title" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"flyer_id" uuid NOT NULL,
	"flyer_package_id" uuid,
	"image_url" text NOT NULL,
	"pdf_url" text,
	"caption_whatsapp" text,
	"caption_instagram" text,
	"searchable_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_assets_post_code_unique" UNIQUE("post_code")
);
--> statement-breakpoint
CREATE TABLE "supplier_flyer_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flyer_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"card_number" varchar(8) NOT NULL,
	"post_code" varchar(64) NOT NULL,
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
	"published_group_package_id" uuid,
	"published_group_departure_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_flyer_packages_post_code_unique" UNIQUE("post_code")
);
--> statement-breakpoint
CREATE TABLE "supplier_flyers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flyer_code" varchar(32),
	"supplier_id" uuid NOT NULL,
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
	"social_ready_sheet_jpeg_url" text,
	"ingestion_source" varchar(32) DEFAULT 'raw_supplier_flyer' NOT NULL,
	"extraction_status" varchar(32) DEFAULT 'completed' NOT NULL,
	"extracted_cards_count" integer DEFAULT 0 NOT NULL,
	"status" "flyer_status" DEFAULT 'extracted' NOT NULL,
	"received_date" date NOT NULL,
	"notes" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(64) NOT NULL,
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT 'Al Ramlah Primary' NOT NULL,
	"phone_number_id" varchar(64) NOT NULL,
	"waba_id" varchar(64) NOT NULL,
	"display_phone_number" varchar(32) NOT NULL,
	"verified_name" text,
	"quality_rating" varchar(32) DEFAULT 'GREEN',
	"messaging_limit" varchar(64),
	"encrypted_access_token" text NOT NULL,
	"webhook_verify_token" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"auto_reply_enabled" boolean DEFAULT true NOT NULL,
	"auto_reply_cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"welcome_greeting_enabled" boolean DEFAULT true NOT NULL,
	"welcome_greeting_text" text,
	"away_greeting_enabled" boolean DEFAULT true NOT NULL,
	"away_greeting_text" text,
	"business_hours_start" text DEFAULT '09:00' NOT NULL,
	"business_hours_end" text DEFAULT '21:00' NOT NULL,
	"account_role" varchar(32) DEFAULT 'COEXISTENCE_FOUNDER' NOT NULL,
	"is_on_biz_app" boolean DEFAULT true NOT NULL,
	"platform_type" varchar(32) DEFAULT 'CLOUD_API',
	"intent_filter_enabled" boolean DEFAULT true NOT NULL,
	"embedded_signup_config_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_accounts_phone_number_id_unique" UNIQUE("phone_number_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_auto_reply_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"name" text NOT NULL,
	"match_type" "whatsapp_auto_reply_match_type" DEFAULT 'CONTAINS' NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"response_text" text NOT NULL,
	"media_url" text,
	"media_filename" text,
	"interactive_buttons" jsonb DEFAULT '[]'::jsonb,
	"priority" integer DEFAULT 100 NOT NULL,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_broadcast_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcast_id" uuid NOT NULL,
	"contact_phone" varchar(32) NOT NULL,
	"outreach_contact_id" uuid,
	"status" "whatsapp_message_status" DEFAULT 'pending' NOT NULL,
	"wamid" varchar(128),
	"template_params" jsonb DEFAULT '{}'::jsonb,
	"error_code" varchar(32),
	"error_message" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "whatsapp_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"template_id" uuid NOT NULL,
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
	"created_by_user_id" text,
	"header_media_url" text,
	"default_template_params" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"contact_phone" varchar(32) NOT NULL,
	"contact_name" text,
	"outreach_contact_id" uuid,
	"application_id" uuid,
	"detected_post_code" varchar(64),
	"last_auto_replied_post_code" varchar(64),
	"last_auto_replied_at" timestamp with time zone,
	"last_customer_message_at" timestamp with time zone,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"assigned_user_id" text,
	"internal_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"intake_flow_state" jsonb DEFAULT '{"step":"IDLE"}'::jsonb NOT NULL,
	"intent_category" varchar(32) DEFAULT 'TRAVEL_LEAD' NOT NULL,
	"intent_confidence" integer DEFAULT 100 NOT NULL,
	"intent_reason" text,
	"forwarded_to_agent_conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"wamid" varchar(128) NOT NULL,
	"direction" "whatsapp_message_direction" NOT NULL,
	"status" "whatsapp_message_status" DEFAULT 'sent' NOT NULL,
	"message_type" "whatsapp_message_type" NOT NULL,
	"body" text,
	"raw_media_id" varchar(128),
	"media_url" text,
	"media_type" varchar(64),
	"media_mime_type" text,
	"media_sha256" text,
	"media_file_size" integer,
	"media_filename" text,
	"template_name" varchar(128),
	"context_message_id" varchar(128),
	"interactive_payload" jsonb,
	"reaction_emoji" text,
	"reacted_to_waba_message_id" text,
	"is_auto_reply" boolean DEFAULT false NOT NULL,
	"raw_payload" jsonb,
	"error_code" varchar(32),
	"error_message" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_messages_wamid_unique" UNIQUE("wamid")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_quick_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"shortcut" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"category" varchar(32) DEFAULT 'general' NOT NULL,
	"body_text" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"meta_template_id" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"language" varchar(16) DEFAULT 'en_US' NOT NULL,
	"category" "whatsapp_template_category" NOT NULL,
	"status" "whatsapp_template_status" NOT NULL,
	"rejection_reason" text,
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
--> statement-breakpoint
CREATE TABLE "scheduled_post_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_post_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"status" "scheduled_post_target_status" DEFAULT 'pending' NOT NULL,
	"published_url" text,
	"external_post_id" text,
	"first_comment_external_id" text,
	"first_comment_posted_at" timestamp with time zone,
	"analytics_data" jsonb DEFAULT 'null'::jsonb,
	"idempotency_key" varchar(128) NOT NULL,
	"error_message" text,
	"published_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_asset_id" uuid,
	"caption" text NOT NULL,
	"post_type" "scheduled_post_type" DEFAULT 'single_image' NOT NULL,
	"post_format" "social_post_format" DEFAULT 'FEED' NOT NULL,
	"first_comment" text,
	"platform_captions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"engagement_plug_config" jsonb DEFAULT 'null'::jsonb,
	"media_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"social_jpeg_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"campaign_stage" "scheduled_post_campaign_stage" DEFAULT 'standalone' NOT NULL,
	"paired_follow_up_post_id" uuid,
	"two_step_delay_minutes" integer DEFAULT 180 NOT NULL,
	"status" "scheduled_post_status" DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"trigger_run_id" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_integrations" (
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
	"status" "social_integration_status" DEFAULT 'ACTIVE' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_settings" ALTER COLUMN "tagline" SET DEFAULT 'Where Purpose Meets Excellence';--> statement-breakpoint
ALTER TABLE "agency_settings" ALTER COLUMN "primary_whatsapp" SET DEFAULT '03274029701';--> statement-breakpoint
ALTER TABLE "agency_settings" ALTER COLUMN "secondary_phone" SET DEFAULT '03190462638';--> statement-breakpoint
ALTER TABLE "agency_settings" ALTER COLUMN "support_email" SET DEFAULT 'alramlahtravels@gmail.com';--> statement-breakpoint
ALTER TABLE "agency_settings" ALTER COLUMN "office_address" SET DEFAULT 'House no 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt';--> statement-breakpoint
ALTER TABLE "agency_settings" ALTER COLUMN "maps_embed_url" SET DEFAULT 'https://maps.google.com/?q=Sector+C+Askari+10+Airport+Road+Lahore+Cantt';--> statement-breakpoint
ALTER TABLE "agency_settings" ALTER COLUMN "working_hours" SET DEFAULT 'Monday to Saturday: 9:00 AM to 8:00 PM PKT';--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "offers_dining" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "available_meal_plans" jsonb DEFAULT '["room_only","breakfast","half_board","full_board"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "breakfast_price_sar_per_pax" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "lunch_price_sar_per_pax" integer DEFAULT 35 NOT NULL;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "dinner_price_sar_per_pax" integer DEFAULT 35 NOT NULL;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "full_board_price_sar_per_pax" integer DEFAULT 85 NOT NULL;--> statement-breakpoint
ALTER TABLE "application_hotel_stays" ADD COLUMN "meal_plan" "meal_plan_type" DEFAULT 'room_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "application_hotel_stays" ADD COLUMN "include_breakfast" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "application_hotel_stays" ADD COLUMN "include_lunch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "application_hotel_stays" ADD COLUMN "include_dinner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "application_quotes" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "application_quotes" ADD COLUMN "supplier_net_cost_pkr" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "application_quotes" ADD COLUMN "commission_pkr" integer DEFAULT 25000 NOT NULL;--> statement-breakpoint
ALTER TABLE "application_quotes" ADD COLUMN "quotation_pdf_url" text;--> statement-breakpoint
ALTER TABLE "application_quotes" ADD COLUMN "quotation_pdf_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "source_post_code" varchar(64);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "source_channel_id" uuid;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_post_distributions" ADD CONSTRAINT "daily_post_distributions_channel_id_marketing_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_post_distributions" ADD CONSTRAINT "daily_post_distributions_post_asset_id_post_assets_id_fk" FOREIGN KEY ("post_asset_id") REFERENCES "public"."post_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_post_distributions" ADD CONSTRAINT "daily_post_distributions_paired_follow_up_asset_id_post_assets_id_fk" FOREIGN KEY ("paired_follow_up_asset_id") REFERENCES "public"."post_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_post_distributions" ADD CONSTRAINT "daily_post_distributions_posted_by_user_id_user_id_fk" FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_logs" ADD CONSTRAINT "outreach_logs_contact_id_outreach_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."outreach_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_logs" ADD CONSTRAINT "outreach_logs_post_asset_id_post_assets_id_fk" FOREIGN KEY ("post_asset_id") REFERENCES "public"."post_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_logs" ADD CONSTRAINT "outreach_logs_flyer_id_supplier_flyers_id_fk" FOREIGN KEY ("flyer_id") REFERENCES "public"."supplier_flyers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_logs" ADD CONSTRAINT "outreach_logs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_logs" ADD CONSTRAINT "outreach_logs_sent_by_user_id_user_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_assets" ADD CONSTRAINT "post_assets_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_assets" ADD CONSTRAINT "post_assets_flyer_id_supplier_flyers_id_fk" FOREIGN KEY ("flyer_id") REFERENCES "public"."supplier_flyers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_assets" ADD CONSTRAINT "post_assets_flyer_package_id_supplier_flyer_packages_id_fk" FOREIGN KEY ("flyer_package_id") REFERENCES "public"."supplier_flyer_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ADD CONSTRAINT "supplier_flyer_packages_flyer_id_supplier_flyers_id_fk" FOREIGN KEY ("flyer_id") REFERENCES "public"."supplier_flyers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ADD CONSTRAINT "supplier_flyer_packages_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ADD CONSTRAINT "supplier_flyer_packages_published_group_package_id_group_packages_id_fk" FOREIGN KEY ("published_group_package_id") REFERENCES "public"."group_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ADD CONSTRAINT "supplier_flyer_packages_published_group_departure_id_group_departures_id_fk" FOREIGN KEY ("published_group_departure_id") REFERENCES "public"."group_departures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_flyers" ADD CONSTRAINT "supplier_flyers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_flyers" ADD CONSTRAINT "supplier_flyers_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_auto_reply_rules" ADD CONSTRAINT "whatsapp_auto_reply_rules_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_broadcast_recipients" ADD CONSTRAINT "whatsapp_broadcast_recipients_broadcast_id_whatsapp_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."whatsapp_broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_broadcast_recipients" ADD CONSTRAINT "whatsapp_broadcast_recipients_outreach_contact_id_outreach_contacts_id_fk" FOREIGN KEY ("outreach_contact_id") REFERENCES "public"."outreach_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_broadcasts" ADD CONSTRAINT "whatsapp_broadcasts_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_broadcasts" ADD CONSTRAINT "whatsapp_broadcasts_template_id_whatsapp_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_broadcasts" ADD CONSTRAINT "whatsapp_broadcasts_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_outreach_contact_id_outreach_contacts_id_fk" FOREIGN KEY ("outreach_contact_id") REFERENCES "public"."outreach_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_quick_replies" ADD CONSTRAINT "whatsapp_quick_replies_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_post_targets" ADD CONSTRAINT "scheduled_post_targets_scheduled_post_id_scheduled_posts_id_fk" FOREIGN KEY ("scheduled_post_id") REFERENCES "public"."scheduled_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_post_targets" ADD CONSTRAINT "scheduled_post_targets_integration_id_social_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."social_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_post_asset_id_post_assets_id_fk" FOREIGN KEY ("post_asset_id") REFERENCES "public"."post_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_integrations" ADD CONSTRAINT "social_integrations_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dist_date" ON "daily_post_distributions" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_dist_channel" ON "daily_post_distributions" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_dist_asset" ON "daily_post_distributions" USING btree ("post_asset_id");--> statement-breakpoint
CREATE INDEX "idx_channel_platform" ON "marketing_channels" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_channel_area" ON "marketing_channels" USING btree ("area_tag");--> statement-breakpoint
CREATE INDEX "idx_channel_active" ON "marketing_channels" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_outreach_wa_number" ON "outreach_contacts" USING btree ("whatsapp_number");--> statement-breakpoint
CREATE INDEX "idx_outreach_status" ON "outreach_contacts" USING btree ("interest_status");--> statement-breakpoint
CREATE INDEX "idx_outreach_cooldown" ON "outreach_contacts" USING btree ("cooldown_until");--> statement-breakpoint
CREATE INDEX "idx_outreach_log_contact" ON "outreach_logs" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_log_sent_at" ON "outreach_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_post_asset_code" ON "post_assets" USING btree ("post_code");--> statement-breakpoint
CREATE INDEX "idx_post_asset_flyer" ON "post_assets" USING btree ("flyer_id");--> statement-breakpoint
CREATE INDEX "idx_post_asset_kind" ON "post_assets" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pkg_item_post_code" ON "supplier_flyer_packages" USING btree ("post_code");--> statement-breakpoint
CREATE INDEX "idx_pkg_item_flyer" ON "supplier_flyer_packages" USING btree ("flyer_id");--> statement-breakpoint
CREATE INDEX "idx_pkg_item_supplier" ON "supplier_flyer_packages" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_pkg_item_sharing_price" ON "supplier_flyer_packages" USING btree ("retail_sharing_pkr");--> statement-breakpoint
CREATE INDEX "idx_flyer_supplier" ON "supplier_flyers" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_flyer_status" ON "supplier_flyers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_supplier_slug" ON "suppliers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_supplier_active" ON "suppliers" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wa_acc_phone_id" ON "whatsapp_accounts" USING btree ("phone_number_id");--> statement-breakpoint
CREATE INDEX "idx_wa_acc_active" ON "whatsapp_accounts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_wa_arr_active_prio" ON "whatsapp_auto_reply_rules" USING btree ("is_active","priority");--> statement-breakpoint
CREATE INDEX "idx_wa_bc_recip_broadcast" ON "whatsapp_broadcast_recipients" USING btree ("broadcast_id","status");--> statement-breakpoint
CREATE INDEX "idx_wa_bc_recip_wamid" ON "whatsapp_broadcast_recipients" USING btree ("wamid");--> statement-breakpoint
CREATE INDEX "idx_wa_bc_recip_phone" ON "whatsapp_broadcast_recipients" USING btree ("contact_phone");--> statement-breakpoint
CREATE INDEX "idx_wa_bc_acc_status" ON "whatsapp_broadcasts" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "idx_wa_bc_scheduled" ON "whatsapp_broadcasts" USING btree ("scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wa_conv_acc_phone" ON "whatsapp_conversations" USING btree ("account_id","contact_phone");--> statement-breakpoint
CREATE INDEX "idx_wa_conv_last_msg" ON "whatsapp_conversations" USING btree ("account_id","last_message_at");--> statement-breakpoint
CREATE INDEX "idx_wa_conv_outreach" ON "whatsapp_conversations" USING btree ("outreach_contact_id");--> statement-breakpoint
CREATE INDEX "idx_wa_conv_app" ON "whatsapp_conversations" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_wa_conv_detected_code" ON "whatsapp_conversations" USING btree ("detected_post_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wa_msg_wamid" ON "whatsapp_messages" USING btree ("wamid");--> statement-breakpoint
CREATE INDEX "idx_wa_msg_conv_created" ON "whatsapp_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_wa_msg_status" ON "whatsapp_messages" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wa_qr_shortcut" ON "whatsapp_quick_replies" USING btree ("account_id","shortcut");--> statement-breakpoint
CREATE INDEX "idx_wa_qr_active" ON "whatsapp_quick_replies" USING btree ("account_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wa_tmpl_acc_name_lang" ON "whatsapp_templates" USING btree ("account_id","name","language");--> statement-breakpoint
CREATE INDEX "idx_wa_tmpl_status" ON "whatsapp_templates" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scheduled_post_targets_idempotency" ON "scheduled_post_targets" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_scheduled_post_targets_post_integration" ON "scheduled_post_targets" USING btree ("scheduled_post_id","integration_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_post_targets_status" ON "scheduled_post_targets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scheduled_posts_scheduled_for" ON "scheduled_posts" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_scheduled_posts_status" ON "scheduled_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scheduled_posts_post_asset" ON "scheduled_posts" USING btree ("post_asset_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_posts_trigger_run" ON "scheduled_posts" USING btree ("trigger_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_social_integrations_provider_acc" ON "social_integrations" USING btree ("provider","internal_account_id");--> statement-breakpoint
CREATE INDEX "idx_social_integrations_provider" ON "social_integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_social_integrations_active" ON "social_integrations" USING btree ("is_active");