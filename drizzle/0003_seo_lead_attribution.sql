ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_source" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_medium" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_campaign" varchar(160);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_content" varchar(160);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_term" varchar(160);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "landing_page" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "http_referrer" text;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "utm_source" varchar(120);--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "utm_medium" varchar(120);--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "utm_campaign" varchar(160);--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "utm_content" varchar(160);--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "utm_term" varchar(160);--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "landing_page" text;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "http_referrer" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_applications_utm_source_campaign" ON "applications" USING btree ("utm_source","utm_campaign");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contact_messages_utm_source" ON "contact_messages" USING btree ("utm_source");
