import path from "node:path"
import { fileURLToPath } from "node:url"
import { neonConfig, Pool as NeonPool } from "@neondatabase/serverless"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless"
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator"
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres"
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import ws from "ws"
import {
  assertSafeScriptTarget,
  loadSafeScriptEnv,
  maskConnectionUrl,
} from "../scripts/_guard"

function isNeonServerlessUrl(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString)
    const host = parsed.hostname.toLowerCase()
    return host.endsWith(".neon.tech") || host.includes(".neon.tech")
  } catch {
    return false
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_FOLDER = path.resolve(__dirname, "../drizzle")

export async function runMigrations(options?: {
  connectionString?: string
  argv?: readonly string[]
}): Promise<void> {
  loadSafeScriptEnv()
  const connectionString =
    options?.connectionString?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""

  assertSafeScriptTarget(connectionString, options?.argv ?? process.argv)

  console.log(
    `📦 Applying Drizzle SQL migrations from ./drizzle -> ${maskConnectionUrl(connectionString)}`
  )

  if (isNeonServerlessUrl(connectionString)) {
    neonConfig.webSocketConstructor = ws
    const pool = new NeonPool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 15_000,
    })
    try {
      const db = drizzleNeon(pool)
      await migrateNeon(db, { migrationsFolder: MIGRATIONS_FOLDER })
    } finally {
      await pool.end()
    }
  } else {
    const pool = new pg.Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 15_000,
    })
    try {
      const db = drizzleNodePg(pool)
      await migrateNodePg(db, { migrationsFolder: MIGRATIONS_FOLDER })
    } finally {
      await pool.end()
    }
  }

  console.log("✅ Migrations applied successfully!")
}

const isMigrateEntrypoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMigrateEntrypoint) {
  runMigrations()
    .then(() => {
      process.exit(0)
    })
    .catch((error: unknown) => {
      console.error("❌ Migration execution failed:", error)
      process.exit(1)
    })
}
