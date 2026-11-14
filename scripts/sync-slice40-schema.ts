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

async function syncSlice40Schema() {
  console.log("🚀 Starting Slice 40 Neon PostgreSQL migration & purge...")

  // 1. Purge fake seeded marketing channels and distributions
  console.log("🧹 Checking for fake placeholder marketing channels to purge...")
  const fakeChannels = await sql`
    SELECT id, name, area_tag, external_group_id_or_handle, platform
    FROM marketing_channels
    WHERE (area_tag IN ('Askari 10', 'DHA', 'Lahore', 'Other Cities', 'Status', 'Social')
      AND (external_group_id_or_handle IS NULL OR external_group_id_or_handle NOT LIKE '%@g.us'))
      OR name LIKE 'Askari 10%'
      OR name LIKE 'DHA Phase%'
      OR name LIKE 'Lahore Cantt%'
      OR name LIKE 'Bahria Town%'
      OR name LIKE 'Model Town%'
      OR name LIKE 'Gulberg &%'
      OR name LIKE 'Wapda Town%'
      OR name LIKE 'Lake City%'
      OR name LIKE 'Islamabad F-6%'
      OR name LIKE 'Gujranwala &%'
      OR name LIKE 'Faisalabad Textile%'
      OR name LIKE 'Multan & Bahawalpur%'
      OR name LIKE 'WhatsApp Status — Primary Line%'
      OR name LIKE 'WhatsApp Status — Secondary Line%'
      OR name LIKE 'Al Ramlah Travels Instagram%'
      OR name LIKE 'Al Ramlah Travels Facebook%'
      OR name LIKE 'Al Ramlah Travels TikTok%'
      OR name LIKE 'Al Ramlah Travels YouTube%';
  `
  console.log(`Found ${fakeChannels.length} fake/placeholder marketing channels.`)

  if (fakeChannels.length > 0) {
    const fakeIds = fakeChannels.map((c: any) => c.id)
    console.log("Deleting referencing daily_post_distributions...")
    const deletedDists = await sql`
      DELETE FROM daily_post_distributions
      WHERE channel_id = ANY(${fakeIds})
      RETURNING id;
    `
    console.log(`✓ Deleted ${deletedDists.length} referencing daily_post_distributions.`)

    const deletedChannels = await sql`
      DELETE FROM marketing_channels
      WHERE id = ANY(${fakeIds})
      RETURNING id;
    `
    console.log(`✓ Purged ${deletedChannels.length} fake marketing_channels rows.`)
  }

  // 2. Enum: whatsapp_linked_device_status
  console.log("\n📦 Ensuring enum 'whatsapp_linked_device_status' exists...")
  await sql`
    DO $$ BEGIN
      CREATE TYPE whatsapp_linked_device_status AS ENUM (
        'disconnected', 'connecting', 'qr_ready', 'pairing_code_ready', 'connected'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `
  console.log("✓ Enum 'whatsapp_linked_device_status' verified.")

  // 3. Table: whatsapp_linked_device_sessions
  console.log("\n📦 Ensuring table 'whatsapp_linked_device_sessions' exists...")
  await sql`
    CREATE TABLE IF NOT EXISTS whatsapp_linked_device_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_key VARCHAR(64) NOT NULL DEFAULT 'default' UNIQUE,
      label TEXT NOT NULL DEFAULT 'Primary Business WhatsApp',
      phone_number VARCHAR(32),
      push_name TEXT,
      status whatsapp_linked_device_status NOT NULL DEFAULT 'disconnected',
      qr_data_url TEXT,
      pairing_code VARCHAR(16),
      encrypted_auth_creds TEXT,
      encrypted_auth_keys TEXT,
      groups_synced_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_connected_at TIMESTAMPTZ,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_wa_linked_session_key ON whatsapp_linked_device_sessions (session_key);
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_wa_linked_status ON whatsapp_linked_device_sessions (status);
  `
  console.log("✓ Table 'whatsapp_linked_device_sessions' created/verified.")

  // 4. Ensure unique constraint/index on marketing_channels.external_group_id_or_handle for conflict handling
  console.log("\n📦 Ensuring unique index on marketing_channels.external_group_id_or_handle...")
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_channels_external_handle
    ON marketing_channels (external_group_id_or_handle)
    WHERE external_group_id_or_handle IS NOT NULL;
  `
  console.log("✓ Unique index 'idx_marketing_channels_external_handle' verified.")

  // 5. Verification
  console.log("\n🔍 Verifying schema in information_schema.columns...")
  const columns = await sql`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'whatsapp_linked_device_sessions'
    ORDER BY ordinal_position;
  `
  console.table(columns)

  const remainingChannels = await sql`
    SELECT count(*)::int as count FROM marketing_channels;
  `
  console.log(`Remaining marketing channels count in DB: ${remainingChannels[0].count}`)

  console.log("✨ Slice 40 database schema migration and purge completed successfully!")
}

syncSlice40Schema().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
