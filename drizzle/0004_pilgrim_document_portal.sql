CREATE TYPE "public"."pilgrim_document_status" AS ENUM('missing', 'uploaded', 'approved', 'reupload_requested', 'purged');--> statement-breakpoint
CREATE TYPE "public"."pilgrim_document_type" AS ENUM('passport_bio_page', 'national_id', 'visa_photo');--> statement-breakpoint
CREATE TYPE "public"."traveller_category" AS ENUM('adult', 'child', 'infant');--> statement-breakpoint
CREATE TABLE "application_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"traveller_id" uuid NOT NULL,
	"doc_type" "pilgrim_document_type" NOT NULL,
	"status" "pilgrim_document_status" DEFAULT 'missing' NOT NULL,
	"storage_key" text,
	"original_filename" varchar(200),
	"mime_type" varchar(64),
	"size_bytes" integer,
	"rejection_reason" text,
	"uploaded_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"pii_purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_app_doc_size_bounds" CHECK ("application_documents"."size_bytes" IS NULL OR ("application_documents"."size_bytes" > 0 AND "application_documents"."size_bytes" <= 10485760)),
	CONSTRAINT "chk_app_doc_rejection_reason" CHECK ("application_documents"."status" != 'reupload_requested' OR ("application_documents"."rejection_reason" IS NOT NULL AND length(btrim("application_documents"."rejection_reason")) > 0)),
	CONSTRAINT "chk_app_doc_visa_photo_mime" CHECK ("application_documents"."doc_type" != 'visa_photo' OR "application_documents"."mime_type" IS NULL OR "application_documents"."mime_type" IN ('image/jpeg', 'image/png', 'image/webp'))
);
--> statement-breakpoint
CREATE TABLE "application_travellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"slot_index" integer NOT NULL,
	"category" "traveller_category" NOT NULL,
	"category_ordinal" integer NOT NULL,
	"full_name" text,
	"passport_number" varchar(32),
	"passport_expiry_date" date,
	"national_id_number" varchar(32),
	"expiry_override_by_staff" boolean DEFAULT false NOT NULL,
	"expiry_override_reason" text,
	"pii_purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_app_traveller_slot_pos" CHECK ("application_travellers"."slot_index" >= 1 AND "application_travellers"."category_ordinal" >= 1),
	CONSTRAINT "chk_app_traveller_override_reason" CHECK ("application_travellers"."expiry_override_by_staff" = false OR ("application_travellers"."expiry_override_reason" IS NOT NULL AND length(btrim("application_travellers"."expiry_override_reason")) > 0))
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "document_portal_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "document_portal_token_encrypted" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "document_portal_token_rotated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_traveller_id_application_travellers_id_fk" FOREIGN KEY ("traveller_id") REFERENCES "public"."application_travellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_travellers" ADD CONSTRAINT "application_travellers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_traveller_doc_type" ON "application_documents" USING btree ("traveller_id","doc_type");--> statement-breakpoint
CREATE INDEX "idx_app_docs_app_status" ON "application_documents" USING btree ("application_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_app_traveller_slot" ON "application_travellers" USING btree ("application_id","slot_index");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_app_traveller_cat_ord" ON "application_travellers" USING btree ("application_id","category","category_ordinal");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_document_portal_token_hash_unique" UNIQUE("document_portal_token_hash");