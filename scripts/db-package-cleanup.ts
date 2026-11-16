import { sql } from "drizzle-orm"
import { resolveGuardedScriptDatabaseUrl } from "./_guard"

async function run(): Promise<void> {
  // Enforce safe non-production / --confirm-env guard BEFORE importing ../db
  resolveGuardedScriptDatabaseUrl()
  const { db, closeDatabasePool } = await import("../db")

  const protectedTables = [
    "hotels",
    "ziyarat_places",
    "vehicles",
    "transport_sectors",
    "transport_rates",
    "visa_rates",
    "airlines",
    "departure_cities",
    "suppliers",
    "hero_slides",
    "testimonials",
    "faqs",
    "contact_messages",
    "agency_settings",
    "user",
    "session",
    "account",
    "marketing_channels",
    "outreach_contacts",
    "whatsapp_accounts",
    "social_integrations",
  ]

  const packageTables = [
    "post_assets",
    "supplier_flyer_packages",
    "supplier_flyers",
    "group_departures",
    "group_packages",
  ]

  const linkedActivityTables = [
    "applications",
    "whatsapp_conversations",
    "outreach_logs",
    "scheduled_posts",
    "daily_post_distributions",
  ]

  async function getCounts(title: string): Promise<void> {
    console.log(`\n========================================`)
    console.log(`--- ${title} ---`)
    console.log(`========================================`)

    for (const [sectionLabel, tableList] of [
      ["PACKAGE DATA TABLES", packageTables],
      ["LINKED ACTIVITY TABLES", linkedActivityTables],
      ["PROTECTED TABLES - MUST REMAIN UNTOUCHED", protectedTables],
    ] as const) {
      console.log(`\n[${sectionLabel}]`)
      for (const t of tableList) {
        try {
          const res = await db.execute(
            sql.raw(`SELECT COUNT(*)::int as count FROM "${t}"`)
          )
          const row = res.rows[0] as { count?: number } | undefined
          console.log(`  ${t.padEnd(28)}: ${row?.count ?? 0}`)
        } catch (e: unknown) {
          console.log(
            `  ${t.padEnd(28)}: ERROR (${e instanceof Error ? e.message : String(e)})`
          )
        }
      }
    }
  }

  try {
    await getCounts("BEFORE CLEANUP ROW COUNTS")
    console.log(`\n>>> Executing safe cleanup...`)

    await db.execute(
      sql`UPDATE "applications" SET "group_package_id" = NULL, "group_departure_id" = NULL WHERE "group_package_id" IS NOT NULL OR "group_departure_id" IS NOT NULL`
    )
    await db.execute(
      sql`UPDATE "whatsapp_conversations" SET "detected_post_code" = NULL WHERE "detected_post_code" IS NOT NULL`
    )
    await db.execute(
      sql`UPDATE "outreach_logs" SET "post_asset_id" = NULL, "flyer_id" = NULL WHERE "post_asset_id" IS NOT NULL OR "flyer_id" IS NOT NULL`
    )
    await db.execute(sql`DELETE FROM "scheduled_posts"`)
    await db.execute(sql`DELETE FROM "daily_post_distributions"`)
    await db.execute(sql`DELETE FROM "post_assets"`)
    await db.execute(
      sql`UPDATE "supplier_flyer_packages" SET "published_group_package_id" = NULL, "published_group_departure_id" = NULL`
    )
    await db.execute(sql`DELETE FROM "supplier_flyer_packages"`)
    await db.execute(sql`DELETE FROM "supplier_flyers"`)
    await db.execute(sql`DELETE FROM "group_departures"`)
    await db.execute(sql`DELETE FROM "group_packages"`)

    console.log(`>>> Cleanup completed successfully!`)
    await getCounts("AFTER CLEANUP ROW COUNTS")
  } finally {
    await closeDatabasePool()
  }
}

run()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("Cleanup error:", err)
    process.exit(1)
  })
