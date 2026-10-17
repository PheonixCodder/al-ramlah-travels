import "dotenv/config"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const connectionString =
  process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    "Missing database connection string. Ensure DATABASE_URL_POOLED or DATABASE_URL is set."
  )
}

const client = neon(connectionString)

export const db = drizzle({ client, schema })
export type Database = typeof db
