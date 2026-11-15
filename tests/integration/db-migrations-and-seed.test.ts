import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { runMigrations } from "../../db/migrate"
import { assertAuditSafeEnvironment } from "../helpers/audit-guard"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(__dirname, "../..")
const MIGTEST_DB_NAME = "alramlah_audit_migtest"

function buildDbUrlForDatabase(baseConnectionString: string, dbName: string): string {
  const parsed = new URL(baseConnectionString)
  if (
    parsed.hostname !== "127.0.0.1" &&
    parsed.hostname !== "localhost" &&
    parsed.hostname !== "::1"
  ) {
    throw new Error(
      `Refusing to create migration test database on non-local host: ${parsed.hostname}`
    )
  }
  parsed.pathname = `/${dbName}`
  return parsed.toString()
}

async function snapshotPublicTableCounts(
  client: pg.Client
): Promise<Record<string, number>> {
  const tablesRes = await client.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC`
  )
  const counts: Record<string, number> = {}
  for (const row of tablesRes.rows) {
    const tableName = row.table_name
    if (!/^[a-z0-9_]+$/i.test(tableName)) continue
    const countRes = await client.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM "${tableName}"`
    )
    counts[tableName] = Number.parseInt(countRes.rows[0]?.cnt ?? "0", 10)
  }
  return counts
}

function runSeedSubprocess(migTestUrl: string): {
  status: number | null
  stdout: string
  stderr: string
} {
  const result = spawnSync(
    process.execPath,
    ["./node_modules/tsx/dist/cli.mjs", "./db/seed.ts"],
    {
      cwd: WEB_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: migTestUrl,
        DATABASE_URL_POOLED: migTestUrl,
        DATABASE_URL_UNPOOLED: migTestUrl,
      },
    }
  )
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

