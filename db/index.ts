import { neonConfig, Pool as NeonPool } from "@neondatabase/serverless"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless"
import {
  drizzle as drizzleNodePg,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres"
import pg from "pg"
import ws from "ws"
import * as schema from "./schema"

export type Database = NodePgDatabase<typeof schema>
export type TransactionClient = Parameters<
  Parameters<Database["transaction"]>[0]
>[0]
export type DbOrTx = Database | TransactionClient

export function isNeonServerlessUrl(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString)
    const host = parsed.hostname.toLowerCase()
    return host.endsWith(".neon.tech") || host.includes(".neon.tech")
  } catch {
    return false
  }
}

function resolveConnectionString(): string {
  const configured =
    process.env.DATABASE_URL_POOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""

  if (configured) {
    return configured
  }

  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NODE_ENV === "test"
  ) {
    return "postgresql://placeholder:placeholder@127.0.0.1:54329/placeholder"
  }

  throw new Error(
    "Missing database connection string. Ensure DATABASE_URL_POOLED or DATABASE_URL is configured."
  )
}

export interface ManagedDatabaseInstance {
  db: Database
  driver: "neon-serverless" | "node-postgres"
  close: () => Promise<void>
}

export function createDatabaseClient(
  connectionString: string
): ManagedDatabaseInstance {
  if (isNeonServerlessUrl(connectionString)) {
    neonConfig.webSocketConstructor = ws
    const pool = new NeonPool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
    const instance = drizzleNeon(pool, { schema }) as unknown as Database
    return {
      db: instance,
      driver: "neon-serverless",
      close: async () => {
        await pool.end()
      },
    }
  }

  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  // Prevent unhandled pool idle socket errors from crashing the Node process
  pool.on("error", () => {
    // Logged at query boundary if next query fails
  })
  const instance = drizzleNodePg(pool, { schema })
  return {
    db: instance,
    driver: "node-postgres",
    close: async () => {
      await pool.end()
    },
  }
}

const globalForDb = globalThis as unknown as {
  __alRamlahManagedDb?: ManagedDatabaseInstance
  __alRamlahManagedDbUrl?: string
}

function getOrCreateGlobalDatabase(): ManagedDatabaseInstance {
  const url = resolveConnectionString()
  if (
    globalForDb.__alRamlahManagedDb &&
    globalForDb.__alRamlahManagedDbUrl === url
  ) {
    return globalForDb.__alRamlahManagedDb
  }

  const created = createDatabaseClient(url)
  globalForDb.__alRamlahManagedDb = created
  globalForDb.__alRamlahManagedDbUrl = url
  return created
}

const activeInstance = getOrCreateGlobalDatabase()

export const db: Database = activeInstance.db
export const activeDbDriver = activeInstance.driver

/**
 * Executes `fn` inside a real PostgreSQL `BEGIN ... COMMIT / ROLLBACK` transaction.
 * Works identically on Neon Serverless WebSocket Pool (production) and `node-postgres` TCP Pool (local/CI).
 */
export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  database: Database = db
): Promise<T> {
  return database.transaction(async (tx) => fn(tx))
}

export async function closeDatabasePool(): Promise<void> {
  if (globalForDb.__alRamlahManagedDb) {
    const current = globalForDb.__alRamlahManagedDb
    globalForDb.__alRamlahManagedDb = undefined
    globalForDb.__alRamlahManagedDbUrl = undefined
    await current.close()
    return
  }
  await activeInstance.close()
}
