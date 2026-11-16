import {
  maskConnectionUrl,
  resolveGuardedScriptDatabaseUrl,
  withScriptPgClient,
} from "./_guard"

async function syncPhase3Columns(): Promise<void> {
  const connectionString = resolveGuardedScriptDatabaseUrl()
  console.log(
    `Checking and applying Phase 3 column migrations on PostgreSQL (${maskConnectionUrl(connectionString)})...`
  )

  const migrationQueries = [
    {
      table: "whatsapp_conversations",
      column: "internal_notes",
      query: `ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS internal_notes JSONB NOT NULL DEFAULT '[]'::jsonb;`,
    },
    {
      table: "whatsapp_conversations",
      column: "intake_flow_state",
      query: `ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS intake_flow_state JSONB NOT NULL DEFAULT '{"step":"IDLE"}'::jsonb;`,
    },
    {
      table: "whatsapp_broadcasts",
      column: "header_media_url",
      query: `ALTER TABLE whatsapp_broadcasts ADD COLUMN IF NOT EXISTS header_media_url TEXT;`,
    },
    {
      table: "whatsapp_broadcasts",
      column: "default_template_params",
      query: `ALTER TABLE whatsapp_broadcasts ADD COLUMN IF NOT EXISTS default_template_params JSONB DEFAULT '{}'::jsonb;`,
    },
    {
      table: "scheduled_posts",
      column: "platform_captions",
      query: `ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS platform_captions JSONB NOT NULL DEFAULT '{}'::jsonb;`,
    },
    {
      table: "scheduled_posts",
      column: "engagement_plug_config",
      query: `ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS engagement_plug_config JSONB DEFAULT NULL;`,
    },
  ]

  await withScriptPgClient(connectionString, async (client) => {
    for (const { table, column, query } of migrationQueries) {
      console.log(`Applying column migration for ${table}.${column}...`)
      await client.query(query)
      console.log(`✓ Migration succeeded: ${table}.${column}`)
    }

    const verificationQuery = `
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE (table_name = 'whatsapp_conversations' AND column_name IN ('internal_notes', 'intake_flow_state'))
         OR (table_name = 'whatsapp_broadcasts' AND column_name IN ('header_media_url', 'default_template_params'))
         OR (table_name = 'scheduled_posts' AND column_name IN ('platform_captions', 'engagement_plug_config'))
      ORDER BY table_name, column_name;
    `
    const results = await client.query(verificationQuery)
    console.table(results.rows)

    if (results.rows.length < 6) {
      throw new Error(
        `Expected 6 columns, but only found ${results.rows.length}!`
      )
    }
    console.log("All 6 Phase 3 columns verified successfully!")
  })
}

syncPhase3Columns().catch((err: unknown) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
