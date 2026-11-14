import {
  maskConnectionUrl,
  resolveGuardedScriptDatabaseUrl,
  withScriptPgClient,
} from "./_guard"

interface FakeChannelRow {
  id: string
  name: string
  area_tag: string | null
  external_group_id_or_handle: string | null
  platform: string
}

async function syncSlice40Schema(): Promise<void> {
  const connectionString = resolveGuardedScriptDatabaseUrl()
  console.log(
    `🚀 Starting Slice 40 PostgreSQL migration & purge (${maskConnectionUrl(connectionString)})...`
  )

  await withScriptPgClient(connectionString, async (client) => {
    const fakeChannelsRes = await client.query<FakeChannelRow>(`
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
        OR name LIKE 'WhatsApp Status — Secondary Line%';
    `)

    const fakeChannels = fakeChannelsRes.rows
    console.log(
      `Found ${fakeChannels.length} fake/placeholder marketing channels.`
    )

    if (fakeChannels.length > 0) {
      const fakeIds = fakeChannels.map((c) => c.id)
      const deletedDists = await client.query(
        `DELETE FROM daily_post_distributions WHERE channel_id = ANY($1::uuid[]) RETURNING id`,
        [fakeIds]
      )
      console.log(
        `✓ Deleted ${deletedDists.rowCount ?? 0} referencing daily_post_distributions.`
      )

      const deletedChannels = await client.query(
        `DELETE FROM marketing_channels WHERE id = ANY($1::uuid[]) RETURNING id`,
        [fakeIds]
      )
      console.log(
        `✓ Purged ${deletedChannels.rowCount ?? 0} fake marketing_channels rows.`
      )
    }

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE whatsapp_linked_device_status AS ENUM (
          'disconnected', 'connecting', 'qr_ready', 'pairing_code_ready', 'connected'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)

    await client.query(`
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
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wa_linked_status
      ON whatsapp_linked_device_sessions (status);
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_channels_external_handle
      ON marketing_channels (external_group_id_or_handle)
      WHERE external_group_id_or_handle IS NOT NULL;
    `)

    console.log(
      "✨ Slice 40 database schema migration and purge completed successfully!"
    )
  })
}

syncSlice40Schema().catch((err: unknown) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
