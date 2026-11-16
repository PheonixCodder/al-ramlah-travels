import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import pg from "pg"

export class UnsafeScriptTargetError extends Error {
  public readonly hostname: string

  constructor(hostname: string, reason: string) {
    super(
      `REFUSED: Script execution blocked for database host "${hostname}" (${reason}). ` +
        `Use .env.audit (127.0.0.1:54329) or pass --confirm-env=${hostname} explicitly.`
    )
    this.name = "UnsafeScriptTargetError"
    this.hostname = hostname
  }
}

export function loadSafeScriptEnv(): void {
  if (process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL) {
    return
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const webRoot = path.resolve(scriptDir, "..")
  const explicitEnvPath = process.env.DOTENV_CONFIG_PATH
    ? path.resolve(webRoot, process.env.DOTENV_CONFIG_PATH)
    : null

  if (explicitEnvPath && fs.existsSync(explicitEnvPath)) {
    dotenv.config({ path: explicitEnvPath })
    return
  }

  const auditEnvPath = path.resolve(webRoot, ".env.audit")
  if (fs.existsSync(auditEnvPath)) {
    dotenv.config({ path: auditEnvPath })
    return
  }

  const defaultEnvPath = path.resolve(webRoot, ".env")
  if (fs.existsSync(defaultEnvPath)) {
    dotenv.config({ path: defaultEnvPath })
  }
}

export function maskConnectionUrl(connectionString: string): string {
  return connectionString.replace(/:[^:@/]+@/, ":***@")
}

export function assertSafeScriptTarget(
  connectionString: string,
  argv: readonly string[] = process.argv
): { hostname: string; database: string; isLocal: boolean } {
  if (!connectionString || !connectionString.trim()) {
    throw new Error("Missing DATABASE_URL_POOLED or DATABASE_URL for script execution.")
  }

  let parsed: URL
  try {
    parsed = new URL(connectionString)
  } catch {
    throw new Error("Invalid Postgres connection URL provided to script.")
  }

  const hostname = parsed.hostname.toLowerCase()
  const database = parsed.pathname.replace(/^\//, "")
  const isLocal =
    hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1"
  const isNeon = hostname.endsWith(".neon.tech") || hostname === "neon.tech"
  const isProdNodeEnv = process.env.NODE_ENV === "production"

  const confirmArg = argv.find((arg) => arg.startsWith("--confirm-env="))
  const confirmedHost = confirmArg
    ? confirmArg.slice("--confirm-env=".length).trim().toLowerCase()
    : ""

  if (isNeon || !isLocal || isProdNodeEnv) {
    if (confirmedHost !== hostname) {
      const reason = isNeon
        ? "remote Neon database"
        : isProdNodeEnv
          ? "NODE_ENV=production"
          : "non-local database host"
      throw new UnsafeScriptTargetError(hostname, reason)
    }
  }

  return { hostname, database, isLocal }
}

export function resolveGuardedScriptDatabaseUrl(
  argv: readonly string[] = process.argv
): string {
  loadSafeScriptEnv()
  const connectionString =
    process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL || ""
  assertSafeScriptTarget(connectionString, argv)
  return connectionString
}

export async function withScriptPgClient<T>(
  connectionString: string,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const pool = new pg.Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 10_000,
  })
  try {
    const client = await pool.connect()
    try {
      return await fn(client)
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}
