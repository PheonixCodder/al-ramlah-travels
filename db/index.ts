import "dotenv/config"
import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"

if (!process.env.DATABASE_URL_POOLED && !process.env.DATABASE_URL) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  dotenv.config({ path: path.resolve(currentDir, "../.env") })
}

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const connectionString =
  process.env.DATABASE_URL_POOLED ||
  process.env.DATABASE_URL ||
  (process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.NEXT_PHASE === "phase-production-build"
    ? "postgresql://placeholder:placeholder@localhost:5432/placeholder"
    : "")

if (!connectionString) {
  throw new Error(
    "Missing database connection string. Ensure DATABASE_URL_POOLED or DATABASE_URL is set."
  )
}

const client = neon(connectionString)

export const db = drizzle({ client, schema })
export type Database = typeof db
