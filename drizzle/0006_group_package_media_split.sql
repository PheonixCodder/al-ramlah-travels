ALTER TABLE "group_packages" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "group_packages" ADD COLUMN "internal_poster_url" text;--> statement-breakpoint
UPDATE "group_packages" AS gp
SET "internal_poster_url" = COALESCE(gp."internal_poster_url", gp."banner_url"),
    "cover_image_url" = NULL,
    "banner_url" = NULL
WHERE gp."banner_url" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "supplier_flyer_packages" AS sfp
    WHERE sfp."published_group_package_id" = gp."id"
  );--> statement-breakpoint
UPDATE "group_packages" AS gp
SET "cover_image_url" = gp."banner_url"
WHERE gp."banner_url" IS NOT NULL
  AND gp."cover_image_url" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "supplier_flyer_packages" AS sfp
    WHERE sfp."published_group_package_id" = gp."id"
  );