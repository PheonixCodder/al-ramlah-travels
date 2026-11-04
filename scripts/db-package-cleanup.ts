import { db } from "../db"
import { sql } from "drizzle-orm"

async function run() {
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

  async function getCounts(title: string) {
    console.log(`\n========================================`)
    console.log(`--- ${title} ---`)
    console.log(`========================================`)
    
    console.log(`\n[PACKAGE DATA TABLES]`)
    for (const t of packageTables) {
      try {
        const res = await db.execute(sql.raw(`SELECT COUNT(*)::int as count FROM "${t}"`))
        console.log(`  ${t.padEnd(28)}: ${res.rows[0]?.count}`)
      } catch (e: unknown) {
        console.log(`  ${t.padEnd(28)}: ERROR (${e instanceof Error ? e.message : String(e)})`)
      }
    }

    console.log(`\n[LINKED ACTIVITY TABLES]`)
    for (const t of linkedActivityTables) {
      try {
        const res = await db.execute(sql.raw(`SELECT COUNT(*)::int as count FROM "${t}"`))
        console.log(`  ${t.padEnd(28)}: ${res.rows[0]?.count}`)
      } catch (e: unknown) {
        console.log(`  ${t.padEnd(28)}: ERROR (${e instanceof Error ? e.message : String(e)})`)
      }
    }

    console.log(`\n[PROTECTED TABLES - MUST REMAIN UNTOUCHED]`)
    for (const t of protectedTables) {
      try {
        const res = await db.execute(sql.raw(`SELECT COUNT(*)::int as count FROM "${t}"`))
        console.log(`  ${t.padEnd(28)}: ${res.rows[0]?.count}`)
      } catch (e: unknown) {
        console.log(`  ${t.padEnd(28)}: ERROR (${e instanceof Error ? e.message : String(e)})`)
      }
    }
  }

  await getCounts("BEFORE CLEANUP ROW COUNTS")

  console.log(`\n>>> Executing safe cleanup...`)

  // Step 1: Null out foreign keys on applications and conversations
  console.log(`1. Nulling out package FKs on applications & whatsapp_conversations...`)
  await db.execute(
    sql`UPDATE "applications" SET "group_package_id" = NULL, "group_departure_id" = NULL WHERE "group_package_id" IS NOT NULL OR "group_departure_id" IS NOT NULL`
  )
  await db.execute(
    sql`UPDATE "whatsapp_conversations" SET "detected_post_code" = NULL WHERE "detected_post_code" IS NOT NULL`
  )

  // Step 2: Null out outreach logs referencing post_assets or supplier_flyers
  console.log(`2. Nulling out post_asset_id and flyer_id in outreach_logs...`)
  await db.execute(
    sql`UPDATE "outreach_logs" SET "post_asset_id" = NULL, "flyer_id" = NULL WHERE "post_asset_id" IS NOT NULL OR "flyer_id" IS NOT NULL`
  )

  // Step 3: Delete scheduled_posts and daily_post_distributions tied to post_assets
  console.log(`3. Deleting scheduled_posts & daily_post_distributions...`)
  await db.execute(sql`DELETE FROM "scheduled_posts"`)
  await db.execute(sql`DELETE FROM "daily_post_distributions"`)

  // Step 4: Delete package data in strict dependency order:
  // 1. post_assets
  // 2. supplier_flyer_packages (first nulling FK published_group_package_id / published_group_departure_id if needed)
  // 3. supplier_flyers
  // 4. group_departures
  // 5. group_packages
  console.log(`4. Deleting post_assets...`)
  await db.execute(sql`DELETE FROM "post_assets"`)

  console.log(`5. Deleting supplier_flyer_packages...`)
  await db.execute(sql`UPDATE "supplier_flyer_packages" SET "published_group_package_id" = NULL, "published_group_departure_id" = NULL`)
  await db.execute(sql`DELETE FROM "supplier_flyer_packages"`)

  console.log(`6. Deleting supplier_flyers...`)
  await db.execute(sql`DELETE FROM "supplier_flyers"`)

  console.log(`7. Deleting group_departures...`)
  await db.execute(sql`DELETE FROM "group_departures"`)

  console.log(`8. Deleting group_packages...`)
  await db.execute(sql`DELETE FROM "group_packages"`)

  console.log(`>>> Cleanup completed successfully!`)

  await getCounts("AFTER CLEANUP ROW COUNTS")
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Cleanup error:", err)
    process.exit(1)
  })
