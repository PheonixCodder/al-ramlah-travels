CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'cash_lahore_hq', 'cheque_pay_order', 'online_gateway', 'other');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_linked_device_status" AS ENUM('disconnected', 'connecting', 'qr_ready', 'pairing_code_ready', 'connected');--> statement-breakpoint
ALTER TYPE "public"."application_status" ADD VALUE 'revision_requested' BEFORE 'approved';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'deposit_paid' BEFORE 'partially_paid';--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"actor_role" varchar(32),
	"action" varchar(128) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" text,
	"before_json" jsonb,
	"after_json" jsonb,
	"ip_hash" varchar(64),
	"request_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hajj_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(96) NOT NULL,
	"title" text NOT NULL,
	"season_year" integer DEFAULT 2027 NOT NULL,
	"maktab_tier" varchar(32) DEFAULT 'A' NOT NULL,
	"duration_days" integer DEFAULT 21 NOT NULL,
	"makkah_hotel_name" text NOT NULL,
	"makkah_distance_label" text NOT NULL,
	"madinah_hotel_name" text NOT NULL,
	"madinah_distance_label" text NOT NULL,
	"aziziyah_stay_notes" text,
	"indicative_sharing_pkr" bigint NOT NULL,
	"indicative_quad_pkr" bigint,
	"indicative_triple_pkr" bigint,
	"indicative_double_pkr" bigint,
	"is_indicative" boolean DEFAULT true NOT NULL,
	"regulatory_disclaimer" text DEFAULT 'Indicative 2027 package structure — final Maktab tariff & quota subject to Saudi Ministry of Hajj & Umrah and Pakistan MORA announcement.' NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hajj_packages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "chk_hajj_packages_positive_prices" CHECK ("hajj_packages"."duration_days" >= 1 AND "hajj_packages"."indicative_sharing_pkr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "application_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"amount_pkr" bigint NOT NULL,
	"payment_method" "payment_method" DEFAULT 'bank_transfer' NOT NULL,
	"bank_reference" varchar(128),
	"receipt_r2_key" text,
	"notes" text,
	"recorded_by_id" text,
	"verified_by_id" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_application_payments_positive_amount" CHECK ("application_payments"."amount_pkr" > 0)
);
--> statement-breakpoint
CREATE TABLE "whatsapp_linked_device_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_key" varchar(64) DEFAULT 'default' NOT NULL,
	"label" text DEFAULT 'Primary Business WhatsApp' NOT NULL,
	"phone_number" varchar(32),
	"push_name" text,
	"status" "whatsapp_linked_device_status" DEFAULT 'disconnected' NOT NULL,
	"qr_data_url" text,
	"pairing_code" varchar(16),
	"encrypted_auth_creds" text,
	"encrypted_auth_keys" text,
	"groups_synced_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_connected_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_linked_device_sessions_session_key_unique" UNIQUE("session_key")
);
--> statement-breakpoint
ALTER TABLE "agency_settings" DROP CONSTRAINT "agency_settings_updated_by_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "transport_rates" DROP CONSTRAINT "transport_rates_sector_id_transport_sectors_id_fk";
--> statement-breakpoint
ALTER TABLE "transport_rates" DROP CONSTRAINT "transport_rates_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "visa_rates" DROP CONSTRAINT "visa_rates_updated_by_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "group_departures" DROP CONSTRAINT "group_departures_package_id_group_packages_id_fk";
--> statement-breakpoint
ALTER TABLE "whatsapp_broadcasts" DROP CONSTRAINT "whatsapp_broadcasts_account_id_whatsapp_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" DROP CONSTRAINT "whatsapp_conversations_account_id_whatsapp_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "scheduled_post_targets" DROP CONSTRAINT "scheduled_post_targets_integration_id_social_integrations_id_fk";
--> statement-breakpoint
DROP INDEX "idx_session_token";--> statement-breakpoint
DROP INDEX "idx_user_email";--> statement-breakpoint
DROP INDEX "idx_transport_rate_sector";--> statement-breakpoint
DROP INDEX "idx_sector_code";--> statement-breakpoint
DROP INDEX "idx_quote_app_id";--> statement-breakpoint
DROP INDEX "idx_app_ref_number";--> statement-breakpoint
DROP INDEX "idx_app_status";--> statement-breakpoint
DROP INDEX "idx_outreach_wa_number";--> statement-breakpoint
DROP INDEX "idx_post_asset_code";--> statement-breakpoint
DROP INDEX "idx_pkg_item_post_code";--> statement-breakpoint
DROP INDEX "idx_supplier_slug";--> statement-breakpoint
DROP INDEX "idx_wa_acc_phone_id";--> statement-breakpoint
DROP INDEX "idx_wa_msg_wamid";--> statement-breakpoint
DROP INDEX "idx_social_integrations_provider";--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agency_settings" ALTER COLUMN "office_address" SET DEFAULT 'Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan';--> statement-breakpoint
ALTER TABLE "agency_settings" ALTER COLUMN "sar_to_pkr_rate" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "agency_settings" ALTER COLUMN "sar_to_pkr_rate" SET DEFAULT 75;--> statement-breakpoint
ALTER TABLE "group_departures" ALTER COLUMN "quad_price_override_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "group_departures" ALTER COLUMN "triple_price_override_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "group_departures" ALTER COLUMN "double_price_override_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "group_departures" ALTER COLUMN "sharing_price_override_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "group_packages" ALTER COLUMN "quad_price_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "group_packages" ALTER COLUMN "triple_price_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "group_packages" ALTER COLUMN "double_price_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "group_packages" ALTER COLUMN "sharing_price_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "group_packages" ALTER COLUMN "sharing_price_pkr" SET DEFAULT 258299;--> statement-breakpoint
ALTER TABLE "group_packages" ALTER COLUMN "infant_price_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "group_packages" ALTER COLUMN "infant_price_pkr" SET DEFAULT 65000;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "visa_total_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "flights_total_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "makkah_hotel_total_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "madinah_hotel_total_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "transport_total_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "ziyarat_total_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "discount_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "grand_total_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "supplier_net_cost_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "commission_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "commission_pkr" SET DEFAULT 25000;--> statement-breakpoint
ALTER TABLE "application_quotes" ALTER COLUMN "amount_paid_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "locked_visa_rate_per_person_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "calculated_visa_total_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "raw_sharing_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "raw_quad_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "raw_triple_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "raw_double_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "net_sharing_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "net_quad_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "net_triple_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "net_double_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "commission_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "commission_pkr" SET DEFAULT 22000;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "retail_sharing_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "retail_quad_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "retail_triple_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "supplier_flyer_packages" ALTER COLUMN "retail_double_pkr" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "scheduled_post_targets" ALTER COLUMN "analytics_data" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ALTER COLUMN "engagement_plug_config" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agency_settings" ADD COLUMN "legal_entity_name" text DEFAULT 'Al Ramlah Travels' NOT NULL;--> statement-breakpoint
ALTER TABLE "agency_settings" ADD COLUMN "dts_license" varchar(64);--> statement-breakpoint
ALTER TABLE "agency_settings" ADD COLUMN "mora_license" varchar(64);--> statement-breakpoint
ALTER TABLE "agency_settings" ADD COLUMN "iata_code" varchar(32);--> statement-breakpoint
ALTER TABLE "agency_settings" ADD COLUMN "ntn_number" varchar(64);--> statement-breakpoint
ALTER TABLE "agency_settings" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "agency_settings" ADD COLUMN "account_title" text DEFAULT 'Al Ramlah Travels';--> statement-breakpoint
ALTER TABLE "agency_settings" ADD COLUMN "official_iban" varchar(64);--> statement-breakpoint
ALTER TABLE "agency_settings" ADD COLUMN "iban_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "application_quotes" ADD COLUMN "deposit_required_pkr" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "client_submission_id" varchar(64);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "voucher_token" varchar(128);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "revision_notes_customer" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "hajj_inquiry_json" jsonb;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "sla_escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_post_distributions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_channels" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_contacts" ADD COLUMN "opted_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "post_assets" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "payload_redacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "application_payments" ADD CONSTRAINT "application_payments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_payments" ADD CONSTRAINT "application_payments_quote_id_application_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."application_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_payments" ADD CONSTRAINT "application_payments_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_payments" ADD CONSTRAINT "application_payments_verified_by_id_user_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor_created" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action_created" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "idx_rate_limit_buckets_expires_at" ON "rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_hajj_packages_active_sort" ON "hajj_packages" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "idx_payment_app_created" ON "application_payments" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_quote_id" ON "application_payments" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_wa_linked_status" ON "whatsapp_linked_device_sessions" USING btree ("status");--> statement-breakpoint
ALTER TABLE "agency_settings" ADD CONSTRAINT "agency_settings_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_rates" ADD CONSTRAINT "transport_rates_sector_id_transport_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."transport_sectors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_rates" ADD CONSTRAINT "transport_rates_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_rates" ADD CONSTRAINT "visa_rates_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_departures" ADD CONSTRAINT "group_departures_package_id_group_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."group_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_quotes" ADD CONSTRAINT "application_quotes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_source_channel_id_marketing_channels_id_fk" FOREIGN KEY ("source_channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_broadcasts" ADD CONSTRAINT "whatsapp_broadcasts_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "fk_wa_conv_forwarded_to" FOREIGN KEY ("forwarded_to_agent_conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_post_targets" ADD CONSTRAINT "scheduled_post_targets_integration_id_social_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."social_integrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "fk_scheduled_posts_paired_followup" FOREIGN KEY ("paired_follow_up_post_id") REFERENCES "public"."scheduled_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_session_expires_at" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_verification_expires_at" ON "verification" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quote_app_version" ON "application_quotes" USING btree ("application_id","version");--> statement-breakpoint
CREATE INDEX "idx_app_status_created" ON "applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_marketing_channels_external_handle" ON "marketing_channels" USING btree ("external_group_id_or_handle");--> statement-breakpoint
CREATE INDEX "idx_outreach_last_outreach_name" ON "outreach_contacts" USING btree ("last_outreach_at","full_name");--> statement-breakpoint
CREATE INDEX "idx_post_asset_created" ON "post_assets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_pkg_item_created" ON "supplier_flyer_packages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_flyer_created" ON "supplier_flyers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_wa_conv_desk_inbox" ON "whatsapp_conversations" USING btree ("account_id","is_archived","is_pinned","last_message_at");--> statement-breakpoint
CREATE INDEX "idx_wa_msg_created" ON "whatsapp_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_wa_tmpl_meta_id" ON "whatsapp_templates" USING btree ("meta_template_id");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_client_submission_id_unique" UNIQUE("client_submission_id");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_voucher_token_unique" UNIQUE("voucher_token");--> statement-breakpoint
ALTER TABLE "agency_settings" ADD CONSTRAINT "chk_agency_settings_singleton" CHECK ("agency_settings"."id" = 'default');--> statement-breakpoint
ALTER TABLE "agency_settings" ADD CONSTRAINT "chk_agency_settings_positive_forex" CHECK ("agency_settings"."sar_to_pkr_rate" > 0 AND "agency_settings"."sla_overdue_hours" >= 1);--> statement-breakpoint
ALTER TABLE "hotels" ADD CONSTRAINT "chk_hotels_star_rating" CHECK ("hotels"."star_rating" BETWEEN 1 AND 5 AND "hotels"."distance_meters" >= 0);--> statement-breakpoint
ALTER TABLE "transport_rates" ADD CONSTRAINT "chk_transport_rates_non_negative" CHECK ("transport_rates"."rate_sar" >= 0);--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "chk_vehicles_capacity" CHECK ("vehicles"."seat_capacity" >= 1 AND "vehicles"."luggage_capacity" >= 0);--> statement-breakpoint
ALTER TABLE "visa_rates" ADD CONSTRAINT "chk_visa_rates_positive" CHECK ("visa_rates"."max_days" > 0 AND "visa_rates"."price_pkr" >= 0 AND "visa_rates"."price_sar" >= 0);--> statement-breakpoint
ALTER TABLE "group_departures" ADD CONSTRAINT "chk_group_departures_seats_and_dates" CHECK ("group_departures"."total_seats" > 0 AND "group_departures"."booked_seats" >= 0 AND "group_departures"."booked_seats" <= "group_departures"."total_seats" AND "group_departures"."return_date" >= "group_departures"."departure_date");--> statement-breakpoint
ALTER TABLE "group_packages" ADD CONSTRAINT "chk_group_packages_durations_and_prices" CHECK ("group_packages"."duration_days" >= 1 AND "group_packages"."makkah_nights" >= 0 AND "group_packages"."madinah_nights" >= 0 AND "group_packages"."quad_price_pkr" >= 0 AND "group_packages"."triple_price_pkr" >= 0 AND "group_packages"."double_price_pkr" >= 0 AND "group_packages"."sharing_price_pkr" >= 0 AND "group_packages"."infant_price_pkr" >= 0);--> statement-breakpoint
ALTER TABLE "application_hotel_stays" ADD CONSTRAINT "chk_app_hotel_stays_dates_nights" CHECK ("application_hotel_stays"."nights" >= 1 AND "application_hotel_stays"."check_out_date" > "application_hotel_stays"."check_in_date");--> statement-breakpoint
ALTER TABLE "application_quotes" ADD CONSTRAINT "chk_application_quotes_non_negative" CHECK ("application_quotes"."version" >= 1 AND "application_quotes"."visa_total_pkr" >= 0 AND "application_quotes"."flights_total_pkr" >= 0 AND "application_quotes"."makkah_hotel_total_pkr" >= 0 AND "application_quotes"."madinah_hotel_total_pkr" >= 0 AND "application_quotes"."transport_total_pkr" >= 0 AND "application_quotes"."ziyarat_total_pkr" >= 0 AND "application_quotes"."discount_pkr" >= 0 AND "application_quotes"."grand_total_pkr" >= 0 AND "application_quotes"."deposit_required_pkr" >= 0 AND "application_quotes"."amount_paid_pkr" >= 0);--> statement-breakpoint
ALTER TABLE "application_transport_segments" ADD CONSTRAINT "chk_app_transport_segments_qty" CHECK ("application_transport_segments"."vehicle_quantity" >= 1);--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "chk_applications_traveller_invariants" CHECK ("applications"."adults" >= 1 AND "applications"."children" >= 0 AND "applications"."infants" >= 0 AND "applications"."total_passport_count" = ("applications"."adults" + "applications"."children" + "applications"."infants") AND "applications"."bed_and_seat_count" = ("applications"."adults" + "applications"."children") AND ("applications"."ksa_arrival_date" IS NULL OR "applications"."ksa_departure_date" IS NULL OR "applications"."ksa_departure_date" >= "applications"."ksa_arrival_date"));--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "chk_testimonials_rating" CHECK ("testimonials"."rating" BETWEEN 1 AND 5);--> statement-breakpoint
ALTER TABLE "outreach_contacts" ADD CONSTRAINT "chk_outreach_interest_status" CHECK ("outreach_contacts"."interest_status" IN ('prospect', 'interested', 'active_conversation', 'contacted_cooldown', 'replied_active', 'quoted', 'booked_client', 'do_not_contact'));--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "chk_wa_messages_lowercase_type" CHECK ("whatsapp_messages"."message_type"::text = lower("whatsapp_messages"."message_type"::text));--> statement-breakpoint
DROP INDEX IF EXISTS "idx_channel_external_id";--> statement-breakpoint
UPDATE "scheduled_post_targets" SET "analytics_data" = NULL WHERE "analytics_data" = 'null'::jsonb;--> statement-breakpoint
UPDATE "scheduled_posts" SET "engagement_plug_config" = NULL WHERE "engagement_plug_config" = 'null'::jsonb;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."prevent_audit_logs_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows are append-only and immutable (% on id=%)', TG_OP, OLD.id
    USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_audit_logs_immutable" ON "audit_logs";--> statement-breakpoint
CREATE TRIGGER "trg_audit_logs_immutable"
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_audit_logs_mutation"();
