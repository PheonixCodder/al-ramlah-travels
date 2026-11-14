import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, "../.env") })

import { neon } from "@neondatabase/serverless"

const connectionString =
  process.env.DATABASE_URL_POOLED ||
  process.env.DATABASE_URL

if (!connectionString) {
  console.error("Missing database connection string in web/.env")
  process.exit(1)
}

const sql = neon(connectionString)

async function syncPhase3Columns() {
  console.log("Checking and applying Phase 3 column migrations on Neon PostgreSQL...")

  const migrationQueries = [
    {
      table: "whatsapp_conversations",
      column: "internal_notes",
      query: `ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS internal_notes JSONB NOT NULL DEFAULT '[]'::jsonb;`
    },
    {
      table: "whatsapp_conversations",
      column: "intake_flow_state",
      query: `ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS intake_flow_state JSONB NOT NULL DEFAULT '{"step":"IDLE"}'::jsonb;`
    },
    {
      table: "whatsapp_broadcasts",
      column: "header_media_url",
      query: `ALTER TABLE whatsapp_broadcasts ADD COLUMN IF NOT EXISTS header_media_url TEXT;`
    },
    {
      table: "whatsapp_broadcasts",
      column: "default_template_params",
      query: `ALTER TABLE whatsapp_broadcasts ADD COLUMN IF NOT EXISTS default_template_params JSONB DEFAULT '{}'::jsonb;`
    },
    {
      table: "scheduled_posts",
      column: "platform_captions",
      query: `ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS platform_captions JSONB NOT NULL DEFAULT '{}'::jsonb;`
    },
    {
      table: "scheduled_posts",
      column: "engagement_plug_config",
      query: `ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS engagement_plug_config JSONB DEFAULT NULL;`
    }
  ]

  for (const { table, column, query } of migrationQueries) {
    try {
      console.log(`Applying column migration for ${table}.${column}...`)
      await sql.query(query)
      console.log(`✓ Migration succeeded: ${table}.${column}`)
    } catch (err) {
      console.error(`✗ Error migrating ${table}.${column}:`, err)
      throw err
    }
  }

  console.log("\nVerifying columns in information_schema.columns...")
  const verificationQuery = `
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE (table_name = 'whatsapp_conversations' AND column_name IN ('internal_notes', 'intake_flow_state'))
       OR (table_name = 'whatsapp_broadcasts' AND column_name IN ('header_media_url', 'default_template_params'))
       OR (table_name = 'scheduled_posts' AND column_name IN ('platform_captions', 'engagement_plug_config'))
    ORDER BY table_name, column_name;
  `
  const results = await sql.query(verificationQuery)
  console.log("Found matching columns in database:")
  console.table(results)

  if (results.length < 6) {
    console.error(`Expected 6 columns, but only found ${results.length}!`)
    process.exit(1)
  }

  console.log("All 6 Phase 3 columns verified successfully in Neon PostgreSQL!")
}

syncPhase3Columns().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
