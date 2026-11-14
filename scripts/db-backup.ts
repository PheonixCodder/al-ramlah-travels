import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  loadSafeScriptEnv,
  maskConnectionUrl,
  withScriptPgClient,
} from "./_guard"

export interface BackupResult {
  outputPath: string
  format: "pg_dump_custom" | "json_snapshot"
  bytesWritten: number
}

function parsePgUrlComponents(connectionString: string): {
  host: string
  port: string
  user: string
  password: string
  database: string
  sslmode: string | null
} {
  const parsed = new URL(connectionString)
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    sslmode: parsed.searchParams.get("sslmode"),
  }
}

export async function runDatabaseBackup(options?: {
  connectionString?: string
  outputDir?: string
  requirePgDump?: boolean
}): Promise<BackupResult> {
  loadSafeScriptEnv()
  const connectionString =
    options?.connectionString ||
    process.env.DATABASE_URL_DIRECT ||
    process.env.DATABASE_URL_POOLED ||
    process.env.DATABASE_URL ||
    ""

  if (!connectionString) {
    throw new Error(
      "Missing DATABASE_URL_DIRECT / DATABASE_URL_POOLED / DATABASE_URL for backup."
    )
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const webRoot = path.resolve(scriptDir, "..")
  const outputDir = options?.outputDir || path.resolve(webRoot, "backups")
  fs.mkdirSync(outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const dumpPath = path.join(outputDir, `alramlah-backup-${timestamp}.dump`)

  const pgParts = parsePgUrlComponents(connectionString)

  // Pass PGPASSWORD via child environment (never on CLI arguments) so ps/procfs cannot leak credentials.
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PGPASSWORD: pgParts.password,
  }
  if (pgParts.sslmode) {
    childEnv.PGSSLMODE = pgParts.sslmode
  }

  const dumpAttempt = spawnSync(
    "pg_dump",
    [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--host",
      pgParts.host,
      "--port",
      pgParts.port,
      "--username",
      pgParts.user,
      "--dbname",
      pgParts.database,
      "--file",
      dumpPath,
    ],
    {
      env: childEnv,
      encoding: "utf8",
      timeout: 120_000,
    }
  )

  if (!dumpAttempt.error && dumpAttempt.status === 0 && fs.existsSync(dumpPath)) {
    const stats = fs.statSync(dumpPath)
    return {
      outputPath: dumpPath,
      format: "pg_dump_custom",
      bytesWritten: stats.size,
    }
  }

  if (options?.requirePgDump) {
    const stderr = dumpAttempt.stderr || dumpAttempt.error?.message || "unknown error"
    throw new Error(`pg_dump failed: ${stderr}`)
  }

  // Portable JSON logical snapshot fallback when pg_dump binary is not installed locally
  const jsonPath = path.join(outputDir, `alramlah-backup-${timestamp}.json`)
  const snapshotPayload = await withScriptPgClient(connectionString, async (client) => {
    const tablesRes = await client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name ASC`
    )

    const tablesData: Record<string, unknown[]> = {}
    for (const row of tablesRes.rows) {
      const safeIdent = `"${row.table_name.replace(/"/g, '""')}"`
      const tableRows = await client.query(`SELECT * FROM ${safeIdent}`)
      tablesData[row.table_name] = tableRows.rows
    }

    return {
      createdAt: new Date().toISOString(),
      source: maskConnectionUrl(connectionString),
      tableCount: tablesRes.rows.length,
      tables: tablesData,
    }
  })

  const serialized = JSON.stringify(snapshotPayload, null, 2)
  fs.writeFileSync(jsonPath, serialized, { encoding: "utf8", mode: 0o600 })
  const stats = fs.statSync(jsonPath)

  return {
    outputPath: jsonPath,
    format: "json_snapshot",
    bytesWritten: stats.size,
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMainModule) {
  const strictPgDump = process.argv.includes("--strict")
  runDatabaseBackup({ requirePgDump: strictPgDump })
    .then((result) => {
      console.log(
        `✅ Backup completed (${result.format}): ${result.outputPath} (${result.bytesWritten} bytes)`
      )
      process.exit(0)
    })
    .catch((err: unknown) => {
      console.error(
        "❌ Database backup failed:",
        err instanceof Error ? err.message : String(err)
      )
      process.exit(1)
    })
}
