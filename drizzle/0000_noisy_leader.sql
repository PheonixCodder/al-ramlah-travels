CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'staff');--> statement-breakpoint
CREATE TYPE "public"."city_name" AS ENUM('makkah', 'madinah');--> statement-breakpoint
CREATE TYPE "public"."hotel_access_type" AS ENUM('walking', 'shuttle');--> statement-breakpoint
CREATE TYPE "public"."room_category" AS ENUM('shared', 'private');--> statement-breakpoint
CREATE TYPE "public"."room_type" AS ENUM('sharing', 'double', 'triple', 'quad');--> statement-breakpoint
CREATE TYPE "public"."sector_point_type" AS ENUM('airport', 'hotel');--> statement-breakpoint
CREATE TYPE "public"."vehicle_booking_mode" AS ENUM('private_only', 'shared_and_private', 'shared_only');--> statement-breakpoint
CREATE TYPE "public"."vehicle_category" AS ENUM('sedan', 'suv', 'van', 'minibus', 'bus', 'train');--> statement-breakpoint
CREATE TYPE "public"."visa_tier" AS ENUM('short_term', 'long_term');--> statement-breakpoint
CREATE TYPE "public"."group_departure_status" AS ENUM('open', 'filling_fast', 'sold_out', 'closed');--> statement-breakpoint
CREATE TYPE "public"."package_tier" AS ENUM('economy', 'bronze', 'silver', 'gold', 'vip_5star');--> statement-breakpoint
CREATE TYPE "public"."application_source" AS ENUM('custom_builder', 'group_booking', 'hajj_inquiry');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('pending_quote', 'quoted', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."builder_preset_mode" AS ENUM('complete_umrah', 'visa_only', 'flights_only', 'hotels_only', 'transport_only', 'custom_mix', 'group_package', 'hajj_consultation');--> statement-breakpoint
CREATE TYPE "public"."cabin_class" AS ENUM('economy', 'business');--> statement-breakpoint
CREATE TYPE "public"."city_sequence" AS ENUM('makkah_madinah', 'madinah_makkah', 'makkah_madinah_makkah', 'makkah_madinah_jeddah', 'makkah_only', 'madinah_only');--> statement-breakpoint
CREATE TYPE "public"."flight_route_type" AS ENUM('direct', 'connecting');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'partially_paid', 'paid_in_full');--> statement-breakpoint
CREATE TYPE "public"."transport_service_type" AS ENUM('private', 'shared');--> statement-breakpoint
CREATE TYPE "public"."ziyarat_scope" AS ENUM('makkah_only', 'madinah_only', 'both');--> statement-breakpoint
CREATE TYPE "public"."faq_category" AS ENUM('general', 'visa', 'hotels', 'transport', 'packages', 'hajj');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('unread', 'read', 'replied', 'archived');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agency_settings" (
	"id" varchar(32) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"agency_name" text DEFAULT 'Al Ramlah Travels' NOT NULL,
	"tagline" text DEFAULT 'Sacred Journeys Crafted with Dignity & Comfort' NOT NULL,
	"primary_whatsapp" varchar(32) DEFAULT '+923001234567' NOT NULL,
	"secondary_phone" varchar(32),
	"support_email" varchar(255) DEFAULT 'info@alramlahtravels.com' NOT NULL,
	"office_address" text DEFAULT 'Suite 402, Al-Hafeez Heights, Gulberg III, Lahore, Pakistan' NOT NULL,
	"maps_embed_url" text,
	"facebook_url" text,
	"instagram_url" text,
	"youtube_url" text,
	"tiktok_url" text,
	"working_hours" text DEFAULT 'Monday to Saturday, 9:00 AM to 8:00 PM PKT' NOT NULL,
	"sla_overdue_hours" integer DEFAULT 24 NOT NULL,
	"sar_to_pkr_rate" integer DEFAULT 75 NOT NULL,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"iata_code" varchar(3) NOT NULL,
	"logo_url" text,
	"is_direct_available" boolean DEFAULT true NOT NULL,
	"is_connecting_available" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airlines_iata_code_unique" UNIQUE("iata_code")
);
--> statement-breakpoint
CREATE TABLE "departure_cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_name" text NOT NULL,
	"airport_code" varchar(3) NOT NULL,
	"airport_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departure_cities_airport_code_unique" UNIQUE("airport_code")
);
--> statement-breakpoint
CREATE TABLE "hotels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" "city_name" NOT NULL,
	"star_rating" integer NOT NULL,
	"distance_meters" integer NOT NULL,
	"distance_label" text NOT NULL,
	"access_type" "hotel_access_type" NOT NULL,
	"imageUrl" text NOT NULL,
	"gallery_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allows_shared_rooms" boolean DEFAULT true NOT NULL,
	"allows_private_rooms" boolean DEFAULT true NOT NULL,
	"available_room_types" jsonb DEFAULT '["double","triple","quad"]'::jsonb NOT NULL,
	"sharing_price_sar" integer DEFAULT 0 NOT NULL,
	"room_price_sar" integer DEFAULT 0 NOT NULL,
	"quad_price_sar" integer DEFAULT 0 NOT NULL,
	"triple_price_sar" integer DEFAULT 0 NOT NULL,
	"double_price_sar" integer DEFAULT 0 NOT NULL,
	"valid_from" date,
	"valid_until" date,
	"location_notes" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transport_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"rate_sar" integer NOT NULL,
	"rate_pkr_override" integer,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transport_sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"label" text NOT NULL,
	"origin_city" text NOT NULL,
	"destination_city" text NOT NULL,
	"origin_type" "sector_point_type" NOT NULL,
	"destination_type" "sector_point_type" NOT NULL,
	"supports_train" boolean DEFAULT false NOT NULL,
	"shared_bus_rate_sar_per_pax" integer DEFAULT 20 NOT NULL,
	"is_shared_bus_eligible" boolean DEFAULT false NOT NULL,
	"terminal_parking_fee_sar" integer DEFAULT 0 NOT NULL,
	"approx_distance_km" integer,
	"approx_duration_minutes" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_sectors_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" "vehicle_category" NOT NULL,
	"booking_mode" "vehicle_booking_mode" NOT NULL,
	"seat_capacity" integer NOT NULL,
	"luggage_capacity" integer NOT NULL,
	"allows_custom_pickup_time" boolean DEFAULT false NOT NULL,
	"default_rate_sar" integer DEFAULT 250 NOT NULL,
	"ziyarat_rate_sar" integer DEFAULT 200 NOT NULL,
	"imageUrl" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" "visa_tier" NOT NULL,
	"label" text NOT NULL,
	"max_days" integer NOT NULL,
	"price_pkr" integer NOT NULL,
	"price_sar" integer DEFAULT 470 NOT NULL,
	"without_masar_price_sar" integer DEFAULT 470 NOT NULL,
	"with_masar_10_days_sar" integer DEFAULT 500 NOT NULL,
	"with_masar_15_days_sar" integer DEFAULT 515 NOT NULL,
	"with_masar_21_days_sar" integer DEFAULT 530 NOT NULL,
	"with_masar_28_days_sar" integer DEFAULT 545 NOT NULL,
	"notes" text,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visa_rates_tier_unique" UNIQUE("tier")
);
--> statement-breakpoint
CREATE TABLE "ziyarat_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" "city_name" NOT NULL,
	"name" text NOT NULL,
	"arabic_name" text NOT NULL,
	"description" text NOT NULL,
	"imageUrl" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_departures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"batch_code" varchar(32) NOT NULL,
	"departure_city_id" uuid NOT NULL,
	"departure_date" date NOT NULL,
	"return_date" date NOT NULL,
	"total_seats" integer NOT NULL,
	"booked_seats" integer DEFAULT 0 NOT NULL,
	"status" "group_departure_status" DEFAULT 'open' NOT NULL,
	"quad_price_override_pkr" integer,
	"triple_price_override_pkr" integer,
	"double_price_override_pkr" integer,
	"sharing_price_override_pkr" integer,
	"outbound_flight_number" text,
	"return_flight_number" text,
	"flight_schedule_summary" text,
	"routing_note" text,
	"baggage_allowance" text DEFAULT '23-KG Outbound / 46-KG Return',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_departures_batch_code_unique" UNIQUE("batch_code")
);
--> statement-breakpoint
CREATE TABLE "group_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"tier" "package_tier" NOT NULL,
	"duration_days" integer NOT NULL,
	"makkah_nights" integer NOT NULL,
	"madinah_nights" integer NOT NULL,
	"airline_id" uuid,
	"makkah_hotel_id" uuid,
	"madinah_hotel_id" uuid,
	"includes_visa" boolean DEFAULT true NOT NULL,
	"includes_transport" boolean DEFAULT true NOT NULL,
	"includes_ziyarat" boolean DEFAULT true NOT NULL,
	"quad_price_pkr" integer NOT NULL,
	"triple_price_pkr" integer NOT NULL,
	"double_price_pkr" integer NOT NULL,
	"sharing_price_pkr" integer DEFAULT 258299 NOT NULL,
	"infant_price_pkr" integer DEFAULT 65000 NOT NULL,
	"gifted_inclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"multi_hotel_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"banner_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "application_hotel_stays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"stay_order" integer NOT NULL,
	"city" "city_name" NOT NULL,
	"hotel_id" uuid NOT NULL,
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"nights" integer NOT NULL,
	"room_category" "room_category" DEFAULT 'private' NOT NULL,
	"shared_room_type" "room_type",
	"private_room_allocation" jsonb DEFAULT '{"double":0,"triple":0,"quad":0}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"visa_total_pkr" integer DEFAULT 0 NOT NULL,
	"flights_total_pkr" integer DEFAULT 0 NOT NULL,
	"makkah_hotel_total_pkr" integer DEFAULT 0 NOT NULL,
	"madinah_hotel_total_pkr" integer DEFAULT 0 NOT NULL,
	"transport_total_pkr" integer DEFAULT 0 NOT NULL,
	"ziyarat_total_pkr" integer DEFAULT 0 NOT NULL,
	"discount_pkr" integer DEFAULT 0 NOT NULL,
	"grand_total_pkr" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'PKR' NOT NULL,
	"quote_notes_customer" text,
	"internal_notes_admin" text,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"amount_paid_pkr" integer DEFAULT 0 NOT NULL,
	"quoted_by_user_id" text,
	"quoted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_transport_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"segment_order" integer NOT NULL,
	"sector_id" uuid NOT NULL,
	"service_type" "transport_service_type" DEFAULT 'private' NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"vehicle_quantity" integer DEFAULT 1 NOT NULL,
	"scheduled_date" date,
	"pickup_time" varchar(5),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_number" varchar(32) NOT NULL,
	"source" "application_source" NOT NULL,
	"status" "application_status" DEFAULT 'pending_quote' NOT NULL,
	"preset_mode" "builder_preset_mode" NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" varchar(32) NOT NULL,
	"customer_whatsapp" varchar(32) NOT NULL,
	"customer_city" text NOT NULL,
	"customer_email" varchar(255),
	"special_requests" text,
	"adults" integer DEFAULT 1 NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"infants" integer DEFAULT 0 NOT NULL,
	"total_passport_count" integer NOT NULL,
	"bed_and_seat_count" integer NOT NULL,
	"include_visa" boolean DEFAULT true NOT NULL,
	"include_flights" boolean DEFAULT false NOT NULL,
	"include_hotels" boolean DEFAULT false NOT NULL,
	"include_transport" boolean DEFAULT false NOT NULL,
	"include_ziyarat" boolean DEFAULT false NOT NULL,
	"ksa_arrival_date" date,
	"ksa_departure_date" date,
	"total_ksa_days" integer,
	"calculated_visa_tier" "visa_tier",
	"locked_visa_rate_per_person_pkr" integer,
	"calculated_visa_total_pkr" integer,
	"city_sequence" "city_sequence",
	"entry_airport" varchar(3),
	"exit_airport" varchar(3),
	"departure_city_id" uuid,
	"flight_route_type" "flight_route_type",
	"cabin_class" "cabin_class",
	"preferred_airline_id" uuid,
	"group_package_id" uuid,
	"group_departure_id" uuid,
	"selected_room_type" "room_type",
	"hajj_consultation_type" text,
	"ziyarat_scope" "ziyarat_scope",
	"ziyarat_vehicle_id" uuid,
	"selected_ziyarat_place_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_staff_user_id" text,
	"last_contacted_at" timestamp with time zone,
	"quote_sent_at" timestamp with time zone,
	"decision_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" varchar(255),
	"phone" varchar(32) NOT NULL,
	"whatsapp" varchar(32),
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" "message_status" DEFAULT 'unread' NOT NULL,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "faq_category" DEFAULT 'general' NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hero_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"badge" text,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"image_url" text NOT NULL,
	"primary_cta_label" text DEFAULT 'Plan Custom Umrah' NOT NULL,
	"primary_cta_url" text DEFAULT '#custom-builder' NOT NULL,
	"secondary_cta_label" text DEFAULT 'Explore Packages',
	"secondary_cta_url" text DEFAULT '#group-packages',
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pilgrim_name" text NOT NULL,
	"city" text NOT NULL,
	"quote" text NOT NULL,
	"package_or_journey_type" text NOT NULL,
	"rating" integer DEFAULT 5 NOT NULL,
	"avatar_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_settings" ADD CONSTRAINT "agency_settings_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_rates" ADD CONSTRAINT "transport_rates_sector_id_transport_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."transport_sectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_rates" ADD CONSTRAINT "transport_rates_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_rates" ADD CONSTRAINT "visa_rates_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_departures" ADD CONSTRAINT "group_departures_package_id_group_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."group_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_departures" ADD CONSTRAINT "group_departures_departure_city_id_departure_cities_id_fk" FOREIGN KEY ("departure_city_id") REFERENCES "public"."departure_cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_packages" ADD CONSTRAINT "group_packages_airline_id_airlines_id_fk" FOREIGN KEY ("airline_id") REFERENCES "public"."airlines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_packages" ADD CONSTRAINT "group_packages_makkah_hotel_id_hotels_id_fk" FOREIGN KEY ("makkah_hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_packages" ADD CONSTRAINT "group_packages_madinah_hotel_id_hotels_id_fk" FOREIGN KEY ("madinah_hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_hotel_stays" ADD CONSTRAINT "application_hotel_stays_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_hotel_stays" ADD CONSTRAINT "application_hotel_stays_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_quotes" ADD CONSTRAINT "application_quotes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_quotes" ADD CONSTRAINT "application_quotes_quoted_by_user_id_user_id_fk" FOREIGN KEY ("quoted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_transport_segments" ADD CONSTRAINT "application_transport_segments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_transport_segments" ADD CONSTRAINT "application_transport_segments_sector_id_transport_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."transport_sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_transport_segments" ADD CONSTRAINT "application_transport_segments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_departure_city_id_departure_cities_id_fk" FOREIGN KEY ("departure_city_id") REFERENCES "public"."departure_cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_preferred_airline_id_airlines_id_fk" FOREIGN KEY ("preferred_airline_id") REFERENCES "public"."airlines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_group_package_id_group_packages_id_fk" FOREIGN KEY ("group_package_id") REFERENCES "public"."group_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_group_departure_id_group_departures_id_fk" FOREIGN KEY ("group_departure_id") REFERENCES "public"."group_departures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_ziyarat_vehicle_id_vehicles_id_fk" FOREIGN KEY ("ziyarat_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_staff_user_id_user_id_fk" FOREIGN KEY ("assigned_staff_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_user_id" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_session_user_id" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_session_token" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_user_email" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_user_role" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_airline_active" ON "airlines" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_airline_sort" ON "airlines" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_departure_city_active" ON "departure_cities" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_departure_city_sort" ON "departure_cities" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_hotel_city" ON "hotels" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_hotel_rating" ON "hotels" USING btree ("star_rating");--> statement-breakpoint
CREATE INDEX "idx_hotel_active" ON "hotels" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_hotel_featured" ON "hotels" USING btree ("is_featured");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transport_rate_sector_vehicle" ON "transport_rates" USING btree ("sector_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_transport_rate_sector" ON "transport_rates" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "idx_transport_rate_vehicle" ON "transport_rates" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_sector_code" ON "transport_sectors" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_sector_active" ON "transport_sectors" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_vehicle_category" ON "vehicles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_vehicle_active" ON "vehicles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_vehicle_sort" ON "vehicles" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_ziyarat_city" ON "ziyarat_places" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_ziyarat_active" ON "ziyarat_places" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_departure_package" ON "group_departures" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "idx_departure_date" ON "group_departures" USING btree ("departure_date");--> statement-breakpoint
CREATE INDEX "idx_departure_status" ON "group_departures" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_package_tier" ON "group_packages" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_package_active" ON "group_packages" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_package_featured" ON "group_packages" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "idx_stay_app_id" ON "application_hotel_stays" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_stay_hotel_id" ON "application_hotel_stays" USING btree ("hotel_id");--> statement-breakpoint
CREATE INDEX "idx_quote_app_id" ON "application_quotes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_quote_payment_status" ON "application_quotes" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_segment_app_id" ON "application_transport_segments" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_segment_sector_id" ON "application_transport_segments" USING btree ("sector_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_app_ref_number" ON "applications" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "idx_app_phone" ON "applications" USING btree ("customer_phone");--> statement-breakpoint
CREATE INDEX "idx_app_status" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_app_created" ON "applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_app_assigned_staff" ON "applications" USING btree ("assigned_staff_user_id");--> statement-breakpoint
CREATE INDEX "idx_contact_status" ON "contact_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_contact_created" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_faq_category" ON "faqs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_faq_active" ON "faqs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_hero_active" ON "hero_slides" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_hero_sort" ON "hero_slides" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_testimonial_active" ON "testimonials" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_testimonial_featured" ON "testimonials" USING btree ("is_featured");