describe("T-040: Isolated PostgreSQL Migrations, Idempotent Seed, Constraints & Audit Immutability", () => {
  let adminUrl = ""
  let migTestUrl = ""
  let migClient: pg.Client | null = null

  beforeAll(async () => {
    assertAuditSafeEnvironment()
    const baseUrl =
      process.env.DATABASE_URL_UNPOOLED?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      "postgresql://postgres:auditpass@127.0.0.1:54329/alramlah_audit"

    adminUrl = buildDbUrlForDatabase(baseUrl, "postgres")
    migTestUrl = buildDbUrlForDatabase(baseUrl, MIGTEST_DB_NAME)

    // Never touch alramlah_audit — create dedicated isolated alramlah_audit_migtest
    const adminClient = new pg.Client({ connectionString: adminUrl })
    await adminClient.connect()
    try {
      await adminClient.query(
        `DROP DATABASE IF EXISTS "${MIGTEST_DB_NAME}" WITH (FORCE)`
      )
      await adminClient.query(`CREATE DATABASE "${MIGTEST_DB_NAME}"`)
    } finally {
      await adminClient.end()
    }
  }, 60_000)

  afterAll(async () => {
    if (migClient) {
      await migClient.end().catch(() => undefined)
      migClient = null
    }
    if (adminUrl) {
      const adminClient = new pg.Client({ connectionString: adminUrl })
      await adminClient.connect()
      try {
        await adminClient.query(
          `DROP DATABASE IF EXISTS "${MIGTEST_DB_NAME}" WITH (FORCE)`
        )
      } finally {
        await adminClient.end()
      }
    }
  }, 60_000)

  it(
    "applies all Drizzle SQL migrations cleanly onto a blank database and creates all 48 schema tables + unique indexes",
    async () => {
      await runMigrations({ connectionString: migTestUrl, argv: [] })

      migClient = new pg.Client({ connectionString: migTestUrl })
      await migClient.connect()

      const tablesRes = await migClient.query<{ table_name: string }>(
        `SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
          ORDER BY table_name ASC`
      )
      const tableNames = tablesRes.rows.map((r) => r.table_name)
      expect(tableNames.length).toBe(48)

      for (const expectedTable of [
        "user",
        "session",
        "account",
        "verification",
        "audit_logs",
        "rate_limit_buckets",
        "agency_settings",
        "visa_rates",
        "hotels",
        "group_packages",
        "group_departures",
        "applications",
        "application_quotes",
        "application_payments",
        "marketing_channels",
        "whatsapp_accounts",
        "whatsapp_conversations",
        "whatsapp_messages",
        "scheduled_posts",
        "scheduled_post_targets",
      ]) {
        expect(tableNames).toContain(expectedTable)
      }

      const indexRes = await migClient.query<{ indexname: string }>(
        `SELECT indexname
           FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'idx_marketing_channels_external_handle'`
      )
      expect(indexRes.rowCount).toBe(1)
    },
    60_000
  )

  it(
    "executes db/seed.ts twice back-to-back idempotently and preserves OD-09a long_term visa (90d / PKR 68,000) + OD-10 Lahore HQ address",
    async () => {
      expect(migClient).not.toBeNull()
      const client = migClient!

      const firstRun = runSeedSubprocess(migTestUrl)
      expect(
        firstRun.status,
        `First seed failed:\n${firstRun.stderr}\n${firstRun.stdout}`
      ).toBe(0)
      const countsAfterFirst = await snapshotPublicTableCounts(client)

      const secondRun = runSeedSubprocess(migTestUrl)
      expect(
        secondRun.status,
        `Second seed failed:\n${secondRun.stderr}\n${secondRun.stdout}`
      ).toBe(0)
      const countsAfterSecond = await snapshotPublicTableCounts(client)

      expect(countsAfterSecond).toEqual(countsAfterFirst)
      expect(countsAfterSecond.user).toBeGreaterThanOrEqual(2)
      expect(countsAfterSecond.hotels).toBeGreaterThan(0)
      expect(countsAfterSecond.group_packages).toBeGreaterThan(0)

      const visaRes = await client.query<{
        tier: string
        max_days: number
        price_pkr: number
      }>(
        `SELECT tier, max_days, price_pkr
           FROM visa_rates
          WHERE tier = 'long_term'`
      )
      expect(visaRes.rowCount).toBe(1)
      expect(visaRes.rows[0]?.max_days).toBe(90)
      expect(visaRes.rows[0]?.price_pkr).toBe(68000)

      const agencyRes = await client.query<{ office_address: string }>(
        `SELECT office_address FROM agency_settings WHERE id = 'default'`
      )
      expect(agencyRes.rows[0]?.office_address).toContain(
        "Askari 10, Airport Road, Lahore Cantt"
      )
    },
    90_000
  )

  it("enforces SQL CHECK constraints on negative money and group_departures oversold seats, and blocks UPDATE/DELETE on audit_logs", async () => {
    expect(migClient).not.toBeNull()
    const client = migClient!

    // 1. Negative money CHECK constraint on visa_rates
    await expect(
      client.query(`UPDATE visa_rates SET price_pkr = -100 WHERE tier = 'short_term'`)
    ).rejects.toThrow(/chk_visa_rates_positive|violates check constraint/i)

    // 2. Seat capacity CHECK constraint (booked_seats <= total_seats) on group_departures
    await expect(
      client.query(
        `UPDATE group_departures SET booked_seats = total_seats + 1`
      )
    ).rejects.toThrow(/booked_seats|violates check constraint/i)

    // 3. Append-only audit_logs immutability trigger blocks UPDATE and DELETE
    const insertedAudit = await client.query<{ id: string }>(
      `INSERT INTO audit_logs (actor_role, action, entity_type, entity_id)
       VALUES ('super_admin', 'migration.test_probe', 'system', 'migtest-1')
       RETURNING id`
    )
    const auditId = insertedAudit.rows[0]?.id
    expect(auditId).toBeTruthy()

    await expect(
      client.query(`UPDATE audit_logs SET action = 'tampered' WHERE id = $1`, [
        auditId,
      ])
    ).rejects.toThrow(/immutable|append-only|cannot be modified|update/i)

    await expect(
      client.query(`DELETE FROM audit_logs WHERE id = $1`, [auditId])
    ).rejects.toThrow(/immutable|append-only|cannot be modified|delete/i)
  })
})
